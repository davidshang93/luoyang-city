// 新都汇购物公园：4 栋 3-5 层商业楼围成下沉中庭广场 + 天桥连廊 + 影城 + 2 栋住宅塔，外立面橙白灰色块，正面 +Z
import { THREE, C, mat, box, cyl, plaza, tower, sign, finalize } from './_kit.js';
import { COL, mallBlock, entrance, ledWall, fins, belt, glassVolume, signFrame, signPlate, shopfront, roofPlant, pavingZone, fountain, planter, treeRow, bench, lampRow, carpark, led, sub, stairs } from './_retail.js';

export const meta = {
  colliders: [
    { x: -82, z: -10, w: 56, d: 130 }, { x: 82, z: -10, w: 56, d: 130 },
    { x: 0, z: -57, w: 110, d: 36 },
    { x: -67, z: 72, w: 86, d: 34 }, { x: 67, z: 72, w: 86, d: 34 },
    { x: -70, z: -92, w: 24, d: 20 }, { x: 70, z: -92, w: 24, d: 20 },
  ],
};

export function build() {
  const g = new THREE.Group(), ORANGE = 0xe8742a, WHITE = 0xf0eee8, GREY = 0x8a8d90, aluM = mat(COL.alu, { shiny: true });
  // ── 中庭广场（下沉感：台阶 + 矮挡墙）
  pavingZone(g, { x: 0, z: 7, w: 110, d: 95, col: 0xb9b2a2, accent: 0x8d8a84, band: 16 });
  g.add(plaza(60, 40, mat(0xd8d0bc), 0, 5, 0.22, 6));
  fountain(g, { x: 0, z: 5, r: 6 });
  stairs(g, { x: 0, z: 49, w: 100, n: 4, rise: 0.12, run: 0.5 });
  for (const x of [-52, 52]) g.add(box(1.2, 0.9, 92, mat(C.stoneDark), x, 0.15, 7));

  // ── 西楼 4 层（白色 + 橙色色块），正面朝中庭(+X)
  const west = sub(g, -82, 0, -10, Math.PI / 2);
  mallBlock(west, { x: 0, z: 0, w: 130, d: 56, h: 18, floor: 4.5, bay: 6, wall: WHITE, glass: C.glassDark, cap: ORANGE, shops: ['front'], sky: 2, seed: 171, shopH: 4.5,
    plant: { ac: 5, cool: 2, rooms: 3, stacks: 3, pipes: 3, mast: true } });
  for (let i = 0; i < 5; i++) west.add(box(14, 13.5, 0.7, mat(ORANGE), -52 + i * 26, 4.6, 28.4));
  fins(west, { x0: -64, x1: 64, z: 28.3, y: 4.6, h: 13.4, pitch: 3.2, t: 0.12, depth: 0.45, col: 0xffffff });
  west.add(box(20, 6, 40, mat(GREY), -13, 18.9, -8));
  // ── 东楼 4 层（灰色 + 橙色），正面朝中庭(-X)
  const east = sub(g, 82, 0, -10, -Math.PI / 2);
  mallBlock(east, { x: 0, z: 0, w: 130, d: 56, h: 18, floor: 4.5, bay: 6, wall: GREY, glass: C.glassDark, cap: WHITE, shops: ['front'], sky: 2, seed: 173, shopH: 4.5,
    plant: { ac: 5, cool: 2, rooms: 3, stacks: 3, pipes: 3, mast: true } });
  for (let i = 0; i < 5; i++) east.add(box(14, 13.5, 0.7, mat(ORANGE), -52 + i * 26 + 13, 4.6, 28.4));
  ledWall(east, { x: 0, y: 8, z: 28.5, w: 22, h: 8, seed: 175 });
  // ── 北楼 5 层 + 影城
  mallBlock(g, { x: 0, z: -57, w: 110, d: 36, h: 24, floor: 4.8, bay: 6, wall: ORANGE, glass: C.glassDark, cap: WHITE, shops: ['front'], sky: 0, seed: 177,
    plant: { ac: 4, cool: 2, rooms: 2, stacks: 3, pipes: 3, avoid: [[0, -58, 62, 26]] } });
  g.add(box(60, 9, 24, mat(0x2b3138), 0, 24.6, -58));
  fins(g, { x0: -29, x1: 29, z: -45.8, y: 24.8, h: 8.4, pitch: 2.4, t: 0.3, depth: 0.5, col: 0x59616a });
  roofPlant(g, { x: 0, z: -58, w: 60, d: 24, y: 33.7, seed: 178, ac: 2, cool: 1, rooms: 1, stacks: 2, pipes: 1 });
  g.add(sign('新都汇影城', 36, 5.5, { bg: '#1e2530', fg: '#ffd24a', emissive: true, x: 0, y: 29, z: -45.7 }));
  g.add(sign('新都汇', 40, 8, { bg: '#ffffff', fg: '#e8742a', border: '#e8742a', emissive: true, x: 0, y: 16.5, z: -38.6 }));
  ledWall(g, { x: -34, y: 6, z: -38.7, w: 24, h: 8, seed: 179 }); ledWall(g, { x: 34, y: 6, z: -38.7, w: 24, h: 8, seed: 181 });
  // ── 南侧前楼 3 层（入口两侧），正面朝 +Z，后面朝中庭
  mallBlock(g, { x: -67, z: 72, w: 86, d: 34, h: 14, floor: 4.6, bay: 6, wall: ORANGE, glass: C.glassDark, cap: GREY, shops: ['front', 'back'], seed: 183, plant: { ac: 3, cool: 1, rooms: 2, stacks: 2, pipes: 2 } });
  mallBlock(g, { x: 67, z: 72, w: 86, d: 34, h: 14, floor: 4.6, bay: 6, wall: WHITE, glass: C.glassDark, cap: GREY, shops: ['front', 'back'], seed: 185, plant: { ac: 3, cool: 1, rooms: 2, stacks: 2, pipes: 2 } });
  signPlate(g, { x: -67, y: 10, z: 89.4, w: 30, h: 5, col: 0xb8531a });
  g.add(sign('新都汇', 30, 5, { bg: '#e8742a', fg: '#ffffff', emissive: true, x: -67, y: 10, z: 89.8 }));
  ledWall(g, { x: 67, y: 6, z: 89.4, w: 26, h: 7, seed: 187 });
  entrance(g, { x: -67, z: 89, w: 14, h: 4.5, dc: 5, fascia: ORANGE, steps: 2, pillars: 3 });
  // ── 天桥连廊：东西向跨中庭 + 南北向支线（玻璃通廊 + 桥墩）
  glassVolume(g, { x: 0, y: 8.5, z: 0, w: 108, h: 3.8, d: 5, floor: 3.8, pitch: 4 });
  g.add(box(108, 0.6, 5.6, mat(COL.white), 0, 8, 0));
  for (const x of [-30, 30]) for (const z of [-2, 2]) g.add(cyl(0.45, 0.45, 8, mat(C.concrete), x, 0.15, z, 10));
  glassVolume(g, { x: 26, y: 8.5, z: -19.5, w: 5, h: 3.8, d: 39, floor: 3.8, pitch: 4 });
  g.add(box(5.6, 0.6, 39, mat(COL.white), 26, 8, -19.5));
  // ── 住宅塔
  g.add(tower(24, 100, 20, { style: 'apartment', wall: 0xdcd4c0, glass: C.glassDark, bay: 4, floor: 3.3, x: -70, z: -92 }));
  g.add(tower(24, 100, 20, { style: 'apartment', wall: 0xcfc8b6, glass: C.glassDark, bay: 4, floor: 3.3, x: 70, z: -92 }));
  // ── 中庭树 / 灯 / 花坛
  for (const [x, z] of [[-30, -20], [30, -20], [-30, 25], [30, 25], [-42, 5], [42, 5]]) planter(g, { x, z, w: 3.6, d: 3.6, kind: 'round', th: 6.5 });
  for (const x of [-16, 16]) planter(g, { x, z: 20, w: 8, d: 4, kind: 'peonyBush', th: 3.5, grass: true });
  for (let i = 0; i < 4; i++) bench(g, -24 + i * 16, 36, 0, 0.15, 3);
  lampRow(g, { x0: -40, x1: 40, z: 40, n: 5, h: 7 }); lampRow(g, { x0: -40, x1: 40, z: -15, n: 5, h: 7 });
  treeRow(g, { x0: -84, x1: 84, z: 98, n: 7, kind: 'plane', th: 7 });
  carpark(g, { x: -105, z: 95, w: 22, d: 8, y: 0.2, seed: 20, fill: 0.9, rows: 1, base: false, lanes: false });
  return finalize(g);
}
