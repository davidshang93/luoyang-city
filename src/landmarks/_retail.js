// 商场 / 车站地标共用的细节件（屋顶设备、天窗、入口、橱窗、LED 屏、停车场、花坛……）。
// 只依赖 _kit.js；所有函数的坐标约定同 kit：y = 物体底面，建筑正面朝 +Z。
// 材质一律走 mat()（有缓存），颜色集中在下面几个常量里，避免材质种类膨胀（合并后 mesh 数 = 材质数）。
import { THREE, C, mat, box, cyl, plaza, tower, sign, tree, lamp, gableRoof, patternTex, rng } from './_kit.js';

export const COL = {
  alu: 0xdfe3e5, aluDark: 0x9aa1a6, dark: 0x2a2d31, white: 0xf2f2ee, warm: 0xffd9a0, roofDeck: 0x4f5254,
  posters: [0xb3261e, 0x1f5fa8, 0xe8a317, 0x222a33],
  led: [0xe0463a, 0x2f80ed, 0xf2b134, 0x35d0ff],
  cars: [C.black, 0xf2f2ee, C.steel, 0x2a4f8a],
};
export const R = (seed) => rng((seed * 7919 + 13) >>> 0);
export const led = (c, k = 0.9) => mat(c, { emissive: c, emissiveIntensity: k });
const darkM = () => mat(COL.dark, { shiny: true });
const glassM = () => mat(C.glassDark, { shiny: true });
const aluM = () => mat(COL.alu, { shiny: true });
export const pave = (c = C.paving) => mat(c, { map: patternTex('paving', c) });

/** 子分组（带位置和 Y 旋转），方便做旋转的部件 */
export function sub(g, x = 0, y = 0, z = 0, ry = 0) { const s = new THREE.Group(); s.position.set(x, y, z); s.rotation.y = ry; g.add(s); return s; }
/** 斜放的杆件：从 a 到 b 的方杆 */
export function bar(g, a, b, t, material) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), L = va.distanceTo(vb);
  const m = new THREE.Mesh(new THREE.BoxGeometry(t, L, t), material);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  g.add(m); return m;
}

// ───────────── 屋顶 ─────────────
/** 屋面防水层（深灰）+ 检修步道线，铺在 tower 的屋面上（tower 自带女儿墙，内口约 w-0.7） */
export function roofDeck(g, { x = 0, z = 0, w, d, y, col = COL.roofDeck }) {
  g.add(plaza(w - 0.8, d - 0.8, mat(col), x, z, y + 0.1));
  g.add(plaza(1.2, d - 3, mat(C.concrete), x - w * 0.18, z, y + 0.14));
  g.add(plaza(w - 3, 1.2, mat(C.concrete), x, z + d * 0.18, y + 0.14));
}
/** 屋顶设备：空调外机排、冷却塔、机房、排风管、管线、天线。区域 (w x d) 以 (x,z) 为中心，y 为屋面高度。 */
export function roofPlant(g, { x = 0, z = 0, w, d, y, seed = 1, ac = 6, cool = 2, rooms = 2, stacks = 3, pipes = 3, mast = false, avoid = [] }) {
  const r = R(seed), placed = avoid.slice(), mg = 2.2, k = Math.min(6, Math.max(1, w * d / 3500));   // 屋面越大设备越多
  ac = Math.round(ac * k); cool = Math.round(cool * (1 + (k - 1) * 0.6)); rooms = Math.round(rooms * (1 + (k - 1) * 0.5)); stacks = Math.round(stacks * k); pipes = Math.round(pipes * k);
  const fits = (px, pz, sw, sd) => {
    if (Math.abs(px - x) + sw / 2 > w / 2 - mg || Math.abs(pz - z) + sd / 2 > d / 2 - mg) return false;
    for (const [qx, qz, qw, qd] of placed) if (Math.abs(px - qx) < (sw + qw) / 2 + 1.5 && Math.abs(pz - qz) < (sd + qd) / 2 + 1.5) return false;
    return true;
  };
  const spot = (sw, sd) => { for (let t = 0; t < 40; t++) { const px = x + (r() - 0.5) * (w - mg * 2 - sw), pz = z + (r() - 0.5) * (d - mg * 2 - sd); if (fits(px, pz, sw, sd)) { placed.push([px, pz, sw, sd]); return [px, pz]; } } return null; };
  const alu = aluM(), steel = mat(C.steel), dark = darkM(), conc = mat(C.concrete), white = mat(COL.white);
  for (let i = 0; i < rooms; i++) {            // 机房 / 电梯机房
    const sw = 6 + r() * 6, sd = 4.5 + r() * 4, sh = 3 + r() * 1.4, p = spot(sw, sd); if (!p) continue;
    g.add(box(sw, sh, sd, mat(COL.alu), p[0], y, p[1]));
    g.add(box(sw + 0.5, 0.3, sd + 0.5, mat(COL.roofDeck), p[0], y + sh, p[1]));
    g.add(box(1.6, 2.3, 0.1, dark, p[0] - sw * 0.25, y, p[1] + sd / 2 + 0.03));
    for (let k = 0; k < 3; k++) g.add(box(sw * 0.3, 0.12, 0.1, dark, p[0] + sw * 0.18, y + 1.0 + k * 0.5, p[1] + sd / 2 + 0.03));
  }
  for (let i = 0; i < cool; i++) {              // 冷却塔（一对）
    const p = spot(9.5, 4.8); if (!p) continue;
    for (const s of [-1, 1]) {
      const cx = p[0] + s * 2.4;
      g.add(box(4.4, 0.5, 4.4, conc, cx, y, p[1]));
      g.add(box(4.0, 2.6, 4.0, white, cx, y + 0.5, p[1]));
      g.add(cyl(1.45, 1.55, 0.5, dark, cx, y + 3.1, p[1], 14));
      g.add(cyl(0.15, 0.15, 0.3, steel, cx, y + 3.6, p[1], 6));
    }
    g.add(box(0.4, 0.4, 4.2, steel, p[0], y + 0.9, p[1]));
  }
  for (let i = 0; i < ac; i++) {                // 空调外机排
    const n = 3 + Math.floor(r() * 4), along = r() < 0.5, p = spot(along ? n * 1.9 : 2.0, along ? 2.0 : n * 1.9); if (!p) continue;
    for (let k = 0; k < n; k++) {
      const ux = along ? p[0] + (k - (n - 1) / 2) * 1.9 : p[0], uz = along ? p[1] : p[1] + (k - (n - 1) / 2) * 1.9;
      g.add(box(1.7, 1.25, 1.55, alu, ux, y + 0.25, uz)); g.add(cyl(0.58, 0.58, 0.07, dark, ux, y + 1.5, uz, 10));
    }
    g.add(box(along ? n * 1.9 : 0.25, 0.25, along ? 0.25 : n * 1.9, steel, p[0], y, p[1]));
  }
  for (let i = 0; i < stacks; i++) {            // 排风管
    const p = spot(1.2, 1.2); if (!p) continue;
    const sh = 2.5 + r() * 3; g.add(cyl(0.38, 0.45, sh, steel, p[0], y, p[1], 10)); g.add(cyl(0.62, 0.38, 0.45, steel, p[0], y + sh, p[1], 10));
  }
  for (let i = 0; i < pipes; i++) {             // 管线（架空）
    const L = 8 + r() * 14, along = r() < 0.5, p = spot(along ? L : 1.2, along ? 1.2 : L); if (!p) continue;
    const bx = along ? L : 0.3, bz = along ? 0.3 : L;
    g.add(box(bx, 0.3, bz, mat(COL.alu), p[0], y + 0.7, p[1]));
    for (let k = 0; k <= L / 4; k++) { const t = -L / 2 + k * 4; g.add(box(0.25, 0.7, 0.25, steel, p[0] + (along ? t : 0), y, p[1] + (along ? 0 : t))); }
  }
  if (mast) { const p = spot(2, 2); if (p) { g.add(cyl(0.12, 0.2, 14, steel, p[0], y, p[1], 8)); g.add(box(3, 0.1, 0.1, steel, p[0], y + 11, p[1])); g.add(box(2, 0.1, 0.1, steel, p[0], y + 8, p[1])); } }
  return placed;
}
/** 玻璃采光天窗：沿 X 一排人字顶玻璃，混凝土井口 + 钢肋 */
export function skylights(g, { x = 0, z = 0, w, d, y, n = 3, rise = 2.4 }) {
  const gl = mat(C.glassBlue), steel = mat(C.steel), conc = mat(C.concrete), seg = w / n;
  for (let i = 0; i < n; i++) {
    const cx = x - w / 2 + (i + 0.5) * seg, sw = seg - 1.2;
    g.add(box(sw + 0.5, 0.6, d + 0.5, conc, cx, y, z));
    g.add(gableRoof(sw, d, rise, gl, cx, y + 0.6, z));
    g.add(box(sw + 0.1, 0.18, 0.18, steel, cx, y + 0.6 + rise - 0.1, z));
    const a = Math.atan2(rise, d / 2), sl = Math.hypot(rise, d / 2);
    for (let k = 0; k <= Math.round(sw / 3.2); k++) {
      const px = cx - sw / 2 + k * sw / Math.max(1, Math.round(sw / 3.2));
      for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, sl), steel); m.position.set(px, y + 0.6 + rise / 2 + 0.04, z + s * d / 4); m.rotation.x = -s * a; g.add(m); }
    }
  }
}
/** 屋顶停车场划线（沿 X 两排车位 + 车道）和几辆车 */
export function roofParking(g, { x = 0, z = 0, w, d, y, seed = 1, fill = 0.5 }) {
  g.add(plaza(w, d, mat(0x4d5054), x, z, y + 0.04));
  carpark(g, { x, z, w, d, y: y + 0.04, seed, fill, base: false, rows: 1 });
}
/** 塔楼幕墙收顶：四周竖向钢格栅 + 顶框 + 中央设备 */
export function crown(g, { x = 0, z = 0, w, d, y, h = 4.5, col = COL.aluDark }) {
  const m = mat(col, { shiny: true }), dark = darkM(), ins = 0.5;
  const nx = Math.max(2, Math.round(w / 1.5)), nz = Math.max(2, Math.round(d / 1.5));
  for (let i = 0; i <= nx; i++) for (const s of [-1, 1]) g.add(box(0.2, h, 0.3, m, x - (w - ins * 2) / 2 + i * (w - ins * 2) / nx, y, z + s * (d / 2 - ins)));
  for (let i = 1; i < nz; i++) for (const s of [-1, 1]) g.add(box(0.3, h, 0.2, m, x + s * (w / 2 - ins), y, z - (d - ins * 2) / 2 + i * (d - ins * 2) / nz));
  g.add(box(w - ins * 2 + 0.4, 0.35, d - ins * 2 + 0.4, m, x, y + h, z));
  g.add(box(w - ins * 2, 0.3, 0.3, m, x, y + h * 0.5, z + d / 2 - ins)); g.add(box(w - ins * 2, 0.3, 0.3, m, x, y + h * 0.5, z - d / 2 + ins));
  g.add(box(w * 0.4, h * 0.6, d * 0.4, dark, x, y, z));
  g.add(cyl(0.1, 0.18, 6, mat(C.steel), x, y + h + 0.3, z, 6));
}
/** 屋顶大字招牌的钢架（招牌面朝 +Z，招牌本身另用 sign() 放在 z+0.3 处） */
export function signFrame(g, { x = 0, z = 0, y, w, h }) {
  const st = mat(C.steel), dark = darkM(), n = Math.max(2, Math.round(w / 8));
  for (let i = 0; i <= n; i++) {
    const px = x - w / 2 + i * w / n;
    g.add(box(0.35, h + 1, 0.35, st, px, y, z - 0.5));
    if (i < n) bar(g, [px, y, z - 0.5], [px + w / n, y + h + 0.8, z - 0.5], 0.14, st);
  }
  g.add(box(w + 0.6, 0.3, 0.4, st, x, y + h + 1, z - 0.5)); g.add(box(w + 0.6, 0.3, 0.4, st, x, y, z - 0.5));
  g.add(box(w, 0.12, 1.4, dark, x, y - 0.12, z + 0.2));
  g.add(box(w - 0.5, h, 0.2, dark, x, y + 0.5, z - 0.1));
}

// ───────────── 立面 / 底层 ─────────────
/** 底层橱窗街：深色玻璃 + 竖框 + 展示面板（暖光/海报色块）+ 招牌带 + 石材勒脚。沿 X 铺开，朝 +Z，z = 立面所在位置 */
export function shopfront(g, { x = 0, z = 0, w = 40, y = 0, h = 4.8, seed = 1, ry = 0, fascia = null, cols = COL.posters }) {
  const s = sub(g, x, y, z, ry), r = R(seed), n = Math.max(1, Math.round(w / 3.6)), bw = w / n, dark = darkM();
  s.add(box(w, 0.5, 0.55, mat(C.stoneDark), 0, 0, 0.1));
  s.add(box(w, h - 1.3, 0.12, glassM(), 0, 0.5, 0.15));
  for (let i = 0; i <= n; i++) s.add(box(0.14, h - 0.8, 0.3, dark, -w / 2 + i * bw, 0.5, 0.22));
  s.add(box(w, 0.12, 0.3, dark, 0, 0.5 + h - 1.3, 0.22));
  for (let i = 0; i < n; i++) {
    const cx = -w / 2 + (i + 0.5) * bw, k = r();
    if (k < 0.34) s.add(box(bw - 0.6, h - 2.5, 0.05, led(COL.warm, 0.4), cx, 0.9, 0.2));
    else if (k < 0.68) s.add(box(bw - 0.8, h - 2.2, 0.05, mat(cols[Math.floor(r() * cols.length)]), cx, 0.9, 0.2));
    else if (k < 0.8) s.add(box(1.3, 2.5, 0.07, dark, cx, 0.5, 0.2));
  }
  s.add(box(w, 0.85, 0.75, mat(fascia ?? cols[Math.floor(seed) % cols.length]), 0, h - 0.8, 0.28));
  s.add(box(w, 0.07, 0.07, led(0xffffff, 0.6), 0, h - 0.87, 0.67));
  return s;
}
/** 主入口：玻璃门墙 + 门框 + 暖光门楣 + 挑出的雨棚（带红色/品牌檐口）+ 立柱 + 台阶。z = 立面位置，雨棚向 +Z 伸出 dc。 */
export function entrance(g, { x = 0, z = 0, w = 16, h = 6.5, dc = 7, fascia = 0xc8161d, y = 0, ry = 0, steps = 3, pillars = 4 }) {
  const s = sub(g, x, y, z, ry), dark = darkM(), n = Math.max(2, Math.round(w / 2.3));
  s.add(box(w, h, 0.3, glassM(), 0, 0, 0.3));
  for (let i = 0; i <= n; i++) s.add(box(0.12, h, 0.2, dark, -w / 2 + i * w / n, 0, 0.5));
  s.add(box(w, 0.14, 0.2, dark, 0, 2.7, 0.5)); s.add(box(w, 0.14, 0.2, dark, 0, h * 0.6 + 1, 0.5));
  s.add(box(w - 0.6, h - 3.2, 0.05, led(COL.warm, 0.4), 0, 2.85, 0.5));
  for (let i = 0; i < n; i += 2) s.add(box(w / n * 0.9, 2.55, 0.06, darkM(), -w / 2 + (i + 0.5) * w / n, 0, 0.55));
  s.add(box(w + 4, 0.5, dc, mat(COL.white), 0, h, 0));      // 雨棚（顶 y=h+0.5）
  s.add(box(w + 4.3, 1.1, 0.5, mat(fascia), 0, h - 0.2, dc / 2));
  s.add(box(w + 3, 0.05, dc - 1, led(COL.warm, 0.4), 0, h - 0.02, dc / 2 - 0.1));
  for (let i = 0; i < pillars; i++) s.add(cyl(0.32, 0.32, h, mat(C.steel, { shiny: true }), -w / 2 - 1 + i * (w + 2) / (pillars - 1), 0, dc / 2 - 0.4, 10));
  for (let i = 0; i < steps; i++) s.add(box(w + 3, 0.13 * (steps - i) + 0.02, 0.5, mat(C.stone), 0, 0, dc / 2 + 0.6 + i * 0.5));
  return s;
}
/** LED 大屏：深色边框 + 一格格发光色块（像素画面） */
export function ledWall(g, { x = 0, y = 0, z = 0, w, h, seed = 1, ry = 0, cell = 2.4, dim = 0.28 }) {
  const s = sub(g, x, y, z, ry), r = R(seed), nx = Math.max(2, Math.round(w / cell)), ny = Math.max(1, Math.round(h / cell)), cw = w / nx, ch = h / ny;
  s.add(box(w + 0.5, h + 0.5, 0.35, mat(0x14171c), 0, -0.25, 0));
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const k = r(); if (k < dim) continue;
    s.add(box(cw - 0.1, ch - 0.1, 0.1, led(COL.led[Math.floor(r() * COL.led.length)], 0.85), -w / 2 + (i + 0.5) * cw, j * ch, 0.2));
  }
  return s;
}
/** 竖向彩色灯带 */
export function lightStrips(g, { x0, x1, z, y = 0, h, n, ry = 0, seed = 1, skip = [] }) {
  const r = R(seed), s = sub(g, 0, 0, 0, ry);
  for (let i = 0; i < n; i++) { const px = x0 + (x1 - x0) * (i + 0.5) / n; if (skip.some(([a, b]) => px > a && px < b)) continue; const c = COL.led[Math.floor(r() * COL.led.length)]; s.add(box(0.6, h, 0.35, led(c, 0.8), px, y, z)); }
}
/** 竖向铝板翅片 / 格栅 */
export function fins(g, { x0, x1, z, y = 0, h, pitch = 1.8, t = 0.3, depth = 0.6, col = COL.alu, ry = 0 }) {
  const s = sub(g, 0, 0, 0, ry), m = mat(col, { shiny: true }), n = Math.round((x1 - x0) / pitch);
  for (let i = 0; i <= n; i++) s.add(box(t, h, depth, m, x0 + i * (x1 - x0) / n, y, z));
  return s;
}
/** 横向铝板飘带（沿 X，探出 depth） */
export function belt(g, { x = 0, y, z, w, d = 0.5, t = 0.5, col = COL.alu }) { g.add(box(w, t, d, mat(col, { shiny: true }), x, y, z)); }
/** 圆柱形玻璃塔：玻璃体 + 每层铝带 + 竖向分格 + 屋顶盖 */
export function cylFacade(g, { x = 0, z = 0, r, h, y = 0, glass = C.glassBlue, floor = 5, n = 28, band = COL.alu, cap = 0.9 }) {
  g.add(cyl(r, r, h, mat(glass), x, y, z, 32));
  const al = mat(band, { shiny: true }), nf = Math.max(1, Math.round(h / floor));
  for (let f = 1; f <= nf; f++) g.add(cyl(r + 0.22, r + 0.22, 0.45, al, x, y + f * h / nf - 0.45, z, 32));
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; g.add(box(0.1, h, 0.2, al, x + Math.sin(a) * (r + 0.08), y, z + Math.cos(a) * (r + 0.08), a)); }
  g.add(cyl(r + 0.5, r + 0.5, cap, al, x, y + h, z, 32));
  g.add(cyl(r - 1, r - 1, 0.6, mat(COL.roofDeck), x, y + h + cap, z, 24));
  for (let i = 0; i < 3; i++) { const a = i * 2.1; g.add(box(1.6, 1.2, 1.4, al, x + Math.sin(a) * r * 0.45, y + h + cap + 0.6, z + Math.cos(a) * r * 0.45)); }
}
/** 招牌底板（品牌色实心牌 + 发光边），文字用 sign() 另放 */
export function signPlate(g, { x = 0, y, z, w, h, col = 0xc8161d }) {
  g.add(box(w + 0.8, h + 0.8, 0.5, mat(col), x, y - h / 2 - 0.4, z));
  g.add(box(w + 1.0, 0.1, 0.55, led(0xffffff, 0.6), x, y + h / 2 + 0.4, z));
}

// ───────────── 地面 / 广场 ─────────────
/** 小汽车（简模）：深色底盘 + 车身 + 玻璃舱 */
export function parkedCar(g, x, z, color, ry = 0, y = 0.15) {
  const s = sub(g, x, y, z, ry);
  s.add(box(1.7, 0.35, 4.1, mat(C.black), 0, 0.05, 0));
  s.add(box(1.85, 0.62, 4.5, mat(color), 0, 0.3, 0));
  s.add(box(1.62, 0.62, 2.3, glassM(), 0, 0.92, -0.1));
  s.add(box(1.66, 0.06, 2.0, mat(color), 0, 1.54, -0.1));
  return s;
}
/** 停车场：沥青 + 车位线 + 车。双排车位夹车道，沿 X 排布，ry 可整体旋转。base=false 只画线和车。 */
export function carpark(g, { x = 0, z = 0, w, d, y = 0.15, seed = 1, fill = 0.6, rows = 2, ry = 0, base = true, lanes = true }) {
  const s = sub(g, x, 0, z, ry), r = R(seed), stall = 2.7, sl = 5.2, aisle = 6.4, mod = sl * 2 + aisle;
  if (base) s.add(plaza(w, d, mat(C.asphalt), 0, 0, y));
  const nMod = Math.max(1, Math.floor((d - 1) / mod)), nS = Math.floor((w - 2) / stall), line = mat(COL.white), x0 = -nS * stall / 2;
  for (let m = 0; m < nMod; m++) {
    const zc = -d / 2 + mod / 2 + 0.5 + m * mod + (d - 1 - nMod * mod) / 2;
    for (const sd of rows === 1 ? [-1] : [-1, 1]) {
      const zs = zc + sd * (aisle / 2 + sl / 2);
      for (let i = 0; i <= nS; i++) s.add(box(0.12, 0.02, sl, line, x0 + i * stall, y + 0.02, zs));
      s.add(box(nS * stall, 0.02, 0.12, line, 0, y + 0.02, zs - sd * sl / 2));
      for (let i = 0; i < nS; i++) if (r() < fill) parkedCar(s, x0 + (i + 0.5) * stall, zs, COL.cars[Math.floor(r() * COL.cars.length)], r() < 0.5 ? 0 : Math.PI, y);
    }
    if (lanes) for (let i = 0; i < nS / 3; i++) s.add(box(1.2, 0.02, 0.2, line, x0 + i * stall * 3 + 1, y + 0.02, zc));
  }
  return s;
}
/** 花坛 / 树池：石框 + 土面/草 + 树。tree: 'round' | 'plane' | 'peonyBush' … */
export function planter(g, { x, z, w = 3.4, d = 3.4, kind = 'plane', th = 7, y = 0.15, grass = false, rim = 0.5 }) {
  g.add(box(w, rim, d, mat(C.stoneDark), x, y, z));
  g.add(plaza(w - 0.5, d - 0.5, mat(grass ? C.grass : C.earth), x, z, y + rim + 0.03));
  if (kind) g.add(tree(x, z, th, kind, y + rim));
}
/** 一排树池 */
export function treeRow(g, { x0, x1, z, n, kind = 'plane', th = 7, y = 0.15, size = 3.2 }) {
  for (let i = 0; i < n; i++) planter(g, { x: x0 + (x1 - x0) * (n === 1 ? 0.5 : i / (n - 1)), z, w: size, d: size, kind, th, y });
}
/** 长椅 */
export function bench(g, x, z, ry = 0, y = 0.15, len = 2.4) {
  const s = sub(g, x, y, z, ry), wood = mat(C.wood);
  s.add(box(len, 0.08, 0.5, wood, 0, 0.42, 0)); s.add(box(len, 0.4, 0.07, wood, 0, 0.6, -0.24));
  for (const sx of [-1, 1]) s.add(box(0.08, 0.42, 0.45, mat(C.black), sx * (len / 2 - 0.2), 0, 0));
}
/** 圆形喷泉：石沿 + 水面 + 中心喷柱 + 环形小喷头 */
export function fountain(g, { x = 0, z = 0, r = 7, y = 0.15 }) {
  g.add(cyl(r, r + 0.25, 0.6, mat(C.stone), x, y, z, 28));
  g.add(cyl(r - 0.5, r - 0.5, 0.52, mat(C.water), x, y + 0.12, z, 28));
  g.add(cyl(0.5, 0.9, 1.2, mat(C.stone), x, y + 0.5, z, 12));
  g.add(cyl(0.12, 0.35, 4.2, mat(0xdff3ff, { opacity: 0.8 }), x, y + 1.2, z, 8));
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.add(cyl(0.05, 0.14, 1.4, mat(0xdff3ff, { opacity: 0.8 }), x + Math.sin(a) * r * 0.62, y + 0.55, z + Math.cos(a) * r * 0.62, 6)); }
}
/** 铺装分区：基底 + 带状镶边 + 方格点缀 */
export function pavingZone(g, { x = 0, z = 0, w, d, col = C.paving, accent = 0xa9a294, y = 0.15, band = 18 }) {
  g.add(plaza(w, d, pave(col), x, z, y, 4));
  const am = mat(accent, { map: patternTex('stone', accent) });
  for (let i = 0; i <= Math.floor(d / band); i++) g.add(plaza(w, 1.2, am, x, z - d / 2 + 0.6 + i * (d - 1.2) / Math.max(1, Math.floor(d / band)), y + 0.05));
  g.add(plaza(1.2, d, am, x - w / 2 + 0.6, z, y + 0.05)); g.add(plaza(1.2, d, am, x + w / 2 - 0.6, z, y + 0.05));
}
/** 一排路灯 */
export function lampRow(g, { x0, x1, z, n, h = 8 }) { for (let i = 0; i < n; i++) g.add(lamp(x0 + (x1 - x0) * (n === 1 ? 0.5 : i / (n - 1)), z, h)); }
/** 阶梯台阶（沿 X 宽 w，向 +Z 下降） */
export function stairs(g, { x = 0, z = 0, w, n = 4, rise = 0.15, run = 0.45, y = 0 }) { for (let i = 0; i < n; i++) g.add(box(w, rise * (n - i), run, mat(C.stone), x, y, z + i * run + run / 2)); }

// ───────────── 综合：一栋商场楼 ─────────────
/**
 * 一栋商场楼体：tower(mall) + 压顶 + 腰线（逐层铝带）+ 屋面防水层 + 屋顶设备 + 底层橱窗（front/左右侧）。
 * 返回 { top, zf }。opts: shops: ['front','left','right','back']；plant: 屋顶设备参数；sky: 天窗数；belts: 是否每层加铝带
 */
export function mallBlock(g, { x = 0, z = 0, y = 0, w, d, h, floor = 5.2, bay = 6, wall = 0xe3d7b8, glass = C.glassDark, style = 'mall', cap = 0xcfc3a3, shops = ['front'], shopH = 4.8, plant = {}, sky = 0, belts = true, beltCol = COL.alu, seed = 1, deck = true, tint = null }) {
  g.add(tower(w, h, d, { style, wall, glass, bay, floor, x, y, z }));
  const nF = Math.max(1, Math.round(h / floor)), fh = h / nF, ph = Math.min(0.95, h * 0.2);
  const cm = mat(cap);      // 女儿墙压顶（四条边，不是整块盖板）
  for (const sg of [1, -1]) { g.add(box(w + 0.6, 0.28, 0.75, cm, x, y + h + ph, z + sg * (d / 2 - 0.16))); g.add(box(0.75, 0.28, d + 0.6, cm, x + sg * (w / 2 - 0.16), y + h + ph, z)); }
  if (belts) for (let f = 1; f < nF; f++) { const yy = y + f * fh - 0.3; g.add(box(w + 0.5, 0.3, d + 0.5, mat(beltCol, { shiny: true }), x, yy, z)); }
  if (deck) roofDeck(g, { x, z, w, d, y: y + h });
  const keep = [];
  if (sky) { const sw = Math.min(w * 0.5, 60), sd = Math.min(d * 0.16, 12); skylights(g, { x, z: z - d * 0.12, w: sw, d: sd, y: y + h, n: sky }); keep.push([x, z - d * 0.12, sw + 1, sd + 1]); }
  if (plant !== false) roofPlant(g, { x, z, w, d, y: y + h, seed, avoid: keep, ...plant });
  const zf = z + d / 2;
  if (shops.includes('front')) shopfront(g, { x, z: zf, w: w - 1, y, h: shopH, seed });
  if (shops.includes('back')) shopfront(g, { x, z: z - d / 2, w: w - 1, y, h: shopH, seed: seed + 3, ry: Math.PI });
  if (shops.includes('left')) shopfront(g, { x: x - w / 2, z, w: d - 1, y, h: shopH, seed: seed + 5, ry: -Math.PI / 2 });
  if (shops.includes('right')) shopfront(g, { x: x + w / 2, z, w: d - 1, y, h: shopH, seed: seed + 7, ry: Math.PI / 2 });
  return { top: y + h, zf };
}
/** 凸出的通高玻璃体（中庭 / 玻璃盒子）：玻璃 + 竖向铝框 + 每层横带 + 顶盖。朝 +Z 的正面带分格，侧面也带。 */
export function glassVolume(g, { x = 0, y = 0, z = 0, w, h, d, floor = 5.2, glass = C.glassBlue, pitch = 3, cap = true }) {
  const al = mat(COL.alu, { shiny: true }), nf = Math.max(1, Math.round(h / floor));
  g.add(box(w, h, d, mat(glass), x, y, z));
  const n = Math.max(1, Math.round(w / pitch));
  for (let i = 0; i <= n; i++) g.add(box(0.22, h, 0.34, al, x - w / 2 + i * w / n, y, z + d / 2 + 0.05));
  const m = Math.max(1, Math.round(d / pitch));
  for (const sx of [-1, 1]) for (let i = 1; i < m; i++) g.add(box(0.34, h, 0.22, al, x + sx * (w / 2 + 0.05), y, z - d / 2 + i * d / m));
  for (let k = 1; k <= nf; k++) g.add(box(w + 0.5, 0.35, d + 0.5, al, x, y + k * h / nf - 0.3, z));
  if (cap) g.add(box(w + 1, 0.8, d + 1, mat(COL.alu), x, y + h, z));
}
/** 玻璃半球穹顶：混凝土基圈 + 玻璃壳 + 钢肋（经线 + 纬圈） */
export function dome(g, { x = 0, y = 0, z = 0, r = 14, glass = C.glassBlue, ribs = 12 }) {
  g.add(cyl(r + 1.2, r + 1.5, 1.6, mat(C.concreteDark), x, y, z, 32));
  const geo = new THREE.SphereGeometry(r, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2), m = new THREE.Mesh(geo, mat(glass)); m.position.set(x, y + 1.6, z); g.add(m);
  const st = mat(C.steel);
  for (let i = 0; i < ribs; i++) {
    const a = i / ribs * Math.PI * 2;
    for (let k = 0; k < 5; k++) { const t0 = k / 5 * Math.PI / 2, t1 = (k + 1) / 5 * Math.PI / 2, rr = r + 0.15; bar(g, [x + Math.sin(a) * Math.sin(t0) * rr, y + 1.6 + Math.cos(t0) * rr, z + Math.cos(a) * Math.sin(t0) * rr], [x + Math.sin(a) * Math.sin(t1) * rr, y + 1.6 + Math.cos(t1) * rr, z + Math.cos(a) * Math.sin(t1) * rr], 0.18, st); }
  }
  for (const t of [0.45, 0.9]) g.add(cyl(r * Math.cos(t) * 0 + (r + 0.12) * Math.sin(t), (r + 0.12) * Math.sin(t), 0.2, st, x, y + 1.6 + (r + 0.12) * Math.cos(t), z, 28));
  g.add(cyl(0.3, 0.3, 4, st, x, y + 1.6 + r, z, 6));
}
/** 女儿墙压顶（四条边的薄板），y = 女儿墙顶面高度；tower() 的女儿墙高 min(0.95, h*0.2) */
export function coping(g, { x = 0, z = 0, w, d, y, col = 0xcfc3a3 }) {
  const cm = mat(col);
  for (const sg of [1, -1]) { g.add(box(w + 0.6, 0.28, 0.75, cm, x, y, z + sg * (d / 2 - 0.16))); g.add(box(0.75, 0.28, d + 0.6, cm, x + sg * (w / 2 - 0.16), y, z)); }
}
export { THREE, C, mat, box, cyl, plaza, tower, sign, tree, lamp, patternTex, rng };
