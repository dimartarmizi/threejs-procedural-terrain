import { Noise } from './Noise.js';

export class HeightGenerator {
	constructor(seed, settings = { terrainHeight: 1, terrainScale: 1 }) {
		this.baseNoise = new Noise(seed + '_base');
		this.mountainNoise = new Noise(seed + '_mtn');
		this.detailNoise = new Noise(seed + '_det');
		this.settings = settings;
	}

	getHeight(x, z) {
		const hMult = this.settings.terrainHeight || 1;
		const sMult = this.settings.terrainScale || 1;

		const base = this.baseNoise.fbm(x * 0.001 * sMult, z * 0.001 * sMult, 4, 0.5, 2);
		const mtn = this.mountainNoise.fbm(x * 0.003 * sMult, z * 0.003 * sMult, 6, 0.5, 2);
		const detail = this.detailNoise.fbm(x * 0.015 * sMult, z * 0.015 * sMult, 2, 0.5, 2);

		let h = base * 80 * hMult;
		const mtnHeight = Math.pow(Math.max(0, mtn), 1.5) * 180 * hMult;
		h += mtnHeight;
		h += detail * 8 * hMult;

		return h;
	}
}
