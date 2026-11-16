// 牡丹广场：中央巨型牡丹雕塑（8m 基座柱 + 12m 花朵，直径约 14m）+ 圆形喷泉 + 放射状铺装 + 牡丹花坛 + 法桐
import { THREE, C, mat, box, cyl, sphere, disc, plaza, sign, tree, lamp, patternTex, finalize } from './_kit.js';

export const meta = {
  colliders: [{ x: 0, z: 0, w: 7, d: 7 }],   // 仅雕塑基座柱；水池可涉足，不设碰撞
};

// 单片花瓣：椭球，绕 Y 转 a、向外倾 tilt，底部在半径 rad
function petal(g, a, rad, y, w, h, l, tilt, material) {
  const piv = new THREE.Group(); piv.position.set(0, y, 0); piv.rotation.y = a;
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), material);
  m.scale.set(w, h, l);
  m.position.set(0, h * Math.cos(tilt), rad + h * Math.sin(tilt));
  m.rotation.x = tilt;
  piv.add(m); g.add(piv);
}

export function build() {
  const g = new THREE.Group();
  const pave = mat(C.paving, { map: patternTex('paving', C.paving) });
  const red = mat(C.pavingRed, { map: patternTex('paving', C.pavingRed) });
  const steel = mat(0xd8dde2, { shiny: true });
  // 广场铺装：放射状
  g.add(disc(48, pave, 0, 0, 0.15, 48));
  for (let i = 0; i < 8; i++) {
    const s = plaza(8, 90, red, 0, 0, 0.2); s.rotation.y = i * Math.PI / 8; g.add(s);
  }
  g.add(plaza(196, 12, pave, 0, 62, 0.15, 5));
  g.add(plaza(196, 12, pave, 0, -62, 0.15, 5));
  // 圆形喷泉水池 r=20
  g.add(cyl(20.8, 21, 1.1, mat(C.stone), 0, 0, 0, 40));
  g.add(disc(20, mat(C.water, { shiny: true }), 0, 0, 1.15, 40));
  g.add(disc(8, mat(C.stoneDark), 0, 0, 1.2, 24));
  // 池中喷泉柱
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.add(cyl(0.1, 0.3, 2.6, mat(0xdff1ff, { opacity: 0.7 }), Math.cos(a) * 14, 1.2, Math.sin(a) * 14, 5)); }
  // 基座柱 8m
  g.add(cyl(3.6, 4, 1.2, mat(C.stoneDark), 0, 1, 0, 16));
  g.add(cyl(2.2, 2.8, 7, mat(C.stone, { map: patternTex('stone', C.stone) }), 0, 2.2, 0, 16));
  g.add(cyl(3.2, 2.4, 0.9, mat(C.stoneDark), 0, 8.2, 0, 16));
  // ---- 牡丹花雕塑：底 9.1 → 顶 ~20 ----
  const f = new THREE.Group(); f.position.y = 9.1; g.add(f);
  const pink = mat(C.peonyPink, { shiny: true }), pink2 = mat(0xf2a0c0, { shiny: true }), pale = mat(0xfbd5e3, { shiny: true });
  // 托叶（绿）
  for (let i = 0; i < 6; i++) petal(f, i / 6 * Math.PI * 2, 1.2, 0.2, 1.3, 0.35, 3.2, 1.35, mat(C.leaf));
  const layers = [
    { n: 9, rad: 2.2, y: 0.6, w: 1.5, h: 2.6, l: 0.55, tilt: 1.05, m: pink },
    { n: 8, rad: 1.9, y: 1.5, w: 1.4, h: 2.8, l: 0.5, tilt: 0.8, m: pink2 },
    { n: 7, rad: 1.5, y: 2.5, w: 1.25, h: 2.7, l: 0.5, tilt: 0.58, m: pink },
    { n: 6, rad: 1.15, y: 3.6, w: 1.05, h: 2.5, l: 0.45, tilt: 0.4, m: pink2 },
    { n: 5, rad: 0.8, y: 4.8, w: 0.9, h: 2.3, l: 0.4, tilt: 0.26, m: pale },
    { n: 4, rad: 0.45, y: 6.2, w: 0.7, h: 1.9, l: 0.35, tilt: 0.15, m: pale },
  ];
  layers.forEach((L, li) => { for (let i = 0; i < L.n; i++) petal(f, i / L.n * Math.PI * 2 + li * 0.35, L.rad, L.y, L.w, L.h, L.l, L.tilt, L.m); });
  f.add(cyl(0.5, 1.2, 1.2, mat(C.leaf), 0, -0.1, 0, 8));
  f.add(sphere(0.9, mat(C.tileYellow), 0, 8.2, 0, 8));
  // 花坛：圆环形牡丹花带 + 四角花坛
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 + 0.2; g.add(tree(Math.cos(a) * 27, Math.sin(a) * 27, 2.4, 'peonyBush', 0.17)); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const cx = sx * 55, cz = sz * 30;
    g.add(plaza(20, 16, mat(0x5a7a3a), cx, cz, 0.17));
    g.add(box(21, 0.5, 0.6, mat(C.stone), cx, 0, cz + 8)); g.add(box(21, 0.5, 0.6, mat(C.stone), cx, 0, cz - 8));
    g.add(box(0.6, 0.5, 16, mat(C.stone), cx - 10, 0, cz)); g.add(box(0.6, 0.5, 16, mat(C.stone), cx + 10, 0, cz));
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) g.add(tree(cx - 7.5 + i * 5, cz - 5 + j * 5, 2.2, 'peonyBush', 0.17));
  }
  // 草坪
  g.add(plaza(40, 40, mat(C.grass), -85, 0, 0.16)); g.add(plaza(40, 40, mat(C.grass), 85, 0, 0.16));
  // 灯柱环 + 成排法桐
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + 0.26; g.add(lamp(Math.cos(a) * 24.5, Math.sin(a) * 24.5, 6)); }
  for (let x = -94; x <= 94; x += 12) { g.add(tree(x, 72, 9, 'plane')); g.add(tree(x, -72, 9, 'plane')); }
  for (let z = -60; z <= 60; z += 12) { g.add(tree(-95, z, 9, 'plane')); g.add(tree(95, z, 9, 'plane')); }
  g.add(sign('牡丹广场', 3.6, 1, { bg: '#7a1f3a', fg: '#fbe9ef', x: 0, y: 5, z: 2.75 }));
  return finalize(g);
}
