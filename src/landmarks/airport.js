// 洛阳北郊机场航站区。正面（陆侧）+Z；空侧机坪 z<-55 由引擎绘制（不放实体，只有登机廊桥伸出）。
import { THREE, C, mat, box, cyl, plaza, disc, tower, sign, tree, lamp, flag, patternTex, rng, finalize } from './_kit.js';

const TOWER = { x: 150, z: -20 };

export const meta = {
  colliders: [
    { x: 0, z: 0, w: 130, d: 100 },                       // 航站楼
    { x: TOWER.x, z: TOWER.z, w: 11, d: 11 },             // 塔台
    { x: TOWER.x + 16, z: TOWER.z, w: 18, d: 14 },        // 塔台裙楼
  ],
};

// 三段波浪金属屋面，中间最高 ~22m
function roofTop(x) {
  return 16.5 + 4.2 * Math.abs(Math.cos(Math.PI * x / 46)) ** 0.8 + 1.4 * Math.cos(Math.PI * x / 150) ** 2;
}
function extrudeZ(pts, z0, z1, material) {
  const s = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
  const geo = new THREE.ExtrudeGeometry(s, { depth: z1 - z0, bevelEnabled: false, curveSegments: 1 });
  geo.translate(0, 0, z0);
  return new THREE.Mesh(geo, material);
}
function rampX(z, d, x0, y0, x1, y1, thk, material) {
  const L = Math.hypot(x1 - x0, y1 - y0);
  const m = new THREE.Mesh(new THREE.BoxGeometry(L, thk, d), material);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2 - thk / 2, z);
  m.rotation.z = Math.atan2(y1 - y0, x1 - x0);
  return m;
}

export function build() {
  const g = new THREE.Group();
  const metal = mat(0xdde2e8);
  const metalUnder = mat(0x9aa0a8);
  const concrete = mat(C.concrete);
  const white = mat(C.white);
  const steel = mat(C.steel);
  const asphalt = mat(C.asphalt);
  const pave = mat(C.paving, { map: patternTex('paving', C.paving) });
  const glass = mat(C.glassBlue, { shiny: true });

  // ── 航站楼 ──
  g.add(tower(130, 14, 100, { style: 'glass', glass: 0x5f8fb4, wall: 0x5f8fb4, bay: 4, floor: 4.5, shiny: true }));
  const N = 60, top = [], bot = [], fill = [];
  for (let i = 0; i <= N; i++) { const x = -72 + 144 * i / N; top.push([x, roofTop(x)]); bot.push([x, roofTop(x) - 1.3]); }
  g.add(extrudeZ([...top, ...bot.slice().reverse()], -54, 60, metal));
  g.add(extrudeZ([...bot.map(p => [p[0], p[1] - 0.25]), ...bot.slice().reverse()], -54, 60, metalUnder));
  for (let i = 0; i <= 52; i++) { const x = -65 + 130 * i / 52; fill.push([x, roofTop(x) - 1.35]); }
  g.add(extrudeZ([[-65, 13.9], [65, 13.9], ...fill.reverse()], -49.5, 49.5, glass));
  // 陆侧通高玻璃幕墙竖肋
  for (let x = -63; x <= 63; x += 4.5) g.add(box(0.3, 19, 0.5, white, x, 0, 50.2));
  // 屋顶 “洛阳 LUOYANG”
  g.add(sign('洛阳 LUOYANG', 58, 8, { bg: 'transparent', fg: '#c8281e', x: 0, y: roofTop(0) + 4.6, z: 52 }));
  for (const x of [-22, 0, 22]) g.add(box(0.3, 1.2, 0.3, steel, x, roofTop(x) - 0.1, 51.7));
  g.add(sign('洛阳北郊机场 LUOYANG AIRPORT', 30, 2.2, { bg: '#1e3c6e', fg: '#ffffff', x: 0, y: 10.6, z: 50.7 }));

  // ── 出发层高架车道（y=7）+ 两端坡道 ──
  const dz0 = 50, dz1 = 64, dzc = (dz0 + dz1) / 2;
  g.add(box(150, 1, dz1 - dz0, concrete, 0, 6, dzc));
  g.add(plaza(148, dz1 - dz0 - 1, asphalt, 0, dzc + 0.5, 7.02));
  g.add(box(150, 1.1, 0.3, mat(0xe4e4e0), 0, 7, dz1 - 0.15));
  for (let x = -70; x <= 70; x += 14) g.add(cyl(0.6, 0.6, 6, concrete, x, 0, dzc + 2, 8));
  for (const sx of [-1, 1]) {
    g.add(rampX(dzc, dz1 - dz0, sx * 75, 7, sx * 148, 0.2, 0.9, concrete));
    for (let k = 1; k < 5; k++) { const x = 75 + k * 14.6, y = 7 - 6.8 * (x - 75) / 73; g.add(cyl(0.5, 0.5, Math.max(0.2, y - 1), concrete, sx * x, 0, dzc, 8)); }
  }
  // 出发层雨棚
  g.add(box(140, 0.5, 9, metal, 0, 12.5, 58));
  for (let x = -66; x <= 66; x += 12) g.add(cyl(0.25, 0.25, 5.5, steel, x, 7, 62.5, 8));
  // 到达层（地面）车道 + 雨棚
  g.add(plaza(290, 16, asphalt, 0, 66, 0.15));
  for (let x = -140; x <= 140; x += 6) g.add(plaza(3, 0.25, white, x, 66, 0.2));
  g.add(box(130, 0.4, 5, steel, 0, 4.2, 66.5));
  for (let x = -60; x <= 60; x += 15) g.add(cyl(0.2, 0.2, 4.2, steel, x, 0, 68.8, 8));

  // ── 空侧登机廊桥（从 z=-50 伸出 30m）──
  for (const x of [-40, 0, 40]) {
    g.add(box(3.8, 3, 30, mat(0xd7dadf), x, 3.5, -65));
    g.add(box(4.2, 0.4, 30, steel, x, 6.5, -65));
    g.add(box(5.5, 3.4, 3.2, mat(0x4a5560), x, 3.3, -81.4));
    for (const z of [-62, -78]) {
      g.add(box(0.6, 3.5, 0.6, steel, x - 1, 0, z)); g.add(box(0.6, 3.5, 0.6, steel, x + 1, 0, z));
      g.add(box(3.2, 0.8, 1.4, mat(C.black), x, 0, z));
    }
  }

  // ── 塔台 ──
  const T = TOWER;
  g.add(box(18, 9, 14, mat(0xe9e7e1), T.x + 16, 0, T.z));
  g.add(tower(18, 8.6, 13.6, { style: 'office', wall: 0xe9e7e1, glass: C.glassDark, bay: 3, floor: 4.3, x: T.x + 16, y: 0.2, z: T.z }));
  g.add(cyl(4.2, 5.2, 45, mat(0xf0efea), T.x, 0, T.z, 20));
  for (const y of [12, 24, 36]) g.add(cyl(4.5, 4.5, 0.6, mat(0x2f5f9a), T.x, y, T.z, 20));
  g.add(cyl(7.5, 4.4, 2.5, mat(0xd9d8d2), T.x, 45, T.z, 8));
  g.add(cyl(7.2, 7.8, 5.5, mat(0x2d5d7a, { shiny: true }), T.x, 47.5, T.z, 8));
  g.add(cyl(8.4, 8.4, 0.8, mat(0xd9d8d2), T.x, 53, T.z, 8));
  g.add(cyl(3, 4, 1.5, mat(0xd9d8d2), T.x, 53.8, T.z, 8));
  g.add(cyl(0.12, 0.2, 7, steel, T.x, 55.3, T.z, 6));

  // ── 陆侧停车场（z∈[74,124]）──
  const lineM = mat(C.white);
  g.add(plaza(170, 52, asphalt, -35, 99, 0.15));
  for (const zr of [86, 112]) {
    for (let i = 0; i <= 56; i++) { const x = -116 + i * 2.8; g.add(plaza(0.15, 5, lineM, x, zr - 2.6, 0.2)); g.add(plaza(0.15, 5, lineM, x, zr + 2.6, 0.2)); }
    g.add(plaza(158, 0.15, lineM, -37.4, zr, 0.2));
  }
  const r = rng(77), cols = [0xf2f2ee, 0x1c1d1f, 0x9aa3ab, 0xb5341f, 0x2c4f8a, 0x5c6166, 0xc9c2b2];
  let n = 0;
  for (const zr of [86, 112]) for (const sgn of [-1, 1]) for (let i = 0; i < 56; i++) {
    if (r() > 0.11) continue; if (n >= 24) break; n++;
    const x = -116 + 1.4 + i * 2.8, z = zr + sgn * 2.6, col = cols[Math.floor(r() * cols.length)];
    g.add(box(1.8, 0.8, 4.4, mat(col), x, 0.35, z));
    g.add(box(1.6, 0.6, 2.4, mat(C.glassDark), x, 1.15, z - sgn * 0.2));
  }
  for (const x of [-110, -70, -30, 10, 40]) g.add(lamp(x, 99, 10));
  for (let x = -116; x <= 46; x += 12) g.add(tree(x, 125, 6, 'round'));

  // ── 进场道路 + 环岛 ──
  const RB = { x: 140, z: 98 };
  g.add(disc(24, asphalt, RB.x, RB.z, 0.16, 40));
  g.add(cyl(11, 11.5, 0.5, mat(C.stoneDark), RB.x, 0, RB.z, 32));
  g.add(disc(11, mat(C.grass), RB.x, RB.z, 0.52, 32));
  g.add(plaza(14, 15, asphalt, 150, 75, 0.15));                 // 坡道/到达道 → 环岛
  g.add(plaza(14, 12, asphalt, RB.x, 126, 0.15));                // 环岛 → 城市
  g.add(plaza(70, 14, asphalt, 85, 98, 0.15));                   // 环岛 → 停车场
  g.add(plaza(40, 14, asphalt, 190, 98, 0.15));                  // 环岛 → 东
  // 标牌（环岛中央）
  g.add(box(18, 1.2, 3, mat(C.stoneDark), RB.x, 0.5, RB.z));
  g.add(box(17, 4.4, 0.8, mat(0x1e3c6e), RB.x, 1.7, RB.z));
  g.add(sign('洛阳北郊机场', 16, 3.4, { bg: '#1e3c6e', fg: '#ffffff', x: RB.x, y: 3.9, z: RB.z + 0.45 }));
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + 0.3; g.add(tree(RB.x + Math.cos(a) * 7.5, RB.z + Math.sin(a) * 7.5, 5, 'pine', 0.5)); }
  // 旗杆
  for (let i = 0; i < 3; i++) g.add(flag(84 + i * 8, 80, 16, i === 1 ? 0xd4281c : 0x2f6fa8));
  // 灯柱
  for (let x = -130; x <= 130; x += 26) g.add(lamp(x, 75, 10));
  for (let z = -10; z <= 50; z += 20) for (const x of [-185, 100]) g.add(lamp(x, z, 10));
  // 航站楼两侧绿化
  for (let z = -40; z <= 40; z += 13) for (const x of [-80, 80]) g.add(tree(x, z, 8, 'round'));

  return finalize(g);
}
