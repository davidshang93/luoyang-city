// Ready-made rigged pedestrians (assets/models/people/*.glb, converted by tools/blender/process_person.py from the
// Microsoft Rocketbox avatars, MIT — see assets/CREDITS.txt). people.js calls preload() once and then tries
// buildGlbPerson() first for every outfit except hanfu; anything missing falls back to the procedural person.
//
// Cost control: pedestrians do NOT each own a skeleton. Every model has a few shared "rigs" (walk at three paces, idle);
// a pedestrian is just SkinnedMeshes in detached bind mode pointing at one of them, so 36 walkers animate ~20 small
// skeletons that live outside the scene graph. Only a person built with { rig: 'own' } (the player) gets a private
// skeleton with walk / idle blending driven by the engine's phase.
// The engine keeps calling animateWalk(obj, phase, amount); for these models that lands in obj.userData.anim(phase, amount).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const PROTO = { m: [], f: [] };
const PACES = [1.0, 1.14, 1.28];      // playback rates of the shared walk rigs; a walker moves at clip speed × pace, so feet do not slide
const now = () => performance.now() / 1000;

class Rig {
  constructor(P, clips, pace = 1, offset = 0) {
    this.root = P.rigRoot.clone(true);
    const drop = []; this.root.traverse(o => { if (o.isSkinnedMesh) drop.push(o); }); for (const o of drop) o.parent.remove(o);
    const byName = new Map(); this.root.traverse(o => byName.set(o.name, o));
    this.skeleton = new THREE.Skeleton(P.skeleton.bones.map(b => byName.get(b.name)), P.skeleton.boneInverses.map(m => m.clone()));
    this.mixer = new THREE.AnimationMixer(this.root); this.actions = {};
    for (const c of clips) { const a = this.mixer.clipAction(P.clips[c]); a.play(); a.setEffectiveWeight(c === clips[0] ? 1 : 0); this.actions[c] = a; }
    this.pace = pace; this.offset = offset; this.stamp = -1; this.P = P;
    this.root.updateMatrixWorld(true);
  }
  /** shared rigs: advance from the wall clock, at most once per frame however many walkers use the rig */
  touch() {
    const t = now(); if (t - this.stamp < 0.004) return; this.stamp = t;
    const a = this.actions.walk || this.actions.idle; a.time = (t * this.pace + this.offset) % a.getClip().duration;
    this.mixer.update(0); this.root.updateMatrixWorld(true);
  }
}

function makeProto(e, gltf) {
  const scene = gltf.scene; scene.updateMatrixWorld(true);
  const parts = []; let skeleton = null;
  scene.traverse(o => {
    if (!o.isSkinnedMesh) return; skeleton = skeleton || o.skeleton;
    const m = o.material; m.roughness = Math.max(0.6, m.roughness); m.metalness = 0; if (m.map) m.map.anisotropy = 4;
    if (m.name === 'alpha') { m.alphaTest = 0.5; m.transparent = false; m.side = THREE.DoubleSide; }   // no alphaToCoverage: with the post-processing chain it turned hair edges into white speckles
    parts.push({ geo: o.geometry, mat: m, bind: o.bindMatrix.clone(), world: o.matrixWorld.clone() });
  });
  const clips = {}; for (const c of gltf.animations) clips[c.name] = c;
  if (!skeleton || !parts.length || !clips.walk || !clips.idle) throw new Error('unexpected layout in ' + e.file);
  const h = e.height || 1.75;
  const P = { id: e.id, sex: e.sex, height: h, walkSpeed: e.walkSpeed || 1.1, rigRoot: scene, skeleton, parts, clips, rigs: new Map(),
    sphere: new THREE.Sphere(new THREE.Vector3(0, h / 2, 0), h * 0.75), box: new THREE.Box3(new THREE.Vector3(-0.8, -0.05, -0.8), new THREE.Vector3(0.8, h + 0.1, 0.8)) };
  // bounds are given in the mesh's own space
  const inv = parts[0].world.clone().invert(); P.sphere.applyMatrix4(inv); P.box.applyMatrix4(inv);
  return P;
}
function sharedRig(P, key) {
  let r = P.rigs.get(key);
  if (!r) { r = key === 'idle' ? new Rig(P, ['idle'], 1, P.rigs.size * 1.7) : new Rig(P, ['walk'], PACES[key], key * 0.37); P.rigs.set(key, r); }
  return r;
}

export async function preload(base = new URL('../../assets/models/people/', import.meta.url)) {
  let index; try { index = await (await fetch(new URL('index.json', base))).json(); } catch { return 0; }
  const loader = new GLTFLoader();
  const jobs = index.map(e => loader.loadAsync(new URL(e.file, base).href).then(g => { PROTO[e.sex === 'f' ? 'f' : 'm'].push(makeProto(e, g)); }).catch(err => console.warn('person model ' + e.file + ' not used:', err.message || err)));
  await Promise.race([Promise.allSettled(jobs), new Promise(r => setTimeout(r, 25000))]);
  for (const k of ['m', 'f']) PROTO[k].sort((a, b) => a.id < b.id ? -1 : 1);
  return PROTO.m.length + PROTO.f.length;
}
export const hasGlbPeople = () => PROTO.m.length > 0 && PROTO.f.length > 0;

function hashOf(o) { const s = JSON.stringify(o); let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }

let serial = 0;
/** opts = a person preset (sex, style …). Returns null when no model fits (the caller then builds the coded person). */
export function buildGlbPerson(opts = {}) {
  const sex = opts.sex === 'f' ? 'f' : 'm', list = PROTO[sex]; if (!list.length) return null;
  const h = hashOf({ ...opts, rig: 0 }), P = list[(h >>> 3) % list.length];
  // these avatars are tall; bring them to everyday heights (women ~1.58–1.67 m, men ~1.68–1.77 m), stable per outfit
  const scale = (sex === 'f' ? 0.91 : 0.925) + ((h >>> 9) % 6) * 0.01, own = opts.rig === 'own';
  const g = new THREE.Group(); g.name = 'person'; g.scale.setScalar(scale);
  const n = ++serial, pace = n % PACES.length;
  let rig = own ? new Rig(P, ['idle', 'walk']) : sharedRig(P, pace);
  const meshes = P.parts.map(p => {
    const m = new THREE.SkinnedMesh(p.geo, p.mat); m.name = 'body'; m.bindMode = THREE.DetachedBindMode; m.bind(rig.skeleton, p.bind);
    m.matrixAutoUpdate = false; m.matrix.copy(p.world); m.boundingSphere = P.sphere; m.boundingBox = P.box; m.castShadow = p.mat.name !== 'alpha'; if (p.mat.name === 'alpha') m.userData.noCast = true; g.add(m); return m;
  });
  const ud = g.userData = { glb: true, model: P.id, sex, style: opts.style || 'casual', height: P.height * scale };
  if (own) {
    // private skeleton: the engine's phase (2π = one left + right step) scrubs the walk clip; amount 0 = idle
    const walk = rig.actions.walk, idle = rig.actions.idle, wd = walk.getClip().duration, idd = idle.getClip().duration; let w = 0, last = now();
    ud.walkRate = 8.4; ud.runRate = 14.5;   // phase speed (rad/s) the engine should use for this body (see Player.walk)
    ud.anim = (phase, amount) => {
      const t = now(), dt = Math.min(0.1, t - last); last = t;
      const target = amount > 0.01 ? 1 : 0; w += (target - w) * Math.min(1, dt * 9);
      walk.setEffectiveWeight(w); idle.setEffectiveWeight(1 - w);
      walk.time = (((phase / (Math.PI * 2)) % 1) + 1) % 1 * wd; idle.time = t % idd;
      rig.root.rotation.x = amount > 0.7 ? 0.2 * w : 0;   // lean into a run
      rig.mixer.update(0); rig.root.updateMatrixWorld(true);
    };
    ud.anim(0, 0);
  } else {
    // shared skeleton: pick the walk rig (and move at exactly its pace) or the idle rig
    ud.walkSpeed = P.walkSpeed * scale * PACES[pace];
    let cur = rig;
    ud.anim = (phase, amount) => {
      const want = amount > 0.01 ? rig : sharedRig(P, 'idle');
      if (want !== cur) { cur = want; for (const m of meshes) m.skeleton = want.skeleton; }
      want.touch();
    };
    rig.touch();
  }
  return g;
}
