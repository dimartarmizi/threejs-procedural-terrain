export function createInfoOverlay(parent) {
	const root = document.createElement('div');
	root.className = 'info-overlay';
	root.innerHTML = [
		'<div class="info-row"><span>Pos</span><strong data-position>0, 0, 0</strong></div>',
		'<div class="info-row"><span>Ground</span><strong data-height>0</strong></div>',
		'<div class="info-row"><span>FPS</span><strong data-fps>0</strong></div>',
		'<div class="info-row"><span>CPU</span><strong data-cpu>0%</strong></div>',
		'<div class="info-row"><span>Memory</span><strong data-memory>n/a</strong></div>',
	].join('');
	parent.appendChild(root);

	const positionNode = root.querySelector('[data-position]');
	const heightNode = root.querySelector('[data-height]');
	const fpsNode = root.querySelector('[data-fps]');
	const cpuNode = root.querySelector('[data-cpu]');
	const memoryNode = root.querySelector('[data-memory]');

	return {
		update(metrics) {
			positionNode.textContent = metrics.positionText;
			heightNode.textContent = metrics.heightText;
			fpsNode.textContent = String(metrics.fps);
			cpuNode.textContent = metrics.cpuUsage.toFixed(0) + '%';
			memoryNode.textContent = metrics.memoryText;
		},
	};
}