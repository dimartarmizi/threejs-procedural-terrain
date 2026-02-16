export const Biomes = {
	OCEAN: {
		id: 'ocean',
		color: 0x4a4a4a, // Stony gray instead of blue
		minHeight: -Infinity,
		maxHeight: 5,
		temperature: 0.5,
		moisture: 0.8
	},
	BEACH: {
		id: 'beach',
		color: 0x8b8378, // Muted stony/sandy color
		minHeight: 5,
		maxHeight: 10,
		temperature: 0.7,
		moisture: 0.4
	},
	FOREST: {
		id: 'forest',
		color: 0x228b22,
		minHeight: 10,
		maxHeight: 60,
		temperature: 0.5,
		moisture: 0.7
	},
	PLAINS: {
		id: 'plains',
		color: 0x7cfc00,
		minHeight: 10,
		maxHeight: 60,
		temperature: 0.6,
		moisture: 0.4
	},
	DESERT: {
		id: 'desert',
		color: 0xedc9af,
		minHeight: 10,
		maxHeight: 80,
		temperature: 0.9,
		moisture: 0.1
	},
	MOUNTAIN: {
		id: 'mountain',
		color: 0x808080,
		minHeight: 60,
		maxHeight: 150,
		temperature: 0.3,
		moisture: 0.3
	},
	SNOW: {
		id: 'snow',
		color: 0xffffff,
		minHeight: 150,
		maxHeight: Infinity,
		temperature: 0.0,
		moisture: 0.5
	}
};

export class BiomeRegistry {
	static getBiome(height, moisture, temperature) {
		if (height < 5) return Biomes.OCEAN;
		if (height < 10) return Biomes.BEACH;

		if (height > 150) return Biomes.SNOW;
		if (height > 80) return Biomes.MOUNTAIN;

		if (temperature > 0.8) return Biomes.DESERT;
		if (moisture > 0.6) return Biomes.FOREST;

		return Biomes.PLAINS;
	}
}
