# Procedural Terrain Engine

A vanilla JavaScript and Vite starter for a reusable Three.js procedural terrain engine.

## Features

- Procedural terrain mesh with seeded fractal noise
- Modular terrain generator suitable for future flight, driving, and FPS game modes
- Clean vanilla JS setup with Vite
- Live GUI controls for terrain, fog, and lighting tuning
- Chunked terrain tiles with render distance, wireframe mode, and runtime performance HUD

## Run

```bash
npm install
npm run dev
```

## Structure

- `src/main.js` boots the app
- `src/app.js` wires the scene, controls, GUI, and terrain system
- `src/core/` contains renderer, camera, scene, lighting, and state setup
- `src/systems/createTerrainSystem.js` owns terrain mesh and grid updates
- `src/ui/createTerrainGui.js` defines the live settings panel
- `src/terrain/ProceduralTerrain.js` builds the reusable terrain mesh
- `src/terrain/noise.js` provides deterministic height noise

## Next steps

The current demo is intentionally small. It is a base for adding chunk streaming, biome rules, vehicle physics, flight camera modes, and world persistence.