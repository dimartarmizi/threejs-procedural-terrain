
<p align="center">
  <img src="public/logo.webp" alt="Three.js Procedural Terrain" width="192">
</p>

# Three.js Procedural Terrain

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML) [![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript) [![simplex-noise](https://img.shields.io/badge/simplex--noise-FF6CBF?style=for-the-badge&logo=npm&logoColor=white)](https://www.npmjs.com/package/simplex-noise) [![Three.js](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/) [![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)

Three.js Procedural Terrain is a lightweight, client-side project for generating and exploring procedurally generated landscapes directly in the browser. It provides a chunked terrain pipeline, biome-driven surface rules, modular environment systems (sky, time, weather, water), and a simple vegetation/life system. Useful for demos, experiments, and small games.

![Preview](public/screenshot.webp)

## 🚀 Key Features

- **Chunked Streaming World**: Create and unload terrain chunks on demand for efficient memory and CPU usage.
- **Layered Noise Heightmaps**: Configurable noise layers produce varied mountains, plains, and valleys.
- **Biome Mapping**: Register biomes and generate biome-aware surface properties and colors.
- **Terrain Mesh Builder**: Generates per-chunk vertex data suitable for canvas/WebGL rendering.
- **Modular Environment Systems**: Time-of-day, sky rendering, weather, and water systems decoupled from core logic.
- **Vegetation System**: Procedural placement and simple updates for foliage and props.
- **Player & Camera**: First-person style movement and camera controls for exploration.

## 🛠️ Tech Stack

- Vanilla JavaScript (ES Modules).
- Vite for development and bundling.
- Canvas / WebGL rendering via lightweight engine code.
- Simple deterministic randomness via a seeded RNG.

## 📦 Getting Started

Follow these steps to get a local copy up and running.

### Prerequisites

* **Node.js**: Version 18.0.0 or higher
* **npm**: Usually comes with Node.js

### Installation & Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/dimartarmizi/threejs-procedural-terrain.git
   cd threejs-procedural-terrain
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173`.

4. **Build for production**
   ```bash
   npm run build
   ```
   Optimized files will be generated in the `dist/` folder.

## 📜 Technical Overview

1. `src/core/Engine.js` — application bootstrap, system orchestration, and main loop.
2. `src/terrain/Noise.js` & `src/terrain/HeightGenerator.js` — multi-layer noise and heightmap generation.
3. `src/terrain/TerrainMeshBuilder.js` — converts height data into renderable mesh data per chunk.
4. `src/biomes/BiomeRegistry.js` & `src/terrain/BiomeMap.js` — registers and maps biome rules to terrain.
5. `src/environment/*` — separate systems for sky, time, water, and weather effects.
6. `src/life/VegetationSystem.js` — procedural placement and simple runtime updates for vegetation.

## 📧 Contact

If you have any questions, suggestions, or just want to reach out, feel free to contact me at [dimartarmizi@gmail.com](mailto:dimartarmizi@gmail.com).

## ⚖️ License

This project is open-source and available under the [MIT License](LICENSE).