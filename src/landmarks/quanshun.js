// 泉舜购物中心：5 层商场 + 中央玻璃穹顶 + 西侧(-X)泉舜财富中心双塔（新区制高点），正面（北）朝 +Z
import { THREE, C, mat, box, cyl, plaza, tower, sign, finalize } from './_kit.js';
import { COL, mallBlock, entrance, ledWall, fins, belt, crown, glassVolume, dome, signFrame, signPlate, pavingZone, fountain, planter, treeRow, bench, lampRow, carpark, led, shopfront } from './_retail.js';

export const meta = {
  colliders: [
    { x: 28, z: -25, w: 168, d: 110 },   // 购物中心主体
    { x: -100, z: -30, w: 30, d: 30 },   // 双塔 A
    { x: -100, z: -72, w: 30, d: 30 },   // 双塔 B
  ],
};

export function build() {
  const g = new THREE.Group(), stone = 0xe6dfd0, mx = 28, mz = -25, mw = 166, md = 110, zf = mz + md / 2;
  // ── 门前广场（浅石 + 中轴红铺装）
  pavingZone(g, { x: mx, z: 61, w: 168, d: 56, col: C.paving, accent: 0xa9a294, band: 14 });
  g.add(plaza(40, 56, mat(C.pavingRed), mx, 61, 0.2));
  // ── 购物中心主体 x -55..111, z -80..30, 高 28
  mallBlock(g, { x: mx, z: mz, w: mw, d: md, h: 28, floor: 5.6, bay: 6, wall: stone, glass: 0x4f7a98, cap: 0xb9b5ab, sky: 3, seed: 71, shops: ['front', 'right'],
    plant: { ac: 9, cool: 3, rooms: 3, stacks: 5, pipes: 5, mast: true, avoid: [[mx, mz - 5, 44, 44]] } });
  dome(g, { x: mx, y: 28.3, z: mz - 5, r: 17 });
  // 立面：石材壁柱 + 色块广告 + 中央大屏
  fins(g, { x0: mx - 78, x1: mx + 78, z: zf + 0.3, y: 5.5, h: 22, pitch: 12.5, t: 0.9, depth: 0.5, col: 0xf2efe6 });
  belt(g, { x: mx, y: 5.5, z: zf + 0.6, w: mw + 1, d: 1.2, t: 0.5, col: 0xb9b5ab });
  for (let i = 0; i < 5; i++) if (i !== 2) ledWall(g, { x: mx - 66 + i * 33, y: 14.5, z: zf + 0.5, w: 16, h: 5, seed: 72 + i });
  ledWall(g, { x: mx, y: 9, z: zf + 0.6, w: 30, h: 12, seed: 79, dim: 0.1 });
  g.add(box(0.5, 6, 40, led(0xff7a2f), mx + mw / 2 + 0.3, 14, mz + 5));
  // 主入口：通高玻璃门厅 + 雨棚
  glassVolume(g, { x: mx, y: 0, z: zf + 4, w: 30, h: 8, d: 8, floor: 8, pitch: 3 });
  entrance(g, { x: mx, z: zf + 8.2, w: 22, h: 6.4, dc: 9, fascia: 0xc8102e, steps: 3, pillars: 4 });
  signPlate(g, { x: mx, y: 23.6, z: zf + 0.8, w: 48, h: 6.5, col: 0x8f0a22 });
  g.add(sign('泉舜购物中心', 48, 6.5, { bg: '#c8102e', fg: '#ffffff', border: '#ffd45a', emissive: true, x: mx, y: 23.6, z: zf + 1.15 }));
  g.add(sign('泉舜财富中心', 20, 3, { bg: '#143a66', fg: '#ffe9a8', emissive: true, x: mx - 62, y: 23.5, z: zf + 1.15 }));

  // ── 泉舜财富中心双塔 (x=-100)：共用裙楼 + 玻璃幕双塔 + 收顶
  const tw = 28;
  g.add(tower(tw + 14, 14, 78, { style: 'mall', wall: stone, glass: C.glassDark, bay: 5, floor: 7, x: -98, z: -51 }));
  shopfront(g, { x: -98, z: -12, w: tw + 12, h: 5, seed: 75 });
  for (const [z, h, gl] of [[-30, 128, C.glassBlue], [-72, 112, C.glassGreen]]) {
    g.add(tower(tw, h, tw, { style: 'glass', glass: gl, wall: 0xaab4bd, bay: 3.5, floor: 4, shiny: true, x: -100, y: 14, z, roof: false }));
    g.add(tower(tw - 6, 10, tw - 6, { style: 'glass', glass: gl, wall: 0xaab4bd, bay: 3.5, floor: 4, shiny: true, x: -100, y: 14 + h, z, roof: false }));
    crown(g, { x: -100, z, w: tw - 6, d: tw - 6, y: 24 + h, h: 6 });
    g.add(box(tw - 12, 0.4, tw - 12, led(0xbfe9ff, 0.9), -100, 24 + h, z));
    for (const dx of [-tw / 2, tw / 2]) g.add(box(1.0, h, 1.0, mat(C.steel, { shiny: true }), -100 + dx, 14, z + tw / 2));
  }
  g.add(sign('泉舜财富中心', 16, 3, { bg: '#0f2f55', fg: '#ffffff', emissive: true, x: -98, y: 11, z: -11.8 }));

  // ── 广场陈设
  treeRow(g, { x0: mx - 77, x1: mx + 77, z: 40, n: 15, kind: 'plane', th: 7 });
  lampRow(g, { x0: mx - 72, x1: mx + 72, z: 50, n: 9, h: 8 });
  planter(g, { x: mx - 30, z: 54, w: 10, d: 3, kind: 'peonyBush', th: 3.5, grass: true }); planter(g, { x: mx + 30, z: 54, w: 10, d: 3, kind: 'peonyBush', th: 3.5, grass: true });
  fountain(g, { x: mx, z: 66, r: 6 });
  for (let i = 0; i < 4; i++) bench(g, mx - 60 + i * 40, 58, 0, 0.15, 3);
  carpark(g, { x: mx - 28, z: 79, w: 74, d: 14, y: 0.2, seed: 12, fill: 0.85, rows: 1, base: false, lanes: false });
  carpark(g, { x: mx + 60, z: 79, w: 40, d: 14, y: 0.2, seed: 13, fill: 0.8, rows: 1, base: false, lanes: false });
  return finalize(g);
}
