import * as THREE from 'three';

const LOWLAND_HEIGHT_THRESHOLD = 2;
const LOWLAND_BLEND_HEIGHT = 10;
const SAND_COLOR = new THREE.Color(0xd8bd79);

const BIOME_COLOR_STOPS = {
	plain: [
		{ threshold: -0.15, color: new THREE.Color(0x49683f) },
		{ threshold: 0.15, color: new THREE.Color(0x698d46) },
		{ threshold: 0.4, color: new THREE.Color(0x95ad57) },
	],
	hill: [
		{ threshold: -0.1, color: new THREE.Color(0x5e7f35) },
		{ threshold: 0.2, color: new THREE.Color(0x7f9d44) },
		{ threshold: 0.52, color: new THREE.Color(0xb6c95e) },
	],
	mountain: [
		{ threshold: -0.1, color: new THREE.Color(0x6b6a60) },
		{ threshold: 0.24, color: new THREE.Color(0x8a8579) },
		{ threshold: 0.62, color: new THREE.Color(0xb8b1a0) },
	],
	desert: [
		{ threshold: -0.15, color: new THREE.Color(0xc8ad69) },
		{ threshold: 0.2, color: new THREE.Color(0xd7be7a) },
		{ threshold: 0.55, color: new THREE.Color(0xe8d39d) },
	],
};

const THEME_PALETTES = {
	hills: [
		{ threshold: -0.2, color: new THREE.Color(0x3f6137) },
		{ threshold: 0.15, color: new THREE.Color(0x5d8435) },
		{ threshold: 0.45, color: new THREE.Color(0x86ab4d) },
		{ threshold: 0.75, color: new THREE.Color(0xc8d98a) },
	],
	mountains: [
		{ threshold: -0.2, color: new THREE.Color(0x505050) },
		{ threshold: 0.2, color: new THREE.Color(0x6f6c66) },
		{ threshold: 0.55, color: new THREE.Color(0xa49d92) },
		{ threshold: 0.82, color: new THREE.Color(0xf0f0ea) },
	],
	desert: [
		{ threshold: -0.2, color: new THREE.Color(0xc9ad6e) },
		{ threshold: 0.18, color: new THREE.Color(0xdabf7c) },
		{ threshold: 0.55, color: new THREE.Color(0xe7d09a) },
		{ threshold: 0.82, color: new THREE.Color(0xf5ebc8) },
	],
	default: [
		{ threshold: -0.2, color: new THREE.Color(0x48653e) },
		{ threshold: 0.18, color: new THREE.Color(0x6d8d48) },
		{ threshold: 0.5, color: new THREE.Color(0x97b85a) },
		{ threshold: 0.8, color: new THREE.Color(0xd3df9a) },
	],
};

const TERRAIN_COLOR_MODE = {
	biome: 0,
	theme: 1,
};

const TERRAIN_TYPE_ID = {
	'': 0,
	hills: 1,
	mountains: 2,
	desert: 3,
};

function colorToVec3Literal(color) {
	return `vec3(${color.r.toFixed(6)}, ${color.g.toFixed(6)}, ${color.b.toFixed(6)})`;
}

function buildColorStops3Function(functionName, stops) {
	return `vec3 ${functionName}(float value) {
	if (value <= ${stops[0].threshold.toFixed(2)}) {
		return ${colorToVec3Literal(stops[0].color)};
	}

	if (value <= ${stops[1].threshold.toFixed(2)}) {
		return mix(${colorToVec3Literal(stops[0].color)}, ${colorToVec3Literal(stops[1].color)}, smoothstep(${stops[0].threshold.toFixed(2)}, ${stops[1].threshold.toFixed(2)}, value));
	}

	if (value <= ${stops[2].threshold.toFixed(2)}) {
		return mix(${colorToVec3Literal(stops[1].color)}, ${colorToVec3Literal(stops[2].color)}, smoothstep(${stops[1].threshold.toFixed(2)}, ${stops[2].threshold.toFixed(2)}, value));
	}

	return ${colorToVec3Literal(stops[2].color)};
}`;
}

function buildColorStops4Function(functionName, stops) {
	return `vec3 ${functionName}(float value) {
	if (value <= ${stops[0].threshold.toFixed(2)}) {
		return ${colorToVec3Literal(stops[0].color)};
	}

	if (value <= ${stops[1].threshold.toFixed(2)}) {
		return mix(${colorToVec3Literal(stops[0].color)}, ${colorToVec3Literal(stops[1].color)}, smoothstep(${stops[0].threshold.toFixed(2)}, ${stops[1].threshold.toFixed(2)}, value));
	}

	if (value <= ${stops[2].threshold.toFixed(2)}) {
		return mix(${colorToVec3Literal(stops[1].color)}, ${colorToVec3Literal(stops[2].color)}, smoothstep(${stops[1].threshold.toFixed(2)}, ${stops[2].threshold.toFixed(2)}, value));
	}

	if (value <= ${stops[3].threshold.toFixed(2)}) {
		return mix(${colorToVec3Literal(stops[2].color)}, ${colorToVec3Literal(stops[3].color)}, smoothstep(${stops[2].threshold.toFixed(2)}, ${stops[3].threshold.toFixed(2)}, value));
	}

	return ${colorToVec3Literal(stops[3].color)};
}`;
}

function getTerrainColorModeValue(colorMode) {
	return TERRAIN_COLOR_MODE[colorMode] ?? TERRAIN_COLOR_MODE.biome;
}

function getTerrainTypeId(terrainType) {
	return TERRAIN_TYPE_ID[terrainType] ?? TERRAIN_TYPE_ID[''];
}

function buildTerrainShaderSource() {
	return [
		`float terrainSlope(vec3 worldNormal) {
			return acos(clamp(abs(worldNormal.y), 0.0, 1.0)) / 1.57079632679;
		}`,
		buildColorStops3Function('sampleBiomePlainColor', BIOME_COLOR_STOPS.plain),
		buildColorStops3Function('sampleBiomeHillColor', BIOME_COLOR_STOPS.hill),
		buildColorStops3Function('sampleBiomeMountainColor', BIOME_COLOR_STOPS.mountain),
		buildColorStops3Function('sampleBiomeDesertColor', BIOME_COLOR_STOPS.desert),
		buildColorStops4Function('sampleThemeHillsColor', THEME_PALETTES.hills),
		buildColorStops4Function('sampleThemeMountainsColor', THEME_PALETTES.mountains),
		buildColorStops4Function('sampleThemeDesertColor', THEME_PALETTES.desert),
		buildColorStops4Function('sampleThemeDefaultColor', THEME_PALETTES.default),
		`vec3 sampleThemePalette(float normalizedHeight, int terrainTypeId) {
	if (terrainTypeId == 1) {
		return sampleThemeHillsColor(normalizedHeight);
	}

	if (terrainTypeId == 2) {
		return sampleThemeMountainsColor(normalizedHeight);
	}

	if (terrainTypeId == 3) {
		return sampleThemeDesertColor(normalizedHeight);
	}

	return sampleThemeDefaultColor(normalizedHeight);
}`,
		`vec3 sampleBiomeTerrainColor(float normalizedHeight, float slope, int terrainTypeId) {
	if (terrainTypeId == 3) {
		return sampleBiomeDesertColor(normalizedHeight);
	}

	vec3 plainColor = sampleBiomePlainColor(normalizedHeight);
	vec3 hillColor = sampleBiomeHillColor(normalizedHeight);
	vec3 mountainColor = sampleBiomeMountainColor(normalizedHeight);

	float lowHeightFade = smoothstep(-0.08, 0.12, normalizedHeight);
	float hillFromHeight = smoothstep(0.12, 0.46, normalizedHeight);
	float hillFromSlope = smoothstep(0.2, 0.44, slope);
	float hillBlend = max(hillFromHeight, hillFromSlope) * lowHeightFade;

	float mountainFromHeight = smoothstep(0.5, 0.82, normalizedHeight);
	float mountainFromSlope = smoothstep(0.48, 0.78, slope);
	float mountainBlend = max(mountainFromHeight, mountainFromSlope) * lowHeightFade;

	if (terrainTypeId == 1) {
		hillBlend = max(hillBlend, 0.5);
	}

	if (terrainTypeId == 2) {
		mountainBlend = max(mountainBlend, 0.65);
	}

	hillBlend = clamp(hillBlend, 0.0, 1.0);
	mountainBlend = clamp(max(mountainBlend, hillBlend * 0.15), 0.0, 1.0);
	float effectiveHillBlend = hillBlend * (1.0 - mountainBlend * 0.9);
	float mountainDominance = smoothstep(0.18, 0.78, mountainBlend);

	return mix(mix(plainColor, hillColor, effectiveHillBlend), mountainColor, mountainDominance);
}`,
		`float sampleTerrainSandWeight(float worldHeight, float normalizedHeight, float slope) {
	if (worldHeight <= 0.5) {
		return 1.0;
	}

	float shorelineWeight = 1.0 - smoothstep(0.5, 4.0, worldHeight);
	float slopeAttenuation = 1.0 - smoothstep(0.45, 0.9, slope);
	return clamp(shorelineWeight * (0.7 + slopeAttenuation * 0.3), 0.0, 1.0);
}`,
		`vec3 sampleTerrainColor(float worldHeight, float normalizedHeight, float slope, int colorMode, int terrainTypeId) {
	vec3 terrainColor = colorMode == 1
		? sampleThemePalette(normalizedHeight, terrainTypeId)
		: sampleBiomeTerrainColor(normalizedHeight, slope, terrainTypeId);

	float sandWeight = sampleTerrainSandWeight(worldHeight, normalizedHeight, slope);
	return mix(terrainColor, ${colorToVec3Literal(SAND_COLOR)}, sandWeight);
}`,
	].join('\n\n');
}

const TERRAIN_SHADER_SOURCE = buildTerrainShaderSource();

export function setupTerrainColorMaterial(material, terrain) {
	if (material.userData.terrainColorInstalled) {
		return;
	}

	material.onBeforeCompile = function (shader) {
		shader.uniforms.terrainBaseHeight = { value: terrain.baseHeight };
		shader.uniforms.terrainHeightMultiplier = { value: terrain.heightMultiplier };
		shader.uniforms.terrainColorMode = { value: getTerrainColorModeValue(terrain.colorMode) };
		shader.uniforms.terrainTypeId = { value: getTerrainTypeId(terrain.terrainType) };

		shader.vertexShader = shader.vertexShader
			.replace(
				'#include <common>',
				'#include <common>\nvarying vec3 vTerrainWorldPosition;\nvarying vec3 vTerrainWorldNormal;'
			)
			.replace(
				'#include <begin_vertex>',
				'#include <begin_vertex>'
			)
			.replace(
				'#include <worldpos_vertex>',
				'#include <worldpos_vertex>\nvTerrainWorldPosition = worldPosition.xyz;'
			)
			.replace(
				'#include <beginnormal_vertex>',
				'#include <beginnormal_vertex>\nvTerrainWorldNormal = normalize(mat3(modelMatrix) * objectNormal);'
			);

		shader.fragmentShader = shader.fragmentShader
			.replace(
				'#include <common>',
				`#include <common>\nuniform float terrainBaseHeight;\nuniform float terrainHeightMultiplier;\nuniform int terrainColorMode;\nuniform int terrainTypeId;\nvarying vec3 vTerrainWorldPosition;\nvarying vec3 vTerrainWorldNormal;\n${TERRAIN_SHADER_SOURCE}`
			)
			.replace(
				'#include <color_fragment>',
				`float terrainNormalizedHeight = (vTerrainWorldPosition.y - terrainBaseHeight) / max(terrainHeightMultiplier, 0.0001);\nfloat terrainSlopeValue = terrainSlope(vTerrainWorldNormal);\ndiffuseColor.rgb = sampleTerrainColor(vTerrainWorldPosition.y, terrainNormalizedHeight, terrainSlopeValue, terrainColorMode, terrainTypeId);`
			);

		material.userData.terrainColorShader = shader;
		applyPendingTerrainColorUniforms(shader.uniforms, material.userData.pendingTerrainColorUniforms);
	};

	material.customProgramCacheKey = function () {
		return 'terrainColor';
	};

	material.needsUpdate = true;
	material.userData.terrainColorInstalled = true;
	material.userData.pendingTerrainColorUniforms = null;
}

export function applyTerrainColor(material, terrain) {
	const shader = material.userData.terrainColorShader;
	const pendingUniforms = {
		terrainBaseHeight: terrain.baseHeight,
		terrainHeightMultiplier: terrain.heightMultiplier,
		terrainColorMode: getTerrainColorModeValue(terrain.colorMode),
		terrainTypeId: getTerrainTypeId(terrain.terrainType),
	};

	if (!shader) {
		material.userData.pendingTerrainColorUniforms = pendingUniforms;
		return;
	}

	shader.uniforms.terrainBaseHeight.value = pendingUniforms.terrainBaseHeight;
	shader.uniforms.terrainHeightMultiplier.value = pendingUniforms.terrainHeightMultiplier;
	shader.uniforms.terrainColorMode.value = pendingUniforms.terrainColorMode;
	shader.uniforms.terrainTypeId.value = pendingUniforms.terrainTypeId;
	material.userData.pendingTerrainColorUniforms = null;
}

function applyPendingTerrainColorUniforms(uniforms, pending) {
	if (!pending) {
		return;
	}

	uniforms.terrainBaseHeight.value = pending.terrainBaseHeight;
	uniforms.terrainHeightMultiplier.value = pending.terrainHeightMultiplier;
	uniforms.terrainColorMode.value = pending.terrainColorMode;
	uniforms.terrainTypeId.value = pending.terrainTypeId;
}
