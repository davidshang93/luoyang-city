// 洛阳市政府（洛龙区行政中心）正面朝 +Z
import { THREE, C, mat, box, cyl, plaza, disc, tower, sign, tree, flag, patternTex, finalize } from './_kit.js';

export const meta = {
  colliders: [
    { x: 0, z: 0, w: 120, d: 50 },
    { x: -80, z: 0, w: 40, d: 50 }, { x: 80, z: 0, w: 40, d: 50 },
    { x: -105, z: 50, w: 30, d: 50 }, { x: 105, z: 50, w: 30, d: 50 },
    { x: -65, z: -90, w: 50, d: 40 }, { x: 65, z: -90, w: 50, d: 40 },
  ],
};

export function build() {
  const g = new THREE.Group();
  const wall = 0xd8d0bc, glass = 0x4a6a85;
  const stone = mat(0xd8d0bc), grey = mat(C.concreteDark);

  // 前广场 + 草坪
  g.add(plaza(260, 100, mat(C.paving, { map: patternTex('paving', C.paving) }), 0, 100, 0.15, 5));
  g.add(plaza(80, 40, mat(C.grass), -75, 112, 0.2));
  g.add(plaza(80, 40, mat(C.grass), 75, 112, 0.2));
  g.add(plaza(70, 24, mat(C.grass), 0, 138, 0.2));
  g.add(plaza(60, 80, mat(C.pavingRed, { map: patternTex('paving', C.pavingRed) }), 0, 100, 0.22, 5));

  // 主楼 + 两翼 + 前伸臂
  g.add(tower(120, 55, 50, { style: 'office', wall, glass, bay: 6, floor: 4.6, shiny: false }));
  g.add(tower(40, 30, 50, { style: 'office', wall, glass, bay: 5, floor: 4.3, x: -80 }));
  g.add(tower(40, 30, 50, { style: 'office', wall, glass, bay: 5, floor: 4.3, x: 80 }));
  g.add(tower(30, 26, 50, { style: 'office', wall, glass, bay: 5, floor: 4.3, x: -105, z: 50 }));
  g.add(tower(30, 26, 50, { style: 'office', wall, glass, bay: 5, floor: 4.3, x: 105, z: 50 }));
  g.add(tower(50, 32, 40, { style: 'office', wall, glass, bay: 5, floor: 4.5, x: -65, z: -90 }));
  g.add(tower(50, 32, 40, { style: 'office', wall, glass, bay: 5, floor: 4.5, x: 65, z: -90 }));
  g.add(box(124, 1.2, 54, grey, 0, 55, 0));
  g.add(box(40, 6, 20, stone, 0, 56.2, 0)); // 屋顶机房
  // 主楼竖向石柱
  for (let i = -9; i <= 9; i++) g.add(box(1.4, 55, 1.4, stone, i * 6, 0, 25.6));
  // 门廊
  g.add(box(44, 1, 14, stone, 0, 0, 33)); // 基台
  g.add(box(46, 2.2, 16, stone, 0, 20, 33));
  for (let i = 0; i < 6; i++) g.add(cyl(1.1, 1.1, 20, mat(C.marble), -18 + i * 7.2, 1, 39.5, 10));
  for (let i = 0; i < 5; i++) g.add(box(46 - i * 4, 0.35 * (5 - i), 3, stone, 0, 0, 43 + i * 1.5));
  g.add(box(30, 14, 0.5, mat(C.glassDark, { shiny: true }), 0, 1, 25.3));
  // 国徽（红色圆徽）
  const em = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.5, 24), mat(0xc8201c)); em.rotation.x = Math.PI / 2; em.position.set(0, 38, 25.7); g.add(em);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 4.8, 0.4, 24), mat(C.gold)); ring.rotation.x = Math.PI / 2; ring.position.set(0, 38, 25.5); g.add(ring);
  g.add(sign('洛阳市人民政府', 22, 2.6, { bg: '#8f1d18', fg: '#f3d98a', x: 0, y: 24, z: 41.6 }));

  // 旗杆 + 喷泉
  for (let i = -3; i <= 3; i++) g.add(flag(i * 9, 82, 16));
  g.add(disc(12, mat(C.stone), 0, 120, 0.3, 28));
  g.add(disc(10, mat(C.water, { opacity: 0.85 }), 0, 120, 0.5, 28));
  g.add(cyl(0.3, 0.9, 7, mat(0xffffff, { opacity: 0.6 }), 0, 0.5, 120, 8).translateZ(0));
  // 树
  for (let i = -6; i <= 6; i++) { g.add(tree(i * 20, 146, 9, 'plane')); }
  for (let z = 70; z <= 130; z += 20) { g.add(tree(-122, z, 8, 'round')); g.add(tree(122, z, 8, 'round')); }
  for (let x = -90; x <= 90; x += 20) g.add(tree(x, -60, 8, 'round'));
  return finalize(g);
}
