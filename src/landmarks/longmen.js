// 龙门石窟 Longmen Grottoes — 720 x 1100 m composite scene.
// Local frame: the Yi River runs along Z through x ∈ [-105, 105] (engine draws the water; kept empty except bridges).
// West bank (x < -105): 龙门山 limestone cliff with caves + 奉先寺 great niche (卢舍那大佛 facing +X).
// East bank (x > 105): 香山 hill with 香山寺 on terraces (north part). North end z≈-480: 龙门大桥 + 牌楼 plaza. South end z≈+480: 漫水桥.
import { THREE, C, mat, box, cyl, sphere, plaza, prism, hall, tangRoof, sign, tree, lamp, patternTex, finalize, rng } from './_kit.js';

const ZC = 120;                 // 奉先寺 niche centre (z), "正中偏南"
const NICHE_HALF = 19;          // niche half-width along z (≈ 38 m wide)
const NICHE_FLOOR = 10;         // niche floor height
const NICHE_BACK = -160;        // niche back wall x
const BUDDHA_X = -153;          // Buddha centre x
const TEMPLE = { z0: -275, z1: -195, zc: -235 };      // 香山寺 extent along z
const TERR = [ { x0: 132, x1: 152, y: 12 }, { x0: 152, x1: 174, y: 20 }, { x0: 174, x1: 200, y: 28 }, { x0: 200, x1: 222, y: 36 } ];
const BRIDGE_Z = -480;

// ───────────── helpers ─────────────
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, z, sc = 38) {
  const fx = x / sc, fz = z / sc, i = Math.floor(fx), j = Math.floor(fz), u = sstep(0, 1, fx - i), v = sstep(0, 1, fz - j);
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Ellipsoid centred at (x,y,z). */
function ell(rx, ry, rz, m, x, y, z, seg = 12) { const s = sphere(1, m, x, y, z, seg); s.scale.set(rx, ry, rz); return s; }
/** Cylinder from p1 (radius r1) to p2 (radius r2). */
function limb(p1, p2, r1, r2, m, seg = 8) {
  const a = new THREE.Vector3(...p1), b = new THREE.Vector3(...p2), dir = b.clone().sub(a), len = dir.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, len, seg), m);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}
/** Box spanning a sloped segment (x1,y1)->(x2,y2) in the XY plane; thickness along z, height above the line. */
function segBox(x1, y1, x2, y2, thick, h, z, m) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, h, thick), m);
  mesh.rotation.z = a;
  mesh.position.set((x1 + x2) / 2 - Math.sin(a) * h / 2, (y1 + y2) / 2 + Math.cos(a) * h / 2, z);
  return mesh;
}
const torusArc = (r, tube, arc, m) => new THREE.Mesh(new THREE.TorusGeometry(r, tube, 4, 14, arc), m);

// ───────────── terrain height functions ─────────────
const envW = (z) => sstep(-445, -372, z) * (1 - sstep(472, 540, z));
const envE = (z) => sstep(-468, -400, z) * (1 - sstep(472, 540, z));
function cliffTop(z) {   // west cliff crest before envelope
  let H = 53 + 9 * Math.sin(z * 0.0105 + 1.0) + 5 * Math.sin(z * 0.029 + 2.0) + 2.5 * Math.sin(z * 0.083);
  if (Math.abs(z - ZC) < 50) H = Math.max(H, 62);
  return H;
}
function hWest(x, z) {
  const inNiche = Math.abs(z - ZC) <= NICHE_HALF && x <= -121.5 && x >= NICHE_BACK;
  if (inNiche) {
    if (Math.abs(z - ZC) <= 5 && x >= -139) return 1 + 9 * (-121 - x) / 18;   // stair notch (covered by steps)
    return NICHE_FLOOR;
  }
  if (x >= -121) return 1;
  const H = cliffTop(z), P = H + 22 + 8 * Math.sin(z * 0.0071 + 0.3);
  if (x > -122.2) return 1 + (H - 1) * (0.3 + 0.4 * hash(Math.round(z), 7)) * envW(z);   // kinked, faceted rock face
  const d = Math.max(0, -122.5 - x);
  let raw = H + (P - H) * sstep(0, 110, d) - Math.max(0, d - 150) * 0.18;
  raw += (vnoise(x, z) - 0.5) * 12 * sstep(0, 18, d) + (vnoise(x + 500, z, 95) - 0.5) * 34 * sstep(15, 90, d) + (hash(Math.round(x), Math.round(z)) - 0.5) * 2.5 * sstep(0, 8, d);
  const base = 0.2 + 0.8 * sstep(-262, -200, x);
  return base + (raw - base) * envW(z) * sstep(-358, -265 + 35 * Math.sin(z * 0.013 + 2), x);
}
const bankTop = (z) => 9 + 3 * Math.sin(z * 0.02 + 1);
function hEast(x, z) {
  if (x <= 120) return 1;
  const Lb = bankTop(z);
  const Pk = 74 + 13 * Math.sin(z * 0.0052 + 0.9) + 4 * Math.sin(z * 0.021) - 15 * Math.exp(-(((z + 235) / 110) ** 2));
  let raw = x <= 124 ? Lb : Lb + (Pk - Lb) * sstep(124, 300, x) + (vnoise(x, z, 34) - 0.5) * 12 * sstep(124, 145, x) + (hash(Math.round(x), Math.round(z)) - 0.5) * 2 * sstep(124, 135, x) + (vnoise(x + 900, z, 85) - 0.5) * 30 * sstep(150, 230, x);
  const base = 0.2 + 0.8 * (1 - sstep(200, 262, x));
  let y = base + (raw - base) * envE(z) * (1 - sstep(270 + 30 * Math.sin(z * 0.011), 358, x));
  if (z >= TEMPLE.z0 - 0.1 && z <= TEMPLE.z1 + 0.1 && x <= 222.1) {         // cut the temple terraces into the slope
    let lim;
    if (x < 132) lim = 1 + 11 * (x - 120) / 12 - 0.6;
    else lim = TERR.find(t => x <= t.x1 + 0.01).y - 0.4;
    y = Math.min(y, Math.max(lim, 0.6));
  }
  return y;
}

// ───────────── terrain mesh builder (flat-shaded heightfield, triangles bucketed by material) ─────────────
function buildTerrain(xs, zs, hf, classify, out) {
  const nx = xs.length, nz = zs.length, H = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) H[i + j * nx] = hf(xs[i], zs[j]);
  const buckets = new Map();
  const v = (i, j) => [xs[i], H[i + j * nx], zs[j]];
  const push = (a, b, c) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
    let n = [uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx]; const l = Math.hypot(...n) || 1; n = n.map(q => q / l);
    if (l < 1e-6) return;
    const key = classify(a, b, c, n);
    if (!buckets.has(key)) buckets.set(key, { p: [], n: [] });
    const bk = buckets.get(key);
    for (const p of [a, b, c]) { bk.p.push(...p); bk.n.push(...n); }
  };
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = v(i, j), b = v(i + 1, j), c = v(i, j + 1), d = v(i + 1, j + 1);
    push(a, c, b); push(b, c, d);
  }
  for (const [m, bk] of buckets) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(bk.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(bk.n, 3));
    out.add(new THREE.Mesh(g, m));
  }
  return { xs, zs, H, nx };
}
/** Height of the actual terrain mesh at (x,z) (same triangulation as buildTerrain). */
function sampleGrid(gr, x, z) {
  const { xs, zs, H, nx } = gr;
  let i = 0; while (i < xs.length - 2 && xs[i + 1] < x) i++;
  let j = 0; while (j < zs.length - 2 && zs[j + 1] < z) j++;
  const u = Math.min(1, Math.max(0, (x - xs[i]) / (xs[i + 1] - xs[i]))), w = Math.min(1, Math.max(0, (z - zs[j]) / (zs[j + 1] - zs[j])));
  const ha = H[i + j * nx], hb = H[i + 1 + j * nx], hc = H[i + (j + 1) * nx], hd = H[i + 1 + (j + 1) * nx];
  return u + w <= 1 ? ha + u * (hb - ha) + w * (hc - ha) : hd + (1 - u) * (hc - hd) + (1 - w) * (hb - hd);
}
const uniq = (arr) => [...new Set(arr.map(q => Math.round(q * 100) / 100))].sort((a, b) => a - b);

// ───────────── 卢舍那大佛 Vairocana (local: front +Z, y=0 at niche floor) ─────────────
function buildVairocana() {
  const g = new THREE.Group();
  const stone = mat(0xcbb895), stoneD = mat(0xb3a283), face = mat(0xd6c6a6), feat = mat(0x7a6b55), hair = mat(0x8e8169);
  const aur = mat(0x9c8970), aurIn = mat(0xb39878), flame = mat(0xa98366), pedM = mat(0xb7ab92, { map: patternTex('stone', 0xb7ab92) });
  // 须弥座 + lotus throne
  g.add(box(16, 1.2, 12, pedM, 0, 0, 0.5));
  g.add(cyl(6.3, 6.8, 1.2, pedM, 0, 1.2, 0.5, 8));
  g.add(cyl(5.4, 5.4, 1.0, stoneD, 0, 2.4, 0.5, 8));
  g.add(cyl(6.9, 6.0, 0.9, pedM, 0, 3.4, 0.5, 8));
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2; if (Math.cos(a) < -0.6) continue;
    const p = ell(1.35, 0.75, 0.55, stoneD, Math.sin(a) * 6.6, 3.85, 0.5 + Math.cos(a) * 6.6, 6); p.rotation.y = a; g.add(p);
  }
  const Y0 = 4.3;                                         // statue base; statue is 17 m tall → top ≈ Y0+17
  // robe hanging over the front of the throne (悬裳)
  g.add(box(10.5, 2.2, 0.8, stone, 0, Y0 - 2.0, 6.9));
  // crossed legs, knees, soles, hands
  g.add(ell(6.9, 1.75, 3.9, stone, 0, Y0 + 1.5, 1.6, 16));
  for (const s of [-1, 1]) {
    g.add(ell(1.9, 1.4, 1.9, stone, s * 5.0, Y0 + 1.55, 3.2, 10));
    g.add(ell(1.25, 0.45, 0.6, stoneD, s * 1.9, Y0 + 3.05, 3.9, 8));
  }
  g.add(ell(2.1, 0.8, 1.35, stoneD, 0, Y0 + 3.05, 3.0, 10));
  // torso (通肩袈裟 — robe covers both shoulders)
  const torso = cyl(3.5, 4.8, 7.2, stone, 0, Y0 + 2.0, -0.8, 14); torso.scale.z = 0.62; g.add(torso);
  g.add(ell(3.5, 2.6, 2.1, stone, 0, Y0 + 7.0, 0.5, 14));      // chest
  g.add(ell(5.5, 2.0, 2.8, stone, 0, Y0 + 8.7, -0.8, 14));   // shoulders
  for (const s of [-1, 1]) {
    g.add(limb([s * 4.9, Y0 + 8.4, -0.6], [s * 5.4, Y0 + 4.4, 0.2], 1.35, 1.25, stone, 8));    // upper arm
    g.add(limb([s * 5.4, Y0 + 4.4, 0.2], [s * 2.0, Y0 + 3.4, 2.9], 1.15, 0.85, stone, 8));    // forearm to lap
    g.add(ell(1.2, 1.2, 1.2, stone, s * 5.4, Y0 + 4.4, 0.2, 8));
    // sleeve hanging down beside the legs
    g.add(ell(1.1, 2.2, 1.6, stoneD, s * 6.2, Y0 + 3.3, 0.6, 8));
  }
  // robe folds: U-shaped ridges on the chest
  for (let k = 0; k < 4; k++) {
    const r = 1.0 + k * 0.6, t = torusArc(r, 0.13, Math.PI, stoneD);
    t.rotation.z = Math.PI; t.rotation.x = -0.35; t.position.set(0, Y0 + 9.2 - k * 0.15, 1.75 + k * 0.05);
    g.add(t);
  }
  for (let k = 0; k < 2; k++) {             // folds across the lap
    const t = torusArc(2.2 + k * 0.9, 0.13, Math.PI, stoneD); t.rotation.x = -Math.PI / 2 + 0.15; t.rotation.z = Math.PI; t.position.set(0, Y0 + 3.15, 1.4 + k * 0.4); g.add(t);
  }
  // neck with 三道
  g.add(cyl(1.2, 1.35, 1.5, stone, 0, Y0 + 9.5, -0.5, 12));
  for (let k = 0; k < 3; k++) g.add(cyl(1.32, 1.36, 0.1, stoneD, 0, Y0 + 9.75 + k * 0.38, -0.5, 12));
  // head
  const HY = Y0 + 12.6, HZ = -0.2, RX = 2.15, RY = 2.55, RZ = 2.1;
  g.add(ell(RX, RY, RZ, face, 0, HY, HZ, 18));
  const fz = (x, dy, off = 0) => HZ + (RZ + off) * Math.sqrt(Math.max(0.02, 1 - (x / RX) ** 2 - (dy / RY) ** 2));
  // hair cap + 螺髻 curls + 肉髻
  const curl = (r, x, y, z) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), hair); m.position.set(x, y, z); return m; };
  const capR = 2.28, capY = HY + 0.95, capZ = HZ - 0.15;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(capR, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), hair); cap.position.set(0, capY, capZ); g.add(cap);
  const curls = [[0.18, 5], [0.42, 11], [0.68, 15], [0.92, 19], [1.18, 22], [1.45, 24]];
  for (const [th, n] of curls) for (let k = 0; k < n; k++) {
    const ph = (k + (n % 2 ? 0.5 : 0)) / n * Math.PI * 2;
    g.add(curl(0.3, Math.sin(th) * Math.sin(ph) * capR, capY + Math.cos(th) * capR, capZ + Math.sin(th) * Math.cos(ph) * capR));
  }
  g.add(ell(1.15, 0.95, 1.15, hair, 0, capY + capR + 0.25, capZ - 0.1, 10));
  for (let k = 0; k < 9; k++) { const ph = k / 9 * Math.PI * 2; g.add(curl(0.26, Math.sin(ph) * 0.95, capY + capR + 0.6, capZ - 0.1 + Math.cos(ph) * 0.95)); }
  // ears (long lobes)
  for (const s of [-1, 1]) {
    g.add(ell(0.34, 1.05, 0.62, face, s * 2.15, HY + 0.1, HZ - 0.25, 8));
    g.add(ell(0.38, 0.45, 0.42, face, s * 2.18, HY - 0.9, HZ - 0.15, 6));
  }
  // facial features
  for (const s of [-1, 1]) {
    const brow = torusArc(0.58, 0.07, Math.PI * 0.75, feat); brow.position.set(s * 0.68, HY + 0.62, fz(s * 0.68, 0.75, 0.02)); brow.rotation.z = Math.PI * 0.125; g.add(brow);
    const eye = box(0.78, 0.1, 0.12, feat, s * 0.68, HY + 0.2, fz(s * 0.68, 0.25, 0.0)); eye.rotation.z = -s * 0.07; eye.rotation.y = s * 0.3; g.add(eye);
  }
  const nose = box(0.42, 1.0, 0.5, face, 0, HY - 0.6, fz(0, -0.2, 0.05)); nose.rotation.x = -0.12; g.add(nose);
  g.add(box(0.5, 0.12, 0.12, feat, 0, HY - 0.62, fz(0, -0.6, 0.12)));        // nostril line
  g.add(box(0.85, 0.12, 0.12, feat, 0, HY - 1.12, fz(0, -1.1, 0.0)));        // lips
  g.add(box(0.6, 0.1, 0.1, stoneD, 0, HY - 0.98, fz(0, -0.95, 0.02)));
  g.add(sphere(0.13, feat, 0, HY + 0.68, fz(0, 0.68, 0.05), 6));             // 白毫 urna
  // 背光: pointed flame mandorla + head halo, carved on the niche wall
  const mand = [[-10.5, 0], [-11.2, 6], [-11.0, 12], [-10, 17], [-8, 21], [-5.5, 24], [-3, 26.5], [-1.2, 28.6], [0, 30.5], [1.2, 28.6], [3, 26.5], [5.5, 24], [8, 21], [10, 17], [11.0, 12], [11.2, 6], [10.5, 0]];
  const mkPlate = (pts, s, depth, m, z) => {
    const sh = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0] * s, p[1] * s)));
    const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(0, 1.2, z); return mesh;
  };
  g.add(mkPlate(mand, 1, 0.8, aur, -7.1));
  g.add(mkPlate(mand, 0.9, 0.5, flame, -6.6));
  g.add(mkPlate(mand, 0.78, 0.4, aurIn, -6.2));
  for (const [r, m, dz] of [[4.6, aur, -5.9], [3.7, aurIn, -5.75]]) { const d = cyl(r, r, 0.3, m, 0, 0, 0, 24); d.rotation.x = Math.PI / 2; d.position.set(0, HY + 0.4, dz); g.add(d); }
  for (const r of [4.6, 3.7, 2.8]) { const t = torusArc(r, 0.16, Math.PI * 2, flame); t.position.set(0, HY + 0.4, -5.55); g.add(t); }
  // small seated Buddhas in the halo ring
  for (let k = 0; k < 7; k++) { const a = Math.PI * (0.15 + k * 0.7 / 6); const x = Math.cos(a) * 7.5 * (k < 3.5 ? 1 : 1), y = HY + 0.4 + Math.sin(a) * 7.5; g.add(ell(0.45, 0.6, 0.3, stoneD, x, y, -5.9, 6)); g.add(ell(0.6, 1.5, 0.3, stoneD, -x, y - 1.2, -5.9, 6)); }
  return g;
}

/** Simplified standing attendant. kind: disciple | bodhisattva | king | guardian. local front +Z, base y=0. */
function attendant(kind, h) {
  const g = new THREE.Group();
  const st = mat(0xc3b08e), sd = mat(0xa8977a), dk = mat(0x6e604c), ped = mat(0xb7ab92);
  const s = h / 12;
  g.add(cyl(1.5 * s, 1.7 * s, 0.9 * s, ped, 0, 0, 0, 8));
  const B = 0.9 * s;            // standing base
  const headR = (kind === 'disciple' ? 0.78 : 0.72) * s;
  const shY = B + 8.6 * s, headY = shY + 1.55 * s;
  if (kind === 'king') {
    g.add(ell(1.8 * s, 0.9 * s, 1.2 * s, dk, 0.4 * s, B + 0.5 * s, 0.3 * s, 8));                    // demon underfoot
    for (const sd2 of [-1, 1]) g.add(limb([sd2 * 0.9 * s, B + 0.8 * s, 0], [sd2 * 0.7 * s, B + 4.6 * s, 0], 0.55 * s, 0.75 * s, sd, 7));
    const skirt = cyl(1.5 * s, 1.9 * s, 2.6 * s, st, 0, B + 3.4 * s, 0, 10); skirt.scale.z = 0.7; g.add(skirt);
    g.add(box(3.3 * s, 2.9 * s, 1.9 * s, sd, 0, B + 5.8 * s, 0));                                    // armour
    g.add(ell(2.1 * s, 0.8 * s, 1.2 * s, st, 0, shY, 0, 10));
    for (const sd2 of [-1, 1]) g.add(ell(0.9 * s, 0.6 * s, 0.9 * s, sd, sd2 * 1.8 * s, shY + 0.1 * s, 0, 8));   // pauldrons
    g.add(limb([1.9 * s, shY, 0], [2.4 * s, shY - 2.6 * s, 0.6 * s], 0.5 * s, 0.45 * s, st, 7));
    g.add(limb([2.4 * s, shY - 2.6 * s, 0.6 * s], [2.2 * s, shY - 0.6 * s, 1.8 * s], 0.42 * s, 0.38 * s, st, 7));
    g.add(limb([-1.9 * s, shY, 0], [-2.5 * s, shY - 3.6 * s, 0.4 * s], 0.5 * s, 0.45 * s, st, 7));
    g.add(box(0.8 * s, 0.5 * s, 0.8 * s, sd, 2.2 * s, shY - 0.4 * s, 1.8 * s)); g.add(box(0.55 * s, 0.6 * s, 0.55 * s, sd, 2.2 * s, shY + 0.1 * s, 1.8 * s)); g.add(cyl(0, 0.35 * s, 0.6 * s, sd, 2.2 * s, shY + 0.7 * s, 1.8 * s, 4));  // pagoda in hand
    g.add(sphere(headR, st, 0, headY, 0.1 * s, 10));
    g.add(cyl(0.5 * s, 0.85 * s, 0.9 * s, sd, 0, headY + 0.45 * s, 0, 8));                           // helmet
  } else if (kind === 'guardian') {
    for (const sd2 of [-1, 1]) g.add(limb([sd2 * 1.4 * s, B, 0.2 * s], [sd2 * 0.8 * s, B + 4.4 * s, 0], 0.65 * s, 0.85 * s, st, 7));   // wide stance
    const skirt = cyl(1.4 * s, 2.0 * s, 2.4 * s, sd, 0, B + 3.2 * s, 0, 10); skirt.scale.z = 0.7; g.add(skirt);
    g.add(ell(1.9 * s, 2.0 * s, 1.3 * s, st, 0, B + 6.6 * s, 0, 10));                               // bare chest
    for (const sd2 of [-1, 1]) g.add(ell(0.9 * s, 0.7 * s, 0.5 * s, st, sd2 * 0.85 * s, B + 7.4 * s, 0.9 * s, 8));   // pecs
    g.add(ell(2.3 * s, 0.9 * s, 1.3 * s, st, 0, shY, 0, 10));
    g.add(limb([2.1 * s, shY, 0], [3.2 * s, shY + 1.4 * s, 0.6 * s], 0.75 * s, 0.6 * s, st, 7));      // raised fist
    g.add(sphere(0.6 * s, st, 3.3 * s, shY + 1.6 * s, 0.7 * s, 7));
    g.add(limb([-2.1 * s, shY, 0], [-3.0 * s, shY - 3.0 * s, 0.5 * s], 0.75 * s, 0.6 * s, st, 7));
    g.add(sphere(0.6 * s, st, -3.0 * s, shY - 3.2 * s, 0.5 * s, 7));
    g.add(torusArc(2.4 * s, 0.18 * s, Math.PI, sd).translateY(shY + 0.6 * s));                         // flying scarf
    g.add(sphere(headR * 1.05, st, 0, headY, 0.15 * s, 10));
    g.add(sphere(0.35 * s, sd, 0, headY + 0.8 * s, 0, 6));
  } else {
    const slender = kind === 'bodhisattva' ? 0.9 : 1;
    const robe = cyl(1.25 * s * slender, 1.65 * s * slender, 6.8 * s, st, 0, B, 0, 10); robe.scale.z = 0.75; g.add(robe);
    const chest = cyl(1.4 * s * slender, 1.25 * s * slender, 1.9 * s, st, 0, B + 6.7 * s, 0, 10); chest.scale.z = 0.75; g.add(chest);
    g.add(ell(1.75 * s * slender, 0.7 * s, 1.05 * s, st, 0, shY, 0, 10));
    for (const sd2 of [-1, 1]) {
      g.add(limb([sd2 * 1.6 * s * slender, shY, 0], [sd2 * 1.7 * s, shY - 3.4 * s, 0.3 * s], 0.42 * s, 0.38 * s, st, 7));
      g.add(limb([sd2 * 1.7 * s, shY - 3.4 * s, 0.3 * s], [sd2 * 0.6 * s, shY - 3.0 * s, 1.1 * s], 0.36 * s, 0.32 * s, st, 7));
    }
    g.add(sphere(headR, st, 0, headY, 0.05 * s, 10));
    const halo = cyl(1.55 * s, 1.55 * s, 0.2 * s, sd, 0, 0, 0, 16); halo.rotation.x = Math.PI / 2; halo.position.set(0, headY + 0.2 * s, -1.0 * s); g.add(halo);
    if (kind === 'bodhisattva') {
      g.add(cyl(0.55 * s, 0.45 * s, 1.1 * s, sd, 0, headY + 0.45 * s, 0, 8));                       // crown
      const neck = torusArc(0.9 * s, 0.1 * s, Math.PI, sd); neck.rotation.z = Math.PI; neck.rotation.x = -0.4; neck.position.set(0, shY - 0.1 * s, 0.75 * s); g.add(neck);
      for (const sd2 of [-1, 1]) g.add(limb([sd2 * 1.0 * s, shY - 0.4 * s, 0.7 * s], [-sd2 * 0.9 * s, B + 3.5 * s, 1.3 * s], 0.14 * s, 0.14 * s, sd, 5));   // crossed beads (璎珞)
    } else {
      for (let k = 0; k < 3; k++) { const t = torusArc(0.6 * s + k * 0.45 * s, 0.09 * s, Math.PI, sd); t.rotation.z = Math.PI; t.position.set(0, shY - 0.4 * s - k * 0.6 * s, 1.0 * s); g.add(t); }
    }
  }
  return g;
}

// ───────────── 香山寺 hall facing -X ─────────────
const YELLOW = 0xd6ad55;

// ───────────── colliders ─────────────
const westColl = [
  { x: -240.5, z: (-428 + (ZC - NICHE_HALF - 0.5)) / 2, w: 239, d: (ZC - NICHE_HALF - 0.5) + 428 },                      // cliff north of niche
  { x: -240.5, z: ((ZC + NICHE_HALF + 0.5) + 505) / 2, w: 239, d: 505 - (ZC + NICHE_HALF + 0.5) },                         // cliff south of niche
  { x: (-360 + NICHE_BACK) / 2, z: ZC, w: 360 + NICHE_BACK, d: NICHE_HALF * 2 + 1 },                                          // rock behind niche
  { x: -122.2, z: ZC - 12.25, w: 2.4, d: 13.5 }, { x: -122.2, z: ZC + 12.25, w: 2.4, d: 13.5 },                              // niche front retaining walls (stairs open)
  { x: BUDDHA_X + 1, z: ZC, w: 14, d: 17 },                                                                                    // Buddha + throne
  ...[-8.5, -12.5, 8.5, 12.5].map(lx => ({ x: BUDDHA_X + (lx * lx > 100 ? 2.5 : 3.5), z: ZC - lx, w: 3.5, d: 3.5 })),
  ...[-16.5, 16.5].flatMap(lx => [{ x: BUDDHA_X + 3, z: ZC - lx, w: 4, d: 4 }, { x: BUDDHA_X + 11, z: ZC - lx, w: 4, d: 4 }]),
];
const eastColl = [
  { x: 240.5, z: (-445 + TEMPLE.z0) / 2, w: 239, d: TEMPLE.z0 + 445 },
  { x: 240.5, z: (TEMPLE.z1 + 505) / 2, w: 239, d: 505 - TEMPLE.z1 },
  { x: 291, z: TEMPLE.zc, w: 138, d: TEMPLE.z1 - TEMPLE.z0 },
  ...TERR.flatMap(t => [{ x: t.x0 + 0.5, z: (TEMPLE.z0 + TEMPLE.zc - 4) / 2, w: 2, d: TEMPLE.zc - 4 - TEMPLE.z0 }, { x: t.x0 + 0.5, z: (TEMPLE.zc + 4 + TEMPLE.z1) / 2, w: 2, d: TEMPLE.z1 - TEMPLE.zc - 4 }]),
  { x: 139.5, z: TEMPLE.zc, w: 9, d: 15 }, { x: 161, z: TEMPLE.zc, w: 10, d: 20 }, { x: 184.5, z: TEMPLE.zc, w: 13, d: 25 }, { x: 212, z: TEMPLE.zc, w: 10, d: 29 },
];

export const meta = { colliders: [...westColl, ...eastColl] };

// ───────────── build ─────────────
// AI 模型（混元图生 3D）：assets/models/lushena.glb 只替换奉先寺正中的卢舍那大佛，山体、洞窟、胁侍、桥仍是代码版。
export const glb = { file: 'lushena', x: BUDDHA_X, y: NICHE_FLOOR, z: ZC, yaw: Math.PI / 2 };

export function build(_kit, o = {}) {
  const g = new THREE.Group();
  const R = rng(19760101);
  const M = {
    rock: mat(0xb9ae9a, { map: patternTex('rock', 0xb9ae9a) }), rockD: mat(0xa69b88, { map: patternTex('rock', 0xa69b88) }), scrub: mat(0x7c8456, { map: patternTex('grass', 0x7c8456) }), grass: mat(0x7f9a52, { map: patternTex('grass', 0x7f9a52) }), leaf: mat(0x587f3d), leafD: mat(0x48693a),
    pave: mat(C.paving, { map: patternTex('paving', C.paving) }), floor: mat(0xb8ad96, { map: patternTex('stone', 0xb8ad96) }),
    cave: mat(0x2c2722), caveRim: mat(0x7d7466), rail: mat(0xc9c1ae), stoneW: mat(0x9c958a, { map: patternTex('stone', 0x9c958a) }),
    bridge: mat(0xb9b1a0, { map: patternTex('stone', 0xb9b1a0) }), bridgeRing: mat(0xcfc7b5),
  };

  // ── terrain ──
  const zsBase = []; for (let z = -550; z <= 550; z += 10) zsBase.push(z);
  const zs = uniq([...zsBase, ZC - NICHE_HALF - 0.6, ZC - NICHE_HALF, ZC + NICHE_HALF, ZC + NICHE_HALF + 0.6, ZC - 5.5, ZC - 5, ZC + 5, ZC + 5.5,
    TEMPLE.z0 - 0.6, TEMPLE.z0, TEMPLE.z1, TEMPLE.z1 + 0.6]);
  const xsW = uniq([-360, -345, -330, -315, -300, -288, -276, -264, -252, -240, -228, -216, -204, -192, -180, -170, -162, -160, -152, -145, -139, -133, -128, -122.5, -121.8, -121, -118, -106]);
  const xsE = uniq([106, 118, 120, 124, 128, 131.5, 132, 136, 141, 146, 151.5, 152, 157, 163, 168, 173.5, 174, 180, 187, 193, 199.5, 200, 206, 212, 217, 221.5, 222, 230, 240, 250, 262, 275, 288, 300, 315, 330, 345, 360]);
  const classify = (west) => (a, b, c, n) => {
    const cx = (a[0] + b[0] + c[0]) / 3, cz = (a[2] + b[2] + c[2]) / 3, maxY = Math.max(a[1], b[1], c[1]), avgY = (a[1] + b[1] + c[1]) / 3;
    if (west && Math.abs(cz - ZC) < NICHE_HALF && cx > NICHE_BACK && cx < -122 && n[1] > 0.95 && maxY > 9) return M.floor;
    if (!west && cz > TEMPLE.z0 && cz < TEMPLE.z1 && cx > 131 && cx < 222 && n[1] > 0.95) return M.floor;
    if (n[1] < 0.42) return hash(Math.round(cx / 7), Math.round(cz / 9)) > 0.35 ? M.rock : M.rockD;
    if (maxY <= 1.05 && Math.abs(cx) < 121) return M.pave;
    if (n[1] < 0.8) return M.scrub;
    if (avgY < 2.2) return M.grass;
    return vnoise(cx, cz, 45) > 0.5 ? M.leaf : M.leafD;
  };
  const gW = buildTerrain(xsW, zs, hWest, classify(true), g);
  const gE = buildTerrain(xsE, zs, hEast, classify(false), g);
  // river embankments (stay just outside the river channel)
  for (const s of [-1, 1]) g.add(box(0.6, 2.6, 1100, M.stoneW, s * 105.45, -1.5, 0));

  // ── west cliff caves ──
  const faceXW = (y, z) => { let lo = -122.5, hi = -121; for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (sampleGrid(gW, m, z) > y) lo = m; else hi = m; } return (lo + hi) / 2; };
  const bigCaves = [[-372, 4, 6], [-352, 6, 8.5], [-337, 6.5, 9], [-322, 6, 8.5], [-305, 5, 7], [-262, 6, 7.5], [-210, 6, 8], [-168, 4.5, 6], [-60, 4, 6], [205, 5, 7], [238, 7, 10], [268, 5, 7], [330, 4, 6]];
  const bigCave = (z, w, h, east) => {
    const y0 = east ? 2.5 : 3.5, sgn = east ? 1 : -1;
    const fx = (y) => east ? 120 + 4 * Math.min(1, (y - 1) / (bankTop(z) - 1)) : faceXW(y, z);
    const x0 = fx(y0 + h * 0.5);
    g.add(box(1.4, h - w / 2, w, M.cave, x0 + sgn * 0.45, y0, z));
    const arch = cyl(w / 2, w / 2, 1.4, M.cave, 0, 0, 0, 10); arch.rotation.z = Math.PI / 2; arch.position.set(x0 + sgn * 0.45, y0 + h - w / 2, z); g.add(arch);
    // carved rim + platform + steps
    g.add(box(1.2, 0.6, w + 1.6, M.caveRim, x0 + sgn * 0.3, y0 - 0.6, z));
    for (const s of [-1, 1]) g.add(box(1.2, h - w / 2, 0.7, M.caveRim, x0 + sgn * 0.3, y0, z + s * (w / 2 + 0.35)));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(w / 2 + 0.35, 0.35, 4, 10, Math.PI), M.caveRim);
    ring.rotation.y = Math.PI / 2; ring.position.set(x0 + sgn * 0.3, y0 + h - w / 2, z); g.add(ring);
    for (let k = 0; k < 5; k++) g.add(box(0.6, (k + 1) * (y0 - 1) / 5, w * 0.6, M.caveRim, x0 + (east ? -1 : 1) * (0.6 + (5 - k) * 0.55), 1, z));
  };
  for (const [z, w, h] of bigCaves) bigCave(z, w, h, false);
  const avoid = (z) => Math.abs(z - ZC) < NICHE_HALF + 5 || bigCaves.some(([bz, w]) => Math.abs(z - bz) < w / 2 + 1.5) || Math.abs(z - BRIDGE_Z) < 30;
  const addCave = (z, y, w, h) => {
    const x0 = Math.max(faceXW(y, z), faceXW(y + h, z));
    g.add(box(1.0, h, w, M.cave, x0 - 0.35, y, z));
    if (w > 1.6) g.add(box(0.8, 0.3, w + 0.6, M.caveRim, x0 - 0.25, y + h, z));   // little eave above bigger niches
  };
  let placed = 0;
  // clusters of niches (宾阳洞—万佛洞—莲花洞 in the north, 药方洞—古阳洞 south of 奉先寺) + scattered ones
  const clusters = [];
  for (let k = 0; k < 26; k++) clusters.push(k < 10 ? -390 + R() * 280 : k < 16 ? 175 + R() * 170 : -420 + R() * 870);
  for (let t = 0; t < 1400 && placed < 380; t++) {
    const inCl = placed < 300;
    const z = inCl ? clusters[t % clusters.length] + (R() + R() - 1) * 18 : -425 + R() * 880;
    if (avoid(z)) continue;
    const top = sampleGrid(gW, -122.5, z); if (top < 12) continue;
    const r = R(), w = 0.8 + r * r * (inCl ? 2.6 : 3.4), h = w * (1.15 + R() * 0.45);
    const yc = inCl ? 4 + ((t % clusters.length) * 0.37 % 1) * (top * 0.45) : 2.5 + R() * top * 0.6;
    const y = inCl ? yc + (R() + R() - 1) * 7 : yc; if (y < 2 || y + h > top * 0.85) continue;
    addCave(z, y, w, h); placed++;
  }
  // shrubs clinging to the cliff face
  const shrub = mat(0x5d7a3e);
  for (let k = 0, t = 0; k < 70 && t < 300; t++) {
    const z = -420 + R() * 880; if (Math.abs(z - ZC) < NICHE_HALF + 2) continue;
    const top = sampleGrid(gW, -122.5, z); if (top < 15) continue;
    const y = 3 + R() * (top - 4); const x0 = faceXW(y, z);
    const sh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), shrub); sh.scale.set(0.9 + R(), 0.7 + R() * 0.6, 1.2 + R() * 1.6); sh.position.set(x0 + 0.2, y, z); g.add(sh); k++;
  }

  // ── 奉先寺 great niche ──
  if (!o.glb) { const buddha = buildVairocana(); buddha.position.set(BUDDHA_X, NICHE_FLOOR, ZC); buddha.rotation.y = Math.PI / 2; g.add(buddha); }
  // attendants (local x across niche → world -z; local z forward → world +x)
  const att = [['disciple', 10.5, 8.5, -3.2, 0], ['bodhisattva', 13, 12.5, -2.0, 0.15], ['king', 10.5, 16.2, 3.5, 0.75], ['guardian', 10, 16.2, 11.5, 1.0]];
  for (const [kind, h, lx, lz, turn] of att) for (const s of [-1, 1]) {
    const a = attendant(kind, h);
    a.position.set(BUDDHA_X + lz, NICHE_FLOOR, ZC - s * lx);
    a.rotation.y = Math.PI / 2 + s * turn;           // side figures turn towards the axis
    g.add(a);
  }
  // relief figures and small niches on the niche walls
  for (const s of [-1, 1]) for (let k = 0; k < 14; k++) {
    const x = -126 - k * 2.4, y = NICHE_FLOOR + 14 + (k % 3) * 3.2, z = ZC + s * (NICHE_HALF - 0.2);
    if (x < NICHE_BACK + 2) break;
    g.add(box(1.4, 1.8, 0.6, M.cave, x, y, z));
  }
  // stairs up to the niche + balustrades
  for (let k = 0; k < 36; k++) g.add(box(0.5, 1 + (k + 1) * 0.25, 10, M.floor, -121.25 - k * 0.5, 0, ZC));
  for (const s of [-1, 1]) {
    const rl = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(18, 9), 1.0, 0.4), M.rail);
    rl.rotation.z = -Math.atan2(9, 18); rl.position.set(-130, 1 + 4.5 + 0.9, ZC + s * 5.2); g.add(rl);
    for (let k = 0; k <= 6; k++) g.add(box(0.5, 1.4, 0.5, M.rail, -121.5 - k * 2.9, 1 + k * 2.9 * 0.5, ZC + s * 5.2));
  }
  // niche-front balustrade along the terrace edge
  for (const s of [-1, 1]) {
    g.add(box(0.4, 1.0, NICHE_HALF - 5.5, M.rail, -122.8, NICHE_FLOOR, ZC + s * (5.5 + (NICHE_HALF - 5.5) / 2)));
    for (let k = 0; k < 6; k++) g.add(box(0.55, 1.3, 0.55, M.rail, -122.8, NICHE_FLOOR, ZC + s * (5.5 + k * (NICHE_HALF - 5.5) / 5)));
  }

  // ── riverside walkways + railings + lamps ──
  for (const s of [-1, 1]) {
    const x = s * 106.4;
    for (let z0 = -550; z0 < 550; z0 += 50) {
      const segs = [[z0, z0 + 50]].flatMap(([a, b]) => (a < 476 && b > 484) ? [[a, 476], [484, b]] : [[a, b]]);
      for (const [a, b] of segs) {
        if (b - a < 1) continue;
        g.add(box(0.25, 0.15, b - a, M.rail, x, 1.85, (a + b) / 2));
        g.add(box(0.2, 0.12, b - a, M.rail, x, 1.35, (a + b) / 2));
        for (let z = a; z < b; z += 8) g.add(box(0.28, 1.0, 0.28, M.rail, x, 1, z + 0.5));
      }
    }
  }
  for (let z = -420; z <= 470; z += 45) if (Math.abs(z - ZC) > 8) g.add(lamp(-119.6, z, 5, 1));
  for (let z = -430; z <= 470; z += 60) { const t = tree(-119.6, z + 22, 8, 'willow', 1); g.add(t); }
  for (let z = -430; z <= 470; z += 65) if (z < TEMPLE.z0 - 8 || z > TEMPLE.z1 + 8) g.add(tree(119, z + 10, 8, 'willow', 1));

  // ── east bank small caves (擂鼓台 / 看经寺 area) ──
  bigCave(140, 4, 6, true); bigCave(250, 5, 7, true);
  for (let k = 0, t = 0; k < 40 && t < 200; t++) {
    const z = -150 + R() * 500; if (Math.abs(z - 140) < 5 || Math.abs(z - 250) < 6) continue;
    const top = 1 + (bankTop(z) - 1) * envE(z); if (top < 6) continue;
    const w = 0.6 + R() * 1.2, h = w * 1.3, y = 2 + R() * (top - 3.5 - h); if (y < 1.8) continue;
    const x0 = 120 + 4 * (y + h / 2 - 1) / (top - 1);
    g.add(box(0.9, h, w, M.cave, x0 + 0.3, y, z)); k++;
  }

  // ── 香山寺 on terraces ──
  const terrM = mat(0x9a948a, { map: patternTex('brick', 0x9a948a) });
  const yW = mat(YELLOW), cap = mat(C.tileGrey);
  for (const t of TERR) g.add(box(t.x1 - t.x0, t.y, TEMPLE.z1 - TEMPLE.z0, terrM, (t.x0 + t.x1) / 2, 0, TEMPLE.zc));
  const stair = (xFrom, yFrom, xTo, yTo, width) => {
    const n = Math.max(2, Math.round((yTo - yFrom) / 0.5)), run = (xTo - xFrom) / n;
    for (let k = 0; k < n; k++) g.add(box(Math.abs(run) + 0.02, yFrom + (k + 1) * (yTo - yFrom) / n, width, M.floor, xFrom + run * (k + 0.5), 0, TEMPLE.zc));
    for (const s of [-1, 1]) for (let k = 0; k < n; k += 2) g.add(box(Math.abs(run) * 2 + 0.02, yFrom + (k + 2) * (yTo - yFrom) / n + 0.6, 0.5, M.rail, xFrom + run * (k + 1), 0, TEMPLE.zc + s * (width / 2 + 0.25)));
  };
  stair(119, 1, 132, 12, 8);
  stair(145.6, 12, 152, 20, 6);
  stair(167.6, 20, 174, 28, 6);
  stair(193.6, 28, 200, 36, 6);
  // yellow enclosing walls (stepped with the terraces)
  for (const t of TERR) for (const z of [TEMPLE.z0 + 0.6, TEMPLE.z1 - 0.6]) {
    g.add(box(t.x1 - t.x0, 3, 0.8, yW, (t.x0 + t.x1) / 2, t.y, z));
    g.add(box(t.x1 - t.x0 + 0.2, 0.35, 1.4, cap, (t.x0 + t.x1) / 2, t.y + 3, z));
  }
  for (const s of [-1, 1]) {                        // front wall of T1 with gate gap
    const zz = TEMPLE.zc + s * 23;
    g.add(box(0.8, 3, 38, yW, 132.6, 12, zz)); g.add(box(1.4, 0.35, 38.2, cap, 132.6, 15, zz));
  }
  const hallY = { wall: YELLOW, column: C.tangRed, roof: C.tileGrey, ry: -Math.PI / 2, z: TEMPLE.zc };
  g.add(hall({ ...hallY, w: 14, d: 7, wallH: 5, roofH: 3.4, eave: 1.6, platformH: 0.6, x: 139.5, y: 12 }));        // 山门
  g.add(hall({ ...hallY, w: 18, d: 9, wallH: 5.5, roofH: 4.2, eave: 1.8, platformH: 0.8, x: 161, y: 20 }));        // 天王殿
  g.add(hall({ ...hallY, w: 22, d: 11, wallH: 6.5, roofH: 5.2, eave: 2.2, platformH: 1.2, tiers: 2, x: 184.5, y: 28 })); // 大雄宝殿
  g.add(hall({ ...hallY, w: 26, d: 8, wallH: 5, roofH: 4, eave: 1.8, platformH: 0.8, tiers: 2, x: 212, y: 36 }));   // 九间厅/藏经楼
  for (const s of [-1, 1]) {                        // 钟楼 / 鼓楼
    const z = TEMPLE.zc + s * 30, x = 163;
    g.add(box(5, 4, 5, mat(C.stone), x, 20, z));
    g.add(box(4, 3.4, 4, mat(C.tangRed), x, 24, z));
    g.add(tangRoof({ w: 6.4, d: 6.4, h: 2.6, ridge: 0, x, y: 27.4, z }));
  }
  for (const [x, z] of [[136, -262], [136, -208], [150, -262], [150, -208], [178, -268], [178, -202], [196, -268], [196, -202]]) g.add(tree(x, z, 9, 'pine', TERR.find(t => x <= t.x1).y));
  g.add(sign('香山寺', 4.2, 1.4, { bg: '#1d3557', fg: '#f1c75b', border: '#c9a227', x: 139.5 - 4.05, y: 12 + 0.6 + 5.6, z: TEMPLE.zc, ry: -Math.PI / 2 }));

  // ── 龙门大桥 (three-arch stone bridge) ──
  const span = (x0, x1, f) => { const L = x1 - x0, Rr = (L * L / 4 + f * f) / (2 * f), cx = (x0 + x1) / 2, cy = f - Rr, pts = []; for (let k = 0; k <= 16; k++) { const x = x0 + L * k / 16; pts.push([x, cy + Math.sqrt(Rr * Rr - (x - cx) ** 2)]); } return { pts, Rr, cx, cy }; };
  const arches = [[-104, -38], [-32, 32], [38, 104]].map(([a, b]) => span(a, b, 8.5));
  const outline = [[-160, 0], [-120, 0], [-120, 7], [-106, 7], [-106, 0], [-104, 0], ...arches[0].pts.slice(1, -1), [-38, 0], [-38, -2], [-32, -2], [-32, 0], ...arches[1].pts.slice(1, -1),
    [32, 0], [32, -2], [38, -2], [38, 0], ...arches[2].pts.slice(1, -1), [104, 0], [106, 0], [106, 7], [120, 7], [120, 0], [160, 0], [160, 1.5], [110, 12], [-110, 12], [-160, 1.5]];
  const bw = 12, bz0 = BRIDGE_Z - bw / 2;
  const bShape = new THREE.Shape(outline.map(p => new THREE.Vector2(p[0], p[1])));
  // open spandrels (敞肩): small arched openings over the haunches and piers
  const intr = (x) => { for (const a of arches) { const L = a.pts; if (x >= L[0][0] && x <= L[L.length - 1][0]) return a.cy + Math.sqrt(Math.max(0, a.Rr * a.Rr - (x - a.cx) ** 2)); } return 0; };
  const holes = [];
  for (const [a0, a1] of [[-104, -38], [-32, 32], [38, 104]]) for (const o of [2.5, 8.5]) { holes.push([a0 + o, a0 + o + 3.6]); holes.push([a1 - o - 3.6, a1 - o]); }
  holes.push([-37, -33], [33, 37]);
  for (const [h0, h1] of holes) {
    const yb = Math.max(intr(h0), intr(h1), 0) + 1.2, r = (h1 - h0) / 2, yt = 10.6 - r;
    if (yt - yb < 1.2) continue;
    const path = new THREE.Path(); path.moveTo(h0, yb); path.lineTo(h0, yt);
    for (let k = 1; k <= 6; k++) { const an = Math.PI - Math.PI * k / 6; path.lineTo(h0 + r + Math.cos(an) * r, yt + Math.sin(an) * r); }
    path.lineTo(h1, yb); path.lineTo(h0, yb); bShape.holes.push(path);
  }
  const bGeo = new THREE.ExtrudeGeometry(bShape, { depth: bw, bevelEnabled: false });
  const bMesh = new THREE.Mesh(bGeo, M.bridge); bMesh.position.z = bz0; g.add(bMesh);
  for (const a of arches) {                         // arch rings (拱圈), slightly proud
    const outer = a.pts.map(([x]) => { const ang = Math.atan2(Math.sqrt(Math.max(0, a.Rr * a.Rr - (x - a.cx) ** 2)), x - a.cx); return [a.cx + Math.cos(ang) * (a.Rr + 1.1), a.cy + Math.sin(ang) * (a.Rr + 1.1)]; }).reverse();
    const ringGeo = new THREE.ExtrudeGeometry(new THREE.Shape([...a.pts, ...outer].map(p => new THREE.Vector2(p[0], Math.max(p[1], 0)))), { depth: bw + 0.5, bevelEnabled: false });
    const rm = new THREE.Mesh(ringGeo, M.bridgeRing); rm.position.z = bz0 - 0.25; g.add(rm);
  }
  for (const [x0, x1] of [[-38, -32], [32, 38]]) {   // pier cutwaters
    const xm = (x0 + x1) / 2;
    g.add(prism([[x0, bz0], [xm, bz0 - 4], [x1, bz0], [x1, bz0 + bw], [xm, bz0 + bw + 4], [x0, bz0 + bw]], 7, M.bridgeRing, -2));
  }
  const top = [[-160, 1.5], [-110, 12], [110, 12], [160, 1.5]];
  for (const zz of [bz0 + 0.25, bz0 + bw - 0.25]) {
    for (let k = 0; k < 3; k++) g.add(segBox(top[k][0], top[k][1], top[k + 1][0], top[k + 1][1], 0.5, 1.15, zz, M.rail));
    for (let x = -100; x <= 100; x += 25) g.add(lamp(x, zz, 6, 12));
  }
  g.add(box(220, 0.6, bw + 0.6, M.bridgeRing, 0, 11.6, BRIDGE_Z));   // deck cornice

  // ── entrance plaza + 龙门 stone pailou at the west end of the bridge ──
  g.add(plaza(124, 56, M.pave, -168, BRIDGE_Z + 2, 1.15, 4));
  {
    const pl = new THREE.Group(), st = mat(0xb9b2a2), stD = mat(0x8f897c);
    const cols = [-14, -5, 5, 14];
    for (const x of cols) {
      pl.add(box(1.2, Math.abs(x) < 6 ? 9.5 : 7.5, 1.2, st, x, 0, 0));
      pl.add(box(2.4, 1.2, 3.2, stD, x, 0, 0));                         // 抱鼓石 base
    }
    pl.add(box(10, 1.2, 0.9, st, 0, 7.6, 0)); pl.add(box(10, 0.6, 0.9, st, 0, 5.4, 0));
    for (const s of [-1, 1]) { pl.add(box(9, 1.0, 0.9, st, s * 9.5, 5.9, 0)); pl.add(box(9, 0.5, 0.9, st, s * 9.5, 4.2, 0)); }
    const roofM = mat(0x6d6a64, { map: patternTex('roofTile', 0x6d6a64) });
    pl.add(tangRoof({ w: 12.5, d: 3.2, h: 1.9, material: roofM, y: 9.4 }));
    for (const s of [-1, 1]) pl.add(tangRoof({ w: 10, d: 2.8, h: 1.5, material: roofM, x: s * 9.5, y: 7.1 }));
    pl.add(sign('龙门', 5, 1.6, { bg: '#3a3833', fg: '#e6d39a', border: '#8f897c', y: 6.95, z: 0.5 }));
    pl.add(sign('龙门', 5, 1.6, { bg: '#3a3833', fg: '#e6d39a', border: '#8f897c', y: 6.95, z: -0.5, ry: Math.PI }));
    pl.position.set(-128, 1.15, -452); pl.rotation.y = Math.PI; g.add(pl);
  }
  g.add(sign('龙门石窟', 7, 1.6, { bg: '#5a5248', fg: '#f3ead2', x: -190, y: 3.4, z: -456.5 }));
  g.add(box(8, 3.2, 1, mat(0x8f897c), -190, 1.15, -457.6));

  // ── 漫水桥 (low bridge) at the south end ──
  g.add(box(214, 0.55, 7, M.bridge, 0, 0.8, 480));
  for (let x = -96; x <= 96; x += 12) g.add(box(1.0, 2.4, 7.6, M.stoneW, x, -1.6, 480));
  for (const zz of [476.8, 483.2]) { g.add(box(214, 0.12, 0.15, M.rail, 0, 2.0, zz)); for (let x = -105; x <= 105; x += 5) g.add(box(0.2, 0.7, 0.2, M.rail, x, 1.35, zz)); }

  // ── trees on the hills ──
  const plant = (gr, n, x0, x1, kinds, skip) => {
    for (let k = 0, t = 0; k < n && t < n * 12; t++) {
      const x = x0 + R() * (x1 - x0), z = -440 + R() * 950;
      if (skip(x, z)) continue;
      const y = sampleGrid(gr, x, z);
      const sl = Math.abs(sampleGrid(gr, x + 4, z) - sampleGrid(gr, x - 4, z)) + Math.abs(sampleGrid(gr, x, z + 4) - sampleGrid(gr, x, z - 4));
      if (y < 4 || sl > 8) continue;
      g.add(tree(x, z, 7 + R() * 6, kinds[Math.floor(R() * kinds.length)], y - 0.4)); k++;
    }
  };
  plant(gW, 62, -345, -132, ['pine', 'pine', 'pine', 'round'], (x, z) => Math.abs(z - ZC) < 30 && x > -175);
  plant(gE, 48, 132, 345, ['pine', 'round', 'round'], (x, z) => z > TEMPLE.z0 - 6 && z < TEMPLE.z1 + 6 && x < 230);

  return finalize(g);
}
