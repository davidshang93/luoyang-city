// 开元湖音乐喷泉：喷泉 + 南北岸亲水平台 + 亭子 + 柳树。bearing 180 → +Z 南、-Z 北
import { THREE, C, mat, box, cyl, plaza, tangRoof, tree, lamp, patternTex, finalize } from './_kit.js';

export const meta = { colliders: [{ x: -62, z: -134, w: 7, d: 7 }, { x: 62, z: -134, w: 7, d: 7 }, { x: -62, z: 134, w: 7, d: 7 }, { x: 62, z: 134, w: 7, d: 7 }] };

function pavilion(g, x, z) {
  g.add(box(8, 0.5, 8, mat(C.stone), x, 0.4, z));
  for (const dx of [-3, 3]) for (const dz of [-3, 3]) g.add(cyl(0.25, 0.28, 4.2, mat(C.tangRed), x + dx, 0.9, z + dz, 8));
  g.add(box(7, 0.5, 7, mat(C.darkWood), x, 5.1, z));
  g.add(tangRoof({ w: 10, d: 10, h: 3.6, ridge: 0, x, y: 5.4, z, material: mat(C.tileGreen, { map: patternTex('roofTile', C.tileGreen) }) }));
}

export function build() {
  const g = new THREE.Group();
  const stoneM = mat(C.paving, { map: patternTex('paving', C.paving) });
  const jet = mat(0xffffff, { opacity: 0.55, key: 'jet' });

  // 湖中喷泉平台
  g.add(box(110, 1, 34, mat(C.concreteDark), 0, 0, 0));
  g.add(box(106, 0.3, 30, mat(0x2d3f52), 0, 1, 0));
  for (let i = 0; i < 21; i++) g.add(cyl(1, 1.3, 0.8, mat(C.steel), -50 + i * 5, 1.3, 0, 10));
  for (let i = 0; i < 6; i++) { g.add(cyl(1, 1.3, 0.8, mat(C.steel), -25 + i * 10, 1.3, -10, 10)); g.add(cyl(1, 1.3, 0.8, mat(C.steel), -25 + i * 10, 1.3, 10, 10)); }
  g.add(cyl(3.2, 3.8, 1.6, mat(C.steel), 0, 1.3, 0, 16));

  // 水柱（可动画）
  const jets = new THREE.Group(); jets.userData.keep = true; jets.name = 'jets';
  const add = (x, z, h, r) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.25, r, h, 8, 1, true), jet); m.position.set(x, 2.6 + h / 2, z); jets.add(m); };
  add(0, 0, 60, 1.4);
  for (const s of [-1, 1]) { add(s * 6, 0, 38, 0.9); add(s * 12, 0, 28, 0.8); }
  for (let i = 0; i < 21; i++) { const x = -50 + i * 5; add(x, 0, 10 + 8 * Math.abs(Math.sin(i * 0.9)) + (10 - Math.abs(i - 10)) * 0.8, 0.5); }
  for (let i = 0; i < 6; i++) { add(-25 + i * 10, -10, 14 + (i % 2) * 8, 0.45); add(-25 + i * 10, 10, 14 + ((i + 1) % 2) * 8, 0.45); }
  g.add(jets);

  // 南北岸亲水平台
  for (const s of [-1, 1]) {
    const zc = s * 135;
    g.add(plaza(100, 20, stoneM, 0, zc, 0.3, 4));
    g.add(box(100, 0.3, 20, mat(C.stone), 0, 0, zc));
    for (let i = 0; i < 3; i++) g.add(box(100 - i * 2, 0.15 + 0.1 * (2 - i), 4, mat(C.stoneDark), 0, 0, s * (122.5 - i * 4)));
    for (let x = -50; x <= 50; x += 5) g.add(box(0.15, 1, 0.15, mat(C.steel), x, 0.3, s * 126)); // 栏杆柱
    g.add(box(100, 0.12, 0.15, mat(C.steel), 0, 1.2, s * 126));
    for (let x = -50; x <= 50; x += 25) g.add(lamp(x, s * 126, 5));
    pavilion(g, -62, s * 134); pavilion(g, 62, s * 134);
    for (let i = 0; i < 12; i++) g.add(tree(-100 + i * 18 + (s > 0 ? 6 : 0), s * 144, 9, 'willow'));
  }
  return finalize(g);
}
