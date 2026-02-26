import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class CameraController {
	constructor(camera, rendererDomElement, player, world, settings) {
		this.camera = camera;
		this.dom = rendererDomElement;
		this.player = player;
		this.world = world;
		this.settings = settings;

		this.controls = new OrbitControls(this.camera, this.dom);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.05;
		this.controls.screenSpacePanning = false;
		this.controls.enablePan = true;
		this.controls.enableZoom = true;
		this.controls.mouseButtons = {
			LEFT: THREE.MOUSE.ROTATE,
			MIDDLE: THREE.MOUSE.DOLLY,
			RIGHT: THREE.MOUSE.PAN
		};

		this.initialOrbitPosition = this.camera.position.clone();
		this.savedOrbitY = this.camera.position.y;
	}

	setInitialOrbit(position) {
		if (position && position.isVector3) this.initialOrbitPosition.copy(position);
		this.savedOrbitY = this.initialOrbitPosition.y;
		this.camera.position.copy(this.initialOrbitPosition);
		this.controls.target.set(0, 0, 0);
		this.controls.update();
		this.controls.saveState();
	}

	switchToFirstPerson() {
		this.controls.enabled = false;
		if (this.player) {
			this.player.enabled = true;
			if (this.world && this.world.chunkManager && this.world.chunkManager.heightGenerator) {
				const hx = this.camera.position.x;
				const hz = this.camera.position.z;
				const terrainHeight = this.world.chunkManager.heightGenerator.getHeight(hx, hz);
				const playerHeight = (this.player.height !== undefined) ? this.player.height : 1.8;
				this.camera.position.y = terrainHeight + playerHeight;
			}

			try {
				if (this.player.controls && this.player.controls.getObject) {
					const obj = this.player.controls.getObject();
					obj.rotation.x = 0;
					obj.rotation.z = 0;
				}
				this.camera.rotation.x = 0;
				this.camera.rotation.z = 0;
			} catch (e) {
			}
		}
	}

	switchToOrbit() {
		if (this.player) {
			this.player.enabled = false;
			try { this.player.controls.unlock(); } catch (e) { }
		}

		try {
			this.controls.reset();
		} catch (e) {
			const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
			this.camera.position.y = this.savedOrbitY;
			this.controls.target.copy(this.camera.position).add(dir.multiplyScalar(10));
		}

		this.controls.enabled = true;
		this.controls.update();
	}

	updateSavedOrbitHeight() {
		this.savedOrbitY = this.camera.position.y;
	}
}
