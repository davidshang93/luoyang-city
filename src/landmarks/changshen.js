// 长申国际：深色石材 + 金色线条 6 层裙楼（橱窗大牌）+ 25 层玻璃幕写字楼，金色字招牌，正面 +Z
import { THREE, C, mat, box, cyl, plaza, tower, sign, finalize } from './_kit.js';
import { COL, mallBlock, entrance, ledWall, fins, belt, crown, signPlate, glassVolume, pavingZone, planter, treeRow, bench, lampRow, carpark, led } from './_retail.js';

export const meta = {
  colliders: [{ x: 0, z: -4, w: 80, d: 76 }],
};

export function build() {
  const g = new THREE.Group(), dark = 0x4a4c50;
  mallBlock(g, { x: 0, z: -4, w: 80, d: 76, h: 30, floor: 5, bay: 5, wall: dark, glass: 0x1e2a34, cap: 0x2f3134, belts: false, sky: 2, seed: 61,
    plant: { ac: 6, cool: 2, rooms: 2, stacks: 3, pipes: 3, mast: false, avoid: [[-18, -26, 30, 30]] } });
  // 金色线条：逐层金带 + 竖向金条
  for (let k = 1; k <= 6; k++) belt(g, { x: 0, y: k * 5 - 0.2, z: 34.3, w: 80.6, d: 0.45, t: 0.22, col: C.gold });
  for (const sx of [-1, 1]) for (let k = 1; k <= 6; k++) belt(g, { x: sx * 40.3, y: k * 5 - 0.2, z: -4, w: 0.45, d: 76.6, t: 0.22, col: C.gold });
  for (let i = -4; i <= 4; i++) g.add(box(0.5, 25, 0.5, mat(C.gold), i * 9, 5, 34.3));
  // 橱窗大牌广告位（深色框 + 暖光）
  for (const x of [-26, 26]) g.add(box(18, 7, 0.4, led(COL.warm, 0.4), x, 8, 34.4));
  ledWall(g, { x: -26, y: 17, z: 34.5, w: 16, h: 8, seed: 63, dim: 0.35 });
  ledWall(g, { x: 26, y: 17, z: 34.5, w: 16, h: 8, seed: 65, dim: 0.35 });
  // 25 层玻璃幕写字楼坐在裙楼上
  g.add(tower(28, 70, 28, { style: 'glass', glass: C.glassBlue, shiny: true, bay: 3.5, floor: 4, x: -18, y: 30, z: -26, roof: false }));
  crown(g, { x: -18, z: -26, w: 28, d: 28, y: 100, h: 5 });
  // 入口 + 金字招牌
  entrance(g, { x: 8, z: 34.2, w: 16, h: 6.2, dc: 7, fascia: 0xd4a93a, steps: 3, pillars: 4 });
  g.add(box(30, 5, 0.6, mat(0x1c1d1f), 8, 24, 34.4));
  g.add(sign('长申国际', 28, 4.4, { bg: '#16181b', fg: '#e8c25a', border: '#d4a93a', emissive: true, x: 8, y: 26.4, z: 34.8 }));
  g.add(box(30.6, 0.3, 0.8, mat(C.gold), 8, 21.4, 34.5));

  pavingZone(g, { x: 0, z: 44, w: 84, d: 22, col: 0x8d8a84, accent: 0x6e6c66, band: 11 });
  treeRow(g, { x0: -36, x1: 36, z: 40, n: 5, kind: 'round', th: 6.5 });
  for (const sx of [-1, 1]) planter(g, { x: sx * 34, z: 50, w: 8, d: 4, kind: 'peonyBush', th: 3.5, grass: true });
  lampRow(g, { x0: -36, x1: 36, z: 50, n: 4, h: 8 });
  carpark(g, { x: 0, z: 56, w: 60, d: 6, y: 0.2, seed: 9, fill: 0.8, rows: 1, base: false, lanes: false });
  return finalize(g);
}
