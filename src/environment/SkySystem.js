import * as THREE from 'three';

export class SkySystem {
	constructor(scene, camera) {
		this.scene = scene;
		this.camera = camera || null;
		this.sky = null;
		this.sun = new THREE.Vector3();

		const geo = new THREE.SphereGeometry(5000, 32, 32);

		const mat = new THREE.ShaderMaterial({
			uniforms: {
				topColor: { value: new THREE.Color(0x0077ff) },
				bottomColor: { value: new THREE.Color(0x87ceeb) },
				time: { value: 0 },
				cloudScale: { value: 0.0006 },
				cloudIntensity: { value: 0.5 },
				cloudCoverage: { value: 0.6 },
				cloudBase: { value: 120.0 },
				cloudThickness: { value: 80.0 },
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

				vec3 skyColorForDir(vec3 dir) {
					float h = max(dir.y, 0.0);
					float t = pow(h, 0.6);
					return mix(bottomColor, topColor, t);
				}

				void main() {
					vec3 viewDir = normalize(vWorldPosition - cameraPos);
					vec3 sky = skyColorForDir(viewDir);

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

					const int STEPS = 8;
					float step = (tFar - tNear) / float(STEPS);
					float t = tNear;

					vec3 accumColor = vec3(0.0);
					float accumAlpha = 0.0;

					vec3 sunDir = normalize(sunDirection);

					for (int i = 0; i < STEPS; i++) {
						vec3 pos = ro + rd * (t + step * 0.5);
						float heightNorm = (pos.y - base) / cloudThickness;
						heightNorm = clamp(heightNorm, 0.0, 1.0);
						float v = fbm(pos.xz * cloudScale + vec2(time * 0.01, time * 0.012));
						float density = smoothstep(0.2, 0.8, v) * cloudIntensity * cloudCoverage * (1.0 - abs(heightNorm - 0.5) * 2.0);
						density = clamp(density, 0.0, 1.0);

						float light = clamp(dot(normalize(sunDir), -rd), 0.0, 1.0);
						float phase = 0.5 + 0.5 * light;
						vec3 sampleColor = vec3(1.0) * phase;

						float alpha = density * 0.12;
						alpha = clamp(alpha, 0.0, 1.0);
						accumColor += (1.0 - accumAlpha) * sampleColor * alpha;
						accumAlpha += (1.0 - accumAlpha) * alpha;

						if (accumAlpha > 0.99) break;

						t += step;
					}

					vec3 final = mix(sky, accumColor + sky * 0.2, accumAlpha);
					gl_FragColor = vec4(final, 1.0);
				}
			`,
			side: THREE.BackSide,
			transparent: false
		});

		this.sky = new THREE.Mesh(geo, mat);
		this.scene.add(this.sky);
	}

	update(time, deltaTime) {
		this.sky.material.uniforms.time.value += deltaTime;
		if (this.camera && this.sky.material.uniforms.cameraPos) {
			this.sky.material.uniforms.cameraPos.value.copy(this.camera.position);
		}

		const angle = (time / 24) * Math.PI * 2 - Math.PI / 2;
		this.sun.set(Math.cos(angle), Math.sin(angle), 0.5).normalize();
		const isNight = time < 6 || time > 18;
		const intensity = isNight ? 0.1 : Math.sin((time - 6) / 12 * Math.PI);

		const top = this.sky.material.uniforms.topColor.value;
		const bot = this.sky.material.uniforms.bottomColor.value;

		if (isNight) {
			top.setHSL(0.6, 1, 0.05);
			bot.setHSL(0.6, 1, 0.1);
			this.scene.fog.color.copy(bot);
		} else {
			top.setHSL(0.6, 0.8, 0.5 * intensity + 0.1);
			bot.setHSL(0.5, 0.5, 0.7 * intensity + 0.2);
			this.scene.fog.color.copy(bot);
		}

		if (this.sky.material.uniforms.sunDirection) this.sky.material.uniforms.sunDirection.value.copy(this.sun);

		return {
			sunDirection: this.sun,
			sunIntensity: intensity
		};
	}
}
