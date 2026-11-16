// 中国国花园：北大门区（唐风五间门楼 + 红墙 + 广场刻字石 + 牡丹花海 + 牡丹仙子 + 四角亭）
import { THREE, C, mat, box, cyl, sphere, disc, plaza, tangRoof, gableRoof, sign, tree, lamp, patternTex, rng, finalize } from './_kit.js';

export const meta = {
  colliders: [
    { x: -12, z: 82, w: 6.4, d: 9 },   // 门楼左实墩
    { x: 12, z: 82, w: 6.4, d: 9 },    // 门楼右实墩
    { x: -45, z: 82, w: 60, d: 1.6 },  // 左红墙
    { x: 45, z: 82, w: 60, d: 1.6 },   // 右红墙
    { x: -28, z: 94, w: 8, d: 3 },     // 刻字巨石
    { x: 0, z: 40, w: 5.5, d: 5.5 },   // 牡丹仙子基座
  ],
};

function pavilion(g, x, z) {
  g.add(box(10, 0.6, 10, mat(C.stone, { map: patternTex('stone', C.stone) }), x, 0.15, z));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(0.28, 0.3, 4.6, mat(C.tangRed), x + sx * 3.8, 0.75, z + sz * 3.8, 8));
  g.add(box(9.4, 0.5, 9.4, mat(C.darkWood), x, 5.3, z));
  g.add(tangRoof({ w: 13.5, d: 13.5, h: 4.2, ridge: 0, x, y: 5.75, z }));
  // 栏杆
  for (const sz of [-1, 1]) g.add(box(7.6, 0.8, 0.2, mat(C.tangRed), x, 0.75, z + sz * 3.8));
  for (const sx of [-1, 1]) g.add(box(0.2, 0.8, 7.6, mat(C.tangRed), x + sx * 3.8, 0.75, z));
}

export function build() {
  const g = new THREE.Group();
  const stoneM = mat(C.stone, { map: patternTex('stone', C.stone) });
  const redWall = mat(C.wallRed, { map: patternTex('brick', C.wallRed, 0x000000) });
  const GZ = 82; // 大门中心 z（朝 +Z=北）

  // ── 广场与园内主路 ──
  g.add(plaza(92, 10, mat(C.paving, { map: patternTex('paving', C.paving) }), 0, 95, 0.15, 4));
  g.add(plaza(10, 160, mat(C.pavingRed, { map: patternTex('paving', C.pavingRed) }), 0, 0, 0.16, 4));
  g.add(disc(13, mat(C.paving, { map: patternTex('paving', C.paving) }), 0, 40, 0.17, 32));

  // ── 唐风门楼（五间庑殿，中间三间为通道） ──
  g.add(box(40, 1, 16, stoneM, 0, 0.15, GZ));
  for (let i = 0; i < 4; i++) g.add(box(18, 0.95 * (1 - i / 4), 0.6, stoneM, 0, 0.15, GZ + 8.3 + i * 0.6));
  for (const sx of [-1, 1]) g.add(box(6, 6.5, 8, redWall, sx * 12, 1.15, GZ));
  for (const cx of [-9, -3, 3, 9]) for (const sz of [-1, 1]) g.add(cyl(0.38, 0.42, 6.5, mat(C.tangRed), cx, 1.15, GZ + sz * 3.6, 8));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(0.38, 0.42, 6.5, mat(C.tangRed), sx * 15, 1.15, GZ + sz * 3.6, 8));
  g.add(box(33, 1.0, 9.4, mat(C.darkWood), 0, 7.65, GZ));
  g.add(box(35, 0.6, 10.6, mat(C.tangRed), 0, 8.65, GZ));
  g.add(tangRoof({ w: 44, d: 19, h: 7.5, ridge: 26, y: 9.25, z: GZ }));
  g.add(sign('中国国花园', 9, 2.2, { bg: '#2a1a10', fg: '#e8c15a', border: '#d4a93a', x: 0, y: 8.1, z: GZ + 5.4 }));
  g.add(sign('中国国花园', 9, 2.2, { bg: '#2a1a10', fg: '#e8c15a', border: '#d4a93a', x: 0, y: 8.1, z: GZ - 5.4, ry: Math.PI }));
  // 门钉红灯笼
  for (const cx of [-6, 6]) g.add(sphere(0.55, mat(0xd4281c, { emissive: 0xb01010, emissiveIntensity: 0.3 }), cx, 6.6, GZ + 4.2, 8));

  // ── 两侧红墙 ──
  for (const sx of [-1, 1]) {
    g.add(box(60, 3.6, 1.2, redWall, sx * 45, 0, GZ));
    g.add(box(61, 0.45, 1.9, mat(C.tileGrey), sx * 45, 3.6, GZ));
    for (let i = 0; i < 6; i++) g.add(box(0.9, 4.0, 1.7, mat(C.tangRed), sx * (17 + i * 11.5), 0, GZ));
  }

  // ── 刻字景观巨石 ──
  const rockM = mat(C.rock);
  g.add(box(7, 3.6, 1.4, rockM, -28, 0.15, 94, 0.05));
  g.add(box(5.2, 2.2, 1.8, mat(C.stoneDark), -29.6, 0.15, 93.7, -0.25));
  g.add(box(3.6, 4.4, 1.2, rockM, -26.2, 0.15, 94.2, 0.2));
  g.add(sign('中国国花园', 5.6, 1.3, { bg: '#a39d8e', fg: '#9c2a1f', x: -28.2, y: 1.8, z: 94.82, ry: 0.05 }));

  // ── 牡丹仙子石雕（高 8m） ──
  const SZ = 40;
  g.add(cyl(3.2, 3.6, 0.8, stoneM, 0, 0.17, SZ, 12));
  g.add(box(4.2, 2.2, 4.2, mat(C.marble), 0, 0.97, SZ));
  g.add(box(4.8, 0.4, 4.8, stoneM, 0, 3.17, SZ));
  const W = mat(0xf4f1ea);
  g.add(cyl(0.9, 1.9, 2.8, W, 0, 3.57, SZ, 12));              // 裙摆
  g.add(cyl(0.55, 0.9, 1.6, W, 0, 6.2, SZ, 10));              // 身
  g.add(box(2.6, 0.18, 0.7, W, 0.1, 7.3, SZ, 0.15));         // 肩/披帛
  g.add(sphere(0.42, W, 0, 7.75, SZ, 10));                    // 头
  g.add(box(0.14, 0.9, 0.9, W, 0, 8.25, SZ));                 // 发髻
  g.add(box(0.28, 2.6, 0.28, W, 1.5, 7.9, SZ, -0.5));        // 高举的手臂
  g.add(sphere(0.7, mat(C.peonyPink), 2.15, 9.05, SZ, 8));    // 手中牡丹
  g.add(sphere(0.45, mat(C.peonyWhite), 2.15, 9.5, SZ, 6));
  g.add(box(0.2, 2.4, 1.6, W, -1.2, 4.6, SZ, 0.3));          // 飘带
  g.add(box(0.2, 2.0, 1.4, W, 1.2, 4.2, SZ, -0.3));

  // ── 牡丹花海：花圃 + 牡丹丛 ──
  const bedM = mat(0x7a5a3a), edgeM = mat(0x9fb35f);
  const bedCols = [0xd9547f, 0xb0243e, 0xefd8e4, 0x8a4098];
  let bi = 0;
  for (const bz of [62, 22, -10, -40]) for (const bx of [-55, -30, 30, 55]) {
    g.add(plaza(16, 12, edgeM, bx, bz, 0.16));
    g.add(plaza(14.6, 10.6, bedM, bx, bz, 0.2));
    g.add(plaza(11, 8, mat(bedCols[bi++ % 4], {}), bx, bz, 0.22));
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j += 2) g.add(tree(bx + i * 4.2, bz + j * 2.4, 2.4, 'peonyBush'));
  }
  // 路边行道树与灯
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) g.add(tree(sx * 9, 70 - i * 24, 8, i % 2 ? 'pine' : 'round'));
  for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) g.add(lamp(sx * 6.2, 74 - i * 30, 5));

  // ── 唐风四角亭 ──
  pavilion(g, -42, 42);
  pavilion(g, 46, -76);
  return finalize(g);
}
