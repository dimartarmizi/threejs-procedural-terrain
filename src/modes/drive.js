import * as THREE from 'three';

export function createDriveMode(camera, scene, terrainSystem) {
	const vehicle = createVehicle();
	scene.add(vehicle);

	const eyeHeight = 2.2;
	const moveSpeed = 50;
	const turnSpeed = 2.2;
	const suspension = 1.1;
	const keys = createKeyState();
	let enabled = false;
	let heading = 0;

	function onKeyDown(event) {
		if (!enabled) {
			return;
		}

		switch (event.code) {
			case 'KeyW':
				keys.forward = true;
				break;
			case 'KeyS':
				keys.backward = true;
				break;
			case 'KeyA':
				keys.left = true;
				break;
			case 'KeyD':
				keys.right = true;
				break;
		}
	}

	function onKeyUp(event) {
		if (!enabled) {
			return;
		}

		switch (event.code) {
			case 'KeyW':
				keys.forward = false;
				break;
			case 'KeyS':
				keys.backward = false;
				break;
			case 'KeyA':
				keys.left = false;
				break;
			case 'KeyD':
				keys.right = false;
				break;
		}
	}

	window.addEventListener('keydown', onKeyDown);
	window.addEventListener('keyup', onKeyUp);

	function setEnabled(nextEnabled) {
		enabled = nextEnabled;
		resetMovement();
		vehicle.visible = enabled;

		if (enabled) {
			placeOnGround();
			updateCamera();
		}
	}

	function update(delta) {
		if (!enabled) {
			return;
		}

		if (keys.left) {
			heading += turnSpeed * delta;
		}

		if (keys.right) {
			heading -= turnSpeed * delta;
		}

		const direction = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
		const distance = moveSpeed * delta;

		if (keys.forward) {
			vehicle.position.addScaledVector(direction, -distance);
		}

		if (keys.backward) {
			vehicle.position.addScaledVector(direction, distance);
		}

		placeOnGround();
		vehicle.rotation.y = heading;
		updateCamera();
	}

	function placeOnGround() {
		const groundHeight = terrainSystem.getHeightAt(vehicle.position.x, vehicle.position.z);
		vehicle.position.y = groundHeight + suspension;
	}

	function updateCamera() {
		const offset = new THREE.Vector3(0, eyeHeight, 0);
		const backOffset = new THREE.Vector3(0, 0.8, 7.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), heading);
		camera.position.copy(vehicle.position).add(offset).add(backOffset);
		camera.lookAt(vehicle.position.x, vehicle.position.y + 1.2, vehicle.position.z);
	}

	function resetMovement() {
		keys.forward = false;
		keys.backward = false;
		keys.left = false;
		keys.right = false;
	}

	function dispose() {
		window.removeEventListener('keydown', onKeyDown);
		window.removeEventListener('keyup', onKeyUp);
		scene.remove(vehicle);
		vehicle.geometry.dispose();
		vehicle.material.dispose();
	}

	return {
		setEnabled,
		update,
		placeOnGround,
		dispose,
		get vehicle() {
			return vehicle;
		},
	};
}

function createVehicle() {
	const geometry = new THREE.BoxGeometry(2.2, 1.2, 4.2);
	const material = new THREE.MeshStandardMaterial({
		color: 0xd61f1f,
		roughness: 0.85,
		metalness: 0.05,
	});
	const mesh = new THREE.Mesh(geometry, material);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	mesh.visible = false;
	return mesh;
}

function createKeyState() {
	return {
		forward: false,
		backward: false,
		left: false,
		right: false,
	};
}
