import { GUI } from 'lil-gui';
import { TERRAIN_PRESETS } from '../terrain/presets.js';
import { resetSettingsToDefault, saveSettingsToStorage } from '../const/settings.js';

function applyTerrainPreset(settings, terrainType) {
	const preset = TERRAIN_PRESETS[terrainType];
	settings.terrainType = preset ? terrainType : '';

	if (preset) {
		Object.assign(settings, preset);
	}
}

function getTerrainPresetOptions() {
	return Object.keys(TERRAIN_PRESETS).reduce((options, terrainType) => {
		options[terrainType] = terrainType;
		return options;
	}, { none: '' });
}

function toTitleCase(text) {
	return text
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/[_-]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function createTerrainGui(settings, handlers) {
	const gui = new GUI({ title: 'Terrain Settings' });
	gui.domElement.classList.add('terrain-gui');
	const sync = (handler, value) => {
		handler(value);
		saveSettingsToStorage();
	};

	function addControl(folder, cfg) {
		const c =
			cfg.options !== undefined
				? folder.add(settings, cfg.key, cfg.options)
				: cfg.min !== undefined
					? folder.add(settings, cfg.key, cfg.min, cfg.max, cfg.step)
					: folder.add(settings, cfg.key);
		c.name(toTitleCase(cfg.name || cfg.key));
		if (cfg.listen) c.listen();
		c[cfg.useFinish ? 'onFinishChange' : 'onChange']((value) => sync(cfg.handler, value));
		return c;
	}

	const addMany = (folder, list) => list.forEach((cfg) => addControl(folder, cfg));
	const refreshAll = () => {
		handlers.updateTerrain();
		handlers.updateFog();
		handlers.updateLight();
		handlers.updateWater();
		handlers.updatePostProcessing();
		handlers.updateWireframe();
		handlers.updateGridHelper();
		handlers.updateMode();
	};

	function resetToDefaults() {
		resetSettingsToDefault();
		refreshAll();
		gui.controllersRecursive().forEach((controller) => controller.updateDisplay());
	}

	gui.add({ resetDefault: resetToDefaults }, 'resetDefault').name('Reset Default');

	const folders = [
		{
			name: 'Terrain',
			open: true,
			controls: [
				{
					key: 'terrainType',
					name: 'preset',
					options: getTerrainPresetOptions(),
					handler: (terrainType) => {
						applyTerrainPreset(settings, terrainType);
						handlers.updateTerrain();
					},
				},
				{ key: 'seed', handler: handlers.updateTerrain, useFinish: true },
				{ key: 'scale', min: 80, max: 1000, step: 1, name: 'scale', listen: true, handler: handlers.updateTerrain, useFinish: true },
				{ key: 'heightMultiplier', min: 0, max: 500, step: 1, name: 'height multiplier', listen: true, handler: handlers.updateTerrain, useFinish: true },
				{ key: 'baseHeight', min: -100, max: 500, step: 1, name: 'base height', listen: true, handler: handlers.updateTerrain, useFinish: true },
				{ key: 'octaves', min: 1, max: 8, step: 1, listen: true, handler: handlers.updateTerrain, useFinish: true },
				{ key: 'persistence', min: 0.1, max: 1, step: 0.01, listen: true, handler: handlers.updateTerrain, useFinish: true },
				{ key: 'lacunarity', min: 1, max: 4, step: 0.01, listen: true, handler: handlers.updateTerrain, useFinish: true },
				{ key: 'renderDistance', min: 1, max: 32, step: 1, handler: handlers.updateTerrain, useFinish: true },
				{ key: 'wireframe', handler: handlers.updateWireframe },
				{ key: 'gridHelper', handler: handlers.updateGridHelper },
				{ key: 'mode', options: ['orbit', 'player', 'drive', 'fly'], handler: handlers.updateMode },
			],
		},
		{
			name: 'Fog',
			controls: [
				{ key: 'fogEnabled', name: 'enabled', handler: handlers.updateFog },
				{ key: 'fogDistance', min: 0.5, max: 2.5, step: 0.01, name: 'distance', handler: handlers.updateFog },
			],
		},
		{
			name: 'Sky',
			controls: [
				{ key: 'timeEnabled', name: 'time on/off', handler: handlers.updateLight },
				{ key: 'timeScale', min: 0, max: 4, step: 0.01, name: 'timeScale', handler: handlers.updateLight },
				{ key: 'timeOfDay', min: 0, max: 24, step: 0.1, name: 'timeOfDay', listen: true, handler: handlers.updateLight },
				{ key: 'season', options: ['spring', 'summer', 'autumn', 'winter'], name: 'season', handler: handlers.updateLight },
			],
		},
		{
			name: 'Clouds',
			controls: [
				{ key: 'cloudEnabled', name: 'enabled', handler: handlers.updateLight },
				{ key: 'cloudCoverage', min: 0.2, max: 0.95, step: 0.01, name: 'coverage', listen: true, handler: handlers.updateLight },
				{ key: 'cloudDensity', min: 0.2, max: 1.5, step: 0.01, name: 'density', listen: true, handler: handlers.updateLight },
				{ key: 'cloudOpacity', min: 0.2, max: 1, step: 0.01, name: 'opacity', listen: true, handler: handlers.updateLight },
				{ key: 'cloudSpeed', min: 0, max: 3, step: 0.01, name: 'speed', handler: handlers.updateLight },
				{ key: 'cloudBaseHeight', min: 80, max: 1200, step: 1, name: 'base height', handler: handlers.updateLight },
				{ key: 'cloudTopHeight', min: 200, max: 2000, step: 1, name: 'top height', handler: handlers.updateLight },
			],
		},
		{
			name: 'Water',
			controls: [{ key: 'waterEnabled', name: 'enabled', handler: handlers.updateWater }],
		},
		{
			name: 'Post Processing',
			controls: [
				{ key: 'postProcessingEnabled', name: 'enabled', handler: handlers.updatePostProcessing },
				{ key: 'fxaaEnabled', name: 'fxaa', handler: handlers.updatePostProcessing },
				{ key: 'bloomStrength', min: 0, max: 2, step: 0.01, name: 'bloom strength', handler: handlers.updatePostProcessing },
				{ key: 'bloomRadius', min: 0, max: 1, step: 0.01, name: 'bloom radius', handler: handlers.updatePostProcessing },
				{ key: 'bloomThreshold', min: 0, max: 1.5, step: 0.01, name: 'bloom threshold', handler: handlers.updatePostProcessing },
			],
		},
	];

	folders.forEach((cfg) => {
		const folder = gui.addFolder(cfg.name);
		addMany(folder, cfg.controls);
		if (cfg.open) folder.open();
	});

	return gui;
}