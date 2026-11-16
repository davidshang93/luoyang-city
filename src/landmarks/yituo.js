// 一拖东方红：苏式厂门 + 东方红拖拉机雕塑 + 红砖锯齿厂房 + 烟囱
import { THREE, C, mat, box, cyl, sphere, plaza, gableRoof, tower, sign, tree, flag, patternTex, finalize } from './_kit.js';

export const meta = {
  colliders: [
    { x: -39, z: 45, w: 42, d: 18 },     // 左翼楼
    { x: 39, z: 45, w: 42, d: 18 },      // 右翼楼
    { x: -11.5, z: 45, w: 13, d: 18 },   // 中央左墩（中间 10m 为通道）
    { x: 11.5, z: 45, w: 13, d: 18 },    // 中央右墩
    { x: 0, z: 82, w: 14, d: 8 },        // 雕塑基座
    { x: -20, z: 12, w: 150, d: 36 },    // 厂房 1
    { x: -20, z: -30, w: 150, d: 36 },   // 厂房 2
    { x: -20, z: -72, w: 150, d: 36 },   // 厂房 3
    { x: 105, z: -60, w: 6, d: 6 },      // 烟囱
  ],
};

function wheelX(r, w, material, x, y, z, seg = 14) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, seg), material);
  m.rotation.z = Math.PI / 2; m.position.set(x, y, z); return m;
}

/** 东方红履带拖拉机，车头朝 +Z，s=1 时约 3.3m 长 */
export function crawlerTractor(s = 1, body = 0xc8201a) {
  const g = new THREE.Group();
  const red = mat(body), blk = mat(0x1c1d1f), gry = mat(0x6a6f75), dark = mat(0x2b2e33), glass = mat(C.glassBlue, { shiny: true });
  const B = (w, h, d, m, x, y, z, ry = 0) => g.add(box(w * s, h * s, d * s, m, x * s, y * s, z * s, ry));
  for (const sx of [-1, 1]) {
    const x = sx * 0.95;
    B(0.55, 0.9, 2.4, blk, x, 0.05, 0);
    g.add(wheelX(0.45 * s, 0.55 * s, blk, x * s, 0.5 * s, 1.2 * s));
    g.add(wheelX(0.45 * s, 0.55 * s, blk, x * s, 0.5 * s, -1.2 * s));
    for (const z of [-0.65, 0, 0.65]) g.add(wheelX(0.27 * s, 0.64 * s, gry, x * s, 0.33 * s, z * s, 10));
    g.add(wheelX(0.3 * s, 0.64 * s, gry, x * s, 0.5 * s, -1.2 * s, 10));
    g.add(wheelX(0.3 * s, 0.64 * s, gry, x * s, 0.5 * s, 1.2 * s, 10));
    B(0.75, 0.1, 2.9, red, x, 1.0, -0.05);
    for (let i = 0; i < 7; i++) B(0.6, 0.06, 0.12, dark, x, 0.93, -1.05 + i * 0.35);
  }
  B(1.4, 0.45, 3.0, dark, 0, 0.55, 0);
  B(1.1, 0.9, 1.7, red, 0, 1.0, 0.95);
  B(0.95, 0.12, 1.5, red, 0, 1.9, 0.95);
  B(0.9, 0.62, 0.12, dark, 0, 1.15, 1.83);
  B(0.7, 0.1, 0.05, gry, 0, 1.55, 1.9);
  for (const sx of [-1, 1]) g.add(sphere(0.13 * s, mat(0xfff0a0, { emissive: 0xfff0a0 }), sx * 0.42 * s, 1.5 * s, 1.84 * s, 6));
  B(1.2, 0.1, 1.5, dark, 0, 1.0, -0.78);
  B(0.55, 0.14, 0.5, dark, 0, 1.15, -0.85);
  B(0.55, 0.55, 0.12, dark, 0, 1.25, -1.1);
  for (const sx of [-1, 1]) for (const z of [-0.1, -1.45]) B(0.09, 1.35, 0.09, red, sx * 0.62, 1.05, z);
  B(1.5, 0.1, 1.75, red, 0, 2.4, -0.78);
  B(1.14, 0.9, 0.06, glass, 0, 1.15, -1.5);
  for (const sx of [-1, 1]) B(0.05, 0.85, 1.1, glass, sx * 0.62, 1.2, -0.78);
  g.add(cyl(0.2 * s, 0.2 * s, 0.05 * s, dark, 0, 1.55 * s, -0.25 * s, 8));
  g.add(cyl(0.06 * s, 0.07 * s, 0.9 * s, blk, 0.28 * s, 1.95 * s, 1.35 * s, 6));
  g.add(cyl(0.11 * s, 0.06 * s, 0.1 * s, blk, 0.28 * s, 2.85 * s, 1.35 * s, 6));
  B(0.5, 0.45, 0.45, dark, 0, 0.6, -1.7);
  return g;
}

function sawHall(g, cx, cz, L = 150, D = 36) {
  g.add(box(L, 10, D, mat(0xa04a36, { map: patternTex('brick', 0xa04a36, 0x2a0a00) }), cx, 0, cz));
  g.add(tower(L + 0.2, 8.5, D + 0.2, { style: 'grid', wall: 0xa04a36, glass: 0x4f6f86, bay: 7.5, floor: 8.5, x: cx, y: 0.5, z: cz }));
  g.add(box(L + 0.8, 0.5, D + 0.8, mat(C.concrete), cx, 10, cz));
  // 锯齿屋顶：6 个齿，竖向玻璃面朝 +Z 一侧
  const n = 6, tw = D / n, th = 4.5, pts = [new THREE.Vector2(0, 0)];
  for (let i = 0; i < n; i++) { pts.push(new THREE.Vector2(i * tw, th)); pts.push(new THREE.Vector2((i + 1) * tw, 0.25)); }
  pts.push(new THREE.Vector2(D, 0));
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: L, bevelEnabled: false });
  geo.rotateY(-Math.PI / 2); geo.translate(L / 2, 0, -D / 2);
  const m = new THREE.Mesh(geo, mat(0xa9b3b8)); m.position.set(cx, 10.5, cz); g.add(m);
  for (let i = 0; i < n; i++) g.add(box(L - 1, th * 0.82, 0.12, mat(C.glassBlue, { shiny: true }), cx, 10.6, cz - D / 2 + i * tw + 0.08));
  g.add(box(10, 6.5, 0.4, mat(0x3a4a58), cx - 20, 0, cz + D / 2 + 0.05));
}

export function build() {
  const g = new THREE.Group();
  const cream = 0xe3cf9a, glassC = 0x6a7f8a;
  const GZ = 45;

  g.add(plaza(150, 44, mat(C.paving, { map: patternTex('paving', C.paving) }), 0, 78, 0.15, 4));
  g.add(plaza(24, 44, mat(C.pavingRed, { map: patternTex('paving', C.pavingRed) }), 0, 78, 0.18, 4));
  g.add(plaza(12, 60, mat(C.asphalt), 0, 0, 0.15));

  // ── 苏式厂门楼 ──
  for (const sx of [-1, 1]) g.add(tower(13, 20, 18, { style: 'grid', wall: cream, glass: glassC, bay: 4.3, floor: 5, x: sx * 11.5, z: GZ }));
  g.add(tower(36, 14.5, 18, { style: 'grid', wall: cream, glass: glassC, bay: 4.3, floor: 5, y: 5.5, z: GZ }));
  g.add(box(36, 1.2, 18, mat(C.wallWhite), 0, 5, GZ));
  g.add(box(38, 1.0, 20, mat(C.stoneDark), 0, 20, GZ));
  g.add(box(14, 2.2, 8, mat(cream), 0, 21, GZ));
  g.add(box(16, 0.5, 9, mat(C.stoneDark), 0, 23.2, GZ));
  g.add(box(0.6, 6, 0.6, mat(C.steel), 0, 23.7, GZ));
  g.add(box(3.2, 2.2, 0.3, mat(0xd4281c, { double: true }), 1.9, 27.3, GZ));
  for (let i = 0; i < 6; i++) g.add(cyl(0.75, 0.85, 14.5, mat(C.wallWhite), -13.5 + i * 5.4, 0.8, GZ + 12, 12));
  g.add(box(36, 0.8, 5, mat(C.stoneDark), 0, 0, GZ + 11.5));
  g.add(box(34, 2.2, 3.5, mat(C.wallWhite), 0, 15.3, GZ + 12));
  g.add(gableRoof(34.4, 5, 3.6, mat(C.wallWhite), 0, 17.5, GZ + 12));
  g.add(sign('第一拖拉机制造厂', 30, 1.9, { bg: '#e9e3d2', fg: '#c8201a', x: 0, y: 16.4, z: GZ + 13.8 }));
  for (let i = 0; i < 4; i++) g.add(box(30 - i, 0.25 * (4 - i), 1, mat(C.stone), 0, 0.15, GZ + 14.5 + i));
  for (const sx of [-1, 1]) {
    g.add(tower(42, 14.5, 18, { style: 'grid', wall: cream, glass: glassC, bay: 4.2, floor: 4.8, x: sx * 39, z: GZ }));
    g.add(box(43, 0.9, 19, mat(C.stoneDark), sx * 39, 14.5, GZ));
    g.add(box(41, 0.6, 17, mat(C.concrete), sx * 39, 15.4, GZ));
    g.add(box(6, 4.5, 1, mat(C.wallWhite), sx * 39, 0, GZ + 9.3));
    g.add(box(7, 0.4, 2, mat(C.stoneDark), sx * 39, 4.5, GZ + 9.5));
  }

  // ── 东方红拖拉机雕塑 ──
  g.add(box(14, 2.2, 8, mat(C.marble), 0, 0.15, 82));
  g.add(box(15, 0.5, 9, mat(C.stoneDark), 0, 2.35, 82));
  const tr = crawlerTractor(3.4); tr.position.set(0, 2.85, 82); g.add(tr);
  g.add(sign('东方红', 7, 1.4, { bg: '#e9e3d2', fg: '#c8201a', x: 0, y: 1.2, z: 86.2 }));

  // ── 花坛、旗杆、树 ──
  for (const sx of [-1, 1]) {
    g.add(plaza(22, 12, mat(0x8a6a4a), sx * 42, 76, 0.2));
    g.add(plaza(18, 8, mat(0xd9472b), sx * 42, 76, 0.24));
    for (let i = -2; i <= 2; i++) g.add(sphere(1.0, mat(i % 2 ? 0xe9c43a : 0xd9472b), sx * 42 + i * 3.6, 0.9, 76, 6));
    for (let i = 0; i < 3; i++) g.add(flag(sx * (62 + i * 4.5), 96, 15 - i, 0xd4281c));
    for (let i = 0; i < 4; i++) g.add(tree(sx * (58 + i * 7), 62, 8, 'plane'));
  }

  // ── 厂房 & 烟囱 ──
  sawHall(g, -20, 12);
  sawHall(g, -20, -30);
  sawHall(g, -20, -72);
  g.add(cyl(1.6, 2.7, 50, mat(0x9a4a35, { map: patternTex('brick', 0x9a4a35, 0x000000) }), 105, 0, -60, 14));
  g.add(cyl(2.0, 1.7, 1.5, mat(C.black), 105, 50, -60, 14));
  g.add(cyl(2.4, 2.4, 0.5, mat(0xd4281c), 105, 38, -60, 14));
  g.add(cyl(2.2, 2.2, 0.5, mat(C.white), 105, 42, -60, 14));
  for (let i = 0; i < 6; i++) g.add(tree(-105 + i * 14, 40, 8, 'plane'));
  return finalize(g);
}
