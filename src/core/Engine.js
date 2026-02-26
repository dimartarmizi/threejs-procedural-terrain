import * as THREE from 'three';
import GUI from 'lil-gui';
import { World } from './World.js';
import { eventBus } from './EventBus.js';
import { Player } from './Player.js';
import { CameraController } from './Camera.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export class Engine {
	constructor() {
		this.container = document.getElementById('app');
		this.scene = null;
		this.camera = null;
		this.renderer = null;
		this.composer = null;
		this.controls = null;
		this.cameraController = null;
		this.player = null;
		this.stats = null;
		this.gui = null;
		this.clock = new THREE.Clock();
		this.world = null;
		this.frameCount = 0;
		this.lastFpsTime = performance.now();
		this.fps = 0;
		this.fpsElem = null;
		this.cpuElem = null;
		this.memoryElem = null;
		this.busyAccum = 0;

		this.defaultSettings = {
			renderDistance: 4,
			chunkSize: 128,
			chunkResolution: 64,
			seed: 'my-world-001',
			time: 10.0,
			timeScale: 1.0,
			useRealTime: false,
			waterHeight: 6,
			terrainHeight: 1.0,
			terrainScale: 0.8,
			ambientIntensity: 0.3,
			sunIntensity: 1.0,
			fogDensity: 0.00015,
			treeDensity: 3,
			waterColor: '#1a5fb4',
			sunColor: '#fff5e6',
			cloudIntensity: 0.6,
			cloudScale: 0.0004,
			cloudCoverage: 0.55,
			cloudBase: 130,
			cloudThickness: 70,
			shadows: true,
			firstPerson: false,
			weather: 'clear',
			bloomIntensity: 0.3,
			bloomThreshold: 0.1,
			bloomRadius: 0.5,
			postProcessing: true,
			noiseIntensity: 0.01,
			noiseScale: 0.1,
			noiseEnabled: true
		};

		this.settings = this.loadSettings();
	}

	loadSettings() {
		const saved = localStorage.getItem('terrain_engine_settings');
		if (saved) {
			try {
				const parsed = JSON.parse(saved);
				return { ...this.defaultSettings, ...parsed };
			} catch (e) {
				return { ...this.defaultSettings };
			}
		}
		return { ...this.defaultSettings };
	}

	saveSettings() {
		localStorage.setItem('terrain_engine_settings', JSON.stringify(this.settings));
	}

	resetSettings() {
		this.settings = { ...this.defaultSettings };
		this.saveSettings();
		location.reload();
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
		this.scene.background = new THREE.Color(0x87ceeb);
		this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.0002);
	}

	setupCamera() {
		this.camera = new THREE.PerspectiveCamera(
			75,
			window.innerWidth / window.innerHeight,
			0.5,
			20000
		);
		this.camera.position.set(100, 100, 100);
		this.camera.lookAt(0, 0, 0);
	}

	setupRenderer() {
		this.renderer = new THREE.WebGLRenderer({
			antialias: false,
			logarithmicDepthBuffer: true
		});
		this.renderer.setSize(window.innerWidth, window.innerHeight);
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.renderer.toneMappingExposure = 1.0;

		this.container.appendChild(this.renderer.domElement);

		this.renderPass = new RenderPass(this.scene, this.camera);
		this.bloomPass = new UnrealBloomPass(
			new THREE.Vector2(window.innerWidth, window.innerHeight),
			this.settings.bloomIntensity || 0.4,
			this.settings.bloomRadius || 0.5,
			this.settings.bloomThreshold || 0.1
		);

		this.outputPass = new OutputPass();

		this.composer = new EffectComposer(this.renderer);
		this.composer.addPass(this.renderPass);
		this.composer.addPass(this.bloomPass);
		this.composer.addPass(this.outputPass);
	}

	setupControls() {
		this.player = new Player(this.camera, this.renderer.domElement, null);

		this.cameraController = new CameraController(this.camera, this.renderer.domElement, this.player, this.world, this.settings);
		this.controls = this.cameraController.controls;

		const instruction = document.getElementById('fps-instruction');
		if (this.settings.firstPerson) {
			this.cameraController.switchToFirstPerson();
			if (instruction) instruction.style.display = 'block';
		} else {
			this.cameraController.switchToOrbit();
			if (instruction) instruction.style.display = 'none';
		}
	}

	updateControlState() {
		const instruction = document.getElementById('fps-instruction');
		if (this.settings.firstPerson) {
			this.cameraController.switchToFirstPerson();
			if (instruction) instruction.style.display = 'block';
		} else {
			this.cameraController.switchToOrbit();
			if (instruction) instruction.style.display = 'none';
		}
	}

	setupStats() {
		this.fpsElem = document.getElementById('fps');
		this.cpuElem = document.getElementById('cpu-usage');
		this.memoryElem = document.getElementById('memory-usage');
		this.lastFpsTime = performance.now();
		this.frameCount = 0;
	}

	setupGUI() {
		this.gui = new GUI();

		const resetAction = () => {
			if (confirm('Reset all settings to default and reload?')) {
				this.resetSettings();
			}
		};
		this.gui.add({ reset: resetAction }, 'reset').name('Reset Defaults');

		const worldFolder = this.gui.addFolder('World');
		worldFolder.add(this.settings, 'renderDistance', 1, 10, 1).name('Render Distance').onFinishChange(() => {
			this.saveSettings();
			eventBus.emit('settingsChanged', this.settings);
		});
		worldFolder.add(this.settings, 'chunkSize', 32, 256, 1).name('Chunk Size').onFinishChange(() => {
			this.saveSettings();
			eventBus.emit('settingsChanged', this.settings);
		});
		worldFolder.add(this.settings, 'seed').name('Seed').onFinishChange(() => {
			this.saveSettings();
			eventBus.emit('settingsChanged', this.settings);
		});
		worldFolder.add(this.settings, 'firstPerson').name('First Person Mode').onChange((v) => {
			this.settings.firstPerson = v;
			this.updateControlState();
			this.saveSettings();
		});

		worldFolder.add(this.settings, 'noiseIntensity', 0, 0.1, 0.001).name('Noise Intensity').onFinishChange(() => {
			this.saveSettings();
			eventBus.emit('settingsChanged', this.settings);
		});
		worldFolder.add(this.settings, 'noiseScale', 0.001, 0.1, 0.001).name('Noise Scale').onFinishChange(() => {
			this.saveSettings();
			eventBus.emit('settingsChanged', this.settings);
		});
		worldFolder.add(this.settings, 'noiseEnabled').name('Enable Noise').onChange((v) => {
			this.settings.noiseEnabled = !!v;
			this.saveSettings();
			eventBus.emit('settingsChanged', this.settings);
		});

		const envFolder = this.gui.addFolder('Environment');
		envFolder.add(this.settings, 'useRealTime').name('Real-time sync').onChange((v) => {
			this.settings.useRealTime = v;
			if (this.world) this.world.timeSystem.useRealTime = v;
			this.saveSettings();
		});
		this.timeController = envFolder.add(this.settings, 'time', 0, 24, 0.01).name('Set Time (0-24)').onChange((v) => {
			this.settings.time = v;
			if (this.world && !this.settings.useRealTime) {
				this.world.timeSystem.setTime(v);
			}
			this.saveSettings();
		}).listen();
		envFolder.add(this.settings, 'timeScale', 0, 10).name('Time Scale').onChange((v) => {
			this.settings.timeScale = v;
			if (this.world) this.world.timeSystem.timeScale = v;
			this.saveSettings();
		});
		envFolder.add(this.settings, 'fogDensity', 0, 0.002).name('Fog Density').onChange((v) => {
			this.settings.fogDensity = v;
			this.scene.fog.density = v;
			this.saveSettings();
		});
		envFolder.add(this.settings, 'weather', {
			'Clear': 'clear',
			'Cloudy': 'cloudy',
			'Rain': 'rain',
			'Storm': 'storm',
			'Snow': 'snow',
			'Foggy': 'foggy'
		}).name('Weather').onChange((v) => {
			this.settings.weather = v;
			this.saveSettings();
			eventBus.emit('settingsChanged', this.settings);
		});

		const lightFolder = this.gui.addFolder('Lighting');
		lightFolder.add(this.settings, 'ambientIntensity', 0, 2).name('Ambient').onChange((v) => {
			this.settings.ambientIntensity = v;
			if (this.world && this.world.ambientLight) this.world.ambientLight.intensity = v;
			this.saveSettings();
		});
		lightFolder.add(this.settings, 'sunIntensity', 0, 5).name('Sun Intensity').onChange((v) => {
			this.settings.sunIntensity = v;
			if (this.world && this.world.sunLight) this.world.sunLight.intensity = v;
			this.saveSettings();
		});
		lightFolder.addColor(this.settings, 'sunColor').name('Sun Color').onChange((v) => {
			this.settings.sunColor = v;
			if (this.world && this.world.sunLight) this.world.sunLight.color.set(v);
			this.saveSettings();
		});
		lightFolder.add(this.settings, 'shadows').name('Enable Shadows').onChange((v) => {
			this.settings.shadows = v;
			if (this.world && this.world.sunLight) {
				this.world.sunLight.castShadow = v;
			}
			this.saveSettings();
		});

		const terrainFolder = this.gui.addFolder('Terrain Detail');
		terrainFolder.add(this.settings, 'terrainHeight', 0.1, 3.0).name('Height Mult').onFinishChange(() => {
			this.saveSettings();
			eventBus.emit('settingsChanged', this.settings);
		});
		terrainFolder.add(this.settings, 'terrainScale', 0.1, 5.0).name('Noise Scale').onFinishChange(() => {
			this.saveSettings();
			eventBus.emit('settingsChanged', this.settings);
		});
		terrainFolder.add(this.settings, 'treeDensity', 0, 200, 1).name('Tree Density').onFinishChange(() => {
			this.saveSettings();
			eventBus.emit('settingsChanged', this.settings);
		});
		terrainFolder.add(this.settings, 'chunkResolution', 8, 256, 1).name('Chunk Resolution').onFinishChange(() => {
			this.saveSettings();
			eventBus.emit('settingsChanged', this.settings);
		});

		const waterFolder = this.gui.addFolder('Water');
		waterFolder.addColor(this.settings, 'waterColor').name('Color').onChange((v) => {
			if (this.world && this.world.waterSystem) this.world.waterSystem.water.material.color.set(v);
			this.saveSettings();
		});
		waterFolder.add(this.settings, 'waterHeight', 0, 20).name('Height').onChange((v) => {
			this.settings.waterHeight = v;
			if (this.world && this.world.waterSystem) this.world.waterSystem.setHeight(v);
			this.saveSettings();
		});

		const postFolder = this.gui.addFolder('Post-Processing');
		postFolder.add(this.settings, 'postProcessing').name('Enable Post-Processing').onChange((v) => {
			this.settings.postProcessing = !!v;
			this.saveSettings();
		});
		postFolder.add(this.settings, 'bloomIntensity', 0, 3).name('Bloom Intensity').onChange((v) => {
			this.settings.bloomIntensity = v;
			if (this.bloomPass) this.bloomPass.strength = v;
			this.saveSettings();
		});
		postFolder.add(this.settings, 'bloomThreshold', 0, 1).name('Bloom Threshold').onChange((v) => {
			this.settings.bloomThreshold = v;
			if (this.bloomPass) this.bloomPass.threshold = v;
			this.saveSettings();
		});
		postFolder.add(this.settings, 'bloomRadius', 0, 1).name('Bloom Radius').onChange((v) => {
			this.settings.bloomRadius = v;
			if (this.bloomPass) this.bloomPass.radius = v;
			this.saveSettings();
		});

		const skyFolder = this.gui.addFolder('Sky & Clouds');
		skyFolder.add(this.settings, 'cloudIntensity', 0, 1).name('Cloud Density').onChange((v) => {
			if (this.world && this.world.skySystem) this.world.skySystem.sky.material.uniforms.cloudIntensity.value = v;
			this.saveSettings();
		});
		skyFolder.add(this.settings, 'cloudScale', 0.0001, 0.002).name('Cloud Scale').onChange((v) => {
			if (this.world && this.world.skySystem) this.world.skySystem.sky.material.uniforms.cloudScale.value = v;
			this.saveSettings();
		});

		skyFolder.add(this.settings, 'cloudCoverage', 0, 1).name('Cloud Coverage').onChange((v) => {
			this.settings.cloudCoverage = v;
			if (this.world && this.world.skySystem) this.world.skySystem.sky.material.uniforms.cloudCoverage.value = v;
			this.saveSettings();
		});

		skyFolder.add(this.settings, 'cloudBase', 0, 1000).name('Cloud Base').onChange((v) => {
			this.settings.cloudBase = v;
			if (this.world && this.world.skySystem) this.world.skySystem.sky.material.uniforms.cloudBase.value = v;
		});

		skyFolder.add(this.settings, 'cloudThickness', 1, 500).name('Cloud Thickness').onChange((v) => {
			this.settings.cloudThickness = v;
			if (this.world && this.world.skySystem) this.world.skySystem.sky.material.uniforms.cloudThickness.value = v;
		});

	}

	setupWorld() {
		this.world = new World(this.scene, this.camera, this.settings);
		this.world.init();
		this.player.world = this.world;
		if (this.cameraController) {
			this.cameraController.world = this.world;
			this.cameraController.setInitialOrbit(this.camera.position.clone());
			if (this.settings.firstPerson) {
				this.cameraController.switchToFirstPerson();
			}
		}
	}

	setupEventListeners() {
		window.addEventListener('resize', () => {
			this.camera.aspect = window.innerWidth / window.innerHeight;
			this.camera.updateProjectionMatrix();
			this.renderer.setSize(window.innerWidth, window.innerHeight);
			if (this.composer) {
				this.composer.setSize(window.innerWidth, window.innerHeight);
			}
		});
	}

	animate() {
		requestAnimationFrame(() => this.animate());

		const frameStart = performance.now();
		const deltaTime = this.clock.getDelta();
		this.frameCount++;

		if (this.settings.firstPerson) {
			this.player.update(deltaTime);
		} else {
			if (this.controls) this.controls.update();
		}

		if (this.world && this.world.chunkManager && this.world.chunkManager.heightGenerator) {
			const hg = this.world.chunkManager.heightGenerator;
			const clearance = 2;

			if (!this.settings.firstPerson) {
				if (this.controls) {
					const t = this.controls.target;
					const terrainY = hg.getHeight(t.x, t.z);
					const minTargetY = terrainY + clearance;
					if (t.y < minTargetY) t.y = minTargetY;
					const minCameraY = terrainY + clearance + 0.5;
					if (this.camera.position.y < minCameraY) this.camera.position.y = minCameraY;
				} else {
					const p = this.camera.position;
					const terrainY = hg.getHeight(p.x, p.z);
					const minY = terrainY + clearance;
					if (p.y < minY) p.y = minY;
				}
			}
		}

		const focusPosition = this.settings.firstPerson ? this.camera.position : (this.controls ? this.controls.target : this.camera.position);
		if (this.world) this.world.update(deltaTime, focusPosition);

		if (this.settings.postProcessing && this.composer) {
			this.composer.render();
		} else {
			this.renderer.render(this.scene, this.camera);
		}

		try {
			const busy = performance.now() - frameStart;
			this.busyAccum += busy;
			const now = performance.now();
			if (now - this.lastFpsTime >= 1000) {
				const elapsed = now - this.lastFpsTime;
				this.fps = Math.round((this.frameCount * 1000) / elapsed);
				const avgBusy = this.busyAccum / Math.max(1, this.frameCount);
				if (this.fpsElem) this.fpsElem.textContent = `FPS: ${this.fps}`;
				if (this.cpuElem) {
					const cpuPercent = Math.round(Math.min(100, (avgBusy / (1000 / 60)) * 100));
					this.cpuElem.textContent = `CPU: ${cpuPercent}% (${avgBusy.toFixed(1)} ms)`;
				}
				if (this.memoryElem) {
					if (performance && performance.memory) {
						const mem = performance.memory;
						const usedMB = (mem.usedJSHeapSize / 1024 / 1024).toFixed(1);
						let totalMB = '';
						if (mem.totalJSHeapSize) totalMB = ` / ${(mem.totalJSHeapSize / 1024 / 1024).toFixed(1)} MB`;
						this.memoryElem.textContent = `Memory: ${usedMB} MB${totalMB}`;
					} else {
						this.memoryElem.textContent = `Memory: n/a`;
					}
				}
				this.frameCount = 0;
				this.busyAccum = 0;
				this.lastFpsTime = now;
			}
		} catch (e) {
		}
	}
}
