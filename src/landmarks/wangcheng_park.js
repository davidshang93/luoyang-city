// 王城公园：牌楼南门、牡丹花圃、牡丹阁、周公/河图洛书雕塑台、北湖拱桥、西北摩天轮
import { THREE, C, mat, box, cyl, sphere, disc, plaza, hall, tangRoof, sign, tree, lamp, patternTex, rng, finalize } from './_kit.js';

export const meta = {
  colliders: [
    { x: -45, z: 168, w: 2, d: 2 }, { x: -15, z: 168, w: 2, d: 2 }, { x: 15, z: 168, w: 2, d: 2 }, { x: 45, z: 168, w: 2, d: 2 }, // 牌楼四柱（门洞留空）
    { x: 0, z: -10, w: 34, d: 26 },          // 牡丹阁
    { x: 0, z: 50, w: 9, d: 9 },              // 雕塑台
    { x: -150, z: -125, w: 6, d: 10 }, { x: -110, z: -125, w: 6, d: 10 }, // 摩天轮支座
  ],
};

const green = () => mat(C.tileGreen, { map: patternTex('roofTile', C.tileGreen) });
const paveM = () => mat(C.paving, { map: patternTex('paving', C.paving) });

function ring(r, tube, material, x, y, z, rotY = 0) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 36), material);
  m.position.set(x, y, z); m.rotation.y = rotY; return m;
}
function strut(a, b, thick, material) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const m = new THREE.Mesh(new THREE.BoxGeometry(thick, len, thick), material);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

export function build() {
  const g = new THREE.Group();
  const r = rng(11);
  const red = mat(C.tangRed), gold = mat(C.tileYellow);
  // ---- 南牌楼大门（z=168）----
  const gz = 168;
  g.add(plaza(110, 40, paveM(), 0, 150, 0.15, 5));
  for (const x of [-45, -15, 15, 45]) { g.add(box(3, 1.2, 3, mat(C.stone), x, 0, gz)); g.add(cyl(0.7, 0.8, 9.5, red, x, 1.2, gz, 10)); }
  for (const [x, w, h] of [[0, 28, 3.6], [-30, 28, 3.0], [30, 28, 3.0]]) {
    g.add(box(w, 1.2, 1.6, mat(C.darkWood), x, 8.5, gz));
    g.add(box(w, 0.7, 1.2, mat(C.tileBlue), x, 9.7, gz));
    g.add(tangRoof({ w: w + 3, d: 6, h, ridge: w - 3, material: green(), x, y: x === 0 ? 11.3 : 10.8, z: gz }));
  }
  g.add(box(30, 3.4, 0.8, mat(C.darkWood), 0, 5.2, gz));
  g.add(sign('王城公园', 14, 3, { bg: '#1f4a35', fg: '#f0d890', border: '#d4a93a', x: 0, y: 6.9, z: gz + 0.5 }));
  g.add(sign('王城公园', 14, 3, { bg: '#1f4a35', fg: '#f0d890', border: '#d4a93a', x: 0, y: 6.9, z: gz - 0.5, ry: Math.PI }));
  for (const sx of [-1, 1]) { g.add(box(30, 1.2, 0.8, mat(C.wallWhite), sx * 75, 0, gz)); g.add(box(30, 0.5, 1.2, green(), sx * 75, 1.2, gz)); }
  // ---- 门内大广场 + 园路 ----
  g.add(plaza(120, 70, paveM(), 0, 120, 0.15, 5));
  g.add(plaza(14, 150, paveM(), 0, 25, 0.16, 5));       // 中轴路
  g.add(plaza(220, 8, paveM(), 0, 50, 0.16, 5));        // 东西横路
  g.add(plaza(8, 120, paveM(), -110, 30, 0.16, 5));
  g.add(plaza(8, 120, paveM(), 110, 30, 0.16, 5));
  // ---- 牡丹花圃（色块花坛）----
  const cols = ['peonyPink', 'peonyRed', 'peonyWhite', 'peonyPurple'];
  let bi = 0;
  const bed = (cx, cz, w, d, nx, nz) => {
    g.add(plaza(w, d, mat(0x5a7a3a), cx, cz, 0.17));
    g.add(box(w + 1, 0.5, 0.6, mat(C.stone), cx, 0, cz + d / 2)); g.add(box(w + 1, 0.5, 0.6, mat(C.stone), cx, 0, cz - d / 2));
    g.add(box(0.6, 0.5, d, mat(C.stone), cx - w / 2, 0, cz)); g.add(box(0.6, 0.5, d, mat(C.stone), cx + w / 2, 0, cz));
    const kind = bi++ % 4;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const t = tree(cx - w / 2 + (i + 0.5) * w / nx, cz - d / 2 + (j + 0.5) * d / nz, 2.2, 'peonyBush', 0.17); g.add(t);
    }
    return kind;
  };
  for (const sx of [-1, 1]) {
    bed(sx * 40, 125, 28, 20, 5, 3); bed(sx * 40, 90, 28, 20, 5, 3);
    bed(sx * 40, 75, 28, 12, 5, 2); bed(sx * 40, 24, 24, 18, 4, 3);
    bed(sx * 75, 100, 26, 30, 4, 4);
  }
  // ---- 牡丹阁（三层楼阁，红柱黄瓦，约 25m）----
  g.add(hall({ w: 28, d: 20, wallH: 5.5, roofH: 5, tiers: 3, tierShrink: 0.2, roof: C.tileYellow, wall: C.wallRed, platformH: 1.5, z: -10 }));
  g.add(sign('牡丹阁', 10, 2.2, { bg: '#7a1f18', fg: '#f0d890', border: '#d4a93a', x: 0, y: 9, z: 0.8 }));
  g.add(plaza(40, 24, paveM(), 0, 16, 0.16, 5));
  // ---- 周公 / 河图洛书雕塑台 ----
  g.add(disc(16, mat(C.stoneDark, { map: patternTex('stone', C.stoneDark) }), 0, 50, 0.16, 32));
  g.add(cyl(7, 7.5, 1, mat(C.stone), 0, 0.15, 50, 24));
  g.add(cyl(4.5, 5, 1, mat(C.stoneDark), 0, 1.15, 50, 24));
  g.add(cyl(1.4, 1.8, 5, mat(C.stone), 0, 2.15, 50, 8));
  g.add(box(1.8, 2.4, 1.4, mat(0x6d5a3a), 0, 7.15, 50));
  g.add(sphere(0.55, mat(0x6d5a3a), 0, 10, 50, 8));
  g.add(box(0.5, 4, 0.3, mat(0x6d5a3a), 1.6, 8, 50));
  for (let i = 0; i < 9; i++) g.add(cyl(0.3, 0.3, 0.1, mat(C.black), -2 + (i % 3) * 2, 2.17, 47 + Math.floor(i / 3) * 2, 8).translateY(0));
  g.add(sign('周公制礼 河图洛书', 12, 1.4, { bg: '#2a2a2a', fg: '#e8d9a8', x: 0, y: 2.2, z: 56.2 }));
  // ---- 北湖 + 拱桥 ----
  const lake = new THREE.Mesh(new THREE.CircleGeometry(1, 40), mat(C.water, { shiny: true })); lake.rotation.x = -Math.PI / 2; lake.scale.set(85, 38, 1); lake.position.set(0, 0.2, -135); g.add(lake);
  const lakeRim = new THREE.Mesh(new THREE.RingGeometry(1, 1.03, 40), mat(C.stone)); lakeRim.rotation.x = -Math.PI / 2; lakeRim.scale.set(85, 38, 1); lakeRim.position.set(0, 0.22, -135); g.add(lakeRim);
  // 拱桥（跨湖南北向，x=0）
  for (let i = 0; i < 12; i++) { const t = i / 11, y = Math.sin(t * Math.PI) * 3.2; g.add(box(5, 0.6, 5.2, mat(C.stone), 0, y + 0.1, -100 - t * 58)); }
  for (const sx of [-1, 1]) for (let i = 0; i < 12; i++) { const t = i / 11, y = Math.sin(t * Math.PI) * 3.2; g.add(box(0.4, 1.0, 5.2, mat(C.tangRed), sx * 2.4, y + 0.7, -100 - t * 58)); }
  // ---- 摩天轮：直径 45m，西北角 ----
  const fx = -130, fz = -125, R = 22.5, hubY = 26;
  const white = mat(0xf4f4f0);
  for (const dz of [-2.2, 2.2]) { g.add(ring(R, 0.35, white, fx, hubY, fz + dz)); g.add(ring(R * 0.5, 0.2, white, fx, hubY, fz + dz)); }
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, p = new THREE.Vector3(fx + Math.cos(a) * R, hubY + Math.sin(a) * R, 0);
    for (const dz of [-2.2, 2.2]) g.add(strut(new THREE.Vector3(fx, hubY, fz + dz), new THREE.Vector3(p.x, p.y, fz + dz), 0.22, white));
    g.add(strut(new THREE.Vector3(p.x, p.y, fz - 2.2), new THREE.Vector3(p.x, p.y, fz + 2.2), 0.2, white));
  }
  const carCols = [0xe5484d, 0xf5a623, 0xf8e71c, 0x4caf50, 0x2196f3, 0x9c27b0];
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2;
    const cx = fx + Math.cos(a) * R, cy = hubY + Math.sin(a) * R;
    g.add(box(2.6, 2.2, 3.4, mat(carCols[i % 6]), cx, cy - 2.4, fz));
    g.add(box(2.9, 0.3, 3.7, white, cx, cy - 0.2, fz));
    g.add(box(0.12, 2, 0.12, white, cx, cy - 2, fz - 1.4));
  }
  g.add(cyl(0.9, 0.9, 5.6, white, fx, hubY, fz, 10).rotateX(Math.PI / 2).translateY(0));
  for (const dz of [-3, 3]) { // A 型支架
    g.add(strut(new THREE.Vector3(fx, hubY, fz + dz), new THREE.Vector3(fx - 15, 0, fz + dz * 1.6), 0.7, white));
    g.add(strut(new THREE.Vector3(fx, hubY, fz + dz), new THREE.Vector3(fx + 15, 0, fz + dz * 1.6), 0.7, white));
  }
  g.add(box(36, 0.6, 12, mat(C.concreteDark), fx, 0, fz));
  // ---- 绿化 ----
  for (let i = 0; i < 90; i++) {
    const x = (r() - 0.5) * 400, z = -170 + r() * 330;
    if (Math.abs(x) < 10 && z > -90) continue;
    if (z > 80 && Math.abs(x) < 70) continue;
    if (Math.hypot(x / 90, (z + 135) / 42) < 1.05) continue;
    if (Math.hypot(x - fx, z - fz) < 32) continue;
    if (Math.abs(x) < 36 && z > -35 && z < 90) continue;
    if (Math.abs(x) > 28 && Math.abs(x) < 130 && z > 10 && z < 140) continue;
    g.add(tree(x, z, 7 + r() * 4, ['round', 'plane', 'willow', 'pine'][i % 4]));
  }
  for (let z = 160; z > 0; z -= 18) for (const sx of [-1, 1]) g.add(tree(sx * 9, z, 7, 'plane'));
  for (let z = 150; z > 10; z -= 24) for (const sx of [-1, 1]) g.add(lamp(sx * 7.5, z, 6));
  return finalize(g);
}
