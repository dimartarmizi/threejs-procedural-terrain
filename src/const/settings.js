const STORAGE_KEY = 'terrain-settings';

export const defaultSettings = {
	seed: 1,
	tileSize: 128,
	terrainType: '',
	colorMode: 'biome',
	scale: 1000,
	heightMultiplier: 100,
	baseHeight: 30,
	octaves: 5,
	persistence: 0.3,
	lacunarity: 2,
	renderDistance: 8,
	wireframe: false,
	gridHelper: false,
	mode: 'orbit',
	fogEnabled: true,
	fogDistance: 1.3,
	waterEnabled: true,
	postProcessingEnabled: false,
	fxaaEnabled: false,
	bloomStrength: 0.28,
	bloomRadius: 0.35,
	bloomThreshold: 0.82,
	timeOfDay: 9,
	timeEnabled: false,
	timeScale: 0.1,
	season: 'spring',
	cloudEnabled: false,
	cloudCoverage: 0.58,
	cloudDensity: 0.82,
	cloudOpacity: 0.78,
	cloudSpeed: 1.0,
	cloudBaseHeight: 220,
	cloudTopHeight: 760,
};

export const settings = { ...defaultSettings };

export function loadSettingsFromStorage() {
	Object.assign(settings, JSON.parse(localStorage.getItem(STORAGE_KEY)));
}

export function saveSettingsToStorage() {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function resetSettingsToDefault() {
	Object.assign(settings, defaultSettings);
	saveSettingsToStorage();
}

loadSettingsFromStorage();
