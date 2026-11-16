// 河南科技大学：北大门 + 中轴大道 + 图书馆 + 喷泉广场 + 两栋教学楼
import { THREE, C, mat, box, cyl, sphere, disc, plaza, tower, sign, tree, lamp, flag, patternTex, finalize } from './_kit.js';

export const meta = {
  colliders: [
    { x: -19, z: 112, w: 6, d: 6 },        // 校门左柱
    { x: 19, z: 112, w: 6, d: 6 },         // 校门右柱
    { x: -52, z: 112, w: 36, d: 2.4 },     // 左石墙
    { x: 52, z: 112, w: 36, d: 2.4 },      // 右石墙
    { x: -40, z: 121, w: 18, d: 3 },       // 校名石
    { x: 0, z: -75, w: 100, d: 30 },       // 图书馆
    { x: 0, z: -66, w: 20, d: 12 },        // 图书馆中央凸出体
    { x: -75, z: -20, w: 60, d: 20 },      // 教学楼
    { x: 75, z: -20, w: 60, d: 20 },       // 教学楼
  ],
};

export function build() {
  const g = new THREE.Group();
  const stoneW = mat(C.stone, { map: patternTex('stone', C.stone) });
  const light = 0xe8dfc8;

  // 中轴大道 + 广场
  g.add(plaza(16, 215, mat(C.asphalt), 0, 8, 0.15));
  g.add(plaza(2.2, 215, mat(C.paving), -10.2, 8, 0.15));
  g.add(plaza(2.2, 215, mat(C.paving), 10.2, 8, 0.15));
  g.add(plaza(70, 16, mat(C.paving, { map: patternTex('paving', C.paving) }), 0, 120, 0.15, 4));
  g.add(plaza(80, 46, mat(C.paving, { map: patternTex('paving', C.paving) }), 0, -42, 0.16, 4));
  g.add(plaza(18, 4, mat(C.stone), 0, -57.2, 0.17));

  // ── 北大门（朝 +Z）──
  for (const sx of [-1, 1]) {
    g.add(box(5, 11, 5, stoneW, sx * 19, 0, 112));
    g.add(box(6.2, 0.8, 6.2, mat(C.stoneDark), sx * 19, 11, 112));
    g.add(box(4.2, 0.5, 4.2, mat(C.concrete), sx * 19, 11.8, 112));
    g.add(box(36, 3.2, 1.8, stoneW, sx * 38 + sx * 14, 0, 112));
    g.add(box(36.4, 0.4, 2.4, mat(C.stoneDark), sx * 52, 3.2, 112));
  }
  g.add(box(43, 1.6, 3, mat(C.white), 0, 9.6, 112));                 // 横梁
  g.add(sign('河南科技大学', 20, 1.5, { bg: '#1c3f7a', fg: '#ffffff', x: 0, y: 9.75, z: 113.55 }));
  g.add(sign('河南科技大学', 20, 1.5, { bg: '#1c3f7a', fg: '#ffffff', x: 0, y: 9.75, z: 110.45, ry: Math.PI }));
  // 横卧校名石
  g.add(box(18, 2.8, 2.6, mat(C.rock), -40, 0.15, 121));
  g.add(box(18.6, 0.4, 3.0, mat(C.stoneDark), -40, 0, 121));
  g.add(sign('河南科技大学', 15, 1.7, { bg: '#b9b3a4', fg: '#1c3f7a', x: -40, y: 1.6, z: 122.32 }));
  for (const sx of [-1, 1]) g.add(flag(sx * 28, 118, 14, 0xd4281c));

  // 行道树
  for (let i = 0; i < 13; i++) for (const sx of [-1, 1]) g.add(tree(sx * 14, 98 - i * 12, 11, 'plane'));
  for (let i = 0; i < 8; i++) for (const sx of [-1, 1]) g.add(lamp(sx * 12, 100 - i * 16, 6));

  // ── 图书馆主楼 ──
  const LZ = -75;
  g.add(tower(100, 45, 30, { style: 'grid', wall: light, glass: 0x5e8aa5, bay: 5, floor: 4.5, z: LZ }));
  g.add(box(102, 1.2, 32, mat(C.stoneDark), 0, 45, LZ));
  g.add(box(88, 1.4, 24, mat(0xcfc6ae), 0, 46.2, LZ));
  g.add(tower(20, 52, 14, { style: 'grid', wall: light, glass: 0x5e8aa5, bay: 5, floor: 4.5, z: -66 }));
  g.add(box(21, 1.4, 15, mat(C.stoneDark), 0, 52, -66));
  g.add(box(9, 44, 0.5, mat(C.glassBlue, { shiny: true }), 0, 3, -58.75));   // 竖向玻璃幕
  for (const dx of [-3, 0, 3]) g.add(box(0.3, 44, 0.8, mat(C.steel), dx + 1.5 * 0, 3, -58.6));
  g.add(box(14, 7, 10, mat(light), 0, 53.4, -66));                               // 钟塔
  g.add(box(15, 0.8, 11, mat(C.stoneDark), 0, 60.4, -66));
  g.add(cyl(0.2, 0.5, 5, mat(C.steel), 0, 61.2, -66, 6));
  g.add(sign('图书馆', 10, 2.6, { bg: '#1c3f7a', fg: '#ffffff', x: 0, y: 48.2, z: -58.45 }));
  g.add(cyl(2.2, 2.2, 0.5, mat(C.white), 0, 56, -59.7, 24).rotateX(Math.PI / 2));
  // 台阶 + 门廊柱
  for (let i = 0; i < 5; i++) g.add(box(30 - i * 1.5, 0.3 * (5 - i), 3, mat(C.stone), 0, 0.15, -56 - 0 + i * 0.0 + (4 - i) * -0.0 + 0));
  for (let i = 0; i < 6; i++) g.add(cyl(0.5, 0.55, 7, mat(C.wallWhite), -10 + i * 4, 0.15, -56.5, 10));
  g.add(box(26, 1, 4, mat(C.stoneDark), 0, 7.2, -56.5));

  // ── 喷泉广场 ──
  g.add(cyl(14, 14.6, 0.7, stoneW, 0, 0.15, -38, 32));
  g.add(disc(13.3, mat(C.water, { shiny: true }), 0, -38, 0.88, 32));
  g.add(cyl(1.2, 1.8, 1.6, mat(C.marble), 0, 0.2, -38, 12));
  g.add(cyl(0.2, 0.3, 7, mat(0xdcefff, { opacity: 0.7 }), 0, 1.6, -38, 8));
  g.add(sphere(1.0, mat(0xdcefff, { opacity: 0.7 }), 0, 8.6, -38, 8));
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.add(cyl(0.12, 0.2, 3.2, mat(0xdcefff, { opacity: 0.7 }), Math.cos(a) * 7, 0.85, -38 + Math.sin(a) * 7, 6)); }

  // ── 两侧教学楼（6 层）──
  for (const sx of [-1, 1]) {
    g.add(tower(60, 24, 20, { style: 'grid', wall: 0xd9cdb0, glass: 0x5e8aa5, bay: 5, floor: 4, x: sx * 75, z: -20 }));
    g.add(box(61, 0.9, 21, mat(C.stoneDark), sx * 75, 24, -20));
    g.add(box(14, 4, 1.2, mat(C.wallWhite), sx * 75, 0, -9.4));
    for (let i = 0; i < 4; i++) g.add(tree(sx * (50 + i * 22), -3, 8, 'plane'));
  }
  for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) g.add(tree(sx * 22, -34 - i * 4 + (i > 2 ? -8 : 0), 8, 'plane'));
  return finalize(g);
}
