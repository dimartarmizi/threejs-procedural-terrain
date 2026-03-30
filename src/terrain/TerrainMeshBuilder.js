import * as THREE from 'three';
import { TextureRegistry } from '../registries/textureRegistry.js';
import { BiomeRegistry } from '../registries/biomeRegistry.js';
import { BiomeMap } from './biomeMap.js';

export class TerrainMeshBuilder {
	constructor(heightGenerator, seed, settings = {}) {
		this.heightGenerator = heightGenerator;
		this.biomeMap = new BiomeMap(seed);

		this.settings = settings || {};
		this.textureSetName = this.settings.textureSetName || 'grass';
		this.terrainTextureScale = typeof this.settings.terrainTextureScale === 'number' ? this.settings.terrainTextureScale : 32;
		this.textureLoader = new THREE.TextureLoader();
		this.textureCache = new Map();
		this.materialCache = new Map();

		this.materialTemplate = new THREE.MeshStandardMaterial({
			flatShading: false,
			roughness: 0.7,
			metalness: 0.1
		});

		this.preloadTextures();
	}

	preloadTextures() {
		for (const [name, definition] of TextureRegistry.sets.entries()) {
			if (definition && definition.color) {
				this.ensureTextureLoaded(name, definition.color);
			}
		}
	}

	loadMap(path, onLoad, isColor = false) {
		this.textureLoader.load(
			path,
			(texture) => {
				texture.wrapS = THREE.RepeatWrapping;
				texture.wrapT = THREE.RepeatWrapping;
				texture.anisotropy = 8;
				if (isColor) {
					texture.colorSpace = THREE.SRGBColorSpace;
				}
				onLoad(texture);
			},
			undefined,
			() => onLoad(null)
		);
	}

	ensureTextureLoaded(setName, path = null) {
		if (!setName) return null;

		if (this.textureCache.has(setName)) {
			return this.textureCache.get(setName);
		}

		const texturePath = path || TextureRegistry.resolveTexturePath(setName, 'color');
		if (!texturePath) return null;

		this.loadMap(texturePath, (texture) => {
			this.textureCache.set(setName, texture);
			const material = this.materialCache.get(setName);
			if (material && texture) {
				material.map = texture;
				material.needsUpdate = true;
			}
		}, true);

		return null;
	}

	applyTextureRepeat(geometry, size) {
		if (!geometry || !geometry.attributes || !geometry.attributes.uv) return;

		const repeat = size / Math.max(1, this.terrainTextureScale);
		const uv = geometry.attributes.uv;

		for (let i = 0; i < uv.count; i++) {
			uv.setXY(i, uv.getX(i) * repeat, uv.getY(i) * repeat);
		}

		uv.needsUpdate = true;
	}

	getTextureSetForBiome(biome, height, moisture) {
		if (!biome) return this.textureSetName;

		if (height > 150 || biome.id === 'snow') return 'snow';
		if (biome.id === 'ocean' || biome.id === 'beach') return 'sand';
		if (biome.id === 'desert') return 'sand';
		if (biome.id === 'mountain') return 'rock';
		if (biome.id === 'forest') return moisture > 0.6 ? 'grass' : 'dry_grass';
		if (biome.id === 'plains') return moisture > 0.45 ? 'grass' : 'dry_grass';

		return this.textureSetName;
	}

	getTextureSetForChunk(chunkX, chunkZ, size) {
		const worldX = chunkX * size + size * 0.5;
		const worldZ = chunkZ * size + size * 0.5;
		const { h, temp, moisture } = this.heightGenerator.getData(worldX, worldZ);
		const biome = BiomeRegistry.getBiome(h, moisture, temp);
		return this.getTextureSetForBiome(biome, h, moisture);
	}

	getMaterialForSet(setName) {
		const resolvedSetName = setName || this.textureSetName;
		if (this.materialCache.has(resolvedSetName)) {
			return this.materialCache.get(resolvedSetName);
		}

		const material = this.materialTemplate.clone();
		const texture = this.textureCache.get(resolvedSetName) || this.ensureTextureLoaded(resolvedSetName);
		if (texture) {
			material.map = texture;
		}

		material.needsUpdate = true;
		this.materialCache.set(resolvedSetName, material);
		return material;
	}

	build(chunkX, chunkZ, size, resolution = 64) {
		const geometry = new THREE.PlaneGeometry(size, size, resolution, resolution);
		geometry.rotateX(-Math.PI / 2);
		this.applyTextureRepeat(geometry, size);

		const vertices = geometry.attributes.position.array;
		const worldOffsetX = chunkX * size;
		const worldOffsetZ = chunkZ * size;

		for (let i = 0; i < vertices.length; i += 3) {
			const x = vertices[i] + worldOffsetX;
			const z = vertices[i + 2] + worldOffsetZ;

			const { h, temp, moisture } = this.heightGenerator.getData(x, z);
			vertices[i + 1] = h;
		}

		geometry.computeVertexNormals();

		const textureSetName = this.getTextureSetForChunk(chunkX, chunkZ, size);
		const material = this.getMaterialForSet(textureSetName);

		const mesh = new THREE.Mesh(geometry, material);
		mesh.userData = mesh.userData || {};
		mesh.userData.chunkSize = size;
		mesh.userData.textureSetName = textureSetName;
		mesh.receiveShadow = true;
		mesh.castShadow = true;

		return mesh;
	}

	recolorMesh(mesh) {
		if (!mesh || !mesh.userData) return;

		const chunkSize = mesh.userData.chunkSize || 0;
		const coordKey = mesh.userData.coordKey;
		if (!coordKey || !chunkSize) return;

		const parts = coordKey.split(',');
		const chunkX = parseInt(parts[0], 10);
		const chunkZ = parseInt(parts[1], 10);
		const textureSetName = this.getTextureSetForChunk(chunkX, chunkZ, chunkSize);
		mesh.material = this.getMaterialForSet(textureSetName);
		mesh.userData.textureSetName = textureSetName;
	}
}
