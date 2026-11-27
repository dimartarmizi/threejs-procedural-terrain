import { applyFog } from '../core/fog.js';
import { createWaterSurface, createWaterTileMesh, updateWaterHeightMap, updateWaterSurface } from '../core/water.js';
import { createPropsResources, createTileProps } from '../core/props.js';

export function createTileStreamingController(terrain, scene, settings) {
	const tiles = new Map();
	const tileProps = new Map();
	const propsResources = createPropsResources();
	const tileCreationBudget = 4;
	const lodUpdateBudget = 4;
	const propsCreationBudget = 2;
	const state = {
		needsTerrainRefresh: true,
		needsPropsRefresh: false,
		atmosphereState: null,
		lightingState: null,
		waterSurface: null,
		waterMesh: null,
	};

	function markDirty() {
		state.needsTerrainRefresh = true;
	}

	function markPropsDirty() {
		state.needsPropsRefresh = true;
	}

	function update(cameraPosition) {
		const terrainRefreshed = state.needsTerrainRefresh;
		if (state.needsTerrainRefresh) {
			refreshTiles(tiles, terrain);
			clearAllProps(scene, tileProps);
			state.needsTerrainRefresh = false;
			state.needsPropsRefresh = false;
		} else if (state.needsPropsRefresh) {
			clearAllProps(scene, tileProps);
			state.needsPropsRefresh = false;
		}

		const centerX = Math.round(cameraPosition.x / terrain.tileSize);
		const centerZ = Math.round(cameraPosition.z / terrain.tileSize);
		const neededTiles = new Set();
		const neededProps = new Set();
		const missingTiles = [];
		const lodUpdates = [];

		const propsRadius = Math.min(settings.renderDistance, settings.propsRenderDistance);
		const maxPropsDistSq = propsRadius * propsRadius;

		collectNeededTiles(
			settings.renderDistance,
			centerX,
			centerZ,
			tiles,
			neededTiles,
			neededProps,
			missingTiles,
			lodUpdates,
			settings.propsEnabled,
			maxPropsDistSq
		);
		missingTiles.sort(sortByPriority);
		createQueuedTiles(missingTiles, tileCreationBudget, terrain, scene, settings.wireframe, tiles);

		if (lodUpdates.length > 0) {
			lodUpdates.sort(sortByPriority);
			const lodLimit = Math.min(lodUpdateBudget, lodUpdates.length);
			for (let i = 0; i < lodLimit; i += 1) {
				const item = lodUpdates[i];
				terrain.updateTileMesh(item.tile, item.targetResolution);
				const key = createTileKey(item.tile.userData.tileX, item.tile.userData.tileZ);
				if (tileProps.has(key)) {
					disposePropsGroup(scene, tileProps.get(key));
					if (neededProps.has(key)) {
						const nextGroup = createTileProps(
							item.tile.userData.tileX,
							item.tile.userData.tileZ,
							terrain,
							propsResources,
							item.targetResolution,
							settings
						);
						if (nextGroup) scene.add(nextGroup);
						tileProps.set(key, nextGroup);
					} else {
						tileProps.delete(key);
					}
				}
			}
		}

		syncProps(scene, terrain, tiles, tileProps, neededProps, propsResources, propsCreationBudget, settings);
		removeUnusedTiles(scene, tiles, neededTiles);
		const fogState = applyFog(
			tiles,
			cameraPosition,
			terrain,
			settings.renderDistance,
			settings.fogDistance,
			settings.fogEnabled,
			state.atmosphereState,
			[propsResources.material, propsResources.roadMaterial, propsResources.bridgeMaterial]
		);
		syncWaterSurface(scene, terrain, settings, cameraPosition, getTimeSeconds(), fogState, state, terrainRefreshed);
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
		markPropsDirty,
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

function collectNeededTiles(
	renderDistance,
	centerX,
	centerZ,
	tiles,
	neededTiles,
	neededProps,
	missingTiles,
	lodUpdates,
	propsEnabled,
	maxPropsDistSq
) {
	const maxDistSq = (renderDistance + 0.5) * (renderDistance + 0.5);
	for (let tileZ = centerZ - renderDistance; tileZ <= centerZ + renderDistance; tileZ += 1) {
		for (let tileX = centerX - renderDistance; tileX <= centerX + renderDistance; tileX += 1) {
			const priority = getTilePriority(tileX, tileZ, centerX, centerZ);
			if (priority > maxDistSq) continue;

			const key = createTileKey(tileX, tileZ);
			neededTiles.add(key);
			if (propsEnabled && priority <= maxPropsDistSq) {
				neededProps.add(key);
			}
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

function disposePropsGroup(scene, group) {
	if (!group) return;
	for (let i = 0; i < group.children.length; i++) {
		const child = group.children[i];
		if (child.userData.disposeGeometry) {
			child.geometry.dispose();
		}
	}
	scene.remove(group);
}

function clearAllProps(scene, tileProps) {
	tileProps.forEach((group) => {
		disposePropsGroup(scene, group);
	});
	tileProps.clear();
}

function syncProps(scene, terrain, tiles, tileProps, neededProps, resources, budget, settings) {
	let created = 0;
	for (const key of neededProps) {
		if (tileProps.has(key)) continue;
		const tile = tiles.get(key);
		if (!tile) continue;
		if (created >= budget) break;
		const group = createTileProps(
			tile.userData.tileX,
			tile.userData.tileZ,
			terrain,
			resources,
			tile.userData.resolution,
			settings
		);
		if (group) scene.add(group);
		tileProps.set(key, group);
		created += 1;
	}

	for (const [key, group] of tileProps.entries()) {
		if (!neededProps.has(key)) {
			disposePropsGroup(scene, group);
			tileProps.delete(key);
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
	for (const [key, tile] of tiles) {
		if (!neededTiles.has(key)) {
			disposeTile(scene, tile);
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

function syncWaterSurface(scene, terrain, settings, cameraPosition, timeSeconds, fogState, state, forceHeightMap = false) {
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
		forceHeightMap = true;
	}

	state.waterMesh.visible = true;
	const waterSnapX = Math.round(cameraPosition.x / terrain.tileSize) * terrain.tileSize;
	const waterSnapZ = Math.round(cameraPosition.z / terrain.tileSize) * terrain.tileSize;
	state.waterMesh.position.set(waterSnapX, 0, waterSnapZ);

	const heightMapSpan = terrain.tileSize * (settings.renderDistance * 2 + 2);
	updateWaterHeightMap(state.waterSurface, terrain, cameraPosition, heightMapSpan, forceHeightMap);

	updateWaterSurface(
		state.waterSurface,
		cameraPosition,
		timeSeconds,
		state.atmosphereState,
		state.lightingState,
		fogState
	);
}

function getTimeSeconds() {
	return performance.now() * 0.001;
}
