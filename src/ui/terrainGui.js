import { GUI } from 'lil-gui';

export function createTerrainGui(settings, handlers) {
  const gui = new GUI({ title: 'Terrain Settings' });
  gui.domElement.classList.add('terrain-gui');

  const terrainFolder = gui.addFolder('Terrain');
  terrainFolder.add(settings, 'seed', 1, 999, 1).onFinishChange(handlers.updateTerrain);
  terrainFolder.add(settings, 'heightScale', 0, 120, 1).onChange(handlers.updateTerrain);
  terrainFolder.add(settings, 'segments', 16, 96, 1).onFinishChange(handlers.updateTerrain);
  terrainFolder.add(settings, 'renderDistance', 1, 16, 1).onFinishChange(handlers.updateTerrain);
  terrainFolder.add(settings, 'wireframe').onChange(handlers.updateWireframe);
  terrainFolder.add(settings, 'gridHelper').onChange(handlers.updateGridHelper);
  terrainFolder.add(settings, 'mode', ['orbit', 'player', 'drive', 'fly']).onChange(handlers.updateMode);
  terrainFolder.open();

  const atmosphereFolder = gui.addFolder('Atmosphere');
  atmosphereFolder.add(settings, 'fogDensity', 0, 0.02, 0.0001).onChange(handlers.updateAtmosphere);
  atmosphereFolder.add(settings, 'sunIntensity', 0, 3, 0.01).onChange(handlers.updateLight);
  atmosphereFolder.add(settings, 'ambientIntensity', 0, 2, 0.01).onChange(handlers.updateLight);

  return gui;
}