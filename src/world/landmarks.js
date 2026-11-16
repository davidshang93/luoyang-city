// Landmark registry: lazy-loads src/landmarks/<id>.js modules near the camera, exposes colliders.
// A module may export `glb = { file, x, z, y, yaw, scale, colliders }`: then assets/models/<file>.glb (an AI-generated,
// Blender-processed model) is loaded and placed in the landmark's local frame, and the module is built with
// build(kit, { glb: true }) so it only adds what the model does not cover. If the GLB fails to load the code version is used.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import kit from '../landmarks/_kit.js';

const gltfLoader = new GLTFLoader();
async function loadGlb(cfg) {
  const gltf = await gltfLoader.loadAsync(new URL(`../../assets/models/${cfg.file}.glb`, import.meta.url).href);
  const o = gltf.scene;
  o.traverse(m => { if (!m.isMesh) return; m.castShadow = m.receiveShadow = true; const mt = m.material; for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) if (mt[k]) mt[k].anisotropy = 8; mt.envMapIntensity = 0.9; });
  o.position.set(cfg.x || 0, cfg.y ?? -0.04, cfg.z || 0); o.rotation.y = cfg.yaw || 0; o.scale.setScalar(cfg.scale || 1);
  return o;
}

const LOAD_R = 2300, HIDE_R = 2700;

export class Landmarks {
  constructor(scene, list) {
    this.group = new THREE.Group(); this.group.name = 'landmarks'; scene.add(this.group);
    this.list = list.map(l => ({ ...l, state: 0, obj: null, colliders: [], c: Math.cos(l.rot), s: Math.sin(l.rot), R: Math.hypot(l.w, l.d) / 2 }));
    this.byId = new Map(this.list.map(l => [l.id, l]));
    // assets/models/index.json lists the processed AI models that exist, so a landmark whose model has not been generated yet
    // quietly uses its code version instead of logging a 404
    this.glbList = fetch(new URL('../../assets/models/index.json', import.meta.url)).then(r => r.json()).catch(() => []);
    this.errors = []; this.noGlb = new URLSearchParams(globalThis.location?.search || '').has('noglb');
  }

  /** local landmark coords → world */
  toWorld(l, lx, lz) { return [l.x + lx * l.c + lz * l.s, l.z - lx * l.s + lz * l.c]; }
  toLocal(l, x, z) { const dx = x - l.x, dz = z - l.z; return [dx * l.c - dz * l.s, dx * l.s + dz * l.c]; }

  async _load(l) {
    l.state = 1;
    let obj, meta = {};
    try {
      const mod = await import(`../landmarks/${l.id}.js`);
      let model = null;
      if (mod.glb && !this.noGlb && (await this.glbList).includes(mod.glb.file)) try { model = await loadGlb(mod.glb); } catch (e) { console.warn('GLB failed, using code model', l.id, e); }
      obj = mod.build(kit, { glb: !!model }); meta = mod.meta || {};
      if (model) { obj.add(model); l.glb = true; if (mod.glb.colliders) meta = { ...meta, colliders: mod.glb.colliders }; }
    } catch (e) {
      this.errors.push(l.id + ': ' + (e.message || e));
      console.warn('landmark failed', l.id, e);
      obj = new THREE.Group();
      obj.add(kit.box(Math.min(l.w, 60), 20, Math.min(l.d, 60), kit.mat(0x9a9a9a)));
      obj.add(kit.sign(l.name, 30, 6, { y: 26 }));
      meta = { colliders: [{ x: 0, z: 0, w: Math.min(l.w, 60), d: Math.min(l.d, 60) }] };
    }
    obj.position.set(l.x, 0, l.z); obj.rotation.y = l.rot;
    obj.traverse(o => { if (o.isMesh) { o.castShadow = o.castShadow && !(o.material.transparent); o.receiveShadow = true; } });
    obj.updateMatrixWorld(true);
    obj.traverse(o => { o.matrixAutoUpdate = false; });
    l.obj = obj; this.group.add(obj);
    l.colliders = (meta.colliders || []).map(c => { const [x, z] = this.toWorld(l, c.x, c.z); const a = l.rot + (c.rot || 0); return { x, z, hw: c.w / 2, hd: c.d / 2, c: Math.cos(a), s: Math.sin(a), r: Math.hypot(c.w, c.d) / 2 }; });
    l.state = 2;
  }

  update(cx, cz) {
    let loading = 0;
    for (const l of this.list) {
      const d = Math.hypot(l.x - cx, l.z - cz) - l.R;
      if (l.state === 0 && d < LOAD_R && loading < 2) { loading++; this._load(l); }
      else if (l.state === 1) loading++;
      else if (l.state === 2) l.obj.visible = d < HIDE_R;
    }
  }

  /** Circle (x,z,r) vs landmark collider boxes. */
  hit(x, z, r = 0) {
    for (const l of this.list) {
      if (l.state !== 2 || Math.abs(x - l.x) > l.R + r || Math.abs(z - l.z) > l.R + r) continue;
      for (const c of l.colliders) {
        const dx = x - c.x, dz = z - c.z; if (Math.abs(dx) > c.r + r || Math.abs(dz) > c.r + r) continue;
        const lx = dx * c.c - dz * c.s, lz = dx * c.s + dz * c.c;
        if (Math.abs(lx) < c.hw + r && Math.abs(lz) < c.hd + r) return true;
      }
    }
    return false;
  }

  /** Landmark whose footprint contains (x,z) (with padding), else null. */
  at(x, z, pad = 0) {
    for (const l of this.list) {
      if (Math.abs(x - l.x) > l.R + pad || Math.abs(z - l.z) > l.R + pad) continue;
      const [lx, lz] = this.toLocal(l, x, z);
      if (Math.abs(lx) < l.w / 2 + pad && Math.abs(lz) < l.d / 2 + pad) return l;
    }
    return null;
  }
}
