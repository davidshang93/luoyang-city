// 洛阳站（陇海线普速站）。正面 +Z = 南广场；铁轨由引擎绘制，从站房背后沿 X 方向穿过。
// 站台中心线 z = -66 / -92 / -118，长 300m（x∈[-150,150]），宽 10m，高 1.2m。站台之间的股道区域留空。
import { THREE, C, mat, box, cyl, plaza, tower, sign, tree, lamp, flag, patternTex, finalize } from './_kit.js';
import { COL, pavingZone, fountain, planter, treeRow, bench, lampRow, roofDeck, roofPlant, coping, glassVolume, parkedCar, bar, led, sub, signFrame } from './_retail.js';

const PLAT_Z = [-66, -92, -118];
const PLAT_W = 10, PLAT_L = 300, PLAT_H = 1.2;
const BRIDGE_X = 40;      // 跨线天桥中心 x

export const meta = {
  colliders: [
    { x: 0, z: -37.5, w: 220, d: 35 },                                   // 站房
    ...PLAT_Z.map(z => ({ x: 0, z, w: PLAT_L, d: PLAT_W })),              // 站台
  ],
};

const STONE = 0xe6dfcd, STONE_D = 0xd8d0bd;

function disc3(r, t, material, x, y, z, seg = 28) { // 竖直圆盘，朝 +Z
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, t, seg), material);
  m.rotation.x = Math.PI / 2; m.position.set(x, y, z); return m;
}

export function build() {
  const g = new THREE.Group();
  const white = mat(C.white), steel = mat(C.steel), yellow = mat(0xe8c13a), concrete = mat(C.concrete), asphalt = mat(C.asphalt), stoneD = mat(STONE_D), dark = mat(COL.dark, { shiny: true });

  // ══════ 南广场 ══════
  pavingZone(g, { x: 0, z: 41, w: 320, d: 122, col: C.paving, accent: 0xa9a294, band: 20 });
  g.add(plaza(320, 10, asphalt, 0, 107, 0.15));                    // 广场前道路 z∈[102,112]
  for (let x = -150; x <= 150; x += 6) g.add(plaza(3, 0.25, white, x, 107, 0.2));
  g.add(plaza(300, 6, mat(C.paving), 0, -58, 0.15));              // 站房背后 → 1 站台的连接地坪
  for (const sx of [-1, 1]) {                                      // 花坛 + 树
    planter(g, { x: sx * 45, z: 55, w: 36, d: 18, kind: null, grass: true, rim: 0.5 });
    for (let i = 0; i < 4; i++) g.add(tree(sx * (33 + i * 8), 55, 7, 'round', 0.65));
  }
  for (let z = 0; z <= 95; z += 13) for (const x of [-158, 158]) g.add(tree(x, z, 9, 'plane'));
  for (let x = -140; x <= 140; x += 40) for (const z of [8, 38, 88]) g.add(lamp(x, z, 10));
  fountain(g, { x: 0, z: 58, r: 8 });
  g.add(flag(0, 30, 22)); g.add(box(4, 0.6, 4, mat(C.stone), 0, 0, 30));
  for (let i = 0; i < 6; i++) bench(g, -50 + i * 20, 20, 0, 0.15, 3);
  // 洛阳欢迎您
  g.add(box(26, 1.2, 3, mat(C.stoneDark), 0, 0, 80));
  g.add(box(24, 5.2, 0.6, mat(0x8f2a20), 0, 1.2, 80));
  g.add(sign('洛阳欢迎您', 23, 4.4, { bg: '#c8281e', fg: '#ffe7a3', emissive: true, x: 0, y: 3.8, z: 80.35 }));

  // ══════ 站房 ══════
  for (const sx of [-1, 1]) {
    g.add(tower(75, 18, 35, { style: 'office', wall: STONE, glass: C.glassDark, bay: 4, floor: 6, x: sx * 72.5, z: -37.5 }));
    coping(g, { x: sx * 72.5, z: -37.5, w: 75, d: 35, y: 18.7, col: STONE_D });
    roofDeck(g, { x: sx * 72.5, z: -37.5, w: 75, d: 35, y: 18 });
    roofPlant(g, { x: sx * 72.5, z: -37.5, w: 75, d: 35, y: 18, seed: 300 + sx, ac: 5, cool: 2, rooms: 2, stacks: 3, pipes: 3 });
    g.add(box(76, 0.8, 1.2, stoneD, sx * 72.5, 4.5, -19.6));         // 腰线
    // 底层售票窗 / 玻璃雨篷
    g.add(box(60, 0.4, 4, mat(0xdcd6c8), sx * 72.5, 5.2, -17.6));
    for (let i = 0; i <= 6; i++) g.add(cyl(0.25, 0.25, 5.2, steel, sx * 72.5 - 30 + i * 10, 0, -15.8, 8));
    // 翼端塔楼
    g.add(tower(12, 22, 37, { style: 'office', wall: STONE, glass: C.glassDark, bay: 3, floor: 5.5, x: sx * 104, z: -37.5 }));
    coping(g, { x: sx * 104, z: -37.5, w: 12, d: 37, y: 22.7, col: STONE_D });
  }
  g.add(sign('售票厅', 12, 2.6, { bg: '#1f4f8a', fg: '#ffffff', emissive: true, x: -72, y: 12.5, z: -19.2 }));
  g.add(sign('出站口', 12, 2.6, { bg: '#1f6a3a', fg: '#ffffff', emissive: true, x: 72, y: 12.5, z: -19.2 }));
  // 中央候车大厅
  g.add(tower(70, 28, 35, { style: 'grid', wall: STONE, glass: C.glassDark, bay: 3, floor: 7, x: 0, z: -37.5 }));
  coping(g, { x: 0, z: -37.5, w: 70, d: 35, y: 28.95, col: STONE_D });
  roofDeck(g, { x: 0, z: -37.5, w: 70, d: 35, y: 28 });
  roofPlant(g, { x: 0, z: -37.5, w: 70, d: 35, y: 28, seed: 305, ac: 3, cool: 1, rooms: 1, stacks: 2, pipes: 2, avoid: [[0, -26, 20, 14]] });
  // 大厅正面：通高玻璃幕墙 + 石材壁柱
  g.add(box(56, 22.5, 0.5, mat(C.glassBlue), 0, 4.2, -19.8));
  for (let k = 0; k <= 7; k++) g.add(box(0.25, 22.5, 0.4, mat(COL.alu, { shiny: true }), -28 + k * 8, 4.2, -19.4));
  for (const y of [9.5, 15, 20.5]) g.add(box(56, 0.3, 0.4, mat(COL.alu, { shiny: true }), 0, y, -19.4));
  for (let i = -4; i <= 4; i++) g.add(box(1.8, 28, 1.4, mat(0xf0ead9), i * 8 - (i === 0 ? 0 : 0), 0, -19.3));
  g.add(box(72, 1.6, 2.2, stoneD, 0, 26.4, -19.2));                  // 檐口
  g.add(sign('洛阳站', 40, 7.4, { bg: 'transparent', fg: '#d61f1f', emissive: true, x: 0, y: 22.8, z: -17.9 }));
  // 钟楼：大厅正中升起的方塔，四面大钟 + 攒尖顶
  g.add(tower(14, 12, 14, { style: 'grid', wall: STONE, glass: C.glassDark, bay: 7, floor: 12, x: 0, y: 29, z: -30, roof: false }));
  g.add(box(15.4, 1.0, 15.4, stoneD, 0, 41, -30));
  const cone = new THREE.Mesh(new THREE.ConeGeometry(10.5, 6.5, 4), mat(C.tileGrey)); cone.rotation.y = Math.PI / 4; cone.position.set(0, 45.5, -30); g.add(cone);
  g.add(cyl(0.08, 0.25, 5, mat(C.gold), 0, 48.5, -30, 6));
  const faces = [[0, -22.95, 0], [0, -37.05, Math.PI], [7.05, -30, Math.PI / 2], [-7.05, -30, -Math.PI / 2]];
  for (const [x, z, ry] of faces) {
    const f = sub(g, x, 35, z, ry);
    f.add(disc3(4.3, 0.5, mat(0x6d5a3a), 0, 0, 0.1)); f.add(disc3(3.7, 0.5, mat(C.white), 0, 0, 0.3));
    for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6, m = box(0.22, k % 3 ? 0.5 : 0.8, 0.1, mat(C.black)); m.position.set(Math.sin(a) * 3.1, Math.cos(a) * 3.1, 0.6); m.rotation.z = -a; f.add(m); }
    const h1 = box(0.3, 2.4, 0.12, mat(C.black), 0.5, 0, 0.7); h1.rotation.z = -0.5; f.add(h1);
    const h2 = box(0.22, 3.0, 0.12, mat(C.black), -0.9, -0.2, 0.7); h2.rotation.z = 2.2; f.add(h2);
  }
  // 入口门廊：宽挑檐 + 立柱 + 台阶
  g.add(box(64, 1.0, 9, concrete, 0, 8.5, -15.5));
  g.add(box(64.4, 0.5, 9.4, stoneD, 0, 9.5, -15.5));
  for (let i = -3; i <= 3; i++) g.add(cyl(0.55, 0.6, 8.5, mat(0xf0ead9), i * 10, 0, -11.5, 12));
  for (let i = 0; i < 4; i++) g.add(box(66 - i * 1.2, 0.14 * (4 - i), 1.1, mat(C.stone), 0, 0, -10.3 + i * 1.0));
  g.add(sign('LUOYANG RAILWAY STATION', 34, 2.2, { bg: '#26303a', fg: '#ffffff', emissive: true, x: 0, y: 11.2, z: -10.9 }));
  g.add(box(50, 7, 0.3, mat(C.glassDark, { shiny: true }), 0, 0.3, -19.3));
  for (let i = 0; i < 4; i++) g.add(box(0.2, 7, 0.4, dark, -18.75 + i * 12.5, 0.3, -19.0));

  // ══════ 站台 + 雨棚 ══════
  const platMat = mat(0xb7b2a6, { map: patternTex('tiles', 0xb7b2a6) }), roofGrey = mat(0x8c9196), skylight = mat(C.glassBlue), beam = mat(0x5c6166);
  for (const z of PLAT_Z) {
    g.add(box(PLAT_L, PLAT_H, PLAT_W, platMat, 0, 0, z));
    for (const s of [-1, 1]) g.add(box(PLAT_L, 0.03, 0.5, yellow, 0, PLAT_H, z + s * (PLAT_W / 2 - 0.7)));
    for (let x = -140; x <= 140; x += 20) {                         // 雨棚：双柱 + 横梁 + 斜撑
      g.add(cyl(0.25, 0.25, 5.6, steel, x, PLAT_H, z, 8)); g.add(box(0.4, 0.5, 10, steel, x, 6.6, z));
      for (const s of [-1, 1]) bar(g, [x, 5.2, z], [x, 6.9, z + s * 3.6], 0.14, steel);
    }
    g.add(box(PLAT_L - 16, 0.35, 10.6, roofGrey, 0, 7.0, z));
    g.add(box(PLAT_L - 16, 0.12, 2.6, skylight, 0, 7.38, z));         // 中央采光带
    for (const s of [-1, 1]) g.add(box(PLAT_L - 16, 0.5, 0.25, beam, 0, 6.9, z + s * 5.3));
    for (const x of [-60, 60]) {                                    // 站名牌
      g.add(box(0.15, 2.6, 0.15, steel, x - 1.6, PLAT_H, z)); g.add(box(0.15, 2.6, 0.15, steel, x + 1.6, PLAT_H, z));
      g.add(box(3.6, 0.9, 0.12, white, x, PLAT_H + 2.6, z));
    }
    for (let x = -120; x <= 120; x += 30) bench(g, x, z + 2.2, 0, PLAT_H, 2.2);
  }
  // ══════ 跨线天桥（底 8.2m，柱只落在站台上） ══════
  const zN = PLAT_Z[PLAT_Z.length - 1] - 3, zS = -55, bl = zS - zN, bz = (zS + zN) / 2;
  g.add(tower(9, 4.4, bl, { style: 'office', wall: 0xdcd6c8, glass: C.glassBlue, bay: 3, floor: 4.4, x: BRIDGE_X, y: 8.2, z: bz }));
  g.add(box(10, 0.6, bl, concrete, BRIDGE_X, 12.6, bz)); g.add(box(10, 0.6, bl, concrete, BRIDGE_X, 7.6, bz));
  g.add(box(9.6, 0.4, bl - 1, roofGrey, BRIDGE_X, 13.2, bz));
  for (const z of PLAT_Z) {
    for (const dx of [-3.5, 3.5]) g.add(box(0.9, 7.6 - PLAT_H, 0.9, concrete, BRIDGE_X + dx, PLAT_H, z));
    const run = 12, rise = 8.2 - PLAT_H, L = Math.hypot(run, rise);
    for (const s of [1, -1]) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(L, 0.5, 3.2), concrete);
      st.position.set(BRIDGE_X + s * (4.5 + run / 2), PLAT_H + rise / 2, z + s * 2.6); st.rotation.z = -s * Math.atan2(rise, run); g.add(st);
      const rl = new THREE.Mesh(new THREE.BoxGeometry(L, 0.08, 0.08), steel);                // 扶手
      rl.position.set(BRIDGE_X + s * (4.5 + run / 2), PLAT_H + rise / 2 + 1.0, z + s * 2.6 + 1.5); rl.rotation.z = -s * Math.atan2(rise, run); g.add(rl);
    }
  }
  // ══════ 公交站棚 + 公交车 ══════
  for (let i = 0; i < 3; i++) {
    const x = -140 + i * 22, z = 99;
    g.add(box(14, 0.3, 3, mat(0x2f6fa8), x, 3, z));
    for (const dx of [-6.5, 6.5]) g.add(box(0.2, 3, 0.2, steel, x + dx, 0, z - 1.2));
    g.add(box(13, 2.4, 0.08, mat(C.glassBlue, { opacity: 0.5 }), x, 0.4, z - 1.3));
    g.add(box(6, 0.4, 0.6, mat(C.wood), x, 0.45, z - 0.8));
  }
  g.add(sign('公交车站 BUS', 10, 1.6, { bg: '#2f6fa8', fg: '#ffffff', emissive: true, x: -118, y: 4.2, z: 100.6 }));
  for (const x of [-138, -112]) {
    g.add(box(12, 3.0, 2.5, mat(0x2f9a5a), x, 0.4, 106));
    g.add(box(10.6, 1.0, 2.56, mat(C.glassDark), x - 0.4, 2.0, 106));
    for (const dx of [-3.8, 3.8]) for (const s of [-1, 1]) g.add(box(1.0, 1.0, 0.3, mat(C.black), x + dx, 0.15, 106 + s * 1.2));
  }
  // ══════ 出租车候客区（广场东侧） ══════
  g.add(plaza(60, 24, asphalt, 120, 40, 0.2));
  for (let i = 0; i <= 10; i++) { g.add(plaza(0.2, 5, white, 92 + i * 5.6, 33, 0.25)); g.add(plaza(0.2, 5, white, 92 + i * 5.6, 47, 0.25)); }
  g.add(plaza(60, 0.4, yellow, 120, 40, 0.25));
  for (let i = 0; i < 8; i++) parkedCar(g, 94.8 + i * 5.6, i % 2 ? 33 : 47, 0xe9c93a, i % 2 ? 0 : Math.PI, 0.25);
  g.add(box(0.3, 4, 0.3, steel, 88, 0, 53));
  g.add(sign('出租车候客区', 9, 1.8, { bg: '#e9c93a', fg: '#1d1d1d', x: 88, y: 4.8, z: 53.2 }));
  g.add(box(12, 0.3, 4, mat(0x2f6fa8), 120, 3.2, 54)); for (const dx of [-5.5, 5.5]) g.add(box(0.2, 3.2, 0.2, steel, 120 + dx, 0, 54));
  return finalize(g);
}
