blueprint.md
Procedural Terrain Engine (Three.js)
1. Overview

Procedural Terrain Engine adalah engine terrain berbasis web menggunakan Three.js yang dirancang untuk:

Infinite exploration (no hard world bounds)

Deterministic world generation (seed-based)

Multi-biome ecosystem

Time system (day/night cycle)

Dynamic weather system

Living elements (flora & fauna per biome)

Siap digunakan untuk:

Open world single player

Flight simulation

Exploration sandbox

Survival/simulation game

Fokus utama: sistem terrain procedural yang scalable dan reusable.

2. Core Architecture
src/
 ├── core/
 │   ├── Engine.ts
 │   ├── World.ts
 │   ├── ChunkManager.ts
 │   ├── EventBus.ts
 │
 ├── terrain/
 │   ├── Noise.ts
 │   ├── HeightGenerator.ts
 │   ├── BiomeMap.ts
 │   ├── TerrainMeshBuilder.ts
 │   ├── LODManager.ts
 │
 ├── biomes/
 │   ├── BiomeRegistry.ts
 │   ├── ForestBiome.ts
 │   ├── DesertBiome.ts
 │   ├── SnowBiome.ts
 │   ├── OceanBiome.ts
 │   ├── MountainBiome.ts
 │
 ├── life/
 │   ├── VegetationSystem.ts
 │   ├── FaunaSystem.ts
 │   ├── SpawnController.ts
 │
 ├── environment/
 │   ├── TimeSystem.ts
 │   ├── SkySystem.ts
 │   ├── WeatherSystem.ts
 │   ├── CloudSystem.ts
 │
 ├── utils/
 │   ├── SeededRandom.ts
 │   ├── MathUtils.ts
 │
 └── main.ts

3. Deterministic Seed System
3.1 Seeded Random Generator

Menggunakan custom PRNG (Mulberry32 / XorShift)

Semua sistem bergantung pada:

Terrain

Biome placement

Vegetation

Weather patterns

Fauna spawn

class SeededRandom {
  constructor(seed: number)
  next(): number
}

3.2 World Seed Rules

Input: string atau number

Di-hash ke 32-bit integer

Seluruh dunia = fungsi dari seed

Identik di semua device

4. Terrain Generation System
4.1 Noise Layering

Menggunakan:

Perlin Noise

Simplex Noise

FBM (Fractal Brownian Motion)

Ridged Noise (untuk pegunungan)

Height formula:

height =
  baseNoise * 0.6 +
  mountainNoise * 0.3 +
  detailNoise * 0.1

4.2 Chunk System (Infinite World)
Chunk Configuration

Chunk size: 128x128 units

Resolution configurable

Grid-based streaming

Chunk Coordinate
chunkX = floor(player.x / chunkSize)
chunkZ = floor(player.z / chunkSize)

Active Radius

3x3 → default

5x5 → flight mode

Dynamic scaling berdasarkan altitude

4.3 LOD System

LOD berbasis jarak:

Distance	LOD	Resolution
0–200m	0	High
200–600m	1	Medium
600m+	2	Low

Skirt mesh untuk seam prevention

Morphing LOD untuk smooth transition

5. Biome System
5.1 Biome Selection

Berdasarkan:

Elevation

Temperature

Moisture

Continentalness

BiomeMap menggunakan 2D noise map.

5.2 Biome Registry
interface Biome {
  name: string
  temperature: number
  moisture: number
  getSurfaceMaterial()
  spawnVegetation()
  spawnFauna()
}

5.3 Contoh Biome
Forest

Pohon

Semak

Rumput

Rusa

Burung

Desert

Cactus

Batu

Unta

Kadal

Snow

Pine tree

Batu es

Serigala

Kelinci salju

Ocean

Water plane

Ikan

Burung laut

Mountain

Cliff rock

Elang

Kambing gunung

6. Living Elements System
6.1 Vegetation System

Teknik:

GPU instancing

Density map per biome

Slope check

Elevation constraint

Spawn rule example:

if slope < 30° and moisture > 0.5 → allow trees

6.2 Fauna System

Spawn berdasarkan biome

Spawn radius dari player

Despawn system

Simple AI:

Wander

Flee

Idle

7. Time System
7.1 Time Flow

1 real second = X game seconds

Configurable day length

timeOfDay: 0 → 24

7.2 Day-Night Cycle

Directional light rotation

Sky color gradient

Ambient light interpolation

Shadow intensity change

8. Weather System
8.1 Weather Types

Clear

Cloudy

Rain

Storm

Snow

Fog

8.2 Weather Effects
Weather	Effects
Rain	Particle rain + dark sky
Storm	Lightning + heavy wind
Snow	Snow particles + white overlay
Fog	Exponential fog
9. Sky & Atmosphere

Menggunakan:

Physically-based sky shader

Dynamic sun position

Cloud layer noise animation

10. Water System

Gerstner waves

Reflection

Refraction

Depth color blending

11. Performance Strategy
11.1 GPU Instancing

Vegetation & rocks → InstancedMesh

11.2 Frustum Culling

Per chunk + per object group

11.3 Web Worker

Noise & chunk generation di worker thread

11.4 Memory Pool

Reusable geometry & material

12. Multiplayer Ready (Optional Extension)

Deterministic seed sync

Server authoritative position

Client terrain local generate

13. Config System
WorldConfig {
  seed: string
  chunkSize: number
  renderDistance: number
  enableWeather: boolean
  enableFauna: boolean
}

14. API Usage Example
const world = new World({
  seed: "my-world-001",
  chunkSize: 128,
  renderDistance: 3
})

world.start()

15. Expansion Scenarios

Engine ini dapat digunakan untuk:

Open world RPG

Flight simulator

Survival game

Nature exploration sandbox

Wildlife simulation

16. Future Improvements

River generation (erosion simulation)

Road/path procedural

Volumetric clouds

Biome blending shader

Terrain erosion simulation

Cave system (3D noise voxel)

17. Production Checklist

Deterministic seed verified

No visible chunk seam

Stable LOD transition

Weather sync with time

Memory leak test

60 FPS target (mid-tier GPU)