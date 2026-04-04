import * as THREE from 'three';

const WATER_LEVEL = 0;
const WATER_COLOR_DEEP = new THREE.Color(0x125a78);
const WATER_COLOR_SHALLOW = new THREE.Color(0x5eb7dd);
const DEFAULT_SUN_COLOR = new THREE.Color(0xffffff);
const DEFAULT_AMBIENT_COLOR = new THREE.Color(0x7c8b9b);
const DEFAULT_SUN_DIRECTION = new THREE.Vector3(0.4, 0.8, 0.2).normalize();

export function createWaterSurface(tileSize) {
	const loader = new THREE.TextureLoader();
	const normalTexture = loader.load('/textures/waternormals.jpg');
	normalTexture.wrapS = THREE.RepeatWrapping;
	normalTexture.wrapT = THREE.RepeatWrapping;
	normalTexture.colorSpace = THREE.NoColorSpace;

	const material = new THREE.ShaderMaterial({
		uniforms: {
			uTime: { value: 0 },
			uCameraPosition: { value: new THREE.Vector3() },
			uNormalMap: { value: normalTexture },
			uColorDeep: { value: WATER_COLOR_DEEP.clone() },
			uColorShallow: { value: WATER_COLOR_SHALLOW.clone() },
			uSunDirection: { value: DEFAULT_SUN_DIRECTION.clone() },
			uSunColor: { value: DEFAULT_SUN_COLOR.clone() },
			uAmbientColor: { value: DEFAULT_AMBIENT_COLOR.clone() },
			uSunIntensity: { value: 1 },
			uAmbientIntensity: { value: 0.5 },
			uFogTopColor: { value: new THREE.Color(0x87b7ff) },
			uFogUpperColor: { value: new THREE.Color(0xbfdfff) },
			uFogHorizonColor: { value: new THREE.Color(0xc6e6ff) },
			uFogBottomColor: { value: new THREE.Color(0xa6ccf0) },
			uFogNear: { value: 150 },
			uFogFar: { value: 900 },
			uFogHeightMin: { value: -40 },
			uFogHeightMax: { value: 240 },
			uFogDensity: { value: 0 },
			uEnabled: { value: 1 },
		},
		vertexShader: `
			varying vec2 vUv;
			varying vec3 vWorldPosition;

			void main() {
				vUv = uv;
				vec4 worldPosition = modelMatrix * vec4(position, 1.0);
				vWorldPosition = worldPosition.xyz;
				gl_Position = projectionMatrix * viewMatrix * worldPosition;
			}
		`,
		fragmentShader: `
			uniform float uTime;
			uniform vec3 uCameraPosition;
			uniform sampler2D uNormalMap;
			uniform vec3 uColorDeep;
			uniform vec3 uColorShallow;
			uniform vec3 uSunDirection;
			uniform vec3 uSunColor;
			uniform vec3 uAmbientColor;
			uniform float uSunIntensity;
			uniform float uAmbientIntensity;
			uniform vec3 uFogTopColor;
			uniform vec3 uFogUpperColor;
			uniform vec3 uFogHorizonColor;
			uniform vec3 uFogBottomColor;
			uniform float uFogNear;
			uniform float uFogFar;
			uniform float uFogHeightMin;
			uniform float uFogHeightMax;
			uniform float uFogDensity;
			uniform float uEnabled;

			varying vec2 vUv;
			varying vec3 vWorldPosition;

			vec3 sampleSkyGradientColor(float t) {
				float horizonBlend = smoothstep(0.0, 0.42, t);
				float upperBlend = smoothstep(0.22, 0.78, t);
				float topBlend = smoothstep(0.56, 1.0, t);
				vec3 color = mix(uFogBottomColor, uFogHorizonColor, horizonBlend);
				color = mix(color, uFogUpperColor, upperBlend);
				color = mix(color, uFogTopColor, topBlend);
				return color;
			}

			void main() {
				if (uEnabled < 0.5) {
					discard;
				}

				vec2 worldUv = vWorldPosition.xz * 0.012;
				vec2 uvA = worldUv * 3.0 + vec2(uTime * 0.11, uTime * 0.07);
				vec2 uvB = worldUv * 4.8 + vec2(-uTime * 0.09, uTime * 0.13);
				vec3 nA = texture2D(uNormalMap, uvA).xyz * 2.0 - 1.0;
				vec3 nB = texture2D(uNormalMap, uvB).xyz * 2.0 - 1.0;
				vec3 normal = normalize(vec3((nA.x + nB.x) * 0.9, 1.25, (nA.y + nB.y) * 0.9));

				vec3 viewDir = normalize(uCameraPosition - vWorldPosition);
				vec3 sunDir = normalize(uSunDirection);
				float nDotL = max(dot(normal, sunDir), 0.0);
				float specular = pow(max(dot(normal, normalize(sunDir + viewDir)), 0.0), 80.0);
				float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 2.4);
				vec3 baseColor = mix(uColorDeep, uColorShallow, fresnel * 0.95 + nDotL * 0.05);
				vec3 ambient = uAmbientColor * uAmbientIntensity * 0.48;
				vec3 diffuse = uSunColor * (uSunIntensity * (0.18 + nDotL * 0.62));
				vec3 highlight = uSunColor * specular * (0.4 + fresnel * 0.55) * uSunIntensity;
				vec3 finalColor = baseColor * (ambient + diffuse) + highlight + fresnel * 0.08;

				vec3 fogViewDirection = normalize(vWorldPosition - uCameraPosition);
				float skyT = clamp(fogViewDirection.y * 0.5 + 0.5, 0.0, 1.0);
				vec3 fogGradient = sampleSkyGradientColor(skyT);
				float planarDistance = distance(vWorldPosition.xz, uCameraPosition.xz);
				float distanceFactor = smoothstep(uFogNear, uFogFar, planarDistance);
				float heightRange = max(uFogHeightMax - uFogHeightMin, 0.0001);
				float heightT = clamp((vWorldPosition.y - uFogHeightMin) / heightRange, 0.0, 1.0);
				float lowAltitudeFactor = 1.0 - smoothstep(0.18, 0.96, heightT);
				float fogFactor = 1.0 - exp(-distanceFactor * distanceFactor * uFogDensity * 2.9);
				fogFactor *= mix(1.0, 1.42, lowAltitudeFactor);
				fogFactor = clamp(fogFactor, 0.0, 0.992);
				finalColor = mix(finalColor, fogGradient, fogFactor);

				gl_FragColor = vec4(finalColor, 0.85);
			}
		`,
		transparent: true,
		depthWrite: false,
		depthTest: true,
		toneMapped: true,
	});

	const geometry = new THREE.PlaneGeometry(tileSize, tileSize, 1, 1);
	geometry.rotateX(-Math.PI / 2);

	return {
		tileSize,
		geometry,
		material,
		dispose() {
			geometry.dispose();
			material.uniforms.uNormalMap.value.dispose();
			material.dispose();
		},
	};
}

export function createWaterTileMesh(tileX, tileZ, tileSize, waterSurface) {
	const mesh = new THREE.Mesh(waterSurface.geometry, waterSurface.material);
	mesh.position.set(tileX * tileSize, WATER_LEVEL, tileZ * tileSize);
	mesh.frustumCulled = true;
	mesh.receiveShadow = false;
	mesh.castShadow = false;
	return mesh;
}

export function updateWaterSurface(waterSurface, cameraPosition, timeSeconds, enabled, atmosphereState, lightingState, fogState) {
	if (!waterSurface) {
		return;
	}

	const uniforms = waterSurface.material.uniforms;
	uniforms.uTime.value = timeSeconds;
	uniforms.uCameraPosition.value.copy(cameraPosition);
	uniforms.uEnabled.value = enabled ? 1 : 0;

	if (atmosphereState?.sunDirection) {
		uniforms.uSunDirection.value.copy(atmosphereState.sunDirection);
	}

	if (lightingState?.sunColor) {
		uniforms.uSunColor.value.copy(lightingState.sunColor);
	}
	if (lightingState?.ambientColor) {
		uniforms.uAmbientColor.value.copy(lightingState.ambientColor);
	}
	if (Number.isFinite(lightingState?.sunIntensity)) {
		uniforms.uSunIntensity.value = lightingState.sunIntensity;
	}
	if (Number.isFinite(lightingState?.ambientIntensity)) {
		uniforms.uAmbientIntensity.value = lightingState.ambientIntensity;
	}

	if (fogState?.atmosphereState?.topColor) {
		uniforms.uFogTopColor.value.copy(fogState.atmosphereState.topColor);
		uniforms.uFogUpperColor.value.copy(fogState.atmosphereState.upperColor);
		uniforms.uFogHorizonColor.value.copy(fogState.atmosphereState.horizonColor);
		uniforms.uFogBottomColor.value.copy(fogState.atmosphereState.bottomColor);
	}
	if (Number.isFinite(fogState?.fogNear)) {
		uniforms.uFogNear.value = fogState.fogNear;
	}
	if (Number.isFinite(fogState?.fogFar)) {
		uniforms.uFogFar.value = fogState.fogFar;
	}
	if (Number.isFinite(fogState?.fogHeightMin)) {
		uniforms.uFogHeightMin.value = fogState.fogHeightMin;
	}
	if (Number.isFinite(fogState?.fogHeightMax)) {
		uniforms.uFogHeightMax.value = fogState.fogHeightMax;
	}
	if (Number.isFinite(fogState?.fogDensity)) {
		uniforms.uFogDensity.value = fogState.fogDensity;
	}
}