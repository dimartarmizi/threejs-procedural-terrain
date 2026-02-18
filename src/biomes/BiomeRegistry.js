import * as THREE from 'three';

export const Biomes = {
	OCEAN: {
		id: 'ocean',
		color: new THREE.Color(0x3f76e4),
		idealHeight: 0,
		idealTemp: 0.5,
		idealMoisture: 0.8,
		heightParams: { base: -10, roughness: 0.2, scale: 0.5 }
	},
	BEACH: {
		id: 'beach',
		color: new THREE.Color(0xf2e6b5),
		idealHeight: 7,
		idealTemp: 0.7,
		idealMoisture: 0.4,
		heightParams: { base: 2, roughness: 0.1, scale: 1.0 }
	},
	FOREST: {
		id: 'forest',
		color: new THREE.Color(0x056621),
		idealHeight: 30,
		idealTemp: 0.5,
		idealMoisture: 0.8,
		heightParams: { base: 20, roughness: 0.5, scale: 1.0 }
	},
	PLAINS: {
		id: 'plains',
		color: new THREE.Color(0x8db360),
		idealHeight: 25,
		idealTemp: 0.6,
		idealMoisture: 0.4,
		heightParams: { base: 15, roughness: 0.3, scale: 0.8 }
	},
	DESERT: {
		id: 'desert',
		color: new THREE.Color(0xfae979),
		idealHeight: 40,
		idealTemp: 0.9,
		idealMoisture: 0.1,
		heightParams: { base: 30, roughness: 0.4, scale: 0.5 }
	},
	MOUNTAIN: {
		id: 'mountain',
		color: new THREE.Color(0x717171),
		idealHeight: 100,
		idealTemp: 0.3,
		idealMoisture: 0.3,
		heightParams: { base: 80, roughness: 1.5, scale: 2.0 }
	},
	SNOW: {
		id: 'snow',
		color: new THREE.Color(0xffffff),
		idealHeight: 180,
		idealTemp: 0.0,
		idealMoisture: 0.5,
		heightParams: { base: 120, roughness: 1.2, scale: 1.5 }
	}
};

export class BiomeRegistry {
	static getBiome(height, moisture, temperature) {
		const weights = this.getBiomeWeights(height, moisture, temperature);
		let bestBiome = weights[0].biome;
		let maxWeight = weights[0].weight;

		for (let i = 1; i < weights.length; i++) {
			if (weights[i].weight > maxWeight) {
				maxWeight = weights[i].weight;
				bestBiome = weights[i].biome;
			}
		}
		return bestBiome;
	}

	static getBiomeWeights(height, moisture, temperature) {
		const weights = [];
		let totalWeight = 0;

		for (const key in Biomes) {
			const b = Biomes[key];

			const hDist = height !== null ? (height - b.idealHeight) / 50 : 0;
			const tDist = temperature - b.idealTemp;
			const mDist = moisture - b.idealMoisture;

			const distSq = hDist * hDist + tDist * tDist + mDist * mDist + 0.0001;
			let weight = 1.0 / (distSq * distSq);

			// Special hard constraints only if height is known
			if (height !== null) {
				if (height < 2 && b.id !== 'ocean') weight *= 0.01;
				else if (height > 160 && b.id !== 'snow') weight *= 0.01;
			}

			weights.push({ biome: b, weight });
			totalWeight += weight;
		}

		// Pre-calculate weight factor
		const invTotalWeight = 1.0 / totalWeight;
		for (let i = 0; i < weights.length; i++) {
			weights[i].weight *= invTotalWeight;
		}

		return weights;
	}

	static getBlendedColor(height, moisture, temperature) {
		const weights = this.getBiomeWeights(height, moisture, temperature);
		const resultColor = new THREE.Color(0, 0, 0);

		for (const w of weights) {
			resultColor.r += w.biome.color.r * w.weight;
			resultColor.g += w.biome.color.g * w.weight;
			resultColor.b += w.biome.color.b * w.weight;
		}

		return resultColor;
	}
}
