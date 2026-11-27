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
		`float terrainHash21(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}

float terrainVNoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(
		mix(terrainHash21(i), terrainHash21(i + vec2(1.0, 0.0)), f.x),
		mix(terrainHash21(i + vec2(0.0, 1.0)), terrainHash21(i + vec2(1.0, 1.0)), f.x),
		f.y
	);
}

vec3 sampleFarmlandColor(vec2 worldXZ, float scaleNorm) {
	float angle = 0.24;
	mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
	vec2 uv = (rot * worldXZ) * (0.0048 / scaleNorm);

	vec2 macroCell = floor(uv * 0.25);
	if (terrainHash21(macroCell) > 0.5) {
		uv = vec2(uv.y * 1.12, uv.x * 0.88);
	}

	vec2 cell = floor(uv);
	vec2 f = fract(uv);
	float plotId = terrainHash21(cell + macroCell * 7.13);
	float subN = terrainVNoise(worldXZ * (0.028 / scaleNorm));

	float bx = smoothstep(0.0, 0.055, f.x) * smoothstep(0.0, 0.055, 1.0 - f.x);
	float by = smoothstep(0.0, 0.055, f.y) * smoothstep(0.0, 0.055, 1.0 - f.y);
	float insidePlot = bx * by;

	vec3 cDark = vec3(0.09, 0.20, 0.07);
	vec3 cLush = vec3(0.14, 0.30, 0.09);
	vec3 cBright = vec3(0.24, 0.38, 0.12);
	vec3 cGolden = vec3(0.39, 0.36, 0.16);
	vec3 cSoil = vec3(0.22, 0.19, 0.13);
	vec3 cBund = vec3(0.18, 0.17, 0.12);

	vec3 col;
	if (plotId < 0.25) col = mix(cDark, cLush, subN);
	else if (plotId < 0.62) col = mix(cLush, cBright, subN);
	else if (plotId < 0.84) col = mix(cBright, cGolden, subN * 0.65);
	else col = mix(cSoil, cGolden, subN * 0.5);

	return mix(cBund, col, insidePlot);
}

vec3 sampleTerrainColor(vec3 worldPos, vec3 worldNormal, float normalizedHeight, float slope, int colorMode, int terrainTypeId) {
	float worldHeight = worldPos.y;
	float scaleNorm = max(terrainScale / 5000.0, 0.14);
	vec3 terrainColor = colorMode == 1
		? sampleThemePalette(normalizedHeight, terrainTypeId)
		: sampleBiomeTerrainColor(normalizedHeight, slope, terrainTypeId);

	float macroDetail = terrainVNoise(worldPos.xz * (0.0022 / scaleNorm));
	terrainColor *= mix(0.90, 1.10, macroDetail);

	if (terrainTypeId != 3 && colorMode == 0) {
		float flatMask = 1.0 - smoothstep(0.06, 0.16, slope);
		float maxFarmH = min(230.0, terrainBaseHeight + terrainHeightMultiplier * 0.36);
		float minFarmLow = max(4.0, 8.0 * scaleNorm);
		float minFarmHigh = max(10.0, 22.0 * scaleNorm);
		float elevMask = smoothstep(minFarmLow, minFarmHigh, worldHeight) * (1.0 - smoothstep(maxFarmH * 0.68, maxFarmH, worldHeight));
		float farmWeight = flatMask * elevMask;
		if (farmWeight > 0.01) {
			float farmRegion = smoothstep(0.30, 0.60, terrainVNoise(worldPos.xz * (0.00028 / scaleNorm) + vec2(4.2, -7.8)));
			farmWeight *= farmRegion;
			if (farmWeight > 0.01) {
				vec3 farmCol = sampleFarmlandColor(worldPos.xz, scaleNorm);
				terrainColor = mix(terrainColor, farmCol, farmWeight * 0.88);
			}
		}

		float cliffMask = smoothstep(0.34, 0.62, slope);
		if (cliffMask > 0.01) {
			vec2 rockUv = abs(worldNormal.x) > abs(worldNormal.z) ? worldPos.zy : worldPos.xy;
			float rockDetail = terrainVNoise(rockUv * (0.022 / scaleNorm));
			vec3 rockTint = sampleBiomeMountainColor(normalizedHeight) * mix(0.82, 1.12, rockDetail);
			terrainColor = mix(terrainColor, rockTint, cliffMask * 0.65);
		}
	}

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
		shader.uniforms.terrainScale = { value: terrain.scale };
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
				'#include <worldpos_vertex>\nvec4 terrainColorWorldPos = modelMatrix * vec4( transformed, 1.0 );\nvTerrainWorldPosition = terrainColorWorldPos.xyz;'
			)
			.replace(
				'#include <beginnormal_vertex>',
				'#include <beginnormal_vertex>\nvTerrainWorldNormal = normalize(mat3(modelMatrix) * objectNormal);'
			);

		shader.fragmentShader = shader.fragmentShader
			.replace(
				'#include <common>',
				`#include <common>\nuniform float terrainBaseHeight;\nuniform float terrainHeightMultiplier;\nuniform float terrainScale;\nuniform int terrainColorMode;\nuniform int terrainTypeId;\nvarying vec3 vTerrainWorldPosition;\nvarying vec3 vTerrainWorldNormal;\n${TERRAIN_SHADER_SOURCE}`
			)
			.replace(
				'#include <color_fragment>',
				`float terrainNormalizedHeight = (vTerrainWorldPosition.y - terrainBaseHeight) / max(terrainHeightMultiplier, 0.0001);\nvec3 terrainNormalDir = normalize(vTerrainWorldNormal);\nfloat terrainSlopeValue = terrainSlope(terrainNormalDir);\ndiffuseColor.rgb = sampleTerrainColor(vTerrainWorldPosition, terrainNormalDir, terrainNormalizedHeight, terrainSlopeValue, terrainColorMode, terrainTypeId);`
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
		terrainScale: terrain.scale,
		terrainColorMode: getTerrainColorModeValue(terrain.colorMode),
		terrainTypeId: getTerrainTypeId(terrain.terrainType),
	};

	if (!shader) {
		material.userData.pendingTerrainColorUniforms = pendingUniforms;
		return;
	}

	shader.uniforms.terrainBaseHeight.value = pendingUniforms.terrainBaseHeight;
	shader.uniforms.terrainHeightMultiplier.value = pendingUniforms.terrainHeightMultiplier;
	shader.uniforms.terrainScale.value = pendingUniforms.terrainScale;
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
	uniforms.terrainScale.value = pending.terrainScale;
	uniforms.terrainColorMode.value = pending.terrainColorMode;
	uniforms.terrainTypeId.value = pending.terrainTypeId;
}
