// Procedural people v2 (PBR). Metres, Y up, facing +Z, origin = ground between the feet. l = +X side (the person's left).
// buildPerson(opts) -> Group { body (torso+head+hair+clothes, 1 mesh), arm_l, arm_r (origin = shoulder joint), leg_l, leg_r (origin = hip joint) }
// The engine swings arm_*/leg_* with rotation.x (see animateWalk in src/game/actors.js).
//
// How it is made: every body part is a loft of superellipse rings (smooth normals, hard colour seams = duplicated rings),
// the torso follows smooth side/front profile curves per sex, the head is a deformed ellipsoid with nose and ears, hair
// and hats are shells over the same head surface, and collars / lapels / ties / straps / sashes are ribbons laid on the
// torso surface. Colour and roughness are per vertex, so a whole person uses ONE shared material (5 draw calls); the
// material's map is a small face atlas (eyes, brows, lips; white everywhere else), null under Node.
// Geometry is cached per resolved outfit, so the second buildPerson() of the same preset only creates 5 Mesh objects.
import * as THREE from 'three';
import { canvasTex, HAS_DOM } from '../core/mats.js';
import { preload as preloadGlb, buildGlbPerson } from './people_glb.js';

// ───────────────────────── small math ─────────────────────────
const PI = Math.PI, TAU = PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), lerp = (a, b, t) => a + (b - a) * t;
const smooth01 = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const sgnpow = (v, e) => (v < 0 ? -1 : 1) * Math.pow(Math.abs(v), e);
function mulberry(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
/** monotone cubic through [[x,y],…] (x ascending) */
function mono(pts) {
  const n = pts.length, X = pts.map(p => p[0]), Y = pts.map(p => p[1]);
  const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((Y[i + 1] - Y[i]) / (X[i + 1] - X[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return x => {
    if (x <= X[0]) return Y[0]; if (x >= X[n - 1]) return Y[n - 1];
    let i = 0; while (x > X[i + 1]) i++;
    const h = X[i + 1] - X[i], t = (x - X[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * Y[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * Y[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
};

// ───────────────────────── colours ─────────────────────────
const _paint = new Map();
/** per-vertex "paint": linear colour + roughness */
function paint(hex, rough = 0.85) {
  const k = hex + '|' + rough; let p = _paint.get(k);
  if (!p) { const c = new THREE.Color(hex); _paint.set(k, p = { c: [c.r, c.g, c.b], r: rough }); }
  return p;
}
function mixHex(a, b, t) {
  const ar = a >> 16 & 255, ag = a >> 8 & 255, ab = a & 255, br = b >> 16 & 255, bg = b >> 8 & 255, bb = b & 255;
  return (Math.round(lerp(ar, br, t)) << 16) | (Math.round(lerp(ag, bg, t)) << 8) | Math.round(lerp(ab, bb, t));
}
const shade = (hex, k) => mixHex(hex, 0x000000, k), tint = (hex, k) => mixHex(hex, 0xffffff, k);

// ───────────────────────── geometry builder ─────────────────────────
const UV0 = [0.004, 0.996]; // a white texel of the face atlas
class Part {
  constructor() { this.p = []; this.c = []; this.r = []; this.uv = []; this.i = []; this.n = null; this.ctr = []; }
  v(p, pt, uv = UV0, ctr = p) { this.p.push(p[0], p[1], p[2]); this.c.push(pt.c[0], pt.c[1], pt.c[2]); this.r.push(pt.r); this.uv.push(uv[0], uv[1]); this.ctr.push(ctr[0], ctr[1], ctr[2]); return this.p.length / 3 - 1; }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  mirror() { for (let q = 0; q < this.p.length; q += 3) { this.p[q] = -this.p[q]; this.ctr[q] = -this.ctr[q]; if (this.n) this.n[q] = -this.n[q]; } if (this.n) flipWind(this); return this; }
}
function flipWind(P) { const I = P.i; for (let k = 0; k < I.length; k += 3) { const t = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = t; } }
/** smooth normals; vertices sharing a position share a normal (so colour seams stay smooth) */
function smoothNormals(P) {
  const p = P.p, I = P.i, nv = p.length / 3, key = new Int32Array(nv), map = new Map(), acc = [];
  for (let v = 0; v < nv; v++) {
    const k = Math.round(p[v * 3] * 2e4) + ',' + Math.round(p[v * 3 + 1] * 2e4) + ',' + Math.round(p[v * 3 + 2] * 2e4);
    let id = map.get(k); if (id === undefined) { id = acc.length / 3; map.set(k, id); acc.push(0, 0, 0); } key[v] = id;
  }
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const q of [I[t], I[t + 1], I[t + 2]]) { const s = key[q] * 3; acc[s] += nx; acc[s + 1] += ny; acc[s + 2] += nz; }
  }
  const n = new Array(p.length);
  for (let v = 0; v < nv; v++) { const s = key[v] * 3, l = Math.hypot(acc[s], acc[s + 1], acc[s + 2]) || 1; n[v * 3] = acc[s] / l; n[v * 3 + 1] = acc[s + 1] / l; n[v * 3 + 2] = acc[s + 2] / l; }
  P.n = n; return P;
}
/** make computed normals point away from each vertex's stored centre */
function orientOut(P) {
  let S = 0; for (let q = 0; q < P.p.length; q += 3) S += P.n[q] * (P.p[q] - P.ctr[q]) + P.n[q + 1] * (P.p[q + 1] - P.ctr[q + 1]) + P.n[q + 2] * (P.p[q + 2] - P.ctr[q + 2]);
  if (S < 0) { flipWind(P); for (let q = 0; q < P.n.length; q++) P.n[q] = -P.n[q]; }
  return P;
}
/** make winding agree with explicit normals */
function fixWind(P) {
  const p = P.p, n = P.n, I = P.i; let S = 0;
  for (let k = 0; k < I.length; k += 3) {
    const a = I[k] * 3, b = I[k + 1] * 3, c = I[k + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    S += (uy * vz - uz * vy) * (n[a] + n[b] + n[c]) + (uz * vx - ux * vz) * (n[a + 1] + n[b + 1] + n[c + 1]) + (ux * vy - uy * vx) * (n[a + 2] + n[b + 2] + n[c + 2]);
  }
  if (S < 0) flipWind(P); return P;
}
class Buf {
  constructor() { this.p = []; this.n = []; this.c = []; this.r = []; this.uv = []; this.i = []; }
  add(P) { const o = this.p.length / 3; this.p.push(...P.p); this.n.push(...P.n); this.c.push(...P.c); this.r.push(...P.r); this.uv.push(...P.uv); for (const q of P.i) this.i.push(q + o); }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('rough', new THREE.Float32BufferAttribute(this.r, 1));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.i); g.computeBoundingSphere(); g.computeBoundingBox(); return g;
  }
}

const AX = [1, 0, 0], AZ = [0, 0, 1], AY = [0, 1, 0];
/**
 * Loft of superellipse rings. ring = { c:[x,y,z], rx, f, b (extent toward +front / back), pw (2 = ellipse), col | colFn(a,ca,sa),
 * t (tangent override), ref (side axis, default +X), fref (front axis, default +Z), seam (true = same place as the previous ring, new colour) }
 */
function tube(buf, rings, seg, { cap0 = 0, cap1 = 0, mirror = false } = {}) {
  const P = new Part(), n = rings.length, rows = [], T = [];
  for (let i = 0; i < n; i++) {
    const R = rings[i], c = R.c;
    let t = R.t;
    if (!t) { let j0 = i - 1, j1 = i + 1; while (j0 >= 0 && rings[j0 + 1].seam) j0--; while (j1 < n && rings[j1].seam) j1++; t = v3.norm(v3.sub(rings[Math.min(n - 1, j1)].c, rings[Math.max(0, j0)].c)); }
    T.push(t);
    const ref = R.ref || AX, ax = v3.norm(v3.sub(ref, v3.mul(t, v3.dot(ref, t))));
    let az = v3.cross(t, ax); if (v3.dot(az, R.fref || AZ) < 0) az = v3.mul(az, -1);
    rows.push(P.p.length / 3);
    const e = 2 / (R.pw || 2);
    for (let k = 0; k < seg; k++) {
      const a = TAU * k / seg, ca = Math.cos(a), sa = Math.sin(a);
      const x = R.rx * sgnpow(ca, e), z = (sa > 0 ? R.f : R.b) * sgnpow(sa, e);
      P.v([c[0] + ax[0] * x + az[0] * z, c[1] + ax[1] * x + az[1] * z, c[2] + ax[2] * x + az[2] * z], R.colFn ? R.colFn(a, ca, sa) : R.col, UV0, c);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    if (rings[i + 1].seam) continue;
    const r0 = rows[i], r1 = rows[i + 1];
    for (let k = 0; k < seg; k++) { const k1 = (k + 1) % seg; P.quad(r0 + k, r0 + k1, r1 + k1, r1 + k); }
  }
  const pole = (i, dir, len) => {
    const R = rings[i], c = v3.add(R.c, v3.mul(T[i], dir * len)), pt = R.colFn ? R.colFn(PI / 2, 0, 1) : R.col, v = P.v(c, pt, UV0, R.c);
    for (let k = 0; k < seg; k++) { const k1 = (k + 1) % seg; P.i.push(rows[i] + k, rows[i] + k1, v); }
  };
  if (cap0) pole(0, -1, cap0);
  if (cap1) pole(n - 1, 1, cap1);
  if (mirror) for (let q = 0; q < P.p.length; q += 3) { P.p[q] = -P.p[q]; P.ctr[q] = -P.ctr[q]; }
  smoothNormals(P); orientOut(P); buf.add(P);
}
/** strip through points with explicit normals; widths per point; offset along normal */
function ribbon(buf, pts, nrm, widths, col, off = 0, mirror = false) {
  const P = new Part(), n = pts.length; P.n = [];
  for (let i = 0; i < n; i++) {
    const t = v3.norm(v3.sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)])), N = nrm[i];
    const s = v3.norm(v3.cross(N, t)), w = (Array.isArray(widths) ? widths[i] : widths) / 2, base = v3.add(pts[i], v3.mul(N, off));
    for (const sg of [-1, 1]) { P.v(v3.add(base, v3.mul(s, w * sg)), Array.isArray(col) ? col[i] : col); P.n.push(N[0], N[1], N[2]); }
    if (i) P.quad(i * 2 - 2, i * 2 - 1, i * 2 + 1, i * 2);
  }
  if (mirror) P.mirror();
  fixWind(P); buf.add(P);
}

// ───────────────────────── body proportions ─────────────────────────
// torso keys: [y, half width, front depth, back depth, centre z, superellipse power]
const TORSO = {
  m: [[0.815, 0.10, 0.06, 0.07, 0, 2], [0.855, 0.150, 0.086, 0.100, 0, 2.2], [0.92, 0.166, 0.094, 0.108, 0, 2.4], [0.99, 0.158, 0.094, 0.098, 0, 2.4],
    [1.06, 0.150, 0.097, 0.090, 0, 2.3], [1.15, 0.160, 0.107, 0.092, 0, 2.35], [1.25, 0.170, 0.116, 0.097, 0, 2.4], [1.32, 0.174, 0.108, 0.098, -0.004, 2.4],
    [1.375, 0.170, 0.094, 0.091, -0.008, 2.4], [1.408, 0.160, 0.082, 0.082, -0.012, 2.3], [1.44, 0.112, 0.067, 0.069, -0.014, 2.1], [1.47, 0.07, 0.058, 0.062, -0.014, 2], [1.49, 0.062, 0.054, 0.058, -0.012, 2], [1.575, 0.052, 0.05, 0.052, -0.006, 2]],
  f: [[0.775, 0.10, 0.06, 0.07, 0, 2], [0.81, 0.15, 0.086, 0.10, 0, 2.2], [0.86, 0.170, 0.092, 0.115, 0, 2.4], [0.93, 0.158, 0.088, 0.100, 0, 2.4],
    [1.00, 0.128, 0.084, 0.080, 0, 2.3], [1.08, 0.136, 0.094, 0.083, 0, 2.4], [1.16, 0.148, 0.124, 0.087, 0, 2.3], [1.225, 0.152, 0.105, 0.088, -0.004, 2.3],
    [1.275, 0.152, 0.09, 0.085, -0.008, 2.3], [1.31, 0.142, 0.076, 0.075, -0.012, 2.2], [1.338, 0.098, 0.061, 0.063, -0.012, 2.1], [1.365, 0.058, 0.05, 0.053, -0.012, 2], [1.385, 0.05, 0.047, 0.05, -0.01, 2], [1.47, 0.047, 0.045, 0.047, -0.006, 2]],
};
const BODY = {
  m: { H: 1.75, head: [0, 1.628, 0.0], hr: [0.08, 0.11, 0.1], sh: [0.174, 1.382, -0.01], hip: [0.086, 0.90, 0], waist: 1.0, neck: 1.462, chestY: 1.25, k: 1 },
  f: { H: 1.63, head: [0, 1.527, 0.0], hr: [0.073, 0.103, 0.093], sh: [0.153, 1.288, -0.01], hip: [0.087, 0.85, 0], waist: 0.95, neck: 1.356, chestY: 1.16, k: 0.935 },
};
const _torsoFn = {};
function torsoFn(sex) {
  if (_torsoFn[sex]) return _torsoFn[sex];
  const K = TORSO[sex], col = j => mono(K.map(r => [r[0], r[j]]));
  return (_torsoFn[sex] = { hw: col(1), f: col(2), b: col(3), zc: col(4), pw: col(5), y0: K[0][0], y1: K[K.length - 1][0] });
}

// ───────────────────────── face atlas ─────────────────────────
// 512×256: left half = male face, right half = female face. Head-local projection: u = 0.5 + x/0.2, v = 0.5 + y/0.2 (per half).
const FACE_W = 0.1;
let _mat = null;
function faceAtlas() {
  return canvasTex(512, 256, (g, W, H) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    for (const fem of [0, 1]) {
      const ox = fem * 256, S = 256 / (2 * FACE_W), P = (x, y) => [ox + 128 + x * S, 128 - y * S];
      const ey = fem ? 0.0 : 0.002, ex = fem ? 0.029 : 0.031;
      // soft shading: eye sockets, under-nose, chin
      const rg = (x, y, r, col) => { const [px, py] = P(x, y), gr = g.createRadialGradient(px, py, 0, px, py, r * S); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(px - r * S, py - r * S, r * S * 2, r * S * 2); };
      for (const s of [-1, 1]) rg(s * ex, ey + 0.002, 0.02, 'rgba(150,110,100,0.35)');
      if (fem) for (const s of [-1, 1]) rg(s * 0.042, -0.035, 0.02, 'rgba(235,130,125,0.22)');
      rg(0, -0.05, 0.012, 'rgba(140,100,90,0.25)');
      for (const s of [-1, 1]) {
        // brow
        g.strokeStyle = fem ? 'rgba(60,40,32,0.75)' : 'rgba(45,32,26,0.9)'; g.lineWidth = (fem ? 0.0028 : 0.0042) * S; g.lineCap = 'round';
        g.beginPath(); let [a, b] = P(s * (ex - 0.014), ey + 0.016); g.moveTo(a, b);
        [a, b] = P(s * (ex + 0.002), ey + 0.021 + (fem ? 0.002 : 0)); const [c2, d2] = P(s * (ex + 0.017), ey + 0.015); g.quadraticCurveTo(a, b, c2, d2); g.stroke();
        // eye: almond, light sclera, dark iris, upper lid line
        const [cx, cy] = P(s * ex, ey), w = 0.0115 * S, h = (fem ? 0.0048 : 0.0042) * S;
        g.save(); g.beginPath(); g.moveTo(cx - w, cy); g.quadraticCurveTo(cx, cy - h * 1.9, cx + w, cy); g.quadraticCurveTo(cx, cy + h * 1.5, cx - w, cy); g.closePath();
        g.fillStyle = '#efe6e2'; g.fill(); g.clip(); g.fillStyle = '#2e2019'; g.beginPath(); g.arc(cx + s * 0.0006 * S, cy - h * 0.1, h * 1.25, 0, TAU); g.fill(); g.fillStyle = '#120c0a'; g.beginPath(); g.arc(cx, cy - h * 0.1, h * 0.55, 0, TAU); g.fill(); g.restore();
        g.strokeStyle = '#24170f'; g.lineWidth = (fem ? 0.0019 : 0.0013) * S; g.beginPath(); g.moveTo(cx - w * 1.05, cy + h * 0.1); g.quadraticCurveTo(cx, cy - h * 2.0, cx + w * 1.08, cy - h * 0.1); g.stroke();
      }
      // nostrils
      g.fillStyle = 'rgba(90,55,45,0.55)'; for (const s of [-1, 1]) { const [nx, ny] = P(s * 0.0075, -0.041); g.beginPath(); g.ellipse(nx, ny, 0.003 * S, 0.0017 * S, 0, 0, TAU); g.fill(); }
      // lips
      const [mx, my] = P(0, -0.066), mw = (fem ? 0.0185 : 0.021) * S;
      g.fillStyle = fem ? 'rgba(200,95,95,0.85)' : 'rgba(180,110,100,0.55)';
      g.beginPath(); g.moveTo(mx - mw, my); g.quadraticCurveTo(mx - mw * 0.4, my - 0.006 * S, mx, my - 0.0035 * S); g.quadraticCurveTo(mx + mw * 0.4, my - 0.006 * S, mx + mw, my);
      g.quadraticCurveTo(mx, my + (fem ? 0.0085 : 0.0065) * S, mx - mw, my); g.fill();
      g.strokeStyle = 'rgba(90,45,40,0.7)'; g.lineWidth = 0.0013 * S; g.beginPath(); g.moveTo(mx - mw, my); g.quadraticCurveTo(mx, my + 0.0012 * S, mx + mw, my); g.stroke();
    }
  }, { repeat: false });
}
function material() {
  if (_mat) return _mat;
  const map = HAS_DOM ? faceAtlas() : null;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, map, roughness: 1, metalness: 0, side: THREE.DoubleSide });
  m.onBeforeCompile = sh => {
    sh.vertexShader = 'attribute float rough;\nvarying float vRough;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvRough = rough;');
    sh.fragmentShader = 'varying float vRough;\n' + sh.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = vRough;');
  };
  m.customProgramCacheKey = () => 'person-rough';
  return (_mat = m);
}

// ───────────────────────── outfit resolution ─────────────────────────
const SKINS = [0xe8bf9c, 0xe3b690, 0xd9a77c, 0xf0c8a6, 0xcf9a70, 0xb98056];
const HAIRS = [0x15110e, 0x1b1512, 0x241a14, 0x2e2119, 0x3a2a1c];
const pick = (R, a) => a[Math.floor(R() * a.length) % a.length];

/** opts -> fully resolved outfit spec (deterministic: only depends on opts) */
function resolve(opts) {
  const R = mulberry(hashStr(JSON.stringify(opts)));
  let style = opts.style || 'casual'; if (style === 'suit') style = 'business';
  const sex = opts.sex === 'f' || opts.gender === 'f' ? 'f' : opts.sex === 'm' || opts.gender === 'm' ? 'm' : style === 'hanfu' ? (R() < 0.65 ? 'f' : 'm') : R() < 0.5 ? 'm' : 'f';
  const S = {
    style, sex, skin: opts.skin ?? pick(R, SKINS), hair: opts.hair ?? pick(R, HAIRS), hairStyle: opts.hairStyle, hat: opts.hat ?? null,
    top: opts.top, shirt: opts.shirt, pants: opts.pants, bottom: opts.bottom, under: opts.under, trim: opts.trim, accent: opts.accent,
    shoes: opts.shoes, sole: opts.sole, bag: opts.bag, bagColor: opts.bagColor, hunch: opts.hunch ?? 0, tie: opts.tie, hatColor: opts.hatColor, job: opts.job, sleeve: opts.sleeve, legs: opts.legs,
  };
  const d = (k, v) => { if (S[k] === undefined || S[k] === null) S[k] = v; };
  if (style === 'casual') {
    d('shirt', pick(R, [0x3f7fbf, 0xc0392b, 0xe8e4d8, 0x4f9a5b, 0xe0a030, 0x2a2d33, 0xd8c8b0])); d('top', sex === 'm' ? pick(R, ['tee', 'tee', 'jacket', 'hoodie']) : pick(R, ['tee', 'blouse', 'jacket']));
    d('bottom', sex === 'f' && R() < 0.45 ? 'skirt' : R() < 0.15 ? 'shorts' : 'jeans'); d('pants', S.bottom === 'jeans' ? pick(R, [0x2d3a52, 0x3b4a66, 0x25282e]) : pick(R, [0x3b3f46, 0x6b5a3a, 0x25282e, 0xc9b896]));
    d('hairStyle', sex === 'm' ? 'short' : pick(R, ['long', 'ponytail', 'bob'])); d('shoes', pick(R, [0xf0f0ec, 0x2f2f33, 0xe8e4dc])); d('sole', 0xf2f2ee);
    d('under', 0xeeeeea); d('bag', sex === 'f' ? pick(R, ['hand', 'cross', null]) : pick(R, ['cross', null, null]));
  } else if (style === 'business') {
    d('shirt', 0x23272e); d('pants', S.shirt); d('top', sex === 'f' ? pick(R, ['suit', 'blouse']) : pick(R, ['suit', 'suit', 'shirt'])); d('under', S.top === 'shirt' ? 0xf2f2f0 : 0xf2f2f0);
    if (S.top === 'shirt' && opts.shirt === undefined) S.shirt = 0xeef0f2;
    d('bottom', sex === 'f' ? 'skirt' : 'pants'); d('tie', sex === 'm' ? pick(R, [0x8a2a2a, 0x2a3a6a, 0x5a4a3a]) : null); d('hairStyle', sex === 'm' ? 'short' : pick(R, ['bun', 'bob', 'ponytail']));
    d('shoes', 0x1a1716); d('sole', 0x141210); d('legs', sex === 'f' ? 0x3a3330 : null); d('bag', sex === 'f' ? 'hand' : null); d('bagColor', 0x2a2420);
  } else if (style === 'student') {
    d('shirt', pick(R, [0x2a4f9a, 0x2a6a4a, 0xa02a2a])); d('top', 'track'); d('trim', 0xf2f2ee); d('bottom', 'track'); d('pants', S.shirt);
    d('hairStyle', sex === 'm' ? 'short' : pick(R, ['ponytail', 'bob'])); d('shoes', 0xf0f0ec); d('sole', 0xe8e8e4); d('bag', 'backpack'); d('bagColor', pick(R, [0x2a2d33, 0x3a5a8a, 0x8a3a3a, 0x5a5a62]));
  } else if (style === 'elder') {
    d('shirt', pick(R, [0x3a3a40, 0x4a3f36, 0x2f3a4a, 0x5a2a28])); d('top', 'coat'); d('under', 0xd8d2c4); d('bottom', 'pants'); d('pants', pick(R, [0x2a2a2e, 0x3a3a3c, 0x4a4238]));
    d('hair', 0x9a9a98); d('hairStyle', sex === 'm' ? 'short' : 'bun'); d('hat', sex === 'm' ? 'flat' : null); d('hunch', 1); d('shoes', 0x1e1c1a); d('sole', 0x2a2826);
    d('accent', S.shirt); if (S.hat === 'flat') d('hatColor', shade(S.shirt, 0.3));
  } else if (style === 'worker') {
    const job = opts.job || (R() < 0.5 ? 'delivery' : 'sanitation'); S.job = job;
    if (job === 'delivery') { d('shirt', 0xf2c21a); d('top', 'jacket'); d('under', 0xc99a10); d('trim', 0x2a2a2e); d('bottom', 'pants'); d('pants', 0x25262a); d('hat', 'helmet'); d('hatColor', S.shirt); d('hairStyle', 'short'); }
    else { d('shirt', 0xf07a1a); d('top', 'vest'); d('under', 0xe8742a); d('bottom', 'pants'); d('pants', 0xe8742a); d('hat', 'cap'); d('hatColor', 0xe8742a); d('hairStyle', sex === 'm' ? 'short' : 'ponytail'); }
    d('shoes', 0x2a2826); d('sole', 0x1a1816);
  } else { // hanfu
    S.style = 'hanfu';
    d('shirt', pick(R, [0xd9d4c7, 0x8fb3a8, 0xc9a9b5, 0x9fb4c8])); d('pants', tint(S.shirt, 0.55)); d('trim', sex === 'f' ? 0xf4efe4 : shade(S.shirt, 0.45));
    d('top', sex === 'f' ? 'ru' : 'robe'); d('bottom', sex === 'f' ? 'qixiong' : 'robe'); d('accent', sex === 'f' ? 0xb8463c : 0x3a3a3a);
    d('hairStyle', sex === 'f' ? 'hanbun' : 'topknot'); d('shoes', sex === 'f' ? tint(S.accent, 0.2) : 0x2a2420); d('sole', 0xeeeae0); d('under', 0xf4f0e6);
  }
  d('shoes', 0x2f2f33); d('sole', 0xf0f0ec); d('top', 'tee'); d('bottom', 'pants'); d('hairStyle', 'short'); d('under', 0xeeeeea); d('trim', shade(S.shirt ?? 0x777777, 0.25)); d('bagColor', pick(R, [0x2a2420, 0x6b4a2b, 0xc8b8a0, 0x8a2a2a]));
  if (S.shirt === undefined) S.shirt = 0x3f7fbf; if (S.pants === undefined) S.pants = 0x2d3a52;
  return S;
}

// ───────────────────────── builders ─────────────────────────
function headParts(buf, S, B) {
  const [hx, hy, hz] = B.head, [rx, ry, rz] = B.hr, fem = S.sex === 'f', skin = paint(S.skin, 0.6), uOff = fem ? 0.5 : 0;
  const hunch = S.hunch * 0.06;
  const C = [hx, hy - S.hunch * 0.035, hz + hunch];
  // head surface: unit direction -> point (deformed ellipsoid)
  const surf = (dx, dy, dz, grow = 0) => {
    let x = dx * rx, y = dy * ry, z = dz * rz * (dz < 0 ? 1.06 : 1);
    if (dy < 0) { const t = -dy; x *= 1 - 0.30 * Math.pow(t, 1.6); if (dz < 0) z *= 1 - 0.42 * Math.pow(t, 1.4); else z *= 1 - 0.08 * t * t; }
    if (dz > 0 && dy < -0.55) z += 0.006 * (fem ? 0.6 : 1); // chin
    if (dz > 0.2 && dy > 0.1 && dy < 0.5) z += 0.004; // brow ridge / forehead
    if (grow) { const l = Math.hypot(x, y, z); x += x / l * grow; y += y / l * grow; z += z / l * grow; }
    return [C[0] + x, C[1] + y, C[2] + z];
  };
  // skull: lat-long
  const LON = 14, LAT = 10, P = new Part(), rows = [];
  for (let j = 0; j <= LAT; j++) {
    const th = PI * j / LAT, row = []; rows.push(row);
    const cnt = j === 0 || j === LAT ? 1 : LON;
    for (let k = 0; k < cnt; k++) {
      const ph = TAU * k / LON, dx = Math.sin(th) * Math.sin(ph), dy = Math.cos(th), dz = Math.sin(th) * Math.cos(ph);
      const p = surf(dx, dy, dz), lx = p[0] - C[0], ly = p[1] - C[1];
      const uv = dz > 0.05 ? [uOff + (0.5 + lx / (2 * FACE_W)) * 0.5, 0.5 + ly / (2 * FACE_W)] : [uOff + (lx >= 0 ? 0.49 : 0.01), 0.995];
      row.push(P.v(p, skin, uv, C));
    }
  }
  for (let j = 0; j < LAT; j++) for (let k = 0; k < LON; k++) {
    const a = rows[j], b = rows[j + 1], k1 = (k + 1) % LON;
    if (a.length === 1) P.i.push(a[0], b[k1], b[k]); else if (b.length === 1) P.i.push(a[k], a[k1], b[0]); else P.quad(a[k], a[k1], b[k1], b[k]);
  }
  smoothNormals(P); orientOut(P); buf.add(P);
  // nose
  const nz = surf(0, -0.15, 1)[2], nk = fem ? 0.85 : 1;
  tube(buf, [
    { c: [C[0], C[1] + 0.004, nz - 0.012], rx: 0.006 * nk, f: 0.006, b: 0.006, col: skin },
    { c: [C[0], C[1] - 0.022, nz + 0.002], rx: 0.0085 * nk, f: 0.010 * nk, b: 0.01, col: skin },
    { c: [C[0], C[1] - 0.038, nz + 0.004], rx: 0.0135 * nk, f: 0.010 * nk, b: 0.012, col: skin, pw: 2.4 },
  ], 6, { cap1: 0.007 });
  // ears
  for (const s of [1, -1]) {
    const ex = C[0] + s * (rx * 0.97 + 0.004), ey = C[1] - 0.012, ez = C[2] - 0.008;
    tube(buf, [
      { c: [ex, ey + 0.028, ez - 0.002], rx: 0.006, f: 0.01, b: 0.008, col: skin },
      { c: [ex + s * 0.006, ey + 0.012, ez - 0.004], rx: 0.007, f: 0.016, b: 0.012, col: skin },
      { c: [ex + s * 0.004, ey - 0.012, ez - 0.002], rx: 0.006, f: 0.012, b: 0.010, col: skin },
    ], 6, { cap0: 0.006, cap1: 0.008 });
  }
  hairParts(buf, S, B, C, surf);
}

/** shell over the head surface: hairline theta (from the top) as a function of |phi| (0 = front) */
function shell(buf, surf, thMax, thick, pt, LON = 14, ROWS = 6, lip = true, squash = null) {
  const P = new Part(), rows = [], C = surf(0, 0, 0);
  const top = surf(0, 1, 0, thick(0, 0)); rows.push([P.v(squash ? squash(top) : top, pt, UV0, C)]);
  for (let j = 1; j <= ROWS + (lip ? 1 : 0); j++) {
    const row = []; rows.push(row);
    for (let k = 0; k < LON; k++) {
      const ph = TAU * k / LON - PI, tm = thMax(Math.abs(ph)), th = tm * Math.min(j, ROWS) / ROWS;
      const dx = Math.sin(th) * Math.sin(ph), dy = Math.cos(th), dz = Math.sin(th) * Math.cos(ph);
      let p = surf(dx, dy, dz, j > ROWS ? 0.002 : thick(th, ph)); if (squash) p = squash(p);
      row.push(P.v(p, pt, UV0, C));
    }
  }
  for (let j = 0; j < rows.length - 1; j++) for (let k = 0; k < LON; k++) {
    const a = rows[j], b = rows[j + 1], k1 = (k + 1) % LON;
    if (a.length === 1) P.i.push(a[0], b[k1], b[k]); else P.quad(a[k], a[k1], b[k1], b[k]);
  }
  smoothNormals(P); orientOut(P); buf.add(P);
}
const curveAbs = keys => { const f = mono(keys); return a => f(a); };

function hairParts(buf, S, B, C, surf) {
  const hair = paint(S.hair, 0.55), hs = S.hairStyle, fem = S.sex === 'f', [rx, ry, rz] = B.hr;
  const hatOn = S.hat === 'cap' || S.hat === 'helmet' || S.hat === 'flat';
  // hairline: theta(|phi|)
  const line = hs === 'short' || hs === 'topknot' ? curveAbs([[0, 0.98], [0.6, 1.05], [1.15, 1.32], [1.5, 1.42], [1.95, 1.9], [2.5, 2.2], [PI, 2.28]])
    : curveAbs([[0, 0.92], [0.6, 1.05], [1.15, 1.42], [1.5, 1.55], [1.95, 1.95], [2.5, 2.25], [PI, 2.35]]);
  const vol = hatOn ? 0.004 : hs === 'short' ? 0.012 : 0.010;
  shell(buf, surf, line, (th, ph) => vol + (hatOn ? 0 : hs === 'short' ? 0.012 : 0.006) * Math.max(0, Math.cos(th)) + 0.003 * Math.max(0, -Math.cos(ph)), hair);
  const backZ = C[2] - rz * 1.06;
  if (hs === 'long' || hs === 'bob' || hs === 'hanbun') {
    // curtain hanging behind / beside the head
    const len = hs === 'bob' ? 0.11 : hs === 'hanbun' ? 0.36 : 0.30, P = new Part(), rows = [], N = 6;
    const keys = hs === 'bob'
      ? [[0, rx + 0.016, rz + 0.016, 0, 2.2], [0.06, rx + 0.016, rz + 0.01, -0.004, 2.1], [0.11, rx + 0.022, rz - 0.005, -0.012, 2.0]]
      : [[0, rx + 0.014, rz + 0.016, 0, 2.15], [0.08, rx + 0.012, rz + 0.008, -0.01, 1.9], [0.15, rx + 0.004, 0.085, -0.03, 1.4], [0.22, rx + 0.02, 0.07, -0.05, 1.1], [len, rx + 0.024, 0.06, -0.072, 0.9]];
    for (let j = 0; j < keys.length; j++) {
      const [dy, wx, wz, zc, span] = keys[j], row = []; rows.push(row);
      for (let k = 0; k <= N * 2; k++) {
        const a = PI + span * (k / N - 1), x = Math.sin(a) * wx, z = Math.cos(a) * wz;
        row.push(P.v([C[0] + x, C[1] - dy, C[2] + zc + z], hair, UV0, [C[0], C[1] - dy, C[2] + zc]));
      }
    }
    for (let j = 0; j < rows.length - 1; j++) for (let k = 0; k < N * 2; k++) P.quad(rows[j][k], rows[j][k + 1], rows[j + 1][k + 1], rows[j + 1][k]);
    smoothNormals(P); orientOut(P); buf.add(P);
  }
  if (hs === 'ponytail') {
    const y0 = C[1] + 0.02, z0 = backZ - 0.004;
    tube(buf, [
      { c: [C[0], y0 + 0.012, z0 + 0.012], rx: 0.02, f: 0.02, b: 0.02, col: hair },
      { c: [C[0], y0, z0 - 0.012], rx: 0.016, f: 0.016, b: 0.016, col: paint(shade(S.hair, 0.4), 0.6) },
      { c: [C[0], y0 - 0.04, z0 - 0.04], rx: 0.026, f: 0.024, b: 0.026, col: hair },
      { c: [C[0], y0 - 0.12, z0 - 0.05], rx: 0.022, f: 0.02, b: 0.022, col: hair },
      { c: [C[0], y0 - 0.20, z0 - 0.035], rx: 0.01, f: 0.01, b: 0.01, col: hair },
    ], 7, { cap0: 0.01, cap1: 0.012 });
  }
  const bun = (c, r, pt, seg = 8) => tube(buf, [
    { c: [c[0], c[1] + r * 0.55, c[2]], rx: r * 0.75, f: r * 0.75, b: r * 0.75, col: pt, t: AY, fref: AZ },
    { c: [c[0], c[1], c[2]], rx: r, f: r, b: r, col: pt, t: AY, fref: AZ },
    { c: [c[0], c[1] - r * 0.55, c[2]], rx: r * 0.75, f: r * 0.75, b: r * 0.75, col: pt, t: AY, fref: AZ },
  ], seg, { cap0: r * 0.35, cap1: r * 0.35 });
  if (hs === 'bun') bun([C[0], C[1] + 0.03, backZ - 0.018], 0.035, hair);
  if (hs === 'topknot') {
    const top = [C[0], C[1] + ry + 0.02, C[2] - 0.01];
    bun(top, 0.026, hair, 7);
    const gold = paint(S.accent === 0x3a3a3a ? 0x2a2622 : 0xc9a24a, 0.45);
    tube(buf, [{ c: [top[0], top[1] - 0.012, top[2]], rx: 0.024, f: 0.03, b: 0.03, col: gold, t: AY, pw: 2.5 }, { c: [top[0], top[1] + 0.022, top[2]], rx: 0.02, f: 0.028, b: 0.028, col: gold, t: AY, pw: 2.5 }], 8, { cap1: 0.006 });
    tube(buf, [{ c: [top[0] - 0.06, top[1] + 0.008, top[2]], rx: 0.003, f: 0.003, b: 0.003, col: paint(0xe8e0c8, 0.4), t: AX, ref: AZ, fref: AY }, { c: [top[0] + 0.06, top[1] + 0.008, top[2]], rx: 0.003, f: 0.003, b: 0.003, col: paint(0xe8e0c8, 0.4), t: AX, ref: AZ, fref: AY }], 4);
  }
  if (hs === 'hanbun') {
    // high bun (two lobes) + hairpin + flower ornament
    bun([C[0], C[1] + ry + 0.018, C[2] - 0.035], 0.04, hair);
    bun([C[0] + 0.035, C[1] + ry - 0.005, C[2] - 0.055], 0.028, hair, 7);
    const acc = paint(S.accent, 0.5), gold = paint(0xd8b25a, 0.35);
    tube(buf, [{ c: [C[0] - 0.07, C[1] + ry + 0.03, C[2] - 0.03], rx: 0.0035, f: 0.0035, b: 0.0035, col: gold }, { c: [C[0] + 0.05, C[1] + ry + 0.01, C[2] - 0.04], rx: 0.003, f: 0.003, b: 0.003, col: gold }], 4, { cap1: 0.004 });
    bun([C[0] - 0.045, C[1] + ry + 0.005, C[2] - 0.005], 0.014, acc, 6);
    bun([C[0] - 0.035, C[1] + ry + 0.018, C[2] - 0.02], 0.011, paint(tint(S.accent, 0.5), 0.5), 6);
  }
  if (hatOn) {
    const hc = paint(S.hatColor ?? 0x2a2d33, S.hat === 'helmet' ? 0.35 : 0.8), k = S.hat;
    const hl = k === 'helmet' ? curveAbs([[0, 1.05], [1.2, 1.35], [1.6, 1.6], [PI, 1.85]]) : k === 'flat' ? curveAbs([[0, 1.18], [1.5, 1.38], [PI, 1.55]]) : curveAbs([[0, 1.2], [1.5, 1.42], [PI, 1.58]]);
    const th = k === 'helmet' ? 0.032 : 0.022;
    const squash = k === 'flat' ? p => [p[0] * 1.04, Math.min(p[1], C[1] + ry + 0.012) + Math.max(0, p[1] - C[1] - ry - 0.012) * 0.15, p[2] + 0.004] : null;
    shell(buf, surf, hl, th2 => th + (k === 'helmet' ? 0.012 * Math.max(0, Math.cos(th2)) : 0), hc, 12, 5, true, squash);
    // brim / visor: a fan in front of the forehead
    const P = new Part(), N = 6, brimLen = k === 'helmet' ? 0.035 : k === 'flat' ? 0.05 : 0.07, span = k === 'helmet' ? 1.0 : 0.85;
    const base = [];
    for (let i = 0; i <= N; i++) {
      const ph = span * (i / N * 2 - 1), t = hl(Math.abs(ph)), dx = Math.sin(t) * Math.sin(ph), dy = Math.cos(t), dz = Math.sin(t) * Math.cos(ph);
      const p0 = surf(dx, dy, dz, th * 0.9), out = v3.norm([Math.sin(ph), 0, Math.cos(ph)]);
      const fall = Math.cos(ph * 1.2) * brimLen;
      base.push([P.v(p0, hc, UV0, C), P.v([p0[0] + out[0] * fall, p0[1] - fall * 0.22, p0[2] + out[2] * fall], hc, UV0, C)]);
    }
    for (let i = 0; i < N; i++) P.quad(base[i][0], base[i + 1][0], base[i + 1][1], base[i][1]);
    smoothNormals(P); orientOut(P); buf.add(P);
    if (k === 'helmet') { // chin-strap
      for (const s of [1, -1]) ribbon(buf, [surf(s * 0.98, -0.1, 0.1, 0.003), surf(s * 0.9, -0.6, 0.2, 0.003), surf(s * 0.3, -0.98, 0.3, 0.004)], [[s, 0, 0], [s, -0.3, 0.2], [0, -1, 0.3]].map(v3.norm), 0.012, paint(0x1a1a1a, 0.7));
    }
  }
}

/** torso surface point at height y, angle a (0 = +X side, π/2 = front), inflated by off */
function torsoGeom(S, B) {
  const T = torsoFn(S.sex), hunch = S.hunch;
  const zc = y => T.zc(y) + hunch * 0.075 * Math.pow(smooth01((y - 0.95) / 0.55), 1.6);
  const G = { T, zc, base: () => 0 };
  const pt = (y, a, off = 0) => {
    off += G.base(y);
    const ca = Math.cos(a), sa = Math.sin(a), e = 2 / T.pw(y);
    return [(T.hw(y) + off) * sgnpow(ca, e), y, zc(y) + (sa > 0 ? T.f(y) + off : T.b(y) + off) * sgnpow(sa, e)];
  };
  const nrm = (y, a, off = 0) => {
    const e = 1e-3, dy = v3.sub(pt(y + e, a, off), pt(y - e, a, off)), da = v3.sub(pt(y, a + e, off), pt(y, a - e, off));
    let n = v3.norm(v3.cross(da, dy)); const p = pt(y, a, off); if (v3.dot(n, [p[0], 0, p[2] - zc(y)]) < 0) n = v3.mul(n, -1); return n;
  };
  G.pt = pt; G.nrm = nrm; return G;
}

function bodyParts(buf, S, B) {
  const G = torsoGeom(S, B), { T, zc } = G, fem = S.sex === 'f', top = S.top, bot = S.bottom;
  const skin = paint(S.skin, 0.6), shirt = paint(S.shirt, top === 'suit' || top === 'coat' ? 0.75 : 0.85), pants = paint(S.pants, bot === 'jeans' ? 0.9 : 0.8);
  const under = paint(S.under, 0.85), trim = paint(S.trim, 0.85), FRONT = PI / 2;
  const longBottom = bot === 'robe' || bot === 'qixiong';
  const waist = B.waist, neckY = B.neck, tucked = top === 'shirt' || top === 'suit', hemY = tucked ? waist : waist - (fem ? 0.06 : 0.075);
  const openV = top === 'suit' ? y => clamp((y - (fem ? 1.04 : 1.12)) * 2.4, 0, 0.75) : top === 'jacket' ? () => 0.2
    : top === 'coat' ? y => clamp((y - (fem ? 1.18 : 1.27)) * 2.6, 0, 0.5) : top === 'robe' || top === 'ru' ? y => clamp((y - (fem ? 1.22 : 1.31)) * 3.2, 0, 0.6) : null;
  const vest = top === 'vest';
  const colAt = (y, a) => {
    if (y > neckY) return skin;
    const df = Math.abs(((a - FRONT + PI) % TAU + TAU) % TAU - PI);
    if (!longBottom && y < (bot === 'skirt' ? waist + 0.004 : hemY)) return bot === 'skirt' ? paint(S.pants, 0.8) : pants;
    if (bot === 'qixiong' && y < B.chestY + 0.02) return pants;
    return shirt;
  };
  // torso rings: profile keys + colour seams
  const ys = new Set(TORSORINGS[S.sex]);
  const seams = [];
  if (!longBottom) seams.push(bot === 'skirt' ? waist + 0.004 : hemY); if (bot === 'qixiong') seams.push(B.chestY + 0.02); seams.push(neckY);
  for (const y of seams) ys.delete(+y.toFixed(3));
  const list = [...ys, ...seams].sort((a, b) => a - b), rings = [];
  const ring = (y, cy, off, seam) => rings.push({ c: [0, y, zc(y)], rx: T.hw(y) + off, f: T.f(y) + off, b: T.b(y) + off, pw: T.pw(y), t: AY, colFn: a => colAt(cy, a), seam });
  const offAt = y => (y < neckY ? (top === 'coat' || top === 'suit' || top === 'jacket' || top === 'hoodie' ? 0.012 : top === 'robe' || top === 'ru' ? 0.012 : 0.005) * smooth01((neckY - y) / 0.06) : 0);
  G.base = offAt;
  for (const y of list) {
    if (seams.includes(y)) { const lo = y === neckY ? 0.004 : 0, hi = y === neckY ? 0 : 0.007; ring(y, y - 1e-3, offAt(y) + lo, false); ring(y, y + 1e-3, offAt(y + 0.002) + hi, true); }
    else ring(y, y, offAt(y), false);
  }
  tube(buf, rings, 14, { cap0: 0.02, cap1: 0 });

  // ── collars / lapels / ties (ribbons on the torso surface) ──
  if (openV) { // inner garment showing at the open front: a patch that follows the torso surface
    const yb = top === 'jacket' ? hemY + 0.04 : top === 'suit' ? (fem ? 1.04 : 1.12) : top === 'coat' ? (fem ? 1.18 : 1.27) : (fem ? 1.22 : 1.31);
    surfPatch(buf, G, yb, neckY + 0.004, y => Math.max(0.03, openV(y)), 0.003, under);
  }
  const rib = (pts, w, col, off) => { [pts, w] = smoothPath(pts, w); ribbon(buf, pts.map(([y, a]) => G.pt(y, a, off)), pts.map(([y, a]) => G.nrm(y, a, off)), w, col, 0); };
  const loop = (y, n = 16) => Array.from({ length: n + 1 }, (_, i) => [y, TAU * i / n]);
  if (top === 'tee' || top === 'track' || top === 'blouse' || top === 'vest') rib(loop(neckY - 0.002), 0.014, paint(top === 'track' ? S.trim : shade(S.shirt, 0.12)), 0.006);
  if (top === 'shirt' || top === 'suit' || top === 'coat') {
    const cc = top === 'coat' ? shirt : paint(S.under === undefined ? 0xf2f2f0 : top === 'blouse' ? S.shirt : S.under, 0.8);
    if (top !== 'blouse') rib(loop(neckY + 0.012), 0.03, cc, 0.008);
    for (const s of [1, -1]) rib([[neckY + 0.02, FRONT - s * 0.5], [neckY - 0.005, FRONT - s * 0.35], [neckY - 0.035, FRONT - s * 0.22]], [0.02, 0.03, 0.012], cc, 0.012);
  }
  if (S.tie && (top === 'shirt' || top === 'suit')) {
    const tc = paint(S.tie, 0.5);
    rib([[neckY + 0.0, FRONT], [neckY - 0.02, FRONT], [neckY - 0.03, FRONT], [1.2, FRONT], [waist + 0.04, FRONT]], [0.028, 0.032, 0.02, 0.05, 0.07], tc, 0.011);
  }
  if (top === 'suit' || top === 'coat') {
    const lc = paint(shade(S.shirt, 0.18), 0.7), yb = top === 'suit' ? (fem ? 1.04 : 1.12) : (fem ? 1.18 : 1.27);
    for (const s of [1, -1]) rib([[neckY - 0.005, FRONT - s * 0.62], [(neckY + yb) / 2 + 0.03, FRONT - s * 0.42], [yb + 0.04, FRONT - s * 0.12], [yb, FRONT - s * 0.02]], [0.03, 0.05, 0.04, 0.015], lc, 0.012);
  }
  if (top === 'jacket' || top === 'hoodie') {
    // zipper / opening edges
    const zc2 = paint(top === 'jacket' ? S.trim : shade(S.shirt, 0.2), 0.6);
    if (top === 'jacket') for (const s of [1, -1]) rib([[neckY - 0.01, FRONT - s * 0.32], [1.2, FRONT - s * 0.24], [waist, FRONT - s * 0.22], [hemY + 0.04, FRONT - s * 0.21]], 0.014, zc2, 0.006);
    else {
      rib([[neckY - 0.03, FRONT], [waist - 0.05, FRONT]], 0.008, zc2, 0.004);
      // hood bundle behind the neck + drawstrings
      tube(buf, [{ c: [-0.13 * B.k, neckY - 0.005, zc(neckY) - 0.06], rx: 0.03, f: 0.05, b: 0.04, col: shirt, t: AX, ref: AZ, fref: AY },
        { c: [0, neckY + 0.01, zc(neckY) - 0.1], rx: 0.05, f: 0.06, b: 0.04, col: shirt, t: AX, ref: AZ, fref: AY },
        { c: [0.13 * B.k, neckY - 0.005, zc(neckY) - 0.06], rx: 0.03, f: 0.05, b: 0.04, col: shirt, t: AX, ref: AZ, fref: AY }], 8, { cap0: 0.02, cap1: 0.02 });
      for (const s of [1, -1]) rib([[neckY - 0.01, FRONT - s * 0.18], [neckY - 0.14, FRONT - s * 0.16]], 0.007, paint(0xf0f0ec, 0.7), 0.006);
    }
  }
  if (top === 'hoodie' || top === 'jacket') {
    // waistband
    tubeBand(buf, G, hemY + 0.002, hemY + 0.04, 0.006, paint(shade(S.shirt, 0.1), 0.85));
  }
  if (top === 'robe' || top === 'ru') {
    // cross collar (右衽): outer lapel from the left neck down to the right side, inner lapel to the crossing point
    const cw = fem ? 0.04 : 0.05, yc = fem ? 1.20 : 1.29;
    rib(Array.from({ length: 11 }, (_, i) => [neckY + 0.004, FRONT - 0.55 - (TAU - 1.1) * i / 10]), cw, trim, 0.012);
    rib([[neckY + 0.004, FRONT - 0.55], [neckY - 0.05, FRONT - 0.2], [yc + 0.02, FRONT + 0.25], [yc - 0.06, FRONT + 0.8], [yc - 0.1, FRONT + 1.05]], cw, trim, 0.008);
    rib([[neckY + 0.004, FRONT + 0.55], [neckY - 0.05, FRONT + 0.25], [yc + 0.03, FRONT]], cw, trim, 0.006);
  }
  if (vest) {
    // high-vis vest: two reflective bands round the body + shoulder straps
    const silver = paint(0xd8dcdc, 0.3), vc = paint(S.shirt, 0.7);
    tubeBand(buf, G, hemY, (fem ? 1.30 : 1.39), 0.012, vc);
    for (const y of fem ? [0.98, 1.07] : [1.03, 1.12]) tubeBand(buf, G, y, y + 0.03, 0.016, silver);
    for (const s of [1, -1]) rib([[waist, FRONT - s * 0.35], [1.2, FRONT - s * 0.45], [neckY - 0.03, FRONT - s * 0.9], [neckY - 0.03, -FRONT + s * 0.9], [1.2, -FRONT + s * 0.45], [waist, -FRONT + s * 0.35]], 0.03, silver, 0.018);
  }
  if (top === 'track') {
    for (const s of [1, -1]) rib([[neckY - 0.01, s > 0 ? 0.12 : PI - 0.12], [waist - 0.02, s > 0 ? 0.02 : PI - 0.02]], 0.025, trim, 0.004);
    rib([[neckY - 0.03, FRONT], [waist - 0.04, FRONT]], 0.008, paint(shade(S.shirt, 0.3), 0.6), 0.005);
  }
  // belt
  if ((bot === 'pants' || bot === 'jeans') && top === 'shirt') tubeBand(buf, G, waist - 0.035, waist - 0.005, 0.009, paint(0x1c1a18, 0.5));

  // ── skirts and hems (static on the body) ──
  const hip = B.hip[1];
  if (top === 'suit') skirt(buf, G, waist - 0.02, fem ? hip - 0.0 : hip - 0.08, 0.016, 0.03, shirt, S, false, null, 3);
  if (top === 'coat') skirt(buf, G, waist, fem ? 0.6 : 0.64, 0.018, 0.03, shirt, S, true);
  if (top === 'jacket' && S.style === 'worker') { /* short jacket, no skirt */ }
  if (bot === 'skirt') skirt(buf, G, waist - 0.002, fem ? (S.style === 'business' ? 0.48 : 0.5) : 0.5, 0.013, S.style === 'business' ? 0.03 : 0.07, paint(S.pants, 0.8), S);
  if (bot === 'robe') {
    skirt(buf, G, waist + 0.05, 0.07, 0.014, 0.17, shirt, S, false, trim);
    // sash with hanging ends
    const sc = paint(S.accent, 0.6);
    tubeBand(buf, G, waist - 0.005, waist + 0.045, 0.03, sc);
    for (const s of [1, -1]) rib([[waist, FRONT - s * 0.18], [waist - 0.2, FRONT - s * 0.2], [waist - 0.42, FRONT - s * 0.24]], 0.03, sc, 0.05);
  }
  if (bot === 'qixiong') {
    const y0 = B.chestY + 0.02;
    skirt(buf, G, y0, 0.03, 0.016, 0.18, pants, S, false, pants);
    const sc = paint(S.accent, 0.6);
    tubeBand(buf, G, y0 - 0.012, y0 + 0.024, 0.026, sc);
    // front ties hanging from the bow
    rib([[y0, FRONT - 0.08], [y0 - 0.25, FRONT - 0.05], [y0 - 0.5, FRONT - 0.07]], 0.022, sc, 0.035);
    rib([[y0, FRONT + 0.06], [y0 - 0.22, FRONT + 0.08], [y0 - 0.44, FRONT + 0.12]], 0.022, sc, 0.035);
    // 披帛: a long scarf draped across the back between the elbows
    const pb = paint(S.trim2 ?? tint(S.accent, 0.55), 0.7), pts = [], nr = [];
    for (let i = 0; i <= 10; i++) {
      const a = PI * i / 10, x = Math.cos(a) * 0.23, z = -0.03 - Math.sin(a) * 0.16, y = 1.0 - Math.sin(a) * 0.1;
      pts.push([x, y, z]); nr.push(v3.norm([Math.cos(a), 0.15, -Math.sin(a)]));
    }
    ribbon(buf, pts, nr, 0.12, pb);
  }
  bagParts(buf, S, B, G);
}
/** Catmull-Rom resample of a short control polyline (and its per-point widths) */
function smoothPath(pts, w) {
  const n = pts.length; if (n < 3 || n > 8) return [pts, w];
  const out = [], ow = [], per = 3, W = i => (Array.isArray(w) ? w[clamp(i, 0, n - 1)] : w);
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < per; k++) {
    const t = k / per, p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    const cr = j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t * t * t);
    out.push([cr(0), cr(1)]); ow.push(lerp(W(i), W(i + 1), t));
  }
  out.push(pts[n - 1]); ow.push(W(n - 1));
  return [out, Array.isArray(w) ? ow : w];
}
/** grid patch on the torso surface between y0..y1, angles FRONT ± half(y) */
function surfPatch(buf, G, y0, y1, half, off, col, nu = 4, nv = 6) {
  const P = new Part(); P.n = [];
  for (let j = 0; j <= nv; j++) {
    const y = lerp(y0, y1, j / nv), h = half(y);
    for (let i = 0; i <= nu; i++) { const a = PI / 2 + h * (i / nu * 2 - 1); P.v(G.pt(y, a, off), col); P.n.push(...G.nrm(y, a, off)); }
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + nu + 1; P.quad(a, a + 1, b + 1, b); }
  fixWind(P); buf.add(P);
}
const TORSORINGS = { m: [0.815, 0.855, 0.92, 0.99, 1.06, 1.15, 1.25, 1.32, 1.375, 1.408, 1.44, 1.49, 1.575], f: [0.775, 0.81, 0.86, 0.93, 1.00, 1.08, 1.16, 1.225, 1.275, 1.31, 1.338, 1.385, 1.47] };

/** a band that follows the torso between y0 and y1, inflated by off */
function tubeBand(buf, G, y0, y1, off0, col) {
  const n = Math.max(2, Math.ceil((y1 - y0) / 0.06) + 1), rings = [];
  for (let i = 0; i < n; i++) { const y = lerp(y0, y1, i / (n - 1)), off = off0 + G.base(y); rings.push({ c: [0, y, G.zc(y)], rx: G.T.hw(y) + off, f: G.T.f(y) + off, b: G.T.b(y) + off, pw: G.T.pw(y), t: AY, col }); }
  tube(buf, rings, 14);
}
/** skirt / hem from yTop down to yHem: starts on the torso, flares by `flare` at the hem; optional contrasting hem band */
function skirt(buf, G, yTop, yHem, off, flare, col, S, openFront = false, hemCol = null, n = 6) {
  const yT = G.T, fem = S.sex === 'f', ref = Math.max(yHem, yT.y0 + 0.06), H = yTop - yHem;
  const at = (y, c, seam) => {
    const t = clamp((yTop - y) / H, 0, 1), yy = Math.max(y, ref), fl = flare * Math.pow(t, 1.3), k = smooth01(t * 3);
    const hw = Math.max(yT.hw(yy), fem ? 0.165 : 0.16), f = Math.max(yT.f(yy), 0.09), b = Math.max(yT.b(yy), 0.1);
    return { c: [0, y, G.zc(yy) - fl * 0.08], rx: lerp(yT.hw(yy), hw, k) + off + fl, f: lerp(yT.f(yy), f, k) + off + fl * 0.9, b: lerp(yT.b(yy), b, k) + off + fl * 1.05, pw: lerp(yT.pw(yy), 2.1, t), t: AY, col: c, seam };
  };
  const rings = [];
  for (let i = 0; i < n; i++) rings.push(at(lerp(yTop, yHem, i / n), col));
  if (hemCol) { const yb = yHem + Math.min(0.05, H * 0.1); rings.push(at(yb, col), at(yb, hemCol, true)); rings.push(at(yHem, hemCol)); }
  else rings.push(at(yHem, col));
  tube(buf, rings, 12);
}

function bagParts(buf, S, B, G) {
  const bag = S.bag; if (!bag) return;
  const bc = paint(S.bagColor, 0.6), strap = paint(shade(S.bagColor, 0.2), 0.6), FRONT = PI / 2, neckY = B.neck;
  const rib = (pts, w, col, off) => { [pts, w] = smoothPath(pts, w); ribbon(buf, pts.map(([y, a]) => G.pt(y, a, off)), pts.map(([y, a]) => G.nrm(y, a, off)), w, col, 0); };
  if (bag === 'backpack') {
    const y0 = B.chestY + 0.11, y1 = B.waist - 0.02, z = G.zc(B.chestY) - G.T.b(B.chestY) - 0.07;
    tube(buf, [
      { c: [0, y0 + 0.02, z + 0.03], rx: 0.1, f: 0.03, b: 0.03, col: bc, t: AY, pw: 3 },
      { c: [0, y0, z], rx: 0.14, f: 0.07, b: 0.06, col: bc, t: AY, pw: 3.5 },
      { c: [0, y1 + 0.06, z - 0.01], rx: 0.15, f: 0.07, b: 0.075, col: bc, t: AY, pw: 3.5 },
      { c: [0, y1, z], rx: 0.13, f: 0.065, b: 0.05, col: bc, t: AY, pw: 3 },
    ], 12, { cap0: 0.012, cap1: 0.01 });
    tube(buf, [{ c: [0, y1 + 0.17, z - 0.075], rx: 0.11, f: 0.02, b: 0.02, col: strap, t: AY, pw: 3 }, { c: [0, y1 + 0.03, z - 0.08], rx: 0.11, f: 0.02, b: 0.02, col: strap, t: AY, pw: 3 }], 8, { cap0: 0.01, cap1: 0.01 });
    for (const s of [1, -1]) rib([[B.waist + 0.02, FRONT - s * 0.75], [B.chestY, FRONT - s * 0.62], [neckY - 0.045, FRONT - s * 0.75], [neckY - 0.045, -FRONT + s * 0.95], [B.chestY + 0.08, -FRONT + s * 0.5]], 0.04, strap, 0.006);
  } else if (bag === 'cross') {
    // strap from the left shoulder across the chest to a small bag on the right hip
    rib([[neckY - 0.03, -FRONT + 0.9], [neckY - 0.025, 0.55], [B.chestY + 0.03, FRONT - 0.15], [B.chestY - 0.12, FRONT + 0.6], [B.waist - 0.02, FRONT + 1.1]], 0.025, strap, 0.006);
    const p = G.pt(B.waist - 0.06, FRONT + 1.15, 0.05);
    tube(buf, [{ c: [p[0], p[1] + 0.07, p[2]], rx: 0.08, f: 0.02, b: 0.02, col: bc, t: AY, pw: 4, ref: [0.8, 0, 0.6], fref: [-0.6, 0, 0.8] },
      { c: [p[0], p[1] - 0.06, p[2]], rx: 0.08, f: 0.025, b: 0.025, col: bc, t: AY, pw: 4, ref: [0.8, 0, 0.6], fref: [-0.6, 0, 0.8] }], 8, { cap0: 0.015, cap1: 0.015 });
  }
}

// ── arms (local: origin = shoulder joint; built for the left (+X) arm, mirrored for the right) ──
function armGeo(S, B, side) {
  const buf = new Buf(), k = B.k, fem = S.sex === 'f', mirror = side < 0, top = S.top;
  const skin = paint(S.skin, 0.6), sl = paint(S.shirt, top === 'suit' || top === 'coat' ? 0.75 : 0.85), trim = paint(S.trim, 0.85), w = fem ? 0.88 : 1;
  const sleeve = S.sleeve || (top === 'tee' ? 'short' : top === 'robe' || top === 'ru' ? 'wide' : top === 'blouse' ? (fem ? 'short' : 'long') : 'long');
  const sleeveCol = top === 'vest' ? paint(S.under, 0.85) : sl;
  const stripe = top === 'track' ? trim : null;
  // anatomical rings (left arm): [y, x, z, rx(side), f, b]
  const A = [[0.006, -0.008, 0, 0.03, 0.034, 0.034], [-0.014, -0.002, 0, 0.048, 0.052, 0.052], [-0.05, 0.007, 0, 0.051, 0.053, 0.05], [-0.12, 0.01, -0.002, 0.045, 0.048, 0.046],
    [-0.21, 0.012, -0.003, 0.04, 0.042, 0.042], [-0.29, 0.012, 0.0, 0.035, 0.036, 0.04], [-0.35, 0.012, 0.014, 0.039, 0.041, 0.039], [-0.45, 0.011, 0.033, 0.031, 0.033, 0.031], [-0.535, 0.01, 0.048, 0.021, 0.027, 0.025]];
  const HAND = [[-0.565, 0.008, 0.054, 0.016, 0.031, 0.028], [-0.615, 0.005, 0.058, 0.014, 0.038, 0.03], [-0.665, -0.002, 0.063, 0.012, 0.034, 0.026], [-0.705, -0.008, 0.067, 0.01, 0.026, 0.02]];
  const sc = (r, extra = 0) => ({ c: [r[1] * k, r[0] * k, r[2] * k], rx: (r[3] + extra) * w, f: (r[4] + extra) * w, b: (r[5] + extra) * w });
  const endY = sleeve === 'short' ? -0.17 : sleeve === 'long' ? -0.515 : -0.47;
  const loose = top === 'coat' || top === 'suit' || top === 'jacket' || top === 'hoodie' ? 0.014 : 0.008;
  const rings = [];
  const colFn = (base) => stripe ? (a, ca) => (ca > 0.82 ? stripe : base) : null;
  if (sleeve === 'wide') {
    // hanfu: wide hanging sleeve (open), hand coming out of it
    const W = [[0.01, -0.008, 0, 0.04, 0.045, 0.045], [-0.012, 0.0, 0, 0.058, 0.064, 0.064], [-0.08, 0.01, 0, 0.064, 0.07, 0.07], [-0.2, 0.012, 0.0, 0.066, 0.08, 0.08], [-0.32, 0.014, 0.01, 0.07, 0.1, 0.1], [-0.42, 0.015, 0.02, 0.072, 0.12, 0.13], [-0.5, 0.015, 0.025, 0.072, 0.13, 0.14]];
    for (const r of W) rings.push({ ...sc(r), col: sl });
    const last = rings[rings.length - 1];
    rings.push({ ...last, c: [...last.c], col: trim, seam: true }, { ...last, c: [last.c[0], last.c[1] - 0.06, last.c[2] - 0.035], f: last.f * 0.85, b: last.b * 0.8, col: trim });
    tube(buf, rings, 10, { cap0: 0.02, mirror });
    // forearm inside + hand
    const hr = [{ ...sc(A[7]), col: paint(S.under, 0.85) }, { ...sc(A[8]), col: skin }];
    for (const r of HAND) hr.push({ ...sc(r), col: skin });
    tube(buf, hr, 8, { cap1: 0.012 * k, mirror });
  } else {
    for (let i = 0; i < A.length; i++) {
      const r = A[i], y = r[0], inSleeve = y > endY;
      if (i > 0 && A[i - 1][0] > endY && !inSleeve) {
        // cuff: sleeve edge then seam to skin
        const t = (A[i - 1][0] - endY) / (A[i - 1][0] - y), mid = A[i - 1].map((v, j) => lerp(v, r[j], t));
        const ext = sleeve === 'short' ? loose + 0.012 : loose + 0.004;
        rings.push({ ...sc(mid, ext), col: sleeveCol, colFn: colFn(sleeveCol) });
        rings.push({ ...sc(mid, sleeve === 'long' && (top === 'shirt' || top === 'suit') ? 0.002 : 0), col: sleeve === 'long' && top === 'suit' ? paint(S.under, 0.8) : skin, seam: true });
      }
      if (inSleeve) rings.push({ ...sc(r, loose * (i < 2 ? 0.3 : i < 3 ? 0.7 : 1)), col: sleeveCol, colFn: colFn(sleeveCol) });
      else rings.push({ ...sc(r), col: skin });
    }
    for (const r of HAND) rings.push({ ...sc(r), col: skin });
    tube(buf, rings, 9, { cap0: 0.012 * k, cap1: 0.012 * k, mirror });
  }
  // thumb
  tube(buf, [{ c: [0.0, -0.575 * k, 0.074 * k], rx: 0.011 * w, f: 0.012 * w, b: 0.012 * w, col: skin }, { c: [-0.006 * k, -0.615 * k, 0.086 * k], rx: 0.0095 * w, f: 0.01 * w, b: 0.01 * w, col: skin }, { c: [-0.012 * k, -0.64 * k, 0.088 * k], rx: 0.008 * w, f: 0.008 * w, b: 0.008 * w, col: skin }], 5, { cap1: 0.006, mirror });
  // things held in the right hand
  if (side < 0 && S.bag === 'hand') {
    const bc = paint(S.bagColor, 0.5);
    tube(buf, [{ c: [0.02, -0.62 * k, 0.06], rx: 0.004, f: 0.004, b: 0.004, col: bc }, { c: [0.02, -0.7 * k, 0.11], rx: 0.004, f: 0.004, b: 0.004, col: bc }], 4, { mirror });
    tube(buf, [{ c: [0.02, -0.7 * k, 0.07], rx: 0.04, f: 0.11, b: 0.11, col: bc, pw: 4 }, { c: [0.02, -0.86 * k, 0.07], rx: 0.045, f: 0.13, b: 0.13, col: bc, pw: 4 }], 6, { cap0: 0.012, cap1: 0.012, mirror });
  }
  if (S.style === 'hanfu' && S.sex === 'f') {
    // 披帛 end falling from the forearm
    const pb = paint(S.trim2 ?? tint(S.accent, 0.55), 0.7);
    const pts = [[0.07, -0.33 * k, 0.02], [0.085, -0.45 * k, 0.03], [0.09, -0.65 * k, 0.04], [0.085, -0.85 * k, 0.05]];
    ribbon(buf, pts, pts.map(() => [1, 0, 0]), [0.06, 0.08, 0.09, 0.09], pb, 0, mirror);
  }
  return buf.geo();
}

// ── legs (local: origin = hip joint) ──
function legGeo(S, B, side) {
  const buf = new Buf(), k = B.k * (S.sex === 'f' ? 0.98 / 0.935 : 1), fem = S.sex === 'f', mirror = side < 0, bot = S.bottom;
  const L = B.hip[1]; // hip height = leg length
  const s = L / 0.9; // vertical scale (male reference 0.9)
  const w = fem ? 0.92 : 1;
  const skinPt = paint(S.legs ?? S.skin, S.legs ? 0.7 : 0.6), pants = paint(S.pants, bot === 'jeans' ? 0.9 : 0.8), trim = paint(S.trim, 0.85);
  // anatomical (left leg): [y, x, z, rx, f, b]
  const A = [[0.07, 0.0, 0, 0.07, 0.078, 0.082], [0.0, 0.0, 0, 0.08, 0.088, 0.092], [-0.12, -0.004, 0.004, 0.08, 0.083, 0.083], [-0.26, -0.009, 0.006, 0.072, 0.072, 0.07], [-0.40, -0.013, 0.008, 0.058, 0.058, 0.058],
    [-0.46, -0.015, 0.008, 0.052, 0.055, 0.05], [-0.56, -0.016, 0.0, 0.054, 0.05, 0.064], [-0.66, -0.017, -0.002, 0.046, 0.045, 0.05], [-0.77, -0.018, 0.0, 0.034, 0.034, 0.034], [-0.83, -0.018, 0.0, 0.03, 0.032, 0.032]];
  const PANTS = [[0.07, 0.0, 0, 0.072, 0.08, 0.085], [0.0, 0.0, 0, 0.083, 0.092, 0.097], [-0.15, -0.004, 0.004, 0.084, 0.086, 0.088], [-0.3, -0.009, 0.006, 0.076, 0.074, 0.074], [-0.46, -0.014, 0.006, 0.064, 0.062, 0.062],
    [-0.62, -0.016, 0.0, 0.06, 0.058, 0.06], [-0.76, -0.017, 0.0, 0.058, 0.057, 0.058], [-0.82, -0.018, 0.0, 0.057, 0.057, 0.057]];
  const sc = (r, ww = w) => ({ c: [r[1], r[0] * s, r[2]], rx: r[3] * ww, f: r[4] * ww, b: r[5] * ww });
  const rings = [];
  const stripe = bot === 'track' ? (a, ca) => (ca > 0.85 ? trim : pants) : null;
  if (bot === 'pants' || bot === 'jeans' || bot === 'track') {
    const ww = bot === 'jeans' ? w * 0.94 : w;
    for (const r of PANTS) rings.push({ ...sc(r, ww), col: pants, colFn: stripe });
    const h = rings[rings.length - 1];
    rings.push({ ...sc(A[9]), c: h.c, col: paint(S.legs ?? (bot === 'track' ? 0xf0f0ec : 0x2a2a2a), 0.8), seam: true });
  } else if (bot === 'shorts') {
    for (const r of PANTS.slice(0, 3)) rings.push({ ...sc(r, w * 1.05), col: pants });
    const h = rings[rings.length - 1], hy = -0.2 * s;
    rings.push({ ...h, c: [h.c[0], hy, h.c[2]], col: pants });
    rings.push({ ...sc(A[2]), c: [h.c[0], hy, h.c[2]], col: skinPt, seam: true });
    for (const r of A.slice(3)) rings.push({ ...sc(r), col: skinPt });
  } else if (bot === 'robe' || bot === 'qixiong') {
    // hidden under the long skirt: simple inner trouser
    const ip = paint(bot === 'robe' ? S.shirt : S.pants, 0.85);
    for (const r of [A[0], A[2], A[5], A[9]]) rings.push({ ...sc(r, w * 1.15), col: ip });
  } else { // skirt: bare legs / tights
    for (const r of A) rings.push({ ...sc(r), col: skinPt });
  }
  tube(buf, rings, 8, { cap0: 0.03, mirror });
  // shoe: loft along +Z (front axis of each ring = up)
  const up = paint(S.shoes, S.style === 'business' ? 0.4 : 0.7), sole = paint(S.sole, 0.8), ax = -0.018, gy = -L;
  const fk = fem ? 0.9 : 1, z0 = 0.0, splay = 0.08;
  const SH = [[-0.06, 0.028, 0.035, 0.012], [-0.05, 0.04, 0.06, 0.014], [-0.01, 0.045, 0.068, 0.014], [0.04, 0.047, 0.055, 0.014], [0.09, 0.046, 0.042, 0.014], [0.14, 0.04, 0.03, 0.013], [0.175, 0.028, 0.022, 0.012]];
  const shoeRings = SH.map(([z, hw, top, bot2]) => {
    const zz = z * fk + z0; return { c: [ax + Math.sin(splay) * zz, gy + bot2, Math.cos(splay) * zz], rx: hw * fk, f: top * (fem && S.style !== 'student' ? 0.75 : 1), b: bot2, pw: 3, t: [Math.sin(splay), 0, Math.cos(splay)], ref: AX, fref: AY, colFn: (a, ca, sa) => (sa < -0.55 ? sole : up) };
  });
  tube(buf, shoeRings, 8, { cap0: 0.012, cap1: 0.014, mirror });
  return buf.geo();
}

// ───────────────────────── public API ─────────────────────────
const _cache = new Map();
function geometries(S) {
  const key = JSON.stringify(S); let g = _cache.get(key);
  if (g) return g;
  const B = BODY[S.sex], body = new Buf();
  bodyParts(body, S, B); headParts(body, S, B);
  g = { body: body.geo(), arm_l: armGeo(S, B, 1), arm_r: armGeo(S, B, -1), leg_l: legGeo(S, B, 1), leg_r: legGeo(S, B, -1) };
  _cache.set(key, g); return g;
}

/** the hand-coded person (hanfu visitors always use it; also the fallback when the ready-made models are missing) */
export function buildProceduralPerson(opts = {}) { return buildPerson(opts, true); }
export function buildPerson(opts = {}, procedural = false) {
  if (!procedural && USE_GLB && opts.style !== 'hanfu') { try { const o = buildGlbPerson(opts); if (o) return o; } catch (e) { console.warn('person model failed, using the coded one:', e); } }
  const S = resolve(opts), B = BODY[S.sex], G = geometries(S), m = material();
  const g = new THREE.Group(); g.name = 'person';
  const add = (name, pos) => { const o = new THREE.Mesh(G[name], m); o.name = name; o.castShadow = true; if (pos) o.position.set(...pos); g.add(o); return o; };
  add('body');
  const hz = S.hunch * 0.05;
  add('arm_l', [B.sh[0], B.sh[1] - S.hunch * 0.02, B.sh[2] + hz]); add('arm_r', [-B.sh[0], B.sh[1] - S.hunch * 0.02, B.sh[2] + hz]);
  add('leg_l', [B.hip[0], B.hip[1], B.hip[2]]); add('leg_r', [-B.hip[0], B.hip[1], B.hip[2]]);
  g.userData = { height: B.H - S.hunch * 0.04, style: S.style, sex: S.sex };
  return g;
}

export const PERSON_PRESETS = [
  // casual
  { style: 'casual', sex: 'm', top: 'tee', shirt: 0x3f7fbf, pants: 0x2d3a52, bottom: 'jeans', skin: 0xe3b690, hair: 0x241a14 },
  { style: 'casual', sex: 'f', top: 'blouse', shirt: 0xe8e4d8, pants: 0x6b5a3a, bottom: 'skirt', skin: 0xf0c8a6, hair: 0x2e2119, hairStyle: 'long', bag: 'hand', bagColor: 0x8a5a3a },
  { style: 'casual', sex: 'm', top: 'hoodie', shirt: 0x4a5560, pants: 0x25282e, bottom: 'jeans', skin: 0xd9a77c, hair: 0x15110e },
  { style: 'casual', sex: 'f', top: 'tee', shirt: 0xc0392b, pants: 0x3b4a66, bottom: 'jeans', skin: 0xe8bd98, hair: 0x1b1512, hairStyle: 'ponytail', bag: 'cross', bagColor: 0x2a2420 },
  { style: 'casual', sex: 'm', top: 'jacket', shirt: 0x4f6b4a, under: 0xe8e4d8, trim: 0x2a2a2a, pants: 0xc9b896, bottom: 'pants', skin: 0xcf9a70, hair: 0x15110e, bag: 'cross', bagColor: 0x3a3a3a },
  { style: 'casual', sex: 'f', top: 'jacket', shirt: 0xd8c8b0, under: 0x2a2d33, trim: 0xb8a890, pants: 0x25282e, bottom: 'jeans', skin: 0xf0c8a6, hair: 0x3a2a1c, hairStyle: 'bob' },
  { style: 'casual', sex: 'm', top: 'tee', shirt: 0xe0a030, pants: 0x3b3f46, bottom: 'shorts', skin: 0xb98056, hair: 0x120e0c },
  { style: 'casual', sex: 'f', top: 'tee', shirt: 0xf2f0ea, pants: 0x4a6a8a, bottom: 'skirt', skin: 0xe3b690, hair: 0x241a14, hairStyle: 'long' },
  // business
  { style: 'business', sex: 'm', top: 'suit', shirt: 0x23272e, pants: 0x1c1f25, tie: 0x7a2424, skin: 0xe3b690, hair: 0x15110e },
  { style: 'business', sex: 'm', top: 'shirt', shirt: 0xdfe8f2, pants: 0x2c3548, tie: 0x2a3a6a, skin: 0xd9a77c, hair: 0x2a2018 },
  { style: 'business', sex: 'f', top: 'suit', shirt: 0x3a4660, pants: 0x3a4660, under: 0xf4f2ee, skin: 0xf0c8a6, hair: 0x15110e, hairStyle: 'bun' },
  // students
  { style: 'student', sex: 'm', shirt: 0x2a4f9a, trim: 0xf2f2ee, skin: 0xe8bf9c, hair: 0x15110e, bagColor: 0x2a2d33 },
  { style: 'student', sex: 'f', shirt: 0xa02a2a, trim: 0xf2f2ee, skin: 0xf0c8a6, hair: 0x1b1512, hairStyle: 'ponytail', bagColor: 0x5a6a8a },
  // elders
  { style: 'elder', sex: 'm', shirt: 0x3a3a40, pants: 0x2a2a2e, skin: 0xcf9a70, hair: 0x9a9a98, hat: 'flat', hatColor: 0x2a2a2e },
  { style: 'elder', sex: 'f', shirt: 0x5a2a28, pants: 0x2a2a2e, skin: 0xd9a77c, hair: 0xa8a8a4, hairStyle: 'bun' },
  // workers
  { style: 'worker', job: 'delivery', sex: 'm', skin: 0xcf9a70, hair: 0x15110e },
  { style: 'worker', job: 'sanitation', sex: 'm', skin: 0xb98056, hair: 0x241a14 },
  // hanfu (traffic.js picks among the first three hanfu presets near historic sites)
  { style: 'hanfu', sex: 'f', shirt: 0xf2ece0, pants: 0xc94f5a, accent: 0x8a2a3a, trim: 0xe0c8a8, skin: 0xf0c8a6, hair: 0x15110e },
  { style: 'hanfu', sex: 'm', shirt: 0x7f9fa8, pants: 0xe8e4da, trim: 0x2f4a55, accent: 0x2a3a40, skin: 0xe3b690, hair: 0x15110e },
  { style: 'hanfu', sex: 'f', shirt: 0xe6eef0, pants: 0x6e9fb8, accent: 0x3a5f8a, trim: 0xc8d8e8, skin: 0xe8bd98, hair: 0x1b1512 },
  { style: 'hanfu', sex: 'm', shirt: 0xd8cfb8, pants: 0xf0ebe0, trim: 0x6a4a32, accent: 0x5a3a28, skin: 0xd9a77c, hair: 0x15110e },
];

/** preview helper: every preset (or those whose style matches) standing in a row, 0.9 m apart. preview.html?model=people&fn=buildPeopleLineup&args=["hanfu"] */
export function buildPeopleLineup(style = null, walk = 0, only = -1) {
  const g = new THREE.Group(), list = PERSON_PRESETS.filter((p, i) => (!style || p.style === style) && (only < 0 || i === only));
  list.forEach((p, i) => {
    const o = buildPerson(p); o.position.x = (i - (list.length - 1) / 2) * 0.9;
    if (walk) for (const [n, k] of [['arm_l', 0.8], ['arm_r', -0.8], ['leg_l', -1], ['leg_r', 1]]) o.getObjectByName(n).rotation.x = walk * k;
    g.add(o);
  });
  return g;
}

// Ready-made rigged models (assets/models/people): loaded once before the first buildPerson(); `?codemodels` keeps the coded people.
const USE_GLB = HAS_DOM && typeof location !== 'undefined' && !new URLSearchParams(location.search).has('codemodels');
if (USE_GLB) { try { await preloadGlb(); } catch (e) { console.warn('person models not loaded:', e); } }
