// 洛阳规划展示馆：镂空花格表皮方形体量，四角内收，正面通高玻璃门厅
import { THREE, C, mat, box, cyl, plaza, tiledBox, sign, tree, lamp, flag, patternTex, finalize } from './_kit.js';

export const meta = {
  colliders: [
    { x: 0, z: -5, w: 90, d: 62 },
    { x: 0, z: -5, w: 62, d: 90 },
  ],
};

export function build() {
  const g = new THREE.Group();
  const lat = mat(0xffffff, { map: patternTex('lattice', 0xc8b894, 0x5a4a2a), key: 'planlat' });
  if (!lat.map) lat.color.setHex(0xc8b894);
  const dark = mat(0x3a3a3c);
  const glass = mat(0x4f86aa, { shiny: true });
  g.add(plaza(100, 36, mat(C.paving, { map: patternTex('paving', C.paving) }), 0, 42, 0.15, 5));
  // 基座
  g.add(box(92, 1.2, 62, mat(C.stoneDark), 0, 0, -5));
  g.add(box(62, 1.2, 92, mat(C.stoneDark), 0, 0, -5));
  // 十字形体量，四角内收（各 14m）
  const top = 24;
  g.add(tiledBox(90, top, 62, lat, 4, 4, 0, 1.2, -5));
  g.add(tiledBox(62, top, 90, lat, 4, 4, 0, 1.2, -5));
  // 顶部檐口
  g.add(box(91, 1.2, 63, mat(C.stoneDark), 0, 25.2, -5));
  g.add(box(63, 1.2, 91, mat(C.stoneDark), 0, 25.2, -5));
  // 正面（+Z）通高玻璃门厅
  g.add(box(32, 25, 5, glass, 0, 1.2, 43));
  for (let k = -4; k <= 4; k++) g.add(box(0.4, 25, 0.6, mat(C.steel), k * 4, 1.2, 45.6));
  for (let k = 1; k <= 3; k++) g.add(box(32, 0.4, 0.6, mat(C.steel), 0, 1.2 + k * 6, 45.6));
  g.add(box(38, 1.4, 8, mat(C.stoneDark), 0, 26, 43));
  for (const x of [-18, 18]) g.add(box(2.2, 26, 2.2, mat(C.stoneDark), x, 0, 46));
  g.add(sign('洛阳规划展示馆', 34, 4, { bg: '#2a2a2e', fg: '#e8d9a8', x: 0, y: 28.2, z: 47.1 }));
  for (let i = 0; i < 6; i++) g.add(box(30 - i * 0.6, 0.18 * (6 - i), 1.6, mat(C.stone), 0, 0, 47.5 + i * 1.6));
  for (let i = -4; i <= 4; i++) { g.add(tree(i * 11, 56, 7, 'round')); }
  for (let i = -3; i <= 3; i++) g.add(lamp(i * 14, 50, 6));
  for (const x of [-28, 28]) g.add(flag(x, 52, 14));
  return finalize(g);
}
