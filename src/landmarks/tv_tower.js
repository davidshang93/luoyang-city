// 洛阳广播电视塔
import { THREE, C, mat, box, cyl, disc, sign, tree, patternTex, finalize } from './_kit.js';

export const meta = { colliders: [{ x: 0, z: 0, w: 46, d: 46 }] };

export function build() {
  const g = new THREE.Group();
  const conc = mat(0xc9c8c2), concD = mat(C.concreteDark);
  const glass = mat(0x9fd0f0, { emissive: 0x335577, shiny: true });
  const red = mat(0xd02a22), white = mat(0xf4f4f0);

  g.add(disc(38, mat(C.paving, { map: patternTex('paving', C.paving) }), 0, 0, 0.15, 32));
  g.add(disc(28, mat(C.grass), 0, 0, 0.2, 32));
  // 三层圆形裙楼
  g.add(cyl(26, 26, 4, conc, 0, 0, 0, 32));
  g.add(cyl(26.3, 26.3, 1.6, glass, 0, 1.2, 0, 32));
  g.add(cyl(22, 22.5, 4, conc, 0, 4, 0, 32));
  g.add(cyl(22.4, 22.4, 1.6, glass, 0, 5.2, 0, 32));
  g.add(cyl(17, 17.5, 4, conc, 0, 8, 0, 32));
  g.add(cyl(17.4, 17.4, 1.4, glass, 0, 9.2, 0, 32));
  g.add(cyl(18, 18, 0.6, concD, 0, 12, 0, 32));
  // 塔身
  g.add(cyl(4.4, 6.2, 124, conc, 0, 12.6, 0, 20));
  for (let y = 30; y < 130; y += 20) g.add(cyl(4.7, 4.7, 0.8, concD, 0, y, 0, 20));
  // 塔楼（飞碟）
  const y0 = 138;
  g.add(cyl(14, 5, 6, conc, 0, y0, 0, 28));
  g.add(cyl(14.8, 14.8, 5, glass, 0, y0 + 6, 0, 28));
  g.add(cyl(15.2, 15.2, 1, concD, 0, y0 + 11, 0, 28));
  g.add(cyl(14.6, 14.6, 4, glass, 0, y0 + 12, 0, 28));
  g.add(cyl(15.5, 14.6, 1.2, concD, 0, y0 + 16, 0, 28));
  g.add(cyl(4, 14.5, 3.2, conc, 0, y0 + 17.2, 0, 28));
  // 塔楼之上塔身 + 天线平台
  g.add(cyl(3.2, 4, 26, conc, 0, y0 + 20.4, 0, 16));
  g.add(cyl(7, 3.6, 2.4, concD, 0, y0 + 30, 0, 16));
  g.add(cyl(7.5, 7.5, 0.5, mat(C.steel), 0, y0 + 32.4, 0, 16));
  g.add(cyl(3.2, 3.2, 14, conc, 0, y0 + 33, 0, 12));
  g.add(cyl(5.5, 2.8, 1.6, concD, 0, y0 + 40, 0, 12));
  // 红白桅杆
  let y = y0 + 47, r = 1.6;
  for (let i = 0; i < 8; i++) { const h = 9, r2 = r * 0.82; g.add(cyl(r2, r, h, i % 2 ? white : red, 0, y, 0, 8)); y += h; r = r2; }
  g.add(cyl(0.05, 0.28, 12, white, 0, y, 0, 6));
  // 栏杆与树、小灯
  for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; g.add(tree(Math.cos(a) * 33, Math.sin(a) * 33, 9, i % 3 ? 'round' : 'pine')); }
  g.add(sign('洛阳广播电视塔', 18, 2.4, { bg: '#1d2a3a', fg: '#ffe9a0', x: 0, y: 2.6, z: 26.5 }));
  return finalize(g);
}
