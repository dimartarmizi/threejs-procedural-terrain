import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

export class Player {
	constructor(camera, domElement, world) {
		this.camera = camera;
		this.world = world;
		this.controls = new PointerLockControls(camera, domElement);
		this._enabled = false;

		this.velocity = new THREE.Vector3();
		this.direction = new THREE.Vector3();

		this.moveForward = false;
		this.moveBackward = false;
		this.moveLeft = false;
		this.moveRight = false;
		this.canJump = false;

		this.height = 1.8;
		this.speed = 120.0;
		this.jumpForce = 18.0;

		this.initEventListeners();
	}

	initEventListeners() {
		const onKeyDown = (event) => {
			switch (event.code) {
				case 'ArrowUp':
				case 'KeyW':
					this.moveForward = true;
					break;
				case 'ArrowLeft':
				case 'KeyA':
					this.moveLeft = true;
					break;
				case 'ArrowDown':
				case 'KeyS':
					this.moveBackward = true;
					break;
				case 'ArrowRight':
				case 'KeyD':
					this.moveRight = true;
					break;
				case 'Space':
					if (this.canJump === true) this.velocity.y += this.jumpForce;
					this.canJump = false;
					break;
			}
		};

		const onKeyUp = (event) => {
			switch (event.code) {
				case 'ArrowUp':
				case 'KeyW':
					this.moveForward = false;
					break;
				case 'ArrowLeft':
				case 'KeyA':
					this.moveLeft = false;
					break;
				case 'ArrowDown':
				case 'KeyS':
					this.moveBackward = false;
					break;
				case 'ArrowRight':
				case 'KeyD':
					this.moveRight = false;
					break;
			}
		};

		document.addEventListener('keydown', onKeyDown);
		document.addEventListener('keyup', onKeyUp);

		this.controls.domElement.addEventListener('click', () => {
			if (this.enabled) {
				this.controls.lock();
			}
		});

		this.controls.addEventListener('lock', () => {
			const el = document.getElementById('fps-instruction');
			if (el) el.style.display = 'none';
		});

		this.controls.addEventListener('unlock', () => {
			if (this.enabled) {
				const el = document.getElementById('fps-instruction');
				if (el) el.style.display = 'block';
			}
		});
	}

	get enabled() {
		return this._enabled;
	}

	set enabled(value) {
		this._enabled = value;
		if (!value) {
			this.controls.unlock();
		}
	}

	update(deltaTime) {
		if (!this.controls.isLocked || !this.enabled) return;

		const damping = Math.max(0, 1.0 - deltaTime * 8.0);
		this.velocity.x *= damping;
		this.velocity.z *= damping;
		this.velocity.y -= 9.8 * 5.0 * deltaTime;

		this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
		this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
		this.direction.normalize();

		if (this.moveForward || this.moveBackward) this.velocity.z -= this.direction.z * this.speed * deltaTime;
		if (this.moveLeft || this.moveRight) this.velocity.x -= this.direction.x * this.speed * deltaTime;

		const oldX = this.camera.position.x;
		const oldZ = this.camera.position.z;

		this.controls.moveRight(-this.velocity.x * deltaTime);
		this.controls.moveForward(-this.velocity.z * deltaTime);

		if (this.world && this.world.chunkManager && this.world.chunkManager.vegetation) {
			if (this.world.chunkManager.vegetation.checkCollision(this.camera.position.x, this.camera.position.z, 0.5)) {
				this.camera.position.x = oldX;
				this.camera.position.z = oldZ;

				this.velocity.x = 0;
				this.velocity.z = 0;
			}
		}

		this.camera.position.y += this.velocity.y * deltaTime;

		if (this.world && this.world.chunkManager && this.world.chunkManager.heightGenerator) {
			const terrainHeight = this.world.chunkManager.heightGenerator.getHeight(
				this.camera.position.x,
				this.camera.position.z
			);

			if (this.camera.position.y < terrainHeight + this.height) {
				this.velocity.y = 0;
				this.camera.position.y = terrainHeight + this.height;
				this.canJump = true;
			}
		}
	}
}
