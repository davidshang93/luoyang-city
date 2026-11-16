// 丹尼斯广场(老城)：5 层商场，底层骑楼柱廊 + 横向玻璃带，绿底白字招牌，门前小广场 + 停车场，正面 +Z
import { THREE, C, mat, box, cyl, plaza, tower, sign, finalize } from './_kit.js';
import { COL, mallBlock, shopfront, entrance, ledWall, fins, belt, signFrame, signPlate, pavingZone, planter, treeRow, bench, lampRow, carpark, led } from './_retail.js';

export const meta = {
  colliders: [{ x: 0, z: -32, w: 100, d: 58 }],
};

export function build() {
  const g = new THREE.Group(), wall = 0xe9e4d6, green = 0x0f7a3a;
  // 底层（退进的骑楼内墙 + 连续橱窗）
  g.add(box(98, 6, 52, mat(0xd8d2c0), 0, 0, -33));
  shopfront(g, { x: 0, z: -7, w: 98, h: 4.8, seed: 41, fascia: green });
  g.add(plaza(100, 9, mat(0xb9b2a2), 0, -2.5, 0.2));
  // 骑楼顶板 + 柱廊
  g.add(box(100, 0.5, 9.5, mat(0xcfc9b6), 0, 5.8, -2.2));
  for (let i = 0; i <= 12; i++) { g.add(cyl(0.55, 0.55, 5.8, mat(C.white), -48 + i * 8, 0, 2, 10)); g.add(box(1.5, 0.3, 1.5, mat(C.stoneDark), -48 + i * 8, 0, 2)); g.add(box(1.4, 0.35, 1.4, mat(0xcfc9b6), -48 + i * 8, 5.45, 2)); }
  g.add(box(100, 0.7, 0.5, mat(0xcfc9b6), 0, 5.3, 2.2));
  // 上部 4 层（出挑在骑楼之上）：横向玻璃带
  mallBlock(g, { x: 0, z: -30, y: 6, w: 100, d: 60, h: 20, floor: 5, bay: 5, wall, glass: C.glassDark, cap: 0xcfc9b6, shops: [], sky: 2, seed: 43,
    plant: { ac: 6, cool: 2, rooms: 2, stacks: 3, pipes: 3, mast: true } });
  // 入口雨棚（骑楼下）
  entrance(g, { x: 0, z: -7.1, w: 16, h: 4.5, dc: 6, fascia: green, steps: 2, pillars: 2 });
  // 招牌：绿底白字大牌 + 两块红色 DENNIS
  g.add(box(46, 7, 0.6, mat(green), 0, 13.5, 0.4));
  g.add(sign('丹尼斯百货', 44, 6, { bg: '#0f7a3a', fg: '#ffffff', border: '#ffffff', emissive: true, x: 0, y: 14.2, z: 0.85 }));
  fins(g, { x0: -46, x1: 46, z: 0.35, y: 18.2, h: 6.5, pitch: 4, t: 0.3, depth: 0.5 });
  ledWall(g, { x: -36, y: 9, z: 0.5, w: 12, h: 6, seed: 45 }); ledWall(g, { x: 36, y: 9, z: 0.5, w: 12, h: 6, seed: 47 });
  g.add(sign('DENNIS', 14, 2.4, { bg: '#d41d1d', fg: '#ffffff', emissive: true, x: -36, y: 22.2, z: 0.85 }));
  g.add(sign('DENNIS', 14, 2.4, { bg: '#d41d1d', fg: '#ffffff', emissive: true, x: 36, y: 22.2, z: 0.85 }));

  // 门前小广场 + 停车场
  pavingZone(g, { x: 0, z: 14, w: 80, d: 22, col: C.paving, accent: 0xa9a294, band: 11 });
  for (const sx of [-1, 1]) { planter(g, { x: sx * 30, z: 12, w: 6, d: 5, kind: 'peonyBush', th: 4, grass: true }); bench(g, sx * 18, 20, 0); }
  treeRow(g, { x0: -36, x1: 36, z: 22, n: 5, kind: 'plane', th: 7 });
  carpark(g, { x: 0, z: 43, w: 130, d: 34, y: 0.15, seed: 7, fill: 0.7, rows: 2 });
  lampRow(g, { x0: -60, x1: 60, z: 26, n: 5, h: 8 });
  return finalize(g);
}
