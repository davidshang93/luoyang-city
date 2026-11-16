// 洛阳城 — boot + main loop. Rendering (HDR sky, PBR, shadows, AO, bloom, quality levels, night) lives in core/gfx.js.
import * as THREE from 'three';
import { createGfx, QUALITY } from './core/gfx.js';
import { Roads } from './world/roads.js';
import { Areas } from './world/areas.js';
import { Buildings } from './world/buildings.js';
import { Landmarks } from './world/landmarks.js';
import { Transit } from './world/transit.js';
import { Props } from './world/props.js';
import { Player, Vehicle, ChaseCamera, loadModels } from './game/actors.js';
import { Traffic } from './game/traffic.js';
import { Hud } from './ui/hud.js';
import { clamp } from './core/util.js';

const VIEW = 1900;
const $ = (id) => document.getElementById(id);
const status = (t, p) => { $('loadText').textContent = t; $('loadBar').style.width = Math.round(p * 100) + '%'; };
// yield to the event loop without a timer (timers are throttled to 1/s in background tabs, which made loading crawl)
const nextFrame = () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });

async function boot() {
  status('下载地图数据…', 0.05);
  const [roadsD, railsD, areasD, buildD, places, facadeSpecs] = await Promise.all(['roads', 'rails', 'areas', 'buildings', 'places', 'facade-specs'].map(n => fetch(`./src/data/${n}.json`).then(r => r.json())));

  status('准备天空和光照…', 0.12);
  const params = new URLSearchParams(location.search);
  let quality = params.get('q') || localStorage.getItem('ly.quality') || 'high'; if (!QUALITY[quality]) quality = 'high';
  const gfx = await createGfx({ container: $('app'), quality, fov: 58, near: 0.6, far: 9000, fogDensity: 0.00082 });
  const { renderer, scene, camera } = gfx;

  status('铺设道路…', 0.2); await nextFrame();
  const landmarks = new Landmarks(scene, places.landmarks);
  const areas = new Areas(scene, areasD);
  const roads = new Roads(scene, roadsD);
  status('规划楼宇…', 0.4); await nextFrame();
  const buildings = new Buildings(scene, buildD.filter(b => !areas.inWater(b[2][0], b[2][1])), roads, facadeSpecs); buildings.roads = roads;   // a few footprints in the data sit in rivers / lakes
  status('种树…', 0.5); await nextFrame();
  const props = new Props(scene, roads, areas, landmarks, buildings);
  const actors = new THREE.Group(); actors.name = 'actors'; scene.add(actors);   // player, cars, pedestrians
  await props.init(renderer);
  status('准备车辆和列车…', 0.6); await nextFrame();
  await loadModels();
  const transit = new Transit(scene, railsD, areas, landmarks);
  await transit.init();

  const world = {
    roads, areas, buildings, landmarks, offroad: false,
    blocked(x, z, r) {
      if (buildings.hit(x, z) || landmarks.hit(x, z, r)) return true;
      if (areas.inWater(x, z) && !landmarks.at(x, z, 0) && !roads.onRoad(x, z, 2.5)) return true;
      return false;
    },
  };

  // ── player & vehicles ──
  const ytm = landmarks.byId.get('yingtianmen');
  const spawn = ytm ? landmarks.toWorld(ytm, 0, ytm.d / 2 + 70) : [0, 100];
  const player = new Player(actors, spawn[0], spawn[1], Math.PI);
  const cam = new ChaseCamera(camera);
  const traffic = new Traffic(actors, roads, world);
  const myCars = [];
  const game = { gfx, scene, camera, renderer, roads, areas, buildings, landmarks, transit, props, player, cam, traffic, world, myCars, fps: 60, paused: false };

  function addMyCar(type, color, x, z, h) { const v = new Vehicle(type, color, x, z, h); actors.add(v.obj); myCars.push(v); return v; }
  addMyCar('sports', 0xc0392b, spawn[0] + 6, spawn[1] - 5, Math.PI / 2);
  addMyCar('suv', 0x2c5aa0, spawn[0] - 7, spawn[1] - 5, Math.PI / 2);
  addMyCar('taxi', 0xffffff, spawn[0] + 19, spawn[1] - 5, Math.PI / 2);

  game.nearCar = () => {
    let best = null, bd = 4.5;
    for (const v of myCars) { const d = Math.hypot(v.x - player.x, v.z - player.z) - v.len * 0.35; if (d < bd) { bd = d; best = v; } }
    return best || traffic.nearestCar(player.x, player.z, bd);
  };
  game.toggleCar = () => {
    if (player.vehicle) { if (Math.abs(player.vehicle.v) < 4) { player.exit(world); cam.idle = 9; } return; }
    let c = game.nearCar(); if (!c) return;
    if (!(c instanceof Vehicle)) { const t = traffic.take(c); c = addMyCar(t.type, t.color, t.x, t.z, t.h); }
    player.enter(c); hud.toast('已上车：WASD 驾驶 · 空格手刹 · F 下车');
  };
  /** move player (and current car) to a world position, snapping to a nearby road if there is one */
  game.teleportTo = (x, z, h) => {
    const r = roads.nearest(x, z, 160, 5);
    if (r && (player.vehicle || world.blocked(x, z, 0.4))) { x = r.x; z = r.z; if (h === undefined) h = r.h; }
    if (player.vehicle) { const v = player.vehicle; v.x = x; v.z = z; v.v = 0; if (h !== undefined) { v.h = v.vh = h; } v.sync(); }
    else { player.x = x; player.z = z; if (h !== undefined) player.h = h; player.sync(); }
    if (h !== undefined) cam.yaw = h; cam.snap(); game._warm = 40;
  };
  game.teleport = (id) => {
    const l = landmarks.byId.get(id); if (!l) return false;
    const [x, z] = landmarks.toWorld(l, 0, l.d / 2 + 14);
    game.teleportTo(x, z, l.rot + Math.PI); // face the landmark's front
    hud.toast('📍 ' + l.name); return true;
  };

  const hud = game.hud = new Hud(game);
  game.setQuality = (q, manual) => { gfx.setQuality(q); if (manual) { localStorage.setItem('ly.quality', q); game._manualQ = true; } hud.toast('画质：' + QUALITY[q].label); };
  if (params.has('night')) gfx.setNight(true);

  // ── input ──
  const keys = new Set();
  addEventListener('keydown', (e) => {
    if (e.repeat) return; keys.add(e.code);
    if (e.code === 'KeyF') game.toggleCar();
    else if (e.code === 'KeyM') hud.toggleMap();
    else if (e.code === 'Escape') hud.toggleMap(false);
    else if (e.code === 'KeyH') $('help').classList.toggle('hidden');
    else if (e.code === 'KeyG') game.setQuality(['high', 'medium', 'low'][(['high', 'medium', 'low'].indexOf(gfx.quality) + 1) % 3], true);
    else if (e.code === 'KeyL') { gfx.setNight(!gfx.night); hud.toast(gfx.night ? '🌙 夜晚' : '☀️ 白天'); }
    else if (e.code === 'KeyR') { const r = roads.nearest(player.px, player.pz, 400, 5); if (r) game.teleportTo(r.x, r.z, r.h); }
    else if (e.code === 'KeyN' && !player.vehicle) { const v = addMyCar(['sedan', 'sports', 'suv', 'bus', 'police'][myCars.length % 5], [0xf2f2f2, 0xc0392b, 0x1f1f22, 0x2e7d5b, 0xffffff][myCars.length % 5], player.x + Math.sin(player.h) * 4, player.z + Math.cos(player.h) * 4, player.h + Math.PI / 2); hud.toast('已召唤一辆车，按 F 上车'); if (myCars.length > 12) { const old = myCars.shift(); actors.remove(old.obj); } }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  let drag = false;
  renderer.domElement.addEventListener('pointerdown', (e) => { drag = true; renderer.domElement.setPointerCapture(e.pointerId); });
  renderer.domElement.addEventListener('pointerup', () => { drag = false; });
  renderer.domElement.addEventListener('pointermove', (e) => { if (drag) cam.nudge(-e.movementX * 0.005, e.movementY * 0.004); });
  renderer.domElement.addEventListener('wheel', (e) => { cam.zoom(e.deltaY > 0 ? 1.12 : 0.89); e.preventDefault(); }, { passive: false });
  game.keys = keys;

  // ── warm-up: build the tiles around the spawn before showing the world ──
  status('建造应天门周边…', 0.75);
  landmarks.update(player.px, player.pz);
  for (let i = 0; i < 120; i++) { const left = buildings.update(player.px, player.pz, VIEW, 6) + props.update(player.px, player.pz, VIEW, 3); status('建造应天门周边…', 0.75 + 0.2 * (1 - Math.min(1, left / 60))); if (!left) break; await nextFrame(); }
  for (let i = 0; i < 100 && landmarks.list.some(l => l.state === 1); i++) await new Promise(r => setTimeout(r, 30));
  status('完成', 1);
  $('loading').classList.add('done');

  // ── loop ──
  const clock = new THREE.Clock(); let tSlow = 0, tLm = 0, frames = 0, fpsT = 0, time = 0, slow = 0;
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    frames++; fpsT += dt; time += dt;
    if (fpsT > 0.5) {
      game.fps = frames / fpsT; frames = 0; fpsT = 0;
      // too slow for this machine → step the quality down once (unless the player picked a level with G)
      if (!game._manualQ && document.hasFocus() && time > 8 && gfx.quality !== 'low') { slow = game.fps < 20 ? slow + 1 : 0; if (slow >= 8) { slow = 0; game.setQuality(gfx.quality === 'high' ? 'medium' : 'low'); } }
    }
    if (!hud.mapOpen) {
      const up = keys.has('KeyW') || keys.has('ArrowUp'), dn = keys.has('KeyS') || keys.has('ArrowDown'), lf = keys.has('KeyA') || keys.has('ArrowLeft'), rt = keys.has('KeyD') || keys.has('ArrowRight');
      if (keys.has('KeyQ')) cam.nudge(1.8 * dt, 0); if (keys.has('KeyE')) cam.nudge(-1.8 * dt, 0);
      const v = player.vehicle;
      if (v) {
        world.offroad = !roads.onRoad(v.x, v.z, 4) && Math.abs(v.v) > 16;
        v.drive(dt, { throttle: (up ? 1 : 0) - (dn ? 1 : 0), steer: (rt ? 1 : 0) - (lf ? 1 : 0), hand: keys.has('Space') }, world);
        // bump into traffic
        const s = Math.sign(v.v) || 1, nx = v.x + Math.sin(v.h) * v.len * 0.45 * s, nz = v.z + Math.cos(v.h) * v.len * 0.45 * s;
        if (Math.abs(v.v) > 0.5 && traffic.carNear(nx, nz, 0.9)) { v.x -= Math.sin(v.vh) * v.v * dt * 1.5; v.z -= Math.cos(v.vh) * v.v * dt * 1.5; v.v *= -0.25; v.sync(); }
      } else player.walk(dt, (rt ? 1 : 0) - (lf ? 1 : 0), (up ? 1 : 0) - (dn ? 1 : 0), keys.has('ShiftLeft') || keys.has('ShiftRight'), cam.yaw, world);
      traffic.update(dt, player);
    }
    { const d = game.debugCam; transit.update(dt, d ? d[3] : player.px, d ? d[5] : player.pz); }
    cam.update(dt, player);
    if (game.debugCam) { const d = game.debugCam; camera.position.set(d[0], d[1], d[2]); camera.lookAt(d[3], d[4], d[5]); }
    const cx = game.debugCam ? game.debugCam[3] : player.px, cz = game.debugCam ? game.debugCam[5] : player.pz;
    buildings.update(cx, cz, VIEW, game._warm > 0 ? 5 : 1); if (game._warm > 0) game._warm--;
    tSlow -= dt; if (tSlow <= 0) { tSlow = 0.25; roads.update(cx, cz, VIEW + 400); props.update(cx, cz, VIEW, game._warm > 0 ? 3 : 1); }
    areas.update(time);
    tLm -= dt; if (tLm <= 0) { tLm = 0.4; landmarks.update(cx, cz); }
    gfx.followSun(cx, 0, cz);
    hud.update(dt);
    gfx.render();
  }
  frame();
  window.__game = game;
}

boot().catch(e => { console.error(e); $('loadText').textContent = '出错了：' + (e.message || e); });
