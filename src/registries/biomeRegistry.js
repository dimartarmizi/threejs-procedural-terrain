import * as THREE from 'three';

export const Biomes = {
	OCEAN: {
		id: 'ocean',
		color: new THREE.Color(0x1a45a0),
		idealHeight: -20,
		idealTemp: 0.5,
		idealMoisture: 0.9,
		heightParams: { base: -25, roughness: 0.02, scale: 0.3 }
	},
	BEACH: {
		id: 'beach',
		color: new THREE.Color(0xd2b48c),
		idealHeight: 2,
		idealTemp: 0.6,
		idealMoisture: 0.5,
		heightParams: { base: 1, roughness: 0.05, scale: 0.8 }
	},
	FOREST: {
		id: 'forest',
		color: new THREE.Color(0x2d4c1e),
		idealHeight: 30,
		idealTemp: 0.5,
		idealMoisture: 0.7,
		heightParams: { base: 22, roughness: 0.4, scale: 1.0 }
	},
	PLAINS: {
		id: 'plains',
		color: new THREE.Color(0x567d46),
		idealHeight: 25,
		idealTemp: 0.6,
		idealMoisture: 0.4,
		heightParams: { base: 18, roughness: 0.35, scale: 0.8 }
	},
	DESERT: {
		id: 'desert',
		color: new THREE.Color(0xbf9b30),
		idealHeight: 45,
		idealTemp: 0.9,
		idealMoisture: 0.1,
		heightParams: { base: 35, roughness: 0.45, scale: 0.55 }
	},
	MOUNTAIN: {
		id: 'mountain',
		color: new THREE.Color(0x4a4a4a),
		idealHeight: 110,
		idealTemp: 0.3,
		idealMoisture: 0.3,
		heightParams: { base: 90, roughness: 1.8, scale: 2.2 }
	},
	SNOW: {
		id: 'snow',
		color: new THREE.Color(0xdee2ff),
		idealHeight: 200,
		idealTemp: 0.0,
		idealMoisture: 0.5,
		heightParams: { base: 140, roughness: 1.3, scale: 1.6 }
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

			if (height !== null) {
				if (height < 2 && b.id !== 'ocean') weight *= 0.01;
				else if (height > 160 && b.id !== 'snow') weight *= 0.01;
			}

			weights.push({ biome: b, weight });
			totalWeight += weight;
		}

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
