// Trees and street furniture (v3 look), generated lazily per 500 m cell from the road network and green areas.
//  • Trees: four species — 法桐 plane tree (main streets), 国槐 locust (smaller streets), 柳 willow (near water), 松柏 cypress/pine
//    (parks, temples) — grown with ez-tree (see trees.js). Three levels of detail, switched per tree in the vertex shader by
//    distance to the focus point, so nothing pops while the pools are refilled:
//      < 60 m full tree · 60–250 m trunk + main limbs + thinned leaves · beyond that two crossed billboards baked from the same trees.
//  • Street furniture, instanced: street lamps (glow at night), traffic lights at big junctions, bus shelters, bins, benches.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Grid, hash2, pipFlat } from '../core/util.js';
import { glow } from '../core/mats.js';
import { growTrees, bakeImpostors } from './trees.js';

const CELL = 500, NEAR_R = 250, L0_R = 60, POOL0 = 420, POOL1 = 2600, STEP_TREE = 14, STEP_LAMP = 36;
let SP = [];   // per species { h, w } at scale 1 (filled from trees.js)

function colored(geo, hex) { const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo; }

// ── street furniture geometry (vertex-coloured, one draw call per kind) ──
function part(geo, hex, x = 0, y = 0, z = 0) { const g = geo.index ? geo.toNonIndexed() : geo; g.deleteAttribute('uv'); g.translate(x, y, z); return colored(g, hex); }
const bx = (w, h, d, hex, x, y, z) => part(new THREE.BoxGeometry(w, h, d), hex, x, y + h / 2, z);
function furniture() {
  const D = 0x2c3035, M = 0x9aa0a6;
  const lamp = mergeGeometries([part(new THREE.CylinderGeometry(0.07, 0.12, 9.2, 8), D, 0, 4.6, 0), part(new THREE.CylinderGeometry(0.16, 0.18, 0.9, 8), D, 0, 0.45, 0), bx(2.9, 0.09, 0.12, D, 1.4, 9.1, 0), bx(1.0, 0.13, 0.36, D, 2.6, 8.98, 0), bx(0.5, 0.06, 0.1, D, 0.25, 8.75, 0)]);
  const lampGlow = part(new THREE.BoxGeometry(0.8, 0.05, 0.28), 0xffffff, 2.6, 8.94, 0);
  // traffic light: mast at the kerb, arm over the road (local +X), heads face local +Z
  const sig = mergeGeometries([part(new THREE.CylinderGeometry(0.1, 0.14, 6.6, 8), D, 0, 3.3, 0), bx(6.2, 0.16, 0.16, D, 3.1, 6.3, 0), bx(1.35, 0.5, 0.3, D, 5.2, 5.75, -0.05), bx(0.36, 1.1, 0.28, D, 0, 2.6, -0.2), bx(0.9, 0.5, 0.06, 0x1f4fa8, 2.4, 6.5, 0)]);
  const disc = (hex, x, y, z) => { const g = new THREE.CircleGeometry(0.15, 10); g.rotateY(Math.PI); return part(g, hex, x, y, -z); };   // heads face local -Z (towards approaching traffic)
  const sigLit = mergeGeometries([disc(0x551111, 4.8, 6.0, 0.21), disc(0x554411, 5.2, 6.0, 0.21), disc(0x22ff66, 5.6, 6.0, 0.21), disc(0x551111, 0, 3.45, 0.35), disc(0x554411, 0, 3.15, 0.35), disc(0x22ff66, 0, 2.85, 0.35)]);
  const bin = mergeGeometries([bx(0.5, 0.85, 0.42, 0x2f6b45, -0.28, 0.1, 0), bx(0.5, 0.85, 0.42, 0x4a6a8a, 0.28, 0.1, 0), bx(1.14, 0.06, 0.5, M, 0, 0.95, 0), bx(0.06, 0.1, 0.06, D, -0.5, 0, 0), bx(0.06, 0.1, 0.06, D, 0.5, 0, 0)]);
  const bench = mergeGeometries([bx(1.8, 0.06, 0.5, 0x7a5232, 0, 0.42, 0), bx(1.8, 0.4, 0.05, 0x7a5232, 0, 0.6, -0.25), bx(0.07, 0.42, 0.5, D, -0.8, 0, 0), bx(0.07, 0.42, 0.5, D, 0.8, 0, 0)]);
  const shelter = mergeGeometries([bx(7.2, 0.14, 2.1, D, 0, 2.7, 0), bx(0.12, 2.7, 0.12, M, -3.3, 0, -0.85), bx(0.12, 2.7, 0.12, M, 3.3, 0, -0.85), bx(6.5, 1.9, 0.05, 0x6f8a98, 0, 0.5, -0.9), bx(3.4, 0.08, 0.5, M, -1.2, 0.5, -0.45), bx(1.5, 2.1, 0.12, 0x8a1a14, 2.4, 0.45, -0.72), bx(1.3, 1.9, 0.02, 0xe8d9a8, 2.4, 0.55, -0.65), bx(0.1, 3.2, 0.1, M, 4.2, 0, 0), bx(0.6, 0.6, 0.06, 0x1f4fa8, 4.2, 2.6, 0)]);
  return { lamp, lampGlow, sig, sigLit, bin, bench, shelter };
}

export class Props {
  constructor(scene, roads, areas, landmarks, buildings) {
    this.roads = roads; this.areas = areas; this.landmarks = landmarks; this.buildings = buildings;
    this.group = new THREE.Group(); this.group.name = 'props'; scene.add(this.group);
    this.cells = new Map(); this.count = 0;
    // indexes: which ways / green polygons / junctions touch each 500 m cell
    this.wayGrid = new Grid(CELL); roads.ways.forEach((w, wi) => { if (w.cls > 4 || w.bridge || w.tunnel) return; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let i = 0; i < w.n; i++) { x0 = Math.min(x0, w.pts[i * 2]); x1 = Math.max(x1, w.pts[i * 2]); z0 = Math.min(z0, w.pts[i * 2 + 1]); z1 = Math.max(z1, w.pts[i * 2 + 1]); } this.wayGrid.addBox(x0 - 8, z0 - 8, x1 + 8, z1 + 8, wi); });
    this.greenGrid = new Grid(CELL); areas.green.forEach(([kind, poly], gi) => { if (kind > 1) return; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let k = 0; k < poly.length; k += 2) { x0 = Math.min(x0, poly[k]); x1 = Math.max(x1, poly[k]); z0 = Math.min(z0, poly[k + 1]); z1 = Math.max(z1, poly[k + 1]); } this.greenGrid.addBox(x0, z0, x1, z1, gi); });
    this.juncGrid = new Grid(CELL); for (const j of roads.jmap.values()) this.juncGrid.add(j.x, j.z, j);

    // shared LOD uniforms + shader patch: an instance is drawn only while its distance to the focus point is inside [lo, hi)
    const U = this.U = { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 } };
    const clip = (m, lo, hi, opt = {}) => { const range = { value: new THREE.Vector2(lo, hi) }; m.onBeforeCompile = (sh) => { sh.uniforms.uCam = U.uCam; sh.uniforms.uRange = range; sh.uniforms.uTime = U.uTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform vec3 uCam;\nuniform vec2 uRange;\nuniform float uTime;' + (opt.atlas ? '\nattribute float aSp;' : ''))
        .replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 iOrg = modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ); float iD = distance( iOrg.xz, uCam.xz ); if ( iD < uRange.x || iD >= uRange.y ) gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); }');
      // leaves sway a few centimetres, more towards the top
      if (opt.sway) sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n{ float ph = uTime * 1.3 + instanceMatrix[ 3 ].x * 0.37 + instanceMatrix[ 3 ].z * 0.23 + position.y * 0.4; transformed.x += sin( ph ) * 0.005 * position.y; transformed.z += cos( ph * 0.8 + position.x ) * 0.004 * position.y; }');
      if (opt.atlas) sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv.x = ( vMapUv.x + aSp ) / ${SP.length.toFixed(1)};\n#endif`);
      if (opt.ball) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n#ifdef DOUBLE_SIDED\nnormal *= faceDirection;\n#endif'); };
      m.customProgramCacheKey = () => 'tree' + (opt.atlas ? 'A' : '') + (opt.sway ? 'S' : '') + (opt.ball ? 'B' : '');
      return m; };

    const kinds = this.kinds = growTrees(); SP = kinds.map(k => ({ h: k.h, w: k.w }));
    // far billboards (the atlas is baked from the real trees in init())
    this.impMat = clip(new THREE.MeshStandardMaterial({ alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1, metalness: 0, envMapIntensity: 0.6 }), NEAR_R, 1e9, { atlas: true, ball: true });
    { const a = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), b = a.clone().rotateY(Math.PI / 2), g = mergeGeometries([a, b]), n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); this.impGeo = g; }

    // near pools: per species × variant × level of detail, one trunk mesh + one leaf mesh sharing their instance matrices
    this.pool = [];
    kinds.forEach((k, ki) => {
      const mats = [[0, L0_R], [L0_R, NEAR_R]].map(([lo, hi]) => ({
        bark: clip(new THREE.MeshStandardMaterial({ map: k.barkMap, normalMap: k.barkNormal, color: k.barkTint, roughness: 0.95, metalness: 0 }), lo, hi),
        leaf: clip(new THREE.MeshStandardMaterial({ map: k.leafMap, color: k.leafTint, alphaTest: k.alphaTest, side: THREE.DoubleSide, roughness: 0.78, metalness: 0, envMapIntensity: 0.55 }), lo, hi, { sway: true, ball: true }),
        depth: clip(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: k.leafMap, alphaTest: k.alphaTest }), lo, hi),
      }));
      k.variants.forEach((v, vi) => [0, 1].forEach((lod) => {
        const cap = lod ? POOL1 : POOL0, trunk = new THREE.InstancedMesh(lod ? v.bark1 : v.bark0, mats[lod].bark, cap), leaves = new THREE.InstancedMesh(lod ? v.leaves1 : v.leaves0, mats[lod].leaf, cap);
        leaves.instanceMatrix = trunk.instanceMatrix; leaves.customDepthMaterial = mats[lod].depth;
        for (const m of [trunk, leaves]) { m.count = 0; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.matrixAutoUpdate = false; this.group.add(m); }
        this.pool.push({ ki, vi, lod, cap, trunk, leaves });
      }));
    });
    this.poolAt = [1e9, 1e9];

    const F = furniture();
    this.F = F;
    this.matF = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.35 });
    this.matLampGlow = glow(new THREE.MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xffdf9a, roughness: 0.4 }), 0.2, 9);
    this.matSigLit = new THREE.MeshBasicMaterial({ vertexColors: true });
  }

  /** tree and furniture positions for one cell (deterministic) */
  _generate(cell) {
    const { roads, areas, landmarks, buildings } = this, x0 = cell.gx * CELL, z0 = cell.gz * CELL, x1 = x0 + CELL, z1 = z0 + CELL;
    const inside = (x, z) => x >= x0 && x < x1 && z >= z0 && z < z1;
    const trees = [], lamps = [], bins = [], benches = [], shelters = [], sigs = [];
    const free = (x, z) => !(landmarks.at(x, z, 2) || areas.inWater(x, z) || buildings.hit(x, z) || roads.onRoad(x, z, 0.3));
    const species = (x, z, base) => {
      if (areas.inWater(x + 22, z) || areas.inWater(x - 22, z) || areas.inWater(x, z + 22) || areas.inWater(x, z - 22)) return hash2(x + 3, z) < 0.75 ? 2 : base;
      const lm = landmarks.at(x, z, 120); if (lm && lm.cat === '古迹' && hash2(z, x + 1) < 0.6) return 3;
      return base;
    };
    const ways = new Set(); this.wayGrid.query(x0, z0, x1 - 1, z1 - 1, (wi) => ways.add(wi));
    for (const wi of ways) {
      const w = roads.ways[wi], p = w.pts, e = w.w / 2, street = w.cls >= 2;
      const walk = (step, phase, fn) => { let acc = step * phase; for (let i = 0; i < w.n - 1; i++) { const ax = p[i * 2], az = p[i * 2 + 1], dx = p[i * 2 + 2] - ax, dz = p[i * 2 + 3] - az, L = Math.hypot(dx, dz); if (L < 1) continue; const ux = dx / L, uz = dz / L; for (; acc < L; acc += step) { if ((i === 0 && acc < 12) || (i === w.n - 2 && L - acc < 12)) continue; fn(ax + ux * acc, az + uz * acc, ux, uz); } acc -= L; } };
      const ph = hash2(p[0], p[1]);
      if (street) walk(STEP_TREE, ph, (x, z, ux, uz) => {
        for (const sd of [1, -1]) { const tx = x - uz * (e + 1.5) * sd, tz = z + ux * (e + 1.5) * sd; if (!inside(tx, tz) || hash2(tx, tz) < 0.12 || !free(tx, tz)) continue; trees.push(tx, tz, 0.72 + hash2(tz, tx) * 0.4, species(tx, tz, w.cls <= 3 ? 0 : 1)); }
      });
      let k = 0;
      walk(STEP_LAMP, ph * 0.7, (x, z, ux, uz) => { const sd = (k++ % 2) ? 1 : -1, lx = x - uz * (e + 0.85) * sd, lz = z + ux * (e + 0.85) * sd; if (inside(lx, lz) && !roads.onRoad(lx, lz, 0.2) && !buildings.hit(lx, lz)) lamps.push(lx, lz, 0); });
      if (street) {
        walk(74, ph * 0.31, (x, z, ux, uz) => { const sd = hash2(x, z) < 0.5 ? 1 : -1, bx2 = x - uz * (e + 2.3) * sd, bz2 = z + ux * (e + 2.3) * sd; if (inside(bx2, bz2) && free(bx2, bz2)) (hash2(z, x) < 0.6 ? bins : benches).push(bx2, bz2, Math.atan2(uz * sd, -ux * sd)); });
        if (w.cls <= 3) walk(430, ph * 0.53, (x, z, ux, uz) => { for (const sd of [1, -1]) { const sx = x - uz * (e + 1.9) * sd, sz = z + ux * (e + 1.9) * sd; if (inside(sx, sz) && free(sx, sz) && !roads.onRoad(sx - uz * sd * 2, sz + ux * sd * 2, 0.3)) shelters.push(sx, sz, Math.atan2(uz * sd, -ux * sd)); } });
      }
    }
    // lamp heading above is easier to get right explicitly: arm (local +X) must point from the kerb towards the road
    for (let i = 0; i < lamps.length; i += 3) { const r = roads.nearest(lamps[i], lamps[i + 1], 40, 4); if (r) lamps[i + 2] = Math.atan2(-(r.z - lamps[i + 1]), r.x - lamps[i]); }
    // traffic lights at junctions of two real streets
    this.juncGrid.query(x0, z0, x1 - 1, z1 - 1, (j) => {
      if (!inside(j.x, j.z) || j.maxW < 12 || j.done === cell) return; j.done = cell;
      const arms = []; for (let i = 0; i < j.a.length; i += 2) { const w = roads.ways[j.a[i]], pi = j.a[i + 1]; if (w.cls > 4 || w.bridge || w.tunnel) continue; for (const d of [-1, 1]) { const q = pi + d; if (q < 0 || q >= w.n) continue; const dx = w.pts[q * 2] - j.x, dz = w.pts[q * 2 + 1] - j.z, L = Math.hypot(dx, dz); if (L > 14) arms.push([dx / L, dz / L, w.w]); } }
      if (arms.length < 3) return;
      const big = arms.filter(a => a[2] >= 10).length; if (big < 2) return;
      for (const [dx, dz, ww] of arms) { if (ww < 8) continue; const c = j.maxW / 2 + 2.4, rx = dz, rz = -dx, x = j.x + dx * c + rx * (ww / 2 + 0.9), z = j.z + dz * c + rz * (ww / 2 + 0.9); sigs.push(x, z, Math.atan2(-(-rz), -rx)); }   // arm (local +X) points across the road (-r); heads on local -Z face the approaching traffic (+d)
    });
    // parks & woods
    const greens = new Set(); this.greenGrid.query(x0, z0, x1 - 1, z1 - 1, (gi) => greens.add(gi));
    let budget = 1600;
    for (const gi of greens) {
      const [kind, poly] = areas.green[gi], step = kind === 1 ? 13 : 20;
      for (let x = Math.ceil(x0 / step) * step + step / 2; x < x1 && budget > 0; x += step) for (let z = Math.ceil(z0 / step) * step + step / 2; z < z1; z += step) {
        const jx = x + (hash2(x, z) - 0.5) * step * 0.8, jz = z + (hash2(z, x) - 0.5) * step * 0.8;
        if (!inside(jx, jz) || hash2(jx + 5, jz) < 0.25 || !pipFlat(jx, jz, poly) || !free(jx, jz) || roads.onRoad(jx, jz, 3)) continue;
        const h = hash2(jz + 2, jx); trees.push(jx, jz, 0.7 + hash2(jz, jx) * 0.6, species(jx, jz, h < (kind === 1 ? 0.4 : 0.22) ? 3 : h < 0.62 ? 1 : 0)); budget--;
      }
    }
    return { trees, lamps, bins, benches, shelters, sigs };
  }

  _buildCell(cell) {
    const d = this._generate(cell), g = cell.obj = new THREE.Group(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    cell.trees = Float32Array.from(d.trees); const n = cell.trees.length / 4; this.count += n;
    if (n) {
      const geo = this.impGeo.clone(), sp = new Float32Array(n), im = new THREE.InstancedMesh(geo, this.impMat, n);
      for (let i = 0; i < n; i++) { const x = cell.trees[i * 4], z = cell.trees[i * 4 + 1], s = cell.trees[i * 4 + 2], k = cell.trees[i * 4 + 3]; sp[i] = k; q.setFromAxisAngle(up, hash2(x, z) * 6.28); sc.set(SP[k].w * s, SP[k].h * s, SP[k].w * s); ps.set(x, 0, z); im.setMatrixAt(i, m4.compose(ps, q, sc)); const v = 0.85 + hash2(x + 9, z + 4) * 0.3; col.setRGB(v, v, v * 0.94); im.setColorAt(i, col); }
      geo.setAttribute('aSp', new THREE.InstancedBufferAttribute(sp, 1)); im.frustumCulled = false; im.matrixAutoUpdate = false; g.add(im); cell.imp = im;
    }
    const inst = (geo, mat, list, shadow, y = 0) => { const c = list.length / 3; if (!c) return null; const im = new THREE.InstancedMesh(geo, mat, c); for (let i = 0; i < c; i++) { q.setFromAxisAngle(up, list[i * 3 + 2]); ps.set(list[i * 3], y, list[i * 3 + 1]); sc.set(1, 1, 1); im.setMatrixAt(i, m4.compose(ps, q, sc)); } im.castShadow = shadow; im.receiveShadow = true; im.frustumCulled = false; im.matrixAutoUpdate = false; g.add(im); return im; };
    cell.near = [inst(this.F.lamp, this.matF, d.lamps, true, 0.16), inst(this.F.lampGlow, this.matLampGlow, d.lamps, false, 0.16), inst(this.F.sig, this.matF, d.sigs, true, 0.16), inst(this.F.sigLit, this.matSigLit, d.sigs, false, 0.16), inst(this.F.bin, this.matF, d.bins, true), inst(this.F.bench, this.matF, d.benches, true), inst(this.F.shelter, this.matF, d.shelters, true)].filter(Boolean);
    g.matrixAutoUpdate = false; this.group.add(g);
  }

  /** bake the far-billboard atlas (needs the renderer; resolves once the tree textures have loaded) */
  async init(renderer) { this.impMat.map = await bakeImpostors(renderer, this.kinds); this.impMat.needsUpdate = true; }

  _fillPool(cx, cz) {
    const R1 = NEAR_R + 60, R0 = L0_R + 25, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const nv = this.kinds[0].variants.length, at = (ki, vi, lod) => this.pool[(ki * nv + vi) * 2 + lod], cnt = this.pool.map(() => 0);
    for (const cell of this.cells.values()) {
      if (!cell.trees || Math.abs(cell.cx - cx) > CELL / 2 + R1 || Math.abs(cell.cz - cz) > CELL / 2 + R1) continue;
      const t = cell.trees;
      for (let i = 0; i < t.length; i += 4) {
        const x = t[i], z = t[i + 1], d = Math.max(Math.abs(x - cx), Math.abs(z - cz)); if (d > R1) continue;
        const ki = t[i + 3], vi = Math.floor(hash2(x * 1.7 + 3, z * 0.9) * nv) % nv, s = t[i + 2];
        q.setFromAxisAngle(up, hash2(x, z) * 6.28); sc.set(s, s * (0.92 + hash2(z + 1, x) * 0.2), s); ps.set(x, 0, z); m4.compose(ps, q, sc);
        for (let lod = d < R0 ? 0 : 1; lod < 2; lod++) { const p = at(ki, vi, lod), pi = (ki * nv + vi) * 2 + lod; if (cnt[pi] < p.cap) p.trunk.setMatrixAt(cnt[pi]++, m4); }
      }
    }
    this.pool.forEach((p, i) => { p.trunk.count = p.leaves.count = cnt[i]; p.trunk.instanceMatrix.needsUpdate = true; });
    this.poolAt = [cx, cz]; this.nearCount = cnt.reduce((a, b, i) => a + (i % 2 ? b : 0), 0); this.fullCount = cnt.reduce((a, b, i) => a + (i % 2 ? 0 : b), 0);
  }

  /** call a few times a second with the focus point */
  update(cx, cz, viewDist, budget = 2) {
    this.U.uCam.value.set(cx, 0, cz);
    if (!this._clock) { this._clock = true; this.pool[0].trunk.onBeforeRender = () => { this.U.uTime.value = performance.now() / 1000; }; }
    const gx = Math.floor(cx / CELL), gz = Math.floor(cz / CELL), R = Math.ceil((viewDist + CELL) / CELL); let built = 0, pending = 0, fresh = false;
    for (let r = 0; r <= R; r++) for (let ix = gx - r; ix <= gx + r; ix++) for (let iz = gz - r; iz <= gz + r; iz++) {
      if (Math.max(Math.abs(ix - gx), Math.abs(iz - gz)) !== r) continue;
      const ccx = (ix + 0.5) * CELL, ccz = (iz + 0.5) * CELL; if (Math.hypot(ccx - cx, ccz - cz) > viewDist + CELL * 0.75) continue;
      const key = ix + ',' + iz; let c = this.cells.get(key); if (!c) this.cells.set(key, c = { gx: ix, gz: iz, cx: ccx, cz: ccz, obj: null });
      if (!c.obj) { if (built < budget) { this._buildCell(c); built++; if (r <= 1) fresh = true; } else pending++; }
    }
    for (const c of this.cells.values()) { if (!c.obj) continue; const d = Math.hypot(c.cx - cx, c.cz - cz); c.obj.visible = d < viewDist + CELL * 0.75; const nearVis = d < 900; for (const m of c.near) m.visible = nearVis; }
    if (fresh || Math.hypot(cx - this.poolAt[0], cz - this.poolAt[1]) > 12) this._fillPool(cx, cz);
    return pending;
  }
}
