import * as THREE from 'three';

export function createGridHelper(settings) {
	const size = 2048;
	const divisions = 64;
	const gridHelper = new THREE.GridHelper(size, divisions, 0x3a4a5a, 0x8da0b3);
	gridHelper.position.y = 0;
	gridHelper.visible = Boolean(settings.gridHelper);
	return gridHelper;
}
