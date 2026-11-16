// Ambient life: NPC cars following the road graph, parked cars, pedestrians on sidewalks.
import { makeCarObject, makePersonObject, animateWalk, personPresets, CAR_COLORS, NPC_TYPES } from './actors.js';
import { angLerp, clamp, hash2 } from '../core/util.js';

const CRUISE = [24, 19, 15, 13, 11, 8, 10, 3];
let seed = 12345; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

export class Traffic {
  constructor(scene, roads, world, opts = {}) {
    this.scene = scene; this.roads = roads; this.world = world;
    this.maxCars = opts.cars ?? 42; this.maxPeds = opts.peds ?? 36; this.maxParked = 22;
    this.cars = []; this.peds = []; this.parked = []; this.timer = 0;
  }

  _pickSpot(px, pz, rMin, rMax, maxCls) {
    for (let k = 0; k < 6; k++) {
      const a = rnd() * 6.283, r = rMin + rnd() * (rMax - rMin), hit = this.roads.nearest(px + Math.cos(a) * r, pz + Math.sin(a) * r, 90, maxCls);
      if (!hit || hit.way.cls === 7 || hit.way.tunnel) continue;
      if (Math.hypot(hit.x - px, hit.z - pz) < rMin * 0.8) continue;
      return hit;
    }
    return null;
  }

  _spawnCar(px, pz) {
    const hit = this._pickSpot(px, pz, 140, 480, 5); if (!hit) return;
    for (const c of this.cars) if (Math.hypot(c.x - hit.x, c.z - hit.z) < 18) return;
    const type = NPC_TYPES[Math.floor(rnd() * NPC_TYPES.length)], color = CAR_COLORS[Math.floor(rnd() * CAR_COLORS.length)];
    const w = hit.way, dir = w.oneway ? 1 : (rnd() < 0.5 ? 1 : -1);
    const obj = makeCarObject(type, color); this.scene.add(obj);
    const c = { obj, type, color, wi: hit.wi, i: hit.seg + (dir > 0 ? 0 : 1), dir, d: 0, v: CRUISE[w.cls] * 0.6, x: hit.x, z: hit.z, h: dir > 0 ? hit.h : hit.h + Math.PI, lane: rnd(), wheels: ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'].map(n => obj.getObjectByName(n)), spin: 0, len: obj.userData.length || 4.6 };
    // start part-way along the segment
    const p = w.pts, j = c.i + dir; c.d = Math.hypot(p[j * 2] - p[c.i * 2], p[j * 2 + 1] - p[c.i * 2 + 1]) * (dir > 0 ? hit.t : 1 - hit.t);
    this.cars.push(c); this._place(c, 1);
  }

  _spawnParked(px, pz) {
    const hit = this._pickSpot(px, pz, 60, 380, 5); if (!hit || hit.way.cls < 3) return;
    const w = hit.way, side = rnd() < 0.5 ? 1 : -1, off = w.w / 2 - 1.1;
    const x = hit.x - Math.cos(hit.h) * off * side, z = hit.z + Math.sin(hit.h) * off * side;
    for (const c of this.parked) if (Math.hypot(c.x - x, c.z - z) < 7) return;
    const type = ['sedan', 'suv', 'sedan', 'van', 'sports', 'sedan'][Math.floor(rnd() * 6)], color = CAR_COLORS[Math.floor(rnd() * CAR_COLORS.length)];
    this.addParked(type, color, x, z, side > 0 ? hit.h : hit.h + Math.PI);
  }
  addParked(type, color, x, z, h) { const obj = makeCarObject(type, color); obj.position.set(x, 0, z); obj.rotation.y = h; this.scene.add(obj); const c = { obj, type, color, x, z, h, len: obj.userData.length || 4.6 }; this.parked.push(c); return c; }

  _spawnPed(px, pz) {
    const hit = this._pickSpot(px, pz, 40, 260, 7); if (!hit || hit.way.cls < 2) return;
    const presets = personPresets(), lm = this.world.landmarks.at(hit.x, hit.z, 350);
    let pre = presets[Math.floor(rnd() * presets.length)];
    if (lm && lm.cat === '古迹' && rnd() < 0.5) { const hf = presets.filter(p => p.style === 'hanfu'); pre = hf[Math.floor(rnd() * hf.length)] || pre; }
    const obj = makePersonObject(pre); this.scene.add(obj);
    const w = hit.way, dir = rnd() < 0.5 ? 1 : -1;
    const p = { obj, wi: hit.wi, i: hit.seg + (dir > 0 ? 0 : 1), dir, d: 0, v: obj.userData.walkSpeed || 1.1 + rnd() * 0.6, side: rnd() < 0.5 ? 1 : -1, off: w.cls === 7 ? (rnd() - 0.5) * w.w * 0.7 : w.w / 2 + 1.6 + rnd() * 1.2, phase: rnd() * 6, x: hit.x, z: hit.z, h: 0 };
    const q = w.pts, j = p.i + dir; p.d = Math.hypot(q[j * 2] - q[p.i * 2], q[j * 2 + 1] - q[p.i * 2 + 1]) * (dir > 0 ? hit.t : 1 - hit.t);
    this.peds.push(p);
  }

  /** advance an agent along its way; returns false if it ran out of road */
  _advance(a, dist, isCar) {
    const R = this.roads;
    for (let guard = 0; guard < 8; guard++) {
      const w = R.ways[a.wi], p = w.pts, j = a.i + a.dir;
      if (j < 0 || j >= w.n) return false;
      const L = Math.hypot(p[j * 2] - p[a.i * 2], p[j * 2 + 1] - p[a.i * 2 + 1]);
      if (a.d + dist < L) { a.d += dist; return true; }
      dist -= L - a.d; a.d = 0; a.i = j;
      // at node j: maybe turn onto a linked way
      const atEnd = (j + a.dir < 0 || j + a.dir >= w.n), links = R.links(a.wi, j), opts = [];
      for (const [wj, pj] of links) { const w2 = R.ways[wj]; if (isCar && (w2.cls === 7 || w2.cls > 5 && w2.cls !== 6)) continue; if (pj < w2.n - 1) opts.push([wj, pj, 1]); if (pj > 0 && (!isCar || !w2.oneway)) opts.push([wj, pj, -1]); }
      if (opts.length && (atEnd || rnd() < 0.3)) { const o = opts[Math.floor(rnd() * opts.length)]; a.wi = o[0]; a.i = o[1]; a.dir = o[2]; a.turned = 1; }
      else if (atEnd) { if (isCar && w.oneway) return false; a.dir = -a.dir; a.turned = 1; }
    }
    return true;
  }

  _place(c, k) {
    const w = this.roads.ways[c.wi], p = w.pts, j = clamp(c.i + c.dir, 0, w.n - 1);
    const ax = p[c.i * 2], az = p[c.i * 2 + 1], dx = p[j * 2] - ax, dz = p[j * 2 + 1] - az, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
    const lanes = Math.max(1, Math.round((w.w - 1.5) / 3.5)), per = w.oneway ? lanes : Math.max(1, lanes >> 1);
    const li = Math.min(per - 1, Math.floor(c.lane * per)), off = w.oneway ? (li + 0.5) * (w.w / lanes) - w.w / 2 : (li + 0.5) * (w.w / 2 / per);
    const tx = ax + ux * c.d - uz * off, tz = az + uz * c.d + ux * off; // right-hand traffic
    c.x += (tx - c.x) * k; c.z += (tz - c.z) * k; c.h = angLerp(c.h, Math.atan2(ux, uz), k);
    c.obj.position.set(c.x, 0, c.z); c.obj.rotation.y = c.h;
  }

  update(dt, player) {
    const px = player.px, pz = player.pz, R = this.roads;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.12;
      if (this.cars.length < this.maxCars) this._spawnCar(px, pz);
      if (this.peds.length < this.maxPeds) this._spawnPed(px, pz);
      if (this.parked.length < this.maxParked && rnd() < 0.4) this._spawnParked(px, pz);
    }
    // cars
    for (let n = this.cars.length - 1; n >= 0; n--) {
      const c = this.cars[n], w = R.ways[c.wi];
      let target = CRUISE[w.cls] * (0.85 + (c.lane * 0.3));
      const fx = Math.sin(c.h), fz = Math.cos(c.h);
      const ahead = (ox, oz, rad) => { const dx = ox - c.x, dz = oz - c.z, f = dx * fx + dz * fz, s = Math.abs(dx * fz - dz * fx); return f > 0 && f < 7 + c.v * 1.3 + rad && s < 1.7 + rad * 0.4 ? f : 0; };
      let block = ahead(px, pz, player.vehicle ? 2.4 : 0.6);
      for (const o of this.cars) { if (o === c) continue; if (Math.abs(o.x - c.x) > 40 || Math.abs(o.z - c.z) > 40) continue; const f = ahead(o.x, o.z, 2.2); if (f && (!block || f < block)) block = f; }
      if (block) target = block < 7 + c.len * 0.5 ? 0 : Math.min(target, block * 0.5);
      c.v += clamp(target - c.v, -9 * dt, 3 * dt); if (c.v < 0) c.v = 0;
      const ok = this._advance(c, c.v * dt, true);
      const far = Math.hypot(c.x - px, c.z - pz);
      if (!ok || far > 700) { this.scene.remove(c.obj); this.cars.splice(n, 1); continue; }
      this._place(c, clamp(dt * 5, 0, 1));
      c.spin += c.v * dt / 0.33; for (const wh of c.wheels) if (wh) wh.rotation.x = c.spin;
    }
    // pedestrians
    for (let n = this.peds.length - 1; n >= 0; n--) {
      const p = this.peds[n];
      const ok = this._advance(p, p.v * dt, false), w = R.ways[p.wi], q = w.pts, j = clamp(p.i + p.dir, 0, w.n - 1);
      const ax = q[p.i * 2], az = q[p.i * 2 + 1], dx = q[j * 2] - ax, dz = q[j * 2 + 1] - az, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
      const off = (w.cls === 7 ? p.off : (w.w / 2 + 2.2)) * (w.cls === 7 ? 1 : p.side * p.dir);
      const tx = ax + ux * p.d - uz * off, tz = az + uz * p.d + ux * off, k = clamp(dt * 3, 0, 1);
      p.x += (tx - p.x) * k; p.z += (tz - p.z) * k; p.h = angLerp(p.h, Math.atan2(ux, uz), k);
      if (!ok || Math.hypot(p.x - px, p.z - pz) > 420) { this.scene.remove(p.obj); this.peds.splice(n, 1); continue; }
      p.phase += dt * 6.5; animateWalk(p.obj, p.phase, 0.5);
      p.obj.position.set(p.x, 0, p.z); p.obj.rotation.y = p.h;
    }
    for (let n = this.parked.length - 1; n >= 0; n--) { const c = this.parked[n]; if (!c.keep && Math.hypot(c.x - px, c.z - pz) > 520) { this.scene.remove(c.obj); this.parked.splice(n, 1); } }
  }

  /** nearest car (moving or parked) the player could get into */
  nearestCar(x, z, maxD = 4.5) {
    let best = null, bd = maxD;
    for (const list of [this.parked, this.cars]) for (const c of list) { const d = Math.hypot(c.x - x, c.z - z) - c.len * 0.35; if (d < bd) { bd = d; best = c; } }
    return best;
  }
  /** remove a car from traffic so the player can take it over; returns {type,color,x,z,h} */
  take(c) {
    for (const list of [this.parked, this.cars]) { const i = list.indexOf(c); if (i >= 0) list.splice(i, 1); }
    this.scene.remove(c.obj); return c;
  }
  /** circle test vs NPC cars (for the player's car bumping into traffic) */
  carNear(x, z, r) { for (const list of [this.cars, this.parked]) for (const c of list) if (Math.hypot(c.x - x, c.z - z) < r + c.len * 0.4) return c; return null; }
}
