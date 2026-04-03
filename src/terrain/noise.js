import alea from 'alea';
import { createNoise2D } from 'simplex-noise';

export function createSimplexNoise2D(seed, { octaves, persistence, lacunarity }) {
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
			amplitude *= persistence;
			frequency *= lacunarity;
		}

		return Math.max(-1, Math.min(1, sum / normalization));
	};
}