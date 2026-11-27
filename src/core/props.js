import * as THREE from 'three';
import { setupFogMaterial } from './fog.js';
import { sampleTerrainGridHeight } from '../terrain/roadNetwork.js';

function mergeGeometriesWithColors(parts) {
	let totalVerts = 0;
	let totalIndices = 0;
	const prepared = parts.map(({ geo, color }) => {
		const pos = geo.getAttribute('position');
		const norm = geo.getAttribute('normal');
		const idx = geo.getIndex();
		totalVerts += pos.count;
		totalIndices += idx ? idx.count : pos.count;
		return { geo, pos, norm, idx, count: pos.count, color };
	});

	const positions = new Float32Array(totalVerts * 3);
	const normals = new Float32Array(totalVerts * 3);
	const colors = new Float32Array(totalVerts * 3);
	const indices = totalVerts > 65535 ? new Uint32Array(totalIndices) : new Uint16Array(totalIndices);

	let vOff = 0;
	let iOff = 0;
	for (const p of prepared) {
		for (let i = 0; i < p.count; i++) {
			const vi = (vOff + i) * 3;
			positions[vi] = p.pos.getX(i);
			positions[vi + 1] = p.pos.getY(i);
			positions[vi + 2] = p.pos.getZ(i);
			normals[vi] = p.norm.getX(i);
			normals[vi + 1] = p.norm.getY(i);
			normals[vi + 2] = p.norm.getZ(i);
			colors[vi] = p.color.r;
			colors[vi + 1] = p.color.g;
			colors[vi + 2] = p.color.b;
		}
		if (p.idx) {
			for (let i = 0; i < p.idx.count; i++) {
				indices[iOff++] = p.idx.getX(i) + vOff;
			}
		} else {
			for (let i = 0; i < p.count; i++) {
				indices[iOff++] = vOff + i;
			}
		}
		vOff += p.count;
		p.geo.dispose();
	}

	const merged = new THREE.BufferGeometry();
	merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
	merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
	merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
	merged.setIndex(new THREE.BufferAttribute(indices, 1));
	return merged;
}

function createTreeGeometry() {
	const trunk = new THREE.CylinderGeometry(1.0, 1.6, 10, 5, 1);
	trunk.translate(0, 5, 0);

	const lower = new THREE.ConeGeometry(8.2, 20, 6, 1);
	lower.translate(0, 18, 0);

	const upper = new THREE.ConeGeometry(6.0, 16, 6, 1);
	upper.translate(0, 29, 0);

	return mergeGeometriesWithColors([
		{ geo: trunk, color: new THREE.Color(0x4b3828) },
		{ geo: lower, color: new THREE.Color(0x1f3d1d) },
		{ geo: upper, color: new THREE.Color(0x294f24) },
	]);
}

function createBuildingGeometry() {
	const body = new THREE.BoxGeometry(26, 14, 18);
	body.translate(0, 7, 0);

	const roof = new THREE.ConeGeometry(19.5, 8, 4, 1);
	roof.rotateY(Math.PI / 4);
	roof.scale(1.0, 1.0, 0.72);
	roof.translate(0, 18, 0);

	return mergeGeometriesWithColors([
		{ geo: body, color: new THREE.Color(0xd8dad6) },
		{ geo: roof, color: new THREE.Color(0x5b6166) },
	]);
}

function seededRand(seed) {
	let s = seed >>> 0;
	return () => {
		s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
		return s / 4294967296;
	};
}

function estimateSlope(terrain, wx, wz, step = 18) {
	const hL = terrain.sampleHeight(wx - step, wz);
	const hR = terrain.sampleHeight(wx + step, wz);
	const hD = terrain.sampleHeight(wx, wz - step);
	const hU = terrain.sampleHeight(wx, wz + step);
	const dx = (hR - hL) / (2 * step);
	const dz = (hU - hD) / (2 * step);
	return Math.hypot(dx, dz);
}

function pushQuad(positions, colors, indices, p0, p1, p2, p3, c0, c1, c2, c3) {
	const base = positions.length / 3;
	positions.push(
		p0[0], p0[1], p0[2],
		p1[0], p1[1], p1[2],
		p2[0], p2[1], p2[2],
		p3[0], p3[1], p3[2]
	);
	colors.push(
		c0[0], c0[1], c0[2],
		c1[0], c1[1], c1[2],
		c2[0], c2[1], c2[2],
		c3[0], c3[1], c3[2]
	);
	indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function pushBox(positions, colors, indices, cx, cy, cz, sx, sy, sz, rotY, col) {
	const hx = sx * 0.5;
	const hy = sy * 0.5;
	const hz = sz * 0.5;
	const cos = Math.cos(rotY);
	const sin = Math.sin(rotY);

	const local = [
		[-hx, -hy, -hz],
		[hx, -hy, -hz],
		[hx, hy, -hz],
		[-hx, hy, -hz],
		[-hx, -hy, hz],
		[hx, -hy, hz],
		[hx, hy, hz],
		[-hx, hy, hz],
	];

	const v = local.map(([x, y, z]) => [
		cx + x * cos + z * sin,
		cy + y,
		cz - x * sin + z * cos,
	]);

	// 6 faces (CCW outward)
	pushQuad(positions, colors, indices, v[4], v[5], v[6], v[7], col, col, col, col); // +Z
	pushQuad(positions, colors, indices, v[1], v[0], v[3], v[2], col, col, col, col); // -Z
	pushQuad(positions, colors, indices, v[5], v[1], v[2], v[6], col, col, col, col); // +X
	pushQuad(positions, colors, indices, v[0], v[4], v[7], v[3], col, col, col, col); // -X
	pushQuad(positions, colors, indices, v[7], v[6], v[2], v[3], col, col, col, col); // +Y
	pushQuad(positions, colors, indices, v[0], v[1], v[5], v[4], col, col, col, col); // -Y
}

function buildBufferGeometry(positions, colors, indices) {
	if (positions.length === 0 || indices.length === 0) return null;
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
	geo.setIndex(indices);
	geo.computeVertexNormals();
	geo.computeBoundingBox();
	geo.computeBoundingSphere();
	return geo;
}

function trimRoadPoints(pts, trimStart, trimEnd) {
	if (pts.length < 2) return pts;
	const n = pts.length;
	const cum = new Float32Array(n);
	for (let i = 1; i < n; i++) {
		cum[i] = cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
	}
	const total = cum[n - 1];
	const startD = Math.min(trimStart, total * 0.42);
	const endD = Math.max(startD + 1, total - Math.min(trimEnd, total * 0.42));

	const sampleAt = (dist) => {
		for (let i = 1; i < n; i++) {
			if (cum[i] >= dist || i === n - 1) {
				const seg = Math.max(1e-5, cum[i] - cum[i - 1]);
				const t = Math.max(0, Math.min(1, (dist - cum[i - 1]) / seg));
				const a = pts[i - 1];
				const b = pts[i];
				const tx = a.tx + (b.tx - a.tx) * t;
				const tz = a.tz + (b.tz - a.tz) * t;
				const tLen = Math.hypot(tx, tz) || 1;
				const ntx = tx / tLen;
				const ntz = tz / tLen;
				return {
					x: a.x + (b.x - a.x) * t,
					z: a.z + (b.z - a.z) * t,
					terrainY: a.terrainY + (b.terrainY - a.terrainY) * t,
					roadY: a.roadY + (b.roadY - a.roadY) * t,
					isBridge: a.isBridge && b.isBridge,
					tx: ntx,
					tz: ntz,
					rx: -ntz,
					rz: ntx,
				};
			}
		}
		return pts[n - 1];
	};

	const out = [];
	if (startD > 0.01) {
		out.push(sampleAt(startD));
	}
	for (let i = 0; i < n; i++) {
		if (cum[i] > startD + 0.01 && cum[i] < endD - 0.01) {
			out.push(pts[i]);
		}
	}
	if (endD < total - 0.01) {
		out.push(sampleAt(endD));
	} else {
		out.push(pts[n - 1]);
	}
	return out;
}

function buildTileRoadsGeometry(tileX, tileZ, terrain, roadNetwork, roads, junctions, resolution) {
	if (roads.length === 0 && junctions.length === 0) return null;

	const tileSize = terrain.tileSize;
	const minX = tileX * tileSize - tileSize * 0.5;
	const maxX = minX + tileSize;
	const minZ = tileZ * tileSize - tileSize * 0.5;
	const maxZ = minZ + tileSize;
	const pad = roadNetwork.sampleStep * 2.0;

	const halfRoad = roadNetwork.roadWidth * 0.5;
	const halfTotal = halfRoad + roadNetwork.shoulderWidth;
	const surfaceLift = Math.max(0.18, 0.52 * roadNetwork.worldUnit);
	const skirtDrop = Math.max(0.9, 2.8 * roadNetwork.worldUnit);

	const colShoulder = [0.29, 0.28, 0.23];
	const colAsphalt = [0.22, 0.23, 0.24];

	const positions = [];
	const colors = [];
	const indices = [];

	const pushVert = (x, y, z, col) => {
		const idx = positions.length / 3;
		positions.push(x, y, z);
		colors.push(col[0], col[1], col[2]);
		return idx;
	};

	// Emits a smooth road ribbon with SEPARATE flat asphalt vertices & sloped shoulder skirts
	// so asphalt normals stay crisp & flat (never shaded like a round tube).
	const emitRoadStrip = (run) => {
		if (run.length < 2) return;

		const samples = new Array(run.length);
		for (let k = 0; k < run.length; k++) {
			const p = run[k];
			const lxOuter = p.x - p.rx * halfTotal;
			const lzOuter = p.z - p.rz * halfTotal;
			const lxEdge = p.x - p.rx * halfRoad;
			const lzEdge = p.z - p.rz * halfRoad;
			const rxEdge = p.x + p.rx * halfRoad;
			const rzEdge = p.z + p.rz * halfRoad;
			const rxOuter = p.x + p.rx * halfTotal;
			const rzOuter = p.z + p.rz * halfTotal;

			const yC = sampleTerrainGridHeight(terrain, p.x, p.z, resolution);
			const yLE = sampleTerrainGridHeight(terrain, lxEdge, lzEdge, resolution);
			const yRE = sampleTerrainGridHeight(terrain, rxEdge, rzEdge, resolution);
			const yLO = sampleTerrainGridHeight(terrain, lxOuter, lzOuter, resolution);
			const yRO = sampleTerrainGridHeight(terrain, rxOuter, rzOuter, resolution);

			const minDeckY = Math.max(p.roadY, yC, yLE, yRE) + surfaceLift;
			samples[k] = {
				lxOuter, lzOuter, lxEdge, lzEdge, rxEdge, rzEdge, rxOuter, rzOuter,
				yLO, yRO, minDeckY, deckY: minDeckY,
			};
		}

		// Smooth vertical profile along the road without ever dipping below terrain
		for (let pass = 0; pass < 2; pass++) {
			for (let k = 1; k < samples.length - 1; k++) {
				const avg = samples[k - 1].deckY * 0.25 + samples[k].deckY * 0.5 + samples[k + 1].deckY * 0.25;
				samples[k].deckY = Math.max(samples[k].minDeckY, avg);
			}
		}

		// 1. Flat asphalt surface (2 shared verts per ring)
		const asphaltStart = positions.length / 3;
		for (let k = 0; k < samples.length; k++) {
			const s = samples[k];
			pushVert(s.lxEdge, s.deckY, s.lzEdge, colAsphalt);
			pushVert(s.rxEdge, s.deckY, s.rzEdge, colAsphalt);
		}
		for (let k = 0; k < samples.length - 1; k++) {
			const r0 = asphaltStart + k * 2;
			const r1 = r0 + 2;
			indices.push(r0, r0 + 1, r1 + 1, r0, r1 + 1, r1);
		}

		// 2. Left sloped earth shoulder skirt (separate verts so asphalt normal stays flat)
		const leftStart = positions.length / 3;
		for (let k = 0; k < samples.length; k++) {
			const s = samples[k];
			const leftSkirtY = Math.min(s.yLO, s.deckY) - skirtDrop;
			pushVert(s.lxOuter, leftSkirtY, s.lzOuter, colShoulder);
			pushVert(s.lxEdge, s.deckY, s.lzEdge, colShoulder);
		}
		for (let k = 0; k < samples.length - 1; k++) {
			const r0 = leftStart + k * 2;
			const r1 = r0 + 2;
			indices.push(r0, r0 + 1, r1 + 1, r0, r1 + 1, r1);
		}

		// 3. Right sloped earth shoulder skirt
		const rightStart = positions.length / 3;
		for (let k = 0; k < samples.length; k++) {
			const s = samples[k];
			const rightSkirtY = Math.min(s.yRO, s.deckY) - skirtDrop;
			pushVert(s.rxEdge, s.deckY, s.rzEdge, colShoulder);
			pushVert(s.rxOuter, rightSkirtY, s.rzOuter, colShoulder);
		}
		for (let k = 0; k < samples.length - 1; k++) {
			const r0 = rightStart + k * 2;
			const r1 = r0 + 2;
			indices.push(r0, r0 + 1, r1 + 1, r0, r1 + 1, r1);
		}
	};

	for (let r = 0; r < roads.length; r++) {
		const road = roads[r];
		const trimStart = roadNetwork.getRoadEndTrim(road, true);
		const trimEnd = roadNetwork.getRoadEndTrim(road, false);
		const pts = (trimStart > 0 || trimEnd > 0)
			? trimRoadPoints(road.points, trimStart, trimEnd)
			: road.points;

		// Split road into contiguous land runs that intersect this tile
		let run = [];
		const flushRun = () => {
			if (run.length >= 2) {
				emitRoadStrip(run);
			}
			run = [];
		};

		for (let i = 0; i < pts.length; i++) {
			const p = pts[i];
			const inTile =
				p.x >= minX - pad &&
				p.x <= maxX + pad &&
				p.z >= minZ - pad &&
				p.z <= maxZ + pad;

			// Include bridge boundary endpoints so land road connects seamlessly to bridge abutments
			const prevIsLand = i > 0 && !pts[i - 1].isBridge;
			const nextIsLand = i < pts.length - 1 && !pts[i + 1].isBridge;
			const usable = inTile && (!p.isBridge || prevIsLand || nextIsLand);

			if (usable) {
				run.push(p);
				if (p.isBridge && prevIsLand && !nextIsLand) {
					flushRun();
				}
			} else {
				flushRun();
			}
		}
		flushRun();
	}

	// Smooth curved junctions at settlements:
	// - 2 branches: continuous Quadratic Bezier highway curve (zero round knob!)
	// - 3+ branches: flared intersection polygon with smooth Bezier curb fillets!
	for (let j = 0; j < junctions.length; j++) {
		const { settlement, branches } = junctions[j];

		if (branches.length === 2) {
				const b0 = branches[0];
				const b1 = branches[1];
				const steps = 10;
				const curvePts = [];
				for (let k = 0; k <= steps; k++) {
					const t = k / steps;
					const inv = 1 - t;
					const x = inv * inv * b0.px + 2 * inv * t * settlement.x + t * t * b1.px;
					const z = inv * inv * b0.pz + 2 * inv * t * settlement.z + t * t * b1.pz;
					let tx, tz;
					if (k === 0) {
						// Match branch 0 exact inward tangent so vertices stitch seamlessly
						tx = -b0.dirX;
						tz = -b0.dirZ;
					} else if (k === steps) {
						// Match branch 1 exact outward tangent so vertices stitch seamlessly
						tx = b1.dirX;
						tz = b1.dirZ;
					} else {
						const dtx = 2 * inv * (settlement.x - b0.px) + 2 * t * (b1.px - settlement.x);
						const dtz = 2 * inv * (settlement.z - b0.pz) + 2 * t * (b1.pz - settlement.z);
						const tLen = Math.hypot(dtx, dtz) || 1;
						tx = dtx / tLen;
						tz = dtz / tLen;
					}
					const roadY = b0.roadY + (b1.roadY - b0.roadY) * t;
					curvePts.push({
						x,
						z,
						roadY,
						tx,
						tz,
						rx: -tz,
						rz: tx,
					});
				}
				emitRoadStrip(curvePts);
				continue;
			}

			// 3+ branches: sloped terrain-conforming flared intersection with exact per-branch heights!
			const kCount = branches.length;
			const branchEnds = [];
			let sumDeckY = 0;

			for (let i = 0; i < kCount; i++) {
				const b = branches[i];
				const rx = -b.dirZ;
				const rz = b.dirX;
				const ax = b.px + rx * halfRoad;
				const az = b.pz + rz * halfRoad;
				const bx = b.px - rx * halfRoad;
				const bz = b.pz - rz * halfRoad;

				const hMid = sampleTerrainGridHeight(terrain, b.px, b.pz, resolution);
				const hA = sampleTerrainGridHeight(terrain, ax, az, resolution);
				const hB = sampleTerrainGridHeight(terrain, bx, bz, resolution);
				// Exact same deckY formula as emitRoadStrip so junction meets every branch with ZERO step!
				const deckY = Math.max(b.roadY, hMid, hA, hB) + surfaceLift;
				sumDeckY += deckY;

				branchEnds.push({ b, rx, rz, ax, az, bx, bz, deckY });
			}

			const centerTerrainY = sampleTerrainGridHeight(terrain, settlement.x, settlement.z, resolution);
			const centerY = Math.max(sumDeckY / kCount, centerTerrainY + surfaceLift);
			const perimeter = [];
			const filletArcs = [];
			const filletSteps = 7;

			for (let i = 0; i < kCount; i++) {
				const curr = branchEnds[i];
				const next = branchEnds[(i + 1) % kCount];

				// Flat opening across current branch (B_i -> A_i) at exact branch deckY
				perimeter.push([curr.bx, curr.deckY, curr.bz]);

				// Compute smooth curb fillet control point between A_i and B_next
				const det = curr.b.dirX * next.b.dirZ - curr.b.dirZ * next.b.dirX;
				let ctrlX = settlement.x;
				let ctrlZ = settlement.z;
				if (Math.abs(det) > 0.15) {
					const rhsX = next.bx - curr.ax;
					const rhsZ = next.bz - curr.az;
					const tParam = -(rhsX * next.b.dirZ - rhsZ * next.b.dirX) / det;
					const maxPull = curr.b.setback * 1.15;
					if (tParam > 0 && tParam < maxPull) {
						ctrlX = curr.ax - curr.b.dirX * tParam;
						ctrlZ = curr.az - curr.b.dirZ * tParam;
					}
				}
				const cDist = Math.hypot(ctrlX - settlement.x, ctrlZ - settlement.z);
				if (cDist > curr.b.setback * 0.95) {
					const scale = (curr.b.setback * 0.95) / cDist;
					ctrlX = settlement.x + (ctrlX - settlement.x) * scale;
					ctrlZ = settlement.z + (ctrlZ - settlement.z) * scale;
				}

				const arc = [];
				for (let s = 0; s <= filletSteps; s++) {
					const t = s / filletSteps;
					const inv = 1 - t;
					const fx = inv * inv * curr.ax + 2 * inv * t * ctrlX + t * t * next.bx;
					const fz = inv * inv * curr.az + 2 * inv * t * ctrlZ + t * t * next.bz;
					// Smoothly interpolate height from curr.deckY to next.deckY, hugging terrain
					const smoothT = t * t * (3 - 2 * t);
					const interpY = curr.deckY + (next.deckY - curr.deckY) * smoothT;
					const fy = (s === 0)
						? curr.deckY
						: (s === filletSteps)
							? next.deckY
							: Math.max(interpY, sampleTerrainGridHeight(terrain, fx, fz, resolution) + surfaceLift);
					arc.push([fx, fy, fz]);
					if (s < filletSteps) {
						perimeter.push([fx, fy, fz]);
					}
				}
				filletArcs.push(arc);
			}

			// Emit sloped terrain-conforming asphalt interior polygon (CW perimeter -> reverse winding for +Y up)
			const centerIdx = pushVert(settlement.x, centerY, settlement.z, colAsphalt);
			const perimStart = positions.length / 3;
			for (let p = 0; p < perimeter.length; p++) {
				pushVert(perimeter[p][0], perimeter[p][1], perimeter[p][2], colAsphalt);
			}
			for (let p = 0; p < perimeter.length; p++) {
				const pNext = (p + 1) % perimeter.length;
				indices.push(centerIdx, perimStart + pNext, perimStart + p);
			}

			// Emit sloped earth shoulder skirts ONLY along curved curb fillets (separate verts!)
			for (let a = 0; a < filletArcs.length; a++) {
				const arc = filletArcs[a];
				const skirtStart = positions.length / 3;
				for (let s = 0; s < arc.length; s++) {
					const pCurr = arc[s];
					const pPrev = arc[Math.max(0, s - 1)];
					const pNext = arc[Math.min(arc.length - 1, s + 1)];
					const tx = pNext[0] - pPrev[0];
					const tz = pNext[2] - pPrev[2];
					const tLen = Math.hypot(tx, tz) || 1;
					// Outward normal from CW perimeter is (+tz, -tx)
					const oxDir = tz / tLen;
					const ozDir = -tx / tLen;
					const ox = pCurr[0] + oxDir * roadNetwork.shoulderWidth;
					const oz = pCurr[2] + ozDir * roadNetwork.shoulderWidth;
					const oy = Math.min(sampleTerrainGridHeight(terrain, ox, oz, resolution), pCurr[1]) - skirtDrop;

					pushVert(pCurr[0], pCurr[1], pCurr[2], colShoulder);
					pushVert(ox, oy, oz, colShoulder);
				}
				for (let s = 0; s < arc.length - 1; s++) {
					const r0 = skirtStart + s * 2;
					const r1 = r0 + 2;
					indices.push(r0, r1, r1 + 1, r0, r1 + 1, r0 + 1);
				}
			}
		}

	return buildBufferGeometry(positions, colors, indices);
}

function buildTileBridgesGeometry(terrain, roadNetwork, bridges) {
	if (bridges.length === 0) return null;

	const halfRoad = roadNetwork.roadWidth * 0.5;
	const halfDeck = halfRoad + Math.max(0.7, 2.2 * roadNetwork.worldUnit);
	const deckThickness = Math.max(1.1, 3.0 * roadNetwork.worldUnit);
	const railWidth = Math.max(0.35, 0.9 * roadNetwork.worldUnit);
	const railHeight = Math.max(0.85, 2.3 * roadNetwork.worldUnit);
	const surfaceLift = Math.max(0.18, 0.55 * roadNetwork.worldUnit);
	const pierSpacing = Math.max(22, 85 * roadNetwork.worldUnit);
	const pierWidth = Math.max(1.2, 3.4 * roadNetwork.worldUnit);

	const colAsphalt = [0.21, 0.22, 0.24];
	const colConcrete = [0.58, 0.57, 0.54];
	const colConcreteDark = [0.44, 0.43, 0.40];
	const colRail = [0.70, 0.70, 0.68];

	const positions = [];
	const colors = [];
	const indices = [];

	for (let b = 0; b < bridges.length; b++) {
		const pts = bridges[b].points;
		if (pts.length < 2) continue;

		// Build continuous bridge deck + side girders + guardrails
		for (let i = 0; i < pts.length - 1; i++) {
			const a = pts[i];
			const c = pts[i + 1];
			const yaTop = a.roadY + surfaceLift;
			const ycTop = c.roadY + surfaceLift;
			const yaBot = yaTop - deckThickness;
			const ycBot = ycTop - deckThickness;

			const aRoadL = [a.x - a.rx * halfRoad, yaTop, a.z - a.rz * halfRoad];
			const aRoadR = [a.x + a.rx * halfRoad, yaTop, a.z + a.rz * halfRoad];
			const cRoadL = [c.x - c.rx * halfRoad, ycTop, c.z - c.rz * halfRoad];
			const cRoadR = [c.x + c.rx * halfRoad, ycTop, c.z + c.rz * halfRoad];

			const aDeckL = [a.x - a.rx * halfDeck, yaTop, a.z - a.rz * halfDeck];
			const aDeckR = [a.x + a.rx * halfDeck, yaTop, a.z + a.rz * halfDeck];
			const cDeckL = [c.x - c.rx * halfDeck, ycTop, c.z - c.rz * halfDeck];
			const cDeckR = [c.x + c.rx * halfDeck, ycTop, c.z + c.rz * halfDeck];

			const aBotL = [a.x - a.rx * halfDeck, yaBot, a.z - a.rz * halfDeck];
			const aBotR = [a.x + a.rx * halfDeck, yaBot, a.z + a.rz * halfDeck];
			const cBotL = [c.x - c.rx * halfDeck, ycBot, c.z - c.rz * halfDeck];
			const cBotR = [c.x + c.rx * halfDeck, ycBot, c.z + c.rz * halfDeck];

			// Asphalt road surface (+Y)
			pushQuad(positions, colors, indices, aRoadL, aRoadR, cRoadR, cRoadL, colAsphalt, colAsphalt, colAsphalt, colAsphalt);
			// Sidewalks / curbs (+Y)
			pushQuad(positions, colors, indices, aDeckL, aRoadL, cRoadL, cDeckL, colConcrete, colConcrete, colConcrete, colConcrete);
			pushQuad(positions, colors, indices, aRoadR, aDeckR, cDeckR, cRoadR, colConcrete, colConcrete, colConcrete, colConcrete);
			// Side girders (-R left, +R right) & underside (-Y)
			pushQuad(positions, colors, indices, aBotL, aDeckL, cDeckL, cBotL, colConcreteDark, colConcrete, colConcrete, colConcreteDark);
			pushQuad(positions, colors, indices, aDeckR, aBotR, cBotR, cDeckR, colConcrete, colConcreteDark, colConcreteDark, colConcrete);
			pushQuad(positions, colors, indices, aBotR, aBotL, cBotL, cBotR, colConcreteDark, colConcreteDark, colConcreteDark, colConcreteDark);

			// Left & right guardrails / parapets
			for (const side of [-1, 1]) {
				const innerOff = side * (halfDeck - railWidth);
				const outerOff = side * halfDeck;
				const aInB = [a.x + a.rx * innerOff, yaTop, a.z + a.rz * innerOff];
				const aOutB = [a.x + a.rx * outerOff, yaTop, a.z + a.rz * outerOff];
				const aInT = [a.x + a.rx * innerOff, yaTop + railHeight, a.z + a.rz * innerOff];
				const aOutT = [a.x + a.rx * outerOff, yaTop + railHeight, a.z + a.rz * outerOff];

				const cInB = [c.x + c.rx * innerOff, ycTop, c.z + c.rz * innerOff];
				const cOutB = [c.x + c.rx * outerOff, ycTop, c.z + c.rz * outerOff];
				const cInT = [c.x + c.rx * innerOff, ycTop + railHeight, c.z + c.rz * innerOff];
				const cOutT = [c.x + c.rx * outerOff, ycTop + railHeight, c.z + c.rz * outerOff];

				if (side < 0) {
					pushQuad(positions, colors, indices, aOutT, aInT, cInT, cOutT, colRail, colRail, colRail, colRail);
					pushQuad(positions, colors, indices, aOutB, aOutT, cOutT, cOutB, colConcrete, colRail, colRail, colConcrete);
					pushQuad(positions, colors, indices, aInT, aInB, cInB, cInT, colRail, colConcrete, colConcrete, colRail);
				} else {
					pushQuad(positions, colors, indices, aInT, aOutT, cOutT, cInT, colRail, colRail, colRail, colRail);
					pushQuad(positions, colors, indices, aOutT, aOutB, cOutB, cOutT, colRail, colConcrete, colConcrete, colRail);
					pushQuad(positions, colors, indices, aInB, aInT, cInT, cInB, colConcrete, colRail, colRail, colConcrete);
				}
			}
		}

		// Bank abutments at start and end so the bridge anchors solidly into terrain
		for (const endPt of [pts[0], pts[pts.length - 1]]) {
			const topY = endPt.roadY + surfaceLift - deckThickness * 0.5;
			const groundY = Math.min(endPt.terrainY - 6 * roadNetwork.worldUnit, topY - 4);
			const h = Math.max(2, topY - groundY);
			const rotY = Math.atan2(endPt.tx, endPt.tz);
			pushBox(
				positions,
				colors,
				indices,
				endPt.x,
				groundY + h * 0.5,
				endPt.z,
				halfDeck * 2.04,
				h,
				Math.max(3.5, 10 * roadNetwork.worldUnit),
				rotY,
				colConcreteDark
			);
		}

		// Bridge piers / pillars descending into the riverbed
		let accumDist = 0;
		let nextPierDist = pierSpacing * 0.65;
		for (let i = 1; i < pts.length - 1; i++) {
			const prev = pts[i - 1];
			const curr = pts[i];
			accumDist += Math.hypot(curr.x - prev.x, curr.z - prev.z);

			if (accumDist >= nextPierDist) {
				nextPierDist += pierSpacing;
				const topY = curr.roadY + surfaceLift - deckThickness + 0.4;
				const bedY = Math.min(curr.terrainY - 4 * roadNetwork.worldUnit, -22);
				const pierH = topY - bedY;
				if (pierH <= 1.5) continue;

				const rotY = Math.atan2(curr.tx, curr.tz);
				const pierOffset = halfRoad * 0.68;

				for (const side of [-1, 1]) {
					const px = curr.x + curr.rx * (pierOffset * side);
					const pz = curr.z + curr.rz * (pierOffset * side);
					pushBox(
						positions,
						colors,
						indices,
						px,
						bedY + pierH * 0.5,
						pz,
						pierWidth,
						pierH,
						pierWidth * 1.15,
						rotY,
						colConcreteDark
					);
				}

				// Crossbeam under deck connecting twin piers
				pushBox(
					positions,
					colors,
					indices,
					curr.x,
					topY - pierWidth * 0.45,
					curr.z,
					halfDeck * 1.85,
					pierWidth * 0.85,
					pierWidth * 0.95,
					rotY,
					colConcrete
				);
			}
		}
	}

	return buildBufferGeometry(positions, colors, indices);
}

const _dummy = new THREE.Object3D();
const _tmpCol = new THREE.Color();

export function createPropsResources() {
	const treeGeo = createTreeGeometry();
	const buildingGeo = createBuildingGeometry();
	const material = new THREE.MeshLambertMaterial({
		vertexColors: true,
	});
	setupFogMaterial(material);

	const roadMaterial = new THREE.MeshLambertMaterial({
		vertexColors: true,
		polygonOffset: true,
		polygonOffsetFactor: -2,
		polygonOffsetUnits: -2,
	});
	setupFogMaterial(roadMaterial);

	const bridgeMaterial = new THREE.MeshLambertMaterial({
		vertexColors: true,
	});
	setupFogMaterial(bridgeMaterial);

	return {
		treeGeo,
		buildingGeo,
		material,
		roadMaterial,
		bridgeMaterial,
	};
}

export function createTileProps(tileX, tileZ, terrain, resources, resolution, settings) {
	if (terrain.terrainType === 'desert') return null;

	const { treesEnabled, buildingsEnabled, roadsEnabled } = settings;
	if (!treesEnabled && !buildingsEnabled && !roadsEnabled) return null;

	const tileSize = terrain.tileSize;
	const scaleFactor = tileSize / 2048;
	const minX = tileX * tileSize - tileSize * 0.5;
	const minZ = tileZ * tileSize - tileSize * 0.5;
	const propScale = Math.max(0.28, Math.min(1.0, scaleFactor));

	const roadNetwork = terrain.roadNetwork;
	const { settlements, roads, bridges, junctions } = roadNetwork.getTileRoadData(tileX, tileZ);
	const roadHalfClearance = roadNetwork.roadWidth * 0.5 + roadNetwork.shoulderWidth;

	const seed = (((tileX + 4096) * 73856093) ^ ((tileZ + 4096) * 19349663) ^ (terrain.seed * 83492791)) >>> 0;
	const rand = seededRand(seed);

	// 1. Buildings: placed around road-connected settlements, aligned to roads, never on roads
	const buildingPlacements = [];
	const maxBuildingHeight = terrain.baseHeight + terrain.heightMultiplier * 0.38;
	const minBuildingHeight = Math.max(4.5, terrain.heightMultiplier * 0.015);
	const houseRoadClearance = roadHalfClearance + 22 * propScale;
	const minHouseSpacingSq = Math.pow(34 * propScale, 2);

	for (let sIdx = 0; buildingsEnabled && sIdx < settlements.length; sIdx++) {
		const settlement = settlements[sIdx];
		const sRand = seededRand(settlement.seed);
		const targetHouses = settlement.houseCount;

		for (let attempt = 0; attempt < targetHouses * 5 && buildingPlacements.length < settlements.length * 24; attempt++) {
			const ang = sRand() * Math.PI * 2;
			const dist = (26 + sRand() * settlement.radius) * (0.45 + 0.55 * sRand());
			const wx = settlement.x + Math.cos(ang) * dist;
			const wz = settlement.z + Math.sin(ang) * dist;

			const h = terrain.sampleHeight(wx, wz);
			if (h < minBuildingHeight || h > maxBuildingHeight) continue;
			if (estimateSlope(terrain, wx, wz, 16 * propScale) > 0.24) continue;

			// Never place a house on a road or shoulder
			if (roadNetwork.isNearRoad(wx, wz, roads, houseRoadClearance)) {
				continue;
			}

			// Prevent houses overlapping each other
			let overlaps = false;
			for (let k = 0; k < buildingPlacements.length; k++) {
				const other = buildingPlacements[k];
				const dx = wx - other.wx;
				const dz = wz - other.wz;
				if (dx * dx + dz * dz < minHouseSpacingSq) {
					overlaps = true;
					break;
				}
			}
			if (overlaps) continue;

			// Orient house along the nearest road direction for natural village layout
			let rotY = -0.24 + Math.floor(sRand() * 4) * Math.PI * 0.5;
			if (roads.length > 0) {
				const nearest = roadNetwork.getNearestRoadInfo(wx, wz, roads);
				if (Number.isFinite(nearest.dist)) {
					rotY = nearest.angle + Math.floor(sRand() * 4) * (Math.PI * 0.5) + (sRand() - 0.5) * 0.14;
				}
			}

			const sx = (0.9 + sRand() * 1.35) * propScale;
			const sy = (0.85 + sRand() * 1.45) * propScale;
			const sz = (0.9 + sRand() * 1.35) * propScale;
			const tint = 0.82 + sRand() * 0.28;
			buildingPlacements.push({ wx, wy: h - 2.0 * propScale, wz, sx, sy, sz, rotY, tint });
		}
	}

	// 2. Trees: strictly excluded from roads, shoulders, bridges, and buildings
	const treeTarget = Math.max(24, Math.round(115 * scaleFactor * scaleFactor));
	const treePlacements = [];
	const treeRoadClearance = roadHalfClearance + 14 * propScale;
	const treeHouseClearanceSq = Math.pow(30 * propScale, 2);
	const minTreeHeight = Math.max(5.0, terrain.heightMultiplier * 0.018);

	for (let i = 0; treesEnabled && i < treeTarget; i++) {
		const wx = minX + rand() * tileSize;
		const wz = minZ + rand() * tileSize;
		const h = terrain.sampleHeight(wx, wz);
		if (h < minTreeHeight || h > terrain.baseHeight + terrain.heightMultiplier * 0.62) continue;

		const slope = estimateSlope(terrain, wx, wz, 22 * propScale);
		if (slope > 0.42) continue;

		const cluster = terrain.noise(wx * 0.00075 + 14.2, wz * 0.00075 - 8.6);
		if (cluster < -0.15) continue;

		// Never place a tree on a road or bridge
		if (roadNetwork.isNearRoad(wx, wz, roads, treeRoadClearance)) {
			continue;
		}

		// Never place a tree inside a house
		let hitsHouse = false;
		for (let k = 0; k < buildingPlacements.length; k++) {
			const b = buildingPlacements[k];
			const dx = wx - b.wx;
			const dz = wz - b.wz;
			if (dx * dx + dz * dz < treeHouseClearanceSq) {
				hitsHouse = true;
				break;
			}
		}
		if (hitsHouse) continue;

		const s = (0.75 + rand() * 0.9) * propScale;
		const shade = 0.76 + rand() * 0.42;
		treePlacements.push({ wx, wy: h - 1.5 * propScale, wz, s, rotY: rand() * Math.PI * 2, shade });
	}

	// 3. Roads & Bridges meshes for this tile
	const roadGeo = roadsEnabled
		? buildTileRoadsGeometry(tileX, tileZ, terrain, roadNetwork, roads, junctions, resolution)
		: null;
	const bridgeGeo = roadsEnabled
		? buildTileBridgesGeometry(terrain, roadNetwork, bridges)
		: null;

	if (treePlacements.length === 0 && buildingPlacements.length === 0 && !roadGeo && !bridgeGeo) {
		return null;
	}

	const group = new THREE.Group();

	if (roadGeo) {
		const roadMesh = new THREE.Mesh(roadGeo, resources.roadMaterial);
		roadMesh.castShadow = false;
		roadMesh.receiveShadow = false;
		roadMesh.userData.disposeGeometry = true;
		group.add(roadMesh);
	}

	if (bridgeGeo) {
		const bridgeMesh = new THREE.Mesh(bridgeGeo, resources.bridgeMaterial);
		bridgeMesh.castShadow = false;
		bridgeMesh.receiveShadow = false;
		bridgeMesh.userData.disposeGeometry = true;
		group.add(bridgeMesh);
	}

	if (treePlacements.length > 0) {
		const trees = new THREE.InstancedMesh(resources.treeGeo, resources.material, treePlacements.length);
		trees.castShadow = false;
		trees.receiveShadow = false;
		for (let i = 0; i < treePlacements.length; i++) {
			const p = treePlacements[i];
			_dummy.position.set(p.wx, p.wy, p.wz);
			_dummy.rotation.set(0, p.rotY, 0);
			_dummy.scale.set(p.s, p.s * (0.9 + (i % 3) * 0.12), p.s);
			_dummy.updateMatrix();
			trees.setMatrixAt(i, _dummy.matrix);
			_tmpCol.setRGB(p.shade * 0.94, p.shade, p.shade * 0.9);
			trees.setColorAt(i, _tmpCol);
		}
		trees.instanceMatrix.needsUpdate = true;
		trees.instanceColor.needsUpdate = true;
		group.add(trees);
	}

	if (buildingPlacements.length > 0) {
		const buildings = new THREE.InstancedMesh(resources.buildingGeo, resources.material, buildingPlacements.length);
		buildings.castShadow = false;
		buildings.receiveShadow = false;
		for (let i = 0; i < buildingPlacements.length; i++) {
			const b = buildingPlacements[i];
			_dummy.position.set(b.wx, b.wy, b.wz);
			_dummy.rotation.set(0, b.rotY, 0);
			_dummy.scale.set(b.sx, b.sy, b.sz);
			_dummy.updateMatrix();
			buildings.setMatrixAt(i, _dummy.matrix);
			_tmpCol.setRGB(b.tint, b.tint * 0.98, b.tint * 0.95);
			buildings.setColorAt(i, _tmpCol);
		}
		buildings.instanceMatrix.needsUpdate = true;
		buildings.instanceColor.needsUpdate = true;
		group.add(buildings);
	}

	return group;
}
