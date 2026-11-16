// Geometry batcher: collects quads / oriented boxes / prisms into one indexed BufferGeometry (position, normal, uv, color [, layer]).
import * as THREE from 'three';

export class Batch {
  constructor(withLayer = false) { this.p = []; this.n = []; this.u = []; this.c = []; this.i = []; this.l = withLayer ? [] : null; this.v = 0; }
  get empty() { return this.v === 0; }
  /** quad a→b→c→d counter-clockwise seen from outside; uv: a=(u0,v0) b=(u1,v0) c=(u1,v1) d=(u0,v1) */
  quad(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, nx, ny, nz, r, g, b, u0 = 0, v0 = 0, u1 = 1, v1 = 1, lay = 0) {
    const o = this.v; this.p.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz); this.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz, nx, ny, nz);
    this.c.push(r, g, b, r, g, b, r, g, b, r, g, b); this.u.push(u0, v0, u1, v0, u1, v1, u0, v1); this.i.push(o, o + 1, o + 2, o, o + 2, o + 3);
    if (this.l) this.l.push(lay, lay, lay, lay); this.v += 4;
  }
  /** triangle, flat normal computed from the winding (flipped if it would point down and up=true) */
  tri(ax, ay, az, bx, by, bz, cx, cy, cz, r, g, b, tile = 3, lay = 0) {
    let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay), ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az), nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
    const o = this.v; this.p.push(ax, ay, az, bx, by, bz, cx, cy, cz); this.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz); this.c.push(r, g, b, r, g, b, r, g, b);
    this.u.push(ax / tile, az / tile, bx / tile, bz / tile, cx / tile, cz / tile); this.i.push(o, o + 1, o + 2); if (this.l) this.l.push(lay, lay, lay); this.v += 3;
  }
  /**
   * Box in an edge frame: origin (ox,oz), unit axis U=(ux,uz) along the edge, outward axis N=(uz,-ux).
   * Spans s0..s1 along U, o0..o1 along N, y0..y1. faces: bit 1 front(+N) 2 back 4 left(s0) 8 right(s1) 16 top 32 bottom. tile = metres per UV unit.
   */
  ebox(ox, oz, ux, uz, s0, s1, o0, o1, y0, y1, r, g, b, faces = 29, tile = 3) {
    const nx = uz, nz = -ux;
    const x00 = ox + ux * s0 + nx * o0, z00 = oz + uz * s0 + nz * o0, x10 = ox + ux * s1 + nx * o0, z10 = oz + uz * s1 + nz * o0;
    const x01 = ox + ux * s0 + nx * o1, z01 = oz + uz * s0 + nz * o1, x11 = ox + ux * s1 + nx * o1, z11 = oz + uz * s1 + nz * o1;
    const us0 = s0 / tile, us1 = s1 / tile, uo0 = o0 / tile, uo1 = o1 / tile, v0 = y0 / tile, v1 = y1 / tile;
    if (faces & 1) this.quad(x11, y0, z11, x01, y0, z01, x01, y1, z01, x11, y1, z11, nx, 0, nz, r, g, b, us1, v0, us0, v1);
    if (faces & 2) this.quad(x00, y0, z00, x10, y0, z10, x10, y1, z10, x00, y1, z00, -nx, 0, -nz, r, g, b, us0, v0, us1, v1);
    if (faces & 4) this.quad(x01, y0, z01, x00, y0, z00, x00, y1, z00, x01, y1, z01, -ux, 0, -uz, r, g, b, uo1, v0, uo0, v1);
    if (faces & 8) this.quad(x10, y0, z10, x11, y0, z11, x11, y1, z11, x10, y1, z10, ux, 0, uz, r, g, b, uo0, v0, uo1, v1);
    if (faces & 16) this.quad(x00, y1, z00, x10, y1, z10, x11, y1, z11, x01, y1, z01, 0, 1, 0, r, g, b, us0, uo0, us1, uo1);
    if (faces & 32) this.quad(x01, y0, z01, x11, y0, z11, x10, y0, z10, x00, y0, z00, 0, -1, 0, r, g, b, us0, uo1, us1, uo0);
  }
  /** upright n-sided prism (tank, post) with a flat top */
  prism(cx, cz, rad, y0, y1, sides, r, g, b) {
    for (let k = 0; k < sides; k++) {
      const a0 = k / sides * 6.2832, a1 = (k + 1) / sides * 6.2832, am = (a0 + a1) / 2;
      const x0 = cx + Math.cos(a0) * rad, z0 = cz + Math.sin(a0) * rad, x1 = cx + Math.cos(a1) * rad, z1 = cz + Math.sin(a1) * rad;
      this.quad(x1, y0, z1, x0, y0, z0, x0, y1, z0, x1, y1, z1, Math.cos(am), 0, Math.sin(am), r, g, b, 0, 0, 1, 1);
      this.tri(cx, y1, cz, x1, y1, z1, x0, y1, z0, r, g, b);
    }
  }
  /** horizontal polygon (flat [x,z,...]) at height y facing up; tris = index triples into the polygon */
  poly(flat, tris, y, r, g, b, tile = 3, lay = 0) {
    const o = this.v, n = flat.length / 2;
    for (let k = 0; k < n; k++) { this.p.push(flat[k * 2], y, flat[k * 2 + 1]); this.n.push(0, 1, 0); this.c.push(r, g, b); this.u.push(flat[k * 2] / tile, flat[k * 2 + 1] / tile); if (this.l) this.l.push(lay); }
    for (const t of tris) this.i.push(o + t[0], o + t[1], o + t[2]);
    this.v += n;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    if (this.l) g.setAttribute('layer', new THREE.Float32BufferAttribute(this.l, 1));
    g.setIndex(this.v > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    return g;
  }
  mesh(material, shadow = true) {
    if (!this.v) return null;
    const m = new THREE.Mesh(this.geometry(), material); m.castShadow = shadow; m.receiveShadow = true; m.matrixAutoUpdate = false; return m;
  }
}

/** Triangulate a flat [x,z,...] polygon → index triples wound so the face points up (+Y). */
export function triangulate(flat) {
  const c = []; for (let i = 0; i < flat.length; i += 2) c.push(new THREE.Vector2(flat[i], flat[i + 1]));
  let faces; try { faces = THREE.ShapeUtils.triangulateShape(c, []); } catch { return []; }
  for (const f of faces) { const A = c[f[0]], B = c[f[1]], C = c[f[2]]; if ((B.y - A.y) * (C.x - A.x) - (B.x - A.x) * (C.y - A.y) < 0) { const t = f[1]; f[1] = f[2]; f[2] = t; } }
  return faces;
}

/** Offset a counter-clockwise footprint (outward normal of edge = (dz,-dx)) inward by t metres (negative = outward). */
export function insetPoly(p, t) {
  const n = p.length / 2, out = new Array(p.length);
  for (let i = 0; i < n; i++) {
    const a = (i + n - 1) % n, b = (i + 1) % n;
    let e0x = p[i * 2] - p[a * 2], e0z = p[i * 2 + 1] - p[a * 2 + 1], e1x = p[b * 2] - p[i * 2], e1z = p[b * 2 + 1] - p[i * 2 + 1];
    const l0 = Math.hypot(e0x, e0z) || 1, l1 = Math.hypot(e1x, e1z) || 1; e0x /= l0; e0z /= l0; e1x /= l1; e1z /= l1;
    // inward normals = (-dz, dx)
    let mx = -e0z - e1z, mz = e0x + e1x; const d = 1 + (e0x * e1x + e0z * e1z), k = d > 0.25 ? t / d : t * 2;
    out[i * 2] = p[i * 2] + mx * k; out[i * 2 + 1] = p[i * 2 + 1] + mz * k;
  }
  return out;
}
export function polyArea(p) { let a = 0; for (let i = 0, n = p.length, j = n - 2; i < n; j = i, i += 2) a += p[j] * p[i + 1] - p[i] * p[j + 1]; return Math.abs(a) / 2; }
