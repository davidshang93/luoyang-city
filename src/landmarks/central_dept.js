// 中央百货大楼：7 层商业楼 + 20 层塔楼，正面（北）朝 +Z；弧形玻璃入口 + 红字 + 广告位
import { THREE, C, mat, box, cyl, plaza, tower, sign, finalize } from './_kit.js';
import { COL, mallBlock, entrance, ledWall, fins, belt, cylFacade, crown, signPlate, pavingZone, planter, treeRow, bench, lampRow, carpark, led } from './_retail.js';

export const meta = {
  colliders: [{ x: 0, z: -20, w: 92, d: 54 }, { x: 0, z: -36, w: 26, d: 24 }],
};

export function build() {
  const g = new THREE.Group();
  pavingZone(g, { x: 0, z: 32, w: 110, d: 32, col: C.paving, accent: 0xa9a294, band: 16 });

  // 7 层主楼：浅色铝板 + 玻璃
  mallBlock(g, { x: 0, z: -20, w: 92, d: 54, h: 34, floor: 4.85, bay: 4, wall: 0xe6e3da, glass: C.glassBlue, cap: 0xcfccc2, sky: 2, seed: 11,
    plant: { ac: 6, cool: 2, rooms: 2, stacks: 3, pipes: 3, mast: true, avoid: [[0, -36, 30, 28]] } });
  // 铝板竖向翅片（上部立面）+ 横向分层线
  fins(g, { x0: -45, x1: 45, z: 7.3, y: 10, h: 23.5, pitch: 3, t: 0.25, depth: 0.45, col: 0xf2f2ee });
  belt(g, { x: 0, y: 9.7, z: 7.4, w: 93, d: 0.6, t: 0.4 }); belt(g, { x: 0, y: 33.2, z: 7.4, w: 93, d: 0.6, t: 0.45 });
  // 立面广告位
  ledWall(g, { x: -33, y: 14, z: 7.5, w: 18, h: 10, seed: 3 });
  ledWall(g, { x: 33, y: 14, z: 7.5, w: 18, h: 10, seed: 5 });
  ledWall(g, { x: 33, y: 26, z: 7.5, w: 16, h: 5, seed: 9, dim: 0.1 });
  g.add(box(2, 24, 0.6, mat(0xd41d1d), -22.5, 9.7, 7.5)); g.add(box(2, 24, 0.6, mat(0xd41d1d), 22.5, 9.7, 7.5));

  // 20 层塔楼（玻璃幕墙 + 收顶）
  g.add(tower(26, 70, 24, { style: 'glass', glass: C.glassBlue, shiny: true, bay: 4, floor: 3.5, x: 0, y: 34, z: -36, roof: false }));
  crown(g, { x: 0, z: -36, w: 26, d: 24, y: 104, h: 5 });

  // 弧形玻璃入口 + 雨棚 + 红字
  cylFacade(g, { x: 0, z: 4, r: 13, h: 15, floor: 5, glass: C.glassBlue });
  entrance(g, { x: 0, z: 15.8, w: 18, h: 6.2, dc: 8, fascia: 0xd41d1d, steps: 3, pillars: 4 });
  signPlate(g, { x: 0, y: 23.5, z: 7.6, w: 40, h: 5.4, col: 0xd41d1d });
  g.add(sign('中央百货大楼', 40, 5.4, { bg: '#ffffff', fg: '#d41d1d', border: '#d41d1d', emissive: true, x: 0, y: 23.5, z: 7.95 }));

  // 广场
  treeRow(g, { x0: -46, x1: 46, z: 28, n: 7, kind: 'plane', th: 7 });
  for (const sx of [-1, 1]) { planter(g, { x: sx * 48, z: 40, w: 6, d: 6, kind: 'peonyBush', th: 5, grass: true }); bench(g, sx * 30, 40, 0); bench(g, sx * 38, 40, 0); }
  lampRow(g, { x0: -52, x1: 52, z: 42, n: 5, h: 8 });
  carpark(g, { x: -40, z: 37, w: 30, d: 14, y: 0.2, seed: 2, fill: 0.8, rows: 1, base: false });
  return finalize(g);
}
