import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

export function createPlayerMode(camera, domElement, terrainSystem) {
	const controls = new PointerLockControls(camera, domElement);
	const eyeHeight = 1.72;
	const walkSpeed = 5.5;
	const sprintSpeed = 8.5;
	const keys = createKeyState();
	let enabled = false;

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
			case 'ShiftLeft':
			case 'ShiftRight':
				keys.sprint = true;
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
			case 'ShiftLeft':
			case 'ShiftRight':
				keys.sprint = false;
				break;
		}
	}

	function onClick() {
		if (enabled && !controls.isLocked) {
			controls.lock();
		}
	}

	window.addEventListener('keydown', onKeyDown);
	window.addEventListener('keyup', onKeyUp);
	domElement.addEventListener('click', onClick);

	function setEnabled(nextEnabled) {
		enabled = nextEnabled;
		resetMovement();

		if (enabled) {
			camera.position.x = 0;
			camera.position.z = 0;
			placeOnGround();
			controls.lock();
		} else {
			controls.unlock();
		}
	}

	function update(delta) {
		if (!enabled || !controls.isLocked) {
			return;
		}

		const speed = keys.sprint ? sprintSpeed : walkSpeed;
		const distance = speed * delta;

		if (keys.forward) {
			controls.moveForward(distance);
		}

		if (keys.backward) {
			controls.moveForward(-distance);
		}

		if (keys.left) {
			controls.moveRight(-distance);
		}

		if (keys.right) {
			controls.moveRight(distance);
		}

		placeOnGround();
	}

	function placeOnGround() {
		const groundHeight = terrainSystem.getHeightAt(camera.position.x, camera.position.z);
		camera.position.y = groundHeight + eyeHeight;
	}

	function resetMovement() {
		keys.forward = false;
		keys.backward = false;
		keys.left = false;
		keys.right = false;
		keys.sprint = false;
	}

	function dispose() {
		window.removeEventListener('keydown', onKeyDown);
		window.removeEventListener('keyup', onKeyUp);
		domElement.removeEventListener('click', onClick);
		controls.unlock();
	}

	return {
		setEnabled,
		update,
		placeOnGround,
		getEyeHeight() {
			return eyeHeight;
		},
		dispose,
		get controls() {
			return controls;
		},
	};
}

function createKeyState() {
	return {
		forward: false,
		backward: false,
		left: false,
		right: false,
		sprint: false,
	};
}
