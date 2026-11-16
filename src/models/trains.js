// Low-poly trains. Metres, Y up, length along Z, origin = car centre on top of the rail (y = 0).
//   buildHSRCar('head' | 'mid' | 'tail')   CR400-style EMU car (head nose +Z, tail nose -Z)
//   buildTrainCar('loco' | 'coach')         HXD3D-style electric loco / type-25 passenger coach
import { THREE, mat, box, cyl, finalize } from '../landmarks/_kit.js';

/** Extrude a cross-section polygon [[x,y],...] along Z from z0 to z0+len. */
function section(pts, len, z0, material) {
  const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
  const g = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false });
  g.translate(0, 0, z0);
  return new THREE.Mesh(g, material);
}

/** Extrude a side profile [[z,y],...] across X (centred, width w). */
function side(pts, w, material) {
  const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
  const g = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
  g.rotateY(-Math.PI / 2); g.translate(w / 2, 0, 0);
  return new THREE.Mesh(g, material);
}

/** Wheel along X axis. */
function wheelX(r, w, x, y, z, material) {
  const g = new THREE.CylinderGeometry(r, r, w, 12); g.rotateZ(Math.PI / 2);
  const m = new THREE.Mesh(g, material); m.position.set(x, y, z); return m;
}

function bogie(g, z, r, axles, wheelM, frameM, gauge = 0.72, frameY = 0.55) {
  g.add(box(2.2, 0.28, axles.length > 2 ? 5.0 : 3.0, frameM, 0, frameY - 0.14, z));
  for (const a of axles) {
    for (const sx of [1, -1]) g.add(wheelX(r, 0.14, sx * gauge, r, z + a, wheelM));
    g.add(cyl(0.07, 0.07, gauge * 2, frameM, 0, r - 0.0, z + a, 6).rotateZ(Math.PI / 2));
  }
}

// ──────────────────────────── HSR ────────────────────────────
// half-profile of the car cross-section (right side, bottom → roof centre)
const HSR_HALF = [[1.68, 0.55], [1.68, 2.55], [1.58, 3.2], [1.25, 3.75], [0.72, 4.02], [0, 4.05]];
const HSR_RING = [...HSR_HALF, ...HSR_HALF.slice(0, 5).reverse().map(p => [-p[0], p[1]])]; // 11 points, CCW seen from +Z

/** Loft of ring points (indices idx) along +Z through N stations; scale functions give the nose shape. */
function loft(ring, idx, N, z0, len, sx, sy, grow = 0, cap = false) {
  const pos = [], ind = [];
  const n = idx.length;
  for (let k = 0; k <= N; k++) {
    const t = k / N;
    for (const i of idx) {
      const [x, y] = ring[i];
      pos.push(x * sx(t) * (1 + grow), 0.55 + (y - 0.55) * sy(t) + (grow ? grow * 3 : 0) * (y > 2.5 ? 1 : 0), z0 + len * t);
    }
  }
  const closed = cap; // closed ring => also connect last to first
  const cnt = closed ? n : n - 1;
  for (let k = 0; k < N; k++) for (let i = 0; i < cnt; i++) {
    const a = k * n + i, b = k * n + (i + 1) % n, c = (k + 1) * n + (i + 1) % n, d = (k + 1) * n + i;
    ind.push(a, b, c, a, c, d);
  }
  if (cap) { // tip cap
    let cx = 0, cy = 0; for (let i = 0; i < n; i++) { cx += pos[N * n * 3 + i * 3]; cy += pos[N * n * 3 + i * 3 + 1]; }
    pos.push(cx / n, cy / n, z0 + len); const c0 = (N + 1) * n;
    for (let i = 0; i < n; i++) ind.push(N * n + i, N * n + (i + 1) % n, c0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(ind); g.computeVertexNormals();
  return g;
}

function pantograph(g, z, dark, grey) {
  g.add(box(0.5, 0.12, 0.3, grey, 0.5, 4.02, z - 0.6)); g.add(box(0.5, 0.12, 0.3, grey, 0.5, 4.02, z + 0.6));
  const arm = (z0, y0, z1, y1, x) => {
    const len = Math.hypot(z1 - z0, y1 - y0); const m = box(0.08, 0.08, len, dark, 0, 0, 0);
    m.position.set(x, (y0 + y1) / 2, (z0 + z1) / 2); m.rotation.x = Math.atan2(-(y1 - y0), z1 - z0); return m;
  };
  g.add(arm(z - 0.6, 4.1, z + 0.1, 4.38, 0.5)); g.add(arm(z + 0.6, 4.1, z + 0.1, 4.38, 0.5));
  g.add(box(1.9, 0.05, 0.14, dark, 0.5, 4.38, z + 0.1));
}

export function buildHSRCar(kind = 'mid') {
  if (kind !== 'head' && kind !== 'tail') kind = 'mid';
  const white = mat(0xeef0f3), red = mat(0xc4152b), dark = mat(0x18222d), grey = mat(0x5a6068), wheelM = mat(0x25272a), roofM = mat(0xaab2ba);
  const inner = new THREE.Group();
  const isEnd = kind !== 'mid';
  const L = isEnd ? 27 : 25;
  const bodyZ0 = -13.5 + (isEnd ? 0 : 1);   // rear end of the body
  const straight = isEnd ? 20 : 25;
  inner.add(section(HSR_RING, straight, bodyZ0, white));
  // roof centre strip (grey)
  inner.add(box(1.0, 0.03, straight - 2, roofM, 0, 4.045, bodyZ0 + straight / 2));
  // belt stripe + window band on both sides
  const zA = bodyZ0 + 0.8, zB = bodyZ0 + straight - 0.4;
  for (const sx of [1, -1]) {
    inner.add(box(0.03, 0.26, straight - 0.2, red, sx * 1.69, 0.95, bodyZ0 + straight / 2));
    inner.add(box(0.03, 0.12, straight - 0.2, red, sx * 1.69, 2.62, bodyZ0 + straight / 2));
    // windows: pitch 2.1, with door breaks near both ends
    for (let z = zA + 2.2; z < zB - 1.5; z += 2.2) {
      if (Math.abs(z - (bodyZ0 + straight / 2)) < 0.1) continue;
      inner.add(box(0.03, 0.85, 1.55, dark, sx * 1.69, 1.55, z));
    }
    inner.add(box(0.035, 1.8, 1.0, grey, sx * 1.69, 0.8, bodyZ0 + 2.5 * 0.0 + 1.6)); // door
  }
  // underframe + bogies
  inner.add(box(2.7, 0.4, straight - 3, grey, 0, 0.45, bodyZ0 + straight / 2));
  const bz = isEnd ? [-9.0, 6.0] : [-8.75, 8.75];
  for (const z of bz) bogie(inner, z, 0.46, [-1.25, 1.25], wheelM, grey);
  if (isEnd) {
    // nose
    const z0 = bodyZ0 + straight, nl = 7;
    const sx = t => Math.sqrt(Math.max(0.02, 1 - 0.96 * t * t)), sy = t => 1 - 0.68 * Math.pow(t, 1.5);
    inner.add(new THREE.Mesh(loft(HSR_RING, [...HSR_RING.keys()], 9, z0, nl, sx, sy, 0, true), white));
    // red lower nose (wall bands) and cab windscreen (dark roof strip)
    inner.add(new THREE.Mesh(loft(HSR_RING, [0, 1], 9, z0, nl * 0.82, sx, sy, 0.012), red));
    inner.add(new THREE.Mesh(loft(HSR_RING, [10, 9], 9, z0, nl * 0.82, sx, sy, 0.012), red));
    const wsT0 = 0.16, wsT1 = 0.62, NW = 4;
    const wsx = t => sx(wsT0 + (wsT1 - wsT0) * t), wsy = t => sy(wsT0 + (wsT1 - wsT0) * t);
    inner.add(new THREE.Mesh(loft(HSR_RING, [3, 4, 5, 6, 7], NW, z0 + nl * wsT0, nl * (wsT1 - wsT0), wsx, wsy, 0.014), dark));
    inner.add(new THREE.Mesh(loft(HSR_RING, [2, 3], NW, z0 + nl * wsT0, nl * (wsT1 - wsT0), wsx, wsy, 0.014), dark));
    inner.add(new THREE.Mesh(loft(HSR_RING, [8, 9], NW, z0 + nl * wsT0, nl * (wsT1 - wsT0), wsx, wsy, 0.014), dark));
    // headlights
    for (const sx2 of [1, -1]) inner.add(box(0.4, 0.14, 0.1, mat(0xfff7d6, { emissive: 0xfff7d6, emissiveIntensity: 0.5 }), sx2 * 0.45, 1.05, z0 + nl - 0.9));
  } else {
    pantograph(inner, 3.0, dark, grey);
  }
  const outer = new THREE.Group(); outer.add(inner);
  if (kind === 'tail') inner.rotation.y = Math.PI;
  const out = finalize(outer);
  out.userData = { length: L, kind };
  return out;
}

// ──────────────────────────── conventional trains ────────────────────────────
function loco() {
  const L = 22, W = 3.1;
  const red = mat(0xb3261e), yellow = mat(0xe8b923), dark = mat(0x18222d), grey = mat(0x5a6068), wheelM = mat(0x25272a), white = mat(0xe8e6df), roofG = mat(0x8e949a), louver = mat(0x7d1b15);
  const g = new THREE.Group();
  const h = L / 2, rf = 3.75;
  g.add(side([[-h, 0.95], [h, 0.95], [h, 2.5], [h - 1.0, rf], [-h + 1.0, rf], [-h, 2.5]], W, red));
  // roof equipment and pantographs
  g.add(box(1.6, 0.25, 8.0, roofG, 0, rf, 0));
  for (const s of [1, -1]) {
    const z = s * 4.4;
    g.add(box(1.2, 0.1, 0.35, grey, 0, rf + 0.25, z - 0.5)); g.add(box(1.2, 0.1, 0.35, grey, 0, rf + 0.25, z + 0.5));
    for (const sgn of [1, -1]) { const m = box(0.08, 0.08, 1.2, dark, 0, 0, 0); m.position.set(0, rf + 0.32 + 0.1 + 0.06, z + sgn * 0.3); m.rotation.x = sgn * -0.35; g.add(m); }
    g.add(box(1.9, 0.05, 0.16, dark, 0, rf + 0.5, z));
  }
  for (const sx of [1, -1]) {
    g.add(box(0.03, 0.2, L - 1.0, yellow, sx * (W / 2 + 0.005), 1.35, 0));            // yellow belt
    g.add(box(0.03, 0.12, L - 1.0, yellow, sx * (W / 2 + 0.005), 3.35, 0));
    for (const e of [1, -1]) {
      g.add(box(0.03, 0.85, 1.3, dark, sx * (W / 2 + 0.005), 2.0, e * (h - 2.2)));      // cab side window
      g.add(box(0.03, 1.9, 0.8, grey, sx * (W / 2 + 0.005), 1.0, e * (h - 3.6)));       // cab door
    }
    for (let i = -3; i <= 3; i++) g.add(box(0.03, 1.6, 0.9, louver, sx * (W / 2 + 0.005), 1.35, i * 1.3)); // louvres
  }
  // slanted windscreens
  for (const e of [1, -1]) {
    const m = box(W - 0.5, 0.05, 1.25, dark, 0, 0, 0);
    m.position.set(0, (2.5 + rf) / 2 + 0.02, e * (h - 0.5 + 0.03)); m.rotation.x = e * Math.atan2(rf - 2.5, 1.0) * -1 * -1;
    m.rotation.x = e > 0 ? -Math.atan2(rf - 2.5, 1.0) : Math.atan2(rf - 2.5, 1.0);
    g.add(m);
    // headlights, numberplate, cowcatcher
    for (const sx of [1, -1]) g.add(box(0.3, 0.2, 0.08, white, sx * 1.1, 1.5, e * (h + 0.0)));
    g.add(box(W - 0.2, 0.28, 0.25, dark, 0, 0.62, e * (h - 0.05)));
    g.add(box(0.9, 0.22, 0.04, white, 0, 1.8, e * (h + 0.0)));
  }
  // underframe + bogies (3 axles each)
  g.add(box(2.6, 0.4, 14, grey, 0, 0.55, 0));
  for (const z of [-5.8, 5.8]) bogie(g, z, 0.625, [-2.0, 0, 2.0], wheelM, grey, 0.72, 0.7);
  return g;
}

function coach() {
  const L = 25.5, W = 3.1;
  const green = mat(0x1f5a3a), yellow = mat(0xe6b422), dark = mat(0x18222d), grey = mat(0x5a6068), wheelM = mat(0x25272a), roofG = mat(0x9aa0a6);
  const g = new THREE.Group();
  const hw = W / 2;
  const prof = [[hw, 1.0], [hw, 3.3], [hw - 0.15, 3.75], [hw - 0.65, 4.0], [0, 4.05], [-(hw - 0.65), 4.0], [-(hw - 0.15), 3.75], [-hw, 3.3], [-hw, 1.0]];
  g.add(section(prof, L, -L / 2, green));
  g.add(box(1.5, 0.35, 3.2, roofG, 0, 4.05, -5.5)); g.add(box(1.5, 0.35, 3.2, roofG, 0, 4.05, 5.5));
  for (const sx of [1, -1]) {
    g.add(box(0.03, 0.12, L - 0.2, yellow, sx * (hw + 0.005), 1.55, 0));
    g.add(box(0.03, 0.12, L - 0.2, yellow, sx * (hw + 0.005), 3.1, 0));
    for (let z = -10.4; z <= 10.5; z += 1.3) g.add(box(0.03, 0.95, 0.9, dark, sx * (hw + 0.005), 1.75, z));
    for (const e of [1, -1]) g.add(box(0.03, 1.9, 0.9, dark, sx * (hw + 0.005), 1.1, e * (L / 2 - 1.1)));
  }
  for (const e of [1, -1]) { g.add(box(1.5, 2.6, 0.12, dark, 0, 1.1, e * (L / 2 + 0.0))); g.add(box(0.3, 0.2, 0.05, yellow, 0, 3.5, e * (L / 2 + 0.01))); }
  g.add(box(2.6, 0.4, 17, grey, 0, 0.6, 0));
  for (const z of [-9, 9]) bogie(g, z, 0.46, [-1.2, 1.2], wheelM, grey, 0.72, 0.65);
  return g;
}

export function buildTrainCar(kind = 'coach') {
  const out = finalize(kind === 'loco' ? loco() : coach());
  out.userData = { length: kind === 'loco' ? 22 : 25.5, kind };
  return out;
}
