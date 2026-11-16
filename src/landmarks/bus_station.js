// 洛阳汽车站（锦远汽车站，金谷园路，火车站对面）。正面 +Z（朝北）；后院（-Z）为发车场。
import { THREE, C, mat, box, cyl, plaza, tower, sign, tree, lamp, patternTex, finalize } from './_kit.js';
import { COL, pavingZone, planter, treeRow, bench, lampRow, roofDeck, roofPlant, coping, glassVolume, shopfront, fins, belt, bar, led, sub } from './_retail.js';

export const meta = {
  colliders: [
    { x: 0, z: 30, w: 88, d: 30 },        // 主楼
  ],
};

function disc3(r, t, material, x, y, z, seg = 28) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, t, seg), material);
  m.rotation.x = Math.PI / 2; m.position.set(x, y, z); return m;
}
// 长途大巴：车头朝 +Z（车身 + 窗带 + 前挡风 + 行李舱 + 车轮 + 目的地屏 + 车顶空调）
function bus(g, x, z, color, stripe) {
  const s = sub(g, x, 0.15, z), body = mat(color), win = mat(C.glassDark, { shiny: true });
  s.add(box(2.5, 2.8, 12, body, 0, 0.55, 0));
  s.add(box(2.56, 1.0, 10.2, win, 0, 2.0, -0.6));
  s.add(box(2.3, 1.5, 0.1, win, 0, 1.75, 6.02));
  s.add(box(2.56, 0.35, 11.6, mat(stripe), 0, 1.25, 0));
  s.add(box(2.1, 0.5, 3.2, mat(0xdedede), 0, 3.35, -2));                                  // 车顶空调
  s.add(box(1.7, 0.3, 0.06, led(0xe8a317, 0.9), 0, 3.1, 6.04));                           // 目的地屏
  s.add(box(2.4, 0.4, 0.2, mat(C.black), 0, 0.55, 6.05));                                 // 前保险杠
  for (const dz of [-3.6, 3.8]) for (const sd of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.34, 10), mat(C.black)); w.rotation.z = Math.PI / 2; w.position.set(sd * 1.1, 0.52, dz); s.add(w); }
}

export function build() {
  const g = new THREE.Group();
  const steel = mat(C.steel), concrete = mat(C.concrete), white = mat(C.white), asphalt = mat(C.asphalt), stoneD = mat(0xd5cebd), blue = 0x2f6fa8;

  // ══════ 主楼（5 层，88 x 30 x 22） ══════
  g.add(tower(88, 22, 30, { style: 'office', wall: 0xe6e0d2, glass: C.glassBlue, bay: 4, floor: 4.4, x: 0, z: 30 }));
  coping(g, { x: 0, z: 30, w: 88, d: 30, y: 22.7, col: 0xd5cebd });
  roofDeck(g, { x: 0, z: 30, w: 88, d: 30, y: 22 });
  roofPlant(g, { x: 0, z: 30, w: 88, d: 30, y: 22, seed: 401, ac: 5, cool: 2, rooms: 2, stacks: 3, pipes: 2, avoid: [[0, 40, 30, 12]] });
  shopfront(g, { x: -29, z: 45, w: 28, h: 4.6, seed: 402 }); shopfront(g, { x: 29, z: 45, w: 28, h: 4.6, seed: 403 });
  fins(g, { x0: -43, x1: 43, z: 45.2, y: 4.8, h: 17.2, pitch: 8, t: 0.5, depth: 0.5, col: 0xd5cebd });
  belt(g, { x: 0, y: 4.8, z: 45.4, w: 89, d: 0.7, t: 0.4, col: 0xd5cebd });
  // 中部凸出门厅（玻璃体）+ 顶部钟楼
  glassVolume(g, { x: 0, y: 0, z: 46.5, w: 26, h: 22, d: 3, floor: 4.4, glass: C.glassBlue, pitch: 3.25, cap: false });
  g.add(tower(28, 8, 6, { style: 'grid', wall: 0xe6e0d2, glass: C.glassDark, bay: 4, floor: 8, x: 0, y: 22, z: 44 }));
  g.add(box(29.4, 0.8, 7.4, stoneD, 0, 30.2, 44));
  g.add(disc3(2.8, 0.4, mat(0x6d5a3a), 0, 26.5, 47.1)); g.add(disc3(2.4, 0.4, white, 0, 26.5, 47.35));
  for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6, m = box(0.18, 0.5, 0.08, mat(C.black)); m.position.set(Math.sin(a) * 2.0, 26.5 + Math.cos(a) * 2.0, 47.6); m.rotation.z = -a; g.add(m); }
  { const h1 = box(0.25, 1.8, 0.1, mat(C.black)); h1.position.set(0.4, 27.2, 47.7); h1.rotation.z = -0.5; g.add(h1); const h2 = box(0.2, 2.2, 0.1, mat(C.black)); h2.position.set(-0.7, 26.0, 47.7); h2.rotation.z = 2.2; g.add(h2); }
  g.add(sign('洛阳汽车站', 26, 4.6, { bg: 'transparent', fg: '#d61f1f', emissive: true, x: 0, y: 19.3, z: 48.3 }));
  // 入口雨棚
  g.add(box(40, 0.6, 7, concrete, 0, 5.2, 51.5)); g.add(box(40.4, 0.5, 0.5, mat(blue), 0, 5.0, 55.1));
  g.add(box(40, 0.05, 6, led(COL.warm, 0.4), 0, 5.17, 51.5));
  for (const x of [-18, -6, 6, 18]) g.add(cyl(0.3, 0.3, 5.2, steel, x, 0, 54.5, 8));
  g.add(sign('售票厅 候车厅', 14, 1.4, { bg: '#1f4f8a', fg: '#ffffff', emissive: true, x: 0, y: 6.8, z: 55.35 }));
  for (let i = 0; i < 3; i++) g.add(box(42 - i, 0.13 * (3 - i), 0.9, mat(C.stone), 0, 0, 55.6 + i * 0.0 - i * 0.0));
  // 前广场
  pavingZone(g, { x: 0, z: 50, w: 118, d: 9, col: C.paving, accent: 0xa9a294, band: 10 });
  treeRow(g, { x0: -52, x1: 52, z: 52.5, n: 5, kind: 'plane', th: 7, size: 2.6 });
  lampRow(g, { x0: -52, x1: 52, z: 53.5, n: 4, h: 8 });
  for (const x of [-34, 34]) bench(g, x, 50, 0, 0.15, 3);

  // ══════ 后院发车场 ══════
  g.add(plaza(116, 70, asphalt, 0, -20, 0.15));
  g.add(box(80, 0.3, 6, mat(C.stone), 0, 0, 12));                          // 上车站台
  g.add(plaza(80, 0.4, mat(0xe8c13a), 0, 8.8, 0.2));
  const bays = 8, bw = 9, x0 = -bw * bays / 2;
  for (let i = 0; i <= bays; i++) {
    const x = x0 + i * bw;
    for (const z of [10.5, -9]) g.add(cyl(0.22, 0.22, 5.2, steel, x, 0, z, 8));
    g.add(box(0.15, 0.02, 16, white, x, 0.2, -2));                          // 车位线
    for (const s of [-1, 1]) bar(g, [x, 4.6, 10.5], [x, 5.7, 10.5 + s * 0 - 3], 0.14, steel);
  }
  for (let i = 0; i < bays; i++) {                                         // 带顶棚发车位：蓝色棚面 + 采光带 + 檐口
    const xc = x0 + (i + 0.5) * bw;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(bw - 0.3, 0.35, 21), mat(i % 2 ? blue : 0x3a7fbf));
    roof.position.set(xc, 5.6, 0.5); roof.rotation.x = -0.06; g.add(roof);
    g.add(box(1.4, 0.1, 17, mat(C.glassBlue), xc, 5.82, 0.5));
    g.add(box(1.6, 0.8, 0.1, mat(0x1d2a38), xc, 4.0, 10.4));               // 车位号牌
    g.add(box(1.0, 0.5, 0.06, led(0xe8a317, 0.9), xc, 4.15, 10.34));
  }
  g.add(box(bw * bays, 0.5, 0.3, steel, 0, 5.3, 10.5));
  for (let i = 0; i < 4; i++) bench(g, -30 + i * 20, 13, Math.PI, 0.3, 3);
  const busCols = [[0xf2f2ee, blue], [blue, 0xf2f2ee], [0x2f9a5a, 0xf2f2ee], [0xf2f2ee, 0x2f9a5a], [0xf2f2ee, 0xc8281e], [blue, 0xe8c13a]];
  [0, 1, 3, 4, 5, 7].forEach((i, k) => bus(g, x0 + (i + 0.5) * bw, 2.5, busCols[k][0], busCols[k][1]));
  bus(g, -40, -38, 0xf2f2ee, blue); bus(g, -28, -38, 0x2f9a5a, 0xf2f2ee); bus(g, -16, -38, 0xf2f2ee, 0xc8281e);
  // 调度室 + 候车亭
  g.add(box(10, 3.5, 6, mat(0xe6e0d2), 45, 0, -42)); g.add(box(10.6, 0.4, 6.6, mat(0x3a7fbf), 45, 3.5, -42));
  g.add(box(6, 1.6, 0.1, mat(C.glassDark, { shiny: true }), 45, 1.0, -38.9));
  // 围墙 + 出站口
  const wallM = mat(0xcfc8b8);
  g.add(box(0.4, 2.4, 70, wallM, -58, 0, -20)); g.add(box(0.4, 2.4, 70, wallM, 58, 0, -20));
  g.add(box(80, 2.4, 0.4, wallM, -18, 0, -54.8));
  g.add(box(0.6, 6, 0.6, steel, 24, 0, -54.8)); g.add(box(0.6, 6, 0.6, steel, 56, 0, -54.8));
  g.add(box(32.6, 1.2, 0.6, mat(blue), 40, 6, -54.8));
  g.add(sign('出站口 EXIT', 12, 1.1, { bg: '#2f6fa8', fg: '#ffffff', emissive: true, x: 40, y: 6.6, z: -54.4 }));
  for (const x of [-50, 50]) g.add(lamp(x, -25, 9));
  for (const z of [-48, -28]) g.add(tree(-53, z, 7, 'round'));
  return finalize(g);
}
