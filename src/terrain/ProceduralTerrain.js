import * as THREE from 'three';
import { getTerrainOptions } from './config.js';
import { createSimplexNoise2D } from './noise.js';
import { applyTerrainColor, setupTerrainColorMaterial } from './color.js';
import { setupFogMaterial } from '../core/fog.js';
import { RoadNetwork } from './roadNetwork.js';

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

export class ProceduralTerrain {
	constructor(options = {}) {
		this.sharedMaterial = new THREE.MeshStandardMaterial({
			color: 0xffffff,
			roughness: 1,
			metalness: 0,
			wireframe: false,
		});
		this.setOptions(options);
		setupTerrainColorMaterial(this.sharedMaterial, this);
		setupFogMaterial(this.sharedMaterial);
		applyTerrainColor(this.sharedMaterial, this);
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
		this.rawNoise = this.noise.raw;

		this.roadNetwork = new RoadNetwork(this);

		applyTerrainColor(this.sharedMaterial, this);
	}

	sampleHeight(worldX, worldZ) {
		const sampleX = worldX / this.scale;
		const sampleZ = worldZ / this.scale;

		const macroZone = this.rawNoise(sampleX * 0.28 + 31.4, sampleZ * 0.28 - 19.2);
		const valleyFlatness = clamp((0.18 - macroZone) / 0.55, 0, 1);
		const valleyBlend = valleyFlatness * valleyFlatness * (3 - 2 * valleyFlatness);

		const broadNoise = this.noise(sampleX, sampleZ);
		const detailNoise = this.rawNoise(sampleX * 1.9 + 17.3, sampleZ * 1.9 - 11.8);
		const ridgeNoise = 1 - Math.abs(broadNoise);
		const rawShape = clamp(broadNoise * 0.7 + detailNoise * 0.3 + ridgeNoise * 0.2, -1, 1);

		const flatShape = rawShape * 0.14 - 0.04;
		const terrainShape = rawShape + (flatShape - rawShape) * (valleyBlend * 0.78);
		let height = terrainShape * this.heightMultiplier + this.baseHeight;

		if (this.terrainType !== 'desert') {
			const warpX = this.rawNoise(sampleX * 0.55 + 7.1, sampleZ * 0.55 - 3.3) * 0.32;
			const warpZ = this.rawNoise(sampleX * 0.55 - 5.8, sampleZ * 0.55 + 9.4) * 0.32;
			const riverVal = Math.abs(this.rawNoise(sampleX * 0.42 + warpX, sampleZ * 0.42 + warpZ));
			const riverWidth = 0.036 + valleyBlend * 0.022;
			if (riverVal < riverWidth * 2.4 && height > -18 && height < this.heightMultiplier * 0.65) {
				const t = clamp(1 - riverVal / (riverWidth * 2.4), 0, 1);
				const bankSmooth = t * t * (3 - 2 * t);
				const channelT = clamp(1 - riverVal / riverWidth, 0, 1);
				const channelSmooth = channelT * channelT * (3 - 2 * channelT);
				const oceanFade = clamp((height + 18) / 20, 0, 1);
				const valleyTarget = Math.min(height, 26);
				height = height + (valleyTarget - height) * bankSmooth * 0.85 * oceanFade;
				const channelTarget = Math.min(height, -18);
				height = height + (channelTarget - height) * channelSmooth;
			}
		}

		return height;
	}

	createTileGeometry(tileX, tileZ, resolution = this.tileResolution) {
		const geometry = new THREE.PlaneGeometry(this.tileSize, this.tileSize, resolution, resolution);
		geometry.rotateX(-Math.PI / 2);
		this.updateTileGeometry(geometry, tileX * this.tileSize, tileZ * this.tileSize, resolution);
		return geometry;
	}

	createTileMesh(tileX, tileZ, wireframe, resolution = this.tileResolution) {
		this.sharedMaterial.wireframe = wireframe;
		const geometry = this.createTileGeometry(tileX, tileZ, resolution);
		const mesh = new THREE.Mesh(geometry, this.sharedMaterial);
		mesh.position.x = tileX * this.tileSize;
		mesh.position.z = tileZ * this.tileSize;
		mesh.userData.tileX = tileX;
		mesh.userData.tileZ = tileZ;
		mesh.userData.resolution = resolution;
		return mesh;
	}

	updateTileMesh(tile, resolution = tile.userData.resolution || this.tileResolution) {
		if (tile.userData.resolution !== resolution) {
			tile.geometry.dispose();
			tile.geometry = this.createTileGeometry(tile.userData.tileX, tile.userData.tileZ, resolution);
			tile.userData.resolution = resolution;
			return;
		}
		this.updateTileGeometry(tile.geometry, tile.position.x, tile.position.z, resolution);
	}

	updateTileGeometry(geometry, worldOffsetX, worldOffsetZ, resolution = this.tileResolution) {
		const position = geometry.attributes.position;
		const half = this.tileSize * 0.5;
		const minX = worldOffsetX - half;
		const maxX = worldOffsetX + half;
		const minZ = worldOffsetZ - half;
		const maxZ = worldOffsetZ + half;
		const tileRoads = resolution >= this.tileResolution
			? this.roadNetwork.getRoadsInBounds(minX, maxX, minZ, maxZ)
			: [];
		const gradingSegments = tileRoads.length > 0
			? this.roadNetwork.collectGradingSegments(tileRoads, minX, maxX, minZ, maxZ)
			: [];

		for (let index = 0; index < position.count; index += 1) {
			const worldX = worldOffsetX + position.getX(index);
			const worldZ = worldOffsetZ + position.getZ(index);
			const height = gradingSegments.length > 0
				? this.roadNetwork.sampleGradedHeight(worldX, worldZ, gradingSegments)
				: this.sampleHeight(worldX, worldZ);
			position.setY(index, height);
		}

		position.needsUpdate = true;
		geometry.computeVertexNormals();
		geometry.attributes.normal.needsUpdate = true;
		geometry.computeBoundingBox();
		geometry.computeBoundingSphere();
	}
}
