// 宝龙城市广场：4 层购物中心（橙/米色外墙）+ 屋顶直径 40m 摩天轮 + 两层风情商业街 + 4 栋 30 层住宅，正面 +Z
import { THREE, C, mat, box, cyl, plaza, tower, sign, lamp, finalize } from './_kit.js';
import { COL, mallBlock, entrance, ledWall, fins, belt, glassVolume, shopfront, signPlate, pavingZone, fountain, planter, treeRow, bench, lampRow, carpark, led, bar } from './_retail.js';

export const meta = {
  colliders: [
    { x: 0, z: -60, w: 150, d: 90 },       // 主楼
    { x: -70, z: 55, w: 70, d: 14 },       // 商业街西排
    { x: 70, z: 55, w: 70, d: 14 },        // 商业街东排
    { x: -105, z: -85, w: 28, d: 24 },     // 住宅
    { x: 105, z: -85, w: 28, d: 24 },
    { x: -105, z: -30, w: 28, d: 24 },
    { x: 105, z: -30, w: 28, d: 24 },
  ],
};

function ferrisWheel(g, x, y, z, R) {
  const cy = y + R + 5, rim = mat(0xf2f2ee, { shiny: true }), st = mat(C.steel), white = mat(0xf2f2ee), pods = [0xff5a4a, 0xffc12f, 0x35c2a8, 0x4a8cff];
  const SEG = 32, P = (a, r, zz) => [x + Math.cos(a) * r, cy + Math.sin(a) * r, z + zz];
  for (let i = 0; i < SEG; i++) {
    const a0 = i / SEG * Math.PI * 2, a1 = (i + 1) / SEG * Math.PI * 2;
    for (const zz of [-1.3, 1.3]) { bar(g, P(a0, R, zz), P(a1, R, zz), 0.34, rim); bar(g, P(a0, R - 2.2, zz), P(a1, R - 2.2, zz), 0.2, st); }
    bar(g, P(a0, R, -1.3), P(a0 + (a1 - a0) / 2, R - 2.2, 1.3), 0.14, st); bar(g, P(a0 + (a1 - a0) / 2, R - 2.2, 1.3), P(a1, R, -1.3), 0.14, st);   // 桁架斜撑
    if (i % 2 === 0) {
      for (const zz of [-1.3, 1.3]) bar(g, [x, cy, z + zz * 0.6], P(a0, R - 2.2, zz), 0.16, st);                  // 辐条
      const p = P(a0, R, 0); g.add(box(2.2, 2.0, 2.6, mat(pods[(i / 2) % 4]), p[0] - 1.1, p[1] - 3.0, z)); bar(g, [p[0], p[1], z], [p[0], p[1] - 1.2, z], 0.12, st);
    }
  }
  g.add(cyl(1.6, 1.6, 3.4, st, x, cy - 1.7, z, 14).rotateX(Math.PI / 2));
  for (const s of [-1, 1]) for (const zz of [-2.6, 2.6]) bar(g, [x + s * 10, y, z + zz], [x, cy, z + zz * 0.5], 0.6, white);   // A 字腿
  g.add(box(26, 1.2, 8, mat(C.concreteDark), x, y, z));
  g.add(box(10, 3.2, 6, mat(COL.alu), x + 12, y, z + 12));      // 检票亭
}

export function build() {
  const g = new THREE.Group(), orange = 0xe58a3a, cream = 0xf0e2c4, mz = -60, zf = mz + 45;
  pavingZone(g, { x: 0, z: 50, w: 220, d: 130, col: C.paving, accent: 0xb59a78, band: 20 });

  // ── 主楼 150x90x24
  mallBlock(g, { x: 0, z: mz, w: 150, d: 90, h: 24, floor: 6, bay: 6, wall: cream, glass: 0x5d7a8a, cap: orange, sky: 3, seed: 101,
    plant: { ac: 7, cool: 2, rooms: 3, stacks: 4, pipes: 4, avoid: [[0, mz + 22, 32, 14]] } });
  belt(g, { x: 0, y: 11.5, z: zf + 0.6, w: 151, d: 1.4, t: 1.2, col: orange });
  fins(g, { x0: -72, x1: 72, z: zf + 0.3, y: 5.2, h: 17, pitch: 11.5, t: 0.7, depth: 0.5, col: orange });
  for (let i = 0; i < 6; i++) if (i !== 2 && i !== 3) ledWall(g, { x: -63 + i * 25, y: 13, z: zf + 0.5, w: 12, h: 6, seed: 102 + i, dim: 0.1 });
  glassVolume(g, { x: 0, y: 0, z: zf + 4, w: 28, h: 8, d: 8, floor: 8 });
  entrance(g, { x: 0, z: zf + 8.2, w: 20, h: 6.4, dc: 9, fascia: orange, steps: 3, pillars: 4 });
  signPlate(g, { x: 0, y: 19.3, z: zf + 0.8, w: 50, h: 6.4, col: 0xa84c10 });
  g.add(sign('宝龙城市广场', 50, 6.4, { bg: '#d96a1e', fg: '#ffffff', border: '#fff1c8', emissive: true, x: 0, y: 19.3, z: zf + 1.15 }));
  // 摩天轮（直径 40m，立在屋顶前部）
  ferrisWheel(g, 0, 24.5, mz + 22, 20);

  // ── 两层风情商业街：东西两排，中间中心广场
  const cs = [0xd98a5a, 0xe8d8b0, 0xb87a4a];
  const shop = (x, z, w, col, k) => {
    g.add(tower(w, 9, 14, { style: 'mall', wall: col, glass: C.glassDark, bay: 4, floor: 4.5, x, z }));
    g.add(box(w + 1, 0.6, 16, mat(C.darkWood), x, 9.4, z));          // 出檐
    shopfront(g, { x, z: z + 7, w: w - 0.6, h: 4, seed: 110 + k });
    g.add(box(w + 0.8, 0.4, 2.4, mat(C.darkWood), x, 4.1, z + 8));   // 雨篷
  };
  for (let i = 0; i < 5; i++) { shop(-95 + i * 13, 55, 12.6, cs[i % 3], i); shop(95 - i * 13, 55, 12.6, cs[(i + 2) % 3], i + 5); }
  signPlate(g, { x: -70, y: 12.2, z: 62.5, w: 18, h: 3, col: 0x5a2e18 });
  g.add(sign('风情商业街', 18, 3, { bg: '#5a2e18', fg: '#ffe0a0', emissive: true, x: -70, y: 12.2, z: 62.9 }));
  g.add(sign('美食汇', 12, 2.6, { bg: '#c8501e', fg: '#ffffff', emissive: true, x: 70, y: 12.2, z: 62.9 }));
  // 中心广场：圆形花坛 + 喷泉
  fountain(g, { x: 0, z: 55, r: 9 });
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; planter(g, { x: Math.cos(a) * 15, z: 55 + Math.sin(a) * 15, w: 3, d: 3, kind: 'peonyBush', th: 3, grass: true }); }

  // ── 住宅塔楼（30 层 ~96m）
  for (const [x, z, col] of [[-105, -85, 0xe3d3b6], [105, -85, 0xd9c2a0], [-105, -30, 0xeadfc8], [105, -30, 0xdccaa8]]) {
    g.add(tower(26, 96, 22, { style: 'apartment', wall: col, glass: 0x4a6a80, bay: 3.5, floor: 3.2, x, z }));
    g.add(box(18, 1.4, 14, mat(orange), x, 96.6, z));
  }
  treeRow(g, { x0: -88, x1: 88, z: 100, n: 9, kind: 'plane', th: 7 });
  lampRow(g, { x0: -88, x1: 88, z: 20, n: 9, h: 7 });
  for (let i = 0; i < 4; i++) bench(g, -30 + i * 20, 80, 0, 0.15, 3);
  carpark(g, { x: 0, z: 110, w: 110, d: 8, y: 0.2, seed: 16, fill: 0.85, rows: 1, base: false, lanes: false });
  return finalize(g);
}
