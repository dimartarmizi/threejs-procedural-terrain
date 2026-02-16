export class SeededRandom {
	constructor(seed) {
		if (typeof seed === 'string') {
			this.seed = this.hashString(seed);
		} else {
			this.seed = seed || 0;
		}
	}

	hashString(str) {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			hash = ((hash << 5) - hash) + str.charCodeAt(i);
			hash |= 0;
		}
		return hash;
	}

	// mulberry32
	next() {
		let t = this.seed += 0x6D2B79F5;
		t = Math.imul(t ^ t >>> 15, t | 1);
		t ^= t + Math.imul(t ^ t >>> 7, t | 61);
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	}

	range(min, max) {
		return min + this.next() * (max - min);
	}

	rangeInt(min, max) {
		return Math.floor(this.range(min, max));
	}
}
