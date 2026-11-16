// Procedural cars v2 (PBR). Metres, Y up, front = +Z, left (driver side) = +X. Origin = ground centre.
// buildCar(type, color) -> Group { 3–4 body meshes (paint / trim+glass+chrome / lamps / decals), wheel_fl / wheel_fr / wheel_rl / wheel_rr }.
//
// How the bodies are made: every vehicle body is a loft — a closed cross-section ring (40 points, rounded rocker,
// side, shoulder, greenhouse with tumblehome, roof corner, crowned roof) evaluated at ~50–70 stations along Z. The
// section parameters come from smooth side-view curves (roof/hood line, underside, belt line), a plan-view outline,
// superellipse nose/tail rounding and circular wheel-arch cut-outs. Glass, window surrounds, seams, cladding and
// side decals are patches sampled on the same analytic surface (offset a few mm along the normal); lamps, grilles and
// front/rear details are patches projected onto the nose/tail. Everything is merged per material:
//   paint  – MeshPhysicalMaterial (clearcoat), one per colour, shared
//   multi  – one shared MeshStandardMaterial; colour, roughness and metalness come per vertex (glass, chrome, rubber…)
//   lamps  – same idea + emissive = vertex colour (registered with glow(): faint by day, bright at night)
//   decals – one shared canvas atlas (plates, police/taxi lettering, bus destination sign)
// Geometry is built once per type and shared by every car of that type; plates vary via a few cached UV variants.
import * as THREE from 'three';
import { glow, canvasTex, HAS_DOM } from '../core/mats.js';
import { preload as preloadGlb, buildGlbCar } from './cars_glb.js';

export const CAR_TYPES = ['sedan', 'suv', 'taxi', 'bus', 'police', 'van', 'sports', 'truck'];

// ───────────────────────── small math ─────────────────────────
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), clamp01 = v => clamp(v, 0, 1), lerp = (a, b, t) => a + (b - a) * t;
const PI = Math.PI;
const smooth01 = t => { t = clamp01(t); return t * t * (3 - 2 * t); };
function mulberry(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** monotone cubic (Fritsch–Carlson) through [[x,y],…] with x ascending — smooth, no overshoot */
function mono(pts) {
  const n = pts.length, X = pts.map(p => p[0]), Y = pts.map(p => p[1]);
  if (n === 1) return () => Y[0];
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
/** superellipse end rounding: 1 before the rounding zone, falls to 0 at t = 1 with a vertical tangent */
const superEnd = (t, p) => (t <= 0 ? 1 : t >= 1 ? 0 : Math.pow(1 - Math.pow(t, p), 1 / p));

// ───────────────────────── tiny geometry kit ─────────────────────────
// Geo = { p:[x,y,z…], n:[…], uv:[…]|null, i:[…] }
function computeNormals(g) {
  const p = g.p, n = new Float32Array(p.length), I = g.i;
  for (let k = 0; k < I.length; k += 3) {
    const a = I[k] * 3, b = I[k + 1] * 3, c = I[k + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const q of [a, b, c]) { n[q] += nx; n[q + 1] += ny; n[q + 2] += nz; }
  }
  for (let q = 0; q < n.length; q += 3) { const l = Math.hypot(n[q], n[q + 1], n[q + 2]) || 1; n[q] /= l; n[q + 1] /= l; n[q + 2] /= l; }
  g.n = Array.from(n); return g;
}
function flipWind(g) { const I = g.i; for (let k = 0; k < I.length; k += 3) { const t = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = t; } return g; }
/** make triangle winding agree with the stored vertex normals */
function fixWind(g) {
  const p = g.p, n = g.n, I = g.i; let S = 0;
  for (let k = 0; k < I.length; k += 3) {
    const a = I[k] * 3, b = I[k + 1] * 3, c = I[k + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    S += (uy * vz - uz * vy) * (n[a] + n[b] + n[c]) + (uz * vx - ux * vz) * (n[a + 1] + n[b + 1] + n[c + 1]) + (ux * vy - uy * vx) * (n[a + 2] + n[b + 2] + n[c + 2]);
  }
  if (S < 0) flipWind(g); return g;
}
/** turn a computed-normal patch so it faces roughly along dir */
function orient(g, dir) {
  let S = 0; for (let q = 0; q < g.n.length; q += 3) S += g.n[q] * dir[0] + g.n[q + 1] * dir[1] + g.n[q + 2] * dir[2];
  if (S < 0) { flipWind(g); for (let q = 0; q < g.n.length; q++) g.n[q] = -g.n[q]; }
  return g;
}
function offsetN(g, d) { for (let q = 0; q < g.p.length; q++) g.p[q] += g.n[q] * d; return g; }
/** grid over (s,t) ∈ [0,1]²; fn returns {p, n?, uv?} */
function gridGeo(nu, nv, fn) {
  const g = { p: [], n: [], uv: [], i: [] }; let hasN = true, hasUV = true;
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
    const r = fn(i / nu, j / nv); g.p.push(r.p[0], r.p[1], r.p[2]);
    if (r.n) g.n.push(r.n[0], r.n[1], r.n[2]); else hasN = false;
    if (r.uv) g.uv.push(r.uv[0], r.uv[1]); else hasUV = false;
  }
  if (!hasUV) g.uv = null;
  const W = nv + 1;
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * W + j, b = a + 1, c = a + W, d = c + 1; g.i.push(a, b, c, b, d, c); }
  if (hasN) fixWind(g); else computeNormals(g);
  return g;
}
/** mirror across X=0; rect (u0,v0,u1,v1) flips U inside a decal rect so lettering still reads correctly */
function mirrorX(g, rect = null) {
  const o = { p: g.p.slice(), n: g.n.slice(), uv: g.uv ? g.uv.slice() : null, i: g.i.slice() };
  for (let q = 0; q < o.p.length; q += 3) { o.p[q] = -o.p[q]; o.n[q] = -o.n[q]; }
  if (rect && o.uv) for (let q = 0; q < o.uv.length; q += 2) o.uv[q] = rect[0] + rect[2] - o.uv[q];
  return flipWind(o);
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _nm = new THREE.Matrix3();
function xf(g, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  _m4.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz)); _nm.getNormalMatrix(_m4);
  const P = new THREE.Vector3(), e = _m4.elements, ne = _nm.elements;
  for (let q = 0; q < g.p.length; q += 3) {
    P.set(g.p[q], g.p[q + 1], g.p[q + 2]).applyMatrix4(_m4); g.p[q] = P.x; g.p[q + 1] = P.y; g.p[q + 2] = P.z;
    const nx = g.n[q], ny = g.n[q + 1], nz = g.n[q + 2];
    const ox = ne[0] * nx + ne[3] * ny + ne[6] * nz, oy = ne[1] * nx + ne[4] * ny + ne[7] * nz, oz = ne[2] * nx + ne[5] * ny + ne[8] * nz, l = Math.hypot(ox, oy, oz) || 1;
    g.n[q] = ox / l; g.n[q + 1] = oy / l; g.n[q + 2] = oz / l;
  }
  if (sx * sy * sz < 0) flipWind(g);
  void e; return g;
}
function fromThree(bg) {
  const g = { p: Array.from(bg.attributes.position.array), n: Array.from(bg.attributes.normal.array), uv: bg.attributes.uv ? Array.from(bg.attributes.uv.array) : null, i: bg.index ? Array.from(bg.index.array) : [...Array(bg.attributes.position.count).keys()] };
  bg.dispose(); return g;
}
const boxG = (w, h, d) => fromThree(new THREE.BoxGeometry(w, h, d));
/** box with rounded edges (radius r, s segments per rounded edge) — smooth normals */
function rbox(w, h, d, r, s = 1) {
  const n = 2 * s + 1, bg = new THREE.BoxGeometry(1, 1, 1, n, n, n), P = bg.attributes.position, N = bg.attributes.normal;
  const hs = [w / 2, h / 2, d / 2]; r = Math.min(r, ...hs) * 0.999;
  const map = (c, hh) => { const k = Math.round((c + 0.5) * n); return k <= s ? -hh + r * (k / s) : k >= n - s ? hh - r * ((n - k) / s) : 0; };
  for (let q = 0; q < P.count; q++) {
    const p = [map(P.getX(q), hs[0]), map(P.getY(q), hs[1]), map(P.getZ(q), hs[2])];
    const inr = p.map((c, k) => clamp(c, -(hs[k] - r), hs[k] - r)), dv = p.map((c, k) => c - inr[k]), l = Math.hypot(...dv);
    if (l > 1e-6) { const u = dv.map(c => c / l); P.setXYZ(q, inr[0] + u[0] * r, inr[1] + u[1] * r, inr[2] + u[2] * r); N.setXYZ(q, ...u); }
    else P.setXYZ(q, ...p);
  }
  return fromThree(bg);
}
/** surface of revolution about the X axis. prof = [[radius, x], …]; the outward side is to the left of travel. */
function lathe(prof, N) {
  const P = prof.length, g = { p: [], n: [], uv: null, i: [] }, n2 = [];
  const seg = []; for (let i = 0; i < P - 1; i++) { const dr = prof[i + 1][0] - prof[i][0], da = prof[i + 1][1] - prof[i][1], l = Math.hypot(dr, da); seg.push(l < 1e-7 ? null : [da / l, -dr / l]); }
  for (let i = 0; i < P; i++) { const a = seg[i - 1], b = seg[i]; let nr = (a ? a[0] : 0) + (b ? b[0] : 0), na = (a ? a[1] : 0) + (b ? b[1] : 0); const l = Math.hypot(nr, na) || 1; n2.push([nr / l, na / l]); }
  for (let k = 0; k < N; k++) {
    const an = (k / N) * PI * 2, c = Math.cos(an), s = Math.sin(an);
    for (let i = 0; i < P; i++) { g.p.push(prof[i][1], prof[i][0] * c, prof[i][0] * s); g.n.push(n2[i][1], n2[i][0] * c, n2[i][0] * s); }
  }
  for (let k = 0; k < N; k++) { const k2 = (k + 1) % N; for (let i = 0; i < P - 1; i++) { const a = k * P + i, b = a + 1, c = k2 * P + i, d = c + 1; g.i.push(a, c, b, b, c, d); } }
  return fixWind(g);
}
/** flat quad from 4 corners (counter-clockwise seen from the front) */
function quad(a, b, c, d, uv = [0, 0, 1, 0, 1, 1, 0, 1]) { return computeNormals({ p: [...a, ...b, ...c, ...d], n: [], uv: uv.slice(), i: [0, 1, 2, 0, 2, 3] }); }

// material buckets
const Bk = () => ({ p: [], n: [], c: [], rm: [], uv: [], i: [] });
function put(bk, g, col = [1, 1, 1], rough = 0.5, metal = 0) {
  const o = bk.p.length / 3, nv = g.p.length / 3;
  for (let q = 0; q < g.p.length; q++) { bk.p.push(g.p[q]); bk.n.push(g.n[q]); }
  for (let v = 0; v < nv; v++) { bk.c.push(col[0], col[1], col[2]); bk.rm.push(rough, metal); if (g.uv) bk.uv.push(g.uv[2 * v], g.uv[2 * v + 1]); else bk.uv.push(0, 0); }
  for (const k of g.i) bk.i.push(k + o);
  return o;
}
const put2 = (bk, g, k, rect) => { put(bk, g, ...k); put(bk, mirrorX(g, rect), ...k); };
function toBG(bk, { color = true, uv = false } = {}) {
  if (!bk.i.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(bk.p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(bk.n, 3));
  if (color) { g.setAttribute('color', new THREE.Float32BufferAttribute(bk.c, 3)); g.setAttribute('rm', new THREE.Float32BufferAttribute(bk.rm, 2)); }
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(bk.uv, 2));
  g.setIndex(bk.i); g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}

// ───────────────────────── materials ─────────────────────────
// [linear colour, roughness, metalness]
const K = {
  trim: [[0.03, 0.03, 0.032], 0.6, 0], gloss: [[0.012, 0.012, 0.014], 0.12, 0.3], seam: [[0.01, 0.01, 0.01], 0.85, 0],
  liner: [[0.012, 0.012, 0.012], 0.95, 0], glass: [[0.03, 0.04, 0.05], 0.02, 0.8], chrome: [[0.95, 0.95, 0.95], 0.08, 1],
  dchrome: [[0.22, 0.23, 0.25], 0.2, 1], grille: [[0.015, 0.015, 0.017], 0.35, 0.5], rubber: [[0.02, 0.02, 0.02], 0.9, 0],
  rim: [[0.6, 0.61, 0.63], 0.24, 1], rimDark: [[0.06, 0.06, 0.065], 0.28, 0.85], steel: [[0.55, 0.55, 0.55], 0.35, 0.9],
  disc: [[0.32, 0.31, 0.3], 0.42, 1], white: [[0.72, 0.72, 0.7], 0.42, 0], silver: [[0.55, 0.56, 0.58], 0.3, 0.9],
  mirror: [[0.85, 0.87, 0.9], 0.03, 1], housing: [[0.03, 0.03, 0.035], 0.25, 0.6], plastic: [[0.06, 0.06, 0.065], 0.7, 0],
  // lamps (emissive = vertex colour × intensity)
  head: [[0.42, 0.43, 0.46], 0.1, 1], drl: [[1, 1, 1], 0.1, 0.2], tail: [[0.55, 0.015, 0.01], 0.12, 0.1], tailDim: [[0.28, 0.008, 0.006], 0.15, 0.2],
  amber: [[0.95, 0.38, 0.02], 0.15, 0.1], rev: [[0.2, 0.2, 0.22], 0.08, 1], red: [[1, 0.03, 0.02], 0.2, 0.1], blue: [[0.03, 0.15, 1], 0.2, 0.1],
};

function rmPatch(m, key, emissiveFromColor) {
  m.onBeforeCompile = sh => {
    sh.vertexShader = 'attribute vec2 rm;\nvarying vec2 vRM;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvRM = rm;');
    let f = 'varying vec2 vRM;\n' + sh.fragmentShader
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = vRM.x;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n\tmetalnessFactor = vRM.y;');
    if (emissiveFromColor) f = f.replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = emissive * vColor;');
    sh.fragmentShader = f;
  };
  m.customProgramCacheKey = () => key;
  return m;
}
let _M = null;
function mats() {
  if (_M) return _M;
  const multi = rmPatch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1 }), 'car-rm', false);
  const lamp = rmPatch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1, emissive: 0xffffff }), 'car-rm-lamp', true);
  glow(lamp, 0.05, 4.5);
  const at = atlas();
  const decal = new THREE.MeshStandardMaterial({ color: 0xffffff, map: at ? at.map : null, emissiveMap: at ? at.emi : null, emissive: at ? 0xffffff : 0x000000, roughness: 0.4, metalness: 0, alphaTest: 0.5 });
  if (at) glow(decal, 0.5, 1.6);
  multi.name = 'car-multi'; lamp.name = 'car-lamp'; decal.name = 'car-decal';
  return (_M = { multi, lamp, decal });
}
const paintCache = new Map();
function paintMat(color) {
  let m = paintCache.get(color); if (m) return m;
  const c = new THREE.Color(color), lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; // linear
  const solidWhite = lum > 0.55, black = lum < 0.03;
  m = new THREE.MeshPhysicalMaterial({ color, metalness: solidWhite ? 0.05 : black ? 0.35 : 0.6, roughness: solidWhite ? 0.32 : black ? 0.3 : 0.38, clearcoat: 1, clearcoatRoughness: 0.04 });
  m.name = 'car-paint-' + color.toString(16);
  paintCache.set(color, m); return m;
}

// ───────────────────────── decal atlas (plates + lettering) ─────────────────────────
const AT = 1024, FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Source Han Sans SC",sans-serif';
const R = { police: [0, 520, 640, 104], taxiDoor: [0, 624, 512, 64], taxiSign: [512, 624, 512, 96], busSign: [0, 720, 1024, 80], truck: [0, 800, 1024, 160], busNum: [0, 960, 256, 64], busSide: [256, 960, 768, 64] };
const uvR = r => [(r[0] + 1) / AT, 1 - (r[1] + r[3] - 1) / AT, (r[0] + r[2] - 1) / AT, 1 - (r[1] + 1) / AT]; // u0 v0 u1 v1
const PLATE_W = 256, PLATE_H = 84;
const PLATES = (() => {
  const rnd = mulberry(20240501), CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ', D = '0123456789', pick = s => s[Math.floor(rnd() * s.length)];
  const tail = n => { let t = ''; for (let i = 0; i < n; i++) t += rnd() < (i === 0 ? 0.45 : 0.18) ? pick(CH) : pick(D); return t; };
  const out = [];
  for (let k = 0; k < 10; k++) out.push({ kind: 'blue', text: 'C·' + tail(5) });
  for (let k = 0; k < 4; k++) out.push({ kind: 'green', text: 'C·' + (rnd() < 0.5 ? 'D' : 'F') + tail(5) });
  for (let k = 0; k < 6; k++) out.push({ kind: 'yellow', text: 'C·' + tail(5) });
  for (let k = 0; k < 2; k++) out.push({ kind: 'police', text: 'C·' + pick(D) + pick(D) + pick(D) + pick(D) });
  for (let k = 0; k < 2; k++) out.push({ kind: 'blue', text: 'C·T' + pick(D) + pick(D) + pick(D) + pick(D) });
  return out;
})();
const PLATE_POOL = { car: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], big: [14, 15, 16, 17, 18, 19], police: [20, 21], taxi: [22, 23, 0, 1] };
const plateRect = k => [(k % 4) * PLATE_W + 4, Math.floor(k / 4) * PLATE_H + 4, PLATE_W - 8, PLATE_H - 8];

function fitText(ctx, text, x, y, maxW) { const w = ctx.measureText(text).width; ctx.save(); ctx.translate(x, y); if (w > maxW) ctx.scale(maxW / w, 1); ctx.fillText(text, 0, 0); ctx.restore(); }
function drawPlate(ctx, [x, y, w, h], { kind, text }) {
  const bg = { blue: '#0a3d9c', yellow: '#f0bf14', police: '#f3f3f1' }[kind];
  if (kind === 'green') { const gr = ctx.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#f6fff4'); gr.addColorStop(1, '#3dbb5c'); ctx.fillStyle = gr; } else ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  const fg = kind === 'blue' ? '#f4f6fa' : '#111';
  ctx.strokeStyle = fg; ctx.lineWidth = 3; ctx.strokeRect(x + 5, y + 5, w - 10, h - 10);
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `bold ${Math.round(h * 0.66)}px ${FONT}`;
  if (kind === 'police') { fitText(ctx, '豫' + text, x + w * 0.44, y + h * 0.53, w * 0.74); ctx.fillStyle = '#d0141a'; fitText(ctx, '警', x + w * 0.88, y + h * 0.53, w * 0.16); }
  else fitText(ctx, '豫' + text, x + w / 2, y + h * 0.53, w - 20);
}
function drawAtlas(ctx, emissive) {
  ctx.clearRect(0, 0, AT, AT);
  if (emissive) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, AT, AT); }
  const T = (t, x, y, px, col, maxW, weight = 'bold') => { ctx.fillStyle = col; ctx.font = `${weight} ${px}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; fitText(ctx, t, x, y, maxW); };
  if (!emissive) {
    PLATES.forEach((p, k) => drawPlate(ctx, plateRect(k), p));
    // police side band: blue stripe with white lettering
    let [x, y, w, h] = R.police; ctx.fillStyle = '#1747a6'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#f2f4f8'; ctx.fillRect(x, y + 7, w, 5); ctx.fillRect(x, y + h - 12, w, 5);
    T('警 察', x + w * 0.27, y + h / 2 + 2, 60, '#ffffff', 260); T('POLICE', x + w * 0.71, y + h / 2 + 2, 50, '#ffffff', 280);
    // taxi door band: white band, dark lettering
    [x, y, w, h] = R.taxiDoor; ctx.fillStyle = '#f4f4f2'; ctx.fillRect(x, y, w, h); T('洛阳出租  TAXI', x + w / 2, y + h / 2 + 1, 40, '#1d3f73', w - 30);
  }
  // taxi roof sign + bus destination sign glow at night (drawn into both maps)
  let [x, y, w, h] = R.taxiSign; ctx.fillStyle = emissive ? '#5a4410' : '#f3e7b8'; ctx.fillRect(x, y, w, h); T('出租 TAXI', x + w / 2, y + h / 2 + 2, 46, emissive ? '#ff3a20' : '#c4161c', w - 30);
  [x, y, w, h] = R.busSign; ctx.fillStyle = '#0a0a0a'; ctx.fillRect(x, y, w, h); T('5', x + 70, y + h / 2 + 2, 60, '#ffb21e', 100); T('洛阳火车站 — 龙门石窟', x + w * 0.56, y + h / 2 + 2, 44, '#ffb21e', w - 220);
  [x, y, w, h] = R.busNum; ctx.fillStyle = '#0a0a0a'; ctx.fillRect(x, y, w, h); T('5 路', x + w / 2, y + h / 2 + 2, 44, '#ffb21e', w - 20);
  if (!emissive) {
    [x, y, w, h] = R.busSide; ctx.fillStyle = '#0a0a0a'; ctx.fillRect(x, y, w, h); T('5 路  洛阳火车站 — 龙门石窟', x + w / 2, y + h / 2 + 2, 38, '#ffb21e', w - 30);
    [x, y, w, h] = R.truck; T('城市配送', x + w * 0.36, y + h * 0.4, 104, '#1f4f9a', w * 0.62); T('LUOYANG LOGISTICS · 0379', x + w * 0.36, y + h * 0.86, 30, '#55606c', w * 0.62, '600');
    ctx.fillStyle = '#d23a2a'; ctx.fillRect(x + w * 0.74, y + 14, 12, h - 28); ctx.fillStyle = '#1f4f9a'; ctx.fillRect(x + w * 0.74 + 20, y + 14, 12, h - 28);
  } else {
    [x, y, w, h] = R.busSide; ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h); T('5 路  洛阳火车站 — 龙门石窟', x + w / 2, y + h / 2 + 2, 38, '#ffb21e', w - 30);
  }
}
let _atlas;
function atlas() {
  if (_atlas !== undefined) return _atlas;
  if (!HAS_DOM) return (_atlas = null);
  const map = canvasTex(AT, AT, ctx => drawAtlas(ctx, false), { repeat: false }), emi = canvasTex(AT, AT, ctx => drawAtlas(ctx, true), { repeat: false });
  return (_atlas = map ? { map, emi } : null);
}

// ───────────────────────── the loft body ─────────────────────────
// Section ring (right half, 21 points, v = 0…20): 0–1 underside, 1–4 rocker radius, 4–7 lower side (tucked under),
// 7–10 shoulder, 10–13 greenhouse wall (side glass), 13–16 roof corner, 16–20 roof (crowned).
const NP = 21;
function makeBody(s) {
  const fTop = mono(s.top), fBot = mono(s.bot), fBelt = mono(s.belt);
  const S = new Float32Array(NP * 2);
  s.spanF = Math.max(s.noseTop, s.noseBot, s.planF) + 0.03; s.spanR = Math.max(s.tailTop, s.tailBot, s.planR) + 0.03;
  function section(z, o = S) {
    let T = fTop(z), B = fBot(z);
    T = s.tipF + (T - s.tipF) * superEnd((z - s.z1 + s.noseTop) / s.noseTop, s.pFt);
    T = s.tipR + (T - s.tipR) * superEnd((s.z0 + s.tailTop - z) / s.tailTop, s.pRt);
    B = s.tipF - (s.tipF - B) * superEnd((z - s.z1 + s.noseBot) / s.noseBot, s.pFb);
    B = s.tipR - (s.tipR - B) * superEnd((s.z0 + s.tailBot - z) / s.tailBot, s.pRb);
    let hw = s.hw;
    for (const a of s.arches) {
      const dz = z - a.z; if (dz > -a.R && dz < a.R) { const yA = a.cy + Math.sqrt(a.R * a.R - dz * dz); if (yA > B) B = yA; }
      if (a.flare) hw += a.flare * Math.exp(-((dz / 0.65) ** 2));
    }
    hw = s.hwF + (hw - s.hwF) * superEnd((z - s.z1 + s.planF) / s.planF, s.pP);
    hw = s.hwR + (hw - s.hwR) * superEnd((s.z0 + s.planR - z) / s.planR, s.pP);
    if (B > T - 1e-4) B = T - 1e-4;
    let yb = z > s.cowl || z < s.deck ? T : Math.min(fBelt(z), T); if (yb < B) yb = B;
    const c = clamp01((T - yb) / 0.08);
    let tap = 0;
    if (s.taperF) tap += s.taperF * smooth01((z - s.zA) / (s.cowl - s.zA));
    if (s.taperR) tap += s.taperR * smooth01((s.zC - z) / (s.zC - s.deck));
    const yS = yb - Math.min(s.sd, (yb - B) * 0.45);
    const rb = Math.max(0, Math.min(s.rb, (yS - B) * 0.5, hw * 0.25));
    const tuck = s.tuck * clamp01((yS - B) / 0.25);
    const hwG0 = hw - lerp(s.in0, s.gIn0 + tap, c);
    const rt = Math.max(0, Math.min(s.rt, (T - yb) * 0.45, (hwG0 - 0.04) * 0.5));
    const hwG1 = Math.max(0.04, hwG0 - c * Math.min(s.gIn1 - s.gIn0, s.tumble * Math.max(0, T - yb - rt)));
    const xr = hwG1 - rt, crown = s.crown * clamp01(xr / 0.5);
    const cx = Math.max(0, hw - tuck - rb), cy = B + rb;
    o[0] = 0; o[1] = B; o[2] = cx; o[3] = B;
    o[4] = cx + rb * 0.5; o[5] = cy - rb * 0.8660254; o[6] = cx + rb * 0.8660254; o[7] = cy - rb * 0.5; o[8] = cx + rb; o[9] = cy;
    for (let k = 1; k <= 3; k++) { const t = k / 3; o[8 + 2 * k] = hw - tuck * (1 - t) * (1 - t); o[9 + 2 * k] = lerp(cy, yS, t); }
    for (let k = 1; k <= 3; k++) { const t = k / 3, u = 1 - t; o[14 + 2 * k] = (u * u + 2 * u * t) * hw + t * t * hwG0; o[15 + 2 * k] = u * u * yS + (2 * u * t + t * t) * yb; }
    const wy = T - rt;
    for (let k = 1; k <= 3; k++) { const t = k / 3; o[20 + 2 * k] = lerp(hwG0, hwG1, t); o[21 + 2 * k] = lerp(yb, wy, t); }
    let dx = hwG1 - hwG0, dy = wy - yb; const dl = Math.hypot(dx, dy); if (dl < 1e-5) { dx = 0; dy = 1; } else { dx /= dl; dy /= dl; }
    let Cx = hwG1 + dx * (dy > 0.2 ? rt / dy : rt); if (Cx < xr) Cx = xr;
    for (let k = 1; k <= 3; k++) { const t = k / 3, u = 1 - t; o[26 + 2 * k] = u * u * hwG1 + 2 * u * t * Cx + t * t * xr; o[27 + 2 * k] = u * u * wy + (2 * u * t + t * t) * T; }
    for (let k = 1; k <= 4; k++) { const x = xr * (1 - k / 4), q = xr > 1e-6 ? x / xr : 0; o[32 + 2 * k] = x; o[33 + 2 * k] = T + crown * (1 - q * q); }
    return o;
  }
  // after the loft is built, surface queries use the loft's own piecewise-linear stations so patches sit exactly on it
  const S2 = new Float32Array(NP * 2); let ST = null, SEC = null;
  function setStations(zs) { ST = zs; SEC = zs.map(z => section(z, new Float32Array(NP * 2))); }
  function secAt(z) {
    if (!ST) return section(z);
    if (z <= ST[0]) return SEC[0]; if (z >= ST[ST.length - 1]) return SEC[SEC.length - 1];
    let lo = 0, hi = ST.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ST[m] <= z) lo = m; else hi = m; }
    const f = (z - ST[lo]) / (ST[hi] - ST[lo]), a = SEC[lo], b = SEC[hi];
    for (let k = 0; k < NP * 2; k++) S2[k] = a[k] + (b[k] - a[k]) * f;
    return S2;
  }
  const pt = (z, v) => { const o = secAt(z); v = clamp(v, 0, 20); const i = Math.min(19, Math.floor(v)), f = v - i; return [lerp(o[2 * i], o[2 * i + 2], f), lerp(o[2 * i + 1], o[2 * i + 3], f), z]; };
  function nrm(z, v) {
    const a = pt(z, Math.min(20, v + 0.03)), b = pt(z, Math.max(0, v - 0.03)), c = pt(Math.min(s.z1, z + 0.004), v), d = pt(Math.max(s.z0, z - 0.004), v);
    const ux = a[0] - b[0], uy = a[1] - b[1], uz = a[2] - b[2], wx = c[0] - d[0], wy = c[1] - d[1], wz = c[2] - d[2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, l = Math.hypot(nx, ny, nz) || 1;
    return [nx / l, ny / l, nz / l];
  }
  function vAtY(z, y) {
    const o = secAt(z); if (y <= o[3]) return 1;
    for (let j = 1; j < 20; j++) { const y0 = o[2 * j + 1], y1 = o[2 * j + 3]; if (y1 > y0 && y >= y0 && y <= y1) return j + (y - y0) / (y1 - y0); }
    return 20;
  }
  function inside(z, x, y) {
    const o = secAt(z); if (y < o[1] || y > o[41]) return false;
    for (let j = 1; j < 20; j++) { const y0 = o[2 * j + 1], y1 = o[2 * j + 3]; if (y1 > y0 && y >= y0 && y <= y1) return Math.abs(x) <= lerp(o[2 * j], o[2 * j + 2], (y - y0) / (y1 - y0)); }
    return false;
  }
  /** z where the line (x,y) parallel to Z meets the nose (dir=+1) or tail (dir=-1) */
  function endZ(x, y, dir) {
    let lo = dir > 0 ? s.z1 - s.spanF : s.z0 + s.spanR, hi = dir > 0 ? s.z1 : s.z0;
    if (!inside(lo, x, y)) return lo;
    for (let k = 0; k < 22; k++) { const m = (lo + hi) / 2; if (inside(m, x, y)) lo = m; else hi = m; }
    return lo;
  }
  const roofY = z => secAt(z)[41];
  return { s, section, setStations, pt, nrm, vAtY, endZ, roofY, belt: fBelt, top: fTop };
}

function loftGeo(B) {
  const s = B.s, imp = [], base = [];
  const nE = 6; for (let k = 0; k <= nE; k++) { const t = Math.sin((k / nE) * PI / 2); imp.push(s.z1 - s.spanF * (1 - t), s.z0 + s.spanR * (1 - t)); }
  for (const a of s.arches) { const nA = 8; for (let k = 0; k <= nA; k++) imp.push(a.z + a.R * Math.cos((k / nA) * PI)); imp.push(a.z - a.R - 0.012, a.z + a.R + 0.012); }
  for (const z of s.extraZ || []) imp.push(z);
  for (let z = s.z0; z <= s.z1; z += s.step) base.push(z);
  imp.sort((a, b) => a - b);
  const zs = [];
  for (const z of imp) if (z >= s.z0 && z <= s.z1 && (!zs.length || z - zs[zs.length - 1] > 0.004)) zs.push(z);
  for (const z of base) if (zs.every(q => Math.abs(q - z) > s.step * 0.45)) zs.push(z);
  zs.sort((a, b) => a - b);
  const g = { p: [], n: [], uv: null, i: [] }, RING = 2 * (NP - 1);
  B.setStations(zs);
  for (const z of zs) { const o = B.section(z); for (let k = 0; k < RING; k++) { const idx = k <= 20 ? k : RING - k, sx = k <= 20 ? 1 : -1; g.p.push(sx * o[2 * idx], o[2 * idx + 1], z); } }
  for (let i = 0; i < zs.length - 1; i++) for (let k = 0; k < RING; k++) { const k2 = (k + 1) % RING, a = i * RING + k, b = i * RING + k2, c = a + RING, d = b + RING; g.i.push(a, b, c, b, d, c); }
  return computeNormals(g);
}

// patches on the analytic surface ----------------------------------------------------------
/** f(s,t) -> [z, v] on the +X half; off = metres along the normal */
function paramPatch(B, nu, nv, f, off, uvf) {
  return gridGeo(nu, nv, (s, t) => { const [z, v] = f(s, t), p = B.pt(z, v), n = B.nrm(z, v); return { p: [p[0] + n[0] * off, p[1] + n[1] * off, p[2] + n[2] * off], n, uv: uvf ? uvf(s, t) : null }; });
}
/** f(s,t) -> [z, y] on the +X side */
const sidePatch = (B, nu, nv, f, off, uvf) => paramPatch(B, nu, nv, (s, t) => { const [z, y] = f(s, t); return [z, B.vAtY(z, y)]; }, off, uvf);
/** f(s,t) -> [x, y] projected along Z onto the nose (dir 1) or tail (dir -1) */
function projPatch(B, dir, nu, nv, f, off, uvf) {
  const g = gridGeo(nu, nv, (s, t) => { const [x, y] = f(s, t); return { p: [x, y, B.endZ(x, y, dir)], uv: uvf ? uvf(s, t) : null }; });
  orient(g, [0, 0, dir]); return offsetN(g, off);
}
const uvIn = r => (s, t) => [lerp(r[0], r[2], s), lerp(r[1], r[3], t)];
/** lamp-shaped region between two edges: x from xi to xo, bottom/top y lerped (with optional bulge) */
const lampF = (xi, xo, ybi, ybo, yti, yto, bulge = 0) => (s, t) => { const b = Math.sin(s * PI) * bulge; return [lerp(xi, xo, s), lerp(lerp(ybi, ybo, s) - b * 0.5, lerp(yti, yto, s) + b, t)]; };

// ───────────────────────── wheels ─────────────────────────
function wheelGeo({ r, w, rimF = 0.66, spokes = 5, double = false, style = 'alloy', rimK = K.rim, N = 20 }) {
  const bk = Bk(), rr = r * rimF, h = w / 2, sw = r - rr;
  put(bk, lathe([[rr + 0.006, -h + 0.03], [rr + sw * 0.35, -h + 0.005], [r - 0.045, -h], [r - 0.014, -h + 0.018], [r, -h + 0.05], [r, h - 0.05], [r - 0.014, h - 0.018], [r - 0.045, h], [rr + sw * 0.35, h - 0.005], [rr + 0.006, h - 0.03]], N), ...K.rubber);
  put(bk, lathe([[rr + 0.012, h - 0.034], [rr + 0.003, h - 0.014], [rr - 0.012, h - 0.016], [rr - 0.022, h - 0.04], [rr - 0.026, -h + 0.03]], N), ...rimK);
  if (style === 'alloy') {
    const rD = rr * 0.8;
    put(bk, lathe([[rD, h - 0.14], [rD, h - 0.1], [r * 0.16, h - 0.1]], N), ...K.disc);
    const rh = r * 0.2;
    put(bk, lathe([[rh, h - 0.1], [rh, h - 0.07], [rh * 0.75, h - 0.052], [rh * 0.3, h - 0.046], [0, h - 0.045]], 12), ...rimK);
    const r0 = rh * 0.85, r1 = rr - 0.016, len = r1 - r0, th = 0.028;
    const angs = []; for (let k = 0; k < spokes; k++) { const a = (k / spokes) * PI * 2; if (double) angs.push(a - 0.11, a + 0.11); else angs.push(a); }
    const w0 = double ? 0.013 : 0.024, w1 = double ? 0.011 : 0.017;
    for (const a of angs) {
      const sp = boxG(th, len, 1);
      for (let q = 0; q < sp.p.length; q += 3) {
        const t = (sp.p[q + 1] + len / 2) / len; // 0 at hub, 1 at rim
        sp.p[q + 2] *= 2 * lerp(w0, w1, t);
        sp.p[q] += lerp(h - 0.068, h - 0.03, t) - th / 2 + (sp.p[q] > 0 ? 0 : 0);
        sp.p[q + 1] += r0 + len / 2;
      }
      computeNormals(sp); xf(sp, { rx: a }); put(bk, sp, ...rimK);
    }
  } else {
    put(bk, lathe([[rr - 0.02, h - 0.04], [rr * 0.8, h - 0.045], [rr * 0.62, h - 0.085], [rr * 0.42, h - 0.085], [rr * 0.34, h - 0.06], [0, h - 0.06]], N), ...rimK);
    put(bk, lathe([[r * 0.13, h - 0.065], [r * 0.12, h - 0.02], [r * 0.06, h - 0.005], [0, h - 0.002]], 12), ...K.silver);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * PI * 2, nut = boxG(0.03, 0.026, 0.026); xf(nut, { x: h - 0.065, y: Math.cos(a) * rr * 0.27, z: Math.sin(a) * rr * 0.27, rx: a }); put(bk, nut, ...K.silver); }
    for (let k = 0; k < 6; k++) { const a = (k / 6) * PI * 2 + 0.3, hole = boxG(0.012, 0.05, 0.07); xf(hole, { x: h - 0.08, y: Math.cos(a) * rr * 0.52, z: Math.sin(a) * rr * 0.52, rx: a }); put(bk, hole, ...K.rubber); }
  }
  return toBG(bk);
}

// ───────────────────────── vehicle specs ─────────────────────────
// Station coordinates: z0 = tail, z1 = nose. top/bot/belt = side-view curves [z, y]. tip* = height where the nose/tail
// rounding converges; nose*/tail* = rounding lengths; plan* = plan-view corner rounding; in0/gIn0/gIn1 = inset of the
// hood shoulder / glass at the belt / roof edge from the body side.
function carSpec(o) {
  const s = Object.assign({ tumble: 0.42, pFt: 2.6, pFb: 2.6, pRt: 2.6, pRb: 2.4, pP: 2.4, cowl: 99, deck: -99, step: 0.17, crown: 0.025, sd: 0.1, tuck: 0.05, rb: 0.08 }, o);
  s.wx = s.hw - s.tw / 2 - 0.018;
  s.arches = [{ z: s.zf, R: s.wr + s.archGap, cy: s.wr + 0.012, flare: s.flareF || 0 }, { z: s.zr, R: s.wr + s.archGap, cy: s.wr + 0.012, flare: s.flareR || 0 }];
  return s;
}
const SEDAN = () => carSpec({
  L: 4.7, W: 1.8, z0: -2.35, z1: 2.35, wr: 0.325, tw: 0.205, zf: 1.38, zr: -1.32, archGap: 0.038, zA: 0.38, taperF: 0.08, zC: -0.82, taperR: 0.04,
  top: [[-2.35, 0.97], [-2.05, 1.0], [-1.62, 1.02], [-0.82, 1.40], [-0.2, 1.445], [0.38, 1.42], [1.25, 0.96], [1.85, 0.87], [2.35, 0.77]],
  bot: [[-2.35, 0.46], [-2.0, 0.30], [-1.1, 0.17], [1.0, 0.17], [1.95, 0.27], [2.35, 0.40]],
  belt: [[-2.35, 1.0], [-1.6, 1.0], [-0.7, 0.975], [0.6, 0.94], [1.25, 0.955]], cowl: 1.25, deck: -1.62,
  tipF: 0.54, noseTop: 0.3, noseBot: 0.26, tipR: 0.70, tailTop: 0.2, tailBot: 0.3,
  hw: 0.885, planF: 0.42, hwF: 0.6, planR: 0.32, hwR: 0.68, in0: 0.12, gIn0: 0.13, gIn1: 0.31, rt: 0.1, flareF: 0.01, flareR: 0.014,
  win: { v0: 10.3, v1: 12.85, side: [[0.08, 0.04, 1.06, 1.0], [-0.98, -0.74, -0.03, -0.06]], trim: [-1.02, -0.78, 1.1, 1.04], ws: [1.21, 0.42], vw: 14.9, rear: [-1.58, -0.86] },
  doors: [0.99, 0.03, -0.93], handles: [0.3, -0.62], mirror: [1.0, 0.07],
  head: { xi: 0.34, xo: 0.8, ybi: 0.645, ybo: 0.685, yti: 0.735, yto: 0.79 }, grille: { w0: 0.3, w1: 0.34, y0: 0.56, y1: 0.7 }, intake: { w: 0.52, y0: 0.29, y1: 0.41 }, plateF: 0.485, fog: [0.62, 0.74, 0.33, 0.37],
  tail: { xi: 0.42, xo: 0.83, ybi: 0.82, ybo: 0.79, yti: 0.93, yto: 0.94 }, plateR: 0.6, diffuser: { w: 0.62, y0: 0.29, y1: 0.39 }, exhaust: [[-0.45, 0.27]],
  hoodSeam: true, trunkSeam: -1.66,
});
const SUV = () => carSpec({
  L: 4.65, W: 1.86, z0: -2.325, z1: 2.325, wr: 0.37, tw: 0.235, zf: 1.42, zr: -1.32, archGap: 0.045, zA: 0.5, taperF: 0.07, step: 0.19, crown: 0.022,
  top: [[-2.325, 1.5], [-2.0, 1.585], [-1.2, 1.655], [-0.2, 1.68], [0.5, 1.67], [1.32, 1.115], [1.9, 1.03], [2.325, 0.95]],
  bot: [[-2.325, 0.58], [-1.95, 0.4], [-1.0, 0.25], [1.0, 0.25], [1.95, 0.36], [2.325, 0.52]],
  belt: [[-2.325, 1.25], [-1.7, 1.24], [-0.9, 1.19], [0.0, 1.165], [1.0, 1.13], [1.32, 1.115]], cowl: 1.32,
  tipF: 0.66, noseTop: 0.3, noseBot: 0.24, tipR: 0.9, tailTop: 0.45, tailBot: 0.26, pRt: 2.3,
  hw: 0.915, planF: 0.42, hwF: 0.62, planR: 0.3, hwR: 0.72, in0: 0.1, gIn0: 0.12, gIn1: 0.26, rt: 0.11, flareF: 0.012, flareR: 0.012, sd: 0.11,
  win: { v0: 10.3, v1: 12.85, side: [[0.1, 0.06, 1.13, 1.08], [-0.86, -0.82, -0.02, -0.05], [-1.72, -1.66, -0.96, -0.92]], trim: [-1.76, -1.70, 1.17, 1.12], ws: [1.28, 0.55], vw: 14.9,
    rearProj: { y0: 1.17, y1: 1.56, w0: 0.6, w1: 0.5 } },
  doors: [1.05, 0.04, -0.9], handles: [0.34, -0.58], mirror: [1.06, 0.08],
  head: { xi: 0.36, xo: 0.83, ybi: 0.8, ybo: 0.84, yti: 0.875, yto: 0.93 }, grille: { w0: 0.36, w1: 0.38, y0: 0.6, y1: 0.86 }, intake: { w: 0.55, y0: 0.38, y1: 0.5 }, plateF: 0.58, fog: [0.62, 0.76, 0.42, 0.47],
  tail: { xi: 0.5, xo: 0.86, ybi: 1.0, ybo: 0.98, yti: 1.1, yto: 1.15 }, plateR: 0.86, diffuser: { w: 0.72, y0: 0.38, y1: 0.5 }, exhaust: [[-0.5, 0.36]],
  cladding: true, rails: true, hoodSeam: true, darkMirror: true,
});
const SPORTS = () => carSpec({
  L: 4.45, W: 1.9, z0: -2.225, z1: 2.225, wr: 0.335, tw: 0.245, zf: 1.33, zr: -1.27, archGap: 0.035, zA: 0.25, taperF: 0.08, zC: -0.55, taperR: 0.06, step: 0.16, crown: 0.02, sd: 0.08, tuck: 0.06,
  top: [[-2.225, 0.86], [-2.0, 0.93], [-1.5, 0.965], [-0.55, 1.185], [-0.1, 1.205], [0.25, 1.19], [1.05, 0.83], [1.7, 0.72], [2.225, 0.62]],
  bot: [[-2.225, 0.38], [-1.9, 0.2], [-1.0, 0.115], [1.0, 0.115], [1.9, 0.15], [2.225, 0.22]],
  belt: [[-2.225, 0.9], [-1.5, 0.95], [-0.5, 0.875], [0.6, 0.83], [1.05, 0.835]], cowl: 1.05, deck: -1.5,
  tipF: 0.4, noseTop: 0.32, noseBot: 0.18, pFt: 2.3, tipR: 0.62, tailTop: 0.14, tailBot: 0.28, pRt: 3,
  hw: 0.93, planF: 0.5, hwF: 0.58, planR: 0.3, hwR: 0.74, in0: 0.12, gIn0: 0.17, gIn1: 0.37, rt: 0.08, flareF: 0.015, flareR: 0.035,
  win: { v0: 10.3, v1: 12.8, side: [[-0.62, -0.32, 0.86, 0.8]], trim: [-0.66, -0.36, 0.9, 0.84], ws: [1.01, 0.3], vw: 14.9, rear: [-1.46, -0.6] },
  doors: [0.84, -0.66], handles: [-0.42], mirror: [0.85, 0.05],
  head: { xi: 0.42, xo: 0.82, ybi: 0.52, ybo: 0.6, yti: 0.57, yto: 0.68 }, grille: { w0: 0.4, w1: 0.44, y0: 0.24, y1: 0.42 }, intake: null, plateF: 0.36, fog: null,
  tail: { xi: 0.36, xo: 0.86, ybi: 0.8, ybo: 0.78, yti: 0.86, yto: 0.86 }, plateR: 0.6, diffuser: { w: 0.66, y0: 0.24, y1: 0.4 }, exhaust: [[-0.32, 0.29], [0.32, 0.29]],
  spoiler: true, sideIntake: true, wheel: { spokes: 5, double: true, rimK: K.rimDark, rimF: 0.72 },
});
const VAN = () => carSpec({
  L: 4.9, W: 1.84, z0: -2.45, z1: 2.45, wr: 0.33, tw: 0.205, zf: 1.55, zr: -1.45, archGap: 0.045, zA: 1.25, taperF: 0.04, tumble: 0.2, step: 0.18, crown: 0.03, sd: 0.07, rb: 0.07,
  top: [[-2.45, 1.92], [0.0, 1.95], [1.25, 1.93], [1.95, 1.17], [2.2, 1.04], [2.45, 0.94]],
  bot: [[-2.45, 0.42], [-2.1, 0.26], [0.0, 0.2], [2.0, 0.24], [2.45, 0.38]],
  belt: [[-2.45, 1.08], [0.0, 1.06], [1.95, 1.13]], cowl: 1.95,
  tipF: 0.6, noseTop: 0.24, noseBot: 0.2, tipR: 1.05, tailTop: 0.12, tailBot: 0.12, pRt: 3.2, pRb: 3,
  hw: 0.915, planF: 0.38, hwF: 0.62, planR: 0.16, hwR: 0.82, in0: 0.08, gIn0: 0.1, gIn1: 0.17, rt: 0.12, flareF: 0.008, flareR: 0.008,
  win: { v0: 10.3, v1: 12.9, side: [[1.12, 1.08, 1.92, 1.32], [-0.05, -0.05, 1.0, 1.0], [-2.25, -2.25, -0.2, -0.2]], trim: [-2.3, -2.3, 1.96, 1.36], ws: [1.92, 1.32], vw: 14.6,
    rearProj: { y0: 1.2, y1: 1.82, w0: 0.72, w1: 0.68 } },
  doors: [1.98, 1.1, 1.06, -0.2], handles: [1.2, 0.0], mirror: [1.93, 0.1],
  head: { xi: 0.4, xo: 0.82, ybi: 0.78, ybo: 0.8, yti: 0.88, yto: 0.92 }, grille: { w0: 0.36, w1: 0.38, y0: 0.62, y1: 0.86 }, intake: { w: 0.55, y0: 0.32, y1: 0.42 }, plateF: 0.5, fog: null,
  tail: { xi: 0.7, xo: 0.86, ybi: 0.8, ybo: 0.8, yti: 1.25, yto: 1.25 }, plateR: 0.62, diffuser: { w: 0.8, y0: 0.32, y1: 0.45 }, exhaust: [[-0.55, 0.3]],
  slidingDoor: true, darkMirror: true, wheel: { spokes: 6, rimF: 0.62 },
});

// ───────────────────────── common car details ─────────────────────────
function liners(B, M) {
  const s = B.s;
  for (const a of s.arches) {
    const r = a.R - 0.008, xo = s.hw - s.tuck - 0.012, xi = s.wx - s.tw / 2 - 0.05;
    const shell = gridGeo(12, 1, (u, t) => { const an = u * PI, c = Math.cos(an), sn = Math.sin(an); return { p: [lerp(xi, xo, t), a.cy + r * sn, a.z + r * c], n: [0, -sn, -c] }; });
    const disc = gridGeo(12, 1, (u, t) => { const an = u * PI; return { p: [xi, a.cy + t * a.R * Math.sin(an), a.z + t * a.R * Math.cos(an)], n: [1, 0, 0] }; });
    const yB = Math.min(B.s.bot[0][1], ...B.s.bot.map(q => q[1])) + 0.03, rect = gridGeo(1, 1, (u, t) => ({ p: [xi, lerp(yB, a.cy, t), a.z + lerp(-a.R, a.R, u)], n: [1, 0, 0] }));
    for (const g of [shell, disc, rect]) put2(M, g, K.liner);
  }
}
function glassSet(B, w, M) {
  const side = (q, v0, v1, off, k) => {
    const nu = Math.max(3, Math.ceil(Math.max(Math.abs(q[2] - q[0]), Math.abs(q[3] - q[1])) / 0.11)), nv = Math.max(3, Math.ceil((v1 - v0) / 0.7));
    put2(M, paramPatch(B, nu, nv, (s, t) => [lerp(lerp(q[0], q[1], t), lerp(q[2], q[3], t), s), lerp(v0, v1, t)], off), k);
  };
  if (w.trim) side(w.trim, w.v0 - 0.3, w.v1 + 0.28, 0.003, K.gloss);
  for (const q of w.side || []) side(q, w.v0, w.v1, 0.0065, K.glass);
  const top = (zb, zt) => {
    const e = Math.sign(zb - zt) * 0.035, nu = Math.max(4, Math.ceil(Math.abs(zt - zb) / 0.1)), nv = Math.ceil((20 - w.vw) / 0.8);
    put2(M, paramPatch(B, nu, nv + 1, (s, t) => [lerp(zb + e, zt - e, s), lerp(w.vw - 0.5, 20, t)], 0.003), K.gloss);
    put2(M, paramPatch(B, nu, nv, (s, t) => [lerp(zb, zt, s), lerp(w.vw, 20, t)], 0.0065), K.glass);
  };
  if (w.ws) top(w.ws[0], w.ws[1]);
  if (w.rear) top(w.rear[0], w.rear[1]);
  if (w.rearProj) projGlass(B, -1, w.rearProj, M);
  if (w.frontProj) projGlass(B, 1, w.frontProj, M);
}
/** glass on the nose/tail: trapezoid half-widths w0 (bottom) / w1 (top), y0..y1, corner rounding by trimming */
function projGlass(B, dir, q, M) {
  const f = (e) => (s, t) => { const y = lerp(q.y0 - e, q.y1 + e, t), hw = lerp(q.w0, q.w1, t) + e; return [lerp(-hw, hw, s), y]; };
  const nu = Math.ceil((q.w0 + q.w1) / 0.08), nv = Math.max(4, Math.ceil((q.y1 - q.y0) / 0.1));
  put(M, projPatch(B, dir, nu, nv, f(0.04), 0.003), ...K.gloss);
  put(M, projPatch(B, dir, nu, nv, f(0), 0.0065), ...K.glass);
}
function seams(B, M) {
  const s = B.s;
  const vLine = (z, va, vb) => put2(M, paramPatch(B, 1, 6, (u, t) => [z - 0.004 + 0.008 * u, lerp(va, vb, t)], 0.0015), K.seam);
  for (const z of s.doors || []) vLine(z, 4.2, 10.15);
  if (s.hoodSeam) put2(M, paramPatch(B, 12, 1, (u, t) => [lerp(s.cowl + 0.03, s.z1 - s.noseTop + 0.04, u), 9.55 + t * 0.18], 0.0015), K.seam);
  if (s.trunkSeam) {
    put2(M, paramPatch(B, 1, 10, (u, t) => [s.trunkSeam - 0.004 + 0.008 * u, lerp(9.55, 20, t)], 0.0015), K.seam);
    put2(M, paramPatch(B, 8, 1, (u, t) => [lerp(s.z0 + s.tailTop * 0.55, s.trunkSeam, u), 9.55 + t * 0.18], 0.0015), K.seam);
  }
}
function handles(B, M, P, chrome) {
  const s = B.s;
  for (const z of s.handles || []) {
    const y = B.belt(z) - 0.075, v = B.vAtY(z, y), p = B.pt(z, v), n = B.nrm(z, v);
    const g = rbox(0.025, 0.028, 0.17, 0.011, 1); xf(g, { x: p[0] + 0.006, y: p[1], z: p[2], rz: -Math.atan2(n[1], n[0]) * 0 });
    if (chrome) put2(M, g, K.chrome); else { put(P, g); put(P, mirrorX(g)); }
    const recess = paramPatch(B, 2, 2, (u, t) => [z - 0.09 + 0.18 * u, B.vAtY(z, y - 0.022 + 0.044 * t)], 0.0012); put2(M, recess, K.trim);
  }
}
function mirrors(B, M, P, dark) {
  const s = B.s, [z, dy] = s.mirror, y = B.belt(z) + dy, v = B.vAtY(z, y), p = B.pt(z, v);
  const house = rbox(0.21, 0.125, 0.105, 0.045, 2); xf(house, { x: p[0] + 0.15, y: y + 0.02, z: z - 0.03, ry: 0.12 });
  if (dark) put2(M, house, K.gloss); else { put(P, house); put(P, mirrorX(house)); }
  const arm = boxG(0.09, 0.035, 0.07); xf(arm, { x: p[0] + 0.04, y: y - 0.01, z: z - 0.01, ry: 0.12 }); put2(M, arm, K.trim);
  const glassQ = quad([p[0] + 0.24, y - 0.025, z - 0.094], [p[0] + 0.065, y - 0.025, z - 0.073], [p[0] + 0.065, y + 0.065, z - 0.073], [p[0] + 0.24, y + 0.065, z - 0.094]);
  orient(glassQ, [0, 0, -1]); put2(M, glassQ, K.mirror);
  const rep = rbox(0.1, 0.018, 0.02, 0.008, 1); xf(rep, { x: p[0] + 0.17, y: y - 0.038, z: z + 0.022, ry: 0.12 }); return rep; // side repeater (lamp)
}
function wipers(B, M) {
  const s = B.s, zb = s.win.ws[0] - 0.06;
  for (const [x0, len, a] of [[0.06, 0.62, 0.1], [-0.6, 0.55, 0.12]]) {
    const xc = x0 + len / 2, v = 20 - (Math.abs(xc) / 0.9) * 5.5, p = B.pt(zb, v);
    const g = boxG(len, 0.014, 0.022); xf(g, { x: xc, y: p[1] + 0.022, z: zb - 0.01, rz: a * Math.sign(xc) * 0.2 }); put(M, g, ...K.trim);
  }
}
function plateBacking(B, M, s) {
  for (const [dir, y] of [[1, s.plateF], [-1, s.plateR]]) {
    if (y == null) continue;
    const z = Math.max(...[-0.24, 0, 0.24].map(x => dir * B.endZ(x, y, dir))) * dir;
    const g = rbox(0.47, 0.16, 0.028, 0.008, 1); xf(g, { y, z: z + dir * 0.0 }); put(M, g, ...K.trim);
  }
}
function frontRear(B, s, M, L) {
  // headlights: dark-chrome housing, clear lens, LED strip
  const h = s.head;
  const hf = (e) => lampF(h.xi - e, h.xo + e * 0.5, h.ybi - e, h.ybo - e, h.yti + e, h.yto + e, 0.0);
  const hous = projPatch(B, 1, 7, 3, hf(0.02), 0.004); put2(M, hous, K.housing);
  const lens = projPatch(B, 1, 7, 3, hf(0), 0.009); put2(L, lens, K.head);
  const drl = projPatch(B, 1, 7, 1, (u, t) => { const [x, y] = hf(0)(u, 0.86 + t * 0.07); return [x, y]; }, 0.0115); put2(L, drl, K.drl);
  const proj = projPatch(B, 1, 2, 2, (u, t) => [lerp(h.xi + 0.06, h.xi + 0.15, u), lerp(lerp(h.ybi, h.ybo, 0.2) + 0.012, lerp(h.yti, h.yto, 0.2) - 0.03, t)], 0.0105); put2(M, proj, K.chrome);
  // grille
  if (s.grille) {
    const g = s.grille, gf = (e) => (u, t) => { const hw = lerp(g.w0, g.w1, t) + e; return [lerp(-hw, hw, u), lerp(g.y0 - e, g.y1 + e, t)]; };
    put(M, projPatch(B, 1, 8, 3, gf(0.015), 0.003), ...K.dchrome);
    put(M, projPatch(B, 1, 8, 3, gf(0), 0.0045), ...K.grille);
    const nb = Math.round((g.y1 - g.y0) / 0.045);
    for (let k = 1; k < nb; k++) { const t = k / nb; put(M, projPatch(B, 1, 6, 1, (u, tt) => { const hw = lerp(g.w0, g.w1, t) - 0.01; return [lerp(-hw, hw, u), lerp(g.y0, g.y1, t) - 0.005 + 0.01 * tt]; }, 0.008), ...K.dchrome); }
  }
  if (s.intake) { const q = s.intake; put(M, projPatch(B, 1, 8, 2, (u, t) => [lerp(-q.w, q.w, u) * lerp(0.92, 1, t), lerp(q.y0, q.y1, t)], 0.004), ...K.grille); }
  if (s.fog) { const [x0, x1, y0, y1] = s.fog; put2(M, projPatch(B, 1, 2, 1, (u, t) => [lerp(x0 - 0.015, x1 + 0.015, u), lerp(y0 - 0.015, y1 + 0.015, t)], 0.003), K.grille); put2(L, projPatch(B, 1, 2, 1, (u, t) => [lerp(x0, x1, u), lerp(y0, y1, t)], 0.006), K.drl); }
  // tail lights: red lens with dimmer inner band, amber/reverse segment inboard
  const t = s.tail, tf = (e, a = 0, b = 1) => (u, v) => lampF(t.xi - e, t.xo + e * 0.5, t.ybi - e, t.ybo - e, t.yti + e, t.yto + e)(lerp(a, b, u), v);
  put2(M, projPatch(B, -1, 7, 3, tf(0.015), 0.004), K.housing);
  put2(L, projPatch(B, -1, 6, 3, tf(0, 0.13, 1), 0.009), K.tail);
  put2(L, projPatch(B, -1, 1, 3, tf(0, 0, 0.13), 0.009), K.rev);
  put2(L, projPatch(B, -1, 6, 1, (u, v) => tf(0, 0.25, 0.97)(u, 0.35 + v * 0.25), 0.0115), K.tailDim);
  if (s.diffuser) { const q = s.diffuser; put(M, projPatch(B, -1, 8, 2, (u, v) => [lerp(-q.w, q.w, u) * lerp(0.9, 1, v), lerp(q.y0, q.y1, v)], 0.004), ...K.plastic); }
  // rear reflectors
  const ry = (s.diffuser ? s.diffuser.y1 : 0.4) + 0.04;
  put2(L, projPatch(B, -1, 2, 1, (u, v) => [lerp(0.62, 0.74, u), lerp(ry, ry + 0.025, v)], 0.005), K.tailDim);
  for (const [x, y] of s.exhaust || []) {
    const z = B.endZ(x, y + 0.08, -1) + 0.06;
    const ex = lathe([[0.034, 0.1], [0.038, 0.0], [0.03, -0.004], [0.026, 0.1]], 12); xf(ex, { x, y, z: z + 0.02, ry: PI / 2 }); put(M, ex, ...K.dchrome);
  }
}

// ───────────────────────── passenger-car builder (sedan / suv / sports / van / taxi / police) ─────────────────────────
function buildCarFamily(type) {
  const s = type === 'suv' ? SUV() : type === 'sports' ? SPORTS() : type === 'van' ? VAN() : SEDAN();
  const B = makeBody(s), P = Bk(), M = Bk(), L = Bk(), D = Bk();
  put(P, loftGeo(B));
  liners(B, M);
  glassSet(B, s.win, M);
  seams(B, M);
  handles(B, M, P, type === 'taxi' || type === 'police' ? false : type !== 'sports');
  const rep = mirrors(B, M, P, s.darkMirror || type === 'police'); put2(L, rep, K.amber);
  if (s.win.ws) wipers(B, M);
  frontRear(B, s, M, L);
  plateBacking(B, M, s);
  // rocker / sill shadow line
  put2(M, paramPatch(B, 24, 1, (u, t) => [lerp(s.zr + s.arches[1].R + 0.02, s.zf - s.arches[0].R - 0.02, u), lerp(1, 3.2, t)], 0.002), s.cladding ? K.plastic : K.trim);
  if (s.cladding) {
    for (const a of s.arches) put2(M, paramPatch(B, 14, 2, (u, t) => { const an = u * PI, r = a.R + 0.004 + t * 0.09; const z = a.z + r * Math.cos(an), y = a.cy + r * Math.sin(an); return [z, B.vAtY(z, y)]; }, 0.004), K.plastic);
    for (const [z0, z1] of [[s.z1 - 0.6, s.z1 - s.noseBot * 0.2], [s.z0 + s.tailBot * 0.2, s.z0 + 0.55]]) put2(M, paramPatch(B, 6, 2, (u, t) => [lerp(z0, z1, u), lerp(1, 3.6, t)], 0.002), K.plastic);
    const skid = (dir, y0, y1, w) => put(M, projPatch(B, dir, 6, 1, (u, t) => [lerp(-w, w, u), lerp(y0, y1, t)], 0.006), ...K.silver);
    skid(1, 0.27, 0.33, 0.4); skid(-1, 0.34, 0.37, 0.45);
  }
  if (s.rails) {
    for (const sx of [1, -1]) {
      const z0 = -1.75, z1 = 0.3, v = 15.3, a = B.pt(z0, v), b = B.pt(z1, v), len = z1 - z0, y = B.pt((z0 + z1) / 2, v)[1] + 0.035;
      const r = rbox(0.035, 0.03, len, 0.012, 1); xf(r, { x: sx * (a[0] + b[0]) / 2, y, z: (z0 + z1) / 2 }); put(M, r, ...K.silver);
      for (const zz of [z0 + 0.06, z1 - 0.06]) { const f = rbox(0.04, 0.05, 0.12, 0.01, 1), q = B.pt(zz, v); xf(f, { x: sx * q[0], y: (y + q[1]) / 2, z: zz }); put(M, f, ...K.trim); }
    }
  }
  if (s.spoiler) {
    const z = s.z0 + 0.17, y = B.roofY(z) + 0.075;
    const wing = rbox(1.36, 0.022, 0.2, 0.01, 1); xf(wing, { y, z, rx: -0.06 }); put(M, wing, ...K.gloss);
    for (const sx of [1, -1]) { const st = boxG(0.025, 0.08, 0.08); xf(st, { x: sx * 0.48, y: y - 0.04, z: z + 0.01 }); put(M, st, ...K.gloss); }
  }
  if (s.sideIntake) put2(M, paramPatch(B, 6, 3, (u, t) => { const z = lerp(-0.62, -0.97, u); return [z, B.vAtY(z, lerp(0.52, 0.66, t) - u * 0.04)]; }, 0.003), K.grille);
  if (s.slidingDoor) {
    const yT = B.belt(0) - 0.02; // sliding door track groove on the right side only (mirrored side gets it too — fine for a van)
    put2(M, paramPatch(B, 14, 1, (u, t) => { const z = lerp(-1.1, -0.2, u); return [z, B.vAtY(z, yT - 0.006 + 0.012 * t)]; }, 0.0015), K.seam);
    put(M, projPatch(B, -1, 1, 8, (u, t) => [-0.006 + 0.012 * u, lerp(0.42, 1.88, t)], 0.002), ...K.seam);
  }

  // type-specific
  let paintOverride = null, platePool = PLATE_POOL.car;
  if (type === 'taxi') {
    platePool = PLATE_POOL.taxi;
    const rr = uvR(R.taxiDoor), band = (z0, z1, off) => (u, t) => { const z = lerp(z0, z1, u); return [z, B.belt(z) - 0.205 + t * 0.075]; };
    put2(M, sidePatch(B, 16, 1, band(1.0, -0.95), 0.0018), K.white);
    put2(D, sidePatch(B, 6, 1, band(-0.08, -0.86), 0.0035, uvIn(rr)), [[1, 1, 1], 0.4, 0], rr);
    const z = -0.3, yR = B.roofY(z);
    const box = rbox(0.74, 0.2, 0.27, 0.04, 2); xf(box, { y: yR + 0.13, z }); put(M, box, ...K.white);
    const base = boxG(0.56, 0.04, 0.2); xf(base, { y: yR + 0.015, z }); put(M, base, ...K.trim);
    const sr = uvR(R.taxiSign), y0 = yR + 0.065, y1 = yR + 0.195;
    put(D, quad([-0.33, y0, z + 0.1365], [0.33, y0, z + 0.1365], [0.33, y1, z + 0.1365], [-0.33, y1, z + 0.1365], [sr[0], sr[1], sr[2], sr[1], sr[2], sr[3], sr[0], sr[3]]));
    put(D, quad([0.33, y0, z - 0.1365], [-0.33, y0, z - 0.1365], [-0.33, y1, z - 0.1365], [0.33, y1, z - 0.1365], [sr[0], sr[1], sr[2], sr[1], sr[2], sr[3], sr[0], sr[3]]));
  }
  if (type === 'police') {
    paintOverride = 0xf2f3f4; platePool = PLATE_POOL.police;
    const rr = uvR(R.police);
    put2(M, sidePatch(B, 30, 2, (u, t) => { const z = lerp(s.z1 - 0.32, s.z0 + 0.3, u); return [z, lerp(0.715, 0.86, t)]; }, 0.0018), [[0.012, 0.06, 0.32], 0.35, 0]);
    put2(D, sidePatch(B, 8, 2, (u, t) => [lerp(0.95, 0.05, u), lerp(0.715, 0.86, t)], 0.0035, uvIn(rr)), [[1, 1, 1], 0.4, 0], rr);
    const z = -0.2, yR = B.roofY(z);
    const base = rbox(1.16, 0.06, 0.3, 0.025, 1); xf(base, { y: yR + 0.03, z }); put(M, base, ...K.trim);
    const red = rbox(0.5, 0.085, 0.25, 0.035, 1); xf(red, { x: 0.28, y: yR + 0.1, z }); put(L, red, ...K.red);
    const blue = rbox(0.5, 0.085, 0.25, 0.035, 1); xf(blue, { x: -0.28, y: yR + 0.1, z }); put(L, blue, ...K.blue);
    const mid = rbox(0.08, 0.07, 0.22, 0.02, 1); xf(mid, { y: yR + 0.095, z }); put(L, mid, ...K.drl);
  }
  return { P, M, L, D, s, B, paintOverride, platePool };
}

// ───────────────────────── city bus (11.5 m, low floor, doors on the right = −X) ─────────────────────────
function buildBus() {
  const s = carSpec({
    L: 11.5, W: 2.5, z0: -5.75, z1: 5.75, wr: 0.48, tw: 0.28, zf: 3.25, zr: -2.75, archGap: 0.07, step: 0.42, crown: 0.04, sd: 0.05, tuck: 0.02, rb: 0.06,
    top: [[-5.75, 2.88], [5.75, 2.88]], bot: [[-5.75, 0.4], [5.75, 0.33]], belt: [[-5.75, 1.12], [5.75, 1.12]],
    tipF: 1.5, noseTop: 0.3, noseBot: 0.1, pFt: 3.2, pFb: 3, tipR: 1.6, tailTop: 0.28, tailBot: 0.12, pRt: 3.2, pRb: 3,
    hw: 1.25, planF: 0.22, hwF: 1.02, planR: 0.22, hwR: 1.02, pP: 3, tumble: 0.1, in0: 0.02, gIn0: 0.025, gIn1: 0.06, rt: 0.2,
  });
  const B = makeBody(s), P = Bk(), M = Bk(), L = Bk(), D = Bk();
  put(P, loftGeo(B)); liners(B, M);
  // windscreen, destination sign, rear window
  projGlass(B, 1, { y0: 0.95, y1: 2.5, w0: 1.12, w1: 1.1 }, M);
  const sr = uvR(R.busSign);
  put(M, projPatch(B, 1, 8, 1, (u, t) => [lerp(-1.0, 1.0, u), lerp(2.55, 2.8, t)], 0.004), ...K.gloss);
  put(D, projPatch(B, 1, 8, 1, (u, t) => [lerp(-0.92, 0.92, u), lerp(2.58, 2.77, t)], 0.008, uvIn(sr)));
  projGlass(B, -1, { y0: 2.0, y1: 2.6, w0: 0.85, w1: 0.82 }, M);
  const nr = uvR(R.busNum); put(D, projPatch(B, -1, 2, 1, (u, t) => [lerp(0.3, -0.3, u), lerp(2.64, 2.8, t)], 0.008, uvIn(nr)));
  // side windows: dark band, panes with gaps; doors on −X
  const yb = 1.2, yt = 2.62, band = (sx, z0, z1, y0, y1, off, k, uv) => {
    const g = sidePatch(B, Math.max(2, Math.ceil(Math.abs(z1 - z0) / 0.4)), 4, (u, t) => [lerp(z0, z1, u), lerp(y0, y1, t)], off, uv);
    put(M, sx > 0 ? g : mirrorX(g), ...k);
  };
  const panesL = [], panesR = [];
  for (let z = -5.3; z < 4.9; z += 1.32) panesL.push([z, Math.min(z + 1.24, 4.95)]);
  const doorsR = [[4.15, 5.35], [-0.65, 0.6]];
  for (let z = -5.3; z < 4.0; z += 1.32) { let a = z, b = Math.min(z + 1.24, 4.0); for (const [d0, d1] of doorsR) { if (a < d1 + 0.1 && b > d0 - 0.1) { if (a < d0 - 0.15) panesR.push([a, d0 - 0.1]); a = d1 + 0.1; } } if (b - a > 0.3) panesR.push([a, b]); }
  band(1, -5.4, 5.4, yb - 0.05, yt + 0.06, 0.003, K.trim); band(-1, -5.4, 5.4, yb - 0.05, yt + 0.06, 0.003, K.trim);
  for (const [a, b] of panesL) band(1, a, b, yb, yt, 0.0065, K.glass);
  for (const [a, b] of panesR) band(-1, a, b, yb, yt, 0.0065, K.glass);
  for (const [d0, d1] of doorsR) {
    band(-1, d0 - 0.05, d1 + 0.05, 0.42, 2.66, 0.0035, K.silver);
    const m = (d0 + d1) / 2; band(-1, d0, m - 0.025, 0.5, 2.6, 0.0068, K.glass); band(-1, m + 0.025, d1, 0.5, 2.6, 0.0068, K.glass);
  }
  // side route board
  const br = uvR(R.busSide); put(D, mirrorX(sidePatch(B, 4, 1, (u, t) => [lerp(-1.2, 0.3, u), lerp(2.67, 2.79, t)], 0.006, uvIn(br)), br));
  // lower skirt + white belt stripe
  for (const sx of [1, -1]) { band(sx, -5.6, 5.6, 0.36, 0.5, 0.002, K.plastic); band(sx, -5.65, 5.65, 2.72, 2.86, 0.002, K.white); band(sx, -5.65, 5.65, 1.0, 1.08, 0.002, K.white); }
  // lamps, bumpers, mirrors, wipers
  put(M, projPatch(B, 1, 10, 2, (u, t) => [lerp(-1.22, 1.22, u), lerp(0.36, 0.62, t)], 0.004), ...K.plastic);
  put2(M, projPatch(B, 1, 3, 2, (u, t) => [lerp(0.66, 1.13, u), lerp(0.66, 0.86, t)], 0.005), K.housing);
  put2(L, projPatch(B, 1, 3, 2, (u, t) => [lerp(0.69, 1.1, u), lerp(0.68, 0.84, t)], 0.009), K.head);
  put2(L, projPatch(B, 1, 1, 1, (u, t) => [lerp(1.0, 1.1, u), lerp(0.7, 0.82, t)], 0.012), K.amber);
  put2(M, projPatch(B, -1, 2, 4, (u, t) => [lerp(0.86, 1.14, u), lerp(0.62, 1.5, t)], 0.004), K.housing);
  put2(L, projPatch(B, -1, 2, 4, (u, t) => [lerp(0.88, 1.12, u), lerp(0.98, 1.48, t)], 0.009), K.tail);
  put2(L, projPatch(B, -1, 2, 2, (u, t) => [lerp(0.88, 1.12, u), lerp(0.82, 0.96, t)], 0.009), K.amber);
  put2(L, projPatch(B, -1, 2, 2, (u, t) => [lerp(0.88, 1.12, u), lerp(0.64, 0.8, t)], 0.009), K.rev);
  put(M, projPatch(B, -1, 8, 3, (u, t) => [lerp(-0.7, 0.7, u), lerp(0.75, 1.65, t)], 0.004), ...K.grille);
  put(M, projPatch(B, -1, 10, 2, (u, t) => [lerp(-1.22, 1.22, u), lerp(0.38, 0.6, t)], 0.004), ...K.plastic);
  for (const sx of [1, -1]) {
    const arm = boxG(0.05, 0.05, 0.5); xf(arm, { x: sx * 1.18, y: 2.62, z: 5.85, rx: -0.4 }); put(M, arm, ...K.trim);
    const mh = rbox(0.12, 0.38, 0.12, 0.04, 1); xf(mh, { x: sx * 1.22, y: 2.25, z: 6.05 }); put(M, mh, ...K.gloss);
  }
  for (const x of [-0.55, 0.45]) { const w = boxG(0.95, 0.016, 0.03); xf(w, { x, y: 1.0, z: B.endZ(x, 1.0, 1) + 0.03, rz: x > 0 ? 0.9 : 0.75 }); put(M, w, ...K.trim); }
  // roof: AC pod and hatches
  const ac = rbox(1.85, 0.24, 3.6, 0.1, 2); xf(ac, { y: 2.92 + 0.1, z: -0.8 }); put(M, ac, ...K.white);
  for (const z of [2.5, -3.8]) { const h = rbox(0.8, 0.07, 0.8, 0.03, 1); xf(h, { y: 2.93, z }); put(M, h, ...K.plastic); }
  const s2 = { plateF: 0.5, plateR: 0.48 }; plateBacking(B, M, s2);
  return { P, M, L, D, s: Object.assign(s, s2), B, paintOverride: null, platePool: PLATE_POOL.big, wheel: { style: 'steel', rimK: K.steel, rimF: 0.6, N: 22 }, H: 3.15 };
}

// ───────────────────────── light box truck (cab-over, 6 m) ─────────────────────────
function buildTruck() {
  const s = carSpec({
    L: 1.95, W: 2.0, z0: 1.05, z1: 3.0, wr: 0.38, tw: 0.215, zf: 2.25, zr: -1.45, archGap: 0.07, step: 0.15, crown: 0.03, sd: 0.06, tuck: 0.02, rb: 0.05,
    top: [[1.05, 2.4], [2.4, 2.42], [3.0, 2.34]], bot: [[1.05, 0.58], [3.0, 0.52]], belt: [[1.05, 1.42], [3.0, 1.45]],
    tipF: 1.25, noseTop: 0.32, noseBot: 0.08, pFt: 2.5, pFb: 3, tipR: 1.5, tailTop: 0.07, tailBot: 0.05, pRt: 4, pRb: 4,
    hw: 1.0, planF: 0.2, hwF: 0.86, planR: 0.05, hwR: 0.975, pP: 2.5, tumble: 0.15, in0: 0.03, gIn0: 0.05, gIn1: 0.13, rt: 0.13,
  });
  s.arches = [s.arches[0]];
  const B = makeBody(s), P = Bk(), M = Bk(), L = Bk(), D = Bk();
  put(P, loftGeo(B)); liners(B, M);
  projGlass(B, 1, { y0: 1.5, y1: 2.22, w0: 0.88, w1: 0.8 }, M);
  glassSet(B, { v0: 10.3, v1: 12.85, side: [[1.3, 1.3, 2.62, 2.42]], trim: [1.26, 1.26, 2.66, 2.46] }, M);
  for (const z of [1.22, 2.7]) put2(M, paramPatch(B, 1, 8, (u, t) => [z - 0.004 + 0.008 * u, lerp(3, 10.15, t)], 0.0015), K.seam);
  // front: grille, lamps, bumper, step
  put(M, projPatch(B, 1, 8, 3, (u, t) => [lerp(-0.62, 0.62, u), lerp(0.98, 1.36, t)], 0.004), ...K.grille);
  put2(M, projPatch(B, 1, 3, 2, (u, t) => [lerp(0.55, 0.92, u), lerp(0.84, 1.06, t)], 0.005), K.housing);
  put2(L, projPatch(B, 1, 3, 2, (u, t) => [lerp(0.58, 0.9, u), lerp(0.86, 1.04, t)], 0.009), K.head);
  put(M, projPatch(B, 1, 10, 2, (u, t) => [lerp(-0.99, 0.99, u), lerp(0.5, 0.78, t)], 0.006), ...K.plastic);
  for (const sx of [1, -1]) {
    const st = boxG(0.3, 0.04, 0.32); xf(st, { x: sx * 0.86, y: 0.45, z: 1.5 }); put(M, st, ...K.plastic);
    const arm = boxG(0.22, 0.03, 0.03); xf(arm, { x: sx * 1.08, y: 1.95, z: 2.55 }); put(M, arm, ...K.trim);
    const mh = rbox(0.06, 0.36, 0.16, 0.02, 1); xf(mh, { x: sx * 1.2, y: 1.85, z: 2.55 }); put(M, mh, ...K.gloss);
  }
  for (const x of [-0.5, 0.35]) { const w = boxG(0.75, 0.016, 0.03); xf(w, { x, y: 1.52, z: B.endZ(x, 1.52, 1) + 0.03, rz: 0.15 }); put(M, w, ...K.trim); }
  // chassis, cargo box, guards, tank, rear bar, lamps
  for (const sx of [1, -1]) { const r = boxG(0.09, 0.2, 5.2); xf(r, { x: sx * 0.45, y: 0.72, z: -0.4 }); put(M, r, ...K.plastic); }
  const box = rbox(2.06, 1.98, 3.96, 0.035, 1); xf(box, { y: 0.98 + 0.99, z: -3.0 + 1.98 }); put(M, box, ...K.white);
  const sub = boxG(1.9, 0.12, 3.9); xf(sub, { y: 0.92, z: -1.02 }); put(M, sub, ...K.plastic);
  for (const sx of [1, -1]) for (const z of [-2.98, 0.96]) { const p = rbox(0.06, 1.98, 0.06, 0.01, 1); xf(p, { x: sx * 1.02, y: 1.97, z }); put(M, p, ...K.silver); }
  for (const y of [0.99, 2.95]) for (const sx of [1, -1]) { const r = boxG(0.04, 0.05, 3.96); xf(r, { x: sx * 1.03, y, z: -1.02 }); put(M, r, ...K.silver); }
  put(M, xf(boxG(0.012, 1.9, 0.01), { y: 1.97, z: -3.005 }), ...K.seam);
  for (const sx of [1, -1]) for (const y of [1.4, 2.5]) put(M, xf(boxG(0.06, 0.1, 0.02), { x: sx * 0.6, y, z: -3.01 }), ...K.silver);
  const tr = uvR(R.truck);
  const side = quad([1.035, 1.55, 0.55], [1.035, 1.55, -2.45], [1.035, 2.02, -2.45], [1.035, 2.02, 0.55], [tr[0], tr[1], tr[2], tr[1], tr[2], tr[3], tr[0], tr[3]]);
  put(D, side); put(D, mirrorX(side, tr));
  for (const sx of [1, -1]) {
    const g = boxG(0.04, 0.05, 1.7); xf(g, { x: sx * 0.98, y: 0.55, z: 0.95 - 1.7 / 2 - 0.15 }); put(M, g, ...K.silver);
    const mg = boxG(0.5, 0.025, 1.0); xf(mg, { x: sx * 0.78, y: 0.94, z: -1.45 }); put(M, mg, ...K.plastic);
    const flap = boxG(0.45, 0.35, 0.012); xf(flap, { x: sx * 0.78, y: 0.55, z: -2.0 }); put(M, flap, ...K.rubber);
  }
  const tank = lathe([[0.0, -0.4], [0.2, -0.4], [0.2, 0.4], [0.0, 0.4]].map(([r, x]) => [r, x]), 14); xf(tank, { x: 0.72, y: 0.55, z: -0.15, ry: PI / 2 }); put(M, tank, ...K.silver);
  const bar = boxG(1.9, 0.12, 0.08); xf(bar, { y: 0.55, z: -2.95 }); put(M, bar, ...K.plastic);
  for (const sx of [1, -1]) {
    const hq = boxG(0.36, 0.12, 0.05); xf(hq, { x: sx * 0.75, y: 0.72, z: -2.97 }); put(M, hq, ...K.housing);
    put(L, xf(boxG(0.14, 0.09, 0.02), { x: sx * 0.84, y: 0.72, z: -3.0 }), ...K.tail);
    put(L, xf(boxG(0.08, 0.09, 0.02), { x: sx * 0.71, y: 0.72, z: -3.0 }), ...K.amber);
    put(L, xf(boxG(0.06, 0.09, 0.02), { x: sx * 0.62, y: 0.72, z: -3.0 }), ...K.rev);
    put(L, xf(boxG(0.05, 0.05, 0.02), { x: sx * 1.0, y: 2.92, z: -3.01 }), ...K.amber);
  }
  const cabRear = boxG(1.9, 1.7, 0.02); xf(cabRear, { y: 1.45, z: 1.045 }); put(M, cabRear, ...K.plastic);
  const s2 = { plateF: 0.65, plateR: null };
  plateBacking(B, M, s2);
  // rear plate under the box
  const rp = quad([0.22, 0.3, -2.96], [-0.22, 0.3, -2.96], [-0.22, 0.44, -2.96], [0.22, 0.44, -2.96]);
  put(M, xf(boxG(0.47, 0.16, 0.02), { y: 0.37, z: -2.95 }), ...K.trim);
  return { P, M, L, D, s: Object.assign(s, s2), B, paintOverride: null, platePool: PLATE_POOL.big, wheel: { style: 'steel', rimK: K.white, rimF: 0.6, N: 24 }, rearW: 0.36, rearPlate: rp, L0: -3.0, L1: 3.0, H: 2.95, W: 2.06 };
}

// ───────────────────────── prototypes & public API ─────────────────────────
const PROTO = new Map();
function buildProto(type) {
  const r = type === 'bus' ? buildBus() : type === 'truck' ? buildTruck() : buildCarFamily(type);
  const s = r.s, D = r.D;
  // plates: added last so their vertices can be re-mapped per variant
  const plateStarts = [];
  if (s.plateF != null || s.plateR != null) {
    for (const [dir, y] of [[1, s.plateF], [-1, s.plateR]]) {
      if (y == null) continue;
      const z = Math.max(...[-0.22, 0, 0.22].map(x => dir * r.B.endZ(x, y, dir))) * dir + dir * 0.016;
      const g = dir > 0 ? quad([-0.22, y - 0.07, z], [0.22, y - 0.07, z], [0.22, y + 0.07, z], [-0.22, y + 0.07, z]) : quad([0.22, y - 0.07, z], [-0.22, y - 0.07, z], [-0.22, y + 0.07, z], [0.22, y + 0.07, z]);
      plateStarts.push(put(D, g));
    }
  }
  if (r.rearPlate) plateStarts.push(put(D, r.rearPlate));
  const M = mats();
  const paint = toBG(r.P, { color: false }), multi = toBG(r.M), lamp = toBG(r.L);
  const base = toBG(D, { color: false, uv: true });
  const decals = [];
  if (base) for (const k of r.platePool) {
    const g = new THREE.BufferGeometry();
    for (const a of ['position', 'normal']) g.setAttribute(a, base.attributes[a]);
    g.setIndex(base.index);
    const uv = base.attributes.uv.array.slice(), pr = plateRect(k), q = uvR(pr);
    for (const st of plateStarts) { const c = [q[0], q[1], q[2], q[1], q[2], q[3], q[0], q[3]]; for (let j = 0; j < 8; j++) uv[st * 2 + j] = c[j]; }
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.boundingSphere = base.boundingSphere; g.boundingBox = base.boundingBox;
    decals.push(g);
  }
  // wheels
  const wopt = Object.assign({ r: s.wr, w: s.tw }, r.wheel || s.wheel || {});
  const wFront = wheelGeo(wopt), wRear = r.rearW ? wheelGeo(Object.assign({}, wopt, { w: r.rearW })) : wFront;
  const bb = new THREE.Box3(); for (const g of [paint, multi, lamp]) if (g) bb.union(g.boundingBox);
  const L0 = r.L0 ?? s.z0, L1 = r.L1 ?? s.z1;
  const ud = { length: +(L1 - L0).toFixed(3), width: +(r.W ?? s.W).toFixed(3), height: +(r.H ?? bb.max.y).toFixed(3), wheelRadius: s.wr, wheelBase: +(s.zf - s.zr).toFixed(3) };
  return { paint, multi, lamp, decals, M, wFront, wRear, wx: s.wx, zf: s.zf, zr: s.zr, wr: s.wr, ud, paintOverride: r.paintOverride, center: (L0 + L1) / 2 };
}

let serial = 0;
/** the hand-coded car (also the fallback when a ready-made model is missing) */
export function buildProceduralCar(type = 'sedan', color = 0xc0392b) { return buildCar(type, color, true); }
export function buildCar(type = 'sedan', color = 0xc0392b, procedural = false) {
  if (!CAR_TYPES.includes(type)) type = 'sedan';
  if (!procedural && USE_GLB) { try { const o = buildGlbCar(type, color); if (o) return o; } catch (e) { console.warn('car model failed, using the coded one:', e); } }
  let P = PROTO.get(type); if (!P) PROTO.set(type, (P = buildProto(type)));
  const g = new THREE.Group(), M = P.M;
  const add = (geo, mat, name) => { if (!geo) return; const m = new THREE.Mesh(geo, mat); m.name = name; g.add(m); };
  add(P.paint, paintMat(P.paintOverride ?? color), 'paint');
  add(P.multi, M.multi, 'trim');
  add(P.lamp, M.lamp, 'lamps');
  if (P.decals.length) { const h = Math.imul((++serial) ^ 0x9e3779b9, 0x85ebca6b) >>> 0; add(P.decals[(h >>> 7) % P.decals.length], M.decal, 'decals'); }
  for (const [name, sx, z, geo] of [['wheel_fl', 1, P.zf, P.wFront], ['wheel_fr', -1, P.zf, P.wFront], ['wheel_rl', 1, P.zr, P.wRear], ['wheel_rr', -1, P.zr, P.wRear]]) {
    const w = new THREE.Group(); w.name = name; w.position.set(sx * P.wx, P.wr, z); w.rotation.order = 'YXZ';
    const m = new THREE.Mesh(geo, M.multi); if (sx < 0) m.scale.x = -1; w.add(m); g.add(w);
  }
  g.userData = { type, ...P.ud };
  return g;
}

// Ready-made models (assets/models/cars): loaded once before the first buildCar(); `?codemodels` in the address keeps the coded cars.
const USE_GLB = HAS_DOM && typeof location !== 'undefined' && !new URLSearchParams(location.search).has('codemodels');
if (USE_GLB) { try { await preloadGlb({ paintMat, decalMat: () => mats().decal, uvR, R, plateRect, PLATE_POOL }); } catch (e) { console.warn('car models not loaded:', e); } }
