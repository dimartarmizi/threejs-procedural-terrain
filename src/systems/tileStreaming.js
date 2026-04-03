import { applyDistanceFade, setupDistanceFadeMaterial } from '../core/distanceFade.js';

export function createTileStreamingController(terrain, scene, settings) {
	const tiles = new Map();
	const tileCreationBudget = 1;
	let needsRefresh = true;

	function markDirty() {
		needsRefresh = true;
	}

	function update(cameraPosition) {
		if (needsRefresh) {
			clearTiles(scene, tiles);
			needsRefresh = false;
		}

		const centerX = Math.round(cameraPosition.x / terrain.tileSize);
		const centerZ = Math.round(cameraPosition.z / terrain.tileSize);
		const neededTiles = new Set();
		const missingTiles = [];

		collectNeededTiles(settings.renderDistance, centerX, centerZ, tiles, neededTiles, missingTiles);
		missingTiles.sort(sortByPriority);
		createQueuedTiles(missingTiles, tileCreationBudget, terrain, scene, settings.wireframe, tiles);
		removeUnusedTiles(scene, tiles, neededTiles);
		applyDistanceFade(tiles, cameraPosition, terrain.tileSize, settings.renderDistance, settings.fadeDensity);
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
		setWireframe,
	};
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
		setupDistanceFadeMaterial(tile.material);
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