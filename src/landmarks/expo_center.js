// 洛阳会展中心：三跨银白拱形波浪屋面 + 北向玻璃幕墙 + 旗杆阵
import { THREE, C, mat, box, cyl, plaza, tower, sign, tree, flag, lamp, patternTex, finalize } from './_kit.js';

export const meta = {
  colliders: [{ x: 0, z: -29, w: 322, d: 100 }],
};

// 拱形屋面：横截面半椭圆（跨度 span、拱高 h），沿 Z 拉伸 len
function arch(span, h, len, material, x, y, z) {
  const g = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true, Math.PI / 2, Math.PI);
  g.rotateX(Math.PI / 2); g.scale(span / 2, h, len);
  const m = new THREE.Mesh(g, material); m.position.set(x, y, z); return m;
}

export function build() {
  const g = new THREE.Group();
  const silver = mat(0xd5dade, { shiny: true, double: true });
  const wall = mat(0xc9ced2);
  const glass = mat(0x4f7f9f, { shiny: true });
  const L = 100, zc = -29; // 展馆 z ∈ [-79, 21]
  // 前广场铺装
  g.add(plaza(300, 56, mat(C.paving, { map: patternTex('paving', C.paving) }), 0, 50, 0.15, 5));
  g.add(plaza(30, 10, mat(C.pavingRed), 0, 30, 0.2));
  // 基座墙体
  g.add(box(320, 12, L, wall, 0, 0, zc));
  // 三跨拱形屋面
  const span = 320 / 3;
  for (let i = 0; i < 3; i++) {
    const cx = -span + i * span;
    g.add(arch(span, 13, L + 2, silver, cx, 12, zc));
    // 拱间檐沟
    g.add(box(1.2, 1.2, L + 2, mat(C.steel), cx + span / 2, 12, zc));
    // 拱上肋条
    for (let k = -2; k <= 2; k++) g.add(box(span * 0.8, 0.3, 0.5, mat(C.white), cx, 12 + 11.5, zc + k * 20));
  }
  g.add(box(1.2, 1.2, L + 2, mat(C.steel), -160, 12, zc));
  // 北向玻璃幕墙（正面 +Z）：三段，每跨一整面拱形玻璃山墙
  for (let i = 0; i < 3; i++) {
    const cx = -span + i * span;
    g.add(box(span - 3, 12.2, 0.8, glass, cx, 0, 21.2));
    const arc = arch(span, 13, 0.8, glass, cx, 12, 21.2); g.add(arc);
    for (let k = -4; k <= 4; k++) g.add(box(0.35, 12.2, 0.4, mat(C.steel), cx + k * 11, 0, 21.8));
  }
  // 入口雨棚
  g.add(box(70, 0.8, 16, mat(C.white), 0, 9, 29));
  for (const px of [-30, -10, 10, 30]) g.add(cyl(0.6, 0.6, 9, mat(C.steel), px, 0, 35, 10));
  g.add(sign('洛阳会展中心', 44, 5.5, { bg: '#16365a', fg: '#ffffff', x: 0, y: 17.5, z: 21.9 }));
  // 旗杆阵
  for (let i = -10; i <= 10; i++) { if (Math.abs(i) < 5) continue; g.add(flag(i * 12, 52, 16, i % 2 ? 0xd4281c : 0x2c4f8a)); }
  for (let i = -6; i <= 6; i++) g.add(lamp(i * 22, 70, 7));
  for (let i = -7; i <= 7; i++) { g.add(tree(i * 21, 66, 7, 'plane')); }
  // 后部设备平台
  g.add(box(40, 3, 14, mat(C.concreteDark), 100, 25, zc - 15));
  return finalize(g);
}
