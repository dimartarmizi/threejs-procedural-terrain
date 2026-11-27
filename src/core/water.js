import * as THREE from 'three';

const WATER_LEVEL = 0;
const WATER_COLOR_DEEP = new THREE.Color(0x125a78);
const WATER_COLOR_SHALLOW = new THREE.Color(0x5eb7dd);
const DEFAULT_SUN_COLOR = new THREE.Color(0xffffff);
const DEFAULT_AMBIENT_COLOR = new THREE.Color(0x7c8b9b);
const DEFAULT_SUN_DIRECTION = new THREE.Vector3(0.4, 0.8, 0.2).normalize();
const DEFAULT_WATER_COLOR_DEEP = WATER_COLOR_DEEP.clone();
const DEFAULT_WATER_COLOR_SHALLOW = WATER_COLOR_SHALLOW.clone();
const WATER_COLOR_WORKING = new THREE.Color();
const WATER_COLOR_WORKING_2 = new THREE.Color();
const WATER_ANIMATION_SPEED = 0.55;
const HEIGHTMAP_SIZE = 64;

export function createWaterSurface(tileSize) {
	const loader = new THREE.TextureLoader();
	const normalTexture = loader.load('/textures/waternormals.jpg');
	normalTexture.wrapS = THREE.RepeatWrapping;
	normalTexture.wrapT = THREE.RepeatWrapping;
	normalTexture.colorSpace = THREE.NoColorSpace;

	const heightData = new Uint8Array(HEIGHTMAP_SIZE * HEIGHTMAP_SIZE * 4);
	const heightMap = new THREE.DataTexture(heightData, HEIGHTMAP_SIZE, HEIGHTMAP_SIZE, THREE.RGBAFormat);
	heightMap.minFilter = THREE.LinearFilter;
	heightMap.magFilter = THREE.LinearFilter;
	heightMap.wrapS = THREE.ClampToEdgeWrapping;
	heightMap.wrapT = THREE.ClampToEdgeWrapping;
	heightMap.needsUpdate = true;

	const material = new THREE.ShaderMaterial({
		uniforms: {
			uTime: { value: 0 },
			uCameraPosition: { value: new THREE.Vector3() },
			uNormalMap: { value: normalTexture },
			uTerrainHeightMap: { value: heightMap },
			uHeightMapCenter: { value: new THREE.Vector2() },
			uHeightMapSpan: { value: tileSize },
			uHeightMapMax: { value: 200 },
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
		},
		vertexShader: `
			#include <common>
			#include <logdepthbuf_pars_vertex>
			varying vec3 vWorldPosition;

			void main() {
				vec4 worldPosition = modelMatrix * vec4(position, 1.0);
				vWorldPosition = worldPosition.xyz;
				gl_Position = projectionMatrix * viewMatrix * worldPosition;
				#include <logdepthbuf_vertex>
			}
		`,
		fragmentShader: `
			#include <common>
			#include <logdepthbuf_pars_fragment>
			uniform float uTime;
			uniform vec3 uCameraPosition;
			uniform sampler2D uNormalMap;
			uniform sampler2D uTerrainHeightMap;
			uniform vec2 uHeightMapCenter;
			uniform float uHeightMapSpan;
			uniform float uHeightMapMax;
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

			float sampleTerrainSunVisibility(vec3 worldPos, vec3 sunDir) {
				if (sunDir.y <= 0.005) {
					return 0.0;
				}

				float maxDist = min(uHeightMapSpan * 0.46, (uHeightMapMax / max(sunDir.y, 0.03)) * 1.1);
				float softness = max(6.0, uHeightMapMax * 0.08);
				float shadow = 0.0;

				for (int i = 1; i <= 12; i++) {
					float f = float(i) / 12.0;
					float t = mix(f, f * f, 0.45) * maxDist;
					vec2 sampleXZ = worldPos.xz + sunDir.xz * t;
					vec2 hmUv = (sampleXZ - uHeightMapCenter) / uHeightMapSpan + 0.5;
					if (hmUv.x <= 0.01 || hmUv.x >= 0.99 || hmUv.y <= 0.01 || hmUv.y >= 0.99) {
						break;
					}
					float terrainH = texture2D(uTerrainHeightMap, hmUv).r * uHeightMapMax;
					float rayY = worldPos.y + sunDir.y * t;
					float occ = smoothstep(-softness, softness, terrainH - rayY);
					shadow = max(shadow, occ);
					if (shadow >= 0.99) {
						return 0.0;
					}
				}

				return (1.0 - shadow) * smoothstep(0.005, 0.05, sunDir.y);
			}

			void main() {
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
				float sunVisibility = specular > 0.004 ? sampleTerrainSunVisibility(vWorldPosition, sunDir) : 0.0;
				float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 2.4);
				vec3 baseColor = mix(uColorDeep, uColorShallow, fresnel * 0.95 + nDotL * 0.05);
				vec3 ambient = uAmbientColor * uAmbientIntensity * 0.48;
				vec3 diffuse = uSunColor * (uSunIntensity * (0.18 + nDotL * 0.62));
				vec3 highlight = uSunColor * specular * (0.4 + fresnel * 0.55) * uSunIntensity * sunVisibility;
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

				#include <logdepthbuf_fragment>
				gl_FragColor = vec4(finalColor, 0.85);
			}
		`,
		transparent: true,
		depthWrite: false,
		depthTest: true,
		toneMapped: true,
	});

	const geometry = new THREE.PlaneGeometry(tileSize, tileSize, 16, 16);
	geometry.rotateX(-Math.PI / 2);

	return {
		tileSize,
		geometry,
		material,
		heightData,
		heightMap,
		heightMapCenterX: NaN,
		heightMapCenterZ: NaN,
		heightMapSpan: 0,
		dispose() {
			geometry.dispose();
			material.uniforms.uNormalMap.value.dispose();
			heightMap.dispose();
			material.dispose();
		},
	};
}

export function updateWaterHeightMap(waterSurface, terrain, cameraPosition, span, force = false) {
	const step = span / HEIGHTMAP_SIZE;
	const moveThreshold = terrain.tileSize * 1.5;

	if (
		!force &&
		waterSurface.heightMapSpan === span &&
		Math.abs(cameraPosition.x - waterSurface.heightMapCenterX) < moveThreshold &&
		Math.abs(cameraPosition.z - waterSurface.heightMapCenterZ) < moveThreshold
	) {
		return;
	}

	const snappedX = Math.round(cameraPosition.x / step) * step;
	const snappedZ = Math.round(cameraPosition.z / step) * step;

	const maxH = Math.max(10, terrain.baseHeight + terrain.heightMultiplier);
	const invMaxH = 255 / maxH;
	const data = waterSurface.heightData;
	const minX = snappedX - span * 0.5;
	const minZ = snappedZ - span * 0.5;

	for (let iz = 0; iz < HEIGHTMAP_SIZE; iz++) {
		const wz = minZ + (iz + 0.5) * step;
		for (let ix = 0; ix < HEIGHTMAP_SIZE; ix++) {
			const wx = minX + (ix + 0.5) * step;
			const h = terrain.sampleHeight(wx, wz);
			const idx = (iz * HEIGHTMAP_SIZE + ix) * 4;
			data[idx] = h <= 0 ? 0 : Math.min(255, Math.round(h * invMaxH));
		}
	}

	waterSurface.heightMapCenterX = snappedX;
	waterSurface.heightMapCenterZ = snappedZ;
	waterSurface.heightMapSpan = span;
	waterSurface.heightMap.needsUpdate = true;

	const uniforms = waterSurface.material.uniforms;
	uniforms.uHeightMapCenter.value.set(snappedX, snappedZ);
	uniforms.uHeightMapSpan.value = span;
	uniforms.uHeightMapMax.value = maxH;
}

export function createWaterTileMesh(tileX, tileZ, tileSize, waterSurface) {
	const mesh = new THREE.Mesh(waterSurface.geometry, waterSurface.material);
	mesh.position.set(tileX * tileSize, WATER_LEVEL, tileZ * tileSize);
	mesh.frustumCulled = true;
	mesh.receiveShadow = false;
	mesh.castShadow = false;
	return mesh;
}

export function updateWaterSurface(waterSurface, cameraPosition, timeSeconds, atmosphereState, lightingState, fogState) {
	const uniforms = waterSurface.material.uniforms;
	uniforms.uTime.value = timeSeconds * WATER_ANIMATION_SPEED;
	uniforms.uCameraPosition.value.copy(cameraPosition);
	updateWaterColorUniforms(uniforms, atmosphereState);

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

function updateWaterColorUniforms(uniforms, atmosphereState) {
	if (!atmosphereState?.topColor) {
		uniforms.uColorDeep.value.copy(DEFAULT_WATER_COLOR_DEEP);
		uniforms.uColorShallow.value.copy(DEFAULT_WATER_COLOR_SHALLOW);
		return;
	}

	const horizonColor = atmosphereState.horizonColor || atmosphereState.upperColor || atmosphereState.topColor;
	const upperColor = atmosphereState.upperColor || atmosphereState.topColor;
	const bottomColor = atmosphereState.bottomColor || horizonColor;

	WATER_COLOR_WORKING.copy(DEFAULT_WATER_COLOR_DEEP)
		.lerp(bottomColor, 0.2)
		.lerp(horizonColor, 0.22)
		.lerp(atmosphereState.topColor, 0.06);

	WATER_COLOR_WORKING_2.copy(DEFAULT_WATER_COLOR_SHALLOW)
		.lerp(horizonColor, 0.3)
		.lerp(upperColor, 0.22)
		.lerp(atmosphereState.topColor, 0.08);

	uniforms.uColorDeep.value.copy(WATER_COLOR_WORKING);
	uniforms.uColorShallow.value.copy(WATER_COLOR_WORKING_2);
}