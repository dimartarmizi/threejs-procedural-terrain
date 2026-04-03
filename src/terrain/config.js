import { settings } from '../const/settings.js';

export const TERRAIN_DEFAULTS = {
	tileSize: settings.tileSize,
	scale: settings.scale,
	heightMultiplier: settings.heightMultiplier,
	baseHeight: settings.baseHeight,
	octaves: settings.octaves,
	persistence: settings.persistence,
	lacunarity: settings.lacunarity,
	seed: settings.seed,
};

export function getTerrainOptions(options = {}) {
	return { ...TERRAIN_DEFAULTS, ...options };
}