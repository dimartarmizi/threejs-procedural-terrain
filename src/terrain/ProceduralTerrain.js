import * as THREE from 'three';
import { createSimplexNoise2D } from './noise.js';

export class ProceduralTerrain {
	constructor({ tileSize = 128, segments = 48, heightScale = 40, seed = 1 } = {}) {
		this.setOptions({ tileSize, segments, heightScale, seed });
	}

	setOptions({ tileSize, segments, heightScale, seed } = {}) {
		this.tileSize = tileSize;
		this.segments = segments;
		this.heightScale = heightScale;
		this.seed = seed;

		this.noise = createSimplexNoise2D(this.seed);
	}

	sampleHeight(worldX, worldZ) {
		const warpX = this.noise(worldX * 0.00016 + 19.3, worldZ * 0.00016 - 7.1) * 4;
		const warpZ = this.noise(worldX * 0.00016 - 11.7, worldZ * 0.00016 + 23.6) * 4;

		const sampleX = worldX + warpX;
		const sampleZ = worldZ + warpZ;

		const broad = this.noise(sampleX * 0.00018, sampleZ * 0.00018) * 0.5 + 0.5;
		const hills = this.noise(sampleX * 0.00072, sampleZ * 0.00072) * 0.5 + 0.5;
		const valleys = this.noise(sampleX * 0.00145 + 61.7, sampleZ * 0.00145 - 17.4) * 0.5 + 0.5;

		const broadRise = Math.pow(smoothstep(0.08, 0.84, broad), 1.15);
		const hillRise = Math.pow(smoothstep(0.18, 0.92, hills), 1.7);
		const valleyDrop = Math.pow(1 - smoothstep(0.22, 0.88, valleys), 2.25);

		let height = broadRise * 1.48 + hillRise * 0.72 - valleyDrop * 0.92;
		height = height * this.heightScale;
		height -= this.heightScale * 0.32;
		height += this.noise(sampleX * 0.0022, sampleZ * 0.0022) * this.heightScale * 0.004;
		height += 50;

		return height;
	}

	createTileMesh(tileX, tileZ, wireframe) {
		const geometry = new THREE.PlaneGeometry(this.tileSize, this.tileSize, this.segments, this.segments);
		geometry.rotateX(-Math.PI / 2);

		const position = geometry.attributes.position;
		const colors = [];
		const color = new THREE.Color();
		const worldOffsetX = tileX * this.tileSize;
		const worldOffsetZ = tileZ * this.tileSize;

		for (let index = 0; index < position.count; index += 1) {
			const localX = position.getX(index);
			const localZ = position.getZ(index);
			const worldX = worldOffsetX + localX;
			const worldZ = worldOffsetZ + localZ;
			const height = this.sampleHeight(worldX, worldZ);
			position.setY(index, height);

			if (height > this.heightScale * 0.42) {
				color.setHex(0xe8e4d7);
			} else if (height > this.heightScale * 0.18) {
				color.setHex(0xa8c46a);
			} else if (height > -this.heightScale * 0.02) {
				color.setHex(0x7ea04f);
			} else if (height > -this.heightScale * 0.18) {
				color.setHex(0x5f8638);
			} else {
				color.setHex(0x365a3f);
			}

			colors.push(color.r, color.g, color.b);
		}

		geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
		geometry.computeVertexNormals();

		const material = new THREE.MeshStandardMaterial({
			color: 0x7f8f73,
			roughness: 1,
			metalness: 0,
			vertexColors: true,
			wireframe: wireframe,
		});

		const mesh = new THREE.Mesh(geometry, material);
		mesh.position.x = tileX * this.tileSize;
		mesh.position.z = tileZ * this.tileSize;
		mesh.userData.tileX = tileX;
		mesh.userData.tileZ = tileZ;
		return mesh;
	}
}

function clamp01(value) {
	if (value < 0) {
		return 0;
	}

	if (value > 1) {
		return 1;
	}

	return value;
}

function smoothstep(edge0, edge1, value) {
	const t = clamp01((value - edge0) / (edge1 - edge0));
	return t * t * (3 - 2 * t);
}