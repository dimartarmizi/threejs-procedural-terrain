import { Noise } from './Noise.js';

export class BiomeMap {
	constructor(seed) {
		this.tempNoise = new Noise(seed + '_temp');
		this.moistureNoise = new Noise(seed + '_moist');
	}

	getTemperature(x, z) {
		return this.tempNoise.fbm(x * 0.0001, z * 0.0001, 3) * 0.5 + 0.5;
	}

	getMoisture(x, z) {
		return this.moistureNoise.fbm(x * 0.0001, z * 0.0001, 3) * 0.5 + 0.5;
	}
}
