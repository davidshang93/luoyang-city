// 万达广场(涧西)：流线型浅色铝板购物中心 + 彩色竖向灯带 + 玻璃弧面主入口 + 屋顶影城 + 背后双塔，正面 +Z
import { THREE, C, mat, box, cyl, sphere, plaza, tower, sign, finalize } from './_kit.js';
import { COL, mallBlock, entrance, ledWall, fins, belt, cylFacade, signFrame, signPlate, roofDeck, roofPlant, pavingZone, planter, treeRow, bench, lampRow, carpark, lightStrips, led, shopfront } from './_retail.js';

export const meta = {
  colliders: [
    { x: 0, z: -20, w: 200, d: 130 },     // 购物中心
    { x: -45, z: -90, w: 32, d: 22 },     // 塔楼 A
    { x: 45, z: -90, w: 32, d: 22 },      // 塔楼 B
  ],
};

export function build() {
  const g = new THREE.Group(), aluM = mat(COL.alu, { shiny: true }), zf = 45;
  pavingZone(g, { x: 0, z: 72, w: 210, d: 52, col: C.paving, accent: 0xa9a294, band: 13 });

  // 主体 5 层 28m：浅色铝板 + 逐层白色飘带
  mallBlock(g, { x: 0, z: -20, w: 200, d: 130, h: 28, floor: 5.6, bay: 6, wall: 0xe9e8e2, glass: 0x4d6a80, cap: 0xeeeeea, shops: ['front'], sky: 3, seed: 141,
    plant: { ac: 8, cool: 3, rooms: 3, stacks: 5, pipes: 5, mast: true, avoid: [[20, -40, 74, 44]] } });
  for (let i = 1; i <= 5; i++) g.add(box(204, 0.5, 134, aluM, 0, i * 5.6 - 0.55, -20));
  // 两端圆角体量
  for (const s of [-1, 1]) cylFacade(g, { x: s * 94, z: 30, r: 14, h: 28, floor: 5.6, glass: 0x4d6a80, band: 0xeeeeea, n: 24 });
  // 彩色竖向灯带 + 顶部 LED 屏带
  lightStrips(g, { x0: -96, x1: 96, z: zf + 0.6, y: 5.4, h: 17, n: 26, seed: 7, skip: [[-26, 26]] });
  g.add(box(150, 3.2, 0.5, mat(0x161a26), 0, 22.6, zf + 0.6));
  for (let i = 0; i < 12; i++) ledWall(g, { x: -69 + i * 12.5, y: 21.6, z: zf + 0.8, w: 8, h: 2.2, seed: 142 + i, dim: 0.05, cell: 1.2 });
  // 主入口：大玻璃弧面 + 雨棚环 + 红字
  cylFacade(g, { x: 0, z: zf, r: 18, h: 20, floor: 5, glass: C.glassBlue, band: 0xeeeeea, n: 32 });
  entrance(g, { x: 0, z: zf + 17.6, w: 22, h: 6.4, dc: 9, fascia: 0xc8102e, steps: 3, pillars: 4 });
  g.add(cyl(14, 14, 0.5, aluM, 0, 6.4, zf, 32));
  signPlate(g, { x: 0, y: 23.8, z: zf + 18.4, w: 44, h: 6.4, col: 0x8f0a22 });
  g.add(sign('万达广场', 44, 6.4, { bg: '#c8102e', fg: '#ffffff', border: '#ffe9b0', emissive: true, x: 0, y: 23.8, z: zf + 18.8 }));

  // 屋顶影城体量（暗色盒体 + 竖向灯条 + 屋面设备）
  g.add(box(70, 9, 40, mat(0xd6d2c8), 20, 28.9, -40));
  g.add(box(70.8, 0.7, 40.8, aluM, 20, 37.9, -40));
  fins(g, { x0: -14, x1: 54, z: -19.7, y: 29, h: 8.5, pitch: 3.4, t: 0.4, depth: 0.5, col: 0xb9b4a6 });
  roofPlant(g, { x: 20, z: -40, w: 70, d: 40, y: 38.6, seed: 144, ac: 3, cool: 1, rooms: 1, stacks: 2, pipes: 2 });
  g.add(sign('影城', 24, 3.6, { bg: '#1a1d2a', fg: '#ffd24a', emissive: true, x: 20, y: 33.4, z: -19.4 }));
  g.add(box(26, 5, 18, mat(0xb9bec2), -50, 28.9, -20));

  // 背后双塔 100m（顶部彩色冠 + 设备）
  for (const s of [-1, 1]) {
    g.add(tower(30, 100, 20, { style: 'apartment', wall: 0xd9d4c8, glass: 0x4b6377, bay: 4, floor: 3.33, x: s * 45, z: -90 }));
    g.add(box(30.8, 1.2, 20.8, mat(0xb9b4a8), s * 45, 100.9, -90));
  }

  // 前广场：雕塑、树池、灯、车
  g.add(cyl(5, 6, 1, mat(C.stoneDark), 0, 0.15, 90, 24)); g.add(cyl(0.4, 0.6, 4, mat(C.steel), 0, 1.1, 90, 8)); g.add(sphere(3.2, mat(C.gold), 0, 5.4, 90, 20));
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) planter(g, { x: s * (30 + i * 20), z: 82, w: 4, d: 4, kind: 'plane', th: 7 });
  lampRow(g, { x0: -92, x1: 92, z: 62, n: 10, h: 7 });
  for (let i = 0; i < 4; i++) { bench(g, -60 + i * 40, 92, 0, 0.15, 3); }
  carpark(g, { x: 0, z: 96, w: 200, d: 8, y: 0.2, seed: 18, fill: 0.85, rows: 1, base: false, lanes: false });
  return finalize(g);
}
