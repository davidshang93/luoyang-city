import * as THREE from 'three';

export const hash2 = (x, z) => { let h = (Math.round(x * 3) * 73856093) ^ (Math.round(z * 3) * 19349663); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export function angLerp(a, b, t) { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; }

/** Point in polygon; poly = flat [x,z,x,z,...] */
export function pipFlat(x, z, p) {
  let c = false;
  for (let i = 0, n = p.length, j = n - 2; i < n; j = i, i += 2) {
    const az = p[i + 1], bz = p[j + 1];
    if ((az > z) !== (bz > z) && x < (p[j] - p[i]) * (z - az) / (bz - az) + p[i]) c = !c;
  }
  return c;
}

/** Uniform grid of item ids keyed by cell. */
export class Grid {
  constructor(cell) { this.cell = cell; this.map = new Map(); }
  key(gx, gz) { return gx * 65536 + gz; }
  add(x, z, v) { const k = this.key(Math.floor(x / this.cell), Math.floor(z / this.cell)); let a = this.map.get(k); if (!a) this.map.set(k, a = []); a.push(v); }
  addBox(x0, z0, x1, z1, v) { const c = this.cell; for (let gx = Math.floor(x0 / c); gx <= Math.floor(x1 / c); gx++) for (let gz = Math.floor(z0 / c); gz <= Math.floor(z1 / c); gz++) { const k = this.key(gx, gz); let a = this.map.get(k); if (!a) this.map.set(k, a = []); a.push(v); } }
  at(x, z) { return this.map.get(this.key(Math.floor(x / this.cell), Math.floor(z / this.cell))); }
  /** call fn(v) for every item in cells overlapping the box (items may repeat) */
  query(x0, z0, x1, z1, fn) { const c = this.cell; for (let gx = Math.floor(x0 / c); gx <= Math.floor(x1 / c); gx++) for (let gz = Math.floor(z0 / c); gz <= Math.floor(z1 / c); gz++) { const a = this.map.get(this.key(gx, gz)); if (a) for (let i = 0; i < a.length; i++) fn(a[i]); } }
}

/**
 * Append a flat ribbon (polyline with width) to position/uv/index arrays.
 * pts = flat [x,z,...]; u runs 0 (left) → 1 (right); v = distance / vScale.
 */
export function addRibbon(out, pts, width, y = 0, vScale = 15) {
  const n = pts.length / 2; if (n < 2) return;
  const base = out.pos.length / 3, hw = width / 2;
  let dist = 0;
  for (let i = 0; i < n; i++) {
    const x = pts[i * 2], z = pts[i * 2 + 1];
    let dx0 = 0, dz0 = 0, dx1 = 0, dz1 = 0;
    if (i > 0) { dx0 = x - pts[i * 2 - 2]; dz0 = z - pts[i * 2 - 1]; const l = Math.hypot(dx0, dz0) || 1; dx0 /= l; dz0 /= l; dist += l; }
    if (i < n - 1) { dx1 = pts[i * 2 + 2] - x; dz1 = pts[i * 2 + 3] - z; const l = Math.hypot(dx1, dz1) || 1; dx1 /= l; dz1 /= l; }
    if (i === 0) { dx0 = dx1; dz0 = dz1; } if (i === n - 1) { dx1 = dx0; dz1 = dz0; }
    let tx = dx0 + dx1, tz = dz0 + dz1; const tl = Math.hypot(tx, tz);
    if (tl < 1e-4) { tx = dx1; tz = dz1; } else { tx /= tl; tz /= tl; }
    // right-hand normal (travel east → right is south) and miter scale
    const rx = -tz, rz = tx;
    const cos = clamp(tx * dx1 + tz * dz1, 0.5, 1), m = hw / cos;
    out.pos.push(x - rx * m, y, z - rz * m, x + rx * m, y, z + rz * m);
    out.uv.push(0, dist / vScale, 1, dist / vScale);
    if (i > 0) { const a = base + (i - 1) * 2; out.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
}

export function ribbonMesh(out, material, renderOrder = 0) {
  const g = new THREE.BufferGeometry(), n = out.pos.length / 3;
  g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2));
  // uv1 = world metres / 4: lets detail maps (asphalt / concrete normal + roughness, texture.channel = 1) tile at real scale
  const uv1 = new Float32Array(n * 2); for (let i = 0; i < n; i++) { uv1[i * 2] = out.pos[i * 3] / 4; uv1[i * 2 + 1] = out.pos[i * 3 + 2] / 4; }
  g.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
  let nrm; if (out.nrm) nrm = Float32Array.from(out.nrm); else { nrm = new Float32Array(out.pos.length); for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1; }
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(out.idx, 1) : new THREE.Uint16BufferAttribute(out.idx, 1));
  const m = new THREE.Mesh(g, material); m.renderOrder = renderOrder; m.receiveShadow = true; m.matrixAutoUpdate = false;
  return m;
}
export const newOut = () => ({ pos: [], uv: [], idx: [] });

/** Material for ground decals: drawn right after the ground in renderOrder, never z-fights. PBR so it takes the sky light. */
export function decalMat(params) {
  return new THREE.MeshStandardMaterial({ depthTest: false, depthWrite: false, roughness: 0.92, metalness: 0, ...params });
}

/**
 * Like addRibbon but between two lateral offsets (metres, + = right of travel): u = 0 at o0, 1 at o1. Faces up whichever way
 * round the offsets are. keep (optional): array/function of per-segment flags — segments with a falsy flag are skipped.
 */
export function addStrip(out, pts, o0, o1, y = 0, vScale = 15, keep = null) {
  const n = pts.length / 2; if (n < 2) return;
  const base = out.pos.length / 3, flip = o1 < o0; let dist = 0;
  for (let i = 0; i < n; i++) {
    const x = pts[i * 2], z = pts[i * 2 + 1];
    let dx0 = 0, dz0 = 0, dx1 = 0, dz1 = 0;
    if (i > 0) { dx0 = x - pts[i * 2 - 2]; dz0 = z - pts[i * 2 - 1]; const l = Math.hypot(dx0, dz0) || 1; dx0 /= l; dz0 /= l; dist += l; }
    if (i < n - 1) { dx1 = pts[i * 2 + 2] - x; dz1 = pts[i * 2 + 3] - z; const l = Math.hypot(dx1, dz1) || 1; dx1 /= l; dz1 /= l; }
    if (i === 0) { dx0 = dx1; dz0 = dz1; } if (i === n - 1) { dx1 = dx0; dz1 = dz0; }
    let tx = dx0 + dx1, tz = dz0 + dz1; const tl = Math.hypot(tx, tz);
    if (tl < 1e-4) { tx = dx1; tz = dz1; } else { tx /= tl; tz /= tl; }
    const rx = -tz, rz = tx, m = 1 / clamp(tx * dx1 + tz * dz1, 0.5, 1);
    out.pos.push(x + rx * o0 * m, y, z + rz * o0 * m, x + rx * o1 * m, y, z + rz * o1 * m);
    out.uv.push(0, dist / vScale, 1, dist / vScale);
    if (i > 0 && (!keep || (typeof keep === 'function' ? keep(i - 1) : keep[i - 1]))) { const a = base + (i - 1) * 2; if (flip) out.idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); else out.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
}

export function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Sample a flat polyline by distance. Returns helper with len and at(s, outVec2) → heading. */
export function makePath(pts) {
  const n = pts.length / 2, cum = new Float32Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
  return {
    pts, cum, len: cum[n - 1],
    at(s, o) {
      s = clamp(s, 0, cum[n - 1]);
      let lo = 0, hi = n - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid; }
      const t = (s - cum[lo]) / ((cum[hi] - cum[lo]) || 1), ax = pts[lo * 2], az = pts[lo * 2 + 1], bx = pts[hi * 2], bz = pts[hi * 2 + 1];
      o.x = ax + (bx - ax) * t; o.z = az + (bz - az) * t; o.h = Math.atan2(bx - ax, bz - az);
      return o;
    },
  };
}
