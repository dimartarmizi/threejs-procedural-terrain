import { ProceduralTerrain } from '../terrain/ProceduralTerrain.js';
import { createTileStreamingController } from './tileStreaming.js';

export function createTerrainSystem(scene, settings) {
	const terrain = new ProceduralTerrain({
		tileSize: settings.tileSize,
		segments: settings.segments,
		heightScale: settings.heightScale,
		seed: settings.seed,
	});

	const tileStreaming = createTileStreamingController(terrain, scene, settings);

	function applyTerrainSettings(nextSettings) {
		terrain.setOptions({
			tileSize: nextSettings.tileSize,
			segments: Math.max(1, Math.round(nextSettings.segments)),
			heightScale: nextSettings.heightScale,
			seed: Math.round(nextSettings.seed),
		});
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