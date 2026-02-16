export const MathUtils = {
	lerp: (a, b, t) => a + (b - a) * t,

	clamp: (val, min, max) => Math.max(min, Math.min(max, val)),

	smoothstep: (min, max, value) => {
		const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
		return x * x * (3 - 2 * x);
	},

	invLerp: (a, b, v) => (v - a) / (b - a),

	remap: (v, inMin, inMax, outMin, outMax) => {
		const t = (v - inMin) / (inMax - inMin);
		return outMin + t * (outMax - outMin);
	}
};
