// 洛阳科技馆：球形穹幕影院 + 斜切玻璃金属主楼
import { THREE, C, mat, box, cyl, sphere, plaza, tower, sign, tree, lamp, patternTex, finalize } from './_kit.js';

export const meta = {
  colliders: [
    { x: 22, z: -8, w: 62, d: 34 },
    { x: -34, z: -22, w: 22, d: 22 },
  ],
};

function tilted(w, h, d, material, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = box(w, h, d, material, 0, 0, 0); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); return m;
}

export function build() {
  const g = new THREE.Group();
  const silver = mat(0xdfe4e8, { shiny: true });
  const glass = mat(0x5f93b8, { shiny: true });
  const panel = mat(0xc4cacf);
  // 前广场与大台阶
  g.add(plaza(110, 50, mat(C.paving, { map: patternTex('paving', C.paving) }), 0, 30, 0.15, 5));
  for (let i = 0; i < 6; i++) g.add(box(34 - i * 1.5, 0.35 * (i + 1), 2.2, mat(C.stone), 22, 0, 15 + (5 - i) * 2.2));
  // 主楼：4 层，两段体块，前部玻璃斜切
  g.add(tower(62, 24, 34, { style: 'grid', wall: 0xcfd4d8, glass: C.glassBlue, bay: 5, floor: 6, x: 22, z: -8 }));
  // 前立面斜切玻璃幕：从顶部向前下倾
  g.add(tilted(40, 26, 0.6, glass, 22, 13, 12, -0.32));
  g.add(tilted(40, 0.5, 6, silver, 22, 25.5, 7, -0.32));
  for (let k = -3; k <= 3; k++) g.add(tilted(0.35, 26, 0.5, mat(C.steel), 22 + k * 6, 13, 12.2, -0.32));
  // 斜屋面板
  g.add(tilted(62, 0.8, 18, panel, 22, 24.4, -8 + 8, 0.12));
  g.add(box(62, 1, 34, silver, 22, 24, -8));
  g.add(sign('洛阳科技馆', 30, 4, { bg: '#1c3b5a', fg: '#ffffff', x: 22, y: 21, z: 9.5 }));
  // 球形穹幕影院
  g.add(cyl(14, 15, 5, mat(C.concreteDark), -34, 0, -22, 24));
  const s = sphere(15, silver, -34, 20, -22, 32); g.add(s);
  for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(15.05 * Math.cos((i - 1) * 0.45), 0.2, 4, 32), mat(C.steel)); r.rotation.x = Math.PI / 2; r.position.set(-34, 20 + Math.sin((i - 1) * 0.45) * 15.05, -22); g.add(r); }
  // 连廊
  g.add(box(18, 5, 8, glass, -16, 5, -14));
  // 绿化
  for (let i = -5; i <= 5; i++) g.add(tree(i * 10, 52, 8, 'plane'));
  for (let i = -4; i <= 4; i++) g.add(lamp(i * 12, 44, 6));
  for (const x of [-52, 52]) for (let z = -40; z <= 20; z += 15) g.add(tree(x, z, 8, 'round'));
  return finalize(g);
}
