// Railways (tracks + running trains) and airport traffic (parked + taking off / landing airliners).
import * as THREE from 'three';
import { addRibbon, ribbonMesh, newOut, decalMat, canvasTex, makePath, clamp } from '../core/util.js';
import kit from '../landmarks/_kit.js';

function fallbackCar(len, color) { const g = new THREE.Group(); g.add(kit.box(3.2, 3.6, len - 0.6, kit.mat(color), 0, 0.5, 0)); g.add(kit.box(3.25, 0.9, len - 3, kit.mat(0x22303c), 0, 2.4, 0)); return g; }

class Train {
  constructor(scene, path, cars, opts) {
    Object.assign(this, { path, cars, vmax: 55, acc: 0.9, dwell: 18, stops: [], gap: 0.6, ...opts });
    this.group = new THREE.Group(); scene.add(this.group);
    this.lens = cars.map(c => c.userData.length || 25);
    for (const c of cars) this.group.add(c);
    this.total = this.lens.reduce((a, b) => a + b + this.gap, 0);
    this.s = this.startS ?? this.total + 50; this.v = 0; this.dir = 1; this.wait = 2; this.nextStop = 0;
    this._o = { x: 0, z: 0, h: 0 };
    this.place();
  }
  place() {
    let off = 0;
    for (let i = 0; i < this.cars.length; i++) {
      const L = this.lens[i], s = this.s - this.dir * (off + L / 2); off += L + this.gap;
      const o = this.path.at(s, this._o), c = this.cars[i];
      c.position.set(o.x, 0.18, o.z); c.rotation.y = o.h + (this.dir < 0 ? Math.PI : 0);
    }
    const o = this.path.at(this.s, this._o); this.x = o.x; this.z = o.z;
  }
  update(dt, cx, cz) {
    if (this.wait > 0) { this.wait -= dt; }
    else {
      // distance to the next stopping point ahead (station or end of line)
      const end = this.dir > 0 ? this.path.len - 20 : this.total + 20;
      let target = end;
      for (const st of this.stops) { const sp = st + this.dir * this.total / 2; if ((sp - this.s) * this.dir > 1 && (sp - this.s) * this.dir < (target - this.s) * this.dir) target = sp; }
      const dist = (target - this.s) * this.dir, vStop = Math.sqrt(Math.max(0, 2 * this.acc * dist));
      this.v = Math.min(this.vmax, vStop + 0.3, this.v + this.acc * dt);
      this.s += this.dir * this.v * dt;
      if (dist < 0.6) { this.v = 0; if (target === end) { this.dir *= -1; this.cars.reverse(); this.lens.reverse(); this.s = this.dir > 0 ? this.total + 20 : this.path.len - 20; this.wait = 6; } else { this.s = target; this.wait = this.dwell; } }
    }
    this.place();
    this.group.visible = Math.hypot(this.x - cx, this.z - cz) < 3200;
  }
}

export class Transit {
  constructor(scene, rails, areas, landmarks) {
    this.scene = scene; this.trains = []; this.planes = []; this.landmarks = landmarks;
    // ── tracks ──
    const ballast = newOut(), track = newOut();
    for (const [flags, pts] of rails.ways) { addRibbon(ballast, pts, flags & 1 ? 5.6 : 5, 0, 10); addRibbon(track, pts, 3.2, 0, 3); }
    const g = new THREE.Group(); g.name = 'rails'; scene.add(g);
    const b = ribbonMesh(ballast, decalMat({ color: 0x8b857a }), -25); b.frustumCulled = false; g.add(b);
    const t = ribbonMesh(track, decalMat({ map: canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#857f74'; c.fillRect(0, 0, w, h); c.fillStyle = '#5b5148'; for (let y = 2; y < h; y += 13) c.fillRect(4, y, w - 8, 6); c.fillStyle = '#c9ccd0'; c.fillRect(15, 0, 4, h); c.fillRect(w - 19, 0, 4, h); }) }), -24.5); t.frustumCulled = false; g.add(t);
    this.routes = {}; for (const k in rails.routes) if (rails.routes[k].pts.length >= 4) this.routes[k] = makePath(rails.routes[k].pts);
    this.runway = areas.runways[0] ? makePath(areas.runways[0].pts) : null;
  }

  nearestS(path, x, z) { let bs = 0, bd = 1e9; const o = { x: 0, z: 0, h: 0 }; for (let s = 0; s <= path.len; s += 10) { path.at(s, o); const d = Math.hypot(o.x - x, o.z - z); if (d < bd) { bd = d; bs = s; } } return { s: bs, d: bd }; }

  async init() {
    let T = null, P = null;
    try { T = await import('../models/trains.js'); } catch (e) { console.warn('trains model missing', e); }
    try { P = await import('../models/planes.js'); } catch (e) { console.warn('planes model missing', e); }
    const hsrCar = k => { try { return T.buildHSRCar(k); } catch { const c = fallbackCar(25, 0xf0f0f0); c.userData.length = 25; return c; } };
    const trCar = k => { try { return T.buildTrainCar(k); } catch { const c = fallbackCar(25, k === 'loco' ? 0xb03020 : 0x2f5a3a); c.userData.length = 25; return c; } };
    const lm = id => this.landmarks.byId.get(id);
    if (this.routes.hsr) {
      const st = lm('longmen_station'), stop = st ? this.nearestS(this.routes.hsr, st.x, st.z) : null;
      this.hsrStop = stop;
      const cars = ['head', 'mid', 'mid', 'mid', 'mid', 'mid', 'mid', 'tail'].map(hsrCar);
      this.trains.push(new Train(this.scene, this.routes.hsr, cars, { vmax: 62, acc: 0.8, stops: stop && stop.d < 400 ? [stop.s] : [], startS: stop ? Math.max(300, stop.s - 1500) : 500, name: '复兴号' }));
    }
    if (this.routes.longhai) {
      const st = lm('luoyang_station'), stop = st ? this.nearestS(this.routes.longhai, st.x, st.z) : null;
      this.lhStop = stop;
      const cars = ['loco', ...Array(10).fill('coach')].map(trCar);
      this.trains.push(new Train(this.scene, this.routes.longhai, cars, { vmax: 30, acc: 0.45, stops: stop && stop.d < 400 ? [stop.s] : [], startS: stop ? Math.max(400, stop.s - 900) : 500, name: '陇海线列车' }));
    }
    // ── planes ──
    const mk = i => { try { return P.buildAirliner(i); } catch { const p = new THREE.Group(); p.add(kit.box(3.8, 3.8, 37, kit.mat(0xf2f2f2), 0, 2.5, 0)); p.add(kit.box(34, 0.5, 5, kit.mat(0xdddddd), 0, 3, 0)); p.add(kit.box(0.5, 6, 5, kit.mat([0xc0392b, 0x2a5caa, 0x2e8b57][i % 3]), 0, 6, -16)); return p; } };
    const ap = lm('airport');
    if (ap) for (let i = 0; i < 3; i++) { const p = mk(i); const [x, z] = this.landmarks.toWorld(ap, -48 + i * 48, -92); p.position.set(x, 0, z); p.rotation.y = ap.rot; this.scene.add(p); this.parked = (this.parked || []).concat(p); }
    if (this.runway && this.runway.len > 1500) {
      this.flyer = mk(1); this.flyer.rotation.order = 'YXZ'; this.scene.add(this.flyer);
      this.fly = { mode: 'wait', t: 6, s: 0, v: 0, alt: 0, n: 0 };
    }
  }

  update(dt, cx, cz) {
    for (const t of this.trains) t.update(dt, cx, cz);
    const f = this.fly; if (!f) return;
    const P = this.runway, o = this._o || (this._o = { x: 0, z: 0, h: 0 }), pl = this.flyer;
    // extended centre-line parameterisation: s may run outside [0, len]
    const at = (s) => { P.at(clamp(s, 0, P.len), o); if (s < 0) { const a = P.at(0, { x: 0, z: 0, h: 0 }); o.x = a.x + Math.sin(a.h) * s; o.z = a.z + Math.cos(a.h) * s; o.h = a.h; } else if (s > P.len) { const a = P.at(P.len, { x: 0, z: 0, h: 0 }); o.x = a.x + Math.sin(a.h) * (s - P.len); o.z = a.z + Math.cos(a.h) * (s - P.len); o.h = a.h; } return o; };
    if (f.mode === 'wait') { pl.visible = false; f.t -= dt; if (f.t <= 0) { f.n++; if (f.n % 2) { f.mode = 'takeoff'; f.s = 120; f.v = 0; f.alt = 0; f.pitch = 0; } else { f.mode = 'landing'; f.s = -5200; f.v = 72; f.alt = (5200 + 350) * 0.052; f.pitch = 0.03; } } return; }
    pl.visible = true;
    if (f.mode === 'takeoff') {
      f.v = Math.min(95, f.v + 2.6 * dt); f.s += f.v * dt;
      if (f.v > 72) { f.pitch = Math.min(0.2, f.pitch + 0.08 * dt); f.alt += f.v * Math.sin(f.pitch) * dt; }
      if (f.s > P.len + 6500 || f.alt > 900) { f.mode = 'wait'; f.t = 35; }
    } else {
      f.s += f.v * dt;
      if (f.alt > 0) { f.alt = Math.max(0, f.alt - f.v * 0.052 * dt); if (f.alt < 12) f.pitch = Math.min(0.09, f.pitch + 0.05 * dt); }
      else { f.pitch = Math.max(0, f.pitch - 0.06 * dt); f.v = Math.max(0, f.v - 2.4 * dt); if (f.v < 6 || f.s > P.len - 150) { f.mode = 'wait'; f.t = 30; } }
    }
    at(f.s); pl.position.set(o.x, f.alt, o.z); pl.rotation.set(-f.pitch, o.h, 0);
  }
}
