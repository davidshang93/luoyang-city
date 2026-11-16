// 丹尼斯百货(涧西)：5 层商场（米白外墙、横向长窗），绿色招牌，底层连续橱窗，正面 +Z
import { THREE, C, mat, box, cyl, plaza, tower, sign, finalize } from './_kit.js';
import { COL, mallBlock, entrance, ledWall, fins, belt, signFrame, signPlate, pavingZone, planter, treeRow, bench, lampRow, carpark, led } from './_retail.js';

export const meta = {
  colliders: [{ x: 0, z: -8, w: 108, d: 66 }],
};

export function build() {
  const g = new THREE.Group(), green = 0x0f7a3a;
  mallBlock(g, { x: 0, z: -8, w: 108, d: 66, h: 27, floor: 5.4, bay: 6, wall: 0xeee8d8, glass: C.glassDark, cap: 0xd6cfbc, shops: ['front', 'left', 'right'], sky: 2, seed: 51,
    plant: { ac: 7, cool: 2, rooms: 3, stacks: 4, pipes: 4, mast: true } });
  // 立面：转角竖向石材柱 + 绿色标识带
  fins(g, { x0: -53, x1: 53, z: 25.3, y: 5, h: 21.5, pitch: 18, t: 1.1, depth: 0.5, col: 0xd9d2bf });
  belt(g, { x: 0, y: 5, z: 25.4, w: 109, d: 0.7, t: 0.4, col: 0xd9d2bf });
  g.add(box(109, 1.2, 0.6, mat(green), 0, 25.6, 25.4));
  ledWall(g, { x: -36, y: 10, z: 25.5, w: 16, h: 9, seed: 53 });
  ledWall(g, { x: 36, y: 10, z: 25.5, w: 16, h: 9, seed: 55, dim: 0.15 });
  entrance(g, { x: 0, z: 25.2, w: 20, h: 5.6, dc: 7, fascia: green, steps: 3, pillars: 4 });
  // 绿色招牌（屋顶钢架）
  signFrame(g, { x: 0, z: 22, y: 28, w: 30, h: 6 });
  g.add(sign('丹尼斯', 30, 6, { bg: '#0f7a3a', fg: '#ffffff', border: '#ffffff', emissive: true, x: 0, y: 31.5, z: 22.2 }));
  g.add(sign('丹尼斯百货', 24, 3, { bg: '#0f7a3a', fg: '#ffffff', emissive: true, x: 0, y: 17.2, z: 25.7 }));

  pavingZone(g, { x: 0, z: 34, w: 120, d: 20, col: C.paving, accent: 0xa9a294, band: 10 });
  treeRow(g, { x0: -52, x1: 52, z: 30, n: 8, kind: 'plane', th: 7 });
  for (const sx of [-1, 1]) { for (let k = 0; k < 6; k++) planter(g, { x: sx * 58, z: -30 + k * 14, w: 3, d: 3, kind: 'round', th: 6 }); }
  lampRow(g, { x0: -56, x1: 56, z: 38, n: 6, h: 8 });
  carpark(g, { x: 30, z: 41, w: 50, d: 6, y: 0.2, seed: 8, fill: 0.9, rows: 1, base: false, lanes: false });
  return finalize(g);
}
