import * as THREE from 'three';
import { SeededRandom } from '../utils/SeededRandom.js';
import { BiomeRegistry } from '../biomes/BiomeRegistry.js';
import { BiomeMap } from '../terrain/BiomeMap.js';

export class VegetationSystem {
	constructor(scene, heightGenerator, seed, settings = { treeDensity: 50 }) {
		this.scene = scene;
		this.heightGenerator = heightGenerator;
		this.biomeMap = new BiomeMap(seed);
		this.seed = seed;
		this.settings = settings;

		// Materials
		this.mats = {
			trunk: new THREE.MeshStandardMaterial({ color: 0x4d342c, flatShading: true }),
			leaves: new THREE.MeshStandardMaterial({ color: 0x2e7d32, flatShading: true }),
			pine: new THREE.MeshStandardMaterial({ color: 0x1b4332, flatShading: true }),
			palm: new THREE.MeshStandardMaterial({ color: 0x38b000, flatShading: true }),
			cactus: new THREE.MeshStandardMaterial({ color: 0x2d6a4f, flatShading: true }),
			shrub: new THREE.MeshStandardMaterial({ color: 0x40916c, flatShading: true })
		};

		// Geometries
		this.geos = {
			trunk: new THREE.CylinderGeometry(0.15, 0.2, 2, 6).toNonIndexed(),
			oak: new THREE.IcosahedronGeometry(1.5, 0).toNonIndexed(),
			pine: this.createPineFoliage(),
			palm: this.createPalmFoliage(),
			poplar: new THREE.CylinderGeometry(0.5, 1.2, 4, 6).toNonIndexed(),
			cactus: this.createCactusGeo(),
			shrub: new THREE.IcosahedronGeometry(0.8, 0).toNonIndexed(),
			palmTrunk: new THREE.CylinderGeometry(0.1, 0.25, 3.5, 6).toNonIndexed()
		};

		// Fix offsets
		this.geos.trunk.translate(0, 1, 0);
		this.geos.oak.translate(0, 2.5, 0);
		this.geos.poplar.translate(0, 3, 0);
		this.geos.shrub.translate(0, 0.4, 0);
		this.geos.palmTrunk.translate(0, 1.75, 0);

		this.chunkVegetation = new Map();
	}

	createPineFoliage() {
		const g1 = new THREE.ConeGeometry(1.5, 2.5, 6).toNonIndexed();
		g1.translate(0, 2, 0);
		const g2 = new THREE.ConeGeometry(1.1, 2, 6).toNonIndexed();
		g2.translate(0, 3.5, 0);
		const g3 = new THREE.ConeGeometry(0.7, 1.5, 6).toNonIndexed();
		g3.translate(0, 4.8, 0);
		return this.mergeGeometries([g1, g2, g3]);
	}

	createPalmFoliage() {
		const leaves = [];
		const numLeaves = 8;
		for (let i = 0; i < numLeaves; i++) {
			// Create a leaf from 3 segments to mimic a curve
			const leafGroup = [];

			// Segment 1 (Inner)
			const s1 = new THREE.BoxGeometry(1, 0.1, 0.4).toNonIndexed();
			s1.translate(0.5, 0, 0);
			s1.rotateZ(0.2);
			leafGroup.push(s1);

			// Segment 2 (Middle)
			const s2 = new THREE.BoxGeometry(1, 0.1, 0.35).toNonIndexed();
			s2.translate(0.5, 0, 0);
			s2.rotateZ(-0.3);
			s2.translate(1, 0.2, 0);
			leafGroup.push(s2);

			// Segment 3 (Outer)
			const s3 = new THREE.BoxGeometry(1, 0.1, 0.25).toNonIndexed();
			s3.translate(0.5, 0, 0);
			s3.rotateZ(-0.6);
			s3.translate(1.9, -0.1, 0);
			leafGroup.push(s3);

			const leaf = this.mergeGeometries(leafGroup);
			leaf.rotateY((i / numLeaves) * Math.PI * 2);
			leaf.translate(0, 3.5, 0);
			leaves.push(leaf);
		}
		return this.mergeGeometries(leaves);
	}

	createCactusGeo() {
		const g1 = new THREE.CylinderGeometry(0.4, 0.4, 3, 6).toNonIndexed();
		g1.translate(0, 1.5, 0);
		const g2 = new THREE.CylinderGeometry(0.3, 0.3, 1, 6).toNonIndexed();
		g2.rotateZ(Math.PI / 2);
		g2.translate(0.5, 2, 0);
		const g3 = new THREE.CylinderGeometry(0.3, 0.3, 1, 6).toNonIndexed();
		g3.rotateZ(-Math.PI / 2);
		g3.translate(-0.5, 1.2, 0);
		return this.mergeGeometries([g1, g2, g3]);
	}

	mergeGeometries(geometries) {
		const totalPos = geometries.reduce((sum, g) => sum + g.attributes.position.count, 0);
		const positions = new Float32Array(totalPos * 3);
		const normals = new Float32Array(totalPos * 3);

		let offset = 0;
		geometries.forEach(g => {
			positions.set(g.attributes.position.array, offset * 3);
			if (g.attributes.normal) normals.set(g.attributes.normal.array, offset * 3);
			offset += g.attributes.position.count;
		});

		const merged = new THREE.BufferGeometry();
		merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
		return merged;
	}

	spawnForChunk(chunkKey, cx, cz, chunkSize) {
		// Avoid duplicate spawning for the same coordinate
		if (this.chunkVegetation.has(chunkKey)) return;

		const rng = new SeededRandom(this.seed + '_' + chunkKey);
		const count = this.settings.treeDensity || 50;

		const speciesInChunk = new Map(); // speciesName -> { trunks, leaves, count }

		const matrix = new THREE.Matrix4();
		const position = new THREE.Vector3();
		const rotation = new THREE.Euler();
		const scale = new THREE.Vector3();

		for (let i = 0; i < count; i++) {
			const rx = (rng.next() - 0.5) * chunkSize + cx * chunkSize;
			const rz = (rng.next() - 0.5) * chunkSize + cz * chunkSize;

			const { h, temp, moisture } = this.heightGenerator.getData(rx, rz);
			const biome = BiomeRegistry.getBiome(h, moisture, temp);

			// Decide species based on biome
			let speciesName = null;
			let isShrub = false;

			if (rng.next() < 0.2 && (biome.id === 'forest' || biome.id === 'plains')) {
				speciesName = 'shrub';
				isShrub = true;
			} else if (biome.id === 'forest' || biome.id === 'plains') {
				const r = rng.next();
				if (r < 0.6) speciesName = 'oak';
				else if (r < 0.9) speciesName = 'poplar';
				else speciesName = 'pine';
			} else if (biome.id === 'beach') {
				speciesName = 'palm';
			} else if (biome.id === 'mountain' || biome.id === 'snow') {
				speciesName = 'pine';
			} else if (biome.id === 'desert') {
				if (rng.next() < 0.1) speciesName = 'cactus';
			}

			if (speciesName && h > 6) {
				const isCactus = speciesName === 'cactus';
				const isPalm = speciesName === 'palm';
				if (!speciesInChunk.has(speciesName)) {
					const sTrunk = new THREE.InstancedMesh(
						isPalm ? this.geos.palmTrunk : this.geos.trunk,
						this.mats.trunk,
						count
					);
					const sLeaves = new THREE.InstancedMesh(
						this.geos[speciesName],
						this.mats[speciesName] || this.mats.leaves,
						count
					);
					sTrunk.castShadow = sTrunk.receiveShadow = sLeaves.castShadow = sLeaves.receiveShadow = true;
					speciesInChunk.set(speciesName, { trunks: sTrunk, leaves: sLeaves, count: 0 });
				}

				const data = speciesInChunk.get(speciesName);
				const s = isShrub ? rng.range(0.5, 1.2) : rng.range(1.0, 2.0);
				position.set(rx, h, rz);
				rotation.set(0, rng.next() * Math.PI, 0);
				scale.set(s, s, s);

				matrix.compose(position, new THREE.Quaternion().setFromEuler(rotation), scale);

				if (!isShrub && !isCactus) {
					data.trunks.setMatrixAt(data.count, matrix);
				}
				data.leaves.setMatrixAt(data.count, matrix);
				data.count++;
			}
		}

		const allMeshes = [];
		speciesInChunk.forEach((data, name) => {
			data.trunks.count = data.count;
			data.leaves.count = data.count;
			data.trunks.instanceMatrix.needsUpdate = true;
			data.leaves.instanceMatrix.needsUpdate = true;

			if (name !== 'shrub' && name !== 'cactus') {
				this.scene.add(data.trunks);
				allMeshes.push(data.trunks);
			}
			this.scene.add(data.leaves);
			allMeshes.push(data.leaves);
		});

		this.chunkVegetation.set(chunkKey, allMeshes);
	}

	removeForChunk(chunkKey) {
		if (this.chunkVegetation.has(chunkKey)) {
			const meshes = this.chunkVegetation.get(chunkKey);
			meshes.forEach(m => {
				this.scene.remove(m);
				// We don't dispose global geoms/mats here, 
				// but the InstancedMesh itself should be removed.
			});
			this.chunkVegetation.delete(chunkKey);
		}
	}

	clearAll() {
		for (const key of this.chunkVegetation.keys()) {
			this.removeForChunk(key);
		}
		this.chunkVegetation.clear();
	}
}
