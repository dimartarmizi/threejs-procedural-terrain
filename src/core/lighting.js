import * as THREE from 'three';

export function createLighting(scene) {
	const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
	scene.add(ambientLight);

	const sun = new THREE.DirectionalLight(0xfff4d6, 1.4);
	sun.position.set(-120, 200, 80);
	sun.castShadow = true;
	sun.shadow.mapSize.set(2048, 2048);
	sun.shadow.camera.left = -250;
	sun.shadow.camera.right = 250;
	sun.shadow.camera.top = 250;
	sun.shadow.camera.bottom = -250;
	sun.shadow.camera.near = 1;
	sun.shadow.camera.far = 500;
	scene.add(sun);

	return { ambientLight, sun };
}