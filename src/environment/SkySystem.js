import * as THREE from 'three';

export class SkySystem {
	constructor(scene) {
		this.scene = scene;
		this.sky = null;
		this.sun = new THREE.Vector3();

		// Simple gradient sky using a large sphere
		const geo = new THREE.SphereGeometry(5000, 32, 32);
		const mat = new THREE.ShaderMaterial({
			uniforms: {
				topColor: { value: new THREE.Color(0x0077ff) },
				bottomColor: { value: new THREE.Color(0x87ceeb) },
				offset: { value: 33 },
				exponent: { value: 0.6 },
				time: { value: 0 },
				cloudScale: { value: 0.0005 },
				cloudIntensity: { value: 0.5 }
			},
			vertexShader: `
        varying vec3 vWorldPosition;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
      `,
			fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        uniform float time;
        uniform float cloudScale;
        uniform float cloudIntensity;
        varying vec3 vWorldPosition;
        varying vec2 vUv;

        // Simple noise for clouds
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          f = f*f*(3.0-2.0*f);
          return mix(mix(hash(i + vec2(0,0)), hash(i + vec2(1,0)), f.x),
                     mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
        }

        void main() {
          float h = normalize( vWorldPosition + offset ).y;
          vec3 skyColor = mix( bottomColor, topColor, max( pow( max( h, 0.0 ), exponent ), 0.0 ) );
          
          // Clouds
          float n = noise(vWorldPosition.xz * cloudScale + time * 0.01);
          n += noise(vWorldPosition.xz * cloudScale * 2.1 + time * 0.02) * 0.5;
          float cloud = smoothstep(0.4, 0.8, n) * cloudIntensity * max(h, 0.0);
          
          gl_FragColor = vec4( mix(skyColor, vec3(1.0), cloud), 1.0 );
        }
      `,
			side: THREE.BackSide
		});

		this.sky = new THREE.Mesh(geo, mat);
		this.scene.add(this.sky);
	}

	update(time, deltaTime) {
		this.sky.material.uniforms.time.value += deltaTime;
		// time is 0-24
		const angle = (time / 24) * Math.PI * 2 - Math.PI / 2;
		this.sun.set(
			Math.cos(angle),
			Math.sin(angle),
			0.5
		).normalize();

		const isNight = time < 6 || time > 18;
		const intensity = isNight ? 0.1 : Math.sin((time - 6) / 12 * Math.PI);

		// Update sky colors based on time
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

		return {
			sunDirection: this.sun,
			sunIntensity: intensity
		};
	}
}
