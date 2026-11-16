// Player (on foot / driving), drivable vehicles, chase camera.
import * as THREE from 'three';
import kit from '../landmarks/_kit.js';
import { clamp, angLerp, lerp } from '../core/util.js';

let Cars = null, People = null;
export async function loadModels() {
  try { Cars = await import('../models/cars.js'); } catch (e) { console.warn('cars model missing', e); }
  try { People = await import('../models/people.js'); } catch (e) { console.warn('people model missing', e); }
}

const SPEC = {
  sedan: { top: 52, acc: 7.5 }, suv: { top: 50, acc: 7 }, taxi: { top: 50, acc: 7.5 }, police: { top: 62, acc: 10 },
  sports: { top: 82, acc: 13 }, van: { top: 42, acc: 5.5 }, bus: { top: 30, acc: 3.2 }, truck: { top: 32, acc: 3.5 },
};
export const CAR_COLORS = [0xc0392b, 0xf2f2f2, 0x1f1f22, 0x7f8c8d, 0x2c5aa0, 0xbdc3c7, 0x8e6b3a, 0x2e7d5b, 0xd9d9d9, 0x3a3a40];
export const NPC_TYPES = ['sedan', 'sedan', 'sedan', 'suv', 'suv', 'taxi', 'taxi', 'van', 'bus', 'truck', 'sports'];

export function makeCarObject(type, color) {
  let obj = null;
  if (Cars) try { obj = Cars.buildCar(type, color); } catch (e) { console.warn(e); }
  if (!obj) {
    obj = new THREE.Group();
    const L = type === 'bus' ? 11.5 : type === 'truck' ? 6.5 : 4.6, W = type === 'bus' ? 2.5 : 1.85, H = type === 'bus' ? 3 : 1.4;
    obj.add(kit.box(W, H * 0.55, L, kit.mat(color), 0, 0.35, 0)); obj.add(kit.box(W * 0.9, H * 0.45, L * 0.55, kit.mat(0x26323c), 0, 0.35 + H * 0.55, -L * 0.05));
    obj.userData = { type, length: L, width: W, height: H, wheelRadius: 0.33, wheelBase: L * 0.6 };
  }
  obj.traverse(o => { if (o.isMesh) { o.castShadow = !o.userData.noShadow && !o.userData.noCast; o.receiveShadow = !o.userData.noShadow; } });
  return obj;
}

export class Vehicle {
  constructor(type, color, x, z, h) {
    this.type = type; this.obj = makeCarObject(type, color);
    const u = this.obj.userData;
    this.len = u.length || 4.6; this.wid = u.width || 1.85; this.wb = u.wheelBase || this.len * 0.6; this.wr = u.wheelRadius || 0.33;
    this.spec = SPEC[type] || SPEC.sedan;
    this.wheels = ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'].map(n => this.obj.getObjectByName(n));
    this.x = x; this.z = z; this.h = h; this.vh = h; this.v = 0; this.steer = 0; this.spin = 0; this.roll = 0;
    this.sync();
  }
  sync() { this.obj.position.set(this.x, 0, this.z); this.obj.rotation.set(0, this.h, this.roll, 'YXZ'); }
  /** input: {throttle:-1..1, steer:-1..1 (right = +1), hand:boolean} */
  drive(dt, input, world) {
    const s = this.spec, ox = this.x, oz = this.z, oh = this.h;
    let v = this.v;
    if (input.throttle > 0) v = v >= -0.5 ? v + s.acc * input.throttle * Math.max(0.05, 1 - v / s.top) * dt : v + 22 * dt;
    else if (input.throttle < 0) v = v > 0.5 ? v - 24 * dt : Math.max(-11, v - s.acc * 0.6 * dt);
    else v -= Math.sign(v) * Math.min(Math.abs(v), (1.0 + Math.abs(v) * 0.035) * dt);
    if (input.hand) v -= Math.sign(v) * Math.min(Math.abs(v), 16 * dt);
    if (world.offroad) v -= Math.sign(v) * Math.min(Math.abs(v), Math.abs(v) * 0.5 * dt);
    const maxSteer = 0.62 / (1 + Math.abs(v) / 13);
    this.steer = lerp(this.steer, input.steer * maxSteer, clamp(dt * 7, 0, 1));
    const yaw = -v * Math.tan(this.steer) / this.wb; // steer right → heading decreases
    this.h += yaw * dt * (input.hand && Math.abs(v) > 6 ? 1.6 : 1);
    const grip = input.hand && Math.abs(v) > 6 ? 1.6 : 9;
    this.vh = angLerp(this.vh, this.h, clamp(grip * dt, 0, 1));
    this.x += Math.sin(this.vh) * v * dt; this.z += Math.cos(this.vh) * v * dt;
    this.v = v;
    // collision: probe corners + nose/tail
    const fx = Math.sin(this.h), fz = Math.cos(this.h), hl = this.len / 2, hw = this.wid / 2;
    let hit = false;
    if (!world.blocked(ox, oz, 0)) {
      for (const [a, b] of [[hl, 0], [-hl, 0], [hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw]]) {
        if (world.blocked(this.x + fx * a - fz * b, this.z + fz * a + fx * b, 0.15)) { hit = true; break; }
      }
    }
    if (hit) { this.x = ox; this.z = oz; this.h = oh; this.vh = oh; this.crash = Math.abs(v); this.v = -v * 0.25; }
    this.roll = lerp(this.roll, clamp(yaw * v * 0.004, -0.07, 0.07), clamp(dt * 6, 0, 1));
    this.spin += this.v * dt / this.wr;
    for (let i = 0; i < 4; i++) { const w = this.wheels[i]; if (!w) continue; w.rotation.order = 'YXZ'; w.rotation.x = this.spin; if (i < 2) w.rotation.y = -this.steer; }
    this.sync();
  }
}

export function makePersonObject(preset) {
  let obj = null;
  if (People) try { obj = People.buildPerson(preset || {}); } catch (e) { console.warn(e); }
  if (!obj) { obj = new THREE.Group(); obj.add(kit.cyl(0.22, 0.25, 1.2, kit.mat(preset?.shirt ?? 0x3366aa), 0, 0.25, 0, 8)); obj.add(kit.sphere(0.16, kit.mat(0xe0b090), 0, 1.6, 0, 8)); }
  obj.traverse(o => { if (o.isMesh) o.castShadow = !o.userData.noCast; });
  obj.userData.limbs = ['arm_l', 'arm_r', 'leg_l', 'leg_r'].map(n => obj.getObjectByName(n));
  return obj;
}
export function animateWalk(obj, phase, amount) {
  if (obj.userData.anim) return obj.userData.anim(phase, amount);   // rigged model: skeletal walk / idle
  const l = obj.userData.limbs; if (!l) return; const s = Math.sin(phase) * amount * (obj.userData.style === 'hanfu' ? 0.6 : 1);   // long robes: shorter stride
  if (l[0]) l[0].rotation.x = s * 0.8; if (l[1]) l[1].rotation.x = -s * 0.8; if (l[2]) l[2].rotation.x = -s; if (l[3]) l[3].rotation.x = s;
}
export function personPresets() { return (People && People.PERSON_PRESETS) || [{}]; }

export class Player {
  constructor(scene, x, z, h) {
    this.scene = scene; this.x = x; this.z = z; this.h = h; this.vehicle = null; this.phase = 0; this.speed = 0;
    this.obj = makePersonObject({ shirt: 0xd9d4c7, pants: 0x2b3a55, style: 'casual', sex: 'm', rig: 'own' }); scene.add(this.obj);
    this.sync();
  }
  sync() { this.obj.position.set(this.x, 0, this.z); this.obj.rotation.y = this.h; }
  walk(dt, mx, mz, run, camYaw, world) {
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      const fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -fz, rz = fx;
      const dx = (fx * mz + rx * mx) / len, dz = (fz * mz + rz * mx) / len, sp = run ? 7.5 : 2.4;
      this.h = angLerp(this.h, Math.atan2(dx, dz), clamp(dt * 12, 0, 1));
      const nx = this.x + dx * sp * dt, nz = this.z + dz * sp * dt;
      const stuck = world.blocked(this.x, this.z, 0.3);
      if (stuck || !world.blocked(nx, nz, 0.35)) { this.x = nx; this.z = nz; }
      else if (!world.blocked(nx, this.z, 0.35)) this.x = nx; else if (!world.blocked(this.x, nz, 0.35)) this.z = nz;
      const u = this.obj.userData; this.speed = sp; this.phase += dt * (run ? (u.runRate || 13) : (u.walkRate || 7));
      animateWalk(this.obj, this.phase, run ? 0.9 : 0.55);
    } else { this.speed = 0; animateWalk(this.obj, 0, 0); }
    this.sync();
  }
  enter(v) { this.vehicle = v; this.obj.visible = false; }
  exit(world) {
    const v = this.vehicle; if (!v) return;
    const lx = Math.cos(v.h), lz = -Math.sin(v.h); // left side of the car
    for (const side of [1, -1, 0]) {
      const x = v.x + lx * side * (v.wid / 2 + 0.9) - (side === 0 ? Math.sin(v.h) * (v.len / 2 + 1) : 0), z = v.z + lz * side * (v.wid / 2 + 0.9) - (side === 0 ? Math.cos(v.h) * (v.len / 2 + 1) : 0);
      if (!world.blocked(x, z, 0.35) || side === 0) { this.x = x; this.z = z; break; }
    }
    this.h = v.h; v.v = 0; this.vehicle = null; this.obj.visible = true; this.sync();
  }
  get px() { return this.vehicle ? this.vehicle.x : this.x; }
  get pz() { return this.vehicle ? this.vehicle.z : this.z; }
}

export class ChaseCamera {
  constructor(camera) { this.camera = camera; this.yaw = Math.PI; this.pitch = 0.22; this.dist = 7; this.idle = 9; this.pos = new THREE.Vector3(); this.tgt = new THREE.Vector3(); this.first = true; }
  nudge(dyaw, dpitch) { this.yaw += dyaw; this.pitch = clamp(this.pitch + dpitch, -0.05, 1.35); this.idle = 0; }
  zoom(k) { this.distUser = clamp((this.distUser || 1) * k, 0.45, 12); }
  update(dt, player) {
    const v = player.vehicle; this.idle += dt;
    const base = v ? Math.max(8, v.len * 1.75) + Math.abs(v.v) * 0.07 : 5.2;
    this.dist = lerp(this.dist, base * (this.distUser || 1), clamp(dt * 4, 0, 1));
    if (v && this.idle > 1.2 && Math.abs(v.v) > 1) this.yaw = angLerp(this.yaw, v.v < -1 ? v.h + Math.PI : v.h, clamp(dt * 2.6, 0, 1));
    const tx = player.px, tz = player.pz, ty = v ? 1.5 + (v.obj.userData.height || 1.5) * 0.3 : 1.55;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const px = tx - Math.sin(this.yaw) * this.dist * cp, pz = tz - Math.cos(this.yaw) * this.dist * cp, py = Math.max(0.5, ty + this.dist * sp);
    if (this.first) { this.pos.set(px, py, pz); this.first = false; } else this.pos.lerp(this._v ? this._v.set(px, py, pz) : (this._v = new THREE.Vector3(px, py, pz)), clamp(dt * 14, 0, 1));
    this.tgt.set(tx, ty, tz);
    this.camera.position.copy(this.pos); this.camera.lookAt(this.tgt);
  }
  snap() { this.first = true; }
}
