// 周公庙 — 三进院祠庙（洛阳都城博物馆）。+Z = 南：八字墙大门 → 定鼎堂（月台、铜鼎、碑亭）→ 礼乐堂（钟鼓架）→ 先祖堂（-Z 端）。
import { THREE, C, mat, box, plaza, hall, tangRoof, gableRoof, patternTex, sign, tree, rng, finalize } from './_kit.js';

const EAVE = 2.4;
const WALL_T = 1.0;
const WX = 40, WZF = 82, WZB = -90;
const ROOF = 0x50565d;
const GATE = { name: '周公庙', z: WZF, w: 15, d: 8, h: 5.5, bays: 3 };
const HALLS = [
  { name: '定鼎堂', z: 34, w: 22, d: 14, wallH: 6.5, roofH: 5.6 },
  { name: '礼乐堂', z: -16, w: 18, d: 11, wallH: 5.5, roofH: 4.6 },
  { name: '先祖堂', z: -62, w: 20, d: 12, wallH: 5.8, roofH: 4.8 },
  // 东西廊房（悬山）
  ...[34, -16].flatMap(z => [-1, 1].map(s => ({ x: s * 29, z, w: 15, d: 7, wallH: 4, roofH: 3, eave: 1.8, platformH: 0.6, ry: -s * Math.PI / 2, roofKind: 'gable' }))),
];
const TERRACE = { z: 47.6, w: 17, d: 10, h: 1.0 };            // 定鼎堂前月台
const STELE_PAV = [[-21, 64], [21, 64]];                       // 碑亭
const DOOR = 2.2;                                              // 院间随墙门半宽
const WALLS = [
  [-WX, WZF, -GATE.w / 2, WZF], [GATE.w / 2, WZF, WX, WZF],
  [-WX, WZF, -WX, WZB], [WX, WZF, WX, WZB], [-WX, WZB, WX, WZB],
  // 院间隔墙（中间是随墙门）
  [-WX, 8, -DOOR, 8], [DOOR, 8, WX, 8], [-WX, -38, -DOOR, -38], [DOOR, -38, WX, -38],
];

const hallFoot = (h) => {
  const e = h.eave ?? EAVE, w = h.w + e * 1.3, d = h.d + e * 1.3;
  return h.ry ? { x: h.x || 0, z: h.z, w: d, d: w } : { x: h.x || 0, z: h.z, w, d };
};
const wallCol = ([x1, z1, x2, z2]) => z1 === z2
  ? { x: (x1 + x2) / 2, z: z1, w: Math.abs(x2 - x1), d: WALL_T }
  : { x: x1, z: (z1 + z2) / 2, w: WALL_T, d: Math.abs(z2 - z1) };
const gateCols = (G) => { const open = G.w / G.bays, sw = (G.w - open) / 2; return [-1, 1].map(s => ({ x: s * (open / 2 + sw / 2), z: G.z, w: sw, d: G.d })); };

export const meta = {
  colliders: [
    ...HALLS.map(hallFoot), ...gateCols(GATE), ...WALLS.map(wallCol),
    { x: 0, z: TERRACE.z, w: TERRACE.w, d: TERRACE.d },
    ...STELE_PAV.map(([x, z]) => ({ x, z, w: 4.4, d: 4.4 })),
    { x: 0, z: 60, w: 2.6, d: 2.6 },                                                   // 铜鼎
    ...[-1, 1].map(s => ({ x: s * 11.6, z: WZF + 6.4, w: 7.5, d: 1.2, rot: -s * 0.6 })), // 八字墙
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
function wallSeg(g, [x1, z1, x2, z2], h = 4) {
  const horiz = z1 === z2, L = horiz ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, ry = horiz ? 0 : Math.PI / 2;
  g.add(box(L, 0.7, WALL_T + 0.2, mat(C.brickGrey), cx, 0, cz, ry));
  g.add(box(L, h - 0.7, WALL_T, mat(C.wallRed), cx, 0.7, cz, ry));
  g.add(box(L + 0.1, 0.22, WALL_T + 0.5, mat(C.brickGrey), cx, h, cz, ry));
  g.add(gableRoof(L + 0.3, WALL_T + 1.1, 0.65, mat(ROOF, { map: patternTex('roofTile', ROOF) }), cx, h + 0.22, cz, ry));
}

/** 大门：三间歇山门殿，明间通道（门扇向内敞开），两次间是关着的朱漆门钉大门。 */
function gateHall(g, P, G) {
  const { z, w, d, h, bays } = G, bay = w / bays, ph = 0.45, fz = z + 0.6, dh = 3.7;
  const red = mat(C.wallRed);
  P.stone.box(w + 2.4, ph, d + 2.4, 0, 0, z);
  stairs(P, 0, z + d / 2 + 1.2, bay + 1, ph, 1); stairs(P, 0, z - d / 2 - 1.2, bay + 1, ph, -1);
  // 山墙 + 门楣上的走马板
  for (const sx of [-1, 1]) g.add(box(0.6, h, d - 0.8, red, sx * (w / 2 - 0.3), ph, z));
  for (let i = 0; i < bays; i++) { const cx = -w / 2 + (i + 0.5) * bay; g.add(box(bay - 0.5, h - dh - 0.3, 0.3, red, cx, ph + dh + 0.3, fz)); P.wood.box(bay - 0.3, 0.3, 0.5, cx, ph + dh, fz); }
  for (let i = 1; i < bays; i++) g.add(box(0.5, dh, 0.5, mat(C.tangRed), -w / 2 + i * bay, ph, fz));
  // 次间：关着的大门（中槛下门枕石）
  for (const sx of [-1, 1]) for (const lx of [-1, 1]) studDoor(P, sx * bay + lx * (bay - 0.6) / 4, ph, fz, (bay - 0.6) / 2 - 0.04, dh, 0, { both: true, ring: -lx });
  // 明间：两扇门向内（北）敞开
  for (const sx of [-1, 1]) studDoor(P, sx * (bay / 2 - 0.32), ph, fz - (bay - 0.6) / 4 - 0.1, (bay - 0.6) / 2 - 0.04, dh, -sx * Math.PI / 2, { both: true, ring: -1 * sx });
  for (const sx of [-1, 1]) { P.carve.box(0.5, 0.5, 1.0, sx * (bay / 2 - 0.2), ph, fz); P.carve.cyl(0.36, 0.36, 0.3, sx * (bay / 2 - 0.2), ph + 0.5, fz + 0.3, 10); }   // 门枕石 / 抱鼓
  // 柱、额枋、屋顶
  for (let i = 0; i <= bays; i++) for (const zz of [z + d / 2 - 0.25, z - d / 2 + 0.25]) { P.lac.cyl(0.26, 0.3, h, -w / 2 + i * bay, ph, zz, 10); P.stone.box(0.8, 0.16, 0.8, -w / 2 + i * bay, ph, zz); }
  for (const zz of [z + d / 2 - 0.25, z - d / 2 + 0.25]) { P.lac.box(w, 0.42, 0.3, 0, ph + h - 0.5, zz); P.wood.box(w + 0.4, 0.3, 0.5, 0, ph + h - 0.08, zz); }
  P.wood.box(w + 0.6, 0.3, d + 0.2, 0, ph + h + 0.2, z);
  g.add(cRoof({ w: w + 4, d: d + 4, h: 3.8, roof: ROOF, soffit: 2.1, y: ph + h + 0.5, z }));
  for (const sx of [-1, 1]) lantern(P, sx * bay / 2, ph + h - 0.6, z + d / 2 + 0.5, 0.4);
  g.add(sign(G.name, 3.4, 1.15, { bg: '#1d2f4f', fg: '#e8c45a', border: '#c9a227', x: 0, y: ph + dh + 1.0, z: fz + 0.2 }));
  // 八字墙 + 石狮
  for (const sx of [-1, 1]) {
    const m = TM(sx * 11.6, 0, z + 6.4, -sx * 0.6), grp = new THREE.Group();
    grp.add(box(7.5, 0.7, 1.2, mat(C.brickGrey)), box(7.5, 3.2, 1.0, red, 0, 0.7, 0), box(4.2, 2.0, 0.12, mat(C.brickGrey), 0, 1.3, 0.5), gableRoof(7.8, 2.0, 0.6, mat(ROOF, { map: patternTex('roofTile', ROOF) }), 0, 3.9, 0));
    grp.applyMatrix4(m); g.add(grp);
    lion(P, sx * 6.2, 0, z + d / 2 + 3.6, 1.15, 0, { male: sx > 0 });
  }
}

/** 碑亭：四柱攒尖小亭，里面一通石碑 */
function stelePavilion(g, P, x, z) {
  P.stone.box(4.6, 0.4, 4.6, x, 0, z);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { P.lac.cyl(0.17, 0.19, 3.2, x + sx * 1.7, 0.4, z + sz * 1.7, 8); }
  P.wood.box(3.9, 0.3, 3.9, x, 3.45, z);
  g.add(tangRoof({ w: 5.6, d: 5.6, h: 2.0, ridge: 0, material: mat(ROOF, { map: patternTex('roofTile', ROOF) }), y: 3.75, x, z, soffit: 1.0 }));
  stele(P, x, z, 2.0, 0, 0.85);
}

/** 青铜大鼎（定鼎）：石座 + 三足 + 圆腹 + 双立耳 */
function ding(P, x, z) {
  const b = P.bronze;
  P.stone.box(2.8, 0.5, 2.8, x, 0, z); P.stone.box(2.3, 0.3, 2.3, x, 0.5, z);
  for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.52; b.cyl(0.2, 0.14, 1.1, x + Math.sin(a) * 0.72, 0.8, z + Math.cos(a) * 0.72, 8); }
  b.sph(1.15, x, 2.45, z, 14, [1, 0.72, 1]); b.cyl(1.2, 1.05, 0.34, x, 2.75, z, 14); b.cyl(1.0, 1.0, 0.06, x, 3.0, z, 14);
  for (const sx of [-1, 1]) { b.box(0.16, 0.8, 0.5, x + sx * 1.1, 3.05, z); b.box(0.16, 0.16, 0.8, x + sx * 1.1, 3.75, z); }
}

/** 钟 / 鼓架（礼乐） */
function bellRack(P, x, z, drum) {
  for (const sx of [-1, 1]) { P.lac.box(0.22, 2.8, 0.22, x + sx * 1.2, 0, z); P.dark.box(0.6, 0.25, 1.0, x + sx * 1.2, 0, z); }
  P.lac.box(3.0, 0.24, 0.26, x, 2.7, z); P.gold.box(0.3, 0.12, 0.3, x - 1.5, 2.76, z); P.gold.box(0.3, 0.12, 0.3, x + 1.5, 2.76, z);
  if (drum) P.verm.geo(new THREE.CylinderGeometry(0.75, 0.75, 0.7, 14), TM(x, 1.6, z, 0, 1, Math.PI / 2));
  else { P.bronze.cyl(0.42, 0.62, 1.2, x, 1.2, z, 12); P.bronze.cyl(0.1, 0.1, 0.3, x, 2.4, z, 6); }
  if (drum) for (const f of [-1, 1]) P.carve.geo(new THREE.CylinderGeometry(0.7, 0.7, 0.04, 14), TM(x, 1.6, z + f * 0.36, 0, 1, Math.PI / 2));
}

export function build() {
  const g = new THREE.Group(), P = newProps();
  const r = rng(5);
  const roofM = mat(ROOF, { map: patternTex('roofTile', ROOF) });
  g.add(plaza(56, 12, mat(C.paving, { map: patternTex('paving', C.paving) }), 0, WZF + 6.5, 0.15, 4));
  g.add(plaza(2 * WX - 1, WZF - WZB - 1, mat(0xc7bfa9, { map: patternTex('paving', 0xc7bfa9) }), 0, (WZF + WZB) / 2, 0.15, 4));
  g.add(plaza(4.4, WZF + 12 - (-54), mat(C.stone, { map: patternTex('stone', C.stone) }), 0, (WZF + 12 - 54) / 2, 0.21, 2));
  // 院内草地
  for (const sx of [-1, 1]) for (const [zc, dl] of [[62, 26], [-14, 30], [-68, 30]]) g.add(plaza(14, dl, mat(C.grass), sx * 13, zc, 0.2));

  gateHall(g, P, GATE);
  for (const w of WALLS) wallSeg(g, w);
  // 随墙门：两根砖柱 + 小瓦顶
  for (const z of [8, -38]) {
    for (const sx of [-1, 1]) g.add(box(0.9, 4.6, 1.3, mat(C.brickGrey), sx * (DOOR + 0.1), 0, z));
    P.wood.box(DOOR * 2 + 1, 0.3, 0.5, 0, 3.4, z); g.add(box(DOOR * 2 + 0.2, 0.9, 0.5, mat(C.wallRed), 0, 3.7, z));
    g.add(gableRoof(DOOR * 2 + 2.6, 2.4, 0.9, roofM, 0, 4.6, z));
    for (const sx of [-1, 1]) studDoor(P, sx * (DOOR - 0.5), 0.2, z - 0.9, 1.7, 3.1, -sx * Math.PI / 2, { rows: 5, cols: 3, both: true, ring: 0 });
  }
  for (const h of HALLS) g.add(hallX({ eave: EAVE, roof: ROOF, ...h }));

  // 定鼎堂前月台：栏杆、踏步、香炉；台下铜鼎；两侧碑亭
  const T = TERRACE, tz0 = T.z - T.d / 2, tz1 = T.z + T.d / 2;
  P.stone.box(T.w, T.h, T.d, 0, 0, T.z); P.stone.box(T.w + 0.24, 0.14, T.d + 0.24, 0, T.h - 0.14, T.z);
  stairs(P, 0, tz1, 5, T.h, 1); for (const sx of [-1, 1]) stairs(P, sx * (T.w / 2 - 2.2), tz1, 2.4, T.h, 1);
  for (const sx of [-1, 1]) { rail(P, sx * (T.w / 2 - 0.2), tz0 + 1, sx * (T.w / 2 - 0.2), tz1 - 0.2, T.h); rail(P, sx * 2.9, tz1 - 0.2, sx * (T.w / 2 - 3.6), tz1 - 0.2, T.h); }
  censer(P, 0, T.z + 1.5, 0.8); P.stone.box(0.1, 0.1, 0.1, 0, 0, T.z);
  ding(P, 0, 60);
  for (const [x, z] of STELE_PAV) stelePavilion(g, P, x, z);
  for (const sx of [-1, 1]) { stele(P, sx * 8, 70, 2.6); lantern(P, sx * 3.6, 1.2 + 6.5 - 0.7, 34 + 7 + 0.9); }
  // 礼乐堂前：钟架（东）鼓架（西）、香炉
  bellRack(P, 8, -5, false); bellRack(P, -8, -5, true);
  censer(P, 0, -3, 0.7);
  // 先祖堂前：供案 + 石灯
  P.stone.box(3.2, 0.9, 1.3, 0, 0, -50); P.stone.box(3.6, 0.16, 1.6, 0, 0.9, -50);
  for (const sx of [-1, 1]) { P.carve.cyl(0.18, 0.26, 1.5, sx * 5, 0, -50, 6); P.carve.box(0.7, 0.6, 0.7, sx * 5, 1.5, -50); P.carve.cyl(0.05, 0.6, 0.4, sx * 5, 2.1, -50, 4); }

  // 古树（老柏为主，间有槐）
  const pts = [[-13, 74], [13, 74], [-22, 52], [22, 52], [-31, 58], [31, 58], [-36, 76], [36, 76], [-12, 16], [12, 16],
    [-13, 1], [13, 1], [-20, -28], [20, -28], [-13, -31], [13, -31], [-35, 2], [35, 2],
    [-14, -76], [14, -76], [-24, -82], [24, -82], [-31, -58], [31, -58], [-35, -84], [35, -84], [0, -84]];
  pts.forEach(([x, z], i) => { const h = 10 + r() * 5; g.add(tree(x + (r() - 0.5), z + (r() - 0.5), i % 4 === 3 ? h + 3 : h, i % 4 === 3 ? 'round' : 'cypress')); });
  for (const sx of [-1, 1]) g.add(tree(sx * 24, WZF + 8, 10, 'round'));
  for (const h of HALLS) if (h.name) g.add(sign(h.name, 3.6, 1.25, { bg: '#1d2f4f', fg: '#e8c45a', border: '#c9a227', x: 0, y: 1.2 + h.wallH - 0.9, z: h.z + h.d / 2 + 0.25 }));
  flushProps(g, P);
  return finalize(g);
}
