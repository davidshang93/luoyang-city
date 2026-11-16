// 天堂（通天浮屠）— 武则天礼佛堂复建。圆形塔楼，高约 88m，外观 5 层，双层圆形石台基（直径约 55m）。
import { THREE, C, mat, box, cyl, sphere, roundRoof, sign, patternTex, finalize } from './_kit.js';

const GOLD = 0xc99a35, DARKGOLD = 0x9a7428, ROOF = 0x4a5057;

// 贴图材质：底色由贴图提供，材质色用白色（避免 颜色×贴图 叠加变暗）
const tm = (color, kind, line = 0x000000) => { const t = patternTex(kind, color, line); return mat(t ? 0xffffff : color, { map: t }); };

export const meta = {
  colliders: [
    // 双层圆台基（≈ 圆形：正方 + 45° 正方）
    { x: 0, z: 0, w: 44, d: 44 },
    { x: 0, z: 0, w: 44, d: 44, rot: Math.PI / 4 },
  ],
};

// 开口圆筒（栏杆、檐口板等）
function tube(r, h, material, y, seg = 32) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg, 1, true), material);
  m.position.set(0, y + h / 2, 0);
  return m;
}
// 带贴图平铺的圆柱（墙身格扇）
function texCyl(r, h, material, y, tile = 2.4, seg = 32) {
  const g = new THREE.CylinderGeometry(r, r, h, seg);
  const uv = g.attributes.uv, su = Math.round(2 * Math.PI * r / tile), sv = Math.max(1, Math.round(h / tile));
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  const m = new THREE.Mesh(g, material); m.position.set(0, y + h / 2, 0); return m;
}
// 水平圆环（金色檐口线）
function ring(r, t, material, y, seg = 40) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 4, seg), material);
  m.rotation.x = Math.PI / 2; m.position.y = y; return m;
}

// AI 模型（混元图生 3D）：assets/models/tiantang.glb，整体替换代码版；加载失败时退回代码版。
export const glb = { file: 'tiantang' };

export function build(_kit, o = {}) {
  const g = new THREE.Group();
  if (o.glb) return g;
  const stone = mat(C.stone, { map: patternTex('stone', C.stone) });
  const marble = mat(C.marble);
  const red = mat(C.tangRed), wood = mat(C.darkWood);
  const gold = mat(GOLD, { shiny: true }), dgold = mat(DARKGOLD);
  const wall = tm(0x8a2a1c, 'lattice', 0xe0b04a);
  const roofMat = tm(ROOF, 'roofTile');

  // ── 双层圆形石台基 ──
  g.add(cyl(27.5, 27.8, 2.2, stone, 0, 0, 0, 40));
  g.add(tube(27.3, 1.1, marble, 2.2, 40));
  g.add(cyl(23, 23.3, 2.0, stone, 0, 2.2, 0, 40));
  g.add(tube(22.8, 1.1, marble, 4.2, 40));
  // 栏杆望柱
  for (let i = 0; i < 40; i++) {
    const a = (i + 0.5) / 40 * Math.PI * 2;
    g.add(box(0.35, 1.5, 0.35, marble, Math.sin(a) * 27.3, 2.2, Math.cos(a) * 27.3));
    g.add(box(0.35, 1.5, 0.35, marble, Math.sin(a) * 22.8, 4.2, Math.cos(a) * 22.8));
  }
  // 四面台阶
  for (let s = 0; s < 4; s++) {
    const ry = s * Math.PI / 2;
    for (let i = 0; i < 8; i++) {
      const h = 4.2 * (1 - i / 8), dist = 22 + i * 0.75;
      const st = box(10, h, 0.8, stone, Math.sin(ry) * dist, 0, Math.cos(ry) * dist, ry);
      g.add(st);
    }
  }

  // ── 五层塔身 ──
  const R = [16, 14.6, 13.2, 11.8, 10.4];
  const H = [13, 11.6, 11, 10.2, 9.4];
  let y = 4.2;
  for (let f = 0; f < 5; f++) {
    const r = R[f], h = H[f];
    // 平座（外廊地面）+ 金色栏杆
    g.add(cyl(r + 2.6, r + 2.6, 0.8, wood, 0, y, 0, 32));
    g.add(tube(r + 2.5, 1.1, gold, y + 0.8));
    // 墙身（红底金格扇）
    g.add(texCyl(r, h, wall, y));
    // 外廊红柱
    const n = Math.round(2 * Math.PI * (r + 2) / 3.4);
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) / n * Math.PI * 2;
      g.add(cyl(0.32, 0.36, h - 0.8, red, Math.sin(a) * (r + 2), y + 0.8, Math.cos(a) * (r + 2), 8));
    }
    // 阑额 + 斗拱层（暗金）
    g.add(tube(r + 2.2, 0.9, dgold, y + h - 1.6));
    g.add(cyl(r + 3, r + 2.4, 1.0, wood, 0, y + h - 0.7, 0, 32));
    if (f < 4) {
      // 出檐：深灰瓦 + 金色檐口
      const er = r + 5.6, eh = 5.0;
      g.add(roundRoof({ r: er, h: eh, curve: 1.3, lift: 1.0, sides: 32, material: roofMat, y: y + h + 0.3, finial: false }));
      g.add(ring(er - 0.1, 0.45, gold, y + h + 0.3 + 1.0, 40));
      y += h + 3.0;
    } else {
      // 顶层：大圆攒尖顶 + 金色宝顶火珠
      const er = r + 5.5, eh = 10;
      const top = y + h + 0.3;
      g.add(roundRoof({ r: er, h: eh, curve: 1.55, sides: 32, material: roofMat, y: top, finial: false }));
      g.add(ring(er - 0.1, 0.42, gold, top + eh * 0.15, 40));
      // 宝顶：覆钵 + 相轮 + 火珠
      const ty = top + eh - 0.6;
      g.add(cyl(1.0, 1.8, 1.2, gold, 0, ty, 0, 16));
      g.add(sphere(1.4, gold, 0, ty + 2.0, 0, 16));
      for (let i = 0; i < 3; i++) g.add(cyl(0.9 - i * 0.18, 0.9 - i * 0.18, 0.35, gold, 0, ty + 3.3 + i * 0.8, 0, 12));
      g.add(cyl(0.18, 0.25, 2.6, gold, 0, ty + 3.2, 0, 8));
      g.add(sphere(0.9, gold, 0, ty + 6.4, 0, 12));            // 火珠
      g.add(cyl(0.02, 0.55, 1.6, gold, 0, ty + 6.9, 0, 8));    // 火焰尖
      g.userData.height = ty + 8.5;
    }
  }

  // 匾额：一层正面
  g.add(sign('天堂', 8, 3.2, { bg: '#2a2622', fg: '#e8c25a', border: '#c99a35', vertical: false, x: 0, y: 4.2 + 13 - 3.2, z: 16.25 }));
  return finalize(g);
}
