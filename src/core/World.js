import * as THREE from 'three';
import { ChunkManager } from './ChunkManager.js';
import { eventBus } from './EventBus.js';
import { TimeSystem } from '../environment/TimeSystem.js';
import { SkySystem } from '../environment/SkySystem.js';
import { WaterSystem } from '../environment/WaterSystem.js';
import { BiomeMap } from '../terrain/BiomeMap.js';
import { BiomeRegistry } from '../biomes/BiomeRegistry.js';

export class World {
	constructor(scene, camera, settings) {
		this.scene = scene;
		this.camera = camera;
		this.settings = settings;
		this.chunkManager = null;
		this.ambientLight = null;
		this.sunLight = null;
		this.timeSystem = new TimeSystem();
		this.skySystem = null;
		this.waterSystem = null;
		this.biomeMap = new BiomeMap(settings.seed);
	}

	init() {
		this.setupLights();
		this.setupChunkManager();
		this.setupEnvironment();
		this.setupEventListeners();
	}

	setupLights() {
		this.ambientLight = new THREE.AmbientLight(0xffffff, this.settings.ambientIntensity || 0.2);
		this.scene.add(this.ambientLight);

		this.sunLight = new THREE.DirectionalLight(0xffffff, this.settings.sunIntensity || 1.0);
		this.sunLight.castShadow = this.settings.shadows !== undefined ? this.settings.shadows : true;

		this.sunLight.shadow.mapSize.set(2048, 2048);
		this.sunLight.shadow.camera.left = -200;
		this.sunLight.shadow.camera.right = 200;
		this.sunLight.shadow.camera.top = 200;
		this.sunLight.shadow.camera.bottom = -200;
		this.sunLight.shadow.camera.near = 1;
		this.sunLight.shadow.camera.far = 1000;
		this.sunLight.shadow.bias = -0.0005;

		this.scene.add(this.sunLight);
		this.scene.add(this.sunLight.target);
	}

	setupEnvironment() {
		this.skySystem = new SkySystem(this.scene, this.camera);
		this.waterSystem = new WaterSystem(this.scene);
	}

	setupChunkManager() {
		this.chunkManager = new ChunkManager(this.scene, this.settings);
	}

	setupEventListeners() {
		eventBus.on('settingsChanged', (newSettings) => {
			this.settings = newSettings;
			this.biomeMap = new BiomeMap(newSettings.seed);
			this.chunkManager.updateSettings(newSettings);
		});
	}

	update(deltaTime, playerPosition) {
		const time = this.timeSystem.update(deltaTime);
		const env = this.skySystem.update(time, deltaTime);

		const sunDist = 500;
		this.sunLight.position.set(
			playerPosition.x + env.sunDirection.x * sunDist,
			playerPosition.y + env.sunDirection.y * sunDist,
			playerPosition.z + env.sunDirection.z * sunDist
		);
		this.sunLight.target.position.copy(playerPosition);
		this.sunLight.intensity = env.sunIntensity;

		if (this.chunkManager) {
			this.chunkManager.update(playerPosition);
		}

		if (this.waterSystem) {
			this.waterSystem.update(deltaTime, playerPosition);
		}

		const timeHud = document.getElementById('time');
		if (timeHud) timeHud.innerText = `Time: ${this.timeSystem.getTimeString()}`;

		const coordsHud = document.getElementById('coords');
		if (coordsHud) coordsHud.innerText = `X: ${playerPosition.x.toFixed(0)}, Z: ${playerPosition.z.toFixed(0)}`;

		const biomeHud = document.getElementById('biome');
		if (biomeHud) {
			const temp = this.biomeMap.getTemperature(playerPosition.x, playerPosition.z);
			const moisture = this.biomeMap.getMoisture(playerPosition.x, playerPosition.z);
			const height = this.chunkManager.heightGenerator.getHeight(playerPosition.x, playerPosition.z);
			const biome = BiomeRegistry.getBiome(height, moisture, temp);
			biomeHud.innerText = `Biome: ${biome.id.toUpperCase()}`;
		}
	}
}
