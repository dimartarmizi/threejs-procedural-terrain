export function createOrbitMode(controls) {
	return {
		setEnabled(nextEnabled) {
			controls.enabled = nextEnabled;
			if (nextEnabled) {
				controls.update();
			}
		},
		update() {
			controls.update();
		},
		dispose() {},
	};
}
