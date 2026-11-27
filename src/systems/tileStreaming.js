import { applyFog } from '../core/fog.js';
import { createWaterSurface, createWaterTileMesh, updateWaterSurface } from '../core/water.js';

export function createTileStreamingController(terrain, scene, settings) {
	const tiles = new Map();
	const tileCreationBudget = 4;
	const lodUpdateBudget = 4;
	const state = {
		needsTerrainRefresh: true,
		atmosphereState: null,
		lightingState: null,
		waterSurface: null,
		waterMesh: null,
	};

	function markDirty() {
		state.needsTerrainRefresh = true;
	}

	function update(cameraPosition) {
		if (state.needsTerrainRefresh) {
			refreshTiles(tiles, terrain);
			state.needsTerrainRefresh = false;
		}

		const centerX = Math.round(cameraPosition.x / terrain.tileSize);
		const centerZ = Math.round(cameraPosition.z / terrain.tileSize);
		const neededTiles = new Set();
		const missingTiles = [];
		const lodUpdates = [];

		collectNeededTiles(settings.renderDistance, centerX, centerZ, tiles, neededTiles, missingTiles, lodUpdates);
		missingTiles.sort(sortByPriority);
		createQueuedTiles(missingTiles, tileCreationBudget, terrain, scene, settings.wireframe, tiles);

		if (lodUpdates.length > 0) {
			lodUpdates.sort(sortByPriority);
			const lodLimit = Math.min(lodUpdateBudget, lodUpdates.length);
			for (let i = 0; i < lodLimit; i += 1) {
				const item = lodUpdates[i];
				terrain.updateTileMesh(item.tile, item.targetResolution);
			}
		}

		removeUnusedTiles(scene, tiles, neededTiles);
		const fogState = applyFog(
			tiles,
			cameraPosition,
			terrain,
			settings.renderDistance,
			settings.fogDistance,
			settings.fogEnabled,
			state.atmosphereState
		);
		syncWaterSurface(scene, terrain, settings, cameraPosition, getTimeSeconds(), fogState, state);
	}

	function setAtmosphere(nextAtmosphereState) {
		state.atmosphereState = nextAtmosphereState;
	}

	function setLighting(nextLightingState) {
		state.lightingState = nextLightingState;
	}

	function setWireframe(enabled) {
		terrain.sharedMaterial.wireframe = enabled;
		terrain.sharedMaterial.needsUpdate = true;
	}

	return {
		markDirty,
		update,
		setAtmosphere,
		setLighting,
		setWireframe,
	};
}

function getTargetResolution(distSq) {
	if (distSq <= 16) return 48;
	if (distSq <= 64) return 24;
	return 12;
}

function refreshTiles(tiles, terrain) {
	tiles.forEach(function (tile) {
		terrain.updateTileMesh(tile);
	});
}

function collectNeededTiles(renderDistance, centerX, centerZ, tiles, neededTiles, missingTiles, lodUpdates) {
	const maxDistSq = (renderDistance + 0.5) * (renderDistance + 0.5);
	for (let tileZ = centerZ - renderDistance; tileZ <= centerZ + renderDistance; tileZ += 1) {
		for (let tileX = centerX - renderDistance; tileX <= centerX + renderDistance; tileX += 1) {
			const priority = getTilePriority(tileX, tileZ, centerX, centerZ);
			if (priority > maxDistSq) continue;

			const key = createTileKey(tileX, tileZ);
			neededTiles.add(key);
			const targetResolution = getTargetResolution(priority);

			const existing = tiles.get(key);
			if (!existing) {
				missingTiles.push({
					tileX,
					tileZ,
					priority,
					targetResolution,
				});
			} else if (existing.userData.resolution !== targetResolution) {
				lodUpdates.push({
					tile: existing,
					priority,
					targetResolution,
				});
			}
		}
	}
}

function createQueuedTiles(missingTiles, tileCreationBudget, terrain, scene, wireframe, tiles) {
	const limit = Math.min(tileCreationBudget, missingTiles.length);

	for (let index = 0; index < limit; index += 1) {
		const tileInfo = missingTiles[index];
		const key = createTileKey(tileInfo.tileX, tileInfo.tileZ);

		if (tiles.has(key)) {
			continue;
		}

		const tile = terrain.createTileMesh(tileInfo.tileX, tileInfo.tileZ, wireframe, tileInfo.targetResolution);
		tile.receiveShadow = false;
		tile.castShadow = false;
		scene.add(tile);
		tiles.set(key, tile);
	}
}

function removeUnusedTiles(scene, tiles, neededTiles) {
	const keys = Array.from(tiles.keys());

	for (let index = 0; index < keys.length; index += 1) {
		const key = keys[index];
		if (!neededTiles.has(key)) {
			disposeTile(scene, tiles.get(key));
			tiles.delete(key);
		}
	}
}

function createTileKey(tileX, tileZ) {
	return tileX + ':' + tileZ;
}

function getTilePriority(tileX, tileZ, centerX, centerZ) {
	const deltaX = tileX - centerX;
	const deltaZ = tileZ - centerZ;
	return deltaX * deltaX + deltaZ * deltaZ;
}

function sortByPriority(left, right) {
	return left.priority - right.priority;
}

function disposeTile(scene, tile) {
	scene.remove(tile);
	tile.geometry.dispose();
}

function syncWaterSurface(scene, terrain, settings, cameraPosition, timeSeconds, fogState, state) {
	if (!settings.waterEnabled) {
		if (state.waterMesh) {
			state.waterMesh.visible = false;
		}
		return;
	}

	const requiredSpan = terrain.tileSize * (settings.renderDistance * 2 + 4);
	if (!state.waterSurface || state.waterSurface.tileSize !== requiredSpan) {
		if (state.waterMesh) {
			scene.remove(state.waterMesh);
			state.waterMesh = null;
		}
		if (state.waterSurface) {
			state.waterSurface.dispose();
			state.waterSurface = null;
		}
		state.waterSurface = createWaterSurface(requiredSpan);
		state.waterMesh = createWaterTileMesh(0, 0, requiredSpan, state.waterSurface);
		state.waterMesh.frustumCulled = false;
		scene.add(state.waterMesh);
	}

	state.waterMesh.visible = true;
	state.waterMesh.position.set(cameraPosition.x, 0, cameraPosition.z);

	updateWaterSurface(
		state.waterSurface,
		cameraPosition,
		timeSeconds,
		true,
		state.atmosphereState,
		state.lightingState,
		fogState
	);
}

function getTimeSeconds() {
	return performance.now() * 0.001;
}
