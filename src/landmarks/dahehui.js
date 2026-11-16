// 大河荟：龙门高铁站北侧新商业综合体，5 层现代流线造型（白色穿孔铝板 + 彩色玻璃盒子）+ 28 层酒店塔楼，正面（北）朝 +Z
import { THREE, C, mat, box, cyl, plaza, tower, tiledBox, sign, patternTex, finalize } from './_kit.js';
import { COL, mallBlock, entrance, ledWall, fins, belt, crown, glassVolume, roofDeck, roofPlant, skylights, shopfront, signPlate, pavingZone, planter, treeRow, bench, lampRow, carpark, led, bar } from './_retail.js';

export const meta = {
  colliders: [
    { x: 15, z: -25, w: 120, d: 80 },   // 商场
    { x: -65, z: -35, w: 30, d: 28 },   // 酒店塔楼
  ],
};

export function build() {
  const g = new THREE.Group(), mx = 15, mz = -25, white = mat(0xf4f4f0), perf = mat(0xdfe3e6, { map: patternTex('lattice', 0xdfe3e6, 0x666e75), key: 'perf' });
  pavingZone(g, { x: 0, z: 42, w: 170, d: 56, col: C.paving, accent: 0xa9a294, band: 14 });

  // 商场：下 2 层宽体 + 上 3 层错位收进
  mallBlock(g, { x: mx, z: mz, w: 120, d: 80, h: 11.2, floor: 5.6, bay: 6, wall: 0xe8e6e0, glass: 0x4f7a98, cap: 0xf4f4f0, shops: ['front', 'right'], deck: false, plant: false, belts: false, seed: 121 });
  // 下层屋面做成露台：铺地 + 花池 + 座椅（上部体量之前）
  g.add(plaza(112, 9, mat(0xb9b2a2), mx, 10, 11.35)); 
  for (let i = 0; i < 7; i++) planter(g, { x: mx - 45 + i * 15, z: 11.5, w: 6, d: 2.4, kind: i % 2 ? 'round' : 'peonyBush', th: i % 2 ? 4.5 : 2.5, y: 11.4, grass: true });
  mallBlock(g, { x: mx + 3, z: mz - 6, y: 11.2, w: 112, d: 70, h: 16.8, floor: 5.6, bay: 6, wall: 0xf1f0ec, glass: 0x4f7a98, cap: 0xf4f4f0, shops: [], sky: 2, seed: 123, belts: true,
    plant: { ac: 6, cool: 2, rooms: 3, stacks: 4, pipes: 4, mast: true, avoid: [[mx + 23, mz - 8, 44, 18]] } });
  // 穿孔铝板外挂 + 竖向铝翅
  for (let i = 0; i < 6; i++) g.add(tiledBox(18, 15, 0.8, perf, 1.2, 1.2, mx - 40 + i * 20 + 3, 12.5, mz - 6 + 35.6 + (i % 2) * 0.8));
  fins(g, { x0: mx - 50, x1: mx + 56, z: mz - 6 + 36.6, y: 12, h: 16, pitch: 3.5, t: 0.14, depth: 0.5, col: 0xffffff });
  // 彩色玻璃盒子悬挑立面
  [[-30, 17, 14, 8, 0xff7a2f], [10, 21, 16, 7, 0x2fa8ff], [42, 16, 12, 9, 0xe03a6e]].forEach(([dx, y, w, h, c]) => {
    g.add(box(w, h, 7, mat(c, { opacity: 0.8 }), mx + dx, y, mz + 31.5));
    g.add(box(w + 0.4, 0.4, 7.4, white, mx + dx, y - 0.2, mz + 31.5)); g.add(box(w + 0.4, 0.4, 7.4, white, mx + dx, y + h, mz + 31.5));
  });
  ledWall(g, { x: mx, y: 8, z: mz + 40.7, w: 26, h: 8, seed: 125 });
  signPlate(g, { x: mx + 3, y: 23.5, z: mz - 6 + 35.8, w: 30, h: 6, col: 0x084a63 });
  g.add(sign('大河荟', 30, 6, { bg: '#0d6b8c', fg: '#ffffff', border: '#ffffff', emissive: true, x: mx + 3, y: 23.5, z: mz - 6 + 36.2 }));
  g.add(sign('新商业 · 高铁北站', 22, 2.8, { bg: '#ffffff', fg: '#0d6b8c', emissive: true, x: mx - 30, y: 25.2, z: mz - 6 + 36.2 }));
  belt(g, { x: mx, y: 5.6, z: mz + 40.6, w: 121, d: 0.8, t: 0.4, col: 0xf4f4f0 });
  glassVolume(g, { x: mx, y: 0, z: mz + 44, w: 26, h: 7.6, d: 8, floor: 7.6 });
  entrance(g, { x: mx, z: mz + 48.2, w: 20, h: 6.4, dc: 9, fascia: 0x0d6b8c, steps: 3, pillars: 4 });
  // 屋顶流线遮阳（半透明板 + 立柱）
  g.add(box(40, 0.5, 14, mat(0xffffff, { opacity: 0.6 }), mx + 23, 32, mz - 8));
  for (const dx of [3, 43]) for (const dz of [-14, 0]) g.add(cyl(0.3, 0.3, 4.2, mat(C.steel), mx + dx, 28, mz - 8 + dz + 7, 6));

  // 28 层酒店 / 写字楼塔楼
  const hx = -65, hz = -35;
  g.add(tower(36, 7, 34, { style: 'mall', wall: 0xe8e6e0, glass: C.glassDark, bay: 6, floor: 7, x: hx, z: hz }));
  shopfront(g, { x: hx, z: hz + 17, w: 34, h: 5, seed: 127 });
  g.add(tower(26, 80, 24, { style: 'glass', glass: C.glassBlue, wall: 0xaebdc6, bay: 3.5, floor: 3.6, shiny: true, x: hx, y: 7, z: hz, roof: false }));
  g.add(tower(20, 8, 18, { style: 'glass', glass: C.glassBlue, wall: 0xaebdc6, bay: 3.5, floor: 3.6, shiny: true, x: hx, y: 87, z: hz, roof: false }));
  crown(g, { x: hx, z: hz, w: 20, d: 18, y: 95, h: 4.5 }); g.add(box(14, 0.5, 12, led(0xbfe9ff, 0.9), hx, 95, hz));
  g.add(sign('大河荟酒店', 16, 2.6, { bg: '#0d4a66', fg: '#ffffff', emissive: true, x: hx, y: 10.5, z: hz + 17.4 }));

  treeRow(g, { x0: -72, x1: 72, z: 52, n: 11, kind: 'plane', th: 7 });
  lampRow(g, { x0: -72, x1: 72, z: 38, n: 9, h: 8 });
  for (const x of [-35, 35]) planter(g, { x, z: 58, w: 10, d: 3, kind: 'peonyBush', th: 3, grass: true });
  for (let i = 0; i < 3; i++) bench(g, -12 + i * 12, 46, 0);
  carpark(g, { x: -5, z: 64, w: 76, d: 8, y: 0.2, seed: 17, fill: 0.85, rows: 1, base: false, lanes: false });
  return finalize(g);
}
