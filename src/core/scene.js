import * as THREE from 'three';

export function createScene() {
	const scene = new THREE.Scene();
	scene.background = new THREE.Color(0x87b7ff);
	scene.fog = new THREE.FogExp2(0x87b7ff, 0.0022);
	return scene;
}