// 明堂（万象神宫）遗址保护建筑。八角形大台基 + 八角两层楼阁（暗金外观、红柱）+ 圆形攒尖顶 + 金凤。
import { THREE, C, mat, box, cyl, sphere, prism, roundRoof, sign, patternTex, finalize } from './_kit.js';

const GOLD = 0xd0a23a, DARKGOLD = 0xa57b2c, ROOF = 0x4a5057;
const P8 = Math.PI / 8;

// 贴图材质：底色由贴图提供，材质色用白色（避免 颜色×贴图 叠加变暗）
const tm = (color, kind, line = 0x000000) => { const t = patternTex(kind, color, line); return mat(t ? 0xffffff : color, { map: t }); };

export const meta = {
  colliders: [
    // 八角台基（正方 + 45° 正方 ≈ 八边形）
    { x: 0, z: 0, w: 80, d: 80 },
    { x: 0, z: 0, w: 80, d: 80, rot: Math.PI / 4 },
  ],
};

// 正八边形顶点（apothem = 边心距），平边朝 +Z
const oct = (ap) => { const R = ap / Math.cos(P8); const p = []; for (let k = 0; k < 8; k++) { const a = P8 + k * Math.PI / 4; p.push([R * Math.sin(a), R * Math.cos(a)]); } return p; };

// 八角柱身，侧面贴图按米平铺
function octBody(ap, h, material, y, tile = 2.4) {
  const R = ap / Math.cos(P8);
  const g = new THREE.CylinderGeometry(R, R, h, 8);
  const uv = g.attributes.uv, su = Math.round(8 * 2 * ap * Math.tan(P8) / tile), sv = Math.max(1, Math.round(h / tile));
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  const m = new THREE.Mesh(g, material); m.position.set(0, y + h / 2, 0); m.rotation.y = P8; return m;
}
function octRing(ap, t, material, y) {
  const R = ap / Math.cos(P8);
  const m = new THREE.Mesh(new THREE.TorusGeometry(R, t, 4, 8), material);
  m.rotation.set(Math.PI / 2, 0, P8); m.position.y = y; return m;
}
function ring(r, t, material, y, seg = 40) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 4, seg), material);
  m.rotation.x = Math.PI / 2; m.position.y = y; return m;
}
// 沿八边形各边均匀放置物体 fn(x, z, ry)
function alongOct(ap, perEdge, fn, skip = () => false) {
  const p = oct(ap);
  for (let k = 0; k < 8; k++) {
    const a = p[k], b = p[(k + 1) % 8];
    for (let i = 0; i < perEdge; i++) {
      const t = (i + 0.5) / perEdge;
      const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      if (!skip(x, z)) fn(x, z, Math.atan2(b[0] - a[0], b[1] - a[1]) + Math.PI / 2);
    }
  }
}

// 金凤：面朝 +Z，展翅、长尾上翘
function phoenix(material, y) {
  const g = new THREE.Group();
  const body = sphere(1, material, 0, 1.6, 0, 12); body.scale.set(0.75, 0.8, 1.5); g.add(body);
  const neck = cyl(0.3, 0.45, 1.8, material, 0, 0, 0, 8); neck.position.set(0, 2.1, 1.2); neck.rotation.x = 0.5; g.add(neck);
  g.add(sphere(0.48, material, 0, 3.25, 1.75, 10));
  const beak = cyl(0.02, 0.22, 0.7, material, 0, 0, 0, 6); beak.position.set(0, 3.15, 2.35); beak.rotation.x = Math.PI / 2; g.add(beak);
  const crest = cyl(0.02, 0.18, 1.1, material, 0, 0, 0, 6); crest.position.set(0, 3.85, 1.55); crest.rotation.x = -0.6; g.add(crest);
  // 双翼（三段羽，向上外张）
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const w = box(3.4 - i * 0.6, 0.12, 1.0, material, 0, 0, 0);
    w.position.set(s * (1.9 - i * 0.2), 2.3 + i * 0.35, 0.2 - i * 0.55);
    w.rotation.set(0, s * 0.25 * i, s * (0.55 + i * 0.12));
    g.add(w);
  }
  // 尾羽（扇形上翘）
  for (let i = -2; i <= 2; i++) {
    const t = box(0.35, 0.1, 3.6, material, 0, 0, 0);
    t.position.set(i * 0.55, 2.2, -2.6);
    t.rotation.set(-0.55, i * 0.22, 0);
    g.add(t);
  }
  // 足 + 宝珠座
  g.add(cyl(0.1, 0.1, 1.0, material, -0.3, 0.4, 0.2, 6)); g.add(cyl(0.1, 0.1, 1.0, material, 0.3, 0.4, 0.2, 6));
  g.add(sphere(0.6, material, 0, 0.2, 0.2, 10));
  g.position.y = y;
  return g;
}

// AI 模型（混元图生 3D）：assets/models/mingtang.glb，整体替换代码版；加载失败时退回代码版。
export const glb = { file: 'mingtang' };

export function build(_kit, o = {}) {
  const g = new THREE.Group();
  if (o.glb) return g;
  const stone = mat(C.stone, { map: patternTex('stone', C.stone) });
  const stoneD = mat(C.stoneDark, { map: patternTex('stone', C.stoneDark) });
  const marble = mat(C.marble);
  const red = mat(C.tangRed), wood = mat(C.darkWood);
  const gold = mat(GOLD, { shiny: true }), dgold = mat(DARKGOLD);
  const wall = tm(DARKGOLD, 'lattice', 0x3a2410);
  const roofMat = tm(ROOF, 'roofTile');

  // ── 八角形大台基（两级）──
  g.add(prism(oct(44), 1.6, stoneD));
  g.add(prism(oct(40.5), 1.6, stone, 1.6));
  // 台基栏杆（四个正面留出台阶口）
  const gap = (x, z) => (Math.abs(x) < 10 && Math.abs(z) > 30) || (Math.abs(z) < 10 && Math.abs(x) > 30);
  alongOct(40, 12, (x, z, ry) => g.add(box(2.6, 1.0, 0.3, marble, x, 3.2, z, ry)), gap);
  alongOct(40, 12, (x, z) => g.add(box(0.4, 1.4, 0.4, marble, x * 1.0, 3.2, z * 1.0)), gap);
  // 四面宽大台阶
  for (let s = 0; s < 4; s++) {
    const ry = s * Math.PI / 2, sx = Math.sin(ry), sz = Math.cos(ry);
    for (let i = 0; i < 10; i++) {
      const h = 3.2 * (1 - i / 10), dist = 40.5 + i * 0.8;
      g.add(box(18, h, 0.8, stone, sx * dist, 0, sz * dist, ry));
    }
    // 垂带
    for (const o of [-9.4, 9.4]) {
      const side = box(0.8, 3.4, 8.8, marble, sx * 44.5 + sz * o, 0, sz * 44.5 + sx * o, ry);
      g.add(side);
    }
  }

  // ── 下层（大）──
  const y0 = 3.2;
  g.add(prism(oct(31), 0.6, marble, y0));                 // 檐下台明
  g.add(octBody(27, 6.6, wall, y0 + 0.6));
  alongOct(30, 5, (x, z) => g.add(cyl(0.45, 0.5, 6.2, red, x, y0 + 0.6, z, 8)));
  g.add(octBody(30.4, 0.9, dgold, y0 + 6.2));               // 阑额（暗金）
  g.add(octBody(31.6, 1.0, wood, y0 + 7.1));                // 斗拱层
  const r1y = y0 + 8.0;
  const r1 = roundRoof({ r: 36.5 / Math.cos(P8), h: 8, curve: 1.25, lift: 1.2, sides: 8, material: roofMat, y: r1y, finial: false });
  r1.rotation.y = P8; g.add(r1);
  g.add(octRing(36.3, 0.45, gold, r1y + 1.2));
  // 八条戗脊（金边），突出八角屋面
  for (let k = 0; k < 8; k++) {
    const a = P8 + k * Math.PI / 4, rg = new THREE.Group();
    const rb = box(19, 0.7, 0.8, dgold, 0, 0, 0); rb.position.set(30.2, r1y + 2.0, 0); rb.rotation.z = -0.115;
    rg.add(rb); rg.rotation.y = Math.atan2(-Math.cos(a), Math.sin(a)); g.add(rg);
  }
  // 檐角金铎
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, R = 36.2 / Math.cos(P8); g.add(sphere(0.6, gold, R * Math.sin(a + P8), r1y + 0.7, R * Math.cos(a + P8), 6)); }

  // ── 上层（小）──
  const y1 = r1y + 3.6;
  g.add(prism(oct(21), 0.6, wood, y1));                     // 平座
  alongOct(20.8, 6, (x, z, ry) => g.add(box(2.0, 1.0, 0.2, gold, x, y1 + 0.6, z, ry)));
  g.add(octBody(17, 4.8, wall, y1 + 0.6));
  alongOct(19.4, 4, (x, z) => g.add(cyl(0.38, 0.42, 4.5, red, x, y1 + 0.6, z, 8)));
  g.add(octBody(19.8, 0.8, dgold, y1 + 4.5));
  g.add(cyl(21, 20.2, 0.9, wood, 0, y1 + 5.2, 0, 32));
  // 顶：圆形攒尖顶
  const r2y = y1 + 6.0;
  const er = 23.5, eh = 5.2;
  g.add(roundRoof({ r: er, h: eh, curve: 1.45, sides: 32, material: roofMat, y: r2y, finial: false }));
  g.add(ring(er - 0.1, 0.45, gold, r2y + eh * 0.15, 40));
  // 宝顶 + 金凤
  const ty = r2y + eh - 0.4;
  g.add(cyl(1.4, 2.4, 1.0, gold, 0, ty, 0, 16));
  g.add(cyl(1.0, 1.4, 0.6, gold, 0, ty + 1.0, 0, 16));
  const ph = phoenix(gold, ty + 1.5); ph.scale.setScalar(1.35); g.add(ph);

  // 匾额
  g.add(sign('万象神宫', 9, 2.4, { bg: '#2a2622', fg: '#e8c25a', border: '#c99a35', x: 0, y: y1 + 3.0, z: 17.2 }));
  g.add(sign('明堂', 6, 2.2, { bg: '#2a2622', fg: '#e8c25a', border: '#c99a35', x: 0, y: y0 + 4.8, z: 27.2 }));
  return finalize(g);
}
