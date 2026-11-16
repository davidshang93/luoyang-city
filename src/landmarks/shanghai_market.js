// 上海市场步行街：南北向 400m（本地 Z 轴），街宽 24m 的红砖步行街，两侧连续 4-6 层商业楼，南北牌楼，北端 18 层“东方广场”主楼
import { THREE, C, mat, box, cyl, sphere, plaza, tower, sign, tree, lamp, gableRoof, patternTex, finalize, rng } from './_kit.js';
import { COL, mallBlock, signFrame, planter, bench, fountain, led, sub, roofPlant } from './_retail.js';

export const meta = {
  // 只包两侧建筑，中间 x∈[-12,12] 为步行街，必须通行
  colliders: [
    { x: -31, z: 0, w: 38, d: 396 },
    { x: 31, z: 0, w: 38, d: 396 },
  ],
};

export function build() {
  const g = new THREE.Group(), R = rng(11);
  const palette = [0xd9b88f, 0xc7d4c9, 0xe3cfa3, 0xb9c4d6, 0xdcb4a6, 0xd9d9c8];
  const accents = [0xd23a2f, 0x2a7fd0, 0xf0a020, 0x2fa05a];
  // 街面铺装（红砖）+ 中央花带 + 两侧石材边带
  g.add(plaza(24, 412, mat(C.pavingRed, { map: patternTex('brick', C.pavingRed) }), 0, 0, 0.15, 4));
  g.add(plaza(5, 380, mat(0xc9c2b2, { map: patternTex('paving', 0xc9c2b2) }), 0, 0, 0.2, 3));
  for (const s of [-1, 1]) g.add(plaza(2.4, 396, mat(C.stoneDark), s * 10.6, 0, 0.2));

  // ── 两侧建筑：沿 Z 分段，正面朝街（西侧朝 +X，东侧朝 -X）
  let z = -196, idx = 0;
  while (z < 190) {
    const len = 26 + Math.floor(R() * 3) * 6, lenA = Math.min(len, 196 - z);
    if (lenA < 14) break;
    const zm = z + lenA / 2;
    for (const s of [-1, 1]) {
      const floors = 4 + Math.floor(R() * 3), fh = 3.9, h = floors * fh, col = palette[Math.floor(R() * palette.length)];
      const depth = 34 + Math.floor(R() * 3) * 2, xc = s * (12.5 + depth / 2), wallW = lenA - 1.2;
      if (s > 0 && zm < -148 && zm > -192) { R(); R(); continue; }           // 东方广场主楼占这一段
      const b = sub(g, xc, 0, zm, s < 0 ? Math.PI / 2 : -Math.PI / 2);
      mallBlock(b, { x: 0, z: 0, w: wallW, d: depth, h, floor: fh, bay: 4, wall: col, glass: 0x4c6578, cap: 0x8a8272, belts: false, shopH: 3.6, seed: 200 + idx,
        plant: { ac: 2, cool: 1, rooms: 1, stacks: 2, pipes: 1 } });
      const ac = accents[(idx + (s > 0 ? 2 : 0)) % accents.length], ac2 = accents[(idx * 2 + 1 + (s > 0 ? 1 : 0)) % accents.length];
      b.add(box(wallW - 2, 0.4, 2.4, mat(ac), 0, 3.7, depth / 2 + 1.2));                    // 雨篷
      b.add(box(3.2, h * 0.45, 0.5, led(ac2, 0.9), (R() - 0.5) * 6, h * 0.4, depth / 2 + 0.4));   // 竖向灯箱
      if (R() < 0.5) b.add(box(wallW * 0.6, 3, 0.5, led(ac, 0.9), 0, h - 4, depth / 2 + 0.4));
      idx++;
    }
    z += lenA;
  }
  // ── 北端 18 层“东方广场”主楼（北 = -Z）
  g.add(tower(30, 66, 30, { style: 'office', wall: 0xc9c0a8, glass: 0x2f4a60, bay: 3.6, floor: 3.67, x: 29, z: -170, shiny: false }));
  g.add(box(12, 3, 12, mat(0xb9bec2), 29, 66.9, -170));
  g.add(cyl(0.2, 0.3, 12, mat(C.steel), 29, 70, -170, 6));
  signFrame(g, { x: 29, z: -160, y: 67, w: 20, h: 4 });
  g.add(sign('东方广场', 20, 4, { bg: '#b3261e', fg: '#ffe9a8', border: '#ffe9a8', emissive: true, x: 29, y: 69.5, z: -159.8 }));
  g.add(sign('东方广场', 16, 3, { bg: '#b3261e', fg: '#ffe9a8', emissive: true, x: 14.1, y: 56, z: -170, ry: -Math.PI / 2 }));
  // 百货楼招牌（面向街道）
  g.add(sign('上海百货', 22, 3.4, { bg: '#174f9a', fg: '#ffffff', emissive: true, x: -12.4, y: 13.5, z: 40, ry: Math.PI / 2 }));
  g.add(sign('商业步行街', 22, 3.4, { bg: '#1f7a46', fg: '#ffffff', emissive: true, x: 12.4, y: 13.5, z: 44, ry: -Math.PI / 2 }));

  // ── 南北牌楼：红柱 + 石座 + 琉璃瓦檐
  const arch = mat(C.tangRed), jade = mat(C.tileGreen);
  for (const zz of [-206, 206]) {
    for (const s of [-1, 1]) {
      g.add(box(3.8, 1.0, 3.8, mat(C.stone), s * 9.5, 0, zz)); g.add(cyl(0.7, 0.8, 10.6, arch, s * 9.5, 1.0, zz, 10));
      g.add(box(2.6, 0.4, 2.6, mat(C.gold), s * 9.5, 11.6, zz));
      g.add(gableRoof(7.4, 4.2, 1.6, mat(C.tileGreen), s * 9.5, 11.8, zz));
    }
    g.add(box(19, 1.2, 1.6, arch, 0, 9.2, zz)); g.add(box(19, 0.5, 2.2, mat(C.darkWood), 0, 8.7, zz));
    g.add(box(18, 3.6, 1.0, mat(0x7a1d14), 0, 10.4, zz));
    g.add(gableRoof(16, 4.4, 2.8, mat(C.tileGreen), 0, 14.0, zz)); g.add(box(15, 0.5, 2.2, arch, 0, 13.5, zz));
    g.add(sign('上海市场', 13, 2.6, { bg: '#7a1d14', fg: '#f6d774', border: '#f6d774', emissive: true, x: 0, y: 11.9, z: zz + 0.6 }));
  }
  // ── 步行街中央：花坛、座椅、灯柱、雕塑
  for (let zz = -180; zz <= 180; zz += 30) {
    const k = Math.round((zz + 180) / 30);
    if (zz !== 0) planter(g, { x: 0, z: zz, w: 4, d: 4, kind: k % 3 === 0 ? 'peonyBush' : 'round', th: 5.5, grass: true });
    for (const s of [-1, 1]) bench(g, s * 3.6, zz + 8, Math.PI / 2, 0.2, 3);
    g.add(lamp(-6.5 + (k % 2) * 13, zz + 15, 6));
    for (const s of [-1, 1]) planter(g, { x: s * 10.6, z: zz + 15, w: 2.2, d: 2.2, kind: 'plane', th: 6, y: 0.2, rim: 0.35 });
  }
  fountain(g, { x: 0, z: 0, r: 4.5, y: 0.2 });
  g.add(cyl(0.5, 0.7, 5, mat(C.bronze), 0, 1.2, 0, 8)); g.add(sphere(1.1, mat(C.bronze, { shiny: true }), 0, 6.8, 0, 12));
  return finalize(g);
}
