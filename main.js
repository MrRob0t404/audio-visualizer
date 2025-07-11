import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Post-Processing
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass';

import { GUI } from 'lil-gui';

const params = {
    red: 1.0,
    green: 1.0,
    blue: 1.0,
    threshold: 0.5,
    strength: 0.4,
    radius: 0.8,
};

// MIDI CONTROLS
navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);

function onMIDISuccess(midiAccess) {
    for (let input of midiAccess.inputs.values()) {
        input.onmidimessage = handleMIDIMessage;
    }
}

function onMIDIFailure() {
    console.warn('Could not access your MIDI devices.');
}

function handleMIDIMessage(message) {
    const [status, controlNumber, value] = message.data;

    if (status === 176) { // Control Change messages
        const normalized = value / 127;

        switch (controlNumber) {
            case 22: // Knob 1 - Red
                params.red = normalized;
                uniforms.u_red.value = normalized;
                break;
            case 24: // Knob 2 - Green
                params.green = normalized;
                uniforms.u_green.value = normalized;
                break;
            case 26: // Knob 3 - Blue
                params.blue = normalized;
                uniforms.u_blue.value = normalized;
                break;
            case 23: // Knob 4 - Bloom Strength (0–3)
                const s = normalized * 3;
                params.strength = s;
                bloomPass.strength = s;
                break;
            case 25: // Knob 5 - Threshold
                params.threshold = normalized;
                bloomPass.threshold = normalized;
                break;
            case 27: // Knob 6 - Radius
                params.radius = normalized;
                bloomPass.radius = normalized;
                break;
        }

        redControl.updateDisplay();
        greenControl.updateDisplay();
        blueControl.updateDisplay();
        strengthControl.updateDisplay();
        thresholdControl.updateDisplay();
        radiusControl.updateDisplay();

    }
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Sets the color of the background.
// renderer.setClearColor(0xFEFEFE);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

// Sets orbit control to move the camera around.
const orbit = new OrbitControls(camera, renderer.domElement);

// Camera positioning.
camera.position.set(6, 8, 14);
// Has to be done every time we update the camera position.
orbit.update();

// Creates a 12 by 12 grid helper.
const gridHelper = new THREE.GridHelper(12, 12);
// scene.add(gridHelper);

// Creates an axes helper with an axis length of 4.
const axesHelper = new THREE.AxesHelper(4);
// scene.add(axesHelper);

const renderScene = new RenderPass(scene, camera);

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight)
);

bloomPass.threshold = params.threshold;
bloomPass.strength = params.strength;
bloomPass.radius = params.radius;

const outputPass = new OutputPass();
const bloomComposer = new EffectComposer(renderer);

bloomComposer.addPass(renderScene);
bloomComposer.addPass(bloomPass);
bloomComposer.addPass(outputPass);

const gui = new GUI();

const colorsFolder = gui.addFolder('Colors');
const redControl = colorsFolder.add(params, 'red', 0, 1).onChange((value) => {
    uniforms.u_red.value = Number(value);
});
const greenControl = colorsFolder.add(params, 'green', 0, 1).onChange((value) => {
    uniforms.u_green.value = Number(value);
});
const blueControl = colorsFolder.add(params, 'blue', 0, 1).onChange((value) => {
    uniforms.u_blue.value = Number(value);
});

const bloomFolder = gui.addFolder('Bloom');
const strengthControl = bloomFolder.add(params, 'strength', 0, 3).onChange((value) => {
    bloomPass.strength = Number(value);
});
const thresholdControl = bloomFolder.add(params, 'threshold', 0, 1).onChange((value) => {
    bloomPass.threshold = Number(value);
});
const radiusControl = bloomFolder.add(params, 'radius', 0, 1).onChange((value) => {
    bloomPass.radius = Number(value);
});

const uniforms = {
    u_time: { value: 0.0 },
    u_frequency: { value: 0.0 },
    u_red: { value: params.red },
    u_green: { value: params.green },
    u_blue: { value: params.blue },
};

const clock = new THREE.Clock();

const mat = new THREE.ShaderMaterial({
    wireframe: true,
    uniforms,
    vertexShader: document.getElementById('vertexshader').textContent,
    fragmentShader: document.getElementById('fragmentshader').textContent,
});

const geo = new THREE.IcosahedronGeometry(4, 30);
const mesh = new THREE.Mesh(geo, mat);
scene.add(mesh);

const listener = new THREE.AudioListener();
camera.add(listener);

let analyser;
navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    .then((stream) => {
        const audioContext = listener.context;
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        const micSource = audioContext.createMediaStreamSource(stream);
        // micSource.connect(audioContext.destination); // optional

        const sound = new THREE.Audio(listener);
        sound.setNodeSource(micSource);
        sound.setVolume(1.0);

        setTimeout(() => {
            analyser = new THREE.AudioAnalyser(sound, 32);
        }, 10);
    })
    .catch((err) => {
        console.error('Microphone access error:', err);
    });

function animate() {
    uniforms.u_time.value = clock.getElapsedTime();
    if (analyser) {
        uniforms.u_frequency.value = analyser.getAverageFrequency();
    }

    mesh.rotation.x += 0.0001;
    mesh.rotation.y += 0.0001;

    bloomComposer.render();
    requestAnimationFrame(animate);
}
animate();

window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    bloomComposer.setSize(window.innerWidth, window.innerHeight);
});
