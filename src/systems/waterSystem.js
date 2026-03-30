import * as THREE from 'three';

export class WaterSystem {
	constructor(scene, initialHeight = 6) {
		this.scene = scene;
		this.water = null;
		this.baseHeight = initialHeight;

		const geo = new THREE.PlaneGeometry(10000, 10000, 10, 10);
		const mat = new THREE.MeshStandardMaterial({
			color: 0x1a5fb4,
			transparent: true,
			opacity: 0.75,
			roughness: 0.05,
			metalness: 0.6,
			envMapIntensity: 1.0,
			flatShading: false,
			blending: THREE.NormalBlending,
			depthWrite: false,
			alphaTest: 0.0001
		});

		this.water = new THREE.Mesh(geo, mat);
		this.water.rotation.x = -Math.PI / 2;
		this.water.position.y = this.baseHeight;

		this.water.renderOrder = 1;
		this.water.frustumCulled = false;

		this.scene.add(this.water);
		this.time = 0;
	}

	setHeight(h) {
		this.baseHeight = h;
		if (this.water) this.water.position.y = this.baseHeight;
	}

	update(deltaTime, playerPosition) {
		this.time += deltaTime;
		this.water.position.x = playerPosition.x;
		this.water.position.z = playerPosition.z;

		this.water.position.y = this.baseHeight + Math.sin(this.time * 0.5) * 0.1;
	}
}
