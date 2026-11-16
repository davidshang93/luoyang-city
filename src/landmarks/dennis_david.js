// 丹尼斯大卫城：6 层深灰石材 + 玻璃盒子，转角圆柱玻璃入口塔，正面（北）朝 +Z
import { THREE, C, mat, box, cyl, plaza, tower, sign, finalize } from './_kit.js';
import { COL, mallBlock, entrance, ledWall, fins, belt, cylFacade, glassVolume, signFrame, signPlate, pavingZone, planter, treeRow, bench, lampRow, carpark, led } from './_retail.js';

export const meta = {
  colliders: [{ x: -6, z: -20, w: 92, d: 70 }, { x: 44, z: 26, w: 20, d: 20 }],
};

export function build() {
  const g = new THREE.Group();
  pavingZone(g, { x: 0, z: 44, w: 106, d: 30, col: 0xa9a69e, accent: 0x8d8a84, band: 15 });
  // 深灰石材主楼（6 层 32m）
  mallBlock(g, { x: -6, z: -20, w: 92, d: 70, h: 32, floor: 5.33, bay: 5, style: 'grid', wall: 0x5b5e63, glass: C.glassDark, cap: 0x44474b, belts: false, sky: 2, seed: 31,
    plant: { ac: 8, cool: 3, rooms: 2, stacks: 4, pipes: 4, mast: true, avoid: [[44, 26, 22, 22]] } });
  // 凸出的玻璃盒子
  glassVolume(g, { x: -30, y: 6, z: 17.5, w: 30, h: 20, d: 5, floor: 5.33 });
  glassVolume(g, { x: 10, y: 12, z: 17.5, w: 30, h: 14, d: 5, floor: 5.33, glass: C.glassGreen });
  glassVolume(g, { x: -53, y: 20, z: 17, w: 20, h: 10, d: 4, floor: 5, glass: C.glassGreen });
  // 石材分隔线（深色立面上的浅色横线）
  for (let k = 1; k < 6; k++) belt(g, { x: -6, y: k * 5.33 - 0.15, z: 15.2, w: 92.4, d: 0.5, t: 0.3, col: 0x8d8a84 });
  ledWall(g, { x: -50, y: 8, z: 15.6, w: 14, h: 8, seed: 33 });
  ledWall(g, { x: 28, y: 20, z: 15.6, w: 16, h: 8, seed: 35, dim: 0.1 });

  // 圆柱形玻璃入口塔
  cylFacade(g, { x: 44, z: 26, r: 9, h: 38, floor: 5, glass: C.glassBlue, band: 0x44474b });
  entrance(g, { x: 44, z: 34.6, w: 14, h: 6, dc: 7, fascia: 0x0f7a3a, steps: 3, pillars: 3 });
  // 屋顶招牌：绿 / 红
  signFrame(g, { x: -22, z: 12, y: 33, w: 40, h: 5.6 });
  g.add(sign('丹尼斯', 20, 5.6, { bg: '#0f7a3a', fg: '#ffffff', border: '#ffffff', emissive: true, x: -32, y: 36.4, z: 12.2 }));
  g.add(sign('DENNIS', 20, 5.6, { bg: '#d41d1d', fg: '#ffffff', border: '#ffffff', emissive: true, x: -12, y: 36.4, z: 12.2 }));

  treeRow(g, { x0: -50, x1: 20, z: 36, n: 6, kind: 'round', th: 6.5 });
  planter(g, { x: -42, z: 52, w: 10, d: 8, kind: 'peonyBush', th: 5, grass: true });
  for (let i = 0; i < 3; i++) bench(g, -24 + i * 14, 50, 0);
  lampRow(g, { x0: -50, x1: 40, z: 50, n: 5, h: 8 });
  carpark(g, { x: 22, z: 54, w: 36, d: 14, y: 0.2, seed: 6, fill: 0.8, rows: 1, base: false });
  return finalize(g);
}
