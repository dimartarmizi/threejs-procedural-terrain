export class TimeSystem {
	constructor(useRealTime = false, initialTime = 12.0) {
		this.time = initialTime;
		this.timeScale = 1.0;
		this.useRealTime = useRealTime;
		this.update(0);
	}

	update(deltaTime) {
		if (this.useRealTime) {
			const now = new Date();
			this.time = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
		} else {
			this.time += (deltaTime * this.timeScale) / 60.0;
			if (this.time >= 24) {
				this.time = 0;
			}
		}
		return this.time;
	}

	setTime(time) {
		this.time = time % 24;
	}

	getTimeString() {
		const hours = Math.floor(this.time);
		const minutes = Math.floor((this.time - hours) * 60);
		return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
	}
}
