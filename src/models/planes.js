// Low-poly narrow-body airliner (A320 / B737 class). Metres, Y up, nose = +Z, origin = ground below fuselage mid-point.
// Livery 0 / 1 / 2 = red / blue / green (fictional, no real airline marks).
import { THREE, mat, box, finalize } from '../landmarks/_kit.js';

const AXIS = 3.9;       // fuselage axis height above ground
const R = 1.98;         // fuselage radius
const NSEG = 24;        // ring segments (15 deg each)

// fuselage profile: radius and axis height at z
function prof(z) {
  if (z > 15) { const u = Math.min(1, (z - 15) / 3.8); return { r: Math.max(0.12, R * Math.sqrt(1 - u * u)), cy: AXIS - 0.18 * u * u }; }
  if (z >= -8) return { r: R, cy: AXIS };
  const v = Math.min(1, (-8 - z) / 10.8);
  return { r: Math.max(0.14, R * (1 - 0.93 * Math.pow(v, 1.5))), cy: AXIS + 1.25 * v * v };
}

/** Loft over ring vertex indices `idx` along the fuselage between the z stations in `zs`. */
function fuse(idx, zs, grow = 1, cap = false) {
  const pos = [], ind = [], n = idx.length;
  for (const z of zs) {
    const { r, cy } = prof(z);
    for (const i of idx) { const a = i * Math.PI * 2 / NSEG; pos.push(Math.cos(a) * r * grow, cy + Math.sin(a) * r * grow, z); }
  }
  const cnt = cap ? n : n - 1;
  for (let k = 0; k < zs.length - 1; k++) for (let i = 0; i < cnt; i++) {
    const a = k * n + i, b = k * n + (i + 1) % n, c = (k + 1) * n + (i + 1) % n, d = (k + 1) * n + i;
    ind.push(a, b, c, a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(ind); g.computeVertexNormals();
  return g;
}
const range = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);

/** Flat plate from top-view polygon [[x,z],...], thickness th, bottom at y; dihedral raises y by k per metre of |x|. */
function plate(pts, th, y, dihedral = 0, x0 = 0) {
  const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], -p[1])));
  const g = new THREE.ExtrudeGeometry(shape, { depth: th, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + y + Math.max(0, Math.abs(p.getX(i)) - x0) * dihedral);
  g.computeVertexNormals();
  return new THREE.Mesh(g, null);
}
/** Vertical plate from side polygon [[z,y],...] with thickness th at x. */
function fin(pts, th, x, material) {
  const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
  const g = new THREE.ExtrudeGeometry(shape, { depth: th, bevelEnabled: false });
  g.rotateY(-Math.PI / 2); g.translate(x + th / 2, 0, 0);
  return new THREE.Mesh(g, material);
}
function cylZ(r0, r1, len, material, x, y, z, seg = 14) { // r0 at +z end, r1 at -z end
  const g = new THREE.CylinderGeometry(r0, r1, len, seg); g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, material); m.position.set(x, y, z); return m;
}
function cylX(r, w, material, x, y, z, seg = 12) {
  const g = new THREE.CylinderGeometry(r, r, w, seg); g.rotateZ(Math.PI / 2);
  const m = new THREE.Mesh(g, material); m.position.set(x, y, z); return m;
}

const LIVERY = [0xd32f2f, 0x1e5bb8, 0x1f8a4c];

export function buildAirliner(livery = 0) {
  const col = LIVERY[((livery % 3) + 3) % 3];
  const white = mat(0xf4f5f6), grey = mat(0xd3d8dc), dark = mat(0x1d252d), gear = mat(0x6d7379), tire = mat(0x1d1e20), paint = mat(col);
  const g = new THREE.Group();
  const ring = [...Array(NSEG).keys()];

  // ── fuselage ──
  const zsBody = [-18.8, -16.5, -14.2, -12, -10, -8, -4, 0, 8, 15, 16.2, 17.2, 18.0, 18.5, 18.8];
  g.add(new THREE.Mesh(fuse(ring, zsBody, 1, true), white));
  // belly (light grey) below the axis
  g.add(new THREE.Mesh(fuse([17, 18, 19, 20, 21, 22, 23], range(-9, 15, 8), 1.006), grey));
  // window row (one pane every 0.76 m)
  for (let z = -10.5; z < 14.3; z += 0.76) {
    g.add(new THREE.Mesh(fuse([1, 2], [z, z + 0.42], 1.012), dark));
    g.add(new THREE.Mesh(fuse([10, 11], [z, z + 0.42], 1.012), dark));
  }
  // cockpit windscreen + side panes
  g.add(new THREE.Mesh(fuse([3, 4, 5, 6, 7, 8, 9], range(15.4, 17.2, 3), 1.014), dark));
  g.add(new THREE.Mesh(fuse([1, 2], range(15.2, 16.4, 2), 1.014), dark));
  g.add(new THREE.Mesh(fuse([10, 11], range(15.2, 16.4, 2), 1.014), dark));
  // livery cheat line under the windows
  g.add(new THREE.Mesh(fuse([23, 0], range(-9, 14.5, 7), 1.01), paint));
  g.add(new THREE.Mesh(fuse([12, 13], range(-9, 14.5, 7), 1.01), paint));
  // coloured tail cone
  g.add(new THREE.Mesh(fuse(ring, range(-18.8, -15.5, 3), 1.012), paint));

  // ── wings ──
  const wy = AXIS - 1.05, dih = 0.09, th = 0.32;
  for (const s of [1, -1]) {
    const pts = [[1.0, 6.4], [17.7, -2.8], [17.7, -4.3], [1.0, 0.3]].map(p => [s * p[0], p[1]]);
    if (s < 0) pts.reverse();
    const w = plate(pts, th, wy, dih, 1.0); w.material = grey; g.add(w);
    const tipY = wy + (17.7 - 1.0) * dih;
    // winglet
    g.add(fin([[-3.0, 0], [-4.35, 0], [-5.0, 1.9], [-4.1, 1.9]].map(p => [p[0] + 0.0, p[1] + tipY]), 0.1, s * 17.75 - (s > 0 ? 0 : 0.1), white));
  }
  // wing-root fairing
  g.add(box(3.6, 0.9, 8.5, white, 0, wy - 0.55, 2.6));

  // ── tail ──
  g.add(fin([[-8.8, 5.0], [-18.0, 5.0], [-17.2, 11.8], [-14.2, 11.8]], 0.26, -0.13, paint));
  g.add(fin([[-8.8, 5.0], [-9.4, 5.0], [-14.2, 11.8], [-14.5, 11.8]], 0.28, -0.14, white));  // white leading-edge cap
  for (const s of [1, -1]) {
    const pts = [[0.6, -12.9], [6.2, -16.8], [6.2, -17.9], [0.6, -17.7]].map(p => [s * p[0], p[1]]);
    if (s < 0) pts.reverse();
    const t = plate(pts, 0.2, 4.25, 0.05, 0.6); t.material = grey; g.add(t);
  }

  // ── engines ──
  for (const s of [1, -1]) {
    const x = s * 5.7, y = 1.45;
    g.add(cylZ(0.98, 0.78, 3.6, white, x, y, 4.7));
    g.add(cylZ(0.99, 0.99, 0.3, paint, x, y, 6.4));                // coloured intake lip
    g.add(cylZ(0.8, 0.8, 0.12, dark, x, y, 6.5));                  // intake
    g.add(cylZ(0.3, 0.55, 1.0, gear, x, y, 2.5));                  // exhaust cone
    g.add(box(0.32, 1.0, 2.6, white, x, y + 0.7, 4.3));            // pylon
  }

  // ── landing gear ──
  const strut = (x, z, y0, y1, r) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, y1 - y0, 6), gear); m.position.set(x, (y0 + y1) / 2, z); return m; };
  g.add(strut(0, 13.9, 0.3, 2.2, 0.08));
  for (const s of [1, -1]) {
    g.add(cylX(0.34, 0.22, tire, s * 0.22, 0.34, 13.9));
    g.add(strut(s * 3.8, 1.0, 0.55, 3.25, 0.11));
    g.add(box(0.15, 0.18, 1.7, gear, s * 3.8, 0.5, 1.0));
    for (const dz of [-0.75, 0.75]) g.add(cylX(0.55, 0.32, tire, s * 3.8, 0.55, 1.0 + dz));
  }
  const out = finalize(g);
  out.userData = { length: 37.6, wingspan: 35.8, livery };
  return out;
}
