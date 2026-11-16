// Headless screenshots + frame-time measurement for the game (real GPU via ANGLE/Metal).
// Usage: node tools/shots.mjs <outDir> [--port 5199] [--q high] [--only lineup,street,drive,peds,night]
// Needs playwright-core (not a project dependency): set PLAYWRIGHT=/path/to/node_modules/playwright-core, default is the
// copy in ~/Claude/mahjong-3d/tools. Prints one JSON line per scene: { scene, renderMs, frameMs, calls, tris }.
//   renderMs = median of gfx.render() + a 1-pixel readback (forces the GPU to finish) on the frozen scene
//   frameMs  = median requestAnimationFrame interval of the live game with vsync / frame limit off
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const argv = process.argv.slice(2), out = resolve(argv[0] || 'shots');
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const port = opt('port', '5199'), q = opt('q', 'high'), only = opt('only', '').split(',').filter(Boolean), extra = opt('query', '');
const pw = process.env.PLAYWRIGHT || join(homedir(), 'Claude/mahjong-3d/tools/node_modules/playwright-core');
const { chromium } = (await import(pathToFileURL(join(pw, 'index.js')).href)).default;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--enable-gpu-rasterization'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
await page.goto(`http://localhost:${port}/?q=${q}${extra ? '&' + extra : ''}`);
await page.waitForFunction(() => window.__game && document.getElementById('loading').classList.contains('done'), null, { timeout: 180000 });
await page.evaluate(() => { __game._manualQ = true; });
const sleep = ms => page.waitForTimeout(ms);
const want = n => !only.length || only.includes(n);

async function settle(ms = 2500) { await page.evaluate(() => { __game._warm = 60; }); await sleep(ms); }
async function measure(scene) {
  const frameMs = await page.evaluate(() => new Promise(res => { const t = []; let last = performance.now(), n = 0; const f = () => { const now = performance.now(); t.push(now - last); last = now; if (++n < 240) requestAnimationFrame(f); else { t.sort((a, b) => a - b); res(+t[t.length >> 1].toFixed(2)); } }; requestAnimationFrame(f); }));
  const r = await page.evaluate(() => {
    const g = __game, gl = g.renderer.getContext(), px = new Uint8Array(4), t = [];
    for (let i = 0; i < 90; i++) { const t0 = performance.now(); g.gfx.render(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); t.push(performance.now() - t0); }
    t.splice(0, 10); t.sort((a, b) => a - b);
    const info = g.renderer.info; info.autoReset = false; info.reset(); g.gfx.render(); const calls = info.render.calls, tris = info.render.triangles; info.autoReset = true;
    return { renderMs: +t[t.length >> 1].toFixed(2), calls, tris, cars: g.traffic.cars.length, parked: g.traffic.parked.length, peds: g.traffic.peds.length };
  });
  console.log(JSON.stringify({ scene, frameMs, ...r }));
}
async function shot(name) { await page.screenshot({ path: join(out, name + '.jpg'), type: 'jpeg', quality: 90 }); }

// 1. every car type in a row + a few pedestrians, close up, on a wide road with the traffic switched off (identical before / after)
if (want('lineup')) {
  await page.evaluate(async () => {
    const g = __game, A = await import('/src/game/actors.js'), p = g.player;
    const r = g.roads.nearest(p.x, p.z + 400, 600, 2) || g.roads.nearest(p.x, p.z, 900, 3); g.teleportTo(r.x, r.z, r.h); p.obj.visible = false;
    g._maxCars = g.traffic.maxCars; g.traffic.maxCars = 0; g.traffic.maxParked = 0; for (const l of [g.traffic.cars, g.traffic.parked]) { for (const c of l) c.obj.parent.remove(c.obj); l.length = 0; }
    const fx = Math.sin(r.h), fz = Math.cos(r.h), sx = Math.cos(r.h), sz = -Math.sin(r.h);
    const W = g._W = (dx, dz, y) => [r.x + fx * (dx - 12) + sx * (dz - 6), y, r.z + fz * (dx - 12) + sz * (dz - 6)];   // row axis = along the road, camera side = +dz
    const face = a => Math.atan2(fx * Math.sin(a) + sx * Math.cos(a), fz * Math.sin(a) + sz * Math.cos(a));
    const types = ['sedan', 'suv', 'taxi', 'police', 'sports', 'van', 'bus', 'truck'], cols = [0x2c5aa0, 0x1f1f22, 0xffffff, 0xffffff, 0xc0392b, 0xbdc3c7, 0x2e7d5b, 0xf2f2f2];
    let x = 0; g._lineup = [];
    types.forEach((t, i) => { const q = W(x, 0, 0), c = g.traffic.addParked(t, cols[i], q[0], q[2], face(0.35)); c.keep = true; g._lineup.push(c); x += (t === 'bus' ? 4.6 : t === 'truck' ? 3.6 : 3.1) + (types[i + 1] === 'bus' ? 1.2 : 0); });
    const pre = A.personPresets(); g._lineupPeds = [];
    [0, 1, 4, 3, 8, 10, 2, 5].forEach((k, i) => { const o = A.makePersonObject(pre[k]), q = W(2 + i * 1.6, 6.5, 0); o.position.set(q[0], 0, q[2]); o.rotation.y = face(0.2 + (i % 3) * 0.25); g.scene.getObjectByName('actors').add(o); o.userData._walk = i % 2 === 0; g._lineupPeds.push(o); });
    g._pedTick = setInterval(() => { const t = performance.now() / 1000; for (const o of g._lineupPeds) A.animateWalk(o, o.userData._walk ? t * 6.5 : 0, o.userData._walk ? 0.5 : 0); }, 16);
    g._cam = (a, b) => { g.debugCam = [...W(a[0], a[2], a[1]), ...W(b[0], b[2], b[1])]; };
    g._cam([10, 3.2, 19], [11, 0.6, 0]);
  });
  await settle(4000); await shot('01_车辆和行人阵列'); await measure('lineup');
  await page.evaluate(() => __game._cam([1.5, 1.7, 9.5], [7.5, 0.7, 0])); await sleep(700); await shot('02_近看_轿车SUV出租警车');
  await page.evaluate(() => __game._cam([15.5, 2.0, 11], [21, 0.9, 0])); await sleep(700); await shot('03_近看_跑车面包车公交货车');
  await page.evaluate(() => __game._cam([7.5, 1.5, 11.5], [7.5, 1.0, 6.5])); await sleep(700); await shot('04_近看_行人');
  await page.evaluate(() => __game._cam([3.2, 1.5, -6.5], [4.6, 0.8, 0])); await sleep(700); await shot('04b_近看_车尾');
  await page.evaluate(() => { __game.gfx.setNight(true); __game._cam([10, 2.4, 15], [11, 0.6, 0]); }); await sleep(1500); await shot('04c_夜晚_车灯'); await page.evaluate(() => __game.gfx.setNight(false)); await sleep(300);
  await page.evaluate(() => { const g = __game; g.debugCam = null; clearInterval(g._pedTick); for (const c of g._lineup) { c.obj.parent.remove(c.obj); const i = g.traffic.parked.indexOf(c); if (i >= 0) g.traffic.parked.splice(i, 1); } for (const o of g._lineupPeds) o.parent.remove(o); g.traffic.maxCars = g._maxCars; g.traffic.maxParked = 22; g.player.obj.visible = true; });
}

// 2. street at eye level with live traffic
if (want('street')) {
  await page.evaluate(() => { const g = __game, r = g.roads.nearest(g.player.x, g.player.z + 400, 600, 2) || g.roads.nearest(g.player.x, g.player.z, 900, 3); g.teleportTo(r.x, r.z, r.h); g._street = [r.x, r.z, r.h, r.way.w];
    // a few parked cars along both kerbs so the comparison always has vehicles near the camera
    const T = ['sedan', 'suv', 'van', 'taxi', 'sports', 'truck', 'sedan', 'bus'], C = [0xbdc3c7, 0x1f1f22, 0xf2f2f2, 0xffffff, 0xc0392b, 0xf2f2f2, 0x2c5aa0, 0x2e7d5b], fx = Math.sin(r.h), fz = Math.cos(r.h), sx = Math.cos(r.h), sz = -Math.sin(r.h);
    T.forEach((t, i) => { const side = i % 2 ? 1 : -1, o = (r.way.w / 2 - 1.6) * side, d = 9 + Math.floor(i / 2) * 11 + (i % 2) * 4; const c = g.traffic.addParked(t, C[i], r.x + sx * o + fx * d, r.z + sz * o + fz * d, side > 0 ? r.h + Math.PI : r.h); c.keep = true; });
  });
  await settle(14000);
  await page.evaluate(() => { const g = __game, [x, z, h, w] = g._street, sx = Math.cos(h), sz = -Math.sin(h), o = w / 2 - 4.2; g.debugCam = [x + sx * o - Math.sin(h) * 6, 1.7, z + sz * o - Math.cos(h) * 6, x + Math.sin(h) * 60, 1.2, z + Math.cos(h) * 60]; g.player.obj.visible = false; });
  await sleep(1200); await shot('05_街道_人眼高度'); await measure('street');
  await page.evaluate(() => { const g = __game, [x, z, h] = g._street; g.debugCam = [x - Math.sin(h) * 20, 9, z - Math.cos(h) * 20, x + Math.sin(h) * 40, 0, z + Math.cos(h) * 40]; });
  await sleep(800); await shot('06_街道_低空');
  await page.evaluate(() => { const g = __game; g.debugCam = null; g.player.obj.visible = true; });
}

// 3. walking player (third person) and driving
if (want('drive')) {
  await page.evaluate(() => { const g = __game; g.cam.yaw = g.player.h + 2.4; g.cam.snap(); });
  await page.keyboard.down('KeyW'); await sleep(1500); await shot('07_步行_第三人称'); await page.keyboard.up('KeyW');
  const res = await page.evaluate(() => {
    const g = __game, p = g.player, v = g.myCars[0];
    p.x = v.x + Math.cos(v.h) * (v.wid / 2 + 0.8); p.z = v.z - Math.sin(v.h) * (v.wid / 2 + 0.8); p.sync(); g.toggleCar();
    const ok = !!p.vehicle; const r = g.roads.nearest(p.px, p.pz + 400, 600, 2) || g.roads.nearest(p.px, p.pz, 900, 3); g.teleportTo(r.x, r.z, r.h); return { ok, type: p.vehicle && p.vehicle.type };
  });
  await settle(5000);
  await page.keyboard.down('KeyW'); await sleep(3500);
  await shot('08_驾驶视角'); await measure('drive');
  const sp = await page.evaluate(() => Math.round(__game.player.vehicle.v * 3.6));
  await page.keyboard.up('KeyW');
  await page.evaluate(() => { const g = __game, v = g.player.vehicle; g.debugCam = [v.x + Math.sin(v.h + 0.7) * 6.5, 1.6, v.z + Math.cos(v.h + 0.7) * 6.5, v.x, 0.8, v.z]; v.v = 0; });
  await sleep(700); await shot('09_自己的车_近看');
  await page.evaluate(() => { __game.debugCam = null; __game.player.vehicle.v = 0; });
  await sleep(400);
  const out2 = await page.evaluate(() => { const g = __game; g.toggleCar(); return { exited: !g.player.vehicle, visible: g.player.obj.visible }; });
  console.log(JSON.stringify({ scene: 'drive-check', entered: res.ok, type: res.type, kmh: sp, ...out2 }));
}

// 4. regression: map teleport, night, quality levels
if (want('regress')) {
  await page.keyboard.press('KeyM'); await sleep(500);
  const mapOpen = await page.evaluate(() => __game.hud.mapOpen); await shot('10_大地图');
  await page.evaluate(() => { __game.teleport('lijingmen'); __game.hud.toggleMap(false); });
  await settle(9000); await shot('11_传送_丽景门');
  await page.evaluate(() => __game.gfx.setNight(true)); await sleep(1500); await shot('12_夜景'); await page.evaluate(() => __game.gfx.setNight(false));
  for (const ql of ['medium', 'low', 'high']) { await page.evaluate(q => __game.setQuality(q, true), ql); await sleep(1200); if (ql !== 'high') await shot('13_画质_' + ql); }
  const st = await page.evaluate(() => { const g = __game; return { cars: g.traffic.cars.length, parked: g.traffic.parked.length, peds: g.traffic.peds.length, minimap: !!document.getElementById('minimap') }; });
  console.log(JSON.stringify({ scene: 'regress', mapOpen, ...st }));
}

console.log(JSON.stringify({ errors: [...new Set(errors)].slice(0, 30) }));
await browser.close();
