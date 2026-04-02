import * as THREE from 'three';

export function createLighting(scene) {
	const ambientLight = new THREE.AmbientLight();
	scene.add(ambientLight);

	const sun = new THREE.DirectionalLight();
	sun.castShadow = true;
	sun.shadow.mapSize.set(2048, 2048);
	sun.shadow.camera.left = -48;
	sun.shadow.camera.right = 48;
	sun.shadow.camera.top = 48;
	sun.shadow.camera.bottom = -48;
	sun.shadow.camera.near = 1;
	sun.shadow.camera.far = 960;
	scene.add(sun);
	scene.add(sun.target);

	return { ambientLight, sun };
}