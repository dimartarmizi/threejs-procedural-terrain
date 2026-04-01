import * as THREE from 'three';

export function createRenderer(canvasHost) {
	const renderer = new THREE.WebGLRenderer();
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.domElement.tabIndex = 0;
	canvasHost.appendChild(renderer.domElement);

	return renderer;
}
