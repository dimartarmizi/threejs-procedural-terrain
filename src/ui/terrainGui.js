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

  const fadeFolder = gui.addFolder('Distance Fade');
  fadeFolder.add(settings, 'fadeDensity', 0, 0.02, 0.0001).onChange(handlers.updateFade);

  const skyFolder = gui.addFolder('Sky');
  skyFolder.add(settings, 'timeEnabled').name('time on/off').onChange(handlers.updateLight);
  skyFolder.add(settings, 'timeScale', 0, 4, 0.01).name('timeScale').onChange(handlers.updateLight);
  skyFolder.add(settings, 'timeOfDay', 0, 24, 0.1).name('timeOfDay').onChange(handlers.updateLight).listen();
  skyFolder.add(settings, 'season', ['spring', 'summer', 'autumn', 'winter']).name('season').onChange(handlers.updateLight);

  return gui;
}