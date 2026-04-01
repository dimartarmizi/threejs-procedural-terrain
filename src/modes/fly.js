import * as THREE from 'three';

export function createFlyMode(camera, scene) {
	const vehicle = createVehicle();
	scene.add(vehicle);

	const cameraOffset = new THREE.Vector3(0, 1.8, 8.5);
	const spawnAltitude = 180;
	const maxThrottle = 65;
	const throttleAcceleration = 28;
	const turnSpeed = 1.8;
	const pitchSpeed = 1.4;
	const rollSpeed = 2.2;
	const keys = createKeyState();
	let enabled = false;
	let throttle = 18;
	const direction = new THREE.Vector3();

	function onKeyDown(event) {
		if (!enabled) {
			return;
		}

		switch (event.code) {
			case 'KeyW':
				keys.throttleUp = true;
				break;
			case 'KeyS':
				keys.throttleDown = true;
				break;
			case 'KeyA':
				keys.yawLeft = true;
				break;
			case 'KeyD':
				keys.yawRight = true;
				break;
			case 'ArrowUp':
				keys.pitchUp = true;
				break;
			case 'ArrowDown':
				keys.pitchDown = true;
				break;
			case 'ArrowLeft':
				keys.rollLeft = true;
				break;
			case 'ArrowRight':
				keys.rollRight = true;
				break;
		}
	}

	function onKeyUp(event) {
		if (!enabled) {
			return;
		}

		switch (event.code) {
			case 'KeyW':
				keys.throttleUp = false;
				break;
			case 'KeyS':
				keys.throttleDown = false;
				break;
			case 'KeyA':
				keys.yawLeft = false;
				break;
			case 'KeyD':
				keys.yawRight = false;
				break;
			case 'ArrowUp':
				keys.pitchUp = false;
				break;
			case 'ArrowDown':
				keys.pitchDown = false;
				break;
			case 'ArrowLeft':
				keys.rollLeft = false;
				break;
			case 'ArrowRight':
				keys.rollRight = false;
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
			placeAboveSky();
			updateCamera();
		}
	}

	function update(delta) {
		if (!enabled) {
			return;
		}

		if (keys.throttleUp) {
			throttle = Math.min(maxThrottle, throttle + throttleAcceleration * delta);
		}

		if (keys.throttleDown) {
			throttle = Math.max(0, throttle - throttleAcceleration * delta);
		}

		if (keys.yawLeft) {
			vehicle.rotateY(turnSpeed * delta);
		}

		if (keys.yawRight) {
			vehicle.rotateY(-turnSpeed * delta);
		}

		if (keys.pitchUp) {
			vehicle.rotateX(-pitchSpeed * delta);
		}

		if (keys.pitchDown) {
			vehicle.rotateX(pitchSpeed * delta);
		}

		if (keys.rollLeft) {
			vehicle.rotateZ(rollSpeed * delta);
		}

		if (keys.rollRight) {
			vehicle.rotateZ(-rollSpeed * delta);
		}
		direction.set(0, 0, -1).applyQuaternion(vehicle.quaternion).normalize();
		vehicle.position.addScaledVector(direction, throttle * delta);
		updateCamera();
	}

	function placeAboveSky() {
		vehicle.position.set(0, spawnAltitude, 0);
		throttle = Math.max(throttle, 18);
		vehicle.rotation.set(0, 0, 0);
	}

	function updateCamera() {
		const cameraOffsetVector = cameraOffset.clone().applyQuaternion(vehicle.quaternion);
		camera.position.copy(vehicle.position).add(cameraOffsetVector);
		camera.quaternion.copy(vehicle.quaternion);
		camera.rotateX(-0.08);
	}

	function resetMovement() {
		keys.throttleUp = false;
		keys.throttleDown = false;
		keys.yawLeft = false;
		keys.yawRight = false;
		keys.pitchUp = false;
		keys.pitchDown = false;
		keys.rollLeft = false;
		keys.rollRight = false;
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
		dispose,
		get vehicle() {
			return vehicle;
		},
	};
}

function createVehicle() {
	const geometry = new THREE.BoxGeometry(2.4, 1.1, 4.4);
	const material = new THREE.MeshStandardMaterial({
		color: 0xd61f1f,
		roughness: 0.8,
		metalness: 0.08,
	});
	const mesh = new THREE.Mesh(geometry, material);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	mesh.position.set(0, 180, 0);
	mesh.visible = false;
	return mesh;
}

function createKeyState() {
	return {
		throttleUp: false,
		throttleDown: false,
		yawLeft: false,
		yawRight: false,
		pitchUp: false,
		pitchDown: false,
		rollLeft: false,
		rollRight: false,
	};
}
