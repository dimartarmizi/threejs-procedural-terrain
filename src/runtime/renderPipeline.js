import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export function createRenderPipeline(scene, camera, renderer, settings) {
	const renderPass = new RenderPass(scene, camera);
	const bloomPass = new UnrealBloomPass(
		new THREE.Vector2(window.innerWidth, window.innerHeight),
		settings.bloomIntensity || 0.4,
		settings.bloomRadius || 0.5,
		settings.bloomThreshold || 0.1
	);
	const outputPass = new OutputPass();

	const composer = new EffectComposer(renderer);
	composer.addPass(renderPass);
	composer.addPass(bloomPass);
	composer.addPass(outputPass);

	return {
		composer,
		renderPass,
		bloomPass,
		outputPass
	};
}

export function resizeRenderPipeline(pipeline, width, height) {
	if (!pipeline || !pipeline.composer) return;
	pipeline.composer.setSize(width, height);
	if (pipeline.bloomPass && pipeline.bloomPass.resolution) {
		pipeline.bloomPass.resolution.set(width, height);
	}
}