import { createNoise2D } from 'simplex-noise';
import { SeededRandom } from '../utils/SeededRandom.js';

export class Noise {
	constructor(seed) {
		const prng = new SeededRandom(seed);
		const noise2D = createNoise2D(() => prng.next());
		this.noise2D = noise2D;
	}

	get(x, y) {
		return this.noise2D(x, y);
	}

	fbm(x, y, octaves = 4, persistence = 0.5, lacunarity = 2.0) {
		let total = 0;
		let frequency = 1;
		let amplitude = 1;
		let maxValue = 0;

		for (let i = 0; i < octaves; i++) {
			total += this.noise2D(x * frequency, y * frequency) * amplitude;
			maxValue += amplitude;
			amplitude *= persistence;
			frequency *= lacunarity;
		}

		return total / maxValue;
	}
}
