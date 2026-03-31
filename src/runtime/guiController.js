import GUI from 'lil-gui';
import { eventBus } from '../core/eventBus.js';

export function createEngineGui(engine) {
	const gui = new GUI();
	engine.gui = gui;

	const resetAction = () => {
		if (confirm('Reset all settings to default and reload?')) {
			engine.resetSettings();
		}
	};
	gui.add({ reset: resetAction }, 'reset').name('Reset Defaults');

	const worldFolder = gui.addFolder('World');
	worldFolder.add(engine.settings, 'renderDistance', 1, 10, 1).name('Render Distance').onFinishChange(() => {
		engine.saveSettings();
		eventBus.emit('settingsChanged', engine.settings);
	});
	worldFolder.add(engine.settings, 'chunkSize', 32, 256, 1).name('Chunk Size').onFinishChange(() => {
		engine.saveSettings();
		eventBus.emit('settingsChanged', engine.settings);
	});
	worldFolder.add(engine.settings, 'seed').name('Seed').onFinishChange(() => {
		engine.saveSettings();
		eventBus.emit('settingsChanged', engine.settings);
	});
	worldFolder.add(engine.settings, 'firstPerson').name('First Person Mode').onChange((value) => {
		engine.settings.firstPerson = value;
		engine.updateControlState();
		engine.saveSettings();
	});
	worldFolder.add(engine.settings, 'noiseIntensity', 0, 0.1, 0.001).name('Noise Intensity').onFinishChange(() => {
		engine.saveSettings();
		eventBus.emit('settingsChanged', engine.settings);
	});
	worldFolder.add(engine.settings, 'noiseScale', 0.001, 0.1, 0.001).name('Noise Scale').onFinishChange(() => {
		engine.saveSettings();
		eventBus.emit('settingsChanged', engine.settings);
	});
	worldFolder.add(engine.settings, 'noiseEnabled').name('Enable Noise').onChange((value) => {
		engine.settings.noiseEnabled = !!value;
		engine.saveSettings();
		eventBus.emit('settingsChanged', engine.settings);
	});

	const envFolder = gui.addFolder('Environment');
	envFolder.add(engine.settings, 'useRealTime').name('Real-time sync').onChange((value) => {
		engine.settings.useRealTime = value;
		if (engine.world) engine.world.timeSystem.useRealTime = value;
		engine.saveSettings();
	});
	envFolder.add(engine.settings, 'time', 0, 24, 0.01).name('Set Time (0-24)').onChange((value) => {
		engine.settings.time = value;
		if (engine.world && !engine.settings.useRealTime) {
			engine.world.timeSystem.setTime(value);
		}
		engine.saveSettings();
	}).listen();
	envFolder.add(engine.settings, 'timeScale', 0, 10).name('Time Scale').onChange((value) => {
		engine.settings.timeScale = value;
		if (engine.world) engine.world.timeSystem.timeScale = value;
		engine.saveSettings();
	});
	envFolder.add(engine.settings, 'fogDensity', 0, 0.002).name('Fog Density').onChange((value) => {
		engine.settings.fogDensity = value;
		engine.scene.fog.density = value;
		engine.saveSettings();
	});
	envFolder.add(engine.settings, 'weather', {
		'Clear': 'clear',
		'Cloudy': 'cloudy',
		'Rain': 'rain',
		'Storm': 'storm',
		'Snow': 'snow',
		'Foggy': 'foggy'
	}).name('Weather').onChange((value) => {
		engine.settings.weather = value;
		engine.saveSettings();
		eventBus.emit('settingsChanged', engine.settings);
	});

	const lightFolder = gui.addFolder('Lighting');
	lightFolder.add(engine.settings, 'ambientIntensity', 0, 2).name('Ambient').onChange((value) => {
		engine.settings.ambientIntensity = value;
		if (engine.world && engine.world.ambientLight) engine.world.ambientLight.intensity = value;
		engine.saveSettings();
	});
	lightFolder.add(engine.settings, 'sunIntensity', 0, 5).name('Sun Intensity').onChange((value) => {
		engine.settings.sunIntensity = value;
		if (engine.world && engine.world.sunLight) engine.world.sunLight.intensity = value;
		engine.saveSettings();
	});
	lightFolder.addColor(engine.settings, 'sunColor').name('Sun Color').onChange((value) => {
		engine.settings.sunColor = value;
		if (engine.world && engine.world.sunLight) engine.world.sunLight.color.set(value);
		engine.saveSettings();
	});
	lightFolder.add(engine.settings, 'shadows').name('Enable Shadows').onChange((value) => {
		engine.settings.shadows = value;
		if (engine.world && engine.world.sunLight) {
			engine.world.sunLight.castShadow = value;
		}
		engine.saveSettings();
	});

	const terrainFolder = gui.addFolder('Terrain Detail');
	terrainFolder.add(engine.settings, 'terrainHeight', 0.1, 3.0).name('Height Mult').onFinishChange(() => {
		engine.saveSettings();
		eventBus.emit('settingsChanged', engine.settings);
	});
	terrainFolder.add(engine.settings, 'terrainScale', 0.1, 5.0).name('Noise Scale').onFinishChange(() => {
		engine.saveSettings();
		eventBus.emit('settingsChanged', engine.settings);
	});
	terrainFolder.add(engine.settings, 'treeDensity', 0, 200, 1).name('Tree Density').onFinishChange(() => {
		engine.saveSettings();
		eventBus.emit('settingsChanged', engine.settings);
	});
	terrainFolder.add(engine.settings, 'chunkResolution', 8, 256, 1).name('Chunk Resolution').onFinishChange(() => {
		engine.saveSettings();
		eventBus.emit('settingsChanged', engine.settings);
	});

	const waterFolder = gui.addFolder('Water');
	waterFolder.add(engine.settings, 'waterHeight', 0, 20).name('Height').onChange((value) => {
		engine.settings.waterHeight = value;
		if (engine.world && engine.world.waterSystem) engine.world.waterSystem.setHeight(value);
		engine.saveSettings();
	});

	const postFolder = gui.addFolder('Post-Processing');
	postFolder.add(engine.settings, 'postProcessing').name('Enable Post-Processing').onChange((value) => {
		engine.settings.postProcessing = !!value;
		engine.saveSettings();
	});
	postFolder.add(engine.settings, 'bloomIntensity', 0, 3).name('Bloom Intensity').onChange((value) => {
		engine.settings.bloomIntensity = value;
		if (engine.bloomPass) engine.bloomPass.strength = value;
		engine.saveSettings();
	});
	postFolder.add(engine.settings, 'bloomThreshold', 0, 1).name('Bloom Threshold').onChange((value) => {
		engine.settings.bloomThreshold = value;
		if (engine.bloomPass) engine.bloomPass.threshold = value;
		engine.saveSettings();
	});
	postFolder.add(engine.settings, 'bloomRadius', 0, 1).name('Bloom Radius').onChange((value) => {
		engine.settings.bloomRadius = value;
		if (engine.bloomPass) engine.bloomPass.radius = value;
		engine.saveSettings();
	});

	const skyFolder = gui.addFolder('Sky & Clouds');
	skyFolder.add(engine.settings, 'cloudIntensity', 0, 1).name('Cloud Density').onChange((value) => {
		if (engine.world && engine.world.skySystem) engine.world.skySystem.sky.material.uniforms.cloudIntensity.value = value;
		engine.saveSettings();
	});
	skyFolder.add(engine.settings, 'cloudScale', 0.0001, 0.002).name('Cloud Scale').onChange((value) => {
		if (engine.world && engine.world.skySystem) engine.world.skySystem.sky.material.uniforms.cloudScale.value = value;
		engine.saveSettings();
	});
	skyFolder.add(engine.settings, 'cloudCoverage', 0, 1).name('Cloud Coverage').onChange((value) => {
		engine.settings.cloudCoverage = value;
		if (engine.world && engine.world.skySystem) engine.world.skySystem.sky.material.uniforms.cloudCoverage.value = value;
		engine.saveSettings();
	});
	skyFolder.add(engine.settings, 'cloudBase', 0, 1000).name('Cloud Base').onChange((value) => {
		engine.settings.cloudBase = value;
		if (engine.world && engine.world.skySystem) engine.world.skySystem.sky.material.uniforms.cloudBase.value = value;
	});
	skyFolder.add(engine.settings, 'cloudThickness', 1, 500).name('Cloud Thickness').onChange((value) => {
		engine.settings.cloudThickness = value;
		if (engine.world && engine.world.skySystem) engine.world.skySystem.sky.material.uniforms.cloudThickness.value = value;
	});

	return gui;
}