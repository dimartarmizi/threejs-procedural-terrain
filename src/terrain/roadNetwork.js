function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
	return a + (b - a) * t;
}

function hash2D(ix, iz, seed) {
	let h = (Math.imul(ix | 0, 374761393) ^ Math.imul(iz | 0, 668265263) ^ Math.imul(seed | 0, 1442695041)) >>> 0;
	h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
	return (h ^ (h >>> 16)) >>> 0;
}

function seededRand(seed) {
	let s = seed >>> 0;
	return () => {
		s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
		return s / 4294967296;
	};
}

function estimateSlope(terrain, wx, wz, step) {
	const hL = terrain.sampleHeight(wx - step, wz);
	const hR = terrain.sampleHeight(wx + step, wz);
	const hD = terrain.sampleHeight(wx, wz - step);
	const hU = terrain.sampleHeight(wx, wz + step);
	const dx = (hR - hL) / (2 * step);
	const dz = (hU - hD) / (2 * step);
	return Math.hypot(dx, dz);
}

function catmullRom(p0, p1, p2, p3, t) {
	const t2 = t * t;
	const t3 = t2 * t;
	return 0.5 * (
		(2 * p1) +
		(-p0 + p2) * t +
		(2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
		(-p0 + 3 * p1 - 3 * p2 + p3) * t3
	);
}

function distToSegmentSq(px, pz, ax, az, bx, bz) {
	const dx = bx - ax;
	const dz = bz - az;
	const lenSq = dx * dx + dz * dz;
	if (lenSq < 1e-6) {
		const ex = px - ax;
		const ez = pz - az;
		return { distSq: ex * ex + ez * ez, t: 0, dx: 1, dz: 0 };
	}
	const t = clamp(((px - ax) * dx + (pz - az) * dz) / lenSq, 0, 1);
	const cx = ax + dx * t;
	const cz = az + dz * t;
	const ex = px - cx;
	const ez = pz - cz;
	return { distSq: ex * ex + ez * ez, t, dx, dz };
}

export function sampleTerrainGridHeight(terrain, wx, wz, resolution = terrain.tileResolution) {
	const tileSize = terrain.tileSize;
	const step = tileSize / resolution;
	const shiftedX = wx + tileSize * 0.5;
	const shiftedZ = wz + tileSize * 0.5;
	const ix = Math.floor(shiftedX / step);
	const iz = Math.floor(shiftedZ / step);

	const x0 = ix * step - tileSize * 0.5;
	const z0 = iz * step - tileSize * 0.5;
	const u = clamp((wx - x0) / step, 0, 1);
	const v = clamp((wz - z0) / step, 0, 1);

	const h00 = terrain.sampleHeight(x0, z0);
	const h10 = terrain.sampleHeight(x0 + step, z0);
	const h01 = terrain.sampleHeight(x0, z0 + step);
	const h11 = terrain.sampleHeight(x0 + step, z0 + step);

	if (u + v <= 1) {
		return h00 + u * (h10 - h00) + v * (h01 - h00);
	}
	return h11 + (1 - u) * (h01 - h11) + (1 - v) * (h10 - h11);
}

export class RoadNetwork {
	constructor(terrain) {
		this.terrain = terrain;
		this.settlementCache = new Map();
		this.edgeCache = new Map();
		this.junctionCache = new Map();

		const worldUnit = clamp(terrain.scale / 5000, 0.14, 2.0);
		this.worldUnit = worldUnit;
		this.propScale = clamp(terrain.tileSize / 2048, 0.28, 1.0);
		this.cellSize = Math.max(380, 2200 * worldUnit);
		this.roadWidth = Math.max(8.2, 28 * worldUnit);
		this.shoulderWidth = Math.max(2.6, 8.5 * worldUnit);
		this.sampleStep = Math.max(4.5, 13 * worldUnit);
		this.slopeStep = Math.max(5.0, 22 * worldUnit);
		this.waterThreshold = Math.max(1.2, 2.5 * worldUnit);
		this.bankThreshold = Math.max(2.2, 4.5 * worldUnit);
		this.bridgeMinY = Math.max(3.6, 11.0 * worldUnit);
		this.maxBridgeLength = this.cellSize * 0.55;
		this.minRavineDepth = Math.max(4.5, 14.0 * worldUnit);
		this.maxRoadGrade = 0.20;
		this.rimFlatGrade = 0.085;
		this.minSettlementHeight = Math.max(4.0, terrain.heightMultiplier * 0.015);
		this.maxSettlementHeight = terrain.baseHeight + terrain.heightMultiplier * 0.35;
	}

	getSettlement(cx, cz) {
		const key = `${cx}:${cz}`;
		if (this.settlementCache.has(key)) {
			return this.settlementCache.get(key);
		}

		if (this.terrain.terrainType === 'desert') {
			this.settlementCache.set(key, null);
			return null;
		}

		const rand = seededRand(hash2D(cx, cz, this.terrain.seed + 101));
		// Leave ~22% of cells as open countryside/farmland so villages don't form a rigid grid
		if (rand() < 0.22) {
			this.settlementCache.set(key, null);
			return null;
		}
		const minX = cx * this.cellSize;
		const minZ = cz * this.cellSize;

		let best = null;
		let bestScore = Infinity;

		for (let attempt = 0; attempt < 18; attempt++) {
			const wx = minX + (0.08 + rand() * 0.84) * this.cellSize;
			const wz = minZ + (0.08 + rand() * 0.84) * this.cellSize;
			const h = this.terrain.sampleHeight(wx, wz);

			if (h < this.minSettlementHeight || h > this.maxSettlementHeight) continue;

			const slope = estimateSlope(this.terrain, wx, wz, this.slopeStep);
			if (slope > 0.20) continue;

			// Prefer flat lowland/valley areas (where farmland naturally appears)
			const elevNorm = (h - this.minSettlementHeight) / Math.max(1, this.maxSettlementHeight - this.minSettlementHeight);
			const score = slope * 4.5 + elevNorm * 0.85 + rand() * 0.12;
			if (score < bestScore) {
				bestScore = score;
				best = {
					id: key,
					cx,
					cz,
					x: wx,
					z: wz,
					y: h,
					radius: (130 + rand() * 110) * this.propScale,
					houseCount: 10 + Math.floor(rand() * 10),
					seed: hash2D(cx, cz, this.terrain.seed + 997),
				};
			}
		}

		this.settlementCache.set(key, best);
		return best;
	}

	getEdgeKey(ax, az, bx, bz) {
		if (ax < bx || (ax === bx && az < bz)) {
			return `${ax}:${az}|${bx}:${bz}`;
		}
		return `${bx}:${bz}|${ax}:${az}`;
	}

	shouldConnect(a, b) {
		const dx = b.x - a.x;
		const dz = b.z - a.z;
		const distSq = dx * dx + dz * dz;
		const maxDist = this.cellSize * 2.25;
		if (distSq > maxDist * maxDist) return false;

		// Relative Neighborhood Graph (RNG): connect A and B only if no other settlement C
		// is strictly closer to BOTH A and B than A and B are to each other.
		// RNG is planar, connected, and produces natural highways (degree ~2-3) instead of 5-6 way stars.
		const minCX = Math.min(a.cx, b.cx) - 1;
		const maxCX = Math.max(a.cx, b.cx) + 1;
		const minCZ = Math.min(a.cz, b.cz) - 1;
		const maxCZ = Math.max(a.cz, b.cz) + 1;

		let aHasCloser = false;
		let bHasCloser = false;

		for (let cz = minCZ; cz <= maxCZ; cz++) {
			for (let cx = minCX; cx <= maxCX; cx++) {
				if ((cx === a.cx && cz === a.cz) || (cx === b.cx && cz === b.cz)) continue;
				const c = this.getSettlement(cx, cz);
				if (!c) continue;
				const dax = c.x - a.x;
				const daz = c.z - a.z;
				const daSq = dax * dax + daz * daz;
				const dbx = c.x - b.x;
				const dbz = c.z - b.z;
				const dbSq = dbx * dbx + dbz * dbz;

				if (daSq < distSq) aHasCloser = true;
				if (dbSq < distSq) bHasCloser = true;

				// Lune test (slightly relaxed factor 0.98 keeps graph organic & sparse)
				if (daSq < distSq * 0.98 && dbSq < distSq * 0.98) {
					return false;
				}
			}
		}

		// Deterministically thin some redundant long loop edges when both villages already have closer links
		if (aHasCloser && bHasCloser && distSq > (this.cellSize * 1.25) * (this.cellSize * 1.25)) {
			const edgeSeed = hash2D(a.cx + b.cx * 31, a.cz + b.cz * 31, this.terrain.seed + 503);
			if ((edgeSeed % 100) < 28) {
				return false;
			}
		}

		return true;
	}

	getRoadEdge(ax, az, bx, bz) {
		const key = this.getEdgeKey(ax, az, bx, bz);
		if (this.edgeCache.has(key)) {
			return this.edgeCache.get(key);
		}

		const a = this.getSettlement(ax, az);
		const b = this.getSettlement(bx, bz);
		if (!a || !b || !this.shouldConnect(a, b)) {
			this.edgeCache.set(key, null);
			return null;
		}

		const road = this.buildRoadBetween(a, b, key);
		this.edgeCache.set(key, road);
		return road;
	}

	evaluateWaypointCost(wx, wz) {
		const h = this.terrain.sampleHeight(wx, wz);
		const slope = estimateSlope(this.terrain, wx, wz, this.slopeStep);
		const maxPreferredH = this.terrain.baseHeight + this.terrain.heightMultiplier * 0.42;

		let cost = slope * 14.0;
		if (slope > 0.24) {
			cost += (slope - 0.24) * 35.0;
		}
		if (h > maxPreferredH) {
			cost += ((h - maxPreferredH) / Math.max(1, this.terrain.heightMultiplier)) * 22.0;
		}
		if (h < this.waterThreshold) {
			// Moderate water penalty so road crosses rivers cleanly at narrow/perpendicular points
			// rather than running lengthwise along rivers.
			cost += 6.5 + Math.max(0, -h) * 0.15;
		} else if (slope < 0.12 && h < this.maxSettlementHeight) {
			// Slight bonus for flat lowland/farmland valleys
			cost -= 0.4;
		}
		return cost;
	}

	buildRoadBetween(a, b, id) {
		const totalDist = Math.hypot(b.x - a.x, b.z - a.z);
		const controlCount = clamp(Math.round(totalDist / (this.cellSize * 0.14)), 6, 16);
		const controls = [];

		// Gentle deterministic S-curve meander so roads curve organically across valleys
		const dirX = (b.x - a.x) / (totalDist || 1);
		const dirZ = (b.z - a.z) / (totalDist || 1);
		const perpX = -dirZ;
		const perpZ = dirX;
		const mRand = seededRand(hash2D(a.cx * 17 + b.cx, a.cz * 17 + b.cz, this.terrain.seed + 773));
		const meanderAmp1 = (mRand() - 0.5) * totalDist * 0.16;
		const meanderAmp2 = (mRand() - 0.5) * totalDist * 0.09;
		const meanderPhase = mRand() * Math.PI * 2;

		for (let i = 0; i <= controlCount; i++) {
			const t = i / controlCount;
			const env = Math.sin(t * Math.PI);
			const wave = (Math.sin(t * Math.PI) * meanderAmp1 + Math.sin(t * Math.PI * 2 + meanderPhase) * meanderAmp2) * env;
			controls.push({
				x: lerp(a.x, b.x, t) + perpX * wave,
				z: lerp(a.z, b.z, t) + perpZ * wave,
			});
		}

		// Terrain-aware lateral relaxation to route around steep hills & follow valleys
		const maxOffsetStep = this.cellSize * 0.065;
		for (let pass = 0; pass < 7; pass++) {
			const stepScale = maxOffsetStep * (1 - pass * 0.1);
			for (let i = 1; i < controlCount; i++) {
				const prev = controls[i - 1];
				const curr = controls[i];
				const next = controls[i + 1];

				const tx = next.x - prev.x;
				const tz = next.z - prev.z;
				const tLen = Math.hypot(tx, tz) || 1;
				const nx = -tz / tLen;
				const nz = tx / tLen;

				const midX = (prev.x + next.x) * 0.5;
				const midZ = (prev.z + next.z) * 0.5;

				let bestX = curr.x;
				let bestZ = curr.z;
				let bestCost = Infinity;

				for (let k = -2; k <= 2; k++) {
					const cx = curr.x + nx * stepScale * k;
					const cz = curr.z + nz * stepScale * k;
					// Smoothness/curvature penalty to keep bends organic
					const bendDist = Math.hypot(cx - midX, cz - midZ) / Math.max(1, tLen * 0.5);
					const cost = this.evaluateWaypointCost(cx, cz) + bendDist * bendDist * 2.2;
					if (cost < bestCost) {
						bestCost = cost;
						bestX = cx;
						bestZ = cz;
					}
				}

				curr.x = lerp(curr.x, bestX, 0.65);
				curr.z = lerp(curr.z, bestZ, 0.65);
			}
		}

		// Extra Laplacian smoothing passes on interior control points for silky curves
		for (let sp = 0; sp < 2; sp++) {
			for (let i = 1; i < controlCount; i++) {
				const prev = controls[i - 1];
				const curr = controls[i];
				const next = controls[i + 1];
				curr.x = curr.x * 0.5 + (prev.x + next.x) * 0.25;
				curr.z = curr.z * 0.5 + (prev.z + next.z) * 0.25;
			}
		}

		// Resample with Catmull-Rom spline at uniform density
		const points = [];
		const approxSteps = Math.max(16, Math.ceil(totalDist / this.sampleStep));
		const segCount = controls.length - 1;

		for (let i = 0; i <= approxSteps; i++) {
			const u = (i / approxSteps) * segCount;
			const segIdx = Math.min(segCount - 1, Math.floor(u));
			const localT = u - segIdx;

			const p0 = controls[Math.max(0, segIdx - 1)];
			const p1 = controls[segIdx];
			const p2 = controls[Math.min(segCount, segIdx + 1)];
			const p3 = controls[Math.min(segCount, segIdx + 2)];

			const x = catmullRom(p0.x, p1.x, p2.x, p3.x, localT);
			const z = catmullRom(p0.z, p1.z, p2.z, p3.z, localT);
			const terrainY = this.terrain.sampleHeight(x, z);

			points.push({
				x,
				z,
				terrainY,
				roadY: terrainY,
				isBridge: false,
				tx: 0,
				tz: 1,
				rx: 1,
				rz: 0,
			});
		}

		// Compute tangents & right vectors
		for (let i = 0; i < points.length; i++) {
			const prev = points[Math.max(0, i - 1)];
			const next = points[Math.min(points.length - 1, i + 1)];
			const dx = next.x - prev.x;
			const dz = next.z - prev.z;
			const len = Math.hypot(dx, dz) || 1;
			points[i].tx = dx / len;
			points[i].tz = dz / len;
			points[i].rx = -points[i].tz;
			points[i].rz = points[i].tx;
		}

		// Detect river crossings and deep ravines/canyons, spanning from upper rim A to upper rim B
		const bridges = [];
		const nPts = points.length;
		const cumDist = new Float32Array(nPts);
		for (let k = 1; k < nPts; k++) {
			cumDist[k] = cumDist[k - 1] + Math.hypot(points[k].x - points[k - 1].x, points[k].z - points[k - 1].z);
		}

		const spanRanges = [];
		let i = 1;
		while (i < nPts - 1) {
			const segLenPrev = Math.max(0.001, cumDist[i] - cumDist[i - 1]);
			const dropGrade = (points[i - 1].terrainY - points[i].terrainY) / segLenPrev;
			const isWaterSeed = points[i].terrainY < this.waterThreshold;
			const isRavineSeed = dropGrade > this.maxRoadGrade;

			if (!isWaterSeed && !isRavineSeed) {
				i += 1;
				continue;
			}

			// Walk backward to the upper rim (side A) of the gorge/river
			let start = i - 1;
			while (start > 0) {
				if (cumDist[i] - cumDist[start - 1] > this.maxBridgeLength * 0.55) break;
				const dSeg = Math.max(0.001, cumDist[start] - cumDist[start - 1]);
				const climbOutGrade = (points[start - 1].terrainY - points[start].terrainY) / dSeg;
				if (points[start].terrainY < this.bankThreshold || climbOutGrade > this.rimFlatGrade) {
					start -= 1;
				} else {
					break;
				}
			}

			// Walk forward past the bottom/water and up to the opposite upper rim (side B)
			let end = i;
			// Phase 1: descend to valley/river floor and cross water
			while (end < nPts - 1) {
				if (cumDist[end] - cumDist[start] > this.maxBridgeLength) break;
				const dSeg = Math.max(0.001, cumDist[end + 1] - cumDist[end]);
				const grade = (points[end + 1].terrainY - points[end].terrainY) / dSeg;
				if (points[end].terrainY < this.bankThreshold || grade <= 0.02) {
					end += 1;
				} else {
					break;
				}
			}
			// Phase 2: climb up the opposite canyon wall to the upper rim
			while (end < nPts - 1) {
				if (cumDist[end + 1] - cumDist[start] > this.maxBridgeLength) break;
				const dSeg = Math.max(0.001, cumDist[end + 1] - cumDist[end]);
				const climbUpGrade = (points[end + 1].terrainY - points[end].terrainY) / dSeg;
				if (points[end].terrainY < this.bankThreshold || climbUpGrade > this.rimFlatGrade) {
					end += 1;
				} else {
					break;
				}
			}

			// Validate that this span actually crosses water or a significant ravine
			let hasWater = false;
			let maxDepthBelowChord = 0;
			const startY = Math.max(points[start].terrainY, this.bridgeMinY * 0.8);
			const endY = Math.max(points[end].terrainY, this.bridgeMinY * 0.8);
			const totalSpanDist = Math.max(0.001, cumDist[end] - cumDist[start]);

			// Trim if interior terrain pokes above the rim-to-rim chord
			let validSpan = end - start >= 2;
			if (validSpan) {
				for (let k = start + 1; k < end; k++) {
					if (points[k].terrainY < this.waterThreshold) hasWater = true;
					const t = (cumDist[k] - cumDist[start]) / totalSpanDist;
					const chordY = Math.max(this.bridgeMinY, lerp(startY, endY, t));
					const depth = chordY - points[k].terrainY;
					if (depth > maxDepthBelowChord) maxDepthBelowChord = depth;
				}
			}

			// Reject unrealistic ocean causeways (long water spans with submerged endpoints)
			if (hasWater && (points[start].terrainY < this.waterThreshold || points[end].terrainY < this.waterThreshold)) {
				return null;
			}
			if (hasWater && totalSpanDist > this.maxBridgeLength) {
				return null;
			}

			if (validSpan && (hasWater || maxDepthBelowChord >= this.minRavineDepth)) {
				// Merge with previous span if they overlap or are nearly touching
				if (spanRanges.length > 0 && start <= spanRanges[spanRanges.length - 1].end + 3) {
					const prev = spanRanges[spanRanges.length - 1];
					if (cumDist[end] - cumDist[prev.start] <= this.maxBridgeLength * 1.15) {
						prev.end = Math.max(prev.end, end);
					} else {
						spanRanges.push({ start, end });
					}
				} else {
					spanRanges.push({ start, end });
				}
				i = end + 1;
			} else {
				i += 1;
			}
		}

		// Apply rim-to-rim bridge elevation profiles
		for (let s = 0; s < spanRanges.length; s++) {
			const { start, end } = spanRanges[s];
			const spanLen = Math.max(0.001, cumDist[end] - cumDist[start]);
			const deckStartY = Math.max(points[start].terrainY, this.bridgeMinY);
			const deckEndY = Math.max(points[end].terrainY, this.bridgeMinY);
			const archHeight = Math.min(spanLen * 0.015, Math.max(1.0, 4.5 * this.worldUnit));

			for (let k = start; k <= end; k++) {
				const t = (cumDist[k] - cumDist[start]) / spanLen;
				const baseDeck = lerp(deckStartY, deckEndY, t);
				const arch = Math.sin(t * Math.PI) * archHeight;
				const minDeck = Math.max(this.bridgeMinY, points[k].terrainY + 0.35);
				points[k].roadY = Math.max(minDeck, baseDeck + arch);
				points[k].isBridge = true;
			}

			// Smooth approach ramps right before start and after end
			const rampLen = 4;
			for (let r = 1; r <= rampLen; r++) {
				const idxBefore = start - r;
				if (idxBefore >= 0 && !points[idxBefore].isBridge) {
					const blend = 1 - r / (rampLen + 1);
					points[idxBefore].roadY = Math.max(
						points[idxBefore].terrainY,
						lerp(points[idxBefore].terrainY, points[start].roadY, blend * blend)
					);
				}
				const idxAfter = end + r;
				if (idxAfter < nPts && !points[idxAfter].isBridge) {
					const blend = 1 - r / (rampLen + 1);
					points[idxAfter].roadY = Math.max(
						points[idxAfter].terrainY,
						lerp(points[idxAfter].terrainY, points[end].roadY, blend * blend)
					);
				}
			}

			const midIdx = Math.floor((start + end) * 0.5);
			bridges.push({
				startIdx: start,
				endIdx: end,
				midX: points[midIdx].x,
				midZ: points[midIdx].z,
				spanLen,
				points: points.slice(start, end + 1),
			});
		}

		// Bounding box for fast tile intersection checks
		let minX = Infinity;
		let maxX = -Infinity;
		let minZ = Infinity;
		let maxZ = -Infinity;
		for (let p = 0; p < points.length; p++) {
			const pt = points[p];
			if (pt.x < minX) minX = pt.x;
			if (pt.x > maxX) maxX = pt.x;
			if (pt.z < minZ) minZ = pt.z;
			if (pt.z > maxZ) maxZ = pt.z;
		}

		return {
			id,
			a,
			b,
			points,
			bridges,
			bounds: { minX, maxX, minZ, maxZ },
		};
	}

	getSettlementJunction(settlement) {
		if (this.junctionCache.has(settlement.id)) {
			return this.junctionCache.get(settlement.id);
		}

		const connected = [];
		for (let dz = -2; dz <= 2; dz++) {
			for (let dx = -2; dx <= 2; dx++) {
				if (dx === 0 && dz === 0) continue;
				if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
				const road = this.getRoadEdge(settlement.cx, settlement.cz, settlement.cx + dx, settlement.cz + dz);
				if (!road) continue;
				const isStart = road.a.id === settlement.id;
				connected.push({ road, isStart });
			}
		}

		if (connected.length < 2) {
			this.junctionCache.set(settlement.id, null);
			return null;
		}

		const halfRoad = this.roadWidth * 0.5;
		const desiredSetback = connected.length === 2 ? halfRoad * 3.4 : halfRoad * 2.3;

		const branches = [];
		for (let i = 0; i < connected.length; i++) {
			const { road, isStart } = connected[i];
			const pts = road.points;
			const n = pts.length;

			// Find point along road at desiredSetback distance from settlement (without entering a bridge)
			let accum = 0;
			let targetPt = isStart ? pts[1] : pts[n - 2];
			let maxSafeDist = 0;

			if (isStart) {
				for (let k = 1; k < n - 1; k++) {
					if (pts[k].isBridge) break;
					const seg = Math.hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z);
					if (accum + seg >= desiredSetback) {
						const frac = (desiredSetback - accum) / Math.max(1e-5, seg);
						const a = pts[k - 1];
						const b = pts[k];
						const tx = a.tx + (b.tx - a.tx) * frac;
						const tz = a.tz + (b.tz - a.tz) * frac;
						const tLen = Math.hypot(tx, tz) || 1;
						targetPt = {
							x: lerp(a.x, b.x, frac),
							z: lerp(a.z, b.z, frac),
							roadY: lerp(a.roadY, b.roadY, frac),
							tx: tx / tLen,
							tz: tz / tLen,
						};
						maxSafeDist = desiredSetback;
						break;
					}
					accum += seg;
					maxSafeDist = accum;
					targetPt = pts[k];
				}
			} else {
				for (let k = n - 2; k > 0; k--) {
					if (pts[k].isBridge) break;
					const seg = Math.hypot(pts[k].x - pts[k + 1].x, pts[k].z - pts[k + 1].z);
					if (accum + seg >= desiredSetback) {
						const frac = (desiredSetback - accum) / Math.max(1e-5, seg);
						const a = pts[k + 1];
						const b = pts[k];
						const tx = a.tx + (b.tx - a.tx) * frac;
						const tz = a.tz + (b.tz - a.tz) * frac;
						const tLen = Math.hypot(tx, tz) || 1;
						targetPt = {
							x: lerp(a.x, b.x, frac),
							z: lerp(a.z, b.z, frac),
							roadY: lerp(a.roadY, b.roadY, frac),
							tx: tx / tLen,
							tz: tz / tLen,
						};
						maxSafeDist = desiredSetback;
						break;
					}
					accum += seg;
					maxSafeDist = accum;
					targetPt = pts[k];
				}
			}

			// Exact outward road tangent at the trimmed endpoint (guarantees 100% vertex match with road strip)
			const dirX = isStart ? targetPt.tx : -targetPt.tx;
			const dirZ = isStart ? targetPt.tz : -targetPt.tz;
			const setback = Math.min(desiredSetback, maxSafeDist);
			const radialAngle = Math.atan2(targetPt.z - settlement.z, targetPt.x - settlement.x);

			branches.push({
				roadId: road.id,
				isStart,
				dirX,
				dirZ,
				angle: radialAngle,
				setback,
				px: targetPt.x,
				pz: targetPt.z,
				roadY: targetPt.roadY,
			});
		}

		branches.sort((u, v) => u.angle - v.angle);

		const junction = {
			settlement,
			branches,
		};
		this.junctionCache.set(settlement.id, junction);
		return junction;
	}

	getRoadEndTrim(road, isStart) {
		const settlement = isStart ? road.a : road.b;
		const junction = this.getSettlementJunction(settlement);
		if (!junction) return 0;
		for (let i = 0; i < junction.branches.length; i++) {
			if (junction.branches[i].roadId === road.id) {
				return junction.branches[i].setback;
			}
		}
		return 0;
	}

	getTileRoadData(tileX, tileZ) {
		if (this.terrain.terrainType === 'desert') {
			return { settlements: [], roads: [], bridges: [], junctions: [] };
		}

		const tileSize = this.terrain.tileSize;
		const minX = tileX * tileSize - tileSize * 0.5;
		const maxX = minX + tileSize;
		const minZ = tileZ * tileSize - tileSize * 0.5;
		const maxZ = minZ + tileSize;
		const margin = this.roadWidth + this.shoulderWidth + this.sampleStep * 2;

		const minCX = Math.floor((minX - this.cellSize) / this.cellSize);
		const maxCX = Math.floor((maxX + this.cellSize) / this.cellSize);
		const minCZ = Math.floor((minZ - this.cellSize) / this.cellSize);
		const maxCZ = Math.floor((maxZ + this.cellSize) / this.cellSize);

		const settlements = [];
		const roads = [];
		const seenEdges = new Set();

		for (let cz = minCZ; cz <= maxCZ; cz++) {
			for (let cx = minCX; cx <= maxCX; cx++) {
				const s = this.getSettlement(cx, cz);
				if (!s) continue;

				// Settlement belongs to this tile if its center falls inside the tile
				if (s.x >= minX && s.x < maxX && s.z >= minZ && s.z < maxZ) {
					settlements.push(s);
				}

				// Check neighbor cells in [-2..2] (skipping duplicates via seenEdges)
				for (let dz = -2; dz <= 2; dz++) {
					for (let dx = -2; dx <= 2; dx++) {
						if (dx === 0 && dz === 0) continue;
						if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
						const nx = cx + dx;
						const nz = cz + dz;
						const edgeKey = this.getEdgeKey(cx, cz, nx, nz);
						if (seenEdges.has(edgeKey)) continue;
						seenEdges.add(edgeKey);

						const road = this.getRoadEdge(cx, cz, nx, nz);
						if (!road) continue;

						// AABB intersection test with tile
						if (
							road.bounds.maxX < minX - margin ||
							road.bounds.minX > maxX + margin ||
							road.bounds.maxZ < minZ - margin ||
							road.bounds.minZ > maxZ + margin
						) {
							continue;
						}

						roads.push(road);
					}
				}
			}
		}

		// Bridges are owned by the single tile containing their midpoint (zero duplication)
		const bridges = [];
		for (let r = 0; r < roads.length; r++) {
			const road = roads[r];
			for (let b = 0; b < road.bridges.length; b++) {
				const bridge = road.bridges[b];
				const bTileX = Math.round(bridge.midX / tileSize);
				const bTileZ = Math.round(bridge.midZ / tileSize);
				if (bTileX === tileX && bTileZ === tileZ) {
					bridges.push(bridge);
				}
			}
		}

		// Smooth curved junctions at settlements where >= 2 road branches meet (owned by settlement's tile)
		const junctions = [];
		for (let s = 0; s < settlements.length; s++) {
			const j = this.getSettlementJunction(settlements[s]);
			if (j) {
				junctions.push(j);
			}
		}

		return { settlements, roads, bridges, junctions };
	}

	getNearestRoadInfo(wx, wz, roads) {
		let bestDistSq = Infinity;
		let bestDirX = 1;
		let bestDirZ = 0;

		for (let r = 0; r < roads.length; r++) {
			const road = roads[r];
			const pad = 250 * this.worldUnit + this.roadWidth * 4;
			if (
				wx < road.bounds.minX - pad ||
				wx > road.bounds.maxX + pad ||
				wz < road.bounds.minZ - pad ||
				wz > road.bounds.maxZ + pad
			) {
				continue;
			}

			const pts = road.points;
			for (let i = 0; i < pts.length - 1; i++) {
				const a = pts[i];
				const b = pts[i + 1];
				const hit = distToSegmentSq(wx, wz, a.x, a.z, b.x, b.z);
				if (hit.distSq < bestDistSq) {
					bestDistSq = hit.distSq;
					bestDirX = hit.dx;
					bestDirZ = hit.dz;
				}
			}
		}

		return {
			dist: Math.sqrt(bestDistSq),
			angle: Math.atan2(bestDirX, bestDirZ),
		};
	}

	isNearRoad(wx, wz, roads, clearance) {
		const clearanceSq = clearance * clearance;
		for (let r = 0; r < roads.length; r++) {
			const road = roads[r];
			if (
				wx < road.bounds.minX - clearance ||
				wx > road.bounds.maxX + clearance ||
				wz < road.bounds.minZ - clearance ||
				wz > road.bounds.maxZ + clearance
			) {
				continue;
			}

			const pts = road.points;
			for (let i = 0; i < pts.length - 1; i++) {
				const a = pts[i];
				const b = pts[i + 1];
				const minSegX = a.x < b.x ? a.x : b.x;
				const maxSegX = a.x > b.x ? a.x : b.x;
				if (wx < minSegX - clearance || wx > maxSegX + clearance) continue;
				const minSegZ = a.z < b.z ? a.z : b.z;
				const maxSegZ = a.z > b.z ? a.z : b.z;
				if (wz < minSegZ - clearance || wz > maxSegZ + clearance) continue;

				const hit = distToSegmentSq(wx, wz, a.x, a.z, b.x, b.z);
				if (hit.distSq < clearanceSq) {
					return true;
				}
			}
		}
		return false;
	}
}
