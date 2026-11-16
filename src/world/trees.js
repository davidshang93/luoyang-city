// Tree species for props.js, grown with ez-tree (vendor/ez-tree, MIT): real branching structure, bark and leaf textures.
// For each species a few seeded variants are generated once at start-up, scaled to metres, and reduced to two levels of detail:
//   L0 full tree (close up)  ·  L1 trunk + main limbs with a third of the leaves, enlarged (middle distance).
// The far billboards are baked from the L0 trees themselves (bakeImpostors), so near and far always match.
import * as THREE from 'three';
import { Tree, TreePreset } from '@dgreenheck/ez-tree';

// h = height in metres at scale 1. opts are merged over an ez-tree preset (its units are arbitrary; we rescale to h).
export const SPECIES = [
  { name: '法桐', h: 13.5, preset: 'Oak Large', seeds: [11, 47], leafTint: [1.12, 1.3, 0.82], barkTint: 0xd9d6c4,
    opts: { bark: { type: 'birch', textureScale: { x: 1, y: 3 } }, branch: { children: { 0: 6, 1: 4, 2: 2 }, sections: { 0: 7, 1: 5, 2: 3, 3: 1 }, segments: { 0: 8, 1: 5, 2: 3, 3: 3 }, start: { 1: 0.42, 2: 0.15, 3: 0 }, angle: { 1: 50, 2: 45, 3: 35 }, radius: { 0: 2.3, 1: 0.7, 2: 0.7, 3: 1.1 } }, leaves: { type: 'oak', count: 6, size: 7.6 } } },
  { name: '国槐', h: 10, preset: 'Ash Medium', seeds: [5, 23], leafTint: [1.0, 1.22, 0.72], barkTint: 0x9a8f80,
    opts: { branch: { children: { 0: 6, 1: 3, 2: 3 }, sections: { 0: 6, 1: 5, 2: 3, 3: 1 }, segments: { 0: 8, 1: 5, 2: 3, 3: 3 }, start: { 1: 0.36, 2: 0.3, 3: 0 }, force: { strength: -0.02 } }, leaves: { type: 'ash', count: 6, size: 5.8 } } },
  { name: '柳', h: 10.5, preset: 'Ash Medium', seeds: [8, 31], leafTint: [1.2, 1.36, 0.7], barkTint: 0x8f8676,
    opts: { bark: { type: 'willow' }, branch: { children: { 0: 6, 1: 3, 2: 3 }, sections: { 0: 6, 1: 5, 2: 4, 3: 3 }, segments: { 0: 8, 1: 5, 2: 3, 3: 3 }, start: { 1: 0.4, 2: 0.25, 3: 0 }, angle: { 1: 58, 2: 70, 3: 40 }, length: { 0: 34, 1: 24, 2: 20, 3: 15 }, force: { strength: -0.11 }, gnarliness: { 0: 0.05, 1: 0.2, 2: 0.12, 3: 0.05 } }, leaves: { type: 'ash', count: 6, size: 6, angle: 20 } } },
  { name: '松柏', h: 10.5, preset: 'Pine Medium', seeds: [3, 19], leafTint: [0.8, 1.0, 0.72], barkTint: 0xa39484,
    opts: { branch: { children: { 0: 40 }, sections: { 0: 8, 1: 3 }, segments: { 0: 7, 1: 3 }, length: { 0: 50, 1: 15 }, start: { 1: 0.14 }, angle: { 1: 104 } }, leaves: { type: 'pine', count: 9, size: 3.3 } } },
];

function merge(dst, src) { for (const k in src) { if (src[k] && typeof src[k] === 'object') { dst[k] = dst[k] && typeof dst[k] === 'object' ? dst[k] : {}; merge(dst[k], src[k]); } else dst[k] = src[k]; } return dst; }

/** soft "ball" normals for foliage: away from the crown centre, biased upwards (per-leaf quad normals give a noisy, dark crown) */
function ballNormals(geo, cy, R) {
  const p = geo.attributes.position, n = new Float32Array(p.count * 3), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.set(p.getX(i), Math.abs(p.getY(i) - cy) * 0.45 + R * 0.75, p.getZ(i)).normalize(); n[i * 3] = v.x; n[i * 3 + 1] = v.y; n[i * 3 + 2] = v.z; }
  geo.setAttribute('normal', new THREE.BufferAttribute(n, 3));
}

/** every `keep`-th leaf of an ez-tree leaf geometry (8 vertices per double-quad leaf), enlarged about its centre; only one of its two quads is kept */
function thinLeaves(geo, keep, grow) {
  const p = geo.attributes.position.array, uv = geo.attributes.uv.array, P = [], U = [], I = [];
  for (let l = 0, n = p.length / 24; l < n; l += keep) {
    const q = (l / keep) & 1 ? 4 : 0; let cx = 0, cy = 0, cz = 0; for (let k = 0; k < 8; k++) { cx += p[(l * 8 + k) * 3]; cy += p[(l * 8 + k) * 3 + 1]; cz += p[(l * 8 + k) * 3 + 2]; } cx /= 8; cy /= 8; cz /= 8;
    const o = P.length / 3;
    for (let k = q; k < q + 4; k++) { const i = (l * 8 + k) * 3; P.push(cx + (p[i] - cx) * grow, cy + (p[i + 1] - cy) * grow, cz + (p[i + 2] - cz) * grow); U.push(uv[(l * 8 + k) * 2], uv[(l * 8 + k) * 2 + 1]); }
    I.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I);
  return g;
}

const tris = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;

/**
 * Grow all species. Returns [{ name, h, w, barkMap, barkNormal, leafMap, leafTint, barkTint, variants: [{ bark0, leaves0, bark1, leaves1, w, cy }] }].
 * Geometry is in metres, trunk base at the origin.
 */
export function growTrees() {
  return SPECIES.map((sp) => {
    let barkMap = null, barkNormal = null, leafMap = null, alphaTest = 0.5, wMax = 0;
    const variants = sp.seeds.map((seed) => {
      const tree = new Tree(); tree.options.copy(JSON.parse(JSON.stringify(TreePreset[sp.preset]))); merge(tree.options, sp.opts); tree.options.seed = seed;
      // record where each branch level ends in the index buffer (branches are generated breadth-first, level by level)
      const levelEnd = [], gen = tree.generateBranch.bind(tree); tree.generateBranch = (b) => { gen(b); levelEnd[b.level] = tree.branches.indices.length; };
      tree.generate();
      const bark0 = tree.branchesMesh.geometry, leaves0 = tree.leavesMesh.geometry, bm = tree.branchesMesh.material, lm = tree.leavesMesh.material;
      barkMap = bm.map; barkNormal = bm.normalMap; leafMap = lm.map; alphaTest = lm.alphaTest;
      for (const g of [bark0, leaves0]) { g.deleteAttribute('windFactor'); g.computeBoundingBox(); }
      const top = Math.max(bark0.boundingBox.max.y, leaves0.boundingBox.max.y), k = sp.h / top;
      for (const g of [bark0, leaves0]) { g.scale(k, k, k); g.computeBoundingBox(); }
      const lb = leaves0.boundingBox, cy = (lb.min.y + lb.max.y) / 2, w = 2 * Math.max(-lb.min.x, lb.max.x, -lb.min.z, lb.max.z); wMax = Math.max(wMax, w);
      ballNormals(leaves0, cy, w / 2);
      // L1: trunk and first-level limbs only; a third of the leaves as single quads, 1.9× larger
      const bark1 = bark0.clone(); bark1.setIndex(Array.from(bark0.index.array.subarray(0, levelEnd[levelEnd.length > 2 ? 1 : 0])));
      const leaves1 = thinLeaves(leaves0, 3, 1.9); ballNormals(leaves1, cy, w / 2);
      for (const g of [bark0, leaves0, bark1, leaves1]) { g.computeBoundingSphere(); g.computeBoundingBox(); }
      return { bark0, leaves0, bark1, leaves1, w, cy, tris: [tris(bark0), tris(leaves0), tris(bark1), tris(leaves1)] };
    });
    return { name: sp.name, h: sp.h, w: wMax, barkMap, barkNormal, leafMap, alphaTest, leafTint: new THREE.Color(...sp.leafTint), barkTint: sp.barkTint, variants };
  });
}

const loaded = (t) => new Promise((res) => { const chk = () => (t && t.image && t.image.width ? res() : setTimeout(chk, 40)); chk(); });

/**
 * Render variant 0 of every species from the side into one atlas (species side by side, 512 px each, transparent background).
 * Returns a texture usable as a colour map (linear data, mip-mapped). Each tile spans the species' w × h, trunk at the bottom centre.
 */
export async function bakeImpostors(renderer, kinds) {
  await Promise.all(kinds.flatMap(k => [loaded(k.barkMap), loaded(k.leafMap)]));
  const S = 512, rt = new THREE.WebGLRenderTarget(S * kinds.length, S, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace });
  rt.texture.anisotropy = 4;
  const scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4630, 2.2));
  const key = new THREE.DirectionalLight(0xfff2dd, 1.1); key.position.set(-0.5, 1, 0.8); scene.add(key);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, 0, 1, 200);
  const prev = { rt: renderer.getRenderTarget(), ac: renderer.autoClear, tm: renderer.toneMapping, col: renderer.getClearColor(new THREE.Color()), a: renderer.getClearAlpha(), sm: renderer.shadowMap.enabled };
  renderer.shadowMap.enabled = false; renderer.toneMapping = THREE.NoToneMapping; renderer.setRenderTarget(rt); renderer.setClearColor(0x3c4a26, 0); renderer.autoClear = false; renderer.clear();
  kinds.forEach((k, i) => {
    const v = k.variants[0], g = new THREE.Group();
    g.add(new THREE.Mesh(v.bark0, new THREE.MeshLambertMaterial({ map: k.barkMap, color: k.barkTint })));
    g.add(new THREE.Mesh(v.leaves0, new THREE.MeshLambertMaterial({ map: k.leafMap, color: k.leafTint, alphaTest: k.alphaTest, side: THREE.DoubleSide })));
    scene.add(g);
    cam.left = -k.w / 2; cam.right = k.w / 2; cam.top = k.h; cam.bottom = 0; cam.position.set(0, 0, 100); cam.lookAt(0, 0, 0); cam.position.y = 0; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    rt.viewport.set(i * S, 0, S, S); rt.scissor.set(i * S, 0, S, S); rt.scissorTest = true; renderer.setRenderTarget(rt);
    renderer.render(scene, cam); scene.remove(g); g.children.forEach(m => m.material.dispose());
  });
  rt.scissorTest = false; rt.viewport.set(0, 0, S * kinds.length, S);
  renderer.setRenderTarget(prev.rt); renderer.autoClear = prev.ac; renderer.toneMapping = prev.tm; renderer.setClearColor(prev.col, prev.a); renderer.shadowMap.enabled = prev.sm;
  return rt.texture;
}
