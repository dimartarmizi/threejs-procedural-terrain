import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';

export class WaterSystem {
	constructor(scene, initialHeight = 6) {
		this.scene = scene;
		this.water = null;
		this.baseHeight = initialHeight;
		this.dayWaterColor = new THREE.Color(0x0064b5);
		this.nightWaterColor = new THREE.Color(0x03111f);
		this.daySunColor = new THREE.Color(0xeaf4ff);
		this.nightSunColor = new THREE.Color(0x0a1020);

		const waterGeometry = new THREE.PlaneGeometry(10000, 10000);

		this.water = new Water(
			waterGeometry,
			{
				textureWidth: 512,
				textureHeight: 512,
				waterNormals: new THREE.TextureLoader().load('/textures/waternormals.jpg', function ( texture ) {
					texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
				}),
				sunDirection: new THREE.Vector3(),
				sunColor: 0xffffff,
				distortionScale: 3.7,
				fog: scene.fog !== undefined
			}
		);

		this.water.rotation.x = -Math.PI / 2;
		this.water.position.y = this.baseHeight;

		this.scene.add(this.water);
		this.time = 0;
	}

	setHeight(h) {
		this.baseHeight = h;
		if (this.water) this.water.position.y = this.baseHeight;
	}

	update(deltaTime, playerPosition, env) {
		this.time += deltaTime;
		this.water.position.x = playerPosition.x;
		this.water.position.z = playerPosition.z;

		this.water.material.uniforms[ 'time' ].value += deltaTime;

		const dayFactor = env && typeof env.sunIntensity === 'number' ? THREE.MathUtils.clamp(env.sunIntensity, 0, 1) : 1;
		const nightFactor = 1 - dayFactor;
		const waterColor = this.water.material.uniforms[ 'waterColor' ].value;
		const sunColor = this.water.material.uniforms[ 'sunColor' ].value;

		waterColor.copy(this.dayWaterColor).lerp(this.nightWaterColor, nightFactor);
		sunColor.copy(this.daySunColor).lerp(this.nightSunColor, nightFactor);
		this.water.material.uniforms[ 'distortionScale' ].value = THREE.MathUtils.lerp(3.7, 1.8, nightFactor);

		if (env && env.sunDirection) {
			this.water.material.uniforms[ 'sunDirection' ].value.copy(env.sunDirection);
		}
	}
}
