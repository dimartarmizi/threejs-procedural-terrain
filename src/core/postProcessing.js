import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

export function createPostProcessing(renderer, skyScene, scene, camera, settings) {
	const size = new THREE.Vector2(window.innerWidth, window.innerHeight);
	const composer = new EffectComposer(renderer);

	const skyPass = new RenderPass(skyScene, camera);
	skyPass.clear = true;
	composer.addPass(skyPass);

	const scenePass = new RenderPass(scene, camera);
	scenePass.clear = false;
	scenePass.clearDepth = true;
	composer.addPass(scenePass);

	const bloomPass = new UnrealBloomPass(size.clone(), settings.bloomStrength, settings.bloomRadius, settings.bloomThreshold);
	composer.addPass(bloomPass);

	const fxaaPass = new ShaderPass(FXAAShader);
	composer.addPass(fxaaPass);

	const outputPass = new OutputPass();
	composer.addPass(outputPass);

	function updateSettings() {
		bloomPass.enabled = settings.postProcessingEnabled;
		bloomPass.strength = settings.bloomStrength;
		bloomPass.radius = settings.bloomRadius;
		bloomPass.threshold = settings.bloomThreshold;
		fxaaPass.enabled = settings.postProcessingEnabled && settings.fxaaEnabled;
	}

	function resize(width, height) {
		composer.setSize(width, height);
		const pixelRatio = renderer.getPixelRatio();
		fxaaPass.material.uniforms.resolution.value.set(
			1 / (width * pixelRatio),
			1 / (height * pixelRatio)
		);
	}

	function render() {
		if (!settings.postProcessingEnabled) {
			renderer.clear();
			renderer.render(skyScene, camera);
			renderer.clearDepth();
			renderer.render(scene, camera);
			return;
		}

		composer.render();
	}

	updateSettings();
	resize(window.innerWidth, window.innerHeight);

	return {
		render,
		resize,
		updateSettings,
	};
}