// Ready-made vehicle models (assets/models/cars/<type>.glb, converted by tools/models/build-cars.mjs from the CARLA
// vehicle set, CC BY 4.0 — see assets/CREDITS.txt). cars.js calls preload() once and then tries buildGlbCar() first;
// anything missing or broken falls back to the procedural car of the same type.
// File layout (written by the converter): root.extras = { length, width, height, wheelRadius, wheelBase, paint? } and
// child meshes  body (one primitive per material) · wheel_fl / wheel_fr / wheel_rl / wheel_rr (origin = hub) ·
// glow (lamp cards, vertex colour) · lampbox (beacon lenses, vertex colour) · decal:<region> (UV 0..1 over a region
// of the decal atlas in cars.js: plates, door bands, roof sign).
// Materials by name: paint (replaced by the per-colour clearcoat paint) · glass / lens · tex:* (as authored) ·
// solid:matte|gloss|metal (vertex colours) · glow · decal.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { glow } from '../core/mats.js';

const PROTO = new Map();
const shared = new Map();   // materials shared by every vehicle type
let H = null;               // helpers handed over by cars.js: { paintMat, decalMat, uvR, R, plateRect, PLATE_POOL }

function sharedMat(name, make) { let m = shared.get(name); if (!m) shared.set(name, (m = make())); return m; }
function emissiveFromVertexColor(m, key) {
  m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = emissive * vColor.rgb;'); };
  m.customProgramCacheKey = () => key; return m;
}
function materialFor(src, meshName) {
  const n = src.name;
  if (n === 'glass' || n === 'lens') return sharedMat(n, () => new THREE.MeshStandardMaterial({ color: src.color, transparent: true, opacity: n === 'glass' ? 0.5 : 0.16, roughness: 0.1, metalness: 0.2, depthWrite: false, name: 'car-' + n }));
  if (n.startsWith('solid:')) return sharedMat(n, () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: Math.max(0.12, src.roughness), metalness: src.metalness, name: 'car-' + n }));
  if (n === 'glow' && meshName === 'lampbox') return sharedMat('lampbox', () => glow(emissiveFromVertexColor(new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xffffff, roughness: 0.25, metalness: 0, name: 'car-beacon' }), 'car-beacon'), 0.25, 4.5));
  // lamp cards: additive, almost invisible by day so the modelled lamp shows through, bright at night (bloom does the rest)
  if (n === 'glow') return sharedMat('glow', () => glow(emissiveFromVertexColor(new THREE.MeshStandardMaterial({ color: 0x000000, vertexColors: true, emissive: 0xffffff, roughness: 1, metalness: 0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, name: 'car-glow' }), 'car-glow'), 0.04, 5));
  src.roughness = Math.max(0.12, src.roughness);   // mirror-smooth surfaces facing the sun blow out the bloom pass
  for (const k of ['map', 'normalMap', 'roughnessMap']) if (src[k]) src[k].anisotropy = 4;
  return src;
}

function makeProto(type, gltf) {
  const root = gltf.scene.children[0], ud = root.userData || {};
  const P = { type, body: [], wheels: [], decals: [], paint: ud.paint ?? null, platePool: H.PLATE_POOL[type === 'police' ? 'police' : type === 'taxi' ? 'taxi' : type === 'bus' || type === 'truck' ? 'big' : 'car'],
    ud: { length: ud.length, width: ud.width, height: ud.height, wheelRadius: ud.wheelRadius, wheelBase: ud.wheelBase } };
  const parts = (node) => { const out = []; node.traverse(o => { if (o.isMesh) out.push({ geo: o.geometry, mat: o.material, name: node.name }); }); return out; };
  const dec = { pos: [], nrm: [], uv: [], idx: [], plate: [] };   // plate: [first uv index, region]
  for (const node of root.children) {
    if (/^wheel_/.test(node.name)) {
      const ps = parts(node).map(p => ({ geo: p.geo, mat: materialFor(p.mat, node.name), n: p.geo.index.count }));
      const big = Math.max(...ps.map(p => p.n)); for (const p of ps) p.noCast = p.n < big;   // one shadow caster per wheel is enough
      P.wheels.push({ name: node.name, pos: node.position.clone(), parts: ps });
    }
    else if (/^decal/.test(node.name)) {   // GLTFLoader strips the ':' from node names
      const region = node.name.replace(/^decal:?/, '');
      for (const p of parts(node)) {
        const g = p.geo, base = dec.pos.length / 3, n = g.attributes.position.count, isPlate = /^plate/.test(region);
        const r = isPlate ? [0, 0, 1, 1] : H.uvR(region === 'policeBlue' ? [4, 544, 8, 52] : H.R[region] || H.R.taxiDoor);
        if (isPlate) dec.plate.push([base, n]);
        for (let i = 0; i < n; i++) { dec.pos.push(g.attributes.position.getX(i), g.attributes.position.getY(i), g.attributes.position.getZ(i)); dec.nrm.push(g.attributes.normal.getX(i), g.attributes.normal.getY(i), g.attributes.normal.getZ(i)); const u = g.attributes.uv.getX(i), v = g.attributes.uv.getY(i); dec.uv.push(r[0] + u * (r[2] - r[0]), r[1] + v * (r[3] - r[1])); }
        for (let i = 0; i < g.index.count; i++) dec.idx.push(g.index.getX(i) + base);
      }
    } else for (const p of parts(node)) { if (p.mat.name === 'paint') P.body.push({ geo: p.geo, paint: true }); else P.body.push({ geo: p.geo, mat: materialFor(p.mat, node.name), noShadow: /^(glass|lens|glow)$/.test(p.mat.name), noCast: p.geo.index.count < 4500 }); }   // small trim parts sit inside the paint shell's shadow anyway
  }
  // decal geometry: one per number-plate variant (positions shared), like the procedural cars
  if (dec.idx.length) {
    const pos = new THREE.Float32BufferAttribute(dec.pos, 3), nrm = new THREE.Float32BufferAttribute(dec.nrm, 3);
    for (const k of dec.plate.length ? P.platePool : [0]) {
      const g = new THREE.BufferGeometry(), uv = Float32Array.from(dec.uv), q = H.uvR(H.plateRect(k));
      for (const [b, n] of dec.plate) for (let i = 0; i < n; i++) { const u = dec.uv[(b + i) * 2], v = dec.uv[(b + i) * 2 + 1]; uv[(b + i) * 2] = q[0] + u * (q[2] - q[0]); uv[(b + i) * 2 + 1] = q[1] + v * (q[3] - q[1]); }
      g.setAttribute('position', pos); g.setAttribute('normal', nrm); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(dec.idx); g.computeBoundingSphere();
      P.decals.push(g);
    }
  }
  if (P.wheels.length !== 4 || !P.body.length || !(P.ud.length > 1)) throw new Error('unexpected layout in ' + type + '.glb');
  return P;
}

/** load every listed model (never rejects; a model that fails to load simply stays procedural) */
export async function preload(helpers, base = new URL('../../assets/models/cars/', import.meta.url)) {
  H = helpers;
  let index; try { index = await (await fetch(new URL('index.json', base))).json(); } catch { return 0; }
  const loader = new GLTFLoader();
  const jobs = Object.entries(index).map(([type, e]) => loader.loadAsync(new URL(e.file, base).href).then(g => { PROTO.set(type, makeProto(type, g)); }).catch(err => console.warn('car model ' + type + ' not used:', err.message || err)));
  await Promise.race([Promise.allSettled(jobs), new Promise(r => setTimeout(r, 25000))]);
  return PROTO.size;
}
export const hasGlbCar = type => PROTO.has(type);

let serial = 0;
export function buildGlbCar(type, color) {
  const P = PROTO.get(type); if (!P) return null;
  const g = new THREE.Group(), add = (parent, geo, mat, name, noShadow, noCast) => { const m = new THREE.Mesh(geo, mat); m.name = name; if (noShadow) m.userData.noShadow = true; if (noCast) m.userData.noCast = true; parent.add(m); return m; };
  const paint = H.paintMat(P.paint ?? color);
  // small trim parts and decals sit in a distance switch: beyond ~130 m only the shell, glass, lamps and wheels are drawn
  const near = new THREE.Group(), sw = new THREE.LOD(); sw.name = 'detail'; sw.addLevel(near, 0); sw.addLevel(new THREE.Object3D(), 130); g.add(sw);
  for (const b of P.body) add(b.noCast && !b.noShadow && !b.paint ? near : g, b.geo, b.paint ? paint : b.mat, b.paint ? 'paint' : 'trim', b.noShadow, b.noCast);
  if (P.decals.length) { const h = Math.imul((++serial) ^ 0x9e3779b9, 0x85ebca6b) >>> 0; add(near, P.decals[(h >>> 7) % P.decals.length], H.decalMat(), 'decals', true); }
  for (const w of P.wheels) { const wg = new THREE.Group(); wg.name = w.name; wg.position.copy(w.pos); wg.rotation.order = 'YXZ'; for (const p of w.parts) add(wg, p.geo, p.mat, 'wheel', false, p.noCast); g.add(wg); }
  g.userData = { type, glb: true, ...P.ud };
  return g;
}
