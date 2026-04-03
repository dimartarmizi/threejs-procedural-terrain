import * as THREE from 'three';

export function setupDistanceFadeMaterial(material) {
	if (material.userData.distanceFadeInstalled) {
		return;
	}

	material.transparent = true;

	material.onBeforeCompile = function (shader) {
		shader.uniforms.fadeCameraPosition = { value: new THREE.Vector3() };
		shader.uniforms.fadeStart = { value: 0 };
		shader.uniforms.fadeEnd = { value: 1 };

		shader.vertexShader = shader.vertexShader
			.replace(
				'#include <common>',
				'#include <common>\nvarying vec3 vFadeWorldPosition;'
			)
			.replace(
				'#include <worldpos_vertex>',
				'#include <worldpos_vertex>\nvFadeWorldPosition = worldPosition.xyz;'
			);

		shader.fragmentShader = shader.fragmentShader
			.replace(
				'#include <common>',
				'#include <common>\nuniform vec3 fadeCameraPosition;\nuniform float fadeStart;\nuniform float fadeEnd;\nvarying vec3 vFadeWorldPosition;'
			)
			.replace(
				'#include <alphatest_fragment>',
				'#include <alphatest_fragment>\nfloat fadeDistance = distance(vFadeWorldPosition.xz, fadeCameraPosition.xz);\nfloat fadeAlpha = 1.0 - smoothstep(fadeStart, fadeEnd, fadeDistance);\ndiffuseColor.a *= fadeAlpha;'
			);

		material.userData.fadeShader = shader;
	};

	material.needsUpdate = true;
	material.userData.distanceFadeInstalled = true;
}

export function applyDistanceFade(tiles, cameraPosition, tileSize, renderDistance, fadeDensity) {
	const minDensity = 0.00001;
	const safeDensity = Math.max(fadeDensity, minDensity);
	const streamEdgeDistance = Math.max(tileSize, renderDistance * tileSize);
	const fadeEnd = Math.min(1 / safeDensity, streamEdgeDistance * 1.2);
	const fadeBand = Math.max(tileSize * 1.5, fadeEnd * 0.45);
	const fadeStart = Math.max(0, fadeEnd - fadeBand);

	tiles.forEach(function (tile) {
		updateFadeUniforms(tile.material, cameraPosition, fadeStart, fadeEnd);
	});
}

function updateFadeUniforms(material, cameraPosition, fadeStart, fadeEnd) {
	const shader = material.userData.fadeShader;
	if (!shader) {
		return;
	}

	shader.uniforms.fadeCameraPosition.value.copy(cameraPosition);
	shader.uniforms.fadeStart.value = fadeStart;
	shader.uniforms.fadeEnd.value = fadeEnd;
}