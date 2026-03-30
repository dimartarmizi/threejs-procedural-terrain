import * as THREE from 'three';
import { World } from '../core/world.js';
import { Player } from '../core/player.js';
import { CameraController } from '../core/camera.js';
import { SettingsStore } from './settingsStore.js';
import { DEFAULT_SETTINGS } from './defaultSettings.js';
import { createRenderPipeline, resizeRenderPipeline } from './renderPipeline.js';
import { createEngineGui } from './guiController.js';
import { HudController } from '../ui/hudController.js';

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
		this.gui = null;
		this.lastTime = performance.now();
		this.world = null;
		this.frameCount = 0;
		this.lastFpsTime = performance.now();
		this.fps = 0;
		this.busyAccum = 0;
		this.settingsStore = new SettingsStore('terrain_engine_settings', DEFAULT_SETTINGS);
		this.settings = this.settingsStore.load();
		this.hud = new HudController();
		this.renderPipeline = null;
	}

	saveSettings() {
		this.settingsStore.save(this.settings);
	}

	resetSettings() {
		this.settings = this.settingsStore.reset();
		this.saveSettings();
		location.reload();
	}

	init() {
		this.setupScene();
		this.setupCamera();
		this.setupRenderer();
		this.setupControls();
		this.setupWorld();
		this.setupGUI();
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
			3000
		);
		this.camera.position.set(100, 100, 100);
		this.camera.lookAt(0, 0, 0);
	}

	setupRenderer() {
		this.renderer = new THREE.WebGLRenderer({
			antialias: false
		});
		this.renderer.setSize(window.innerWidth, window.innerHeight);
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFShadowMap;

		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.renderer.toneMappingExposure = 1.0;

		this.container.appendChild(this.renderer.domElement);
		this.renderPipeline = createRenderPipeline(this.scene, this.camera, this.renderer, this.settings);
		this.composer = this.renderPipeline.composer;
		this.renderPass = this.renderPipeline.renderPass;
		this.bloomPass = this.renderPipeline.bloomPass;
		this.outputPass = this.renderPipeline.outputPass;
	}

	setupControls() {
		this.player = new Player(this.camera, this.renderer.domElement, null, this.hud);
		this.cameraController = new CameraController(this.camera, this.renderer.domElement, this.player, this.world, this.settings, this.hud);
		this.controls = this.cameraController.controls;

		if (this.settings.firstPerson) {
			this.cameraController.switchToFirstPerson();
			this.hud.setInstructionVisible(true);
		} else {
			this.cameraController.switchToOrbit();
			this.hud.setInstructionVisible(false);
		}
	}

	updateControlState() {
		if (this.settings.firstPerson) {
			this.cameraController.switchToFirstPerson();
			this.hud.setInstructionVisible(true);
		} else {
			this.cameraController.switchToOrbit();
			this.hud.setInstructionVisible(false);
		}
	}

	setupGUI() {
		this.gui = createEngineGui(this);
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
			resizeRenderPipeline(this.renderPipeline, window.innerWidth, window.innerHeight);
		});
	}

	animate() {
		requestAnimationFrame(() => this.animate());

		const frameStart = performance.now();
		const deltaTime = Math.min(0.1, (frameStart - this.lastTime) / 1000);
		this.lastTime = frameStart;
		this.frameCount++;

		if (this.settings.firstPerson) {
			this.player.update(deltaTime);
		} else if (this.controls) {
			this.controls.update();
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
		const worldInfo = this.world ? this.world.update(deltaTime, focusPosition) : null;
		if (worldInfo) this.hud.updateWorldInfo(worldInfo);

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
				this.hud.updatePerformance(this.fps, avgBusy);
				this.frameCount = 0;
				this.busyAccum = 0;
				this.lastFpsTime = now;
			}
		} catch (error) {
		}
	}
}