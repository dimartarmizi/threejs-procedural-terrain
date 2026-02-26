import * as THREE from 'three';
import { BiomeRegistry } from '../biomes/BiomeRegistry.js';
import { BiomeMap } from './BiomeMap.js';
import { Noise } from './Noise.js';

export class TerrainMeshBuilder {
	constructor(heightGenerator, seed, settings = {}) {
		this.heightGenerator = heightGenerator;
		this.biomeMap = new BiomeMap(seed);

		this.noise = new Noise(seed || 0);

		this.settings = settings || {};
		this.noiseScale = typeof this.settings.noiseScale === 'number' ? this.settings.noiseScale : 0.02;
		this.noiseIntensity = typeof this.settings.noiseIntensity === 'number' ? this.settings.noiseIntensity : 0.012;
		this.noiseEnabled = typeof this.settings.noiseEnabled === 'boolean' ? this.settings.noiseEnabled : true;

		this.material = new THREE.MeshStandardMaterial({
			vertexColors: true,
			flatShading: false,
			roughness: 0.7,
			metalness: 0.1
		});
	}

	recolorMesh(mesh, chunkX, chunkZ) {
		if (!mesh || !mesh.geometry) return;

		const geometry = mesh.geometry;
		const vertices = geometry.attributes.position.array;
		let colors = geometry.attributes.color ? geometry.attributes.color.array : null;
		if (!colors || colors.length !== vertices.length) {
			colors = new Float32Array(vertices.length);
		}

		const worldOffsetX = chunkX * (mesh.userData.chunkSize || 0);
		const worldOffsetZ = chunkZ * (mesh.userData.chunkSize || 0);
		const normalAttr = geometry.attributes.normal || null;
		const tempNormal = new THREE.Vector3();

		for (let i = 0; i < vertices.length; i += 3) {
			const x = vertices[i] + worldOffsetX;
			const z = vertices[i + 2] + worldOffsetZ;
			const h = vertices[i + 1];

			const temp = this.heightGenerator.biomeMap.getTemperature(x, z);
			const moisture = this.heightGenerator.biomeMap.getMoisture(x, z);

			let baseColor = BiomeRegistry.getBlendedColor(h, moisture, temp);

			if (normalAttr) {
				tempNormal.set(normalAttr.getX(i / 3), normalAttr.getY(i / 3), normalAttr.getZ(i / 3));
				const slope = 1.0 - tempNormal.y;
				if (slope > 0.4 && h > 10) {
					const rockColor = new THREE.Color(0x333333);
					const mix = Math.min((slope - 0.4) * 4, 1.0);
					baseColor.lerp(rockColor, mix);
				}
			}

			if (this.noise && this.noiseEnabled) {
				const scale = this.noiseScale || 0.02;
				const intensity = this.noiseIntensity || 0.012;

				const n = this.noise.fbm(x * scale, z * scale, 3, 0.5, 2.0);
				const n01 = n * 0.5 + 0.5;
				const hsl = {};
				baseColor.getHSL(hsl);
				const sat = Math.min(1, hsl.s * (0.96 + n01 * (intensity * 6)));
				const light = Math.min(1, hsl.l * (0.94 + n01 * (intensity * 4)) + Math.max(0, (h - 80) / 400));
				baseColor.setHSL(hsl.h, sat, light);

				const micro = this.noise.fbm(x * Math.max(0.1, scale * 15), z * Math.max(0.1, scale * 15), 2, 0.55, 2.0);
				baseColor.offsetHSL(0, 0, micro * (intensity * 1.2));
			}

			colors[i] = baseColor.r;
			colors[i + 1] = baseColor.g;
			colors[i + 2] = baseColor.b;
		}

		geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
		geometry.attributes.color.needsUpdate = true;
		geometry.computeVertexNormals();
	}

	build(chunkX, chunkZ, size, resolution = 64) {
		const geometry = new THREE.PlaneGeometry(size, size, resolution, resolution);
		geometry.rotateX(-Math.PI / 2);

		const vertices = geometry.attributes.position.array;
		const colors = new Float32Array(vertices.length);
		const worldOffsetX = chunkX * size;
		const worldOffsetZ = chunkZ * size;

		const tempNormal = new THREE.Vector3();

		for (let i = 0; i < vertices.length; i += 3) {
			const x = vertices[i] + worldOffsetX;
			const z = vertices[i + 2] + worldOffsetZ;

			const { h, temp, moisture } = this.heightGenerator.getData(x, z);
			vertices[i + 1] = h;
		}

		geometry.computeVertexNormals();
		const normalAttr = geometry.attributes.normal;

		for (let i = 0; i < vertices.length; i += 3) {
			const x = vertices[i] + worldOffsetX;
			const z = vertices[i + 2] + worldOffsetZ;
			const h = vertices[i + 1];

			const temp = this.heightGenerator.biomeMap.getTemperature(x, z);
			const moisture = this.heightGenerator.biomeMap.getMoisture(x, z);

			let baseColor = BiomeRegistry.getBlendedColor(h, moisture, temp);

			tempNormal.set(normalAttr.getX(i / 3), normalAttr.getY(i / 3), normalAttr.getZ(i / 3));
			const slope = 1.0 - tempNormal.y;

			if (slope > 0.4 && h > 10) {
				const rockColor = new THREE.Color(0x333333);
				const mix = Math.min((slope - 0.4) * 4, 1.0);
				baseColor.lerp(rockColor, mix);
			}

			if (this.noise && this.noiseEnabled) {
				const scale = this.noiseScale || 0.02;
				const intensity = this.noiseIntensity || 0.012;

				const n = this.noise.fbm(x * scale, z * scale, 3, 0.5, 2.0);
				const n01 = n * 0.5 + 0.5;
				const hsl = {};
				baseColor.getHSL(hsl);
				const sat = Math.min(1, hsl.s * (0.96 + n01 * (intensity * 6)));
				const light = Math.min(1, hsl.l * (0.94 + n01 * (intensity * 4)) + Math.max(0, (h - 80) / 400));
				baseColor.setHSL(hsl.h, sat, light);

				const micro = this.noise.fbm(x * Math.max(0.1, scale * 15), z * Math.max(0.1, scale * 15), 2, 0.55, 2.0);
				baseColor.offsetHSL(0, 0, micro * (intensity * 1.2));
			}

			colors[i] = baseColor.r;
			colors[i + 1] = baseColor.g;
			colors[i + 2] = baseColor.b;
		}

		geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
		geometry.computeVertexNormals();

		const mesh = new THREE.Mesh(geometry, this.material);
		mesh.userData = mesh.userData || {};
		mesh.userData.chunkSize = size;
		mesh.receiveShadow = true;
		mesh.castShadow = true;

		return mesh;
	}
}
