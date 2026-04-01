import alea from 'alea';
import { createNoise2D } from 'simplex-noise';

export function createSimplexNoise2D(seed = 1, octaves = 5) {
	const random = alea(String(seed));
	const noise2D = createNoise2D(random);

	return (x, y) => {
		let amplitude = 1;
		let frequency = 1;
		let sum = 0;
		let normalization = 0;

		for (let octave = 0; octave < octaves; octave += 1) {
			sum += noise2D(x * frequency, y * frequency) * amplitude;
			normalization += amplitude;
			amplitude *= 0.5;
			frequency *= 2;
		}

		return Math.max(-1, Math.min(1, sum / normalization));
	};
}