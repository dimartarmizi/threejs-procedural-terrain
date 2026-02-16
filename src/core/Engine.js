import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Stats from 'stats.js';
import GUI from 'lil-gui';
import { World } from './World.js';
import { eventBus } from './EventBus.js';

export class Engine {
	constructor() {
		this.container = document.getElementById('app');
		this.scene = null;
		this.camera = null;
		this.renderer = null;
		this.controls = null;
		this.stats = null;
		this.gui = null;
		this.clock = new THREE.Clock();
		this.world = null;

		this.settings = {
			renderDistance: 3,
			chunkSize: 128,
			seed: 'my-world-001',
			timeScale: 1.0,
			waterHeight: 5,
			terrainHeight: 1.0,
			terrainScale: 1.0,
			ambientIntensity: 0.2,
			sunIntensity: 1.0,
			fogDensity: 0.0002,
			treeDensity: 10,
			waterColor: '#0044ff',
			sunColor: '#ffffff',
			cloudIntensity: 0.5,
			cloudScale: 0.0005,
			shadows: true
		};
	}

	init() {
		this.setupScene();
		this.setupCamera();
		this.setupRenderer();
		this.setupControls();
		this.setupStats();
		this.setupGUI();
		this.setupWorld();
		this.setupEventListeners();

		this.animate();
	}

	setupScene() {
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(0x87ceeb); // Sky blue
		this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.0002);
	}

	setupCamera() {
		this.camera = new THREE.PerspectiveCamera(
			75,
			window.innerWidth / window.innerHeight,
			0.1,
			10000
		);
		this.camera.position.set(100, 100, 100);
		this.camera.lookAt(0, 0, 0);
	}

	setupRenderer() {
		this.renderer = new THREE.WebGLRenderer({ antialias: true });
		this.renderer.setSize(window.innerWidth, window.innerHeight);
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		this.container.appendChild(this.renderer.domElement);
	}

	setupControls() {
		this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.05;
	}

	setupStats() {
		this.stats = new Stats();
		this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
		document.body.appendChild(this.stats.dom);
	}

	setupGUI() {
		this.gui = new GUI();

		const worldFolder = this.gui.addFolder('World');
		worldFolder.add(this.settings, 'renderDistance', 1, 10, 1).name('Render Distance').onFinishChange(() => {
			eventBus.emit('settingsChanged', this.settings);
		});
		worldFolder.add(this.settings, 'chunkSize', 32, 256, 1).name('Chunk Size').onFinishChange(() => {
			eventBus.emit('settingsChanged', this.settings);
		});
		worldFolder.add(this.settings, 'seed').name('Seed').onFinishChange(() => {
			eventBus.emit('settingsChanged', this.settings);
		});

		const envFolder = this.gui.addFolder('Environment');
		envFolder.add(this.settings, 'timeScale', 0, 10).name('Time Scale').onChange((v) => {
			if (this.world) this.world.timeSystem.timeScale = v;
		});
		envFolder.add(this.settings, 'waterHeight', 0, 20).name('Water Height').onChange((v) => {
			if (this.world && this.world.waterSystem) this.world.waterSystem.water.position.y = v;
		});
		envFolder.add(this.settings, 'fogDensity', 0, 0.002).name('Fog Density').onChange((v) => {
			this.scene.fog.density = v;
		});

		const lightFolder = this.gui.addFolder('Lighting');
		lightFolder.add(this.settings, 'ambientIntensity', 0, 2).name('Ambient').onChange((v) => {
			if (this.world && this.world.ambientLight) this.world.ambientLight.intensity = v;
		});
		lightFolder.add(this.settings, 'sunIntensity', 0, 5).name('Sun Intensity').onChange((v) => {
			if (this.world && this.world.sunLight) this.world.sunLight.intensity = v;
		});
		lightFolder.addColor(this.settings, 'sunColor').name('Sun Color').onChange((v) => {
			if (this.world && this.world.sunLight) this.world.sunLight.color.set(v);
		});
		lightFolder.add(this.settings, 'shadows').name('Enable Shadows').onChange((v) => {
			if (this.world && this.world.sunLight) {
				this.world.sunLight.castShadow = v;
				// Terrain and vegetation already have cast/receive set, 
				// toggling the light's castShadow is enough.
			}
		});

		const terrainFolder = this.gui.addFolder('Terrain Detail');
		terrainFolder.add(this.settings, 'terrainHeight', 0.1, 3.0).name('Height Mult').onFinishChange(() => {
			eventBus.emit('settingsChanged', this.settings);
		});
		terrainFolder.add(this.settings, 'terrainScale', 0.1, 5.0).name('Noise Scale').onFinishChange(() => {
			eventBus.emit('settingsChanged', this.settings);
		});
		terrainFolder.add(this.settings, 'treeDensity', 0, 200, 1).name('Tree Density').onFinishChange(() => {
			eventBus.emit('settingsChanged', this.settings);
		});

		const waterFolder = this.gui.addFolder('Water');
		waterFolder.addColor(this.settings, 'waterColor').name('Color').onChange((v) => {
			if (this.world && this.world.waterSystem) this.world.waterSystem.water.material.color.set(v);
		});
		waterFolder.add(this.settings, 'waterHeight', 0, 20).name('Height').onChange((v) => {
			if (this.world && this.world.waterSystem) this.world.waterSystem.water.position.y = v;
		});

		const skyFolder = this.gui.addFolder('Sky & Clouds');
		skyFolder.add(this.settings, 'cloudIntensity', 0, 1).name('Cloud Density').onChange((v) => {
			if (this.world && this.world.skySystem) this.world.skySystem.sky.material.uniforms.cloudIntensity.value = v;
		});
		skyFolder.add(this.settings, 'cloudScale', 0.0001, 0.002).name('Cloud Scale').onChange((v) => {
			if (this.world && this.world.skySystem) this.world.skySystem.sky.material.uniforms.cloudScale.value = v;
		});
	}

	setupWorld() {
		this.world = new World(this.scene, this.camera, this.settings);
		this.world.init();
	}

	setupEventListeners() {
		window.addEventListener('resize', () => {
			this.camera.aspect = window.innerWidth / window.innerHeight;
			this.camera.updateProjectionMatrix();
			this.renderer.setSize(window.innerWidth, window.innerHeight);
		});
	}

	animate() {
		requestAnimationFrame(() => this.animate());

		this.stats.begin();
		const deltaTime = this.clock.getDelta();

		if (this.controls) this.controls.update();
		if (this.world) this.world.update(deltaTime, this.camera.position);

		this.renderer.render(this.scene, this.camera);
		this.stats.end();
	}
}
