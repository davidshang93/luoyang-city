// 山陕会馆（万里茶道博物馆）— 坐北朝南，+Z=南。中轴从南到北：
// 琉璃照壁 → 铁旗杆 / 石狮 → 山门（两侧掖门）→ 舞楼（重檐歇山，台口朝北）→ 钟鼓楼（两侧）→ 月台 + 大殿（五间）→ 拜殿；两侧厢房，红墙。
// 特色：绿琉璃瓦 + 黄琉璃剪边、正脊中央脊刹，红墙。
import { THREE, C, mat, box, plaza, hall, tangRoof, gableRoof, sign, tree, patternTex, finalize } from './_kit.js';

const GREEN = 0x2f7a4a, YELLOW = C.tileYellow;
const WALL_X = 42, WALL_N = -52, WALL_S = 34;
const SIDE_GATE = 24;                                        // 东西掖门的 x

export const meta = {
  colliders: [
    { x: 0, z: 51, w: 15, d: 3 },                        // 照壁
    { x: -4.7, z: 34, w: 5.4, d: 8 }, { x: 4.7, z: 34, w: 5.4, d: 8 },     // 山门（明间 4m 门道可通行）
    ...[-1, 1].flatMap(s => [{ x: s * 14.6, z: WALL_S, w: 14.4, d: 1 }, { x: s * 34.2, z: WALL_S, w: 16, d: 1 }, { x: s * SIDE_GATE, z: WALL_S, w: 4.6, d: 2.4 }]),   // 南墙 + 掖门（关着）
    { x: -WALL_X, z: (WALL_N + WALL_S) / 2, w: 1, d: WALL_S - WALL_N },
    { x: WALL_X, z: (WALL_N + WALL_S) / 2, w: 1, d: WALL_S - WALL_N },
    { x: 0, z: WALL_N, w: WALL_X * 2, d: 1 },
    { x: 0, z: 20, w: 15.5, d: 12.5 },                   // 舞楼
    { x: -17, z: 20, w: 8, d: 8 }, { x: 17, z: 20, w: 8, d: 8 },   // 钟鼓楼
    { x: 0, z: -16, w: 25, d: 16.5 },                    // 大殿
    { x: 0, z: -3.6, w: 17, d: 8.4 },                    // 月台
    { x: 0, z: -40, w: 21, d: 13 },                      // 拜殿
    { x: -32, z: -11, w: 9, d: 37 }, { x: 32, z: -11, w: 9, d: 37 },  // 厢房
    { x: -9, z: 42, w: 2, d: 2 }, { x: 9, z: 42, w: 2, d: 2 },        // 铁旗杆座
  ],
};

// ══ LOCAL KIT START ══（kit 不导出 Batch / 歇山顶；几个精修模块各带一份同样的小工具，互不依赖）
const lerp = THREE.MathUtils.lerp, clamp = THREE.MathUtils.clamp;
const QI = [0, 1, 2, 0, 2, 3], QUV = [0, 0, 1, 0, 1, 1, 0, 1];
/** 位姿矩阵：平移 + 绕 Y 转 + 缩放（数字或 [sx,sy,sz]）+ 可选绕 X / Z 倾斜 */
const TM = (x = 0, y = 0, z = 0, ry = 0, s = 1, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
  new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(s[0], s[1], s[2]));

/** 把很多小零件攒成一个 mesh。box / cyl 的 y 是底面，sph 的 y 是球心。xf = 当前整组位姿（摆放成组小品时用）。 */
class Bat {
  constructor() { this.p = []; this.n = []; this.u = []; this.xf = null; }
  geo(g, m) {
    const s = g.index ? g.toNonIndexed() : g.clone();
    if (m) s.applyMatrix4(m);
    if (this.xf) s.applyMatrix4(this.xf);
    const P = s.attributes.position.array, N = s.attributes.normal.array, U = s.attributes.uv ? s.attributes.uv.array : null;
    for (let i = 0; i < P.length; i++) { this.p.push(P[i]); this.n.push(N[i]); }
    for (let i = 0, c = P.length / 3 * 2; i < c; i++) this.u.push(U ? U[i] : 0);
    return this;
  }
  box(w, h, d, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) { return this.geo(new THREE.BoxGeometry(w, h, d), TM(x, y + h / 2, z, ry, 1, rx, rz)); }
  cyl(rt, rb, h, x = 0, y = 0, z = 0, seg = 8, open = false) { return this.geo(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), TM(x, y + h / 2, z)); }
  sph(r, x = 0, y = 0, z = 0, seg = 8, sc = 1) { return this.geo(new THREE.SphereGeometry(r, seg, Math.max(4, seg >> 1)), TM(x, y, z, 0, sc)); }
  /** 四边形（hint = 希望朝向的大致法线，绕向不对会自动翻面） */
  quad(a, b, c, d, uv = QUV, hint) {
    let P = [a, b, c, d];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    if (hint && nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) { P = [a, d, c, b]; nx = -nx; ny = -ny; nz = -nz; uv = [uv[0], uv[1], uv[6], uv[7], uv[4], uv[5], uv[2], uv[3]]; }
    for (const i of QI) { this.p.push(P[i][0], P[i][1], P[i][2]); this.n.push(nx, ny, nz); this.u.push(uv[i * 2], uv[i * 2 + 1]); }
    return this;
  }
  addTo(grp, material, ownUV = false) {
    if (!this.p.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    if (ownUV) g.userData.ownUV = true;
    grp.add(new THREE.Mesh(g, material));
  }
}

const _roofKit = new Map();
/** 从 kit 的屋顶里取出配套材质（瓦面 / 瓦当滴水 / 椽子 / 脊 / 脊饰），自己接的屋顶和 kit 的屋顶是同一套质感 */
function roofKit(hex) {
  let t = _roofKit.get(hex); if (t) return t;
  const ms = tangRoof({ w: 12, d: 8, h: 3, material: mat(hex, { map: patternTex('roofTile', hex) }) }).children.map(c => c.material);
  t = { tile: ms[0], eave: ms[1] || ms[0], soffit: ms[2] || mat(C.darkWood), ridge: ms[4] || ms[0], orn: ms[5] || ms[4] || ms[0] };
  _roofKit.set(hex, t); return t;
}
let _chi;
function chiwenGeo() {   // 鸱吻：高 3 的单位件，尾巴朝 -x 卷
  if (_chi) return _chi;
  const s = new THREE.Shape(); s.moveTo(-0.75, 0); s.lineTo(0.75, 0); s.quadraticCurveTo(0.98, 1.4, -0.05, 2.5); s.quadraticCurveTo(-0.65, 3.0, -1.25, 2.6); s.quadraticCurveTo(-0.4, 2.1, -0.5, 1.1); s.lineTo(-0.75, 0);
  _chi = new THREE.ExtrudeGeometry(s, { depth: 0.56, bevelEnabled: false, curveSegments: 5 }); _chi.translate(0, 0, -0.28);
  return _chi;
}

/**
 * 曲面瓦屋顶，带瓦当滴水、椽子、正脊鸱吻、垂脊、戗脊脊兽、山花博风板。w × d = 檐口外包尺寸，坐在 y 上，高 h，正脊沿 X。
 * kind: 'xs' 歇山 | 'gable' 悬山 | 'hip' 庑殿（ridge = 正脊长）。band = 檐口剪边的琉璃瓦颜色。gable = 山花颜色。
 * skirt: 重檐的下檐（顶部埋进上层，不做正脊）。finial = 正脊中央脊刹的颜色（山陕会馆那种）。
 */
function cRoof({ w, d, h, kind = 'xs', t0 = 0.5, curve = 1.7, lift, roof = C.tileGrey, band, gable = C.wallRed, soffit, ridge, skirt = false, chi = true, finial, x = 0, y = 0, z = 0, ry = 0 }) {
  const K = roofKit(roof), grp = new THREE.Group(), T = 1.2, big = Math.max(w, d);
  if (kind === 'gable') t0 = 0; else if (kind === 'hip') t0 = 1;
  if (lift === undefined) lift = h * (t0 === 0 ? 0.06 : 0.2);
  const xe = t0 === 1 ? (ridge ?? Math.max(0, w - d)) / 2 : t0 === 0 ? w / 2 : Math.max(w / 2 - t0 * d / 2, w * 0.18);
  const A = (t) => (t0 > 0 ? lerp(w / 2, xe, Math.min(1, t / t0)) : xe), Bz = (t) => lerp(d / 2, 0.02, t);
  const cn = (u) => Math.pow(Math.abs(u - 0.5) * 2, 3);
  const up = (t, u) => h * Math.pow(t, curve) + lift * cn(u) * (1 - t) * (1 - t);
  const slF = Math.hypot(d / 2, h), N = 8, nLo = Math.round(N * t0), nHi = N - nLo, tsE = [], tsF = [];
  for (let k = 0; k <= nLo && nLo; k++) { tsE.push(t0 * k / nLo); tsF.push(t0 * k / nLo); }
  for (let k = nLo ? 1 : 0; k <= nHi && nHi; k++) tsF.push(t0 + (1 - t0) * k / nHi);
  // 瓦面：前后两坡（到正脊）+ 两端坡（到 t0）
  const shell = (tF, tE, dy, material) => {
    const pos = [], uv = [], idx = [];
    const grid = (ts, n, P, ax) => {
      const base = pos.length / 3;
      for (const t of ts) for (let i = 0; i <= n; i++) { const p = P(i / n, t); pos.push(p[0], p[1] + dy, p[2]); uv.push(p[ax] / T, t * slF / T); }
      for (let k = 0; k < ts.length - 1; k++) for (let i = 0; i < n; i++) { const a = base + k * (n + 1) + i; idx.push(a, a + 1, a + n + 2, a, a + n + 2, a + n + 1); }
    };
    grid(tF, 8, (u, t) => [lerp(-A(t), A(t), u), up(t, u), Bz(t)], 0);
    grid(tF, 8, (u, t) => [lerp(A(t), -A(t), u), up(t, u), -Bz(t)], 0);
    if (tE.length > 1) { grid(tE, 6, (u, t) => [A(t), up(t, u), lerp(Bz(t), -Bz(t), u)], 2); grid(tE, 6, (u, t) => [-A(t), up(t, u), lerp(-Bz(t), Bz(t), u)], 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    g.userData.ownUV = true; grp.add(new THREE.Mesh(g, material));
  };
  shell(tsF, tsE, 0, K.tile);
  if (band) { const tb = 0.8 / slF + 0.03, tl = Math.min(tb, t0 || 1); shell([0, tb / 2, tb], t0 > 0 ? [0, tl / 2, tl] : [], 0.05, roofKit(band).tile); }
  // 檐口：瓦当滴水 + 椽子 + 望板
  const fh = clamp(big * 0.008 + 0.1, 0.12, 0.24), ins = clamp(soffit ?? Math.min(w, d) * 0.2, 0.3, Math.min(w, d) / 2 - 0.05), iw = t0 > 0 ? w / 2 - ins : w / 2, id = d / 2 - ins;
  const bE = new Bat(), bS = new Bat(), bB = new Bat(), bT = new Bat(), bR = new Bat(), bO = new Bat(), bF = new Bat(), bW = new Bat(), bU = new Bat(), bY = new Bat();
  const cs = [[-w / 2, d / 2], [w / 2, d / 2], [w / 2, -d / 2], [-w / 2, -d / 2]], ic = [[-iw, id], [iw, id], [iw, -id], [-iw, -id]];
  for (let s = 0; s < 4; s++) {
    if (s % 2 && t0 === 0) continue;
    const c0 = cs[s], c1 = cs[(s + 1) % 4], i0 = ic[s], i1 = ic[(s + 1) % 4], n = 8;
    for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = (i + 1) / n, T0 = [lerp(c0[0], c1[0], u0), up(0, u0), lerp(c0[1], c1[1], u0)], T1 = [lerp(c0[0], c1[0], u1), up(0, u1), lerp(c0[1], c1[1], u1)];
      const B0 = [T0[0], T0[1] - fh, T0[2]], B1 = [T1[0], T1[1] - fh, T1[2]], a0 = s % 2 ? T0[2] : T0[0], a1 = s % 2 ? T1[2] : T1[0];
      bE.quad(B0, B1, T1, T0, [a0 / 0.6, 0, a1 / 0.6, 0, a1 / 0.6, 1, a0 / 0.6, 1]);
      const I0 = [lerp(i0[0], i1[0], u0), -0.02, lerp(i0[1], i1[1], u0)], I1 = [lerp(i0[0], i1[0], u1), -0.02, lerp(i0[1], i1[1], u1)];
      bS.quad(B0, I0, I1, B1, [a0 / 0.7, 0, a0 / 0.7, 1, a1 / 0.7, 1, a1 / 0.7, 0]);
    }
  }
  bB.quad([-iw, -0.02, -id], [iw, -0.02, -id], [iw, -0.02, id], [-iw, -0.02, id], QUV, [0, -1, 0]);
  // 脊
  const rr = clamp(big * 0.0065 + 0.07, 0.09, 0.24), rh = h * 0.07 + 0.25, th = clamp(rr * 2.2, 0.3, 0.62), V = (a, b, c) => new THREE.Vector3(a, b, c);
  const tube = (pts, seg) => bR.geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, rr, 5, false));
  if (!skirt && xe > 0.3) {                                   // 正脊 + 鸱吻（落在正脊真正的两端）
    bR.box(xe * 2 + 0.3, rh, th, 0, h - 0.12, 0); bR.box(xe * 2 + 0.45, 0.07, th + 0.12, 0, h - 0.12 + rh, 0);
    if (chi) { const c = clamp(h * 0.24 + 0.3, 0.6, 3.0) / 3; for (const sg of [1, -1]) bO.geo(chiwenGeo(), TM(sg * (xe + 0.15 - 0.55 * c), h - 0.12 + rh * 0.35, 0, sg > 0 ? 0 : Math.PI, [c, c, Math.max(c, th / 0.56 * 0.9)])); }
    if (finial) {                                               // 脊刹：正脊中央的小楼阁 + 宝瓶
      const f = clamp(h * 0.16, 0.5, 1.1), y0 = h - 0.12 + rh;
      bY.box(f * 1.5, f * 0.5, th + 0.2, 0, y0, 0); bO.box(f * 1.1, f * 0.9, th + 0.1, 0, y0 + f * 0.5, 0); bY.cyl(0.02, f * 0.95, f * 0.5, 0, y0 + f * 1.4, 0, 4);
      bY.sph(f * 0.3, 0, y0 + f * 2.1, 0, 6); bY.cyl(0.02, f * 0.12, f * 0.8, 0, y0 + f * 2.3, 0, 5);
      for (const sx of [-1, 1]) for (const k of [0.33, 0.66]) bY.box(f * 0.5, f * 0.55, th * 0.8, sx * xe * k, y0, 0);
    }
  }
  if (t0 > 0) for (const sg of [-1, 1]) for (const f of [-1, 1]) {     // 戗脊：翘角 + 脊兽
    const n = 8, tEnd = t0 * (skirt ? 0.72 : 1), pts = [];
    for (let k = 0; k <= n; k++) { const t = k / n * tEnd; pts.push(V(sg * A(t), up(t, 0) + rr * 0.45, f * Bz(t))); }
    const p0 = pts[0], p1 = pts[1], a = Math.atan2(p0.x - p1.x, p0.z - p1.z), sa = Math.sin(a), ca = Math.cos(a);
    const all = [V(p0.x + sa * rr * 3.4, p0.y + rr * 2.6, p0.z + ca * rr * 3.4), V(p0.x + sa * rr * 1.9, p0.y + rr * 0.7, p0.z + ca * rr * 1.9), ...pts], cv = new THREE.CatmullRomCurve3(all);
    bR.geo(new THREE.TubeGeometry(cv, 11, rr, 5, false)); bR.sph(rr * 1.05, all[0].x, all[0].y, all[0].z, 5);
    if (big >= 9) for (const tt of (t0 < 1 ? [0.3, 0.38, 0.46, 0.54] : [0.2, 0.25, 0.3, 0.35])) { const p = cv.getPoint(tt); bO.box(rr * 0.7, rr * (tt > 0.5 || tt === 0.35 ? 2.3 : 1.5), rr * 0.9, p.x, p.y + rr * 0.6, p.z, a); }
  }
  if (t0 < 1) {                                               // 山面：山花、博风板、悬鱼、垂脊
    const tsG = tsF.slice(nLo), edge = tsG.map(t => [Bz(t), up(t, 0)]), xw = xe - Math.min(0.55, xe * 0.3), bh = clamp(h * 0.1, 0.28, 0.6);
    const yb = edge[0][1] - (t0 > 0 ? 0.3 : 0.05), zc = t0 > 0 ? 1e9 : id + 0.25;
    for (const sg of [-1, 1]) {
      const X = sg * xw, XO = sg * (xe + 0.03), XI = sg * (xe - 0.09), out = [sg, 0, 0];
      for (let k = 0; k < edge.length - 1; k++) for (const f of [-1, 1]) {
        const [za, ya] = edge[k], [zb, yb2] = edge[k + 1], zA = Math.min(za, zc), zB = Math.min(zb, zc);
        if (zA > zB + 1e-4) bF.quad([X, yb, f * zA], [X, yb, f * zB], [X, yb2 - 0.04, f * zB], [X, ya - 0.04, f * zA], QUV, out);
        bW.quad([XO, ya - bh, f * za], [XO, yb2 - bh, f * zb], [XO, yb2 + 0.07, f * zb], [XO, ya + 0.07, f * za], QUV, out);
        bW.quad([XI, ya - bh, f * za], [XI, yb2 - bh, f * zb], [XI, yb2 + 0.07, f * zb], [XI, ya + 0.07, f * za], QUV, [-sg, 0, 0]);
        bW.quad([XO, ya - bh, f * za], [XO, yb2 - bh, f * zb], [XI, yb2 - bh, f * zb], [XI, ya - bh, f * za], QUV, [0, -1, 0]);
        bU.quad([X, ya - 0.1, f * za], [X, yb2 - 0.1, f * zb], [XI, yb2 - 0.1, f * zb], [XI, ya - 0.1, f * za], QUV, [0, -1, 0]);
      }
      bW.box(0.1, bh * 2.2, bh * 1.2, sg * (xe + 0.07), h - bh * 2.6, 0);                           // 悬鱼
      if (t0 > 0) for (let i = 0; i < 6; i++) {                                                       // 山花脚下一条瓦面收口
        const z0 = lerp(Bz(t0), -Bz(t0), i / 6), z1 = lerp(Bz(t0), -Bz(t0), (i + 1) / 6), y0 = up(t0, i / 6) - 0.01, y1 = up(t0, (i + 1) / 6) - 0.01;
        bT.quad([sg * xe, y0, z0], [sg * xe, y1, z1], [X - sg * 0.05, y1, z1], [X - sg * 0.05, y0, z0], [z0 / T, 0, z1 / T, 0, z1 / T, 0.4, z0 / T, 0.4], [0, 1, 0]);
      }
      for (const f of [-1, 1]) {                                                                      // 垂脊
        const pts = tsG.slice().reverse().map(t => V(sg * (xe - 0.28), up(t, 0) + rr * 0.45, f * Bz(t)));
        if (pts.length > 1) { tube(pts, 8); const e = pts[pts.length - 1]; bO.box(rr * 1.7, rr * 2.6, rr * 1.7, e.x, e.y - rr * 0.4, e.z); }
      }
    }
  }
  bE.addTo(grp, K.eave, true); bS.addTo(grp, K.soffit, true); bB.addTo(grp, mat(C.darkWood)); bT.addTo(grp, K.tile, true); bR.addTo(grp, K.ridge); bO.addTo(grp, K.orn);
  bF.addTo(grp, mat(gable)); bW.addTo(grp, mat(C.tangRed)); bU.addTo(grp, mat(C.darkWood)); if (finial) bY.addTo(grp, roofKit(finial).orn);
  grp.position.set(x, y, z); grp.rotation.y = ry;
  return grp;
}

/** kit 的 hall() 换上 cRoof 屋顶。roofKind: 'xs' 歇山（默认）| 'gable' 悬山 | 'hip' 庑殿 | 'kit' 原样不换；band / finial / gable 见 cRoof。 */
function hallX(o) {
  const p = { w: 24, d: 14, wallH: 6, roofH: 5, eave: 2.4, platformH: 1.2, tiers: 1, tierShrink: 0.2, roof: C.tileGrey, roofKind: 'xs', ...o };
  const g = hall({ ...p, ornaments: p.roofKind === 'kit' });
  if (p.roofKind === 'kit') return g;
  const roofs = g.children.filter(c => c.isGroup);
  roofs.forEach((r, t) => {
    const last = t === roofs.length - 1, k = Math.pow(1 - p.tierShrink, t), cw = p.w * k, cd = p.d * k;
    if (!last && !p.band) return;
    g.remove(r);
    const common = { roof: p.roof, band: p.band, gable: p.gable, soffit: p.eave + 0.15, y: r.position.y, lift: p.lift };
    g.add(last
      ? cRoof({ ...common, w: cw + (p.roofKind === 'gable' ? Math.min(p.eave, 1.0) : p.eave) * 2, d: cd + p.eave * 2, h: p.roofH, kind: p.roofKind, ridge: p.ridge ?? Math.max(0, (cw - cd) * 0.9 + cd * 0.25), finial: p.finial })
      : cRoof({ ...common, w: cw + p.eave * 2, d: cd + p.eave * 2, h: p.roofH * 0.45, kind: 'hip', ridge: cw * 0.72, skirt: true }));
  });
  return g;
}

// 小品共用的几种材质，各攒成一个 mesh
const PROPS = { stone: () => mat(C.stone), dark: () => mat(C.stoneDark), carve: () => mat(0x8f8a7e), slab: () => mat(0x5d5a54), marble: () => mat(C.marble), bronze: () => mat(C.bronze),
  gold: () => mat(C.gold), verm: () => mat(C.vermilion), lac: () => mat(C.tangRed), wood: () => mat(C.darkWood), iron: () => mat(0x2b2b2d, { shiny: true }),
  glow: () => mat(0xd02818, { emissive: 0xff3a1a, emissiveIntensity: 0.5 }), cloth: () => mat(0xc9a227, { double: true }) };
const newProps = () => Object.fromEntries(Object.keys(PROPS).map(k => [k, new Bat()]));
const flushProps = (g, P) => { for (const k in P) P[k].addTo(g, PROPS[k]()); };
const withXf = (P, m, fn) => { const prev = P.stone.xf, mm = prev ? prev.clone().multiply(m) : m; for (const k in P) P[k].xf = mm; fn(); for (const k in P) P[k].xf = prev; };   // 可嵌套

/** 石狮（蹲坐，朝 +Z）。s = 尺度；ped = 带须弥座；low = 望柱头上的小狮子（简化）。 */
function lion(P, x, y, z, s = 1, ry = 0, { ped = true, low = false, male = true } = {}) {
  withXf(P, TM(x, y, z, ry, s), () => {
    const c = P.carve; let y0 = 0;
    if (low) { c.sph(0.42, 0, 0.42, -0.1, 6, [0.9, 1, 1.15]); c.sph(0.34, 0, 1.0, 0.22, 6); c.box(0.3, 0.22, 0.26, 0, 0.78, 0.44); return; }
    if (ped) { P.dark.box(1.3, 0.22, 2.0); P.dark.box(1.02, 0.62, 1.72, 0, 0.22, 0); P.dark.box(1.3, 0.2, 2.0, 0, 0.84, 0); y0 = 1.04; }
    c.box(0.98, 0.14, 1.55, 0, y0, 0);
    c.sph(0.42, 0, y0 + 0.52, -0.34, 8, [1.05, 1, 1.15]);                         // 臀
    c.geo(new THREE.SphereGeometry(0.36, 8, 5), TM(0, y0 + 0.9, 0.08, 0, [1, 1.55, 1], -0.32));   // 躯干前倾
    for (const sx of [-1, 1]) { c.cyl(0.1, 0.13, 0.86, sx * 0.22, y0 + 0.12, 0.44, 6); c.box(0.26, 0.14, 0.34, sx * 0.22, y0 + 0.12, 0.52); }
    c.sph(0.46, 0, y0 + 1.42, 0.1, 8, [1.12, 1, 0.95]);                           // 鬃毛
    c.sph(0.33, 0, y0 + 1.5, 0.36, 8);                                            // 头
    c.box(0.34, 0.24, 0.3, 0, y0 + 1.26, 0.56);                                   // 吻
    for (const sx of [-1, 1]) c.box(0.12, 0.15, 0.08, sx * 0.25, y0 + 1.76, 0.3);
    c.sph(0.17, male ? 0.26 : -0.26, y0 + 0.31, 0.66, 6);                         // 绣球 / 幼狮
    c.sph(0.14, 0, y0 + 0.98, -0.66, 6, [1, 1.7, 1]);                             // 尾
  });
}

/** 铜香炉（三足圆炉 + 重檐炉亭），约 5m 高 × s */
function censer(P, x, z, s = 1) {
  withXf(P, TM(x, 0, z, 0, s), () => {
    const b = P.bronze;
    P.stone.box(2.3, 0.3, 2.3); P.stone.box(1.9, 0.3, 1.9, 0, 0.3, 0);
    for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.52; b.cyl(0.13, 0.09, 0.8, Math.sin(a) * 0.62, 0.6, Math.cos(a) * 0.62, 6); }
    b.sph(0.95, 0, 1.85, 0, 12, [1, 0.62, 1]); b.cyl(1.04, 0.9, 0.24, 0, 2.18, 0, 12);
    for (const sx of [-1, 1]) { b.box(0.12, 0.75, 0.42, sx * 1.04, 2.2, 0); b.box(0.3, 0.12, 0.42, sx * 0.95, 2.83, 0); }
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; b.cyl(0.045, 0.045, 0.95, Math.sin(a) * 0.66, 2.42, Math.cos(a) * 0.66, 5); }
    b.cyl(0.3, 1.2, 0.45, 0, 3.37, 0, 6); b.cyl(0.42, 0.42, 0.34, 0, 3.82, 0, 6); b.cyl(0.12, 0.82, 0.42, 0, 4.16, 0, 6);
    P.gold.sph(0.17, 0, 4.72, 0, 6);
  });
}

/** 石碑（龟趺 + 碑身 + 碑首），正面朝 +Z。h = 碑身高 */
function stele(P, x, z, h = 3, ry = 0, s = 1) {
  withXf(P, TM(x, 0, z, ry, s), () => {
    const c = P.carve;
    c.sph(0.85, 0, 0.42, 0, 8, [1, 0.6, 1.45]); c.sph(0.28, 0, 0.6, 1.3, 6); c.box(0.26, 0.3, 0.5, 0, 0.3, 1.0, 0, -0.3);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.box(0.34, 0.22, 0.42, sx * 0.8, 0, sz * 0.75);
    P.slab.box(1.15, h, 0.3, 0, 0.8, 0); P.slab.box(1.32, 0.55, 0.38, 0, 0.8 + h, 0); P.slab.box(0.95, 0.32, 0.38, 0, 1.35 + h, 0);
  });
}

/** 红灯笼，y = 挂点高度 */
function lantern(P, x, y, z, r = 0.42) {
  P.gold.cyl(r * 0.45, r * 0.45, 0.1, x, y - 0.12, z, 8); P.glow.sph(r, x, y - 0.12 - r * 0.82, z, 10, [1, 0.85, 1]);
  P.gold.cyl(r * 0.45, r * 0.45, 0.1, x, y - 0.22 - r * 1.64, z, 8); P.verm.cyl(0.03, 0.03, 0.4, x, y - 0.62 - r * 1.64, z, 4);
}

let _stud;
/** 朱漆门扇 + 金门钉 + 铺首。中心在 (x, z)，底在 y，面朝 ry 方向；both = 两面都有门钉 */
function studDoor(P, x, y, z, w, h, ry = 0, { rows = 7, cols = 5, both = false, ring = 1 } = {}) {
  if (!_stud) { _stud = new THREE.SphereGeometry(1, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2); }
  withXf(P, TM(x, y, z, ry), () => {
    P.verm.box(w, h, 0.14);
    const r = Math.min(0.08, w / cols * 0.2);
    for (const f of both ? [1, -1] : [1]) {
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) P.gold.geo(_stud, TM(((i + 0.5) / cols - 0.5) * w * 0.9, h * (0.1 + 0.84 * (j + 0.5) / rows), f * 0.07, 0, r, f * Math.PI / 2));
      if (ring) { P.gold.geo(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 8), TM(ring * (w / 2 - 0.3), h * 0.5, f * 0.09, 0, 1, Math.PI / 2)); P.gold.geo(new THREE.TorusGeometry(0.13, 0.025, 4, 8), TM(ring * (w / 2 - 0.3), h * 0.5 - 0.12, f * 0.13)); }
    }
  });
}

/** 汉白玉栏杆（沿 X 或 Z 的直线段），y = 栏杆脚的高度 */
function rail(P, x0, z0, x1, z1, y = 0) {
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 2.1)), b = P.marble;
  for (let i = 0; i <= n; i++) { const px = lerp(x0, x1, i / n), pz = lerp(z0, z1, i / n); b.box(0.2, 1.05, 0.2, px, y, pz); b.box(0.27, 0.14, 0.27, px, y + 1.05, pz); }
  b.box(Math.abs(x1 - x0) + 0.1, 0.12, Math.abs(z1 - z0) + 0.1, (x0 + x1) / 2, y + 0.78, (z0 + z1) / 2); b.box(Math.abs(x1 - x0) + 0.07, 0.5, Math.abs(z1 - z0) + 0.07, (x0 + x1) / 2, y + 0.14, (z0 + z1) / 2);
}

/** 石台阶 + 两侧垂带：从 (x, z) 处高 h 的台沿向 dir（+1 = +Z，-1 = -Z）方向走下来，宽 w */
function stairs(P, x, z, w, h, dir = 1, run = 0.32) {
  const n = Math.max(2, Math.round(h / 0.16)), L = n * run, b = P.stone;
  for (let i = 0; i < n; i++) b.box(w, h * (1 - i / n), run, x, 0, z + dir * run * (i + 0.5));
  for (const sx of [-1, 1]) b.box(0.42, 0.3, Math.hypot(L, h) + 0.2, x + sx * (w / 2 + 0.21), h / 2 - 0.1, z + dir * L / 2, 0, dir * Math.atan2(h, L));
}
// ══ LOCAL KIT END ══

// ───────── 本模块 ─────────
/** 琉璃照壁：石须弥座 + 绿琉璃壁身（三堵：中间二龙戏珠团花，两侧菱形花）+ 黄琉璃边框 + 斗拱檐 + 绿瓦黄剪边顶。前后两面一样。 */
function zhaobi(g, P, Z) {
  const W = 13, glaze = roofKit(GREEN).tile, yel = P.yel, grn = P.grn, blu = P.blu;
  P.stone.box(15, 0.5, 3.0, 0, 0, Z); P.carve.box(14.2, 0.5, 2.5, 0, 0.5, Z); P.stone.box(14.6, 0.4, 2.8, 0, 1.0, Z);
  for (let i = 0; i < 14; i++) for (const f of [-1, 1]) P.carve.box(0.5, 0.36, 0.12, -6.5 + i, 0.57, Z + f * 1.28);     // 束腰上的小浮雕
  g.add(box(W, 6.0, 1.9, glaze, 0, 1.4, Z));
  for (const f of [-1, 1]) {
    const fz = Z + f * 0.96, at = (x, y, dz = 0) => [x, y, fz + f * dz];
    // 边框 + 三堵分隔
    yel.box(W, 0.4, 0.14, 0, 1.4, fz); yel.box(W, 0.4, 0.14, 0, 7.0, fz);
    for (const x of [-6.3, -2.6, 2.6, 6.3]) yel.box(0.4, 6.0, 0.14, x, 1.4, fz);
    for (let i = 0; i < 16; i++) grn.box(0.42, 0.42, 0.2, -6 + i * 0.8, 6.5, fz, 0, 0, Math.PI / 4);                    // 上沿一排小花砖
    // 中堵：圆形团花，二龙戏珠
    yel.geo(new THREE.TorusGeometry(2.05, 0.16, 5, 28), TM(0, 4.3, fz + f * 0.05)); blu.geo(new THREE.CylinderGeometry(1.95, 1.95, 0.1, 28), TM(0, 4.3, fz + f * 0.02, 0, 1, Math.PI / 2));
    for (const s of [-1, 1]) {
      const pts = [[0.35, 0.9], [1.25, 0.75], [1.35, -0.1], [0.55, -0.45], [0.75, -1.2], [-0.2, -1.35]].map(([x, y]) => new THREE.Vector3(s * x, 4.3 + s * y, fz + f * 0.16));
      yel.geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.15, 5, false)); yel.sph(0.24, ...at(s * 0.3, 4.3 + s * 1.0, 0.18), 6);
    }
    P.gold.sph(0.3, ...at(0, 4.3, 0.2), 8);
    for (const [cx, cy] of [[-1.9, 2.3], [1.9, 2.3], [-1.9, 6.2], [1.9, 6.2]]) grn.box(0.7, 0.7, 0.2, cx, cy - 0.35, fz, 0, 0, Math.PI / 4);
    // 两侧堵：菱形花 + 四角岔角
    for (const s of [-1, 1]) {
      const cx = s * 4.45;
      yel.box(1.9, 1.9, 0.16, cx, 3.35, fz, 0, 0, Math.PI / 4); blu.box(1.3, 1.3, 0.22, cx, 3.65, fz, 0, 0, Math.PI / 4); P.gold.sph(0.22, ...at(cx, 4.3, 0.14), 6);
      for (const [dx, dy] of [[-1.2, -1.9], [1.2, -1.9], [-1.2, 1.9], [1.2, 1.9]]) grn.box(0.5, 0.5, 0.2, cx + dx, 4.05 + dy, fz, 0, 0, Math.PI / 4);
    }
  }
  // 檐下：额枋 + 斗拱 + 顶
  P.lac.box(W + 0.5, 0.4, 2.1, 0, 7.4, Z);
  for (let i = 0; i <= 12; i++) { const x = -W / 2 + 0.3 + i * (W - 0.6) / 12; yel.box(0.7, 0.22, 2.6, x, 7.8, Z); grn.box(0.36, 0.2, 3.0, x, 8.02, Z); }
  P.wood.box(W + 1, 0.2, 2.6, 0, 8.22, Z);
  g.add(cRoof({ w: W + 2.8, d: 4.4, h: 1.5, kind: 'hip', ridge: W - 1, roof: GREEN, band: YELLOW, finial: YELLOW, soffit: 1.0, lift: 0.35, y: 8.42, z: Z }));
}

/** 铁旗杆：石座 + 铁杆 + 三层斗 + 盘龙（铁环）+ 顶珠 + 小旗 */
function ironPole(P, x, z) {
  P.stone.box(2.0, 0.7, 2.0, x, 0, z); P.stone.box(1.5, 0.5, 1.5, x, 0.7, z);
  P.iron.cyl(0.14, 0.26, 17, x, 1.2, z, 10);
  for (const y of [6.5, 10.5, 14]) { P.iron.cyl(0.6, 0.3, 0.5, x, y, z, 4); P.iron.box(1.2, 0.08, 1.2, x, y + 0.5, z); }
  for (let i = 0; i < 9; i++) P.iron.geo(new THREE.TorusGeometry(0.3, 0.07, 4, 8), TM(x, 2.2 + i * 0.42, z, i * 0.7, 1, Math.PI / 2 + 0.35));
  P.gold.sph(0.3, x, 18.4, z, 8); P.iron.cyl(0.02, 0.1, 0.5, x, 18.6, z, 5);
  P.verm.box(1.5, 0.9, 0.04, x + Math.sign(x) * 0.95, 15.4, z);
}

export function build() {
  const g = new THREE.Group(), P = newProps();
  P.yel = new Bat(); P.grn = new Bat(); P.blu = new Bat();
  const redWall = mat(C.wallRed), brick = mat(C.brickGrey), green = mat(GREEN, { map: patternTex('roofTile', GREEN) });
  const pave = mat(C.paving, { map: patternTex('paving', C.paving) });
  const GH = (o) => g.add(hallX({ roof: GREEN, band: YELLOW, wall: C.wallRed, column: C.tangRed, ...o }));
  const board = (t, x, y, z, w = 3.4, ry = 0) => g.add(sign(t, w, w * 0.36, { bg: '#1f3c5e', fg: '#f0cf6a', border: '#d4a93a', x, y, z, ry }));

  zhaobi(g, P, 51);
  for (const s of [-1, 1]) { ironPole(P, s * 9, 42); lion(P, s * 5.2, 0, 40.6, 1.25, 0, { male: s > 0 }); }

  // ── 山门（三间，明间门道敞开，两次间朱漆金钉门）
  {
    const z = 34, w = 14, d = 7, h = 5, ph = 0.9, bay = w / 3, fz = z + 0.6, dh = 3.6, lw = (bay - 0.6) / 2 - 0.04;
    P.stone.box(w + 2.4, ph, d + 2.4, 0, 0, z); stairs(P, 0, z + d / 2 + 1.2, bay + 1.5, ph, 1); stairs(P, 0, z - d / 2 - 1.2, bay + 1.5, ph, -1);
    for (const sx of [-1, 1]) g.add(box(0.6, h, d - 0.8, redWall, sx * (w / 2 - 0.3), ph, z));
    for (let i = 0; i < 3; i++) { const cx = (i - 1) * bay; g.add(box(bay - 0.5, h - dh - 0.3, 0.3, redWall, cx, ph + dh + 0.3, fz)); P.wood.box(bay - 0.3, 0.3, 0.5, cx, ph + dh, fz); }
    for (const sx of [-1, 1]) {
      g.add(box(0.5, dh, 0.5, mat(C.tangRed), sx * bay / 2, ph, fz));
      for (const lx of [-1, 1]) studDoor(P, sx * bay + lx * (bay - 0.6) / 4, ph, fz, lw, dh, 0, { rows: 7, cols: 5, both: true, ring: -lx });
      studDoor(P, sx * (bay / 2 - 0.32), ph, fz - lw / 2 - 0.12, lw, dh, -sx * Math.PI / 2, { rows: 7, cols: 5, both: true, ring: -sx });
      P.carve.box(0.5, 0.5, 1.0, sx * (bay / 2 - 0.25), ph, fz); P.carve.geo(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10), TM(sx * (bay / 2 - 0.25), ph + 0.85, fz + 0.5, 0, 1, 0, Math.PI / 2));
      lantern(P, sx * bay / 2, ph + h - 0.7, z + d / 2 + 0.5, 0.42);
    }
    for (let i = 0; i <= 3; i++) for (const zz of [z + d / 2 - 0.25, z - d / 2 + 0.25]) { P.lac.cyl(0.26, 0.3, h, -w / 2 + i * bay, ph, zz, 10); P.stone.box(0.8, 0.16, 0.8, -w / 2 + i * bay, ph, zz); }
    for (const zz of [z + d / 2 - 0.25, z - d / 2 + 0.25]) { P.lac.box(w, 0.42, 0.3, 0, ph + h - 0.5, zz); P.blu.box(w - 0.3, 0.28, 0.22, 0, ph + h - 0.8, zz); P.wood.box(w + 0.4, 0.3, 0.5, 0, ph + h - 0.08, zz); }
    for (let i = 0; i <= 6; i++) for (const zz of [z + d / 2 - 0.25, z - d / 2 + 0.25]) { const x = -w / 2 + i * bay / 2; P.wood.box(0.85, 0.2, 0.32, x, ph + h + 0.22, zz); P.wood.box(0.32, 0.2, 1.2, x, ph + h + 0.22, zz); }
    P.wood.box(w + 0.6, 0.3, d + 0.2, 0, ph + h + 0.42, z);
    g.add(cRoof({ w: w + 3.8, d: d + 3.8, h: 3.7, roof: GREEN, band: YELLOW, finial: YELLOW, soffit: 2.0, y: ph + h + 0.72, z }));
    board('山陕会馆', 0, ph + dh + 0.95, fz + 0.2, 3.6);
    g.add(sign('万里茶道博物馆', 4.2, 0.7, { bg: '#f2ede0', fg: '#3a2a1a', border: '#8a6a3a', vertical: true, x: w / 2 + 1.6, y: 3.0, z: WALL_S + 0.55 }));
  }

  // ── 围墙（红墙绿瓦压顶）+ 东西掖门
  const wallSeg = (x, z, L, ry = 0) => { g.add(box(L, 0.8, 1.0, brick, x, 0, z, ry)); g.add(box(L, 4.2, 0.8, redWall, x, 0.8, z, ry)); g.add(box(L + 0.1, 0.22, 1.3, brick, x, 5, z, ry)); g.add(gableRoof(L + 0.3, 1.9, 0.6, green, x, 5.22, z, ry)); };
  for (const s of [-1, 1]) {
    wallSeg(s * 14.6, WALL_S, 14.4); wallSeg(s * 34.2, WALL_S, 16);
    wallSeg(s * WALL_X, (WALL_N + WALL_S) / 2, WALL_S - WALL_N, Math.PI / 2);
    const x = s * SIDE_GATE;                                  // 掖门：砖门楼，绿瓦小顶，门关着
    for (const k of [-1, 1]) g.add(box(0.9, 5.4, 2.0, brick, x + k * 1.85, 0, WALL_S));
    g.add(box(2.8, 1.5, 1.2, redWall, x, 3.9, WALL_S)); P.wood.box(3.0, 0.3, 1.4, x, 3.6, WALL_S);
    for (const k of [-1, 1]) studDoor(P, x + k * 0.7, 0.15, WALL_S + 0.3, 1.36, 3.45, 0, { rows: 6, cols: 4, ring: -k });
    g.add(cRoof({ w: 6.4, d: 4.0, h: 1.5, kind: 'gable', roof: GREEN, band: YELLOW, soffit: 0.9, y: 5.4, x, z: WALL_S }));
  }
  wallSeg(0, WALL_N, WALL_X * 2);

  // ── 舞楼（戏楼，重檐歇山，高台；台口朝北面向大殿）
  GH({ w: 12, d: 9, wallH: 4.5, roofH: 4.2, eave: 2, platformH: 2.6, tiers: 2, tierShrink: 0.15, z: 20, ry: Math.PI, steps: false, finial: YELLOW });
  board('舞楼', 0, 6.3, 20 - 4.8, 2.8, Math.PI);
  for (const s of [-1, 1]) { rail(P, s * 1.0, 20 - 5.9, s * 7.2, 20 - 5.9, 2.6); stairs(P, s * 8.4, 21.5, 1.6, 2.6, 1, 0.3); lantern(P, s * 2.1, 2.6 + 4.5 - 0.6, 20 - 5.4, 0.42); }

  // ── 钟鼓楼（两侧，二层小楼）
  for (const s of [-1, 1]) GH({ w: 5, d: 5, wallH: 3.6, roofH: 2.8, eave: 1.3, platformH: 2.4, tiers: 2, tierShrink: 0.12, x: s * 17, z: 20, steps: false });

  // ── 厢房（两侧，悬山，面向院内）
  for (const s of [-1, 1]) GH({ w: 34, d: 6.5, wallH: 4, roofH: 2.8, eave: 1.4, platformH: 0.6, x: s * 32, z: -11, ry: -s * Math.PI / 2, steps: false, roofKind: 'gable' });

  // ── 大殿（面阔五间）+ 前月台（栏杆、踏步、香炉、石狮）
  GH({ w: 22, d: 12.5, wallH: 6.5, roofH: 5.2, eave: 2.2, platformH: 1.4, z: -16, finial: YELLOW });
  board('大殿', 0, 1.4 + 6.5 - 0.9, -16 + 6.25 + 0.25);
  {
    const tw = 17, th = 1.2, z0 = -7.4, z1 = 0.2;
    P.stone.box(tw, th, z1 - z0, 0, 0, (z0 + z1) / 2); P.stone.box(tw + 0.24, 0.14, z1 - z0 + 0.24, 0, th - 0.14, (z0 + z1) / 2);
    stairs(P, 0, z1, 5, th, 1);
    for (const s of [-1, 1]) { rail(P, s * (tw / 2 - 0.2), z0 + 0.4, s * (tw / 2 - 0.2), z1 - 0.2, th); rail(P, s * 2.9, z1 - 0.2, s * (tw / 2 - 0.2), z1 - 0.2, th); lion(P, s * 4.6, 0, z1 + 1.6, 0.8, 0, { male: s > 0 }); lantern(P, s * 2.2, 1.4 + 6.5 - 0.7, -16 + 6.25 + 0.9, 0.42); }
    withXf(P, TM(0, th, 0), () => censer(P, 0, -2.6, 0.75));
  }

  // ── 拜殿（后）
  GH({ w: 18, d: 9.5, wallH: 5.5, roofH: 4.4, eave: 2, platformH: 1.0, z: -40 });
  board('拜殿', 0, 1.0 + 5.5 - 0.9, -40 + 4.75 + 0.25, 3.0);

  // ── 院内铺地、碑、树
  g.add(plaza(56, 52, pave, 0, 6, 0.15, 3));
  g.add(plaza(40, 20, pave, 0, 45, 0.15, 3));
  g.add(plaza(5, 60, mat(C.stone, { map: patternTex('stone', C.stone) }), 0, 6, 0.2, 3));
  for (const s of [-1, 1]) { stele(P, s * 12, 9, 2.6, -s * Math.PI / 2); stele(P, s * 12, 3.5, 2.4, -s * Math.PI / 2); }
  for (const [x, z] of [[-21, 6], [21, 6], [-14, -30], [14, -30], [-37, 43], [37, 43], [-30, 49], [30, 49]]) g.add(tree(x, z, 10, 'round'));
  for (const [x, z] of [[-24, -47], [24, -47], [-37, 27], [37, 27], [-22, 27], [22, 27]]) g.add(tree(x, z, 11, 'cypress'));

  P.yel.addTo(g, mat(0xd9a531, { shiny: true, key: 'glz' })); P.grn.addTo(g, mat(0x2f8a55, { shiny: true, key: 'glz' })); P.blu.addTo(g, mat(0x1f6b73));
  delete P.yel; delete P.grn; delete P.blu;
  flushProps(g, P);
  return finalize(g);
}
