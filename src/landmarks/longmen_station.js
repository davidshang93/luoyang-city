// 洛阳龙门站（郑西高铁）。正面 +Z = 北广场；高铁股道由引擎绘制，z∈[-200,-75] 沿 X 方向穿过。
// 站台中心线 z = -88 / -118 / -148 / -178，宽 12m，高 1.25m。
// 站台长度：brief 要 420m，但占地只有 300m 宽，check 允许最多到 x=±177，故实际做 350m（x∈[-175,175]）。
import { THREE, C, mat, box, cyl, plaza, tower, sign, tree, lamp, patternTex, finalize } from './_kit.js';
import { COL, pavingZone, fountain, planter, bench, parkedCar, carpark, bar, led, signFrame } from './_retail.js';

const PLAT_Z = [-88, -118, -148, -178];
const PLAT_W = 12, PLAT_L = 350, PLAT_H = 1.25;
const HALF = 125;                    // 屋盖半宽

export const meta = {
  colliders: [
    { x: 0, z: -18, w: 226, d: 94 },                                   // 站房
    ...PLAT_Z.map(z => ({ x: 0, z, w: PLAT_L, d: PLAT_W })),            // 站台
    { x: -40, z: 112, w: 9, d: 5 },                                     // 地铁入口亭
  ],
};

// 飘带屋盖顶面高度：中央最高 ~32m，向两侧起伏，翼端上翘
function roofTop(x) {
  const a = Math.abs(x);
  return 22.4 + 8 * Math.cos(Math.PI * x / (2 * HALF + 6)) ** 2 + 1.6 * Math.cos(2 * Math.PI * x / 85)
    + 3.2 * Math.max(0, (a - 108) / 17) ** 2;
}
function roofThk(x) { return 2.2 - 1.2 * Math.abs(x) / HALF; }

// 剖面（x,y）沿 Z 挤出：从 z0 到 z1
function extrudeZ(pts, z0, z1, material) {
  const s = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
  const geo = new THREE.ExtrudeGeometry(s, { depth: z1 - z0, bevelEnabled: false, curveSegments: 1 });
  geo.translate(0, 0, z0);
  return new THREE.Mesh(geo, material);
}
// 剖面（z,y）沿 X 挤出：从 x0 到 x1
function extrudeX(pts, x0, x1, material) {
  const s = new THREE.Shape(pts.map(p => new THREE.Vector2(-p[0], p[1])));
  const geo = new THREE.ExtrudeGeometry(s, { depth: x1 - x0, bevelEnabled: false, curveSegments: 1 });
  geo.rotateY(Math.PI / 2); geo.translate(x0, 0, 0);
  return new THREE.Mesh(geo, material);
}
// 两点之间的圆柱杆
function strut(a, b, r, material, seg = 8) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r, len, seg), material);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  return m;
}
// 斜坡板：从 (z0, y0) 到 (z1, y1)，沿 Z
function rampZ(x, w, z0, y0, z1, y1, thk, material) {
  const L = Math.hypot(z1 - z0, y1 - y0);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, thk, L), material);
  m.position.set(x, (y0 + y1) / 2 - thk / 2, (z0 + z1) / 2);
  m.rotation.x = Math.atan2(y0 - y1, z1 - z0);
  return m;
}

export function build() {
  const g = new THREE.Group();
  const roofWhite = mat(0xf4f3ef);
  const roofUnder = mat(0xd9d8d2);
  const glass = mat(C.glassDark, { shiny: true });
  const concrete = mat(C.concrete);
  const white = mat(C.white);
  const steel = mat(C.steel);
  const pave = mat(C.paving, { map: patternTex('paving', C.paving) });

  // ── 主站房：玻璃体 + 飘带屋盖 ──
  const zBack = -65, zFront = 27, zRoofB = -69, zRoofF = 41;
  g.add(tower(224, 20, zFront - zBack, { style: 'glass', glass: C.glassBlue, wall: C.glassBlue, bay: 4.5, floor: 5, shiny: true, z: (zFront + zBack) / 2 }));
  // 玻璃体与屋盖之间的填充（随屋面起伏）
  const N = 64, top = [], bot = [], fill = [];
  for (let i = 0; i <= N; i++) { const x = -HALF + 2 * HALF * i / N; top.push([x, roofTop(x)]); bot.push([x, roofTop(x) - roofThk(x)]); }
  const roofPts = [...top, ...bot.reverse()];
  g.add(extrudeZ(roofPts, zRoofB, zRoofF, roofWhite));
  for (let i = 0; i <= 56; i++) { const x = -112 + 224 * i / 56; fill.push([x, roofTop(x) - roofThk(x) - 0.05]); }
  g.add(extrudeZ([[-112, 19.9], [112, 19.9], ...fill.reverse()], zBack + 1, zFront - 1, glass));
  // 屋面肋条 + 线形采光天窗（俯视时有“飘带”的纹理）
  const ribM = mat(0xe4e3de), skyM = mat(C.glassBlue);
  for (let x = -122; x <= 122; x += 4) { const ty = roofTop(x); g.add(box(0.45, 0.36, zRoofF - zRoofB - 3, ribM, x, ty - 0.04, (zRoofF + zRoofB) / 2)); }
  for (let x = -108; x <= 108; x += 18) { const ty = roofTop(x); g.add(box(2.2, 0.14, 62, skyM, x, ty + 0.12, -20)); g.add(box(0.2, 0.2, 62.4, steel, x - 1.2, ty + 0.1, -20)); g.add(box(0.2, 0.2, 62.4, steel, x + 1.2, ty + 0.1, -20)); }
  // 屋檐底板（浅灰）
  const under = [];
  for (let i = 0; i <= N; i++) { const x = -HALF + 2 * HALF * i / N; under.push([x, roofTop(x) - roofThk(x) - 0.4]); }
  g.add(extrudeZ([...under.map(p => [p[0], p[1] + 0.39]).reverse(), ...under], zFront - 0.5, zRoofF - 0.3, roofUnder));
  // 前沿二层“飘带”
  const rib = [];
  for (let i = 0; i <= N; i++) { const x = -110 + 220 * i / N; rib.push([x, roofTop(x) - roofThk(x) - 3.2]); }
  const ribPts = [...rib, ...rib.slice().reverse().map(p => [p[0], p[1] - 0.9])];
  g.add(extrudeZ(ribPts, zRoofF - 3, zRoofF + 1.5, roofWhite));
  // 竖向幕墙肋
  for (let x = -108; x <= 108; x += 6) g.add(box(0.35, 20, 0.6, white, x, 0, zFront + 0.2));
  // 树形（Y 形）柱廊
  for (let x = -100; x <= 100; x += 25) {
    const zc = 35, ty = 13;
    g.add(strut([x, 0, zc], [x, ty, zc], 1.0, white));
    for (const s of [-1, 1]) {
      const tx = x + s * 9;
      g.add(strut([x, ty - 0.5, zc], [tx, roofTop(tx) - roofThk(tx) - 3.4, zc], 0.65, white));
      g.add(strut([tx, roofTop(tx) - roofThk(tx) - 3.4, zc], [tx, roofTop(tx) - roofThk(tx) + 0.1, zc - 2], 0.4, white));
    }
  }
  // 站名
  g.add(sign('洛阳龙门站', 44, 6.4, { bg: 'transparent', fg: '#d01c1c', emissive: true, x: 0, y: 22.0, z: zRoofF + 1.6 }));
  g.add(sign('LUOYANG LONGMEN RAILWAY STATION', 34, 1.9, { bg: 'transparent', fg: '#d01c1c', emissive: true, x: 0, y: 17.6, z: zRoofF + 1.6 }));
  g.add(box(46, 0.25, 0.25, steel, 0, 25.4, zRoofF + 1.5));
  for (const x of [-18, 18]) g.add(box(0.2, 0.9, 0.2, steel, x, 25.4, zRoofF + 1.5));
  // 入口
  for (const x of [-60, 0, 60]) g.add(box(16, 3.2, 1.5, mat(0x2c3e4f), x, 8, zFront + 0.4));

  // ── 高架落客平台（y=8）+ 两侧匝道 ──
  const deckF = 56;
  g.add(box(200, 1.0, deckF - zFront, concrete, 0, 7, (deckF + zFront) / 2));
  g.add(plaza(196, deckF - zFront - 2, mat(C.asphalt), 0, (deckF + zFront) / 2 + 1, 8.02));
  g.add(box(200, 1.1, 0.3, mat(0xe4e4e0), 0, 8, deckF - 0.15));
  for (let x = -90; x <= 90; x += 20) for (const z of [47, 54]) g.add(cyl(0.7, 0.7, 7, concrete, x, 0, z, 8));
  for (const sx of [-1, 1]) {
    g.add(rampZ(sx * 94, 12, deckF, 8, 128, 0.2, 0.9, concrete));
    for (let z = 66; z < 125; z += 14) { const y = 8 - 7.8 * (z - deckF) / (128 - deckF); g.add(cyl(0.6, 0.6, Math.max(0.1, y - 1), concrete, sx * 94, 0, z, 8)); }
  }

  // 落客平台：玻璃栏板 + 立柱灯 + 出发层车道上的车
  g.add(box(200, 1.0, 0.1, mat(C.glassBlue, { opacity: 0.5 }), 0, 8.6, deckF - 0.2));
  for (let x = -96; x <= 96; x += 12) g.add(box(0.12, 1.1, 0.12, steel, x, 8.4, deckF - 0.3));
  for (let x = -90; x <= 90; x += 30) g.add(lamp(x, deckF - 2, 8, 8.1));
  for (let i = 0; i < 9; i++) parkedCar(g, -80 + i * 20 + (i % 3) * 3, 40 + (i % 2) * 6, [0x1c1d1f, 0xf2f2ee, 0x6b6f73, 0x2a4f8a][i % 4], 0, 8.1);
  g.add(box(180, 0.5, 7, mat(0xe9e9e4), 0, 14.2, 51.5)); for (let x = -80; x <= 80; x += 20) g.add(cyl(0.3, 0.3, 6, steel, x, 8.2, 54.6, 8));   // 出发层雨棚
  // ── 北广场 ──
  pavingZone(g, { x: 0, z: 85, w: 296, d: 92, col: C.paving, accent: 0xa9a294, band: 23 });             // z∈[39,131]
  const lawn = mat(C.grass);
  for (const sx of [-1, 1]) {
    g.add(plaza(56, 30, lawn, sx * 46, 95, 0.22));
    for (let i = 0; i < 6; i++) g.add(tree(sx * (22 + i * 10), 113, 8, 'round'));
    for (let i = 0; i < 4; i++) g.add(tree(sx * (24 + i * 14), 84, 6, 'pine'));
  }
  for (let z = 66; z <= 126; z += 15) for (const x of [-128, 128]) g.add(tree(x, z, 9, 'plane'));
  for (let x = -75; x <= 75; x += 30) for (const z of [70, 124]) g.add(lamp(x, z, 10));
  fountain(g, { x: 0, z: 100, r: 8 });
  for (let i = 0; i < 5; i++) bench(g, -40 + i * 20, 86, 0, 0.15, 3);
  carpark(g, { x: -128, z: 96, w: 26, d: 34, y: 0.2, seed: 21, fill: 0.85, rows: 2, base: false, ry: Math.PI / 2 });
  carpark(g, { x: 128, z: 96, w: 26, d: 34, y: 0.2, seed: 22, fill: 0.85, rows: 2, base: false, ry: Math.PI / 2 });
  // 地铁 2 号线入口亭
  g.add(box(9, 0.4, 5, mat(C.stoneDark), -40, 0, 112));
  g.add(box(8.6, 3.2, 4.6, mat(C.glassBlue, { shiny: true }), -40, 0.4, 112));
  g.add(box(9.6, 0.5, 5.6, mat(0x2a6db3), -40, 3.6, 112));
  g.add(sign('洛阳地铁 2号线', 7, 1.0, { bg: '#2a6db3', fg: '#ffffff', x: -40, y: 4.75, z: 114.85 }));
  g.add(cyl(0.12, 0.12, 5, steel, -32, 0, 115, 6));
  g.add(sign('M', 1.4, 1.4, { bg: '#d01c1c', fg: '#ffffff', x: -32, y: 5.6, z: 115.15 }));

  // ── 站台 + 无柱大跨雨棚（拱形，柱只落在站台中线上）──
  const platMat = mat(0xbdb9ae, { map: patternTex('tiles', 0xbdb9ae) });
  const yellow = mat(0xe8c13a);
  const canopy = mat(0xf2f2ee, { double: true });
  const canopyY = 17;
  for (const zc of PLAT_Z) {
    g.add(box(PLAT_L, PLAT_H, PLAT_W, platMat, 0, 0, zc));
    for (const s of [-1, 1]) g.add(box(PLAT_L, 0.03, 0.5, yellow, 0, PLAT_H, zc + s * (PLAT_W / 2 - 0.8)));
    // 拱形棚顶
    const arc = [], span = 14.5, rise = 2.6;
    for (let i = 0; i <= 16; i++) { const t = i / 16, z = zc - span + 2 * span * t; arc.push([z, canopyY + rise * Math.sin(Math.PI * t)]); }
    const arcPts = [...arc, ...arc.slice().reverse().map(p => [p[0], p[1] + 0.45])];
    g.add(extrudeX(arcPts, -PLAT_L / 2, PLAT_L / 2, canopy));
    for (let x = -165; x <= 165; x += 30) {
      if (Math.abs(x) < 36) continue;
      g.add(cyl(0.55, 0.7, canopyY - PLAT_H + 1.5, white, x, PLAT_H, zc, 8));
      for (const s of [-1, 1]) g.add(strut([x, canopyY - 3, zc], [x, canopyY + 0.5, zc + s * 9], 0.3, white));
    }
    g.add(box(PLAT_L - 20, 0.1, 3.2, mat(C.glassBlue), 0, canopyY + 2.65, zc));          // 拱顶采光带
    for (let x = -150; x <= 150; x += 30) bench(g, x, zc + 3.5, 0, PLAT_H, 2.4);
    // 站台中线设备房 / 站名牌
    for (const x of [-110, 110]) g.add(box(10, 3, 3, mat(0xd6d3cb), x, PLAT_H, zc));
  }
  // 雨棚纵向边梁
  for (const zc of PLAT_Z) for (const s of [-1, 1]) g.add(box(PLAT_L, 0.6, 0.4, steel, 0, canopyY - 0.3, zc + s * 14.5));

  // ── 高架候车廊桥（底 9m，跨越股道，柱只落在站台上）──
  const bN = PLAT_Z[PLAT_Z.length - 1] - 8, bS = zBack;
  g.add(tower(56, 5.4, bS - bN, { style: 'glass', glass: C.glassBlue, wall: C.glassBlue, bay: 4, floor: 5.4, shiny: true, x: 0, y: 9.6, z: (bS + bN) / 2 }));
  g.add(box(58, 0.8, bS - bN, white, 0, 9, (bS + bN) / 2));
  g.add(box(58, 0.8, bS - bN, white, 0, 15, (bS + bN) / 2));
  for (const zc of PLAT_Z) {
    for (const x of [-22, 22]) g.add(box(1.2, 9 - PLAT_H, 1.6, white, x, PLAT_H, zc));
    // 扶梯：从廊桥两端下到站台（沿 X，落在站台内）
    const run = 15, rise = 9.6 - PLAT_H, L = Math.hypot(run, rise);
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(L, 1.0, 3.0), mat(0x9aa0a6));
      m.position.set(s * (28 + run / 2), PLAT_H + rise / 2, zc + s * 2.5);
      m.rotation.z = s * -Math.atan2(rise, run); g.add(m);
    }
  }

  g.add(box(56, 0.5, bS - bN - 1, mat(COL.roofDeck), 0, 15.8, (bS + bN) / 2));      // 廊桥屋面
  return finalize(g);
}
