// 关林 — 武圣陵庙。+Z = 南：舞楼 → 大门（八字墙“忠义/仁勇”、金门钉）→ 钟鼓楼 → 仪门 → 石狮甬道 → 月台/拜殿/大殿 → 二殿 → 三殿 → 石坊 → 八角碑亭 → 关冢（-Z 端）。
import { THREE, C, mat, box, plaza, gableRoof, tangRoof, roundRoof, hall, patternTex, sign, tree, rng, finalize } from './_kit.js';

const EAVE = 2.4;
const WALL_T = 1.2;
const WX = 80, WZF = 150, WZB = -207;
const GREEN = C.tileGreen, YELLOW = C.tileYellow;
const GATES = [
  { name: '关林', z: WZF, w: 26, d: 10, h: 7, bays: 5, band: YELLOW },
  { name: '威扬六合', z: 110, w: 17, d: 8, h: 6, bays: 3 },
];
const HALLS = [
  { name: '拜殿', z: 20, w: 26, d: 9, wallH: 6, roofH: 4.5, band: YELLOW },
  { name: '启圣殿', z: -2, w: 32, d: 18, wallH: 8, roofH: 7.5, platformH: 1.6, roofKind: 'hip', band: YELLOW },
  { name: '财神殿', z: -46, w: 26, d: 14, wallH: 6.5, roofH: 5.5 },
  { name: '春秋殿', z: -86, w: 24, d: 12, wallH: 6, roofH: 5, roofKind: 'gable' },
  ...[2, -46].flatMap(z => [-1, 1].map(s => ({ x: s * 42, z, w: 26, d: 8, wallH: 4.5, roofH: 3.4, ry: -s * Math.PI / 2, roofKind: 'gable' }))),
];
const STAGE = { z: 186, w: 16, d: 12, baseH: 2.2 };
const TOWERS = [{ x: 34, z: 128 }, { x: -34, z: 128 }];
const TERRACE = { z: 30.5, w: 20, d: 8.6, h: 1.0 };          // 拜殿前月台
const PAV = { z: -130 };
const TOMB = { z: -178, r: 25, h: 10 };
const BAZI = [-1, 1].map(s => ({ x: s * 17.3, z: WZF + 7.8, w: 8, d: 1.3, rot: -s * 0.6 }));
const WALLS = [
  [-WX, WZF, -GATES[0].w / 2, WZF], [GATES[0].w / 2, WZF, WX, WZF],
  [-WX, WZF, -WX, WZB], [WX, WZF, WX, WZB], [-WX, WZB, WX, WZB],
];

const hallFoot = (h) => {
  const w = h.w + EAVE * 1.3, d = h.d + EAVE * 1.3;
  return h.ry ? { x: h.x || 0, z: h.z, w: d, d: w } : { x: h.x || 0, z: h.z, w, d };
};
const wallCol = ([x1, z1, x2, z2]) => z1 === z2
  ? { x: (x1 + x2) / 2, z: z1, w: Math.abs(x2 - x1), d: WALL_T }
  : { x: x1, z: (z1 + z2) / 2, w: WALL_T, d: Math.abs(z2 - z1) };
const gateCols = (G) => { const open = G.w / G.bays, sw = (G.w - open) / 2; return [-1, 1].map(s => ({ x: s * (open / 2 + sw / 2), z: G.z, w: sw, d: G.d })); };

export const meta = {
  colliders: [
    ...HALLS.map(hallFoot),
    ...GATES.flatMap(gateCols),
    ...WALLS.map(wallCol),
    ...BAZI,
    { x: 0, z: STAGE.z, w: STAGE.w, d: STAGE.d },
    ...TOWERS.map(t => ({ x: t.x, z: t.z, w: 8, d: 8 })),
    { x: 0, z: TERRACE.z, w: TERRACE.w, d: TERRACE.d },
    { x: 0, z: 10.4, w: 30, d: 6 },
    ...[-1, 1].map(s => ({ x: s * 4.2, z: 73, w: 0.5, d: 62 })),       // 甬道石栏
    ...[-7.5, -2.5, 2.5, 7.5].map(x => ({ x, z: -110, w: 1.1, d: 2.6 })),                 // 石坊四柱
    { x: 0, z: PAV.z, w: 2.4, d: 2.4 },
    { x: 0, z: TOMB.z, w: 50, d: 32 }, { x: 0, z: TOMB.z, w: 32, d: 50 },
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
const roofMat = (c = C.tileGrey) => mat(c, { map: patternTex('roofTile', c) });
const BRICK = 0x9a968e;

function wallSeg(g, [x1, z1, x2, z2], h = 4.5) {
  const horiz = z1 === z2, L = horiz ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, ry = horiz ? 0 : Math.PI / 2;
  g.add(box(L, 0.8, WALL_T + 0.2, mat(C.brickGrey), cx, 0, cz, ry));
  g.add(box(L, h - 0.8, WALL_T, mat(C.wallRed), cx, 0.8, cz, ry));
  g.add(box(L + 0.1, 0.25, WALL_T + 0.6, mat(C.brickGrey), cx, h, cz, ry));
  g.add(gableRoof(L + 0.3, WALL_T + 1.2, 0.7, roofMat(GREEN), cx, h + 0.25, cz, ry));
}

/** 门殿：明间是通道（门扇向内敞开），左右次间是关着的朱漆金钉大门，五间的尽间是红墙；歇山绿琉璃顶。 */
function gateHall(g, P, G) {
  const { z, w, d, h, bays } = G, bay = w / bays, ph = 0.5, fz = z + 0.8, dh = Math.min(4.4, h - 1.9), i0 = (bays - 3) / 2;
  const red = mat(C.wallRed), lw = (bay - 0.6) / 2 - 0.04;
  P.stone.box(w + 2.6, ph, d + 2.6, 0, 0, z);
  stairs(P, 0, z + d / 2 + 1.3, bay * 3, ph, 1); stairs(P, 0, z - d / 2 - 1.3, bay * 3, ph, -1);
  for (const sx of [-1, 1]) g.add(box(0.7, h, d - 0.8, red, sx * (w / 2 - 0.35), ph, z));
  for (let i = 0; i < bays; i++) {
    const cx = -w / 2 + (i + 0.5) * bay, k = i - i0;
    g.add(box(bay - 0.5, h - dh - 0.3, 0.3, red, cx, ph + dh + 0.3, fz)); P.wood.box(bay - 0.3, 0.3, 0.5, cx, ph + dh, fz);
    if (k < 0 || k > 2) { g.add(box(bay - 0.5, dh, 0.5, red, cx, ph, fz)); g.add(box(bay - 1.6, dh - 1.8, 0.62, mat(C.brickGrey), cx, ph + 0.9, fz)); }
    else if (k === 1) for (const sx of [-1, 1]) studDoor(P, sx * (bay / 2 - 0.32), ph, fz - lw / 2 - 0.12, lw, dh, -sx * Math.PI / 2, { rows: 9, cols: 7, both: true, ring: -sx });
    else for (const lx of [-1, 1]) studDoor(P, cx + lx * (bay - 0.6) / 4, ph, fz, lw, dh, 0, { rows: 9, cols: 7, ring: -lx });
    if (k >= 0 && k <= 2) for (const sx of [-1, 1]) { P.carve.box(0.5, 0.5, 1.0, cx + sx * (bay / 2 - 0.3), ph, fz); P.carve.geo(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 10), TM(cx + sx * (bay / 2 - 0.3), ph + 0.85, fz + 0.5, 0, 1, 0, Math.PI / 2)); }
  }
  for (let i = 1; i < bays; i++) g.add(box(0.5, dh, 0.5, mat(C.tangRed), -w / 2 + i * bay, ph, fz));
  for (let i = 0; i <= bays; i++) for (const zz of [z + d / 2 - 0.25, z - d / 2 + 0.25]) { P.lac.cyl(0.28, 0.33, h, -w / 2 + i * bay, ph, zz, 10); P.stone.box(0.9, 0.16, 0.9, -w / 2 + i * bay, ph, zz); }
  for (const zz of [z + d / 2 - 0.25, z - d / 2 + 0.25]) { P.lac.box(w, 0.44, 0.3, 0, ph + h - 0.52, zz); P.teal.box(w - 0.3, 0.3, 0.22, 0, ph + h - 0.84, zz); P.wood.box(w + 0.5, 0.3, 0.6, 0, ph + h - 0.08, zz); }
  for (let i = 0; i <= bays * 2; i++) for (const zz of [z + d / 2 - 0.25, z - d / 2 + 0.25]) { const x = -w / 2 + i * bay / 2; P.wood.box(0.9, 0.2, 0.34, x, ph + h + 0.22, zz); P.wood.box(0.34, 0.2, 1.3, x, ph + h + 0.22, zz); }
  P.wood.box(w + 0.6, 0.3, d + 0.2, 0, ph + h + 0.42, z);
  g.add(cRoof({ w: w + 4.8, d: d + 4.8, h: h * 0.7, roof: GREEN, band: G.band, soffit: 2.5, y: ph + h + 0.72, z }));
  for (const k of bays > 3 ? [-1.5, -0.5, 0.5, 1.5] : [-0.5, 0.5]) lantern(P, k * bay, ph + h - 0.9, z + d / 2 + 0.6, 0.45);
  const sw = Math.min(G.name.length > 2 ? 4.6 : 3.6, bay * 0.95);
  g.add(sign(G.name, sw, 1.3, { bg: '#1d2f4f', fg: '#e8c45a', border: '#c9a227', x: 0, y: ph + dh + 0.3 + (h - dh - 0.3) / 2, z: fz + 0.2 }));
}

/** 舞楼（戏台）：高砖台，台口朝北（-Z）面向大门，后墙朝南。 */
function stage(g, P) {
  const { z, w, d, baseH } = STAGE, y = baseH + 0.2, ch = 5, zf = z - d / 2 + 0.7, zb = z + d / 2 - 0.6;
  const red = mat(C.wallRed);
  g.add(box(w, baseH, d, mat(BRICK, { map: patternTex('brick', BRICK) }), 0, 0, z));
  P.stone.box(w + 0.5, 0.3, d + 0.5, 0, baseH - 0.1, z);
  g.add(box(w - 1, ch, 0.5, red, 0, y, zb));                                           // 后墙（南）
  for (const sx of [-1, 1]) g.add(box(0.5, ch, d * 0.5, red, sx * (w / 2 - 0.75), y, zb - d * 0.25));
  g.add(box(w - 2.4, ch * 0.82, 0.25, mat(0x7a2a20), 0, y, z + 1.2));                  // 屏风：出将 / 入相
  for (const sx of [-1, 1]) { P.wood.box(1.5, 2.6, 0.3, sx * (w / 2 - 3.2), y, z + 1.18); P.cloth.box(1.3, 2.2, 0.05, sx * (w / 2 - 3.2), y + 0.2, z + 1.0); }
  for (let i = 0; i <= 3; i++) for (const zz of [zf, zb]) { const x = -w / 2 + 0.8 + i * (w - 1.6) / 3; P.lac.cyl(0.26, 0.3, ch, x, y, zz, 10); P.stone.box(0.8, 0.16, 0.8, x, y, zz); }
  for (const zz of [zf, zb]) { P.lac.box(w - 1, 0.44, 0.3, 0, y + ch - 0.52, zz); P.teal.box(w - 1.3, 0.3, 0.22, 0, y + ch - 0.84, zz); }
  for (const sx of [-1, 1]) P.lac.box(0.3, 0.44, d - 1.3, sx * (w / 2 - 0.8), y + ch - 0.52, z);
  P.wood.box(w + 0.4, 0.4, d + 0.4, 0, y + ch - 0.06, z);
  for (let i = 0; i <= 6; i++) { const x = -w / 2 + 0.8 + i * (w - 1.6) / 6; P.wood.box(0.9, 0.2, 0.34, x, y + ch + 0.3, zf); P.wood.box(0.34, 0.2, 1.3, x, y + ch + 0.3, zf); }
  // 台口矮栏 + 两侧上台的台阶
  for (const sx of [-1, 1]) { rail(P, sx * 1.6, zf - 0.5, sx * (w / 2 - 0.3), zf - 0.5, baseH + 0.2); stairs(P, sx * (w / 2 + 1.0), z + 2.2, 1.8, baseH, 1, 0.3); }
  g.add(cRoof({ w: w + 3.8, d: d + 3.8, h: 4.4, roof: GREEN, band: YELLOW, soffit: 2.0, y: y + ch + 0.5, z }));
  for (const k of [-1, 1]) lantern(P, k * (w - 1.6) / 6, y + ch - 0.9, zf - 0.4, 0.45);
  g.add(sign('千秋鉴', 3.6, 1.2, { bg: '#1d2f4f', fg: '#e8c45a', border: '#c9a227', x: 0, y: y + ch - 1.2, z: zf - 0.3, ry: Math.PI }));
  // 后墙（朝南临街）：青砖下碱 + 砖雕团花
  g.add(box(w - 0.9, 1.2, 0.62, mat(C.brickGrey), 0, y, zb));
  P.carve.geo(new THREE.CylinderGeometry(1.7, 1.7, 0.2, 20), TM(0, y + 3.0, zb + 0.28, 0, 1, Math.PI / 2)); P.dark.geo(new THREE.CylinderGeometry(1.25, 1.25, 0.26, 20), TM(0, y + 3.0, zb + 0.28, 0, 1, Math.PI / 2));
}

function bellTower(g, P, x, z) {
  g.add(box(8, 4.5, 8, mat(BRICK, { map: patternTex('brick', BRICK) }), x, 0, z));
  P.stone.box(8.4, 0.3, 8.4, x, 4.4, z); P.wood.box(2.0, 2.8, 0.2, x, 0, z + 4.02); P.dark.box(2.6, 0.3, 0.3, x, 2.8, z + 4.05);
  g.add(hallX({ w: 6, d: 6, wallH: 3.2, roofH: 3.2, eave: 1.5, platformH: 0.3, steps: false, roof: GREEN, x, y: 4.6, z }));
}

function pavilion(g, P) {
  const z = PAV.z;
  P.stone.cyl(6.6, 6.9, 0.9, 0, 0, z, 8); P.stone.cyl(6.75, 6.75, 0.14, 0, 0.86, z, 8);
  stairs(P, 0, z + 6.3, 3, 0.9, 1); stairs(P, 0, z - 6.3, 3, 0.9, -1);
  for (let i = 0; i < 8; i++) { const a = (i + 0.5) * Math.PI / 4, cx = Math.cos(a) * 4.8, cz = z + Math.sin(a) * 4.8; P.lac.cyl(0.26, 0.3, 5, cx, 1.0, cz, 10); P.stone.cyl(0.42, 0.46, 0.18, cx, 1.0, cz, 8); }
  P.lac.cyl(5.25, 5.25, 0.45, 0, 5.3, z, 8, true); P.teal.cyl(5.2, 5.2, 0.3, 0, 5.0, z, 8, true); P.wood.cyl(5.5, 5.3, 0.5, 0, 5.75, z, 8);
  g.add(roundRoof({ r: 7, h: 2.2, sides: 8, material: roofMat(YELLOW), y: 6.25, z, finial: false }));
  P.lac.cyl(4.2, 4.2, 1.3, 0, 7.5, z, 8, true); P.wood.cyl(4.45, 4.3, 0.3, 0, 8.6, z, 8);
  g.add(roundRoof({ r: 5.8, h: 3.6, sides: 8, material: roofMat(YELLOW), y: 8.9, z }));
  stele(P, 0, z, 3.2, 0, 1.2);
  g.add(sign('忠义神武关圣大帝林', 3.4, 0.95, { bg: '#5d5a54', fg: '#e8dcc0', vertical: true, x: 0, y: 2.9, z: z + 0.2 }));
}

/** 石坊：四柱三间三楼，柱前后抱鼓石，柱头小石狮。 */
function paifang(g, P, z, W = 15, H = 7.2, text) {
  const c = P.carve, xs = [-W / 2, -W / 6, W / 6, W / 2], rm = mat(C.stoneDark);
  xs.forEach((px, i) => {
    const hh = i === 0 || i === 3 ? H - 1.3 : H;
    c.box(0.75, hh, 0.75, px, 0, z); c.box(1.1, 0.5, 2.6, px, 0, z);
    for (const f of [-1, 1]) { c.geo(new THREE.CylinderGeometry(0.62, 0.62, 0.32, 12), TM(px, 1.1, z + f * 0.95, 0, 1, 0, Math.PI / 2)); c.box(0.4, 0.5, 0.5, px, 0.5, z + f * 0.95); }
  });
  c.box(W + 0.6, 0.7, 0.6, 0, H - 3.4, z); c.box(W + 0.6, 0.45, 0.66, 0, H - 2.1, z); c.box(W / 3 + 0.6, 0.6, 0.6, 0, H - 0.9, z);
  P.slab.box(W / 3 - 0.9, 0.9, 0.4, 0, H - 1.75, z); for (const sx of [-1, 1]) P.slab.box(W / 3 - 0.9, 0.55, 0.4, sx * W / 3, H - 2.65, z);
  for (const px of xs) for (const f of [-1, 1]) c.box(0.5, 0.3, 0.9, px, H - 3.75, z + f * 0.5);                 // 雀替
  g.add(tangRoof({ w: W / 3 + 2.6, d: 2.8, h: 1.3, material: rm, y: H - 0.2, z, soffit: 0.9 }));
  for (const sx of [-1, 1]) g.add(tangRoof({ w: W / 3 + 1.6, d: 2.4, h: 1.0, material: rm, x: sx * (W / 3 + 0.2), y: H - 1.55, z, soffit: 0.8 }));
  if (text) g.add(sign(text, W / 3 - 1.1, 0.8, { bg: '#5d5a54', fg: '#e8dcc0', x: 0, y: H - 1.3, z: z + 0.22 }));
}

function tomb(g, P, r) {
  const { z, r: R, h } = TOMB, brick = 0x8e8a80;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R + 0.25, 2.6, 48, 1, true), mat(brick, { map: patternTex('brick', brick), double: true, key: 'tombwall' }));
  wall.position.set(0, 1.3, z); g.add(wall);
  P.dark.cyl(R + 0.35, R + 0.35, 0.3, 0, 2.6, z, 48); P.dark.cyl(R + 0.5, R + 0.5, 0.5, 0, 0, z, 48, true);
  const prof = (rr) => { const u = rr / (R - 0.6); return 2.7 + (h - 2.7) * Math.pow(Math.max(0, 1 - Math.pow(u, 2.2)), 0.7); }; // 穹顶形土丘
  const pts = [];
  for (let k = 0; k <= 10; k++) { const rr = (R - 0.6) * (1 - k / 10); pts.push(new THREE.Vector2(Math.max(0.01, rr), prof(rr))); }
  const mound = new THREE.Mesh(new THREE.LatheGeometry(pts, 36), mat(0x5b7a40, { map: patternTex('grass', 0x5b7a40) }));
  mound.position.set(0, 0, z); g.add(mound);
  // 冢前：墓门“钟灵处”、石供案、石五供、一对石碑
  const zf = z + R;
  g.add(box(7, 4.2, 1.6, mat(brick, { map: patternTex('brick', brick) }), 0, 0, zf - 0.3));
  P.verm.box(2.4, 2.9, 0.2, 0, 0, zf + 0.5); P.carve.box(3.0, 0.3, 0.3, 0, 2.9, zf + 0.5);
  g.add(gableRoof(8, 2.8, 1.0, roofMat(GREEN), 0, 4.2, zf - 0.3));
  g.add(sign('钟灵处', 2.2, 0.75, { bg: '#5d5a54', fg: '#e8dcc0', x: 0, y: 3.7, z: zf + 0.52 }));
  P.stone.box(3.8, 0.9, 1.5, 0, 0, zf + 3.4); P.stone.box(4.2, 0.18, 1.8, 0, 0.9, zf + 3.4);
  for (const k of [-1.4, -0.7, 0.7, 1.4]) P.carve.cyl(0.14, 0.2, 0.6, k, 1.08, zf + 3.4, 6);
  P.carve.cyl(0.3, 0.22, 0.5, 0, 1.08, zf + 3.4, 8);
  for (const sx of [-1, 1]) stele(P, sx * 7, zf + 2.2, 2.6);
  // 冢上古柏
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * (R - 3.5);
    g.add(tree(Math.cos(a) * rr, z + Math.sin(a) * rr, 9 + r() * 5, 'cypress', prof(rr) - 0.4));
  }
}

export function build() {
  const g = new THREE.Group(), P = newProps();
  P.teal = new Bat(); P.ironL = new Bat();
  const r = rng(23);
  const pave = mat(0xc7bfa9, { map: patternTex('paving', 0xc7bfa9) }), red = mat(C.wallRed);
  // 地面
  g.add(plaza(110, 60, mat(C.paving, { map: patternTex('paving', C.paving) }), 0, WZF + 30, 0.15, 4));
  g.add(plaza(96, WZF - WZB - 1.2, pave, 0, (WZF + WZB) / 2, 0.15, 6));
  for (const sx of [-1, 1]) g.add(plaza(WX - 48.6, WZF - WZB - 1.2, mat(0x5b7a40, { map: patternTex('grass', 0x5b7a40) }), sx * (48 + WX - 0.6) / 2, (WZF + WZB) / 2, 0.15));
  g.add(plaza(7.6, WZF + 30 - (-100), mat(C.stone, { map: patternTex('stone', C.stone) }), 0, (WZF + 30 - 100) / 2, 0.21, 3));

  stage(g, P);
  for (const G of GATES) gateHall(g, P, G);
  // 八字墙（忠义 / 仁勇）、大门前石狮、旗杆
  BAZI.forEach((b, i) => {
    const grp = new THREE.Group();
    grp.add(box(b.w, 0.9, 1.5, mat(C.brickGrey)), box(b.w, 4.4, 1.2, red, 0, 0.9, 0), box(b.w + 0.1, 0.25, 1.7, mat(C.brickGrey), 0, 5.3, 0), gableRoof(b.w + 0.4, 2.3, 0.8, roofMat(GREEN), 0, 5.55, 0));
    grp.add(sign(i ? '仁勇' : '忠义', 5.2, 2.6, { bg: 'transparent', fg: '#e8c45a', x: 0, y: 3.1, z: 0.63 }));
    grp.applyMatrix4(TM(b.x, 0, b.z, b.rot)); g.add(grp);
  });
  for (const sx of [-1, 1]) {
    lion(P, sx * 9.5, 0, WZF + 10, 1.35, 0, { male: sx > 0 });
    const fx = sx * 24, fz = WZF + 16;                                               // 旗杆：夹杆石 + 斗 + 杏黄旗
    P.carve.box(0.5, 1.8, 1.3, fx - 0.42, 0, fz); P.carve.box(0.5, 1.8, 1.3, fx + 0.42, 0, fz); P.lac.cyl(0.09, 0.17, 15, fx, 0.2, fz, 8);
    P.lac.box(0.9, 0.5, 0.9, fx, 10, fz); P.gold.sph(0.22, fx, 15.4, fz, 8); P.cloth.box(0.05, 3.4, 1.5, fx, 10.9, fz + 0.85);
  }
  for (const w of WALLS) wallSeg(g, w);
  for (const t of TOWERS) bellTower(g, P, t.x, t.z);
  // 仪门前铁狮一对
  { const sw = P.carve; P.carve = P.ironL; for (const sx of [-1, 1]) lion(P, sx * 6.5, 0, 119, 1.0, 0, { male: sx > 0 }); P.carve = sw; }

  // 石狮甬道：石栏杆，每根望柱头上一只小石狮
  const z1 = 104, z2 = 42;
  for (const sx of [-1, 1]) {
    const x = sx * 4.2;
    P.carve.box(0.3, 0.22, z1 - z2, x, 0.2, (z1 + z2) / 2); P.carve.box(0.22, 0.2, z1 - z2, x, 0.95, (z1 + z2) / 2); P.carve.box(0.12, 0.5, z1 - z2, x, 0.44, (z1 + z2) / 2);
    for (let zz = z1; zz >= z2 - 0.01; zz -= 1.675) { P.carve.box(0.34, 1.3, 0.34, x, 0, zz); P.carve.box(0.44, 0.1, 0.44, x, 1.3, zz); lion(P, x, 1.4, zz, 0.36, -sx * Math.PI / 2, { low: true }); }
  }
  // 殿堂
  for (const h of HALLS) g.add(hallX({ eave: EAVE, roof: GREEN, ...h }));
  for (const h of HALLS) if (h.name) g.add(sign(h.name, 3.8, 1.3, { bg: '#1d2f4f', fg: '#e8c45a', border: '#c9a227', x: 0, y: (h.platformH ?? 1.2) + h.wallH - 0.9, z: h.z + h.d / 2 + 0.25 }));
  P.stone.box(30, 1.0, 6, 0, 0, 10.4);                                                  // 拜殿与大殿之间的连接月台
  // 拜殿前月台：栏杆、踏步、香炉、铁旗杆座
  const T = TERRACE, tz0 = T.z - T.d / 2, tz1 = T.z + T.d / 2;
  P.stone.box(T.w, T.h, T.d, 0, 0, T.z); P.stone.box(T.w + 0.24, 0.14, T.d + 0.24, 0, T.h - 0.14, T.z);
  stairs(P, 0, tz1, 7, T.h, 1);
  for (const sx of [-1, 1]) { rail(P, sx * (T.w / 2 - 0.2), tz0 + 0.6, sx * (T.w / 2 - 0.2), tz1 - 0.2, T.h); rail(P, sx * 4.0, tz1 - 0.2, sx * (T.w / 2 - 0.2), tz1 - 0.2, T.h); }
  censer(P, 0, T.z + 1.2, 0.85);
  for (const sx of [-1, 1]) { censer(P, sx * 14, 31, 0.6); lantern(P, sx * 3.3, 1.2 + 6 - 0.7, 20 + 4.5 + 0.9, 0.45); lantern(P, sx * 3.0, 1.2 + 6.5 - 0.7, -46 + 7 + 0.9, 0.45); }
  censer(P, 0, -32); censer(P, 0, -73, 0.85);
  for (const sx of [-1, 1]) { stele(P, sx * 12, 96, 3.0, -sx * Math.PI / 2); stele(P, sx * 12, 86, 2.6, -sx * Math.PI / 2); stele(P, sx * 10, -100, 2.8); }
  paifang(g, P, -110, 15, 7.2, '汉寿亭侯墓');
  pavilion(g, P);
  tomb(g, P, r);

  // 柏树（成行 + 两侧林地）
  const blocks = [...HALLS.map(hallFoot), ...TOWERS.map(t => ({ x: t.x, z: t.z, w: 10, d: 10 })), { x: 0, z: PAV.z, w: 16, d: 16 }, { x: 0, z: TOMB.z, w: 56, d: 58 },
    { x: 0, z: 70, w: 12, d: 72 }, ...GATES.map(G => ({ x: 0, z: G.z, w: G.w + 4, d: G.d + 6 })), { x: 0, z: -110, w: 18, d: 6 }, { x: 0, z: 20, w: 34, d: 30 }];
  const free = (x, z, m = 2.5) => !blocks.some(b => Math.abs(x - b.x) < b.w / 2 + m && Math.abs(z - b.z) < b.d / 2 + m);
  let n = 0;
  const put = (x, z, h) => { if (n < 100 && free(x, z)) { g.add(tree(x, z, h, 'cypress')); n++; } };
  for (let z = WZF - 8; z > -150; z -= 10) for (const x of [-11, 11, -19, 19]) put(x + (r() - 0.5), z + (r() - 0.5) * 2, 10 + r() * 5);
  for (let i = 0; i < 60; i++) { const sx = i % 2 ? 1 : -1; put(sx * (52 + r() * 24), WZF - 6 - r() * (WZF - WZB - 12), 10 + r() * 6); }
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) put(sx * (34 + i * 9), WZF + 26 + (i % 2) * 10, 10 + r() * 3);

  P.teal.addTo(g, mat(0x1f6b73)); P.ironL.addTo(g, mat(0x3a3a3c, { shiny: true })); delete P.teal; delete P.ironL;
  flushProps(g, P);
  return finalize(g);
}
