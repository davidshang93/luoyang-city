// 万达广场(西工)：5 层购物中心裙房（米色石材 + 玻璃橱窗 + 广告屏）+ 3 栋公寓/写字塔楼，正面 +Z
import { THREE, C, mat, box, cyl, plaza, tower, sign, tree, lamp, flag, finalize } from './_kit.js';
import { COL, mallBlock, entrance, ledWall, fins, belt, crown, signFrame, signPlate, roofPlant, pavingZone, fountain, planter, treeRow, bench, lampRow, carpark, led, sub } from './_retail.js';

export const meta = {
  colliders: [
    { x: 0, z: -30, w: 140, d: 200 },
    { x: -48, z: -95, w: 28, d: 22 }, { x: 0, z: -95, w: 28, d: 22 }, { x: 48, z: -95, w: 28, d: 22 },
  ],
};

export function build() {
  const g = new THREE.Group();
  const stone = 0xe3d7b8, alu = mat(COL.alu, { shiny: true });
  const TW = [[-48, 'apartment', 100, 0xd8cfb8], [0, 'glass', 104, 0], [48, 'apartment', 96, 0xe0d6c0]];

  // ── 门前广场 ──
  pavingZone(g, { x: 0, z: 104, w: 150, d: 66, col: C.paving, accent: 0xa9a294, band: 22 });
  fountain(g, { x: 0, z: 108, r: 7 });
  treeRow(g, { x0: -54, x1: 54, z: 92, n: 7, kind: 'plane', th: 7 });
  for (const sx of [-1, 1]) { planter(g, { x: sx * 30, z: 112, w: 8, d: 5, kind: 'peonyBush', th: 3.5, grass: true }); bench(g, sx * 22, 118, 0); bench(g, sx * 38, 118, 0); }
  lampRow(g, { x0: -66, x1: 66, z: 124, n: 6, h: 8 });
  for (const sx of [-1, 1]) g.add(flag(sx * 12, 80, 16, 0xd4281c));
  carpark(g, { x: 54, z: 128, w: 40, d: 14, y: 0.15, seed: 3, fill: 0.8, rows: 1 });

  // ── 裙房：5 层 26m ──
  mallBlock(g, { x: 0, z: -30, w: 140, d: 200, h: 26, floor: 5.2, bay: 6, wall: stone, glass: C.glassDark, cap: 0xcfc3a3, sky: 3, seed: 5,
    plant: { ac: 10, cool: 3, rooms: 3, stacks: 5, pipes: 5, mast: true, avoid: TW.map(t => [t[0], -95, 30, 24]) } });
  // 立面：竖向石材壁柱 + 横向铝带 + 蓝色标识带
  fins(g, { x0: -68, x1: 68, z: 70.4, y: 4.8, h: 20.6, pitch: 6, t: 0.7, depth: 0.5, col: 0xd4c8a6 });
  belt(g, { x: 0, y: 4.9, z: 70.5, w: 141, d: 0.7, t: 0.45 });
  belt(g, { x: 0, y: 22.5, z: 70.4, w: 141, d: 0.5, t: 0.5, col: 0x1d5bd6 });
  g.add(box(141, 0.14, 0.2, led(0x2f80ed, 0.9), 0, 22.2, 70.8));
  // 两侧大屏（夜里发光）
  ledWall(g, { x: -50, y: 8.5, z: 70.6, w: 26, h: 11, seed: 2 }); ledWall(g, { x: 50, y: 8.5, z: 70.6, w: 26, h: 11, seed: 4 });
  ledWall(g, { x: -20, y: 10, z: 70.6, w: 12, h: 8, seed: 6, dim: 0.15 }); ledWall(g, { x: 22, y: 10, z: 70.6, w: 12, h: 8, seed: 8, dim: 0.15 });

  // ── 主入口：通高玻璃门厅 + 雨棚 + 大红字 ──
  g.add(box(38, 26, 7, mat(C.glassBlue), 0, 0, 73.5));
  for (let i = 0; i <= 12; i++) g.add(box(0.25, 26, 0.35, alu, -18 + i * 3, 0, 77.2));
  for (let k = 1; k <= 5; k++) g.add(box(38.4, 0.35, 0.5, alu, 0, k * 5.2 - 0.2, 77.2));
  g.add(box(40, 1.0, 9.2, mat(0xcfc3a3), 0, 26, 73.2));
  g.add(box(36, 0.4, 7, mat(COL.roofDeck), 0, 27, 73.5));
  entrance(g, { x: 0, z: 77.2, w: 24, h: 6.4, dc: 9, fascia: 0xc8161d, steps: 3, pillars: 4 });
  signPlate(g, { x: 0, y: 21.6, z: 77.5, w: 32, h: 5.2, col: 0x8f1218 });
  g.add(sign('万达广场', 32, 5.2, { bg: '#c8161d', fg: '#ffffff', border: '#ffffff', emissive: true, x: 0, y: 21.6, z: 77.85 }));
  g.add(sign('WANDA PLAZA', 20, 1.6, { bg: '#1d5bd6', fg: '#ffffff', emissive: true, x: 0, y: 17.4, z: 77.5 }));
  // 步行街入口拱门
  for (const x of [-62.5, -49.5]) g.add(box(2.2, 13, 2.4, mat(C.concreteDark), x, 0, 74));
  g.add(box(16, 3, 3, mat(0xc8161d), -56, 12, 74));
  g.add(box(16.4, 0.3, 3.4, alu, -56, 15, 74));
  g.add(sign('万达步行街', 10, 1.6, { bg: '#ffffff', fg: '#c8161d', x: -56, y: 13.5, z: 75.6 }));

  // ── 三栋塔楼（坐在裙房屋面上） ──
  for (const [x, st, h, wall] of TW) {
    if (st === 'glass') {
      g.add(tower(28, h, 22, { style: 'glass', glass: C.glassBlue, shiny: true, bay: 4, floor: 3.4, x, y: 26, z: -95, roof: false }));
      crown(g, { x, z: -95, w: 28, d: 22, y: 26 + h, h: 5 });
    } else g.add(tower(28, h, 22, { style: 'apartment', wall, glass: C.glassDark, bay: 4, floor: 3.4, x, y: 26, z: -95 }));
  }
  return finalize(g);
}
