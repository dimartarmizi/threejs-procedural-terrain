import * as THREE from 'three';

export function createRenderer(canvasHost) {
	const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.autoClear = false;
	renderer.shadowMap.enabled = false;
	renderer.domElement.tabIndex = 0;
	canvasHost.appendChild(renderer.domElement);

	return renderer;
}
