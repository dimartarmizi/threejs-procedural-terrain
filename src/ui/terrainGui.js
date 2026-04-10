import { GUI } from 'lil-gui';
import { TERRAIN_PRESETS } from '../terrain/presets.js';

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

export function createTerrainGui(settings, handlers) {
	const gui = new GUI({ title: 'Terrain Settings' });
	gui.domElement.classList.add('terrain-gui');

	const terrainFolder = gui.addFolder('Terrain');
	terrainFolder
		.add(settings, 'terrainType', getTerrainPresetOptions())
		.name('preset')
		.onChange((terrainType) => {
			applyTerrainPreset(settings, terrainType);
			handlers.updateTerrain();
		});
	terrainFolder.add(settings, 'seed').onFinishChange(handlers.updateTerrain);
	terrainFolder.add(settings, 'scale', 80, 1000, 1).name('scale').onFinishChange(handlers.updateTerrain).listen();
	terrainFolder.add(settings, 'heightMultiplier', 0, 500, 1).name('height multiplier').onFinishChange(handlers.updateTerrain).listen();
	terrainFolder.add(settings, 'baseHeight', -100, 500, 1).name('base height').onFinishChange(handlers.updateTerrain).listen();
	terrainFolder.add(settings, 'octaves', 1, 8, 1).onFinishChange(handlers.updateTerrain).listen();
	terrainFolder.add(settings, 'persistence', 0.1, 1, 0.01).onFinishChange(handlers.updateTerrain).listen();
	terrainFolder.add(settings, 'lacunarity', 1, 4, 0.01).onFinishChange(handlers.updateTerrain).listen();
	terrainFolder.add(settings, 'renderDistance', 1, 32, 1).onFinishChange(handlers.updateTerrain);
	terrainFolder.add(settings, 'wireframe').onChange(handlers.updateWireframe);
	terrainFolder.add(settings, 'gridHelper').onChange(handlers.updateGridHelper);
	terrainFolder.add(settings, 'mode', ['orbit', 'player', 'drive', 'fly']).onChange(handlers.updateMode);
	terrainFolder.open();

	const fogFolder = gui.addFolder('Fog');
	fogFolder.add(settings, 'fogEnabled').name('enabled').onChange(handlers.updateFog);
	fogFolder.add(settings, 'fogDistance', 0.5, 2.5, 0.01).name('distance').onChange(handlers.updateFog);

	const skyFolder = gui.addFolder('Sky');
	skyFolder.add(settings, 'timeEnabled').name('time on/off').onChange(handlers.updateLight);
	skyFolder.add(settings, 'timeScale', 0, 4, 0.01).name('timeScale').onChange(handlers.updateLight);
	skyFolder.add(settings, 'timeOfDay', 0, 24, 0.1).name('timeOfDay').onChange(handlers.updateLight).listen();
	skyFolder.add(settings, 'season', ['spring', 'summer', 'autumn', 'winter']).name('season').onChange(handlers.updateLight);

	const cloudFolder = gui.addFolder('Clouds');
	cloudFolder.add(settings, 'cloudEnabled').name('enabled').onChange(handlers.updateLight);
	const cloudCoverageController = cloudFolder
		.add(settings, 'cloudCoverage', 0.2, 0.95, 0.01)
		.name('coverage')
		.onChange(handlers.updateLight)
		.listen();
	const cloudDensityController = cloudFolder
		.add(settings, 'cloudDensity', 0.2, 1.5, 0.01)
		.name('density')
		.onChange(handlers.updateLight)
		.listen();
	const cloudOpacityController = cloudFolder
		.add(settings, 'cloudOpacity', 0.2, 1, 0.01)
		.name('opacity')
		.onChange(handlers.updateLight)
		.listen();
	cloudCoverageController.updateDisplay();
	cloudDensityController.updateDisplay();
	cloudOpacityController.updateDisplay();
	cloudFolder.add(settings, 'cloudSpeed', 0, 3, 0.01).name('speed').onChange(handlers.updateLight);
	cloudFolder.add(settings, 'cloudBaseHeight', 80, 1200, 1).name('base height').onChange(handlers.updateLight);
	cloudFolder.add(settings, 'cloudTopHeight', 200, 2000, 1).name('top height').onChange(handlers.updateLight);

	const waterFolder = gui.addFolder('Water');
	waterFolder.add(settings, 'waterEnabled').name('enabled').onChange(handlers.updateWater);

	const postFolder = gui.addFolder('Post Processing');
	postFolder.add(settings, 'postProcessingEnabled').name('enabled').onChange(handlers.updatePostProcessing);
	postFolder.add(settings, 'fxaaEnabled').name('fxaa').onChange(handlers.updatePostProcessing);
	postFolder.add(settings, 'bloomStrength', 0, 2, 0.01).name('bloom strength').onChange(handlers.updatePostProcessing);
	postFolder.add(settings, 'bloomRadius', 0, 1, 0.01).name('bloom radius').onChange(handlers.updatePostProcessing);
	postFolder.add(settings, 'bloomThreshold', 0, 1.5, 0.01).name('bloom threshold').onChange(handlers.updatePostProcessing);

	return gui;
}