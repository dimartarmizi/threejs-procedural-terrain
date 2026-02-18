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
		this.meshBuilder = new TerrainMeshBuilder(this.heightGenerator, settings.seed);
		this.vegetation = new VegetationSystem(scene, this.heightGenerator, settings.seed, settings);
		this.activeChunks = new Set();
		
		this.generationQueue = [];
		this.lastUpdatePos = new THREE.Vector3(Infinity, Infinity, Infinity);
		this.updateThreshold = settings.chunkSize / 8; // Update every 16 units if chunkSize is 128
	}

	update(playerPosition) {
		// Only re-scan for chunks if player moved enough
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

				// Calculate distance for LOD
				const dist = Math.sqrt(x * x + z * z);
				let lod = 0;
				if (dist > 3) lod = 2;
				else if (dist > 1) lod = 1;

				const lodKey = `${key}_${lod}`;
				newActiveChunks.add(lodKey);

				if (!this.chunks.has(lodKey)) {
					// Check if this coord is already in queue with SAME lod
					const inQueue = this.generationQueue.some(q => q.key === lodKey);
					if (!inQueue) {
						chunksToCreate.push({ cx, cz, lod, key: lodKey, dist });
					}
				}
			}
		}

		// Sort by distance to prioritize closer chunks
		chunksToCreate.sort((a, b) => a.dist - b.dist);
		
		// Add to main queue (prioritized)
		for (const task of chunksToCreate) {
			this.generationQueue.push(task);
		}

		// Remove chunks that are no longer in the active grid
		const activeCoords = new Set();
		for (const key of newActiveChunks) {
			activeCoords.add(key.split('_')[0]);
		}

		for (const key of this.chunks.keys()) {
			const coordKey = key.split('_')[0];
			
			// Only remove if the coordinate itself is no longer active
			// If LOD changed, we handle the swap in processQueue
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

		// Process only 1 chunk per frame to maintain 60fps
		const task = this.generationQueue.shift();
		
		// Before creating, double check if it's still needed (maybe player moved away)
		if (this.activeChunks.has(task.key)) {
			const coordKey = task.key.split('_')[0];
			
			// Find if there's an existing version of this chunk with different LOD
			let oldLODKey = null;
			for (const existingKey of this.chunks.keys()) {
				if (existingKey.startsWith(coordKey + '_') && existingKey !== task.key) {
					oldLODKey = existingKey;
					break;
				}
			}

			// Create the new one
			this.createChunk(task.cx, task.cz, task.lod);

			// Remove the old LOD now that the new one is visible
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
		const resolution = resolutions[lod];

		const mesh = this.meshBuilder.build(x, z, chunkSize, resolution);
		mesh.position.set(x * chunkSize, 0, z * chunkSize);
		this.scene.add(mesh);
		this.chunks.set(`${x},${z}_${lod}`, { mesh });

		// Manage vegetation based on LOD
		const coordKey = `${x},${z}`;
		if (lod <= 1) {
			this.vegetation.spawnForChunk(coordKey, x, z, chunkSize);
		} else {
			this.vegetation.removeForChunk(coordKey);
		}
	}

	updateSettings(settings) {
		this.settings = settings;
		this.updateThreshold = settings.chunkSize / 8;
		this.heightGenerator = new HeightGenerator(settings.seed, settings);
		this.meshBuilder = new TerrainMeshBuilder(this.heightGenerator, settings.seed);
		this.vegetation.clearAll();
		this.vegetation = new VegetationSystem(this.scene, this.heightGenerator, settings.seed, settings);

		// Clear all chunks to regenerate
		for (const chunk of this.chunks.values()) {
			this.scene.remove(chunk.mesh);
			if (chunk.mesh.geometry) chunk.mesh.geometry.dispose();
			// Don't dispose material here as it's shared by MeshBuilder
		}
		this.chunks.clear();
		this.activeChunks.clear();
		this.generationQueue = [];
		this.lastUpdatePos.set(Infinity, Infinity, Infinity); // Force next update to refresh
	}
}
