import { applyFog, setupFogMaterial } from '../core/fog.js';
import { createWaterSurface, createWaterTileMesh, updateWaterSurface } from '../core/water.js';

export function createTileStreamingController(terrain, scene, settings) {
	const tiles = new Map();
	const waterTiles = new Map();
	const tileCreationBudget = 1;
	const state = {
		needsTerrainRefresh: true,
		atmosphereState: null,
		lightingState: null,
		waterSurface: null,
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

		collectNeededTiles(settings.renderDistance, centerX, centerZ, tiles, neededTiles, missingTiles);
		missingTiles.sort(sortByPriority);
		createQueuedTiles(missingTiles, tileCreationBudget, terrain, scene, settings.wireframe, tiles);
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
		syncWaterTiles(scene, terrain, tiles, waterTiles, settings, cameraPosition, getTimeSeconds(), fogState, state);
	}

	function setAtmosphere(nextAtmosphereState) {
		state.atmosphereState = nextAtmosphereState;
	}

	function setLighting(nextLightingState) {
		state.lightingState = nextLightingState;
	}

	function setWireframe(enabled) {
		tiles.forEach(function (tile) {
			tile.material.wireframe = enabled;
			tile.material.needsUpdate = true;
		});
	}

	return {
		markDirty,
		update,
		setAtmosphere,
		setLighting,
		setWireframe,
	};
}

function refreshTiles(tiles, terrain) {
	tiles.forEach(function (tile) {
		terrain.updateTileMesh(tile);
	});
}

function collectNeededTiles(renderDistance, centerX, centerZ, tiles, neededTiles, missingTiles) {
	for (let tileZ = centerZ - renderDistance; tileZ <= centerZ + renderDistance; tileZ += 1) {
		for (let tileX = centerX - renderDistance; tileX <= centerX + renderDistance; tileX += 1) {
			const key = createTileKey(tileX, tileZ);
			neededTiles.add(key);

			if (!tiles.has(key)) {
				missingTiles.push({
					tileX,
					tileZ,
					priority: getTilePriority(tileX, tileZ, centerX, centerZ),
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

		const tile = terrain.createTileMesh(tileInfo.tileX, tileInfo.tileZ, wireframe);
		setupFogMaterial(tile.material);
		tile.receiveShadow = true;
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

function clearTiles(scene, tiles) {
	tiles.forEach(function (tile) {
		scene.remove(tile);
		tile.geometry.dispose();
		tile.material.dispose();
	});
	tiles.clear();
}

function disposeTile(scene, tile) {
	scene.remove(tile);
	tile.geometry.dispose();
	tile.material.dispose();
}

function syncWaterTiles(scene, terrain, terrainTiles, waterTiles, settings, cameraPosition, timeSeconds, fogState, state) {
	if (!settings.waterEnabled) {
		clearWaterTiles(scene, waterTiles);
		if (state.waterSurface) {
			updateWaterSurface(
				state.waterSurface,
				cameraPosition,
				timeSeconds,
				false,
				state.atmosphereState,
				state.lightingState,
				fogState
			);
		}
		return;
	}

	let activeSurface = state.waterSurface;
	if (!activeSurface || activeSurface.tileSize !== terrain.tileSize) {
		clearWaterTiles(scene, waterTiles);
		disposeWaterSurface(state);
		activeSurface = createWaterSurface(terrain.tileSize);
		state.waterSurface = activeSurface;
	}

	terrainTiles.forEach(function (_, key) {
		if (waterTiles.has(key)) {
			return;
		}

		const tileCoords = parseTileKey(key);
		const waterMesh = createWaterTileMesh(tileCoords.tileX, tileCoords.tileZ, terrain.tileSize, activeSurface);
		scene.add(waterMesh);
		waterTiles.set(key, waterMesh);
	});

	const waterKeys = Array.from(waterTiles.keys());
	for (let index = 0; index < waterKeys.length; index += 1) {
		const key = waterKeys[index];
		if (!terrainTiles.has(key)) {
			scene.remove(waterTiles.get(key));
			waterTiles.delete(key);
		}
	}

	updateWaterSurface(
		activeSurface,
		cameraPosition,
		timeSeconds,
		true,
		state.atmosphereState,
		state.lightingState,
		fogState
	);
}

function clearWaterTiles(scene, waterTiles) {
	waterTiles.forEach(function (tile) {
		scene.remove(tile);
	});
	waterTiles.clear();
}

function parseTileKey(key) {
	const parts = key.split(':');
	return {
		tileX: Number(parts[0]),
		tileZ: Number(parts[1]),
	};
}

function getTimeSeconds() {
	return performance.now() * 0.001;
}

function disposeWaterSurface(state) {
	if (!state.waterSurface) {
		return;
	}

	state.waterSurface.dispose();
	state.waterSurface = null;
}