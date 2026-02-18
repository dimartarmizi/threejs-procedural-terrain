import * as THREE from 'three';
import { BiomeRegistry } from '../biomes/BiomeRegistry.js';
import { BiomeMap } from './BiomeMap.js';

export class TerrainMeshBuilder {
	constructor(heightGenerator, seed) {
		this.heightGenerator = heightGenerator;
		this.biomeMap = new BiomeMap(seed);
		this.material = new THREE.MeshStandardMaterial({
			vertexColors: true,
			flatShading: false, // Changed to false for smoother surface
			roughness: 0.7,
			metalness: 0.1
		});
	}

	build(chunkX, chunkZ, size, resolution = 64) {
		const geometry = new THREE.PlaneGeometry(size, size, resolution, resolution);
		geometry.rotateX(-Math.PI / 2);

		const vertices = geometry.attributes.position.array;
		const colors = new Float32Array(vertices.length);
		const worldOffsetX = chunkX * size;
		const worldOffsetZ = chunkZ * size;

		for (let i = 0; i < vertices.length; i += 3) {
			const x = vertices[i] + worldOffsetX;
			const z = vertices[i + 2] + worldOffsetZ;

			const { h, temp, moisture } = this.heightGenerator.getData(x, z);
			vertices[i + 1] = h;
			
			const color = BiomeRegistry.getBlendedColor(h, moisture, temp);
			colors[i] = color.r;
			colors[i + 1] = color.g;
			colors[i + 2] = color.b;
		}

		geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
		geometry.computeVertexNormals();

		const mesh = new THREE.Mesh(geometry, this.material);
		mesh.receiveShadow = true;
		mesh.castShadow = true;

		return mesh;
	}
}
