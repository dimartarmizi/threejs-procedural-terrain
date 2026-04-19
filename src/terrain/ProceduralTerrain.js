import * as THREE from 'three';
import { getTerrainOptions } from './config.js';
import { createSimplexNoise2D } from './noise.js';
import { applyTerrainColor, setupTerrainColorMaterial } from './color.js';

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

export class ProceduralTerrain {
	constructor(options = {}) {
		this.setOptions(options);
	}

	setOptions(options = {}) {
		const nextOptions = getTerrainOptions(options);

		this.tileSize = nextOptions.tileSize;
		this.scale = nextOptions.scale;
		this.heightMultiplier = nextOptions.heightMultiplier;
		this.baseHeight = nextOptions.baseHeight;
		this.octaves = nextOptions.octaves;
		this.persistence = nextOptions.persistence;
		this.lacunarity = nextOptions.lacunarity;
		this.seed = nextOptions.seed;
		this.terrainType = nextOptions.terrainType || '';
		this.colorMode = nextOptions.colorMode || 'biome';
		this.tileResolution = 48;

		this.noise = createSimplexNoise2D(this.seed, {
			octaves: this.octaves,
			persistence: this.persistence,
			lacunarity: this.lacunarity,
		});
	}

	sampleHeight(worldX, worldZ) {
		const sampleX = worldX / this.scale;
		const sampleZ = worldZ / this.scale;
		const broadNoise = this.noise(sampleX, sampleZ);
		const detailNoise = this.noise(sampleX * 1.9 + 17.3, sampleZ * 1.9 - 11.8);
		const ridgeNoise = 1 - Math.abs(broadNoise);
		const terrainShape = clamp(broadNoise * 0.7 + detailNoise * 0.3 + ridgeNoise * 0.2, -1, 1);

		return terrainShape * this.heightMultiplier + this.baseHeight;
	}

	createTileMesh(tileX, tileZ, wireframe) {
		const geometry = new THREE.PlaneGeometry(this.tileSize, this.tileSize, this.tileResolution, this.tileResolution);
		geometry.rotateX(-Math.PI / 2);

		this.updateTileGeometry(geometry, tileX * this.tileSize, tileZ * this.tileSize);

		const material = new THREE.MeshStandardMaterial({
			color: 0xffffff,
			roughness: 1,
			metalness: 0,
			wireframe: wireframe,
		});
		setupTerrainColorMaterial(material, this);
		applyTerrainColor(material, this);

		const mesh = new THREE.Mesh(geometry, material);
		mesh.position.x = tileX * this.tileSize;
		mesh.position.z = tileZ * this.tileSize;
		mesh.userData.tileX = tileX;
		mesh.userData.tileZ = tileZ;
		return mesh;
	}

	updateTileMesh(tile) {
		applyTerrainColor(tile.material, this);
		this.updateTileGeometry(tile.geometry, tile.position.x, tile.position.z);
	}

	updateTileGeometry(geometry, worldOffsetX, worldOffsetZ) {
		const position = geometry.attributes.position;

		for (let index = 0; index < position.count; index += 1) {
			const worldX = worldOffsetX + position.getX(index);
			const worldZ = worldOffsetZ + position.getZ(index);
			const height = this.sampleHeight(worldX, worldZ);
			position.setY(index, height);
		}

		position.needsUpdate = true;
		geometry.computeVertexNormals();
		geometry.attributes.normal.needsUpdate = true;
		geometry.computeBoundingBox();
		geometry.computeBoundingSphere();
	}
}
