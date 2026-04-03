import * as THREE from 'three';

const TERRAIN_COLOR_STOPS = [
	[0.42, 0xe8e4d7],
	[0.18, 0xa8c46a],
	[-0.02, 0x7ea04f],
	[-0.18, 0x5f8638],
];

export function getTerrainColorHex(normalizedHeight) {
	for (let index = 0; index < TERRAIN_COLOR_STOPS.length; index += 1) {
		const [threshold, hex] = TERRAIN_COLOR_STOPS[index];

		if (normalizedHeight > threshold) {
			return hex;
		}
	}

	return 0x365a3f;
}

export function getTerrainColor(normalizedHeight, color = new THREE.Color()) {
	return color.setHex(getTerrainColorHex(normalizedHeight));
}