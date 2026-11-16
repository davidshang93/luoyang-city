// 洛阳古墓博物馆：子母阙 + 门屋 + 汉式殿堂院落 + 北魏景陵大封土 + 松柏
import { THREE, C, mat, box, cyl, sphere, plaza, hall, tangRoof, sign, tree, lamp, patternTex, rng, finalize } from './_kit.js';

export const meta = {
  colliders: [
    { x: -17, z: 128, w: 7, d: 7 }, { x: 17, z: 128, w: 7, d: 7 },   // 阙（门道留空）
    { x: -22, z: 128, w: 6, d: 6 }, { x: 22, z: 128, w: 6, d: 6 },
    { x: -26, z: 118, w: 30, d: 4 }, { x: 26, z: 118, w: 30, d: 4 },  // 门屋两翼墙
    { x: 0, z: 40, w: 50, d: 28 },                                      // 主殿
    { x: -55, z: 60, w: 28, d: 18 }, { x: 55, z: 60, w: 28, d: 18 },    // 东西配殿
    { x: 0, z: -90, w: 70, d: 70 },                                     // 封土
  ],
};

const grey = () => mat(C.tileGrey, { map: patternTex('roofTile', C.tileGrey) });

// 子母阙：主阙 + 小阙
function que(g, x, z, dir) {
  const stone = mat(0xcfcbc0, { map: patternTex('stone', 0xcfcbc0) });
  g.add(box(6.2, 1.2, 6.2, mat(C.stoneDark), x, 0, z));
  g.add(box(4.8, 9.2, 4.8, stone, x, 1.2, z));
  g.add(box(6, 0.8, 6, mat(C.stoneDark), x, 10.4, z));
  g.add(tangRoof({ w: 8.6, d: 8.6, h: 3.2, ridge: 3, material: grey(), x, y: 11.2, z }));
  const cx = x + dir * 4.8;
  g.add(box(4.4, 0.8, 4.4, mat(C.stoneDark), cx, 0, z));
  g.add(box(3.2, 6.2, 3.2, stone, cx, 0.8, z));
  g.add(box(4.2, 0.6, 4.2, mat(C.stoneDark), cx, 7, z));
  g.add(tangRoof({ w: 6, d: 6, h: 2.2, ridge: 2, material: grey(), x: cx, y: 7.6, z }));
  // 浮雕条
  for (let k = 0; k < 3; k++) g.add(box(5, 0.35, 5, mat(C.stoneDark), x, 3 + k * 2.6, z));
}

export function build() {
  const g = new THREE.Group();
  const whiteWall = mat(C.wallWhite);
  const r = rng(7);
  // 入口神道与院落铺装
  g.add(plaza(30, 170, mat(C.paving, { map: patternTex('paving', C.paving) }), 0, 70, 0.15, 5));
  g.add(plaza(150, 80, mat(C.paving, { map: patternTex('paving', C.paving) }), 0, 50, 0.17, 5));
  g.add(plaza(40, 60, mat(C.stoneDark, { map: patternTex('stone', C.stoneDark) }), 0, -35, 0.2, 4));
  // 阙
  que(g, -20, 128, 1); que(g, 20, 128, -1);
  // 门屋：中间过道留空，只做门楣横梁和两翼
  g.add(box(36, 1.4, 6, mat(C.darkWood), 0, 7.3, 118));
  g.add(tangRoof({ w: 44, d: 12, h: 4.4, ridge: 34, material: grey(), y: 8.7, z: 118 }));
  for (const sx of [-1, 1]) { g.add(box(14, 7.3, 6, whiteWall, sx * 13, 0, 118)); g.add(cyl(0.4, 0.45, 7.3, mat(C.tangRed), sx * 5.5, 0, 121.4, 8)); }
  g.add(sign('洛阳古墓博物馆', 22, 2.6, { bg: '#2a2a2c', fg: '#e8d9a8', x: 0, y: 7.4, z: 121.2 }));
  // 院墙
  g.add(box(88, 3.2, 1, whiteWall, -70, 0, 118)); g.add(box(88, 3.2, 1, whiteWall, 70, 0, 118));
  for (const sx of [-1, 1]) g.add(box(1, 3.2, 130, whiteWall, sx * 114, 0, 52));
  g.add(box(228, 3.2, 1, whiteWall, 0, 0, -12));
  // 主殿（庑殿顶、灰瓦、白墙朱柱）
  g.add(hall({ w: 40, d: 18, wallH: 7, roofH: 6, tiers: 1, wall: C.wallWhite, roof: C.tileGrey, platformH: 1.8, z: 40 }));
  // 东西配殿（面朝院中）
  g.add(hall({ w: 22, d: 12, wallH: 5.5, roofH: 4.5, wall: C.wallWhite, platformH: 1.2, x: -55, z: 60, ry: Math.PI / 2 }));
  g.add(hall({ w: 22, d: 12, wallH: 5.5, roofH: 4.5, wall: C.wallWhite, platformH: 1.2, x: 55, z: 60, ry: -Math.PI / 2 }));
  // 后殿
  g.add(hall({ w: 30, d: 14, wallH: 6, roofH: 5, wall: C.wallWhite, platformH: 1.4, z: 5 }));
  g.add(sign('古代艺术博物馆', 18, 2.2, { bg: '#7a2a1f', fg: '#f0d890', x: 0, y: 9.5, z: 19 }));
  // 景陵封土：圆形覆草土丘 直径 100，高 20
  const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x7a8f4a)); mound.scale.set(50, 20, 50); mound.position.set(0, 0, -90); g.add(mound);
  g.add(cyl(52, 52, 0.4, mat(C.earth), 0, 0, -90, 32));
  // 墓前石阶、石兽
  for (let i = 0; i < 4; i++) g.add(box(10 - i, 0.3 * (i + 1), 1.4, mat(C.stone), 0, 0, -36 - (3 - i) * 0 - i * 1.4 + 0));
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { g.add(box(2.6, 1.8, 1.4, mat(C.stoneDark), sx * 6, 0.2, -30 + k * 6)); g.add(box(1, 1.4, 1, mat(C.stoneDark), sx * 6, 2, -29.6 + k * 6)); }
  // 神道两侧松柏
  for (let z = 105; z > 20; z -= 10) for (const sx of [-1, 1]) g.add(tree(sx * 11, z, 9, 'pine'));
  // 院内及外围松柏
  for (let i = 0; i < 70; i++) {
    const x = (r() - 0.5) * 270, z = -140 + r() * 255;
    if (Math.abs(x) < 16 && z > 15) continue;
    if (Math.hypot(x, z + 90) < 56) continue;
    if (Math.abs(x) < 80 && z > 10 && z < 118) continue;
    g.add(tree(x, z, 8 + r() * 3, r() < 0.7 ? 'pine' : 'round'));
  }
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; g.add(tree(Math.cos(a) * 58, -90 + Math.sin(a) * 58, 8, 'pine')); }
  for (const sx of [-1, 1]) for (let z = 30; z <= 110; z += 20) g.add(lamp(sx * 9, z, 6));
  return finalize(g);
}
