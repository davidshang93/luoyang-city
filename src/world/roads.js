// Road network (v2 look): PBR asphalt ribbons with wear, patches, manholes and lane markings, paved sidewalks with tactile
// strips, raised stone curbs, zebra crossings + stop lines, median guard fences — plus the road graph used by traffic,
// minimap and spawning. Flat things are ground decals at y=0 (layered by renderOrder); curbs and fences are real geometry.
import * as THREE from 'three';
import { Grid, addRibbon, addStrip, ribbonMesh, newOut, decalMat } from '../core/util.js';
import { pbrTex, canvasTex, flat } from '../core/mats.js';

const TILE = 1500;
const ORDER = [-14, -15, -16, -17, -18, -20, -19, -21]; // renderOrder by class (motorway on top)
export const CLS_NAME = ['高速', '快速路', '主干道', '次干道', '支路', '街巷', '匝道', '步行街'];
const CURB_H = 0.16, CURB_W = 0.3;
let seed = 4242; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

/** One 30 m stretch of carriageway: u across the full width, v along. Worn asphalt, cracks, patches, manholes, markings. */
function roadTex(lanes, oneway, style, width) {
  return canvasTex(512, 1024, (g, w, h) => {
    const mx = w / width, my = h / 30;                                  // pixels per metre across / along
    g.fillStyle = '#4c4d4f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = rnd(); g.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.05 + rnd() * 0.1})` : `rgba(255,255,255,${0.03 + rnd() * 0.06})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 3); }
    if (style !== 0) {                                                  // tyre tracks polish the lanes, the centre of each lane collects oil
      const lw = (w * 0.92) / lanes;
      for (let k = 0; k < lanes; k++) { const c = w * 0.04 + (k + 0.5) * lw; for (const o of [-0.85, 0.85]) { const gr = g.createLinearGradient(c + (o - 0.45) * mx, 0, c + (o + 0.45) * mx, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.13)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(c + (o - 0.45) * mx, 0, 0.9 * mx, h); }
        for (let j = 0; j < 5; j++) { g.fillStyle = `rgba(0,0,0,${0.05 + rnd() * 0.08})`; g.beginPath(); g.ellipse(c + (rnd() - 0.5) * 0.4 * mx, rnd() * h, (0.15 + rnd() * 0.3) * mx, (0.3 + rnd() * 1.2) * my, 0, 0, 6.3); g.fill(); } }
    }
    for (let i = 0; i < 2; i++) {                                       // tar patches
      const pw = (1 + rnd() * 2.2) * mx, ph = (1.5 + rnd() * 4) * my, px = rnd() * (w - pw), py = rnd() * (h - ph);
      g.fillStyle = rnd() < 0.5 ? 'rgba(30,30,32,0.45)' : 'rgba(120,120,118,0.22)'; g.fillRect(px, py, pw, ph); g.strokeStyle = 'rgba(15,15,15,0.5)'; g.lineWidth = 1.5; g.strokeRect(px, py, pw, ph);
    }
    g.strokeStyle = 'rgba(18,18,18,0.6)'; g.lineWidth = 1;              // cracks
    for (let i = 0; i < 7; i++) { let x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 9; k++) { x += (rnd() - 0.5) * 0.7 * mx; y += (0.2 + rnd() * 0.8) * my; g.lineTo(x, y); } g.stroke(); }
    if (width >= 6) for (let i = 0; i < 2; i++) {                        // manhole covers
      const cx = w * (0.15 + rnd() * 0.7), cy = h * (0.1 + i * 0.5 + rnd() * 0.3), rx = 0.36 * mx, ry = 0.36 * my;
      g.fillStyle = '#38393b'; g.beginPath(); g.ellipse(cx, cy, rx * 1.25, ry * 1.25, 0, 0, 6.3); g.fill();
      g.fillStyle = '#5d5a55'; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 6.3); g.fill();
      g.strokeStyle = '#2a2a2b'; g.lineWidth = 1; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(cx - rx * 0.8, cy + k * ry * 0.3); g.lineTo(cx + rx * 0.8, cy + k * ry * 0.3); g.stroke(); }
    }
    if (style <= 0) return;
    const lw = Math.max(2.5, 0.15 * mx), dash = 6 * my, per = 15 * my, white = 'rgba(232,232,224,0.92)';
    const scuff = (x) => { g.fillStyle = 'rgba(76,77,79,0.5)'; for (let j = 0; j < 14; j++) g.fillRect(x - lw, rnd() * h, lw * 2, 2 + rnd() * 10); };
    g.fillStyle = white; g.fillRect(w * 0.025, 0, lw, h); g.fillRect(w * 0.975 - lw, 0, lw, h); scuff(w * 0.025); scuff(w * 0.975 - lw);
    if (style < 2) return;
    for (let k = 1; k < lanes; k++) {
      const x = w * (0.04 + 0.92 * k / lanes);
      if (!oneway && k === lanes / 2) { g.fillStyle = 'rgba(222,178,52,0.95)'; if (lanes >= 4) { g.fillRect(x - lw * 1.6, 0, lw, h); g.fillRect(x + lw * 0.6, 0, lw, h); } else for (let y = 0; y < h; y += per) g.fillRect(x - lw / 2, y, lw, dash); }
      else { g.fillStyle = white; for (let y = 0; y < h; y += per) g.fillRect(x - lw / 2, y, lw, dash); }
      scuff(x);
    }
  });
}

/** Sidewalk paving, 4 m × 4 m: u = 0 at the curb. Granite edge, grey pavers, yellow tactile (blind) strip. */
function sidewalkTex(narrow) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#6f6c66'; g.fillRect(0, 0, w, h);
    const N = narrow ? 6 : 10, cw = w / N, ch = h / 16;
    for (let i = 0; i < N; i++) for (let j = 0; j < 16; j++) { const v = 112 + Math.floor(rnd() * 34); g.fillStyle = (i + j) % 7 === 3 ? `rgb(${v + 14},${v - 12},${v - 24})` : `rgb(${v + 5},${v + 1},${v - 7})`; g.fillRect(i * cw + 1, j * ch + ((i % 2) * ch) / 2 + 1, cw - 2, ch - 2); }
    g.fillStyle = '#7d7b76'; g.fillRect(0, 0, w * 0.07, h); g.fillStyle = 'rgba(0,0,0,.3)'; for (let j = 0; j < 4; j++) g.fillRect(0, j * 64, w * 0.07, 2);
    if (!narrow) { const x = w * 0.42, bw = w * 0.13; g.fillStyle = '#b08a26'; g.fillRect(x, 0, bw, h); g.fillStyle = 'rgba(120,90,10,.55)'; for (let k = 1; k < 4; k++) g.fillRect(x + k * bw / 4 - 1, 0, 2, h); g.fillStyle = 'rgba(0,0,0,.25)'; for (let j = 0; j < 8; j++) g.fillRect(x, j * 32, bw, 1.5); }
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.07})`; g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 5, 2 + rnd() * 5); }
  });
}

/** split a polyline so no piece is longer than `step`; returns { pts, s (arc length at each point) } */
function densify(pts, step) {
  const out = [pts[0], pts[1]], s = [0]; let d = 0;
  for (let i = 2; i < pts.length; i += 2) {
    const ax = pts[i - 2], az = pts[i - 1], dx = pts[i] - ax, dz = pts[i + 1] - az, L = Math.hypot(dx, dz), k = Math.max(1, Math.ceil(L / step));
    for (let j = 1; j <= k; j++) { out.push(ax + dx * j / k, az + dz * j / k); s.push(d + L * j / k); }
    d += L;
  }
  return { pts: out, s };
}
/** A swept profile edge A→B (lateral offset, height) along a polyline, with explicit normals. side: 0 = faces up, ±1 = faces ±right. */
function addWall(out, pts, keep, oA, yA, oB, yB, side, vScale = 2) {
  const n = pts.length / 2, base = out.pos.length / 3; let dist = 0;
  for (let i = 0; i < n; i++) {
    const x = pts[i * 2], z = pts[i * 2 + 1];
    let dx0 = 0, dz0 = 0, dx1 = 0, dz1 = 0;
    if (i > 0) { dx0 = x - pts[i * 2 - 2]; dz0 = z - pts[i * 2 - 1]; const l = Math.hypot(dx0, dz0) || 1; dx0 /= l; dz0 /= l; dist += l; }
    if (i < n - 1) { dx1 = pts[i * 2 + 2] - x; dz1 = pts[i * 2 + 3] - z; const l = Math.hypot(dx1, dz1) || 1; dx1 /= l; dz1 /= l; }
    if (i === 0) { dx0 = dx1; dz0 = dz1; } if (i === n - 1) { dx1 = dx0; dz1 = dz0; }
    let tx = dx0 + dx1, tz = dz0 + dz1; const tl = Math.hypot(tx, tz); if (tl < 1e-4) { tx = dx1; tz = dz1; } else { tx /= tl; tz /= tl; }
    const rx = -tz, rz = tx, m = 1 / Math.max(0.5, Math.min(1, tx * dx1 + tz * dz1));
    out.pos.push(x + rx * oA * m, yA, z + rz * oA * m, x + rx * oB * m, yB, z + rz * oB * m);
    out.uv.push(0, dist / vScale, 1, dist / vScale);
    if (side === 0) out.nrm.push(0, 1, 0, 0, 1, 0); else out.nrm.push(rx * side, 0, rz * side, rx * side, 0, rz * side);
    if (i > 0 && keep[i - 1]) { const a = base + (i - 1) * 2; out.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
}

export class Roads {
  constructor(scene, data) {
    this.names = data.names;
    this.ways = [];
    this.nodes = new Map();
    this.grid = new Grid(120);
    const group = this.group = new THREE.Group(); group.name = 'roads'; scene.add(group);
    const mats = new Map(), buckets = new Map();
    const matFor = (key, make) => { let m = mats.get(key); if (!m) mats.set(key, m = make()); return m; };
    const bucket = (tx, tz, key, material, order, solid) => { const k = tx + '|' + tz + '|' + key; let b = buckets.get(k); if (!b) { buckets.set(k, b = { out: newOut(), material, order, solid }); if (solid) b.out.nrm = []; } return b.out; };
    // detail maps read uv1 (world metres / 4), so the asphalt / concrete grain is the same size on every road
    const aNor = pbrTex('asphalt_02', 'nor', 1), aArm = pbrTex('asphalt_02', 'arm', 1), cNor = pbrTex('concrete_floor_worn_001', 'nor', 1), cArm = pbrTex('concrete_floor_worn_001', 'arm', 1);
    const asphalt = (map) => decalMat({ map, normalMap: aNor, roughnessMap: aArm, roughness: 1 });
    const swMat = decalMat({ map: sidewalkTex(false), normalMap: cNor, roughnessMap: cArm, roughness: 1 }), swNarrow = decalMat({ map: sidewalkTex(true), normalMap: cNor, roughnessMap: cArm, roughness: 1 });
    const shoulderMat = decalMat({ color: 0x77797a, normalMap: aNor, roughnessMap: aArm, roughness: 1 });
    const pedMat = decalMat({ map: canvasTex(128, 128, (g) => { g.fillStyle = '#b9ad98'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const v = 168 + Math.floor(rnd() * 30); g.fillStyle = `rgb(${v + 8},${v},${v - 14})`; g.fillRect(i * 32 + 1, j * 32 + 1, 30, 30); } }), normalMap: cNor, roughnessMap: cArm, roughness: 1 });
    const plainMat = asphalt(roadTex(2, 0, 0, 7));
    const bridgeMat = decalMat({ color: 0xa9a9a4, normalMap: cNor });
    const zebraMat = decalMat({ alphaTest: 0.5, roughness: 0.8, map: canvasTex(128, 64, (g) => { g.clearRect(0, 0, 128, 64); g.fillStyle = 'rgba(236,236,228,1)'; for (let k = 0; k < 4; k++) g.fillRect(k * 32 + 6, 0, 17, 64); g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.9})`; g.fillRect(rnd() * 128, rnd() * 64, 2 + rnd() * 6, 1 + rnd() * 3); } }) });
    const lineMat = decalMat({ color: 0xe6e6de, roughness: 0.8 });
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x8f8c85, roughness: 0.85, normalMap: cNor });
    const fenceTex = canvasTex(64, 128, (g) => { g.clearRect(0, 0, 64, 128); g.fillStyle = '#eef0ee'; g.fillRect(0, 0, 64, 7); g.fillRect(0, 60, 64, 5); for (const x of [8, 22, 36]) g.fillRect(x, 0, 0, 0); g.fillRect(16, 0, 3, 128); g.fillRect(40, 0, 3, 128); g.fillRect(59, 0, 5, 128); g.fillStyle = '#c8d2d8'; for (let y = 16; y < 128; y += 16) if (Math.abs(y - 62) > 6) g.fillRect(4, y, 56, 2.5); });
    const fenceMat = new THREE.MeshStandardMaterial({ map: fenceTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.3 });

    for (const [cls, width, flags, nameIdx, flatPts] of data.ways) {
      const pts = Float32Array.from(flatPts), n = pts.length / 2, wi = this.ways.length;
      const way = { cls, w: width, oneway: flags & 1, bridge: (flags & 2) > 0, tunnel: (flags & 4) > 0, name: nameIdx >= 0 ? data.names[nameIdx] : '', pts, n };
      this.ways.push(way);
      for (let i = 0; i < n; i++) {
        const key = pts[i * 2] + ',' + pts[i * 2 + 1]; let a = this.nodes.get(key); if (!a) this.nodes.set(key, a = []); a.push(wi, i);
        if (i < n - 1) this.grid.addBox(Math.min(pts[i * 2], pts[i * 2 + 2]) - 15, Math.min(pts[i * 2 + 1], pts[i * 2 + 3]) - 15, Math.max(pts[i * 2], pts[i * 2 + 2]) + 15, Math.max(pts[i * 2 + 1], pts[i * 2 + 3]) + 15, wi * 4096 + i);
      }
    }

    // junctions: nodes where 3+ road arms meet
    this.junctions = []; const jmap = this.jmap = new Map();
    for (const [key, a] of this.nodes) {
      let arms = 0, maxW = 0, minCls = 9;
      for (let i = 0; i < a.length; i += 2) { const w = this.ways[a[i]], pi = a[i + 1]; arms += (pi === 0 || pi === w.n - 1) ? 1 : 2; maxW = Math.max(maxW, w.w); minCls = Math.min(minCls, w.cls); }
      if (arms < 3 || a.length < 4) continue;
      const [x, z] = key.split(',').map(Number);
      this.junctions.push(x, z, maxW); jmap.set(key, { x, z, maxW, minCls, a });
    }
    /** half-width of the widest OTHER way meeting way wi at this node (0 if the node is not a junction) */
    const crossW = (wi, key) => { const j = jmap.get(key); if (!j) return 0; let m = 0; for (let i = 0; i < j.a.length; i += 2) if (j.a[i] !== wi) m = Math.max(m, this.ways[j.a[i]].w); return m / 2; };

    this.ways.forEach((way, wi) => {
      const { cls, w: width, pts, n } = way;
      const tx = Math.floor(pts[0] / TILE), tz = Math.floor(pts[1] / TILE);
      const lanes = Math.max(1, Math.min(8, Math.round((width - 1.5) / 3.5)));
      const style = cls === 7 ? -1 : cls === 5 ? 0 : cls === 6 ? 1 : (lanes < 2 ? 1 : 2);
      const order = ORDER[cls] + (way.bridge ? 3.5 : 0);
      if (cls === 7) { addRibbon(bucket(tx, tz, 'ped', pedMat, order), pts, width, 0, 4); return; }
      const walk = cls >= 2 && cls <= 5 && !way.bridge && !way.tunnel, sw = cls === 5 ? 1.8 : 3;
      if (walk) { const o = bucket(tx, tz, cls === 5 ? 'swn' : 'sw', cls === 5 ? swNarrow : swMat, -23); addStrip(o, pts, width / 2, width / 2 + sw, 0, 4); addStrip(o, pts, -width / 2, -width / 2 - sw, 0, 4); }
      else addRibbon(bucket(tx, tz, 'sh' + (way.bridge ? 'b' : ''), way.bridge ? bridgeMat : shoulderMat, way.bridge ? order - 0.2 : -22), pts, width + (way.bridge ? 1.6 : 2.4), 0, 15);
      const key = style === 0 ? 'plain' : `r${lanes}${way.oneway}${style}`;
      const material = style === 0 ? plainMat : matFor(key, () => asphalt(roadTex(lanes, way.oneway, style, lanes * 3.5 + 1.5)));
      addRibbon(bucket(tx, tz, key + '@' + order, material, order), pts, width, 0, 30);

      // curbs + median fence: real geometry, interrupted where other roads join
      const fence = cls <= 2 && !way.oneway && width >= 18 && !way.bridge && !way.tunnel;
      if (walk || fence) {
        const d = densify(pts, 8), m = d.pts.length / 2, gaps = []; let acc = 0;
        for (let i = 0; i < n; i++) { if (i > 0) acc += Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]); const c = crossW(wi, pts[i * 2] + ',' + pts[i * 2 + 1]); if (c > 0) gaps.push(acc, c + 3.2); }
        const keep = new Array(m - 1);
        for (let i = 0; i < m - 1; i++) { const sm = (d.s[i] + d.s[i + 1]) / 2; let ok = true; for (let k = 0; k < gaps.length; k += 2) if (Math.abs(sm - gaps[k]) < gaps[k + 1]) { ok = false; break; } keep[i] = ok; }
        if (walk) {
          const o = bucket(tx, tz, 'curb', curbMat, 0, true), e = width / 2;
          for (const sd of [1, -1]) {
            addWall(o, d.pts, keep, sd > 0 ? e : -e - CURB_W, CURB_H, sd > 0 ? e + CURB_W : -e, CURB_H, 0);                 // top
            if (sd > 0) { addWall(o, d.pts, keep, e, 0, e, CURB_H, -1); addWall(o, d.pts, keep, e + CURB_W, CURB_H, e + CURB_W, 0, 1); }
            else { addWall(o, d.pts, keep, -e, CURB_H, -e, 0, 1); addWall(o, d.pts, keep, -e - CURB_W, 0, -e - CURB_W, CURB_H, -1); }
          }
        }
        if (fence) addWall(bucket(tx, tz, 'fence', fenceMat, 0, true), d.pts, keep, 0, 0, 0, 1.05, 0, 2.4);
      }
      // zebra crossing + stop line where this way ends at a junction
      if (cls >= 2 && cls <= 4 && width >= 8 && !way.bridge && !way.tunnel) for (const end of [0, n - 1]) {
        const key2 = pts[end * 2] + ',' + pts[end * 2 + 1], c = crossW(wi, key2); if (!c) continue;
        const nb = end === 0 ? 1 : n - 2, jx = pts[end * 2], jz = pts[end * 2 + 1]; let dx = pts[nb * 2] - jx, dz = pts[nb * 2 + 1] - jz; const L = Math.hypot(dx, dz); if (L < c + 12) continue; dx /= L; dz /= L;
        const tx2 = -dx, tz2 = -dz, rx = -tz2, rz = tx2, hw = width / 2 - 0.4, quad = (o, d0, d1, u0, u1, r0, r1) => {      // d = distance from the node, r = lateral range
          const b = o.pos.length / 3; o.pos.push(jx + dx * d0 + rx * r0, 0, jz + dz * d0 + rz * r0, jx + dx * d0 + rx * r1, 0, jz + dz * d0 + rz * r1, jx + dx * d1 + rx * r0, 0, jz + dz * d1 + rz * r0, jx + dx * d1 + rx * r1, 0, jz + dz * d1 + rz * r1);
          o.uv.push(u0, 0, u1, 0, u0, 1, u1, 1); o.idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
        };
        const near = c + 1.6;
        quad(bucket(tx, tz, 'zebra', zebraMat, -12), near + 4, near, 0, Math.round(width / 4), -hw, hw);
        quad(bucket(tx, tz, 'line', lineMat, -12), near + 5.9, near + 5.5, 0, 1, way.oneway ? -hw : 0.15, hw);
      }
    });

    // junction patches: plain asphalt discs where 3+ road arms meet
    for (const j of jmap.values()) {
      if (j.minCls === 7 || j.maxW < 6.5) continue;
      const { x, z } = j, out = bucket(Math.floor(x / TILE), Math.floor(z / TILE), 'junc', plainMat, -13), base = out.pos.length / 3, r = j.maxW * 0.56, N = 10;
      out.pos.push(x, 0, z); out.uv.push(0.5, 0.5);
      for (let i = 0; i < N; i++) { const t = i / N * Math.PI * 2; out.pos.push(x + Math.cos(t) * r, 0, z + Math.sin(t) * r); out.uv.push(0.5 + Math.cos(t) * 0.4, 0.5 + Math.sin(t) * 0.4); }
      for (let i = 0; i < N; i++) out.idx.push(base, base + 1 + (i + 1) % N, base + 1 + i);
    }
    this.meshes = [];
    for (const b of buckets.values()) { if (!b.out.idx.length) continue; const m = ribbonMesh(b.out, b.material, b.order); m.geometry.computeBoundingSphere(); group.add(m); this.meshes.push(m); }
    this.stats = { ways: this.ways.length, meshes: this.meshes.length, junctions: this.junctions.length / 3 };
  }

  /** Hide tiles far from the camera (cheap distance cull on top of frustum culling). */
  update(cx, cz, viewDist) {
    for (const m of this.meshes) { const s = m.geometry.boundingSphere; m.visible = Math.hypot(s.center.x - cx, s.center.z - cz) < viewDist + s.radius; }
  }

  /** Nearest point on any road within maxD. Returns null or {wi, seg, t, x, z, d, way}. */
  nearest(x, z, maxD = 60, maxCls = 7) {
    let best = null, bd = maxD;
    const seen = new Set();
    this.grid.query(x - maxD, z - maxD, x + maxD, z + maxD, (code) => {
      if (seen.has(code)) return; seen.add(code);
      const wi = Math.floor(code / 4096), i = code % 4096, w = this.ways[wi]; if (w.cls > maxCls) return;
      const p = w.pts, ax = p[i * 2], az = p[i * 2 + 1], dx = p[i * 2 + 2] - ax, dz = p[i * 2 + 3] - az, L2 = dx * dx + dz * dz || 1e-9;
      let t = ((x - ax) * dx + (z - az) * dz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz);
      if (d < bd) { bd = d; best = { wi, seg: i, t, x: px, z: pz, d, way: w, h: Math.atan2(dx, dz) }; }
    });
    return best;
  }
  /** True if (x,z) is on a road surface (used so bridges count as ground over water). */
  onRoad(x, z, pad = 1) { const r = this.nearest(x, z, 40); return !!r && r.d < r.way.w / 2 + pad; }

  /** Ways connected at a way's point (excluding itself): returns [[wi, ptIdx], ...] */
  links(wi, pi) {
    const w = this.ways[wi], a = this.nodes.get(w.pts[pi * 2] + ',' + w.pts[pi * 2 + 1]) || [], out = [];
    for (let i = 0; i < a.length; i += 2) if (a[i] !== wi) out.push([a[i], a[i + 1]]);
    return out;
  }
}
