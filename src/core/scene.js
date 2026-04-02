import * as THREE from 'three';

export function createScene() {
	const scene = new THREE.Scene();
	scene.fog = new THREE.FogExp2();
	return scene;
}