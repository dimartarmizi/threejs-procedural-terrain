import * as THREE from 'three';

export class SkySystem {
	constructor(scene, camera) {
		this.scene = scene;
		this.camera = camera || null;
		this.sky = null;
		this.sun = new THREE.Vector3();
		this.saturationMult = 1.0;
		this.brightnessMult = 1.0;

		const geo = new THREE.SphereGeometry(5000, 32, 32);

		const mat = new THREE.ShaderMaterial({
			uniforms: {
				topColor: { value: new THREE.Color(0x0077ff) },
				bottomColor: { value: new THREE.Color(0x87ceeb) },
				time: { value: 0 },
				cloudScale: { value: 0.0009 },
				cloudIntensity: { value: 1.0 },
				cloudCoverage: { value: 0.85 },
				cloudBase: { value: 100.0 },
				cloudThickness: { value: 140.0 },
				cameraPos: { value: new THREE.Vector3() },
				sunDirection: { value: new THREE.Vector3(0.0, 1.0, 0.0) }
			},
			vertexShader: `
				varying vec3 vWorldPosition;
				void main() {
					vec4 worldPosition = modelMatrix * vec4(position, 1.0);
					vWorldPosition = worldPosition.xyz;
					gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
				}
			`,
			fragmentShader: `
				precision highp float;
				varying vec3 vWorldPosition;
				uniform vec3 topColor;
				uniform vec3 bottomColor;
				uniform float time;
				uniform float cloudScale;
				uniform float cloudIntensity;
				uniform float cloudCoverage;
				uniform float cloudBase;
				uniform float cloudThickness;
				uniform vec3 cameraPos;
				uniform vec3 sunDirection;

				float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

				float noise(vec2 p) {
					vec2 i = floor(p);
					vec2 f = fract(p);
					f = f * f * (3.0 - 2.0 * f);
					float a = hash(i + vec2(0.0, 0.0));
					float b = hash(i + vec2(1.0, 0.0));
					float c = hash(i + vec2(0.0, 1.0));
					float d = hash(i + vec2(1.0, 1.0));
					return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
				}

				float fbm(vec2 p) {
					float v = 0.0;
					float a = 0.5;
					for (int i = 0; i < 5; i++) {
						v += a * noise(p);
						p *= 2.0;
						a *= 0.5;
					}
					return v;
				}

				vec3 skyColorForDir(vec3 dir, vec3 sunDir) {
					float h = max(dir.y, 0.0);
					float t = pow(h, 0.6);
					vec3 base = mix(bottomColor, topColor, t);
					
					float sunDot = max(dot(dir, normalize(sunDir)), 0.0);
					float sunGlow = pow(sunDot, 16.0);
					float sunDisk = pow(sunDot, 800.0);
					
					vec3 sunColor = vec3(1.0, 0.9, 0.7);
					if (sunDir.y < 0.2) {
						sunColor = mix(vec3(1.0, 0.3, 0.1), vec3(1.0, 0.9, 0.7), clamp(sunDir.y * 5.0, 0.0, 1.0));
					}
					
					return base + sunGlow * sunColor * 0.4 + sunDisk * sunColor;
				}

				void main() {
					vec3 viewDir = normalize(vWorldPosition - cameraPos);
					vec3 sky = skyColorForDir(viewDir, sunDirection);

					float tNear = 0.0;
					float tFar = 4000.0;
					vec3 ro = cameraPos;
					vec3 rd = viewDir;

					float base = cloudBase;
					float top = cloudBase + cloudThickness;

					float t1 = (base - ro.y) / rd.y;
					float t2 = (top - ro.y) / rd.y;
					float ta = min(t1, t2);
					float tb = max(t1, t2);

					tNear = max(ta, 0.0);
					tFar = tb;

					if (tFar <= 0.0 || tNear >= tFar) {
						gl_FragColor = vec4(sky, 1.0);
						return;
					}

					const int STEPS = 12;
					float step = (tFar - tNear) / float(STEPS);
					float t = tNear;

					vec3 accumColor = vec3(0.0);
					float accumAlpha = 0.0;

					vec3 sunDirNorm = normalize(sunDirection);

					float sunDot = dot(sunDirNorm, vec3(0.0, 1.0, 0.0));
					float sunVisibility = smoothstep(0.0, 0.12, sunDot);

					for (int i = 0; i < STEPS; i++) {
						vec3 pos = ro + rd * (t + step * 0.5);
						float heightNorm = (pos.y - base) / cloudThickness;
						heightNorm = clamp(heightNorm, 0.0, 1.0);
						float v = fbm(pos.xz * cloudScale + vec2(time * 0.01, time * 0.012));
						float density = smoothstep(0.2, 0.8, v) * cloudIntensity * cloudCoverage * (1.0 - abs(heightNorm - 0.5) * 2.0);
						density = clamp(density, 0.0, 1.0);
						density *= sunVisibility;

						float light = clamp(dot(sunDirNorm, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5, 0.0, 1.0);
						vec3 sampleColor = vec3(1.0) * light;
						
						if (sunDirNorm.y < 0.3) {
							vec3 sunsetCloud = vec3(1.0, 0.6, 0.3);
							sampleColor = mix(sunsetCloud, sampleColor, clamp(sunDirNorm.y * 3.3, 0.0, 1.0));
						}

						float alpha = density * 0.24;
						alpha = clamp(alpha, 0.0, 1.0);
						accumColor += (1.0 - accumAlpha) * sampleColor * alpha;
						accumAlpha += (1.0 - accumAlpha) * alpha;

						if (accumAlpha > 0.99) break;

						t += step;
					}

					vec3 final = mix(sky, accumColor + sky * 0.1, accumAlpha);
					gl_FragColor = vec4(final, 1.0);
				}
			`,
			side: THREE.BackSide,
			transparent: false
		});

		this.sky = new THREE.Mesh(geo, mat);
		this.scene.add(this.sky);

		const starCount = 1500;
		const starPositions = new Float32Array(starCount * 3);
		for (let i = 0; i < starCount; i++) {
			const u = Math.random();
			const v = Math.random();
			const theta = 2.0 * Math.PI * u;
			const phi = Math.acos(2.0 * v - 1.0);
			const x = Math.sin(phi) * Math.cos(theta);
			const y = Math.cos(phi);
			const z = Math.sin(phi) * Math.sin(theta);
			const r = 4900 + (Math.random() * 50 - 25);
			starPositions[i * 3 + 0] = x * r;
			starPositions[i * 3 + 1] = y * r;
			starPositions[i * 3 + 2] = z * r;
		}

		const starsGeo = new THREE.BufferGeometry();
		starsGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
		const starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: true, transparent: true, opacity: 0 });
		this.stars = new THREE.Points(starsGeo, starsMat);
		this.stars.frustumCulled = false;
		this.scene.add(this.stars);

		const moonGeo = new THREE.SphereGeometry(60, 32, 32);

		function makeGlowTexture(size) {
			const cvs = document.createElement('canvas');
			cvs.width = cvs.height = size;
			const ctx = cvs.getContext('2d');
			const cx = size / 2;
			const cy = size / 2;
			const r = size / 2;
			const grad = ctx.createRadialGradient(cx, cy, r * 0.05, cx, cy, r);
			grad.addColorStop(0.0, 'rgba(255,246,224,1.0)');
			grad.addColorStop(0.4, 'rgba(255,246,224,0.9)');
			grad.addColorStop(0.7, 'rgba(255,246,224,0.25)');
			grad.addColorStop(1.0, 'rgba(255,246,224,0.0)');
			ctx.clearRect(0, 0, size, size);
			ctx.fillStyle = grad;
			ctx.fillRect(0, 0, size, size);
			const tex = new THREE.CanvasTexture(cvs);
			tex.minFilter = THREE.LinearFilter;
			tex.needsUpdate = true;
			return tex;
		}

		const glowTex = makeGlowTexture(512);
		const moonMat = new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
		this.moon = new THREE.Mesh(moonGeo, moonMat);
		this.moon.frustumCulled = false;
		this.moon.visible = false;
		this.scene.add(this.moon);

		const spriteMat = new THREE.SpriteMaterial({
			map: glowTex,
			color: 0xffffff,
			opacity: 0,
			transparent: true,
			blending: THREE.AdditiveBlending,
			depthWrite: false
		});
		this.moonGlow = new THREE.Sprite(spriteMat);
		this.moonGlow.scale.set(600, 600, 1);
		this.moonGlow.frustumCulled = false;
		this.scene.add(this.moonGlow);
	}

	update(time, deltaTime) {
		this.sky.material.uniforms.time.value += deltaTime;
		if (this.camera && this.sky.material.uniforms.cameraPos) {
			this.sky.material.uniforms.cameraPos.value.copy(this.camera.position);
		}

		const angle = ((time - 12) / 12) * Math.PI;
		this.sun.set(-Math.sin(angle), Math.cos(angle), 0.0).normalize();

		const sunY = this.sun.y;
		const top = this.sky.material.uniforms.topColor.value;
		const bot = this.sky.material.uniforms.bottomColor.value;

		if (sunY > 0.5) {
			top.setHSL(0.6, 0.7 * this.saturationMult, 0.4 * this.brightnessMult);
			bot.setHSL(0.55, 0.6 * this.saturationMult, 0.6 * this.brightnessMult);
		} else if (sunY > 0.0) {
			const t = sunY / 0.5;
			const targetTop = new THREE.Color().setHSL(0.6, 0.7 * this.saturationMult, 0.4 * this.brightnessMult);
			const targetBot = new THREE.Color().setHSL(0.55, 0.6 * this.saturationMult, 0.6 * this.brightnessMult);
			const dawnTop = new THREE.Color().setHSL(0.65, 0.5 * this.saturationMult, 0.2 * this.brightnessMult);
			const dawnBot = new THREE.Color().setHSL(0.05, 0.8 * this.saturationMult, 0.5 * this.brightnessMult);
			top.lerpColors(dawnTop, targetTop, t);
			bot.lerpColors(dawnBot, targetBot, t);
		} else if (sunY > -0.2) {
			const t = (sunY + 0.2) / 0.2;
			const nightTop = new THREE.Color(0x020205).multiplyScalar(this.brightnessMult);
			const nightBot = new THREE.Color(0x050510).multiplyScalar(this.brightnessMult);
			const dawnTop = new THREE.Color().setHSL(0.65, 0.5 * this.saturationMult, 0.2 * this.brightnessMult);
			const dawnBot = new THREE.Color().setHSL(0.05, 0.8 * this.saturationMult, 0.5 * this.brightnessMult);
			top.lerpColors(nightTop, dawnTop, t);
			bot.lerpColors(nightBot, dawnBot, t);
		} else {
			top.set(0x020205).multiplyScalar(this.brightnessMult);
			bot.set(0x050510).multiplyScalar(this.brightnessMult);
		}

		this.scene.fog.color.copy(bot);

		if (this.sky.material.uniforms.sunDirection) this.sky.material.uniforms.sunDirection.value.copy(this.sun);

		const nightFactor = clamp01(( -sunY - 0.1 ) / 0.9);
		if (this.stars && this.stars.material) {
			this.stars.material.opacity = THREE.MathUtils.lerp(this.stars.material.opacity, 0.95 * nightFactor, 0.1);
		}

		if (this.moon && this.moonGlow) {
			const moonDir = this.sun.clone().multiplyScalar(-1).normalize();
			const moonDist = 4500;
			this.moon.position.set(moonDir.x * moonDist, moonDir.y * moonDist, moonDir.z * moonDist);
			this.moonGlow.position.copy(this.moon.position);
			this.moon.visible = nightFactor > 0.02;
			this.moon.material.opacity = THREE.MathUtils.clamp(nightFactor, 0, 1);
			this.moonGlow.material.opacity = THREE.MathUtils.lerp(this.moonGlow.material.opacity, 0.6 * nightFactor, 0.12);
			this.moon.rotation.y += 0.001 * deltaTime;
		}

		return {
			sunDirection: this.sun,
			sunIntensity: Math.max(0, sunY)
		};
	}
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }
