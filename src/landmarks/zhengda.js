// 正大国际广场：北部购物中心(-Z) + 南部高层塔楼群，围合中央下沉广场与步行街。正面 +Z。
import { THREE, C, mat, box, cyl, plaza, tower, sign, finalize } from './_kit.js';
import { lamp } from './_kit.js';
import { COL, mallBlock, entrance, ledWall, fins, belt, crown, glassVolume, dome, shopfront, roofDeck, roofPlant, signPlate, pavingZone, fountain, planter, bench, lampRow, carpark, led, treeRow } from './_retail.js';

const TOWERS = [
  // x, z, w, d, h, glass, crown
  [-105, 25, 38, 38, 140, C.glassBlue, 'step'],
  [105, 25, 38, 38, 120, C.glassGreen, 'ring'],
  [-105, 100, 36, 36, 100, C.glassBlue, 'slant'],
  [105, 100, 36, 36, 125, C.glassBlue, 'spire'],
  [0, 128, 44, 44, 135, C.glassGreen, 'spire'],
  [-60, 140, 30, 30, 90, C.glassBlue, 'step'],
  [60, 140, 30, 30, 80, C.glassGreen, 'ring'],
];
export const meta = {
  colliders: [
    { x: 0, z: -110, w: 200, d: 100 },
    ...TOWERS.map(t => ({ x: t[0], z: t[1], w: t[2], d: t[3] })),
  ],
};

export function build() {
  const g = new THREE.Group(), red = 0xc8102e, mz = -110, zf = mz + 50;
  // ── 铺装：中央广场 + 红色步行街 + 下沉圆广场（台阶）
  pavingZone(g, { x: 0, z: 20, w: 150, d: 250, col: C.paving, accent: 0xa9a294, band: 25 });
  g.add(plaza(14, 150, mat(C.pavingRed), 0, 70, 0.2));
  for (let i = 0; i < 3; i++) g.add(cyl(26 - i * 3.5, 26 - i * 3.5 + 0.8, 0.2, mat(i % 2 ? C.stone : C.marble), 0, 0.15 + i * 0.1, 30, 36));
  fountain(g, { x: 0, z: 30, r: 7, y: 0.4 });

  // ── 购物中心 200x100x28
  mallBlock(g, { x: 0, z: mz, w: 200, d: 100, h: 28, floor: 5.6, bay: 6, wall: 0xe9e2d8, glass: 0x4f7a98, cap: 0xb9b5ab, sky: 4, seed: 81,
    plant: { ac: 10, cool: 4, rooms: 4, stacks: 6, pipes: 6, mast: true, avoid: [[60, mz - 10, 40, 40]] } });
  dome(g, { x: 60, y: 28.3, z: mz - 10, r: 13 });
  // 红色铝板立面 + 色块 + 竖向灯带
  g.add(box(72, 12, 0.9, mat(red), 0, 12.5, zf + 0.5));
  fins(g, { x0: -36, x1: 36, z: zf + 1.1, y: 12.5, h: 12, pitch: 2.4, t: 0.18, depth: 0.3, col: 0xf2efe6 });
  for (let i = 0; i < 4; i++) { ledWall(g, { x: -78 + i * 16, y: 12, z: zf + 0.5, w: 12, h: 9, seed: 82 + i, dim: 0.15 }); ledWall(g, { x: 46 + i * 16, y: 12, z: zf + 0.5, w: 12, h: 9, seed: 86 + i, dim: 0.15 }); }
  fins(g, { x0: -98, x1: 98, z: zf + 0.3, y: 5.6, h: 22, pitch: 11.5, t: 0.8, depth: 0.45, col: 0xf2efe6 });
  belt(g, { x: 0, y: 5.6, z: zf + 0.7, w: 201, d: 1.4, t: 0.5, col: 0xb9b5ab });
  // 玻璃入口 + 红色雨棚
  glassVolume(g, { x: 0, y: 0, z: zf + 5, w: 32, h: 9, d: 10, floor: 9, pitch: 3 });
  entrance(g, { x: 0, z: zf + 10.2, w: 24, h: 6.5, dc: 10, fascia: red, steps: 3, pillars: 4 });
  signPlate(g, { x: 0, y: 21.8, z: zf + 1.2, w: 44, h: 7, col: 0x8f0a22 });
  g.add(sign('正大广场', 44, 7, { bg: '#c8102e', fg: '#ffffff', border: '#ffd45a', emissive: true, x: 0, y: 21.8, z: zf + 1.55 }));
  g.add(sign('ZHENGDA 潮流汇', 30, 3.6, { bg: '#7a0a1e', fg: '#ffd9a0', emissive: true, x: 0, y: 9.2, z: zf + 1.55 }));

  // ── 塔楼群（裙座 + 玻璃幕墙 + 各式收顶）
  for (const [x, z, w, d, h, gl, kind] of TOWERS) {
    const base = 8;
    g.add(tower(w + 8, base, d + 8, { style: 'mall', wall: 0xcfcac0, glass: C.glassDark, bay: 6, floor: 8, x, z }));
    shopfront(g, { x, z: z + (d + 8) / 2, w: w + 6, h: 5.2, seed: 90 + x + z });
    g.add(tower(w, h, d, { style: 'glass', glass: gl, wall: 0x9fb0bc, bay: 3.5, floor: 4, shiny: true, x, y: base, z, roof: false }));
    const top = base + h;
    if (kind === 'step') {
      g.add(tower(w - 8, 14, d - 8, { style: 'glass', glass: gl, bay: 3.5, floor: 4, shiny: true, x, y: top, z, roof: false }));
      crown(g, { x, z, w: w - 8, d: d - 8, y: top + 14, h: 5 });
    } else if (kind === 'ring') {
      g.add(box(w + 1, 1.6, d + 1, led(0xbfe9ff, 0.9), x, top, z)); crown(g, { x, z, w: w - 6, d: d - 6, y: top + 1.6, h: 5 });
    } else if (kind === 'slant') {
      for (let k = 0; k < 4; k++) g.add(box(w - k * 6, 2.5, d - k * 6, mat(k % 2 ? C.glassBlue : C.concreteDark), x, top + k * 2.5, z));
      g.add(cyl(0.2, 0.35, 14, mat(C.steel), x, top + 10, z, 6));
    } else {
      g.add(tower(w - 10, 12, d - 10, { style: 'glass', glass: gl, bay: 3.5, floor: 4, shiny: true, x, y: top, z, roof: false }));
      crown(g, { x, z, w: w - 10, d: d - 10, y: top + 12, h: 4 }); g.add(cyl(0.2, 0.7, 24, mat(C.steel), x, top + 16, z, 6));
    }
    g.add(box(w + 8.6, 0.5, 3, mat(COL.white), x, 6.8, z + (d + 8) / 2 + 1.2));
  }
  g.add(sign('正大国际城', 22, 3, { bg: '#143a66', fg: '#ffffff', emissive: true, x: 0, y: 10, z: 150.6 }));

  // ── 陈设
  for (let i = -3; i <= 3; i++) { planter(g, { x: -30, z: -40 + i * 18, w: 3.2, d: 3.2, kind: 'round', th: 7 }); planter(g, { x: 30, z: -40 + i * 18, w: 3.2, d: 3.2, kind: 'plane', th: 7 }); }
  for (let z = 70; z <= 130; z += 20) for (const sx of [-1, 1]) g.add(lamp(sx * 9, z, 7));
  for (let i = 0; i < 4; i++) { planter(g, { x: -65, z: -30 + i * 14, w: 8, d: 3, kind: 'peonyBush', th: 3, grass: true }); bench(g, 65, -30 + i * 14, Math.PI / 2); }
  carpark(g, { x: -45, z: -52, w: 62, d: 8, y: 0.2, seed: 14, fill: 0.85, rows: 1, base: false, lanes: false });
  carpark(g, { x: 45, z: -52, w: 40, d: 8, y: 0.2, seed: 15, fill: 0.8, rows: 1, base: false, lanes: false });
  return finalize(g);
}
