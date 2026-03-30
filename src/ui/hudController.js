export class HudController {
	constructor() {
		this.fpsElem = document.getElementById('fps');
		this.cpuElem = document.getElementById('cpu-usage');
		this.memoryElem = document.getElementById('memory-usage');
		this.timeElem = document.getElementById('time');
		this.coordsElem = document.getElementById('coords');
		this.biomeElem = document.getElementById('biome');
		this.instructionElem = document.getElementById('fps-instruction');
	}

	setInstructionVisible(visible) {
		if (this.instructionElem) {
			this.instructionElem.style.display = visible ? 'block' : 'none';
		}
	}

	updateWorldInfo(info = {}) {
		if (this.timeElem && info.time !== undefined) {
			this.timeElem.innerText = `Time: ${info.time}`;
		}

		if (this.coordsElem && info.x !== undefined && info.z !== undefined) {
			this.coordsElem.innerText = `X: ${info.x.toFixed(0)}, Z: ${info.z.toFixed(0)}`;
		}

		if (this.biomeElem && info.biomeId !== undefined) {
			const biomeLabel = info.biomeId ? info.biomeId.toUpperCase() : '-';
			this.biomeElem.innerText = `Biome: ${biomeLabel}`;
		}
	}

	updatePerformance(fps, avgBusy) {
		if (this.fpsElem) this.fpsElem.textContent = `FPS: ${fps}`;

		if (this.cpuElem) {
			const cpuPercent = Math.round(Math.min(100, (avgBusy / (1000 / 60)) * 100));
			this.cpuElem.textContent = `CPU: ${cpuPercent}% (${avgBusy.toFixed(1)} ms)`;
		}

		if (this.memoryElem) {
			if (performance && performance.memory) {
				const mem = performance.memory;
				const usedMB = (mem.usedJSHeapSize / 1024 / 1024).toFixed(1);
				let totalMB = '';
				if (mem.totalJSHeapSize) totalMB = ` / ${(mem.totalJSHeapSize / 1024 / 1024).toFixed(1)} MB`;
				this.memoryElem.textContent = `Memory: ${usedMB} MB${totalMB}`;
			} else {
				this.memoryElem.textContent = 'Memory: n/a';
			}
		}
	}
}