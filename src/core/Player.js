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

		this.sprinting = false;
		this.sprintMultiplier = 1.35;

		this.baseFov = (camera && camera.fov) ? camera.fov : 75;
		this.sprintFov = this.baseFov + 6;
		this.fovSmooth = 8.0;

		this.bobTime = 0;
		this.bobAmplitudeWalk = 0.0025;
		this.bobAmplitudeSprint = 0.009;
		this.bobFrequencyWalk = 6.5;
		this.bobFrequencySprint = 8.0;
		this.rollAmplitudeWalk = 0.0015;
		this.rollAmplitudeSprint = 0.0025;
		this.pitchAmplitudeWalk = 0.001;
		this.pitchAmplitudeSprint = 0.002;
		this._lastBobRoll = 0;
		this._lastBobPitch = 0;

		this.height = 1.8;
		this.speed = 120.0;
		this.jumpForce = 18.0;

		this.maxSlopeAngle = 60;

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
				case 'ShiftLeft':
				case 'ShiftRight':
					this.sprinting = true;
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
				case 'ShiftLeft':
				case 'ShiftRight':
					this.sprinting = false;
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

		const currentSpeed = this.speed * (this.sprinting ? this.sprintMultiplier : 1.0);
		if (this.moveForward || this.moveBackward) this.velocity.z -= this.direction.z * currentSpeed * deltaTime;
		if (this.moveLeft || this.moveRight) this.velocity.x -= this.direction.x * currentSpeed * deltaTime;

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
			const hg = this.world.chunkManager.heightGenerator;
			let terrainHeight = hg.getHeight(this.camera.position.x, this.camera.position.z);
			const oldTerrainHeight = hg.getHeight(oldX, oldZ);

			const dx = this.camera.position.x - oldX;
			const dz = this.camera.position.z - oldZ;
			const horiz = Math.sqrt(dx * dx + dz * dz) || 1e-6;
			const deltaH = terrainHeight - oldTerrainHeight;
			const slopeRad = Math.atan2(deltaH, horiz);
			const maxSlopeRad = THREE.MathUtils.degToRad(this.maxSlopeAngle || 60);

			if (slopeRad > maxSlopeRad) {
				this.camera.position.x = oldX;
				this.camera.position.z = oldZ;
				this.velocity.x = 0;
				this.velocity.z = 0;
				terrainHeight = oldTerrainHeight;
			}

			if (this.camera.position.y < terrainHeight + this.height) {
				this.velocity.y = 0;
				this.camera.position.y = terrainHeight + this.height;
				this.canJump = true;
			}

			const baseY = this.camera.position.y;
			const isMoving = this.moveForward || this.moveBackward || this.moveLeft || this.moveRight;
			const movementFactor = this.direction.length();
			const freq = this.sprinting ? this.bobFrequencySprint : this.bobFrequencyWalk;
			const amp = this.sprinting ? this.bobAmplitudeSprint : this.bobAmplitudeWalk;
			const rollAmp = this.sprinting ? this.rollAmplitudeSprint : this.rollAmplitudeWalk;
			const pitchAmp = this.sprinting ? this.pitchAmplitudeSprint : this.pitchAmplitudeWalk;

			if (isMoving && this.canJump) {
				this.bobTime += deltaTime * freq * (movementFactor || 1.0);
			} else {
				this.bobTime += deltaTime * (freq * 0.5);
			}

			const moveLerp = isMoving ? 1.0 : Math.max(0, 1.0 - deltaTime * 8.0);
			const verticalBob = Math.sin(this.bobTime) * amp * moveLerp;

			this.camera.position.y = baseY + (this.canJump ? verticalBob : 0);

			this.camera.rotation.z -= this._lastBobRoll;
			this.camera.rotation.x -= this._lastBobPitch;

			const roll = Math.sin(this.bobTime) * rollAmp * movementFactor * moveLerp;
			const pitch = Math.cos(this.bobTime * 2.0) * pitchAmp * movementFactor * moveLerp;

			this.camera.rotation.z += roll;
			this.camera.rotation.x += pitch;

			this._lastBobRoll = roll;
			this._lastBobPitch = pitch;
		}
		const targetFov = this.sprinting ? this.sprintFov : this.baseFov;
		const fovT = 1 - Math.exp(-this.fovSmooth * deltaTime);
		this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, fovT);
		this.camera.updateProjectionMatrix();
	}
}
