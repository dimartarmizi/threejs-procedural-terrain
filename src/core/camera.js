import * as THREE from 'three';

export function createCamera() {
	const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
	camera.position.set(90, 120, 160);
	return camera;
}