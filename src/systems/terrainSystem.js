import { ProceduralTerrain } from '../terrain/ProceduralTerrain.js';

export function createTerrainSystem(scene, settings) {
	const terrain = new ProceduralTerrain({
		tileSize: settings.tileSize,
		segments: settings.segments,
		heightScale: settings.heightScale,
		seed: settings.seed,
	});

	const tiles = new Map();
	let needsRefresh = true;

	function applyTerrainSettings(nextSettings) {
		terrain.setOptions({
			tileSize: 128,
			segments: Math.max(1, Math.round(nextSettings.segments)),
			heightScale: nextSettings.heightScale,
			seed: Math.round(nextSettings.seed),
		});
		needsRefresh = true;
	}

	function update(cameraPosition) {
		if (needsRefresh) {
			clearTiles(scene, tiles);
			needsRefresh = false;
		}

		const centerX = Math.round(cameraPosition.x / terrain.tileSize);
		const centerZ = Math.round(cameraPosition.z / terrain.tileSize);
		const renderDistance = settings.renderDistance;
		const neededTiles = new Set();

		for (let tileZ = centerZ - renderDistance; tileZ <= centerZ + renderDistance; tileZ += 1) {
			for (let tileX = centerX - renderDistance; tileX <= centerX + renderDistance; tileX += 1) {
				const key = createTileKey(tileX, tileZ);
				neededTiles.add(key);

				if (!tiles.has(key)) {
					const tile = terrain.createTileMesh(tileX, tileZ, settings.wireframe);
					tile.receiveShadow = true;
					tile.castShadow = false;
					scene.add(tile);
					tiles.set(key, tile);
				}
			}
		}

		const keys = Array.from(tiles.keys());
		for (let index = 0; index < keys.length; index += 1) {
			const key = keys[index];
			if (!neededTiles.has(key)) {
				disposeTile(scene, tiles.get(key));
				tiles.delete(key);
			}
		}
	}

	function setWireframe(enabled) {
		tiles.forEach(function (tile) {
			tile.material.wireframe = enabled;
			tile.material.needsUpdate = true;
		});
	}

	function getCameraFar() {
		return terrain.tileSize * (settings.renderDistance + 3) * 2;
	}

	function getHeightAt(worldX, worldZ) {
		return terrain.sampleHeight(worldX, worldZ);
	}

	return {
		applyTerrainSettings,
		update,
		setWireframe,
		getCameraFar,
		getHeightAt,
	};
}

function createTileKey(tileX, tileZ) {
	return tileX + ':' + tileZ;
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