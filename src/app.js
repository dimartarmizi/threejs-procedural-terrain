import './styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createCamera } from './core/camera.js';
import { createLighting } from './core/lighting.js';
import { createGridHelper } from './core/gridHelper.js';
import { createRenderer } from './core/renderer.js';
import { createScene } from './core/scene.js';
import { createInfoOverlay } from './ui/infoOverlay.js';
import { createTerrainGui } from './ui/terrainGui.js';
import { createTerrainSystem } from './systems/terrainSystem.js';
import { settings } from './const/settings.js';

export function startApp() {
	const app = document.querySelector('#app');
	const scene = createScene();
	const camera = createCamera();
	const renderer = createRenderer(app);
	const controls = new OrbitControls(camera, renderer.domElement);
	const lights = createLighting(scene);
	const gridHelper = createGridHelper(settings);
	scene.add(gridHelper);
	const terrainSystem = createTerrainSystem(scene, settings);
	const infoOverlay = createInfoOverlay(app);
	const clock = new THREE.Clock();
	let elapsedTime = 0;
	let frameCount = 0;
	let workTime = 0;
	let fps = 0;
	let cpuUsage = 0;

	controls.target.set(0, 20, 0);
	controls.enableDamping = true;

	createTerrainGui(settings, {
		updateTerrain() {
			terrainSystem.applyTerrainSettings(settings);
			camera.far = terrainSystem.getCameraFar();
			camera.updateProjectionMatrix();
			terrainSystem.update(camera.position);
		},
		updateAtmosphere() {
			scene.fog.density = settings.fogDensity;
		},
		updateLight() {
			lights.sun.intensity = settings.sunIntensity;
			lights.ambientLight.intensity = settings.ambientIntensity;
		},
		updateWireframe() {
			terrainSystem.setWireframe(settings.wireframe);
		},
		updateGridHelper() {
			gridHelper.visible = settings.gridHelper;
		},
	});

	camera.far = terrainSystem.getCameraFar();
	camera.updateProjectionMatrix();
	scene.fog.density = settings.fogDensity;
	terrainSystem.setWireframe(settings.wireframe);
	gridHelper.visible = settings.gridHelper;
	infoOverlay.update({
		fps: 0,
		cpuUsage: 0,
		memoryText: getMemoryText(),
	});

	window.addEventListener('resize', onResize);

	function onResize() {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(window.innerWidth, window.innerHeight);
	}

	function animate() {
		requestAnimationFrame(animate);
		const delta = clock.getDelta();
		const workStart = performance.now();
		controls.update();
		terrainSystem.update(camera.position);
		renderer.render(scene, camera);
		workTime += performance.now() - workStart;
		frameCount += 1;
		elapsedTime += delta;

		if (elapsedTime >= 1) {
			fps = Math.round(frameCount / elapsedTime);
			cpuUsage = Math.min(100, (workTime / (elapsedTime * 1000)) * 100);
			infoOverlay.update({
				fps: fps,
				cpuUsage: cpuUsage,
				memoryText: getMemoryText(),
			});
			elapsedTime = 0;
			frameCount = 0;
			workTime = 0;
		}
	}

	onResize();
	animate();
}

function getMemoryText() {
	if (performance.memory) {
		const used = performance.memory.usedJSHeapSize / 1048576;
		const limit = performance.memory.jsHeapSizeLimit / 1048576;
		return used.toFixed(1) + ' / ' + limit.toFixed(0) + ' MB';
	}

	return 'n/a';
}