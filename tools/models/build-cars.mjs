// Converts the raw vehicle models in assets/third_party_raw/carla_fleet24/ into game-ready GLBs in assets/models/cars/.
// Usage: node tools/models/build-cars.mjs inspect <name> <outDir>     (turnaround renders + texture dumps for checking brands)
//        node tools/models/build-cars.mjs build [name ...]            (writes assets/models/cars/<type>.glb + index.json)
// Runs the decode / rebuild in a headless browser (tools/models/carla.html, served by tools/server.mjs on --port, default 5199).
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const argv = process.argv.slice(2), mode = argv[0] || 'build';
const pi = argv.indexOf('--port'), port = pi >= 0 ? argv.splice(pi, 2)[1] : '5199';
const pw = process.env.PLAYWRIGHT || join(homedir(), 'Claude/mahjong-3d/tools/node_modules/playwright-core');
const { chromium } = (await import(pathToFileURL(join(pw, 'index.js')).href)).default;
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
page.on('console', m => { if (m.type() === 'error') console.log('[page error]', m.text()); });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:${port}/tools/models/carla.html`);
await page.waitForFunction(() => document.title === 'ready');
const shot = (file) => page.locator('#c').screenshot({ path: file, type: 'jpeg', quality: 92 });
const saveDataURL = (file, url) => writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));

if (mode === 'inspect') {
  const name = argv[1], out = resolve(argv[2] || 'inspect'); mkdirSync(out, { recursive: true });
  const info = await page.evaluate(n => api.load(n), name);
  console.log(JSON.stringify(info.lods, null, 1)); console.log(JSON.stringify(info.textures));
  const [W, H, L] = info.extras.size, d = L * 1.15, y = H * 0.5;
  const views = { front34: [W * 1.6, H * 1.1, d, 0, y, 0], rear34: [-W * 1.6, H * 1.1, -d, 0, y, 0], front: [0, y, L * 1.5, 0, y, 0], rear: [0, y, -L * 1.5, 0, y, 0], left: [L * 1.6, y, 0, 0, y, 0], right: [-L * 1.6, y, 0, 0, y, 0], top: [0.01, L * 1.7, 0, 0, 0, 0],
    frontClose: [W * 0.25, y * 1.1, L / 2 + W * 0.9, 0, y * 0.9, L / 2], rearClose: [-W * 0.25, y * 1.2, -L / 2 - W * 0.9, 0, y, -L / 2], wheelClose: [W / 2 + 1.1, 0.5, info.extras.hubs[0].p[2] + 0.3, W / 2, info.extras.hubs[0].p[1], info.extras.hubs[0].p[2]] };
  const lods = argv[3] ? argv[3].split(',') : ['LOD0', 'LOD1'];
  for (const lod of lods) for (const [v, view] of Object.entries(views)) { await page.evaluate(a => api.show(a), { lod, view }); await shot(join(out, `${name}_${lod}_${v}.jpg`)); }
  for (const t of info.textures) saveDataURL(join(out, `${name}_tex_${t.name}.png`), await page.evaluate(n => api.texture(n, 1024), t.name));
}
if (mode === 'ortho') {   // ortho <name> <out.jpg> <lod> <dir> <ch> <cv> <span> [only] [hide]
  const [, name, out, lod, dir, ch, cv, span, only, hide] = argv;
  await page.evaluate(n => api.load(n), name);
  saveDataURL(resolve(out), await page.evaluate(a => api.ortho(a), { lod, dir, c: [+ch, +cv], span: +span, only: only && only !== '-' ? only : null, hide: hide || null, grid: +span > 3 ? 0.5 : 0.1 }));
}
if (mode === 'orthos') {  // orthos <name> <outDir> <lod> : front + rear (two heights) + left side close-ups with grid
  const [, name, out, lod] = argv; mkdirSync(resolve(out), { recursive: true });
  const info = await page.evaluate(n => api.load(n), name), [W, H, L] = info.extras.size;
  for (const [tag, a] of Object.entries({ front: { dir: 'front', c: [0, H * 0.42], span: W * 1.08 }, rear: { dir: 'rear', c: [0, H * 0.45], span: W * 1.08 }, left: { dir: 'left', c: [0, H * 0.5], span: L * 1.05 }, top: { dir: 'top', c: [0, 0], span: L * 1.05 } }))
    saveDataURL(join(resolve(out), `${name}_${lod}_o_${tag}.jpg`), await page.evaluate(a => api.ortho(a), { lod, grid: tag === 'left' || tag === 'top' ? 0.5 : 0.1, ...a }));
}
if (mode === 'dumptex') {  // dumptex <outDir> [name ...] : full-resolution colour textures (input of tools/models/find_text.py)
  const out = resolve(argv[1]); mkdirSync(out, { recursive: true });
  for (const name of argv.slice(2)) { const info = await page.evaluate(n => api.load(n), name); for (const t of info.textures) if (t.slot === 'map' && t.w > 64) saveDataURL(join(out, `${name}__${t.name}.png`), await page.evaluate(n => api.texture(n, 4096), t.name)); }
}
if (mode === 'build') {
  const { readFileSync, existsSync } = await import('node:fs');
  const CFG = (await import('./cars.config.mjs')).default, outDir = join(ROOT, 'assets/models/cars'); mkdirSync(outDir, { recursive: true });
  const tb = join(ROOT, 'tools/models/text_boxes.json'), TEXT = existsSync(tb) ? JSON.parse(readFileSync(tb, 'utf8')) : {};
  const idxFile = join(outDir, 'index.json'), index = existsSync(idxFile) ? JSON.parse(readFileSync(idxFile, 'utf8')) : {};
  for (const type of argv.slice(1).length ? argv.slice(1) : Object.keys(CFG)) {
    const cfg = { type, ...CFG[type] }; cfg.ocr = {};
    for (const [k, v] of Object.entries(TEXT)) if (k.startsWith(cfg.src + '__')) cfg.ocr[k.slice(cfg.src.length + 2)] = v.map(e => e.box);
    await page.evaluate(n => api.load(n), cfg.src);
    const r = await page.evaluate(c => api.build(c), cfg);
    writeFileSync(join(outDir, type + '.glb'), Buffer.from(r.b64, 'base64'));
    index[type] = { file: type + '.glb', ...r.extras };
    console.log(`${type}: ${(r.bytes / 1024).toFixed(0)} KB, ${r.tris} tris, ${r.draws} draws\n  materials: ${r.materials.join(', ')}\n  images: ${r.images.join(', ')}\n  ` + r.log.join('\n  '));
  }
  writeFileSync(idxFile, JSON.stringify(index, null, 1));
}
if (mode === 'verify') {  // verify <outDir> [type ...] : close-up renders of the converted files
  const out = resolve(argv[1]); mkdirSync(out, { recursive: true });
  const { readFileSync } = await import('node:fs'); const index = JSON.parse(readFileSync(join(ROOT, 'assets/models/cars/index.json'), 'utf8'));
  for (const type of argv.slice(2).length ? argv.slice(2) : Object.keys(index)) {
    const e = index[type], r = await page.evaluate(u => api.loadBuilt(u), '/assets/models/cars/' + e.file), W = e.width, H = e.height, L = e.length, zc = (e.zMin + e.zMax) / 2, y = H * 0.5;
    const views = { front34: [W * 1.5, H * 1.0, zc + L * 0.95, 0, y * 0.9, zc], rear34: [-W * 1.5, H * 1.0, zc - L * 0.95, 0, y * 0.9, zc], frontClose: [W * 0.2, y * 1.0, e.zMax + W * 0.95, 0, y * 0.85, e.zMax], rearClose: [-W * 0.2, y * 1.1, e.zMin - W * 0.95, 0, y * 0.9, e.zMin], left: [L * 1.25, y, zc, 0, y, zc], wheel: [W / 2 + 1.0, 0.45, e.wheelBase / 2 + 0.25, W / 2, e.wheelRadius, e.wheelBase / 2] };
    for (const [v, view] of Object.entries(views)) { await page.evaluate(a => api.show(a), { lod: 'LOD0', view }); await shot(join(out, `${type}_${v}.jpg`)); }
    console.log(type, JSON.stringify(r));
  }
}
await browser.close();
