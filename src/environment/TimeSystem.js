export class TimeSystem {
	constructor() {
		this.time = 12.0; // Start at noon
		this.timeScale = 1.0; // 1 real second = 1 game minute (24 minutes per day)
	}

	update(deltaTime) {
		this.time += (deltaTime * this.timeScale) / 60.0;
		if (this.time >= 24) {
			this.time = 0;
		}
		return this.time;
	}

	getTimeString() {
		const hours = Math.floor(this.time);
		const minutes = Math.floor((this.time - hours) * 60);
		return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
	}
}
