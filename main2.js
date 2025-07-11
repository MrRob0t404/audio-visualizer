import * as THREE from 'three';

// — Globals
let scene, camera, renderer, listener, sound, analyser, lines;
let lastFrameTime = 0;
const FFT_SIZE = 128;

// — Entry point
init();
animate();

// — Initialization
function init() {
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    document.body.appendChild(renderer.domElement);
    updateRendererSize();

    // Scene & Camera
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-550, -250, 1200, -200, 200, 5000);
    camera.position.set(400, 1000, 300);
    camera.lookAt(400, 0, 0);

    // Audio listener & analyser
    listener = new THREE.AudioListener();
    camera.add(listener);

    sound = new THREE.Audio(listener);
    new THREE.AudioLoader().load(
        '/audio_files/test.mp3',
        buffer => {
            sound.setBuffer(buffer);
            sound.setLoop(true);
            sound.setVolume(1);
        },
        undefined,
        err => console.error('Audio load error:', err)
    );

    analyser = new THREE.AudioAnalyser(sound, FFT_SIZE);

    // Group to hold all the "trace" planes
    lines = new THREE.Group();
    scene.add(lines);

    // Interaction
    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('click', togglePlayback);
}

// — The render loop
function animate(now) {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);

    // throttle addLine to ~200fps
    if (!lastFrameTime || now - lastFrameTime >= 5) {
        lastFrameTime = now;
        const spectrum = analyser.getFrequencyData();
        moveLines();
        addLine(spectrum);
    }
}

// — Create a new "slice" of waveform
function addLine(fft) {
    // Plane geometry (199 segments wide, 1 tall)
    const planeGeom = new THREE.PlaneGeometry(199, 1, 199, 1);
    const planeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const plane = new THREE.Mesh(planeGeom, planeMat);
    lines.add(plane);

    // Extract the top edge into a line
    const positions = planeGeom.attributes.position.array;
    const verts = [];
    for (let i = 0; i < 200; i++) {
        verts.push(
            positions[3 * i],
            positions[3 * i + 1],
            positions[3 * i + 2]
        );
    }
    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute('position',
        new THREE.BufferAttribute(new Float32Array(verts), 3)
    );
    const lineMat = new THREE.LineBasicMaterial({
        color: 0xe1e1e1,
        transparent: true,
        opacity: 0.57
    });
    const line = new THREE.Line(lineGeom, lineMat);
    plane.add(line);

    // Displace both the plane and the line vertices by FFT data
    for (let i = 0; i < 200; i++) {
        let y = 0;
        if (i >= 39 && i < 100) y = fft[102 - i];
        else if (i >= 100 && i < 161) y = fft[i - 97];
        y = Math.pow(y, 1.2);

        planeGeom.attributes.position.array[i * 3 + 1] = y;
        lineGeom.attributes.position.array[i * 3 + 1] = y;
    }
    planeGeom.attributes.position.needsUpdate = true;
    lineGeom.attributes.position.needsUpdate = true;
}

// — Push older planes backward and remove those out of view
function moveLines() {
    const toRemove = [];
    lines.children.forEach(plane => {
        const posArr = plane.geometry.attributes.position.array;
        const lineArr = plane.children[0].geometry.attributes.position.array;

        // Shift Z positions back by 1 unit
        for (let i = 0; i < 400; i++) {
            posArr[i * 3 + 2] -= 1;
            if (i < 200) lineArr[i * 3 + 2] -= 1;
        }

        // Remove if it's sailed off to z ≤ −1000
        if (posArr[2] <= -1000) toRemove.push(plane);
        else {
            plane.geometry.attributes.position.needsUpdate = true;
            plane.children[0].geometry.attributes.position.needsUpdate = true;
        }
    });
    toRemove.forEach(plane => lines.remove(plane));
}

// — Handle window resize
function onWindowResize() {
    updateRendererSize();
}

// — Toggle playback on click
function togglePlayback() {
    if (!sound.isPlaying) sound.play();
    else sound.pause();
}

// — Utility: fit renderer to window (keeping square aspect)
function updateRendererSize() {
    const size = Math.min(window.innerWidth, window.innerHeight) * 0.66;
    renderer.setSize(size, size);
}
