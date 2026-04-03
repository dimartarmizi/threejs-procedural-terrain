import { ProceduralTerrain } from '../terrain/ProceduralTerrain.js';
import { getTerrainOptions } from '../terrain/config.js';
import { createTileStreamingController } from './tileStreaming.js';

export function createTerrainSystem(scene, settings) {
	const terrain = new ProceduralTerrain(getTerrainOptions(settings));

	const tileStreaming = createTileStreamingController(terrain, scene, settings);

	function applyTerrainSettings(nextSettings) {
		terrain.setOptions(getTerrainOptions(nextSettings));
		tileStreaming.markDirty();
	}

	function update(cameraPosition) {
		tileStreaming.update(cameraPosition);
	}

	function setWireframe(enabled) {
		tileStreaming.setWireframe(enabled);
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