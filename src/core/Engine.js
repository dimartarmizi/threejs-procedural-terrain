import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Stats from 'stats.js';
import GUI from 'lil-gui';
import { World } from './World.js';
import { eventBus } from './EventBus.js';
import { Player } from './Player.js';

export class Engine {
	constructor() {
		this.container = document.getElementById('app');
		this.scene = null;
		this.camera = null;
		this.renderer = null;
		this.controls = null;
		this.player = null;
		this.stats = null;
		this.gui = null;
		this.clock = new THREE.Clock();
		this.world = null;

		this.defaultSettings = {
			renderDistance: 3,
			chunkSize: 128,
			seed: 'my-world-001',
			time: 12.0,
			timeScale: 1.0,
			useRealTime: false,
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
			cloudCoverage: 0.6,
			cloudBase: 120,
			cloudThickness: 80,
			shadows: true,
			firstPerson: false,
			weather: 'clear'
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
			antialias: true,
			logarithmicDepthBuffer: true
		});
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
		this.controls.mouseButtons = {
			LEFT: THREE.MOUSE.ROTATE,
			MIDDLE: THREE.MOUSE.DOLLY,
			RIGHT: THREE.MOUSE.PAN
		};
		this.controls.touches = {
			ONE: THREE.TOUCH.ROTATE,
			TWO: THREE.TOUCH.DOLLY_PAN
		};
		this.controls.screenSpacePanning = false;
		this.controls.enablePan = true;
		this.controls.enableZoom = true;

		this.player = new Player(this.camera, this.renderer.domElement, null);

		const instruction = document.getElementById('fps-instruction');
		if (this.settings.firstPerson) {
			this.controls.enabled = false;
			this.player.enabled = true;
			if (instruction) instruction.style.display = 'block';
		} else {
			this.controls.enabled = true;
			this.player.enabled = false;
			if (instruction) instruction.style.display = 'none';
		}
	}

	updateControlState() {
		const instruction = document.getElementById('fps-instruction');
		if (this.settings.firstPerson) {
			this.controls.enabled = false;
			this.player.enabled = true;
			if (instruction) instruction.style.display = 'block';
		} else {
			this.controls.enabled = true;
			this.player.enabled = false;
			if (instruction) instruction.style.display = 'none';

			const dir = new THREE.Vector3(0, 0, -1);
			dir.applyQuaternion(this.camera.quaternion);
			this.controls.target.copy(this.camera.position).add(dir.multiplyScalar(10));
			this.controls.update();
		}
	}

	setupStats() {
		this.stats = new Stats();
		this.stats.showPanel(0);
		document.body.appendChild(this.stats.dom);
	}

	setupGUI() {
		this.gui = new GUI();

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

		const envFolder = this.gui.addFolder('Environment');
		envFolder.add(this.settings, 'useRealTime').name('Real-time sync').onChange((v) => {
			this.settings.useRealTime = v;
			if (this.world) this.world.timeSystem.useRealTime = v;
		});
		this.timeController = envFolder.add(this.settings, 'time', 0, 24, 0.01).name('Set Time (0-24)').onChange((v) => {
			this.settings.time = v;
			if (this.world && !this.settings.useRealTime) {
				this.world.timeSystem.setTime(v);
			}
		}).listen();
		envFolder.add(this.settings, 'timeScale', 0, 10).name('Time Scale').onChange((v) => {
			this.settings.timeScale = v;
			if (this.world) this.world.timeSystem.timeScale = v;
		});
		envFolder.add(this.settings, 'waterHeight', 0, 20).name('Water Height').onChange((v) => {
			this.settings.waterHeight = v;
			if (this.world && this.world.waterSystem) this.world.waterSystem.water.position.y = v;
		});
		envFolder.add(this.settings, 'fogDensity', 0, 0.002).name('Fog Density').onChange((v) => {
			this.settings.fogDensity = v;
			this.scene.fog.density = v;
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
		});
		lightFolder.add(this.settings, 'sunIntensity', 0, 5).name('Sun Intensity').onChange((v) => {
			this.settings.sunIntensity = v;
			if (this.world && this.world.sunLight) this.world.sunLight.intensity = v;
		});
		lightFolder.addColor(this.settings, 'sunColor').name('Sun Color').onChange((v) => {
			this.settings.sunColor = v;
			if (this.world && this.world.sunLight) this.world.sunLight.color.set(v);
		});
		lightFolder.add(this.settings, 'shadows').name('Enable Shadows').onChange((v) => {
			this.settings.shadows = v;
			if (this.world && this.world.sunLight) {
				this.world.sunLight.castShadow = v;
			}
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

		skyFolder.add(this.settings, 'cloudCoverage', 0, 1).name('Cloud Coverage').onChange((v) => {
			this.settings.cloudCoverage = v;
			if (this.world && this.world.skySystem) this.world.skySystem.sky.material.uniforms.cloudCoverage.value = v;
		});

		skyFolder.add(this.settings, 'cloudBase', 0, 1000).name('Cloud Base').onChange((v) => {
			this.settings.cloudBase = v;
			if (this.world && this.world.skySystem) this.world.skySystem.sky.material.uniforms.cloudBase.value = v;
		});

		skyFolder.add(this.settings, 'cloudThickness', 1, 500).name('Cloud Thickness').onChange((v) => {
			this.settings.cloudThickness = v;
			if (this.world && this.world.skySystem) this.world.skySystem.sky.material.uniforms.cloudThickness.value = v;
		});

		const actionsFolder = this.gui.addFolder('System Actions');

		const saveAction = () => {
			this.saveSettings();
			alert('Settings saved');
		};

		const resetAction = () => {
			if (confirm('Reset all settings to default and reload?')) {
				this.resetSettings();
			}
		};

		actionsFolder.add({ save: saveAction }, 'save').name('💾 Save Settings');
		actionsFolder.add({ reset: resetAction }, 'reset').name('🔄 Reset Defaults');
	}

	setupWorld() {
		this.world = new World(this.scene, this.camera, this.settings);
		this.world.init();
		this.player.world = this.world;
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

		this.renderer.render(this.scene, this.camera);
		this.stats.end();
	}
}
