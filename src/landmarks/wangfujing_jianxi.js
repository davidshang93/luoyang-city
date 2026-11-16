// 王府井购物中心(涧西)：6 层（左翼浅灰铝板、右翼玻璃幕）+ 通高玻璃中庭凸出体 + 右翼屋顶花园，正面 +Z
import { THREE, C, mat, box, cyl, plaza, tower, sign, tree, finalize } from './_kit.js';
import { COL, mallBlock, entrance, ledWall, fins, belt, glassVolume, signFrame, shopfront, roofPlant, pavingZone, planter, treeRow, bench, lampRow, carpark, led } from './_retail.js';

export const meta = {
  colliders: [
    { x: 0, z: -15, w: 130, d: 90 },     // 主楼
    { x: 0, z: 40, w: 30, d: 20 },       // 中庭凸出体
  ],
};

export function build() {
  const g = new THREE.Group(), grey = 0xcfd2d4;
  pavingZone(g, { x: 0, z: 56, w: 150, d: 24, col: C.paving, accent: 0xa9a294, band: 12 });
  // 左翼 6 层 32m 浅灰铝板
  mallBlock(g, { x: -30, z: -15, w: 70, d: 90, h: 32, floor: 5.33, bay: 5, wall: grey, glass: 0x56718a, cap: 0xb9bcbf, shops: ['front'], sky: 2, seed: 151,
    plant: { ac: 6, cool: 2, rooms: 3, stacks: 4, pipes: 4, mast: true } });
  // 右翼 4 层 21m 玻璃幕 + 屋顶花园
  g.add(tower(60, 21, 90, { style: 'glass', glass: C.glassBlue, shiny: true, bay: 4, floor: 5.25, x: 35, z: -15 }));
  g.add(plaza(56, 86, mat(C.grass), 35, -15, 21.15));
  g.add(plaza(4, 80, mat(C.paving), 35, -15, 21.25)); g.add(plaza(50, 4, mat(C.paving), 35, -10, 21.25));
  for (let i = 0; i < 9; i++) planter(g, { x: 14 + (i % 3) * 21, z: -45 + Math.floor(i / 3) * 22 + (i % 2) * 6, w: 4, d: 4, kind: i % 2 ? 'round' : 'plane', th: 5, y: 21.2, grass: true });
  for (let i = 0; i < 4; i++) bench(g, 24 + (i % 2) * 22, -30 + i * 7, Math.PI / 2, 21.25);
  g.add(box(10, 0.3, 6, mat(COL.white), 45, 24.5, 15)); for (const dx of [-4, 4]) g.add(cyl(0.15, 0.15, 3.3, mat(C.steel), 45 + dx, 21.2, 15, 6));   // 凉亭
  shopfront(g, { x: 35, z: 30, w: 59, h: 4.5, seed: 153 });
  belt(g, { x: 35, y: 10.4, z: 30.3, w: 60.4, d: 0.6, t: 0.4 });
  // 彩色广告：竖向大屏
  for (let i = 0; i < 4; i++) ledWall(g, { x: -58 + i * 11, y: 6.5, z: 30.4, w: 8, h: 20, seed: 154 + i, cell: 2.4, dim: 0.1 });
  for (let i = 0; i < 3; i++) ledWall(g, { x: 24 + i * 16, y: 4, z: 30.4, w: 10, h: 6, seed: 160 + i, dim: 0.1 });
  fins(g, { x0: -64, x1: 3, z: 30.3, y: 27, h: 5, pitch: 2.4, t: 0.18, depth: 0.4, col: 0xffffff });

  // 通高玻璃中庭凸出体
  glassVolume(g, { x: 0, y: 0, z: 40, w: 30, h: 32, d: 20, floor: 5.33, glass: C.glassBlue, pitch: 3.75 });
  entrance(g, { x: 0, z: 50.2, w: 18, h: 6.4, dc: 8, fascia: 0xc8102e, steps: 3, pillars: 4 });
  signFrame(g, { x: 0, z: 46, y: 33, w: 32, h: 4.6 });
  g.add(sign('王府井购物中心', 32, 4.6, { bg: '#c8102e', fg: '#ffffff', border: '#ffffff', emissive: true, x: 0, y: 35.8, z: 46.2 }));
  roofPlant(g, { x: 0, z: 40, w: 30, d: 20, y: 33.1, seed: 155, ac: 1, cool: 0, rooms: 0, stacks: 1, pipes: 0, avoid: [[0, 46, 34, 4]] });

  treeRow(g, { x0: -64, x1: 64, z: 58, n: 8, kind: 'round', th: 6 });
  lampRow(g, { x0: -64, x1: 64, z: 64, n: 8, h: 7 });
  carpark(g, { x: 0, z: 65, w: 120, d: 6, y: 0.2, seed: 19, fill: 0.9, rows: 1, base: false, lanes: false });
  return finalize(g);
}
