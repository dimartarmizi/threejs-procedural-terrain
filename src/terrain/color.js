import * as THREE from 'three';

const LOWLAND_HEIGHT_THRESHOLD = 2;
const LOWLAND_BLEND_HEIGHT = 10;
const SAND_COLOR = new THREE.Color(0xd8bd79);
const TEMP_COLOR = new THREE.Color();
const TEMP_COLOR_A = new THREE.Color();
const TEMP_COLOR_B = new THREE.Color();

const TERRAIN_COLOR_STOPS = [
	{ threshold: -0.18, color: new THREE.Color(0x3f5f43) },
	{ threshold: -0.02, color: new THREE.Color(0x5e8736) },
	{ threshold: 0.18, color: new THREE.Color(0x7ca246) },
	{ threshold: 0.42, color: new THREE.Color(0xb2cf6c) },
	{ threshold: 0.62, color: new THREE.Color(0xe2dece) },
];

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

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, value) {
	const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
	return t * t * (3 - 2 * t);
}

export function getTerrainColorHex(normalizedHeight) {
	return getTerrainColor(normalizedHeight, TEMP_COLOR).getHex();
}

export function getTerrainColor(normalizedHeight, color = new THREE.Color()) {
	return sampleColorStops(TERRAIN_COLOR_STOPS, normalizedHeight, color);
}

function sampleColorStops(stops, normalizedValue, color = new THREE.Color()) {
	const firstStop = stops[0];

	if (normalizedValue <= firstStop.threshold) {
		return color.copy(firstStop.color);
	}

	for (let index = 1; index < stops.length; index += 1) {
		const lowerStop = stops[index - 1];
		const upperStop = stops[index];

		if (normalizedValue <= upperStop.threshold) {
			const blend = smoothstep(lowerStop.threshold, upperStop.threshold, normalizedValue);
			return color.copy(lowerStop.color).lerp(upperStop.color, blend);
		}
	}

	return color.copy(stops[stops.length - 1].color);
}

function getThemePalette(terrainType) {
	return THEME_PALETTES[terrainType] || THEME_PALETTES.default;
}

function sampleBiomeTerrainColor(terrainType, normalizedHeight, slope, color = new THREE.Color()) {
	if (terrainType === 'desert') {
		return sampleColorStops(BIOME_COLOR_STOPS.desert, normalizedHeight, color);
	}

	const plainColor = sampleColorStops(BIOME_COLOR_STOPS.plain, normalizedHeight, color);
	const hillColor = sampleColorStops(BIOME_COLOR_STOPS.hill, normalizedHeight, TEMP_COLOR_A);
	const mountainColor = sampleColorStops(BIOME_COLOR_STOPS.mountain, normalizedHeight, TEMP_COLOR_B);

	const lowHeightFade = smoothstep(-0.08, 0.12, normalizedHeight);
	const hillFromHeight = smoothstep(0.12, 0.46, normalizedHeight);
	const hillFromSlope = smoothstep(0.2, 0.44, slope);
	let hillBlend = Math.max(hillFromHeight, hillFromSlope) * lowHeightFade;

	const mountainFromHeight = smoothstep(0.5, 0.82, normalizedHeight);
	const mountainFromSlope = smoothstep(0.48, 0.78, slope);
	let mountainBlend = Math.max(mountainFromHeight, mountainFromSlope) * lowHeightFade;

	if (terrainType === 'hills') {
		hillBlend = Math.max(hillBlend, 0.5);
	}

	if (terrainType === 'mountains') {
		mountainBlend = Math.max(mountainBlend, 0.65);
	}

	hillBlend = clamp(hillBlend, 0, 1);
	mountainBlend = clamp(Math.max(mountainBlend, hillBlend * 0.15), 0, 1);
	const effectiveHillBlend = hillBlend * (1 - mountainBlend * 0.9);
	const mountainDominance = smoothstep(0.18, 0.78, mountainBlend);

	return plainColor.lerp(hillColor, effectiveHillBlend).lerp(mountainColor, mountainDominance);
}

export function getTerrainColorByHeight(height, normalizedHeight, slope, colorMode = 'biome', terrainType = '', color = new THREE.Color()) {
	const terrainColor = colorMode === 'theme'
		? sampleColorStops(getThemePalette(terrainType), normalizedHeight, TEMP_COLOR)
		: sampleBiomeTerrainColor(terrainType, normalizedHeight, slope, TEMP_COLOR);

	const lowlandWeight = 1 - smoothstep(LOWLAND_HEIGHT_THRESHOLD - 8, LOWLAND_BLEND_HEIGHT + 4, height);
	const shorelineWeight = 1 - smoothstep(-0.28, 0.08, normalizedHeight);
	const baseSandWeight = clamp(lowlandWeight * 0.78 + shorelineWeight * 0.46, 0, 1);
	const slopeAttenuation = 1 - smoothstep(0.45, 0.9, slope);
	const sandWeight = clamp(baseSandWeight * (0.65 + slopeAttenuation * 0.35), 0, 1);

	return color.copy(terrainColor).lerp(SAND_COLOR, sandWeight);
}
