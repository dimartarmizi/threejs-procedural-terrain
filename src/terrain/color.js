import * as THREE from 'three';

const LOWLAND_HEIGHT_THRESHOLD = 2;
const LOWLAND_BLEND_HEIGHT = 10;
const SAND_COLOR = new THREE.Color(0xd8bd79);
const TEMP_COLOR = new THREE.Color();

const TERRAIN_COLOR_STOPS = [
	{ threshold: -0.18, color: new THREE.Color(0x3f5f43) },
	{ threshold: -0.02, color: new THREE.Color(0x5e8736) },
	{ threshold: 0.18, color: new THREE.Color(0x7ca246) },
	{ threshold: 0.42, color: new THREE.Color(0xb2cf6c) },
	{ threshold: 0.62, color: new THREE.Color(0xe2dece) },
];

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
	const firstStop = TERRAIN_COLOR_STOPS[0];

	if (normalizedHeight <= firstStop.threshold) {
		return color.copy(firstStop.color);
	}

	for (let index = 1; index < TERRAIN_COLOR_STOPS.length; index += 1) {
		const lowerStop = TERRAIN_COLOR_STOPS[index - 1];
		const upperStop = TERRAIN_COLOR_STOPS[index];

		if (normalizedHeight <= upperStop.threshold) {
			const blend = smoothstep(lowerStop.threshold, upperStop.threshold, normalizedHeight);
			return color.copy(lowerStop.color).lerp(upperStop.color, blend);
		}
	}

	return color.copy(TERRAIN_COLOR_STOPS[TERRAIN_COLOR_STOPS.length - 1].color);
}

export function getTerrainColorByHeight(height, normalizedHeight, color = new THREE.Color()) {
	if (height < LOWLAND_HEIGHT_THRESHOLD) {
		return color.copy(SAND_COLOR);
	}

	if (height < LOWLAND_BLEND_HEIGHT) {
		const terrainColor = getTerrainColor(normalizedHeight, TEMP_COLOR);
		const blend = smoothstep(LOWLAND_HEIGHT_THRESHOLD, LOWLAND_BLEND_HEIGHT, height);
		return color.copy(SAND_COLOR).lerp(terrainColor, blend);
	}

	return getTerrainColor(normalizedHeight, color);
}