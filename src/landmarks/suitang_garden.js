// 隋唐城遗址植物园：湖 + 千姿牡丹园观景阁 + 九曲桥 + 牌坊大门 + 牡丹田 + 竹/松/樱花林 + 亭廊
import { THREE, C, mat, box, cyl, sphere, plaza, tangRoof, gableRoof, hall, sign, tree, lamp, patternTex, rng, finalize } from './_kit.js';

const LAKE = { x: 0, z: -10, w: 120, d: 80 };
const PAIFANG_Z = 102;

export const meta = {
  colliders: [
    { x: 0, z: -10, w: 19, d: 19 },                       // 观景阁
    { x: -9, z: PAIFANG_Z, w: 1.6, d: 1.6 },              // 牌坊柱
    { x: -3.5, z: PAIFANG_Z, w: 1.6, d: 1.6 },
    { x: 3.5, z: PAIFANG_Z, w: 1.6, d: 1.6 },
    { x: 9, z: PAIFANG_Z, w: 1.6, d: 1.6 },
  ],
};

function pavilion(g, x, z, s = 1) {
  g.add(box(7 * s, 0.5, 7 * s, mat(C.stone), x, 0.15, z));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(0.22, 0.25, 3.6, mat(C.tangRed), x + sx * 2.8 * s, 0.65, z + sz * 2.8 * s, 8));
  g.add(box(6.8 * s, 0.4, 6.8 * s, mat(C.darkWood), x, 4.25, z));
  g.add(tangRoof({ w: 10 * s, d: 10 * s, h: 3.2, ridge: 0, x, y: 4.6, z }));
}

function corridor(g, x, z, len, ry = 0) {
  const grp = new THREE.Group();
  grp.add(box(len, 0.3, 3.4, mat(C.stone), 0, 0.15, 0));
  const n = Math.round(len / 4);
  for (let i = 0; i <= n; i++) for (const sz of [-1, 1]) grp.add(cyl(0.18, 0.2, 3.1, mat(C.tangRed), -len / 2 + i * len / n, 0.45, sz * 1.4, 8));
  grp.add(box(len, 0.3, 3.4, mat(C.darkWood), 0, 3.55, 0));
  grp.add(gableRoof(len + 1, 5.2, 1.8, mat(C.tileGrey, { map: patternTex('roofTile', C.tileGrey) }), 0, 3.85, 0));
  grp.position.set(x, 0, z); grp.rotation.y = ry; g.add(grp);
}

function bamboo(g, r, cx, cz, w, d, n) {
  for (let i = 0; i < n; i++) {
    const x = cx + (r() - 0.5) * w, z = cz + (r() - 0.5) * d, h = 6 + r() * 4;
    g.add(cyl(0.07, 0.1, h, mat(0x7fa84a), x, 0, z, 5));
    g.add(sphere(0.9 + r() * 0.4, mat(i % 3 ? 0x5c9a3a : 0x6fae46), x, h - 0.3, z, 5));
  }
}

function cherry(g, x, z, h = 6) {
  g.add(cyl(h * 0.03, h * 0.05, h * 0.45, mat(C.trunk), x, 0, z, 5));
  g.add(sphere(h * 0.32, mat(0xf4b6c8), x, h * 0.62, z, 6));
  g.add(sphere(h * 0.24, mat(0xf8c9d6), x + h * 0.15, h * 0.78, z + h * 0.05, 6));
}

export function build() {
  const g = new THREE.Group();
  const r = rng(7);

  // ── 湖 ──
  g.add(plaza(LAKE.w + 4, LAKE.d + 4, mat(C.stoneDark), LAKE.x, LAKE.z, 0.15));
  g.add(plaza(LAKE.w, LAKE.d, mat(C.water, { shiny: true }), LAKE.x, LAKE.z, 0.2));
  // 湖心岛 + 双层观景阁
  g.add(cyl(14, 15, 0.5, mat(C.stone, { map: patternTex('stone', C.stone) }), 0, 0.2, LAKE.z, 24));
  const pav = hall({ w: 12, d: 12, wallH: 5, roofH: 5.5, eave: 2.2, platformH: 1.2, tiers: 2, tierShrink: 0.18, y: 0.7, z: LAKE.z });
  g.add(pav);
  g.add(sign('千姿牡丹园', 7, 1.5, { bg: '#2a1a10', fg: '#e8c15a', border: '#d4a93a', x: 0, y: 6.9, z: LAKE.z + 6.9 }));
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + 0.4; g.add(tree(Math.cos(a) * 12, LAKE.z + Math.sin(a) * 12, 4.5, 'willow', 0.5)); }

  // ── 九曲桥 ──
  const wp = [[0, 32], [0, 28], [-10, 28], [-10, 22], [10, 22], [10, 16], [-10, 16], [-10, 10], [0, 10], [0, 4]];
  for (let i = 0; i < wp.length - 1; i++) {
    const [x0, z0] = wp[i], [x1, z1] = wp[i + 1];
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, horiz = Math.abs(dx) > Math.abs(dz);
    g.add(box(horiz ? len + 2.6 : 2.6, 0.35, horiz ? 2.6 : len + 2.6, mat(C.stone), cx, 0.55, cz));
    for (const s of [-1, 1]) g.add(box(horiz ? len + 2.6 : 0.2, 0.9, horiz ? 0.2 : len + 2.6, mat(C.tangRed), horiz ? cx : cx + s * 1.3, 0.9, horiz ? cz + s * 1.3 : cz));
  }
  for (const [x, z] of wp) for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(0.1, 0.1, 1.4, mat(C.darkWood), x + sx * 1.3, 0.9, z + sz * 1.3, 5));
  g.add(box(3, 0.4, 2.4, mat(C.stone), 0, 0.15, 34));

  // ── 牌坊大门（朝 +Z）──
  const P = PAIFANG_Z;
  for (const cx of [-9, -3.5, 3.5, 9]) {
    g.add(box(1.5, 0.7, 1.5, mat(C.stone), cx, 0, P));
    g.add(cyl(0.45, 0.5, cx === 3.5 || cx === -3.5 ? 9.5 : 7.5, mat(C.tangRed), cx, 0.7, P, 8));
  }
  g.add(box(19.5, 0.7, 0.9, mat(C.darkWood), 0, 7.3, P));
  g.add(box(8.6, 0.9, 1.0, mat(C.darkWood), 0, 8.6, P));
  g.add(box(8.6, 0.5, 0.7, mat(C.tangRed), 0, 9.9, P));
  g.add(box(8.6, 1.0, 0.7, mat(0x1f3a2a), 0, 6.1, P)); // 牌匾底
  g.add(tangRoof({ w: 11.5, d: 4.2, h: 3, ridge: 5.5, y: 10.2, z: P }));
  for (const sx of [-1, 1]) g.add(tangRoof({ w: 7.5, d: 3.6, h: 2.4, ridge: 3, x: sx * 6.3, y: 8.1, z: P }));
  g.add(sign('隋唐城遗址植物园', 8.2, 1.6, { bg: '#1f3a2a', fg: '#e8c15a', border: '#d4a93a', x: 0, y: 6.2, z: P + 0.45 }));
  g.add(sign('隋唐城遗址植物园', 8.2, 1.6, { bg: '#1f3a2a', fg: '#e8c15a', border: '#d4a93a', x: 0, y: 6.2, z: P - 0.45, ry: Math.PI }));
  g.add(plaza(40, 14, mat(C.paving, { map: patternTex('paving', C.paving) }), 0, 112, 0.15, 4));
  g.add(plaza(8, 66, mat(C.pavingRed, { map: patternTex('paving', C.pavingRed) }), 0, 66, 0.16, 4));
  for (const sx of [-1, 1]) { g.add(box(3, 1.4, 1.6, mat(C.stoneDark), sx * 16, 0.15, 108)); g.add(sphere(0.8, mat(C.stone), sx * 16, 2.2, 108, 8)); }

  // ── 牡丹花田 ──
  const bedBase = mat(0x7a5a3a), bedTop = [mat(0xd9547f), mat(0xb0243e), mat(0xefd8e4), mat(0x8a4098)];
  let bi = 0;
  for (const sx of [-1, 1]) for (const [bz, bw, bd] of [[88, 40, 14], [66, 44, 14], [44, 40, 14]]) {
    const bx = sx * 38;
    g.add(plaza(bw, bd, mat(0x9fb35f), bx, bz, 0.16));
    g.add(plaza(bw - 1.6, bd - 1.6, bedBase, bx, bz, 0.2));
    g.add(plaza(bw - 8, bd - 6, bedTop[bi++ % 4], bx, bz, 0.22));
    const cols = Math.floor((bw - 4) / 4.2);
    for (let i = 0; i < cols; i++) for (let j = 0; j < 2; j++) g.add(tree(bx - (cols - 1) * 2.1 + i * 4.2, bz + (j - 0.5) * 4.6, 2.4, 'peonyBush'));
  }

  // ── 林地：竹林 / 松林 / 樱花林 ──
  bamboo(g, r, -100, -30, 40, 50, 55);
  for (let i = 0; i < 18; i++) g.add(tree(70 + (i % 6) * 9 + r() * 3, -50 + Math.floor(i / 6) * 14 + r() * 3, 10 + r() * 3, 'pine'));
  for (let i = 0; i < 18; i++) cherry(g, -108 + (i % 6) * 10 + r() * 3, -80 + Math.floor(i / 6) * 12 + r() * 3, 5.5 + r() * 1.5);
  for (let i = 0; i < 10; i++) g.add(tree(-35 + i * 8, -66 + (i % 2) * 5, 8, i % 3 ? 'round' : 'willow'));

  // ── 亭廊 ──
  pavilion(g, -68, 24);
  pavilion(g, 68, 24);
  pavilion(g, 66, -50, 1.1);
  pavilion(g, -66, -62);
  corridor(g, 66, -8, 40, Math.PI / 2);
  corridor(g, -66, -12, 36, Math.PI / 2);
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) g.add(lamp(sx * 5, 96 - i * 11, 4.5));
  return finalize(g);
}
