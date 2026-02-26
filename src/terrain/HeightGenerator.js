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

		const weights = BiomeRegistry.getBiomeWeights(null, moisture, temp);

		let finalHeight = 0;

		const warped = this.baseNoise.domainWarp(x * 0.0005, z * 0.0005, 2.0);

		for (const w of weights) {
			if (w.weight < 0.001) continue;

			const params = w.biome.heightParams;

			const base = this.baseNoise.fbm(
				warped.x * sMult * params.scale,
				warped.y * sMult * params.scale,
				4, 0.45, 2
			);

			const mtn = this.mountainNoise.ridgedFbm(
				x * 0.001 * sMult * params.scale,
				z * 0.001 * sMult * params.scale,
				4, 0.4, 2.0
			);

			const detail = this.detailNoise.fbm(
				x * 0.005 * sMult * params.scale,
				z * 0.005 * sMult * params.scale,
				2, 0.3, 2
			);

			let h = params.base + (base * 25 * params.roughness);
			
			if (params.roughness > 0.1) {
				const mtnHeight = Math.pow(Math.max(0, mtn), 1.6) * 100 * params.roughness;
				h += mtnHeight;
			}
			
			h += detail * 4 * params.roughness;

			finalHeight += h * w.weight;
		}

		return {
			h: finalHeight * hMult,
			temp,
			moisture
		};
	}
}
