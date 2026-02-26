import * as THREE from 'three';
import { TerrainMeshBuilder } from '../terrain/TerrainMeshBuilder.js';
import { HeightGenerator } from '../terrain/HeightGenerator.js';
import { VegetationSystem } from '../life/VegetationSystem.js';

export class ChunkManager {
	constructor(scene, settings) {
		this.scene = scene;
		this.settings = settings;
		this.chunks = new Map();
		this.heightGenerator = new HeightGenerator(settings.seed, settings);
		this.meshBuilder = new TerrainMeshBuilder(this.heightGenerator, settings.seed, settings);
		this.vegetation = new VegetationSystem(scene, this.heightGenerator, settings.seed, settings);
		this.activeChunks = new Set();

		this.generationQueue = [];
		this.lastUpdatePos = new THREE.Vector3(Infinity, Infinity, Infinity);
		this.updateThreshold = settings.chunkSize / 8;
	}

	update(playerPosition) {
		const distMoved = playerPosition.distanceTo(this.lastUpdatePos);

		if (distMoved > this.updateThreshold) {
			this.refreshChunks(playerPosition);
			this.lastUpdatePos.copy(playerPosition);
		}

		this.processQueue();
	}

	refreshChunks(playerPosition) {
		const { chunkSize, renderDistance } = this.settings;
		const px = Math.floor(playerPosition.x / chunkSize);
		const pz = Math.floor(playerPosition.z / chunkSize);

		const newActiveChunks = new Set();
		const chunksToCreate = [];

		for (let x = -renderDistance; x <= renderDistance; x++) {
			for (let z = -renderDistance; z <= renderDistance; z++) {
				const cx = px + x;
				const cz = pz + z;
				const key = `${cx},${cz}`;

				const dist = Math.sqrt(x * x + z * z);
				let lod = 0;
				if (dist > 3) lod = 2;
				else if (dist > 1) lod = 1;

				const lodKey = `${key}_${lod}`;
				newActiveChunks.add(lodKey);

				if (!this.chunks.has(lodKey)) {
					const inQueue = this.generationQueue.some(q => q.key === lodKey);
					if (!inQueue) {
						chunksToCreate.push({ cx, cz, lod, key: lodKey, dist });
					}
				}
			}
		}

		chunksToCreate.sort((a, b) => a.dist - b.dist);

		for (const task of chunksToCreate) {
			this.generationQueue.push(task);
		}

		const activeCoords = new Set();
		for (const key of newActiveChunks) {
			activeCoords.add(key.split('_')[0]);
		}

		for (const key of this.chunks.keys()) {
			const coordKey = key.split('_')[0];

			if (!activeCoords.has(coordKey)) {
				const chunk = this.chunks.get(key);
				this.scene.remove(chunk.mesh);
				if (chunk.mesh.geometry) chunk.mesh.geometry.dispose();
				this.chunks.delete(key);
				this.vegetation.removeForChunk(coordKey);
			}
		}

		this.activeChunks = newActiveChunks;
	}

	processQueue() {
		if (this.generationQueue.length === 0) return;

		const task = this.generationQueue.shift();

		if (this.activeChunks.has(task.key)) {
			const coordKey = task.key.split('_')[0];

			let oldLODKey = null;
			for (const existingKey of this.chunks.keys()) {
				if (existingKey.startsWith(coordKey + '_') && existingKey !== task.key) {
					oldLODKey = existingKey;
					break;
				}
			}

			this.createChunk(task.cx, task.cz, task.lod);

			if (oldLODKey) {
				const oldChunk = this.chunks.get(oldLODKey);
				if (oldChunk) {
					this.scene.remove(oldChunk.mesh);
					if (oldChunk.mesh.geometry) oldChunk.mesh.geometry.dispose();
					this.chunks.delete(oldLODKey);
				}
			}
		}
	}

	removeCoord(coordKey) {
		for (const fullKey of this.chunks.keys()) {
			if (fullKey.startsWith(coordKey + '_')) {
				const chunk = this.chunks.get(fullKey);
				this.scene.remove(chunk.mesh);
				if (chunk.mesh.geometry) chunk.mesh.geometry.dispose();
				this.chunks.delete(fullKey);
			}
		}
		this.vegetation.removeForChunk(coordKey);
	}

	createChunk(x, z, lod = 0) {
		const { chunkSize } = this.settings;
		const resolutions = [128, 64, 32];
		const resolution = this.settings.chunkResolution || resolutions[lod];

		const mesh = this.meshBuilder.build(x, z, chunkSize, resolution);
		mesh.userData = mesh.userData || {};
		mesh.userData.chunkSize = chunkSize;
		mesh.position.set(x * chunkSize, 0, z * chunkSize);
		this.scene.add(mesh);
		this.chunks.set(`${x},${z}_${lod}`, { mesh });

		const coordKey = `${x},${z}`;
		this.vegetation.spawnForChunk(coordKey, x, z, chunkSize);
	}

	updateSettings(settings) {
		this.settings = settings;
		this.updateThreshold = settings.chunkSize / 8;
		this.heightGenerator = new HeightGenerator(settings.seed, settings);
		this.meshBuilder = new TerrainMeshBuilder(this.heightGenerator, settings.seed, settings);
		this.vegetation.clearAll();
		this.vegetation = new VegetationSystem(this.scene, this.heightGenerator, settings.seed, settings);

		for (const chunk of this.chunks.values()) {
			this.scene.remove(chunk.mesh);
			if (chunk.mesh.geometry) chunk.mesh.geometry.dispose();
		}
		this.chunks.clear();
		this.activeChunks.clear();
		this.generationQueue = [];
		this.lastUpdatePos.set(Infinity, Infinity, Infinity);
	}

	updateNoiseSettings(settings) {
		this.settings = settings;
		if (this.meshBuilder) {
			this.meshBuilder.noiseScale = settings.noiseScale;
			this.meshBuilder.noiseIntensity = settings.noiseIntensity;
			this.meshBuilder.noiseEnabled = !!settings.noiseEnabled;
		}

		for (const [key, chunk] of this.chunks.entries()) {
			const coord = key.split('_')[0];
			const parts = coord.split(',');
			const cx = parseInt(parts[0], 10);
			const cz = parseInt(parts[1], 10);
			if (chunk && chunk.mesh) {
				chunk.mesh.userData = chunk.mesh.userData || {};
				chunk.mesh.userData.chunkSize = this.settings.chunkSize;
				this.meshBuilder.recolorMesh(chunk.mesh, cx, cz);
			}
		}
	}
}
