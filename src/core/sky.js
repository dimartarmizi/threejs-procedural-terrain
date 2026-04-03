import * as THREE from 'three';
import alea from 'alea';

const DAY_SKY = new THREE.Color(0x87b7ff);
const DAY_HORIZON = new THREE.Color(0xbfdfff);
const DAY_LOW_SKY = new THREE.Color(0xa6ccf0);
const DAY_SUN = new THREE.Color(0xfff0c2);
const NIGHT_LIGHT = new THREE.Color(0x8aa4ff);
const STAR_COLOR = new THREE.Color(0xffffff);
const SUN_INTENSITY = 1.4;
const AMBIENT_INTENSITY = 0.65;
const TOKYO_LATITUDE = THREE.MathUtils.degToRad(35.6762);
const SEASON_PALETTES = {
	spring: {
		dayTop: new THREE.Color(0x8ed0ff),
		dayUpper: new THREE.Color(0xcaf4ff),
		dayHorizon: new THREE.Color(0xffe2c6),
		dayBottom: new THREE.Color(0xf7fbff),
		twilightTop: new THREE.Color(0x8b6adf),
		twilightUpper: new THREE.Color(0xff95b4),
		twilightHorizon: new THREE.Color(0xffc99c),
		nightTop: new THREE.Color(0x08111f),
		nightUpper: new THREE.Color(0x12263d),
		nightHorizon: new THREE.Color(0x25385d),
		nightBottom: new THREE.Color(0x050816),
		sunLight: new THREE.Color(0xfff1d0),
		ambientDay: new THREE.Color(0xcfeaff),
		hazeDay: new THREE.Color(0xc6e6ff),
		hazeNight: new THREE.Color(0x07111f),
	},
	summer: {
		dayTop: new THREE.Color(0x5eb8ff),
		dayUpper: new THREE.Color(0x8fe3ff),
		dayHorizon: new THREE.Color(0xffdba4),
		dayBottom: new THREE.Color(0xf7fcff),
		twilightTop: new THREE.Color(0x5b5eff),
		twilightUpper: new THREE.Color(0xff7f88),
		twilightHorizon: new THREE.Color(0xffb45c),
		nightTop: new THREE.Color(0x07101d),
		nightUpper: new THREE.Color(0x10243d),
		nightHorizon: new THREE.Color(0x1e3358),
		nightBottom: new THREE.Color(0x04070d),
		sunLight: new THREE.Color(0xfff0b4),
		ambientDay: new THREE.Color(0xc1ecff),
		hazeDay: new THREE.Color(0xb9dcf4),
		hazeNight: new THREE.Color(0x060d19),
	},
	autumn: {
		dayTop: new THREE.Color(0x8fb5ff),
		dayUpper: new THREE.Color(0xd9e4ff),
		dayHorizon: new THREE.Color(0xffb58f),
		dayBottom: new THREE.Color(0xfdf7ef),
		twilightTop: new THREE.Color(0x7958b9),
		twilightUpper: new THREE.Color(0xff8b69),
		twilightHorizon: new THREE.Color(0xffa348),
		nightTop: new THREE.Color(0x090f1c),
		nightUpper: new THREE.Color(0x18223d),
		nightHorizon: new THREE.Color(0x2d3553),
		nightBottom: new THREE.Color(0x05070d),
		sunLight: new THREE.Color(0xffe0b0),
		ambientDay: new THREE.Color(0xd7e3ff),
		hazeDay: new THREE.Color(0xcfe0f4),
		hazeNight: new THREE.Color(0x070d18),
	},
	winter: {
		dayTop: new THREE.Color(0xa6d8ff),
		dayUpper: new THREE.Color(0xe0f4ff),
		dayHorizon: new THREE.Color(0xdde9ff),
		dayBottom: new THREE.Color(0xf9fcff),
		twilightTop: new THREE.Color(0x6678d6),
		twilightUpper: new THREE.Color(0x95b7ff),
		twilightHorizon: new THREE.Color(0xf2c9c0),
		nightTop: new THREE.Color(0x060a18),
		nightUpper: new THREE.Color(0x101b36),
		nightHorizon: new THREE.Color(0x20355a),
		nightBottom: new THREE.Color(0x04060c),
		sunLight: new THREE.Color(0xfff2d9),
		ambientDay: new THREE.Color(0xdcefff),
		hazeDay: new THREE.Color(0xd3e4f8),
		hazeNight: new THREE.Color(0x060c18),
	},
};

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
			const horizonColor = updateSkyAppearance(sky, solarState, settings.season);
			updateSkyLighting(lights, sky, cameraPosition, sky.sunRoot.position, solarState, horizonColor, settings.season);
		},
		render(renderer, camera) {
			renderer.render(skyScene, camera);
		},
	};
}

function createSkyRig(seed) {
	const skyGroup = new THREE.Group();
	skyGroup.renderOrder = -1000;

	const sunDirection = new THREE.Vector3();
	const sunPosition = new THREE.Vector3();
	const poleAxis = new THREE.Vector3(0, Math.sin(TOKYO_LATITUDE), -Math.cos(TOKYO_LATITUDE)).normalize();
	const skyColor = new THREE.Color();
	const skyUpperColor = new THREE.Color();
	const horizonColor = new THREE.Color();
	const bottomColor = new THREE.Color();
	const sunLightColor = new THREE.Color();
	const ambientLightColor = new THREE.Color();
	const gradientMaterial = createSkyDomeMaterial();

	const dome = createSkyDome(gradientMaterial);
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
		skyUpperColor,
		horizonColor,
		bottomColor,
		sunLightColor,
		ambientLightColor,
		gradientMaterial,
		sunGlow: sunRoot.children[0],
		sunCore: sunRoot.children[1],
		sunCorona: sunRoot.children[2],
		stars: starsRoot.children[0],
	};
}

function createSkyDome(material) {
	const dome = new THREE.Mesh(
		new THREE.SphereGeometry(1200, 24, 16),
		material
	);
	dome.frustumCulled = false;
	return dome;
}

function createSkyDomeMaterial() {
	return new THREE.ShaderMaterial({
		uniforms: {
			topColor: { value: DAY_SKY.clone() },
			upperColor: { value: DAY_HORIZON.clone() },
			horizonColor: { value: DAY_HORIZON.clone() },
			bottomColor: { value: DAY_LOW_SKY.clone() },
		},
		vertexShader: `
			varying vec3 vWorldPosition;
			void main() {
				vec4 worldPosition = modelMatrix * vec4(position, 1.0);
				vWorldPosition = worldPosition.xyz;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
		`,
		fragmentShader: `
			uniform vec3 topColor;
			uniform vec3 upperColor;
			uniform vec3 horizonColor;
			uniform vec3 bottomColor;
			varying vec3 vWorldPosition;

			void main() {
				vec3 direction = normalize(vWorldPosition);
				float t = clamp(direction.y * 0.5 + 0.5, 0.0, 1.0);
				float horizonBlend = smoothstep(0.0, 0.42, t);
				float upperBlend = smoothstep(0.22, 0.78, t);
				float topBlend = smoothstep(0.56, 1.0, t);
				vec3 color = mix(bottomColor, horizonColor, horizonBlend);
				color = mix(color, upperColor, upperBlend);
				color = mix(color, topColor, topBlend);
				gl_FragColor = vec4(color, 1.0);
			}
		`,
		side: THREE.BackSide,
		depthWrite: false,
		toneMapped: false,
	});
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

function updateSkyAppearance(sky, solarState, season) {
	const palette = getSeasonPalette(season);
	const twilightFactor = 1 - THREE.MathUtils.smoothstep(Math.abs(solarState.sunAltitude), 0.06, 0.28);

	mixSeasonColor(sky.skyColor, palette.nightTop, palette.dayTop, solarState.dayFactor).lerp(palette.twilightTop, twilightFactor * 0.12);
	mixSeasonColor(sky.skyUpperColor, palette.nightUpper, palette.dayUpper, solarState.dayFactor).lerp(palette.twilightUpper, twilightFactor * 0.5);
	mixSeasonColor(sky.horizonColor, palette.nightHorizon, palette.dayHorizon, solarState.dayFactor).lerp(palette.twilightHorizon, twilightFactor * 0.82);
	mixSeasonColor(sky.bottomColor, palette.nightBottom, palette.dayBottom, solarState.dayFactor).lerp(palette.hazeDay, twilightFactor * 0.1);

	sky.gradientMaterial.uniforms.topColor.value.copy(sky.skyColor);
	sky.gradientMaterial.uniforms.upperColor.value.copy(sky.skyUpperColor);
	sky.gradientMaterial.uniforms.horizonColor.value.copy(sky.horizonColor);
	sky.gradientMaterial.uniforms.bottomColor.value.copy(sky.bottomColor);

	return sky.horizonColor;
}

function updateSkyLighting(lights, sky, cameraPosition, sunPosition, solarState, horizonColor, season) {
	const palette = getSeasonPalette(season);

	if (lights?.sun) {
		lights.sun.position.copy(cameraPosition);
		lights.sun.position.add(sunPosition);
		lights.sun.target.position.copy(cameraPosition);
		sky.sunLightColor.copy(NIGHT_LIGHT).lerp(palette.sunLight, solarState.dayFactor);
		lights.sun.color.copy(sky.sunLightColor);
		lights.sun.intensity = SUN_INTENSITY * (0.12 + 0.88 * solarState.dayFactor);
	}

	if (lights?.ambientLight) {
		sky.ambientLightColor.copy(NIGHT_LIGHT).lerp(palette.ambientDay, solarState.dayFactor).lerp(horizonColor, 0.28);
		lights.ambientLight.color.copy(sky.ambientLightColor);
		lights.ambientLight.intensity = AMBIENT_INTENSITY * (0.2 + 0.8 * solarState.dayFactor);
	}
}

function getSeasonPalette(season) {
	return SEASON_PALETTES[season] ?? SEASON_PALETTES.spring;
}

function mixSeasonColor(target, nightColor, dayColor, factor) {
	return target.copy(nightColor).lerp(dayColor, factor);
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