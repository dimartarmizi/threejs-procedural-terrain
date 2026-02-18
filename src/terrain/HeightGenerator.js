import { Noise } from './Noise.js';
import { BiomeMap } from './BiomeMap.js';
import { BiomeRegistry } from '../biomes/BiomeRegistry.js';

export class HeightGenerator {
	constructor(seed, settings = { terrainHeight: 1, terrainScale: 1 }) {
		this.seed = seed;
		this.biomeMap = new BiomeMap(seed);
		this.baseNoise = new Noise(seed + '_base');
		this.mountainNoise = new Noise(seed + '_mtn');
		this.detailNoise = new Noise(seed + '_det');
		this.settings = settings;
	}

	getHeight(x, z) {
		return this.getData(x, z).h;
	}

	getData(x, z) {
		const hMult = this.settings.terrainHeight || 1;
		const sMult = this.settings.terrainScale || 1;

		const temp = this.biomeMap.getTemperature(x, z);
		const moisture = this.biomeMap.getMoisture(x, z);

		// Get weights based only on temp/moisture (height=null)
		const weights = BiomeRegistry.getBiomeWeights(null, moisture, temp);

		let finalHeight = 0;

		for (const w of weights) {
			if (w.weight < 0.001) continue; // Optimization: skip negligible biomes
			
			const params = w.biome.heightParams;
			
			// Base height for this biome
			const base = this.baseNoise.fbm(
				x * 0.001 * sMult * params.scale, 
				z * 0.001 * sMult * params.scale, 
				4, 0.5, 2
			);
			
			// Biome specific mountain/roughness
			const mtn = this.mountainNoise.fbm(
				x * 0.003 * sMult * params.scale, 
				z * 0.003 * sMult * params.scale, 
				6, 0.5, 2
			);
			
			const detail = this.detailNoise.fbm(
				x * 0.015 * sMult * params.scale, 
				z * 0.015 * sMult * params.scale, 
				2, 0.5, 2
			);

			let h = params.base + (base * 20 * params.roughness);
			const mtnHeight = Math.pow(Math.max(0, mtn), 1.5) * 100 * params.roughness;
			h += mtnHeight;
			h += detail * 5 * params.roughness;

			finalHeight += h * w.weight;
		}

		return {
			h: finalHeight * hMult,
			temp,
			moisture
		};
	}
}
