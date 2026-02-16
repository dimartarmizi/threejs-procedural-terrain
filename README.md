# Procedural Infinite Terrain Engine

A high-performance, aesthetically pleasing infinite procedural terrain engine built with **Three.js** and **Vanilla JavaScript**. This project features a multi-biome ecosystem, dynamic environment systems, and optimized GPU-based rendering.

## 🌟 Key Features

-   **Infinite World**: Automated chunk management system that loads and unloads terrain chunks based on camera movement.
-   **Multi-Biome Ecosystem**: Includes Forest, Desert, Snow, Mountains, Plains, Beach, and Ocean biomes with smooth color transitions.
-   **Dynamic Environment**: 
    -   24-hour Day/Night cycle.
    -   Dynamic sun position, light intensity, and sky colors.
    -   Animated cloud system and realistic fog.
-   **Varied Vegetation**:
    -   Multiple tree species (Oak, Pine, Palm, Poplar, Cactus, Shrubs) distributed intelligently by biome.
    -   Efficient rendering using `InstancedMesh` for high-density forests.
-   **Technical Optimizations**:
    -   **Level of Detail (LOD)**: Terrain vertex resolution decreases with distance to maintain 60 FPS.
    -   **GPU Instancing**: Vegetation is rendered in batches to minimize draw calls.
    -   **Real-time Shadows**: Dynamic shadow system that follows the player for consistent depth.
-   **Interactive GUI**: Real-time controls for:
    -   World Seed and Render Distance.
    -   Time Scale and Environmental density.
    -   Lighting and Shadow toggles.
    -   Water height and color.

## 🚀 Getting Started

### Prerequisites

-   [Node.js](https://nodejs.org/) (v16.x or later recommended)
-   npm (comes with Node.js)

### Installation

1.  Clone or download this repository.
2.  Open a terminal in the project directory.
3.  Install dependencies:
    ```bash
    npm install
    ```

### Running Locally

To start the development server with hot-module replacement:
```bash
npm run dev
```
The application will usually be available at `http://localhost:5173`.

## 🛠 Tech Stack

-   **Core**: [Three.js](https://threejs.org/) (3D Engine)
-   **Logic**: Vanilla JavaScript (ES6+)
-   **Noise**: Simplex Noise for terrain and biome generation.
-   **UI**: [lil-gui](https://georgealways.github.io/lil-gui/) for the debug panel.
-   **Build Tool**: [Vite](https://vitejs.dev/)

## 🎨 Acknowledgments

-   Built as a showcase for procedural world generation.
-   Low-poly aesthetics inspired by modern stylized 3D games.
-   Special thanks to the Three.js community.
