import * as THREE from 'three';

export function createLighting(scene) {
	const ambientLight = new THREE.AmbientLight();
	scene.add(ambientLight);

	const sun = new THREE.DirectionalLight();
	sun.castShadow = false;
	scene.add(sun);
	scene.add(sun.target);

	return { ambientLight, sun };
}