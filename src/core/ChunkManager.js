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
	}

	update(playerPosition) {
		const { chunkSize, renderDistance } = this.settings;
		const px = Math.floor(playerPosition.x / chunkSize);
		const pz = Math.floor(playerPosition.z / chunkSize);

		const newActiveChunks = new Set();

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
					// If we had a different LOD for this coord, remove it first
					this.removeCoord(key);
					this.createChunk(cx, cz, lod);
				}
			}
		}

		// Remove old chunks
		for (const key of this.chunks.keys()) {
			if (!newActiveChunks.has(key)) {
				const chunk = this.chunks.get(key);
				this.scene.remove(chunk.mesh);
				chunk.mesh.geometry.dispose();
				chunk.mesh.material.dispose();
				this.chunks.delete(key);

				const coordKey = key.split('_')[0];
				this.vegetation.removeForChunk(coordKey);
			}
		}

		this.activeChunks = newActiveChunks;
	}

	removeCoord(coordKey) {
		for (const fullKey of this.chunks.keys()) {
			if (fullKey.startsWith(coordKey + '_')) {
				const chunk = this.chunks.get(fullKey);
				this.scene.remove(chunk.mesh);
				chunk.mesh.geometry.dispose();
				chunk.mesh.material.dispose();
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

		// Spawn vegetation for all visible chunks to match render distance
		this.vegetation.spawnForChunk(`${x},${z}`, x, z, chunkSize);
	}

	updateSettings(settings) {
		this.settings = settings;
		this.heightGenerator = new HeightGenerator(settings.seed, settings);
		this.meshBuilder = new TerrainMeshBuilder(this.heightGenerator, settings.seed);
		this.vegetation.clearAll();
		this.vegetation = new VegetationSystem(this.scene, this.heightGenerator, settings.seed, settings);

		// Clear all chunks to regenerate
		for (const chunk of this.chunks.values()) {
			this.scene.remove(chunk.mesh);
			chunk.mesh.geometry.dispose();
			chunk.mesh.material.dispose();
		}
		this.chunks.clear();
	}
}
