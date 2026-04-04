import * as THREE from 'three';

const CLOUD_SHELL_RADIUS = 1060;
const CLOUD_DEFAULT_COVERAGE = 0.56;
const CLOUD_DEFAULT_DENSITY = 1.0;
const CLOUD_DEFAULT_OPACITY = 0.82;

export function createCloudRig() {
	const material = createCloudMaterial();
	const layer = new THREE.Mesh(
		new THREE.SphereGeometry(CLOUD_SHELL_RADIUS, 40, 24),
		material
	);
	layer.frustumCulled = false;

	return {
		material,
		layer,
		sunColor: new THREE.Color(),
		ambientColor: new THREE.Color(),
	};
}

export function updateCloudRig(cloud, cameraPosition, solarState, timeSeconds) {
	cloud.material.uniforms.uTime.value = timeSeconds;
	cloud.material.uniforms.uCameraPosition.value.copy(cameraPosition);
	cloud.material.uniforms.uCameraWorldY.value = cameraPosition.y;
	cloud.material.uniforms.uSunDirection.value.copy(solarState.sunDirection);
}

export function updateCloudAppearance(cloud, solarState, palette, horizonColor, settings) {
	if (!settings.cloudEnabled) {
		cloud.layer.visible = false;
		return;
	}

	cloud.layer.visible = true;

	cloud.sunColor.setHex(0x8f9db6).lerp(palette.sunLight, solarState.dayFactor);
	cloud.ambientColor.setHex(0x232b3a).lerp(palette.ambientDay, solarState.dayFactor).lerp(horizonColor, 0.25);

	cloud.material.uniforms.uCoverage.value = THREE.MathUtils.clamp(settings.cloudCoverage, 0.2, 0.95);
	cloud.material.uniforms.uDensity.value = THREE.MathUtils.clamp(settings.cloudDensity, 0.2, 1.5);
	cloud.material.uniforms.uOpacity.value = THREE.MathUtils.clamp(settings.cloudOpacity, 0.2, 1.0);
	cloud.material.uniforms.uSpeed.value = THREE.MathUtils.clamp(settings.cloudSpeed, 0, 3);
	cloud.material.uniforms.uBaseHeight.value = settings.cloudBaseHeight;
	cloud.material.uniforms.uTopHeight.value = Math.max(settings.cloudBaseHeight + 40, settings.cloudTopHeight);
	cloud.material.uniforms.uSunColor.value.copy(cloud.sunColor);
	cloud.material.uniforms.uAmbientColor.value.copy(cloud.ambientColor);
}

function createCloudMaterial() {
	return new THREE.ShaderMaterial({
		uniforms: {
			uTime: { value: 0 },
			uCameraPosition: { value: new THREE.Vector3() },
			uCameraWorldY: { value: 0 },
			uSunDirection: { value: new THREE.Vector3(0.2, 0.85, 0.1).normalize() },
			uSunColor: { value: new THREE.Color(0xffffff) },
			uAmbientColor: { value: new THREE.Color(0xcfd8e6) },
			uCoverage: { value: CLOUD_DEFAULT_COVERAGE },
			uDensity: { value: CLOUD_DEFAULT_DENSITY },
			uOpacity: { value: CLOUD_DEFAULT_OPACITY },
			uSpeed: { value: 1 },
			uBaseHeight: { value: 220 },
			uTopHeight: { value: 760 },
			uShellRadius: { value: CLOUD_SHELL_RADIUS },
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
			uniform float uTime;
			uniform vec3 uCameraPosition;
			uniform float uCameraWorldY;
			uniform vec3 uSunDirection;
			uniform vec3 uSunColor;
			uniform vec3 uAmbientColor;
			uniform float uCoverage;
			uniform float uDensity;
			uniform float uOpacity;
			uniform float uSpeed;
			uniform float uBaseHeight;
			uniform float uTopHeight;
			uniform float uShellRadius;

			varying vec3 vWorldPosition;

			float hash31(vec3 p) {
				p = fract(p * 0.1031);
				p += dot(p, p.yzx + 33.33);
				return fract((p.x + p.y) * p.z);
			}

			float noise3(vec3 p) {
				vec3 i = floor(p);
				vec3 f = fract(p);
				f = f * f * (3.0 - 2.0 * f);

				float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
				float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
				float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
				float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
				float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
				float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
				float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
				float n111 = hash31(i + vec3(1.0, 1.0, 1.0));

				float nx00 = mix(n000, n100, f.x);
				float nx10 = mix(n010, n110, f.x);
				float nx01 = mix(n001, n101, f.x);
				float nx11 = mix(n011, n111, f.x);
				float nxy0 = mix(nx00, nx10, f.y);
				float nxy1 = mix(nx01, nx11, f.y);
				return mix(nxy0, nxy1, f.z);
			}

			float fbm(vec3 p) {
				float value = 0.0;
				float amplitude = 0.5;
				for (int i = 0; i < 4; i += 1) {
					value += noise3(p) * amplitude;
					p = p * 2.02 + vec3(7.3, 4.1, 2.9);
					amplitude *= 0.5;
				}
				return value;
			}

			void main() {
				vec3 viewDir = normalize(vWorldPosition - uCameraPosition);
				float cloudAltitude = uCameraWorldY + viewDir.y * uShellRadius;
				float baseMask = smoothstep(uBaseHeight - 220.0, uBaseHeight + 220.0, cloudAltitude);
				float topMask = 1.0 - smoothstep(uTopHeight - 240.0, uTopHeight + 240.0, cloudAltitude);
				float heightMask = baseMask * topMask;
				if (heightMask <= 0.001) {
					discard;
				}

				vec3 p = viewDir * 2.8 + vec3(uTime * uSpeed * 0.015, 0.0, uTime * uSpeed * 0.01);
				float shape = fbm(p);
				float detail = fbm(p * 2.15 + vec3(0.0, uTime * uSpeed * 0.008, 0.0));
				float cloudNoise = mix(shape, detail, 0.35);
				float coverageThreshold = 1.0 - uCoverage;
				float density = smoothstep(coverageThreshold - 0.14, coverageThreshold + 0.18, cloudNoise);
				density *= uDensity * heightMask;
				density = clamp(density, 0.0, 1.0);
				if (density < 0.008) {
					discard;
				}

				float sunScatter = pow(max(dot(viewDir, normalize(uSunDirection)), 0.0), 8.0);
				vec3 cloudLight = uAmbientColor * (0.58 + density * 0.42);
				cloudLight += uSunColor * (0.24 + sunScatter * 0.95);
				vec3 cloudColor = cloudLight;
				float alpha = density * uOpacity * (0.78 + heightMask * 0.32);

				gl_FragColor = vec4(cloudColor, alpha);
			}
		`,
		side: THREE.BackSide,
		transparent: true,
		depthWrite: false,
		toneMapped: true,
	});
}