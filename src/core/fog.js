import * as THREE from 'three';

const DEFAULT_TOP_COLOR = new THREE.Color(0x87b7ff);
const DEFAULT_UPPER_COLOR = new THREE.Color(0xbfdfff);
const DEFAULT_HORIZON_COLOR = new THREE.Color(0xc6e6ff);
const DEFAULT_BOTTOM_COLOR = new THREE.Color(0xa6ccf0);
const DEFAULT_SUN_DIRECTION = new THREE.Vector3(0.2, 0.85, 0.1).normalize();

const FOG_DISTANCE_MIN = 0.5;
const FOG_DISTANCE_MAX = 2.5;
const FOG_NEAR_TILE_SCALE = 0.55;
const FOG_NEAR_FAR_SCALE = 0.16;
const FOG_DENSITY_STREAM_SCALE = 1.25;
const FOG_DENSITY_MIN = 0.3;
const FOG_DENSITY_MAX = 2.6;

export function setupFogMaterial(material) {
	if (material.userData.fogInstalled) {
		return;
	}

	material.onBeforeCompile = function (shader) {
		shader.uniforms.fogCameraPosition = { value: new THREE.Vector3() };
		shader.uniforms.fogSunDirection = { value: DEFAULT_SUN_DIRECTION.clone() };
		shader.uniforms.fogTopColor = { value: DEFAULT_TOP_COLOR.clone() };
		shader.uniforms.fogUpperColor = { value: DEFAULT_UPPER_COLOR.clone() };
		shader.uniforms.fogHorizonColor = { value: DEFAULT_HORIZON_COLOR.clone() };
		shader.uniforms.fogBottomColor = { value: DEFAULT_BOTTOM_COLOR.clone() };
		shader.uniforms.fogNear = { value: 150 };
		shader.uniforms.fogFar = { value: 900 };
		shader.uniforms.fogHeightMin = { value: -40 };
		shader.uniforms.fogHeightMax = { value: 240 };
		shader.uniforms.fogDensity = { value: 1 };

		shader.vertexShader = shader.vertexShader
			.replace(
				'#include <common>',
				'#include <common>\nvarying vec3 vFogWorldPosition;'
			)
			.replace(
				'#include <worldpos_vertex>',
				'#include <worldpos_vertex>\nvFogWorldPosition = worldPosition.xyz;'
			);

		shader.fragmentShader = shader.fragmentShader
			.replace(
				'#include <common>',
				`#include <common>
				uniform vec3 fogCameraPosition;
				uniform vec3 fogSunDirection;
				uniform vec3 fogTopColor;
				uniform vec3 fogUpperColor;
				uniform vec3 fogHorizonColor;
				uniform vec3 fogBottomColor;
				uniform float fogNear;
				uniform float fogFar;
				uniform float fogHeightMin;
				uniform float fogHeightMax;
				uniform float fogDensity;
				varying vec3 vFogWorldPosition;

				vec3 sampleSkyGradientColor(float t) {
					float horizonBlend = smoothstep(0.0, 0.42, t);
					float upperBlend = smoothstep(0.22, 0.78, t);
					float topBlend = smoothstep(0.56, 1.0, t);
					vec3 color = mix(fogBottomColor, fogHorizonColor, horizonBlend);
					color = mix(color, fogUpperColor, upperBlend);
					color = mix(color, fogTopColor, topBlend);
					return color;
				}`
			)
			.replace(
				'#include <fog_fragment>',
				`vec3 fogViewDirection = normalize(vFogWorldPosition - fogCameraPosition);
				float viewSkyT = clamp(fogViewDirection.y * 0.5 + 0.5, 0.0, 1.0);

				float planarDistance = distance(vFogWorldPosition.xz, fogCameraPosition.xz);
				float distanceFactor = smoothstep(fogNear, fogFar, planarDistance);

				float heightRange = max(fogHeightMax - fogHeightMin, 0.0001);
				float heightT = clamp((vFogWorldPosition.y - fogHeightMin) / heightRange, 0.0, 1.0);
				float skyT = viewSkyT;
				vec3 gradientColor = sampleSkyGradientColor(skyT);

				float lowAltitudeFactor = 1.0 - smoothstep(0.18, 0.96, heightT);

				vec2 sunDirectionXZ = normalize(fogSunDirection.xz + vec2(0.0001));
				vec2 viewDirectionXZ = normalize(fogViewDirection.xz + vec2(0.0001));
				float sunForwardScatter = pow(max(dot(viewDirectionXZ, sunDirectionXZ), 0.0), 8.0) * 0.03;
				vec3 fogColor = mix(gradientColor, fogHorizonColor, sunForwardScatter * 0.35);

				float fogFactor = 1.0 - exp(-distanceFactor * distanceFactor * fogDensity * 2.9);
				fogFactor *= mix(1.0, 1.42, lowAltitudeFactor);
				fogFactor = clamp(fogFactor, 0.0, 0.992);
				gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);

				#include <fog_fragment>`
			);

		material.userData.fogShader = shader;
		applyPendingFogUniforms(shader.uniforms, material.userData.pendingFogUniforms);
	};

	material.customProgramCacheKey = function () {
		return 'fog';
	};

	material.needsUpdate = true;
	material.userData.fogInstalled = true;
}

export function applyFog(tiles, cameraPosition, terrain, renderDistance, fogDistance, fogEnabled, atmosphereState) {
	const fogParams = computeFogParameters(terrain, renderDistance, fogDistance);
	const fogNear = fogParams.fogNear;
	const fogFar = fogParams.fogFar;
	const fogHeightMin = terrain.baseHeight - terrain.heightMultiplier * 0.65;
	const fogHeightMax = terrain.baseHeight + terrain.heightMultiplier * 0.75;
	const safeFogDensity = fogEnabled ? fogParams.fogDensity : 0;

	tiles.forEach(function (tile) {
		updateFogUniforms(
			tile.material,
			cameraPosition,
			atmosphereState,
			fogNear,
			fogFar,
			fogHeightMin,
			fogHeightMax,
			safeFogDensity
		);
	});

	return {
		cameraPosition,
		fogNear,
		fogFar,
		fogHeightMin,
		fogHeightMax,
		fogDensity: safeFogDensity,
		atmosphereState,
	};
}

function computeFogParameters(terrain, renderDistance, fogDistance) {
	const streamDistance = Math.max(terrain.tileSize, renderDistance * terrain.tileSize);
	const safeFogDistance = THREE.MathUtils.clamp(fogDistance, FOG_DISTANCE_MIN, FOG_DISTANCE_MAX);
	const fogFar = streamDistance * safeFogDistance;
	const fogNear = Math.max(terrain.tileSize * FOG_NEAR_TILE_SCALE, fogFar * FOG_NEAR_FAR_SCALE);
	const fogSpan = Math.max(fogFar - fogNear, terrain.tileSize * 0.5);
	const fogDensity = THREE.MathUtils.clamp(
		(streamDistance * FOG_DENSITY_STREAM_SCALE) / fogSpan,
		FOG_DENSITY_MIN,
		FOG_DENSITY_MAX
	);

	return {
		fogNear,
		fogFar,
		fogDensity,
	};
}

function updateFogUniforms(material, cameraPosition, atmosphereState, fogNear, fogFar, fogHeightMin, fogHeightMax, fogDensity) {
	const shader = material.userData.fogShader;
	if (!shader) {
		material.userData.pendingFogUniforms = createPendingFogUniforms(
			cameraPosition,
			atmosphereState,
			fogNear,
			fogFar,
			fogHeightMin,
			fogHeightMax,
			fogDensity
		);
		return;
	}

	applyScalarFogUniforms(shader.uniforms, cameraPosition, fogNear, fogFar, fogHeightMin, fogHeightMax, fogDensity);
	material.userData.pendingFogUniforms = null;

	if (!atmosphereState) {
		return;
	}

	applyAtmosphereUniforms(shader.uniforms, atmosphereState);
}

function createPendingFogUniforms(cameraPosition, atmosphereState, fogNear, fogFar, fogHeightMin, fogHeightMax, fogDensity) {
	return {
		cameraPosition: cameraPosition.clone(),
		fogNear,
		fogFar,
		fogHeightMin,
		fogHeightMax,
		fogDensity,
		topColor: atmosphereState ? atmosphereState.topColor.clone() : null,
		upperColor: atmosphereState ? atmosphereState.upperColor.clone() : null,
		horizonColor: atmosphereState ? atmosphereState.horizonColor.clone() : null,
		bottomColor: atmosphereState ? atmosphereState.bottomColor.clone() : null,
		sunDirection: atmosphereState ? atmosphereState.sunDirection.clone() : null,
	};
}

function applyPendingFogUniforms(uniforms, pending) {
	if (!pending) {
		return;
	}

	applyScalarFogUniforms(
		uniforms,
		pending.cameraPosition,
		pending.fogNear,
		pending.fogFar,
		pending.fogHeightMin,
		pending.fogHeightMax,
		pending.fogDensity
	);

	if (!pending.topColor || !pending.upperColor || !pending.horizonColor || !pending.bottomColor || !pending.sunDirection) {
		return;
	}

	applyAtmosphereUniforms(uniforms, pending);
}

function applyScalarFogUniforms(uniforms, cameraPosition, fogNear, fogFar, fogHeightMin, fogHeightMax, fogDensity) {
	uniforms.fogCameraPosition.value.copy(cameraPosition);
	uniforms.fogNear.value = fogNear;
	uniforms.fogFar.value = fogFar;
	uniforms.fogHeightMin.value = fogHeightMin;
	uniforms.fogHeightMax.value = fogHeightMax;
	uniforms.fogDensity.value = fogDensity;
}

function applyAtmosphereUniforms(uniforms, source) {
	uniforms.fogTopColor.value.copy(source.topColor);
	uniforms.fogUpperColor.value.copy(source.upperColor);
	uniforms.fogHorizonColor.value.copy(source.horizonColor);
	uniforms.fogBottomColor.value.copy(source.bottomColor);
	uniforms.fogSunDirection.value.copy(source.sunDirection);
}