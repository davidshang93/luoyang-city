// Validate landmark / model modules under Node (no browser needed).
// Usage: node tools/check-landmark.mjs <id> [<id> ...]      (ids from src/data/landmarks.json)
//        node tools/check-landmark.mjs --all
import { readFileSync, existsSync } from 'node:fs';
import * as THREE from 'three';

const reg = JSON.parse(readFileSync(new URL('../src/data/landmarks.json', import.meta.url)));
let ids = process.argv.slice(2);
if (ids[0] === '--all') ids = reg.map(r => r.id);
if (!ids.length) { console.log('usage: node tools/check-landmark.mjs <id> ... | --all'); process.exit(1); }
let failed = 0;
for (const id of ids) {
  const entry = reg.find(r => r.id === id);
  const url = new URL(`../src/landmarks/${id}.js`, import.meta.url);
  const problems = [], notes = [];
  if (!entry) problems.push('id not in src/data/landmarks.json');
  if (!existsSync(url)) { console.log(`✗ ${id}: file src/landmarks/${id}.js missing`); failed++; continue; }
  try {
    const mod = await import(url.href + '?t=' + Date.now());
    if (typeof mod.build !== 'function') throw new Error('module must export function build(kit)');
    const kit = (await import(new URL('../src/landmarks/_kit.js', import.meta.url).href)).default;
    const t0 = performance.now();
    const g = mod.build(kit);
    const ms = performance.now() - t0;
    if (!g || !g.isObject3D) throw new Error('build() must return a THREE.Object3D (use `return finalize(group)`)');
    g.updateMatrixWorld(true);
    let tris = 0, meshes = 0, nan = false;
    g.traverse(o => { if (o.isMesh) { meshes++; const p = o.geometry.attributes.position; tris += (o.geometry.index ? o.geometry.index.count : p.count) / 3; for (let i = 0; i < p.array.length; i += 97) if (!Number.isFinite(p.array[i])) nan = true; } });
    const bb = new THREE.Box3().setFromObject(g), size = bb.getSize(new THREE.Vector3());
    if (nan) problems.push('geometry contains NaN');
    if (meshes > 80) problems.push(`too many draw calls: ${meshes} meshes (limit 80) — did you return finalize(group)? too many signs/keep objects?`);
    if (tris > 300000) problems.push(`too many triangles: ${Math.round(tris)} (limit 300k)`);
    if (tris < 150) problems.push(`suspiciously simple: only ${Math.round(tris)} triangles`);
    if (bb.min.y < -3) problems.push(`geometry goes below ground: minY=${bb.min.y.toFixed(1)}`);
    if (entry) {
      const overX = Math.max(-bb.min.x, bb.max.x) - entry.w / 2, overZ = Math.max(-bb.min.z, bb.max.z) - entry.d / 2;
      if (overX > entry.w * 0.08 + 3 || overZ > entry.d * 0.08 + 3) problems.push(`exceeds footprint ${entry.w}x${entry.d}: bbox x[${bb.min.x.toFixed(0)},${bb.max.x.toFixed(0)}] z[${bb.min.z.toFixed(0)},${bb.max.z.toFixed(0)}]`);
      if (size.x < entry.w * 0.3 && size.z < entry.d * 0.3) notes.push(`much smaller than footprint (${size.x.toFixed(0)}x${size.z.toFixed(0)} vs ${entry.w}x${entry.d})`);
    }
    const meta = mod.meta || {};
    if (!Array.isArray(meta.colliders)) problems.push('export const meta = { colliders: [...] } is required (may be an empty array)');
    else for (const c of meta.colliders) if (![c.x, c.z, c.w, c.d].every(Number.isFinite)) problems.push('collider needs numeric x, z, w, d: ' + JSON.stringify(c));
    const ok = problems.length === 0;
    if (!ok) failed++;
    console.log(`${ok ? '✓' : '✗'} ${id}: size ${size.x.toFixed(0)} x ${size.y.toFixed(0)}(h) x ${size.z.toFixed(0)} m, ${Math.round(tris)} tris, ${meshes} meshes, ${(meta.colliders || []).length} colliders, build ${ms.toFixed(0)}ms`);
    for (const p of problems) console.log('    PROBLEM: ' + p);
    for (const n of notes) console.log('    note: ' + n);
  } catch (e) { failed++; console.log(`✗ ${id}: ${e.stack || e}`); }
}
process.exit(failed ? 1 : 0);
