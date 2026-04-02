import * as THREE from 'three';
import alea from 'alea';

const DAY_SKY = new THREE.Color(0x87b7ff);
const DAY_HORIZON = new THREE.Color(0xbfdfff);
const NIGHT_SKY = new THREE.Color(0x050816);
const NIGHT_HORIZON = new THREE.Color(0x0d1630);
const DAY_FOG = new THREE.Color(0xa6ccf0);
const NIGHT_FOG = new THREE.Color(0x050814);
const DAY_SUN = new THREE.Color(0xfff0c2);
const NIGHT_LIGHT = new THREE.Color(0x8aa4ff);
const STAR_COLOR = new THREE.Color(0xffffff);
const SUN_INTENSITY = 1.4;
const AMBIENT_INTENSITY = 0.65;
const TOKYO_LATITUDE = THREE.MathUtils.degToRad(35.6762);
const SEASON_DECLINATION = {
	spring: 0,
	summer: THREE.MathUtils.degToRad(23.44),
	autumn: 0,
	winter: THREE.MathUtils.degToRad(-23.44),
};

export function createSky(seed = 1) {
	const skyScene = new THREE.Scene();
	const sky = createSkyRig(seed);
	skyScene.add(sky.skyGroup);
	const solarState = createSolarState();

	return {
		update(cameraPosition, settings, lights) {
			computeSolarState(solarState, settings.timeOfDay, settings.season);
			updateSkyRig(sky, cameraPosition, solarState);
			const horizonColor = updateSkyAppearance(sky, solarState);
			updateSkyLighting(lights, sky, cameraPosition, sky.sunRoot.position, solarState, horizonColor);
		},
		render(renderer, camera) {
			renderer.render(skyScene, camera);
		},
		fogColor: sky.fogColor,
	};
}

function createSkyRig(seed) {
	const skyGroup = new THREE.Group();
	skyGroup.renderOrder = -1000;

	const sunDirection = new THREE.Vector3();
	const sunPosition = new THREE.Vector3();
	const poleAxis = new THREE.Vector3(0, Math.sin(TOKYO_LATITUDE), -Math.cos(TOKYO_LATITUDE)).normalize();
	const skyColor = new THREE.Color();
	const horizonColor = new THREE.Color();
	const fogColor = new THREE.Color();
	const sunLightColor = new THREE.Color();
	const ambientLightColor = new THREE.Color();

	const dome = createSkyDome();
	skyGroup.add(dome);

	const sunRoot = new THREE.Group();
	sunRoot.frustumCulled = false;
	skyGroup.add(sunRoot);
	sunRoot.add(createSunGlow());
	sunRoot.add(createSunCore());
	sunRoot.add(createSunCorona());

	const starsRoot = new THREE.Group();
	starsRoot.frustumCulled = false;
	skyGroup.add(starsRoot);
	starsRoot.add(createStars(seed));

	return {
		skyGroup,
		dome,
		sunRoot,
		starsRoot,
		sunDirection,
		sunPosition,
		poleAxis,
		skyColor,
		horizonColor,
		fogColor,
		sunLightColor,
		ambientLightColor,
		sunGlow: sunRoot.children[0],
		sunCore: sunRoot.children[1],
		sunCorona: sunRoot.children[2],
		stars: starsRoot.children[0],
	};
}

function createSkyDome() {
	const dome = new THREE.Mesh(
		new THREE.SphereGeometry(1200, 24, 16),
		new THREE.MeshBasicMaterial({
			color: DAY_SKY.clone(),
			side: THREE.BackSide,
			fog: false,
			depthWrite: false,
		})
	);
	dome.frustumCulled = false;
	return dome;
}

function createSunGlow() {
	const sunGlow = new THREE.Sprite(
		new THREE.SpriteMaterial({
			map: createRadialTexture(256, [
				{ stop: 0, color: 'rgba(255, 248, 220, 0.95)' },
				{ stop: 0.2, color: 'rgba(255, 236, 176, 0.8)' },
				{ stop: 0.5, color: 'rgba(255, 190, 90, 0.25)' },
				{ stop: 1, color: 'rgba(255, 190, 90, 0)' },
			]),
			color: DAY_SUN,
			transparent: true,
			depthWrite: false,
			depthTest: true,
			blending: THREE.AdditiveBlending,
			fog: false,
		})
	);
	sunGlow.scale.set(100, 100, 1);
	sunGlow.frustumCulled = false;
	return sunGlow;
}

function createSunCore() {
	const sunCore = new THREE.Sprite(
		new THREE.SpriteMaterial({
			map: createRadialTexture(256, [
				{ stop: 0, color: 'rgba(255, 255, 255, 1)' },
				{ stop: 0.35, color: 'rgba(255, 244, 204, 0.98)' },
				{ stop: 0.7, color: 'rgba(255, 216, 122, 0.88)' },
				{ stop: 1, color: 'rgba(255, 216, 122, 0)' },
			]),
			color: DAY_SUN,
			transparent: true,
			depthWrite: false,
			depthTest: true,
			blending: THREE.AdditiveBlending,
			fog: false,
			toneMapped: false,
		})
	);
	sunCore.scale.set(44, 44, 1);
	sunCore.frustumCulled = false;
	return sunCore;
}

function createSunCorona() {
	const sunCorona = new THREE.Sprite(
		new THREE.SpriteMaterial({
			map: createCoronaTexture(256),
			color: DAY_SUN,
			transparent: true,
			depthWrite: false,
			depthTest: true,
			blending: THREE.AdditiveBlending,
			fog: false,
		})
	);
	sunCorona.scale.set(130, 130, 1);
	sunCorona.frustumCulled = false;
	return sunCorona;
}

function createSolarState() {
	return {
		timeOfDay: 0,
		hourAngle: 0,
		sunDirection: new THREE.Vector3(),
		sunAltitude: 0,
		dayFactor: 0,
		sunDiscFactor: 0,
		sunGlowFactor: 0,
		sunCoronaFactor: 0,
		nightFactor: 1,
		siderealAngle: 0,
	};
}

function computeSolarState(state, timeOfDay, season) {
	state.timeOfDay = THREE.MathUtils.clamp(timeOfDay, 0, 24);
	const declination = SEASON_DECLINATION[season] ?? 0;
	state.hourAngle = THREE.MathUtils.degToRad((state.timeOfDay - 12) * 15);
	const sinLatitude = Math.sin(TOKYO_LATITUDE);
	const cosLatitude = Math.cos(TOKYO_LATITUDE);
	const sinDeclination = Math.sin(declination);
	const cosDeclination = Math.cos(declination);
	state.sunDirection.set(
		-cosDeclination * Math.sin(state.hourAngle),
		sinLatitude * sinDeclination + cosLatitude * cosDeclination * Math.cos(state.hourAngle),
		sinLatitude * cosDeclination * Math.cos(state.hourAngle) - cosLatitude * sinDeclination
	).normalize();
	state.sunAltitude = THREE.MathUtils.clamp(state.sunDirection.y, -1, 1);
	state.dayFactor = THREE.MathUtils.smoothstep(state.sunAltitude, -0.22, 0.1);
	state.sunDiscFactor = THREE.MathUtils.smoothstep(state.sunAltitude, -0.14, 0.02);
	state.sunGlowFactor = THREE.MathUtils.smoothstep(state.sunAltitude, -0.2, 0.14);
	state.sunCoronaFactor = THREE.MathUtils.smoothstep(state.sunAltitude, -0.24, 0.08);
	state.nightFactor = 1 - state.dayFactor;
	state.siderealAngle = -state.hourAngle * 1.0027379;
}

function updateSkyRig(sky, cameraPosition, solarState) {
	sky.skyGroup.position.copy(cameraPosition);
	sky.sunPosition.copy(solarState.sunDirection).multiplyScalar(760);
	sky.sunRoot.position.copy(sky.sunPosition);
	sky.starsRoot.quaternion.setFromAxisAngle(sky.poleAxis, solarState.siderealAngle);
	sky.sunGlow.material.opacity = 0.34 * solarState.sunGlowFactor;
	sky.sunCore.material.opacity = 0.9 * solarState.sunDiscFactor;
	sky.sunCorona.material.opacity = 0.42 * solarState.sunCoronaFactor;
	sky.stars.visible = solarState.nightFactor > 0.02;
	sky.stars.material.opacity = solarState.nightFactor * 0.92;
}

function updateSkyAppearance(sky, solarState) {
	sky.skyColor.copy(NIGHT_SKY).lerp(DAY_SKY, solarState.dayFactor);
	sky.horizonColor.copy(NIGHT_HORIZON).lerp(DAY_HORIZON, solarState.dayFactor);
	sky.fogColor.copy(NIGHT_FOG).lerp(DAY_FOG, solarState.dayFactor);
	sky.dome.material.color.copy(sky.skyColor);
	return sky.horizonColor;
}

function updateSkyLighting(lights, sky, cameraPosition, sunPosition, solarState, horizonColor) {
	if (lights?.sun) {
		lights.sun.position.copy(cameraPosition);
		lights.sun.position.add(sunPosition);
		lights.sun.target.position.copy(cameraPosition);
		sky.sunLightColor.copy(NIGHT_LIGHT).lerp(DAY_SUN, solarState.dayFactor);
		lights.sun.color.copy(sky.sunLightColor);
		lights.sun.intensity = SUN_INTENSITY * (0.12 + 0.88 * solarState.dayFactor);
	}

	if (lights?.ambientLight) {
		sky.ambientLightColor.copy(NIGHT_LIGHT).lerp(horizonColor, solarState.dayFactor);
		lights.ambientLight.color.copy(sky.ambientLightColor);
		lights.ambientLight.intensity = AMBIENT_INTENSITY * (0.2 + 0.8 * solarState.dayFactor);
	}
}

function createStars(seed) {
	const random = alea(`stars:${seed}`);
	const starCount = 1000;
	const positions = new Float32Array(starCount * 3);
	const color = STAR_COLOR.clone();

	for (let index = 0; index < starCount; index += 1) {
		const azimuth = random() * Math.PI * 2;
		const height = random() * 2 - 1;
		const radius = 980 + random() * 260;
		const horizontalRadius = Math.sqrt(1 - height * height) * radius;
		const offset = index * 3;

		positions[offset] = Math.cos(azimuth) * horizontalRadius;
		positions[offset + 1] = height * radius;
		positions[offset + 2] = Math.sin(azimuth) * horizontalRadius;
	}

	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

	const material = new THREE.PointsMaterial({
		color,
		size: 1.6,
		sizeAttenuation: true,
		transparent: true,
		opacity: 0,
		depthWrite: false,
		depthTest: true,
		fog: false,
	});

	const stars = new THREE.Points(geometry, material);
	stars.frustumCulled = false;
	return stars;
}

function createRadialTexture(size, stops) {
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const context = canvas.getContext('2d');
	const center = size / 2;
	const gradient = context.createRadialGradient(center, center, 0, center, center, center);

	for (const stop of stops) {
		gradient.addColorStop(stop.stop, stop.color);
	}

	context.fillStyle = gradient;
	context.fillRect(0, 0, size, size);

	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}

function createCoronaTexture(size) {
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const context = canvas.getContext('2d');
	const center = size / 2;
	const gradient = context.createRadialGradient(center, center, size * 0.12, center, center, center);

	gradient.addColorStop(0, 'rgba(255, 245, 210, 0.65)');
	gradient.addColorStop(0.5, 'rgba(255, 200, 110, 0.25)');
	gradient.addColorStop(1, 'rgba(255, 180, 80, 0)');

	context.fillStyle = gradient;
	context.fillRect(0, 0, size, size);

	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}