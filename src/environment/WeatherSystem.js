import * as THREE from 'three';

export class WeatherSystem {
	constructor(scene, camera, skySystem) {
		this.scene = scene;
		this.camera = camera;
		this.skySystem = skySystem;
		this.currentWeather = 'clear';

		this.particles = null;
		this.particleMaterial = null;
		this.particleGeometry = null;
		this.particleCount = 20000;

		this.setupParticles();

		this.weatherSettings = {
			clear: {
				fogDensity: 0.0002,
				cloudIntensity: 0.3,
				cloudCoverage: 0.4,
				sunIntensity: 1.0,
				particleType: 'none',
				saturation: 1.0,
				brightness: 1.0
			},
			cloudy: {
				fogDensity: 0.0005,
				cloudIntensity: 0.8,
				cloudCoverage: 0.8,
				sunIntensity: 0.6,
				particleType: 'none',
				saturation: 0.6,
				brightness: 0.8
			},
			rain: {
				fogDensity: 0.001,
				cloudIntensity: 1.0,
				cloudCoverage: 0.9,
				sunIntensity: 0.4,
				particleType: 'rain',
				saturation: 0.4,
				brightness: 0.6
			},
			storm: {
				fogDensity: 0.002,
				cloudIntensity: 1.5,
				cloudCoverage: 1.0,
				sunIntensity: 0.2,
				particleType: 'rain',
				lightning: true,
				saturation: 0.2,
				brightness: 0.4
			},
			snow: {
				fogDensity: 0.0015,
				cloudIntensity: 0.9,
				cloudCoverage: 0.8,
				sunIntensity: 0.6,
				particleType: 'snow',
				saturation: 0.5,
				brightness: 0.9
			},
			foggy: {
				fogDensity: 0.005,
				cloudIntensity: 0.4,
				cloudCoverage: 0.5,
				sunIntensity: 0.5,
				particleType: 'none',
				saturation: 0.7,
				brightness: 0.7
			}
		};

		this.lightningTimer = 0;
		this.isLightning = false;
	}

	setupParticles() {
		this.particleGeometry = new THREE.BufferGeometry();
		const positions = new Float32Array(this.particleCount * 3);

		const horizontalRange = 800;
		const verticalRange = 200;

		for (let i = 0; i < this.particleCount; i++) {
			positions[i * 3] = (Math.random() - 0.5) * horizontalRange;
			positions[i * 3 + 1] = (Math.random() - 0.5) * verticalRange;
			positions[i * 3 + 2] = (Math.random() - 0.5) * horizontalRange;
		}

		this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

		this.particleMaterial = new THREE.PointsMaterial({
			color: 0xffffff,
			size: 0.1,
			transparent: true,
			opacity: 0.6,
			blending: THREE.AdditiveBlending,
			depthWrite: false
		});

		this.particles = new THREE.Points(this.particleGeometry, this.particleMaterial);
		this.particles.frustumCulled = false;
		this.particles.visible = false;
		this.scene.add(this.particles);
	}

	setWeather(type) {
		if (!this.weatherSettings[type]) return;
		this.currentWeather = type;
		const config = this.weatherSettings[type];

		this.scene.fog.density = config.fogDensity;

		if (this.skySystem) {
			if (this.skySystem.sky) {
				this.skySystem.sky.material.uniforms.cloudIntensity.value = config.cloudIntensity;
				this.skySystem.sky.material.uniforms.cloudCoverage.value = config.cloudCoverage;
			}
			this.skySystem.saturationMult = config.saturation;
			this.skySystem.brightnessMult = config.brightness;
		}

		if (config.particleType === 'none') {
			this.particles.visible = false;
		} else {
			this.particles.visible = true;
			if (config.particleType === 'rain') {
				this.particleMaterial.color.set(0x8888aa);
				this.particleMaterial.size = 0.1;
			} else if (config.particleType === 'snow') {
				this.particleMaterial.color.set(0xeeeeee);
				this.particleMaterial.size = 0.2;
			}
		}

		if (type !== 'storm' && this.skySystem && this.skySystem.sky) {
			this.skySystem.sky.material.uniforms.topColor.value.setHSL(0.6, 0.8, 0.5);
		}
	}

	update(deltaTime, playerPos) {
		const config = this.weatherSettings[this.currentWeather];

		if (this.particles.visible) {
			const positions = this.particleGeometry.attributes.position.array;
			const camPos = this.camera.position;


			const horizontalRange = 800;
			const halfHorizontal = horizontalRange / 2;
			const verticalRange = 200;
			const halfVertical = verticalRange / 2;

			for (let i = 0; i < this.particleCount; i++) {
				const idx = i * 3;

				if (config.particleType === 'rain') {
					positions[idx + 1] -= deltaTime * 80;
				} else if (config.particleType === 'snow') {
					positions[idx + 1] -= deltaTime * 8;
					positions[idx] += Math.sin(Date.now() * 0.001 + i) * 0.1;
				}


				let diffX = (positions[idx] + this.particles.position.x) - camPos.x;
				if (diffX > halfHorizontal) positions[idx] -= horizontalRange;
				else if (diffX < -halfHorizontal) positions[idx] += horizontalRange;

				let diffY = (positions[idx + 1] + this.particles.position.y) - camPos.y;
				if (diffY > halfVertical) positions[idx + 1] -= verticalRange;
				else if (diffY < -halfVertical) positions[idx + 1] += verticalRange;

				let diffZ = (positions[idx + 2] + this.particles.position.z) - camPos.z;
				if (diffZ > halfHorizontal) positions[idx + 2] -= horizontalRange;
				else if (diffZ < -halfHorizontal) positions[idx + 2] += horizontalRange;
			}
			this.particleGeometry.attributes.position.needsUpdate = true;
		}

		if (this.currentWeather === 'storm') {
			this.lightningTimer -= deltaTime;
			if (this.lightningTimer <= 0) {
				if (this.isLightning) {
					this.isLightning = false;
					this.lightningTimer = Math.random() * 8 + 3;
					if (this.skySystem) {
						this.skySystem.brightnessMult = config.brightness;
					}
				} else {
					this.isLightning = true;
					this.lightningTimer = 0.05 + Math.random() * 0.15;
					if (this.skySystem) {
						this.skySystem.brightnessMult = 10.0;
					}
				}
			}
		} else if (this.isLightning) {
			this.isLightning = false;
			if (this.skySystem) {
				this.skySystem.brightnessMult = config.brightness;
			}
		}
	}

	getSunIntensityModifier() {
		return this.weatherSettings[this.currentWeather].sunIntensity;
	}
}
