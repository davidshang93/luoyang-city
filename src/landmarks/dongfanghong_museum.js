// 东方红农耕博物馆：红色金属板现代展馆 + 玻璃入口 + 门前三台拖拉机
import { THREE, C, mat, box, cyl, sphere, plaza, sign, tree, patternTex, finalize } from './_kit.js';

export const meta = {
  colliders: [
    { x: 0, z: -10, w: 50, d: 56 },        // 展馆主体
    { x: -20, z: 30, w: 14, d: 9 },        // 展台
    { x: 0, z: 30, w: 14, d: 9 },
    { x: 20, z: 30, w: 14, d: 9 },
  ],
};

function wheelX(r, w, material, x, y, z, seg = 14) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, seg), material);
  m.rotation.z = Math.PI / 2; m.position.set(x, y, z); return m;
}

function crawler(s, body) {
  const g = new THREE.Group();
  const red = mat(body), blk = mat(0x1c1d1f), gry = mat(0x6a6f75), dark = mat(0x2b2e33), glass = mat(C.glassBlue, { shiny: true });
  const B = (w, h, d, m, x, y, z) => g.add(box(w * s, h * s, d * s, m, x * s, y * s, z * s));
  for (const sx of [-1, 1]) {
    const x = sx * 0.95;
    B(0.55, 0.9, 2.4, blk, x, 0.05, 0);
    g.add(wheelX(0.45 * s, 0.55 * s, blk, x * s, 0.5 * s, 1.2 * s));
    g.add(wheelX(0.45 * s, 0.55 * s, blk, x * s, 0.5 * s, -1.2 * s));
    for (const z of [-0.65, 0, 0.65]) g.add(wheelX(0.27 * s, 0.64 * s, gry, x * s, 0.33 * s, z * s, 10));
    B(0.75, 0.1, 2.9, red, x, 1.0, -0.05);
  }
  B(1.4, 0.45, 3.0, dark, 0, 0.55, 0);
  B(1.1, 0.9, 1.7, red, 0, 1.0, 0.95);
  B(0.95, 0.12, 1.5, red, 0, 1.9, 0.95);
  B(0.9, 0.62, 0.12, dark, 0, 1.15, 1.83);
  B(1.2, 0.1, 1.5, dark, 0, 1.0, -0.78);
  B(0.55, 0.14, 0.5, dark, 0, 1.15, -0.85);
  for (const sx of [-1, 1]) for (const z of [-0.1, -1.45]) B(0.09, 1.35, 0.09, red, sx * 0.62, 1.05, z);
  B(1.5, 0.1, 1.75, red, 0, 2.4, -0.78);
  B(1.14, 0.9, 0.06, glass, 0, 1.15, -1.5);
  g.add(cyl(0.06 * s, 0.07 * s, 0.9 * s, blk, 0.28 * s, 1.95 * s, 1.35 * s, 6));
  return g;
}

/** 轮式拖拉机，车头 +Z */
function wheeled(s, body, big = false) {
  const g = new THREE.Group();
  const red = mat(body), blk = mat(0x1c1d1f), gry = mat(0x9aa3ab), dark = mat(0x2b2e33), glass = mat(C.glassBlue, { shiny: true });
  const B = (w, h, d, m, x, y, z) => g.add(box(w * s, h * s, d * s, m, x * s, y * s, z * s));
  const rr = big ? 0.95 : 0.8, fr = big ? 0.6 : 0.45;
  for (const sx of [-1, 1]) {
    g.add(wheelX(rr * s, 0.55 * s, blk, sx * 1.1 * s, rr * s, -0.9 * s, 16));
    g.add(wheelX(rr * 0.5 * s, 0.6 * s, gry, sx * 1.1 * s, rr * s, -0.9 * s, 10));
    g.add(wheelX(fr * s, 0.4 * s, blk, sx * 0.85 * s, fr * s, 1.4 * s, 12));
    g.add(wheelX(fr * 0.5 * s, 0.45 * s, gry, sx * 0.85 * s, fr * s, 1.4 * s, 8));
    B(0.6, 0.1, 1.5, red, sx * 1.1, rr * 2 + 0.05, -0.9);
  }
  B(0.9, 0.5, 3.4, dark, 0, 0.7, 0.2);
  B(1.0, 0.9, 1.9, red, 0, 1.0, 0.95);
  B(0.8, 0.55, 0.1, dark, 0, 1.15, 1.93);
  B(1.3, 0.1, 1.2, dark, 0, 1.45, -0.9);
  for (const sx of [-1, 1]) for (const z of [-0.35, -1.45]) B(0.08, 1.4, 0.08, red, sx * 0.6, 1.5, z);
  B(1.4, 0.1, 1.5, red, 0, 2.9, -0.9);
  B(1.1, 1.2, 0.05, glass, 0, 1.6, -1.45);
  for (const sx of [-1, 1]) B(0.05, 1.15, 1.0, glass, sx * 0.6, 1.65, -0.9);
  g.add(cyl(0.06 * s, 0.07 * s, 1.0 * s, blk, 0.35 * s, 1.9 * s, 1.5 * s, 6));
  return g;
}

export function build() {
  const g = new THREE.Group();
  const redPanel = mat(0xffffff, { key: 'rp', map: patternTex('tiles', 0xb3281f, 0x300000) });
  if (!redPanel.map) redPanel.color.setHex(0xb3281f);
  const BZ = -10; // 展馆中心 z；正面 z=18

  g.add(plaza(70, 22, mat(C.paving, { map: patternTex('paving', C.paving) }), 0, 29, 0.15, 4));
  g.add(plaza(14, 6, mat(C.pavingRed), 0, 21.5, 0.17));

  // 主体：红色金属板，前部略有层次
  g.add(box(50, 16, 56, redPanel, 0, 0, BZ));
  g.add(box(51, 0.8, 57, mat(0x7a1a14), 0, 16, BZ));                // 女儿墙
  g.add(box(34, 3.2, 20, mat(0x8f2018), 0, 16.8, BZ + 8));          // 屋顶上的错层体量
  for (let i = -10; i <= 10; i++) g.add(box(0.35, 15, 0.5, mat(0x7a1a14), i * 2.4, 0.5, 18.2)); // 竖向金属肋
  g.add(box(50.4, 1.0, 0.7, mat(0xe9e3d2), 0, 1.5, 18.3));          // 白色腰线（被入口隔断处由玻璃覆盖）
  // 大玻璃入口
  g.add(box(20, 12.5, 1.2, mat(C.glassBlue, { shiny: true, opacity: 0.85 }), 0, 0.1, 18.4));
  for (let i = -4; i <= 4; i++) g.add(box(0.2, 12.5, 0.4, mat(C.steel), i * 2.5, 0.1, 19.1));
  g.add(box(20, 0.25, 0.4, mat(C.steel), 0, 6.3, 19.1));
  g.add(box(24, 1.0, 7, mat(0x7a1a14), 0, 12.6, 21.6));            // 雨棚
  g.add(box(24.4, 0.3, 7.4, mat(C.concrete), 0, 13.6, 21.6));
  for (const sx of [-1, 1]) g.add(cyl(0.35, 0.35, 12.6, mat(C.steel), sx * 11, 0, 24.5, 8));
  g.add(sign('东方红农耕博物馆', 22, 2.6, { bg: '#e9e3d2', fg: '#b3281f', x: 0, y: 14.9, z: 18.35 }));
  for (let i = 0; i < 3; i++) g.add(box(18 - i * 0.8, 0.2, 1.4, mat(C.stone), 0, 0.15 + i * 0.2, 19.4 + (2 - i) * 0 + i * 1.4));

  // 展台 + 三台拖拉机
  const pads = [[-20, 0xc8201a, 'c'], [0, 0xc8201a, 'w'], [20, 0x2f7a3a, 'g']];
  for (const [x, col, k] of pads) {
    g.add(box(14, 0.7, 9, mat(C.marble), x, 0.15, 30));
    g.add(box(14.4, 0.2, 9.4, mat(C.stoneDark), x, 0.85, 30));
  }
  const t1 = crawler(1.6, 0xc8201a); t1.position.set(-20, 1.05, 30); t1.rotation.y = 0.35; g.add(t1);
  const t2 = wheeled(1.5, 0xc8201a); t2.position.set(0, 1.05, 30); t2.rotation.y = -0.3; g.add(t2);
  const t3 = wheeled(1.55, 0x2f7a3a, true); t3.position.set(20, 1.05, 30); t3.rotation.y = 0.25; g.add(t3);
  // 现代大型轮式的黄色标识条
  g.add(box(2, 0.12, 0.12, mat(0xe9c43a), 20, 3.1, 33.8));

  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) g.add(tree(sx * 31, 32 - i * 12, 7, i % 2 ? 'round' : 'plane'));
  for (let i = 0; i < 5; i++) g.add(tree(-24 + i * 12, -42, 8, 'pine'));
  return finalize(g);
}
