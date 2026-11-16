// 九洲池 — 隋唐皇家池苑复建。+Z = 南（正门）。
// 不规则湖面 + 4 座小岛：瑶光殿（重檐歇山，月台栏杆）、望景台（砖砌高台 + 对称蹬道 + 台上重檐方阁）、九洲亭（重檐八角亭）、琉璃亭（绿琉璃六角亭）。
// 曲桥、廊桥、石拱桥相连；驳岸叠石、荷叶、画舫；环湖石径、垂柳、石灯；四周回廊（漏窗、坐凳栏杆、灯笼）+ 四门 + 角亭。
import { THREE, C, mat, box, cyl, sphere, plaza, hall, tangRoof, roundRoof, sign, tree, patternTex, rng, finalize } from './_kit.js';

const ROOF = 0x4a5057;
const LX = 0, LZ = -6;                       // 湖心
// 湖岸半径（随角度起伏），a 为从 +X 起算的角度
const lakeR = (a, s = 1) => {
  const rx = 108 * s, rz = 72 * s;
  const base = (rx * rz) / Math.hypot(rz * Math.cos(a), rx * Math.sin(a));
  return base * (1 + 0.07 * Math.sin(3 * a + 1) + 0.045 * Math.sin(5 * a + 2) + 0.03 * Math.cos(7 * a));
};
const shore = (s = 1, n = 72) => { const p = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, r = lakeR(a, s); p.push([LX + r * Math.cos(a), LZ + r * Math.sin(a)]); } return p; };
const blob = (cx, cz, rx, rz, seed, n = 20) => { const r = rng(seed), p = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, k = 0.85 + r() * 0.25; p.push([cx + Math.cos(a) * rx * k, cz + Math.sin(a) * rz * k]); } return p; };

// 岛屿（瑶光殿岛、望景台岛、九洲亭岛、琉璃亭岛）
const ISL = [
  { x: -28, z: -14, rx: 30, rz: 21, seed: 3 },
  { x: 50, z: -26, rx: 17, rz: 15, seed: 7 },
  { x: 20, z: 24, rx: 12, rz: 10, seed: 11 },
  { x: -74, z: 22, rx: 11, rz: 9, seed: 5 },
];
const CW = { x: 140, z: 104 };               // 回廊中线
const IY = 1.3;                              // 岛面高度
const YG = { x: -28, z: -20, w: 24, d: 13 }; // 瑶光殿
const WJ = { x: 50, z: -27, s: 14.4, h: 5.2 };  // 望景台（底边 s，高 h）
const GATES = [[0, CW.z, 0], [0, -CW.z, 0], [CW.x, 0, Math.PI / 2], [-CW.x, 0, Math.PI / 2]];

export const meta = {
  colliders: [
    { x: YG.x, z: YG.z, w: YG.w + 4, d: YG.d + 4 },                 // 瑶光殿
    { x: WJ.x, z: WJ.z, w: WJ.s + 0.6, d: WJ.s + 0.6 },             // 望景台
    { x: WJ.x, z: WJ.z + WJ.s / 2 + 1.2, w: WJ.s, d: 2.4 },         // 望景台蹬道
    // 回廊外墙（四面正中留门，门宽 14m）
    ...[-1, 1].flatMap(s => [
      { x: s * (CW.x + 7) / 2, z: CW.z + 2.2, w: CW.x - 7, d: 1 },
      { x: s * (CW.x + 7) / 2, z: -CW.z - 2.2, w: CW.x - 7, d: 1 },
      { x: CW.x + 2.2, z: s * (CW.z + 7) / 2, w: 1, d: CW.z - 7 },
      { x: -CW.x - 2.2, z: s * (CW.z + 7) / 2, w: 1, d: CW.z - 7 },
    ]),
    // 四座门殿的两侧墙墩
    ...GATES.flatMap(([x, z, ry]) => [-1, 1].map(s => ry ? { x, z: z + s * 5.6, w: 7, d: 2.6 } : { x: x + s * 5.6, z, w: 2.6, d: 7 })),
  ],
};

// ── 小批处理器（kit 的 Batch 没有导出）：把很多盒子 / 面片攒成一个网格
class Bat {
  constructor() { this.p = []; this.u = []; }
  quad(a, b, c, d, uw = 1, uh = 1) { for (const [q, s, t] of [[a, 0, 0], [b, uw, 0], [c, uw, uh], [a, 0, 0], [c, uw, uh], [d, 0, uh]]) { this.p.push(q[0], q[1], q[2]); this.u.push(s, t); } return this; }
  /** 盒子：中心 (x,z)，底在 y。faces 位掩码：1 +x, 2 -x, 4 顶, 8 底, 16 +z, 32 -z */
  box(x, y, z, sx, sy, sz, ry = 0, faces = 63) {
    const c = Math.cos(ry), s = Math.sin(ry), hx = sx / 2, hz = sz / 2;
    const P = (kx, ky, kz) => [x + kx * hx * c + kz * hz * s, y + ky * sy, z - kx * hx * s + kz * hz * c];
    if (faces & 16) this.quad(P(-1, 0, 1), P(1, 0, 1), P(1, 1, 1), P(-1, 1, 1), sx, sy);
    if (faces & 32) this.quad(P(1, 0, -1), P(-1, 0, -1), P(-1, 1, -1), P(1, 1, -1), sx, sy);
    if (faces & 1) this.quad(P(1, 0, 1), P(1, 0, -1), P(1, 1, -1), P(1, 1, 1), sz, sy);
    if (faces & 2) this.quad(P(-1, 0, -1), P(-1, 0, 1), P(-1, 1, 1), P(-1, 1, -1), sz, sy);
    if (faces & 4) this.quad(P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1), P(-1, 1, -1), sx, sz);
    if (faces & 8) this.quad(P(-1, 0, -1), P(1, 0, -1), P(1, 0, 1), P(-1, 0, 1), sx, sz);
    return this;
  }
  /** 收分方台（四面梯形 + 顶）：底 wb x db，顶 wt x dt */
  taper(x, y, z, wb, db, wt, dt, h) {
    const c = [[-1, 1], [1, 1], [1, -1], [-1, -1]], q = (k, top) => [x + k[0] * (top ? wt : wb) / 2, y + (top ? h : 0), z + k[1] * (top ? dt : db) / 2];
    for (let i = 0; i < 4; i++) this.quad(q(c[i], 0), q(c[(i + 1) % 4], 0), q(c[(i + 1) % 4], 1), q(c[i], 1), wb, h);
    return this.quad(q(c[0], 1), q(c[1], 1), q(c[2], 1), q(c[3], 1), wt, dt);
  }
  mesh(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.computeVertexNormals();
    return new THREE.Mesh(g, material);
  }
}
const put = (m, x, y, z, rx = 0, ry = 0, rz = 0) => { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); return m; };
/** 平面着色的多边形柱 / 台（棱角分明） */
function polyCyl(rt, rb, h, n, material, x, y, z) { const geo = new THREE.CylinderGeometry(rt, rb, h, n, 1).toNonIndexed(); geo.deleteAttribute('normal'); geo.computeVertexNormals(); return put(new THREE.Mesh(geo, material), x, y + h / 2, z); }

// 平面多边形（可带洞）挤出成薄片/台：outer, holes = [[x,z]...]
function slab(outer, holes, h, material, y) {
  const V = (p) => new THREE.Vector2(p[0], -p[1]);
  const shape = new THREE.Shape(outer.map(V));
  for (const hpts of holes) shape.holes.push(new THREE.Path(hpts.map(V)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, material); m.position.y = y; return m;
}

// 鸱吻（单位高 3，尾巴卷向 -x）
let _chi;
function chiwen(material, x, y, z, s, flip) {
  if (!_chi) { const sh = new THREE.Shape(); sh.moveTo(-0.75, 0); sh.lineTo(0.75, 0); sh.quadraticCurveTo(0.98, 1.4, -0.05, 2.5); sh.quadraticCurveTo(-0.65, 3.0, -1.25, 2.6); sh.quadraticCurveTo(-0.4, 2.1, -0.5, 1.1); sh.lineTo(-0.75, 0); _chi = new THREE.ExtrudeGeometry(sh, { depth: 0.56, bevelEnabled: false, curveSegments: 5 }); _chi.translate(0, 0, -0.28); }
  const m = new THREE.Mesh(_chi, material); m.scale.set(s, s, s); m.position.set(x, y, z); if (flip) m.rotation.y = Math.PI; return m;
}
/**
 * 把庑殿顶（tangRoof：外廓 w x d，高 h，正脊长 ridge，底面在 y）改成歇山顶：在 x=±gx 处立山面，山面以内的上半截再盖一层
 * 随原屋面曲线的两坡瓦面（略高于原屋面，盖住伸进来的戗脊），加正脊 + 鸱吻、垂脊 + 垂兽、朱红山花板、博风板、悬鱼。
 */
function xieshan(g, M, { w, d, h, ridge, gx, x = 0, y, z = 0, curve = 1.7 }) {
  const big = Math.max(w, d), rr = Math.min(0.24, Math.max(0.09, big * 0.0065 + 0.07)), off = rr * 1.45 + 0.06;
  const tg = (w / 2 - gx) / (w / 2 - ridge / 2), k = Math.min(1.6, h / 3.5), n = 6, prof = [];
  for (let i = 0; i <= n; i++) { const t = tg + (1 - tg) * i / n; prof.push([d / 2 * (1 - t), h * Math.pow(t, curve) + off]); }      // [z, y]：从山面檐口到正脊
  const yg = prof[0][1] - off, bg = prof[0][0], top = prof[n][1];
  const bT = new Bat(), bR = new Bat(), grp = new THREE.Group();
  const slant = (geo, material, px, i, s, dy) => { const [z0, y0] = prof[i], [z1, y1] = prof[i + 1]; const m = new THREE.Mesh(geo, material); m.position.set(px, (y0 + y1) / 2 + dy, s * (z0 + z1) / 2); m.rotation.x = s * Math.atan2(y1 - y0, z0 - z1); grp.add(m); };
  for (const s of [1, -1]) {
    for (let i = 0; i < n; i++) { const [z0, y0] = prof[i], [z1, y1] = prof[i + 1]; bT.quad([-s * gx, y0, s * z0], [s * gx, y0, s * z0], [s * gx, y1, s * z1], [-s * gx, y1, s * z1]); }
    bR.quad([-s * gx, yg - 0.05, s * bg], [s * gx, yg - 0.05, s * bg], [s * gx, yg + off, s * bg], [-s * gx, yg + off, s * bg]);
  }
  grp.add(bT.mesh(M.roof), bR.mesh(M.ridge));
  grp.add(box(gx * 2 + 0.7 * k, 0.55 * k, 0.42 * k, M.ridge, 0, top - 0.14, 0), box(gx * 2 + 0.9 * k, 0.08, 0.56 * k, M.ridge, 0, top - 0.14 + 0.55 * k, 0));     // 正脊
  for (const s of [1, -1]) {
    grp.add(chiwen(M.ridge, s * (gx + 0.1), top - 0.08, 0, 0.46 * k, s < 0));
    const sh = new THREE.Shape(); sh.moveTo(-bg + 0.2, yg - 0.05);                                                                   // 山花板（随屋面曲线）
    for (let i = 0; i <= n; i++) sh.lineTo(-Math.max(0, prof[i][0] - 0.2), prof[i][1] - 0.3);
    for (let i = n - 1; i >= 0; i--) sh.lineTo(Math.max(0, prof[i][0] - 0.2), prof[i][1] - 0.3);
    sh.lineTo(bg - 0.2, yg - 0.05); sh.closePath();
    const sm = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: false }), M.col); sm.position.set(s * (gx + (s > 0 ? 0.01 : 0.07)), 0, 0); sm.rotation.y = Math.PI / 2; grp.add(sm);
    grp.add(box(0.1, 0.2, bg * 2 - 0.3, M.wood, s * (gx + 0.05), yg - 0.1, 0));
    for (const t of [1, -1]) {
      for (let i = 0; i < n; i++) {
        const L = Math.hypot(prof[i][0] - prof[i + 1][0], prof[i + 1][1] - prof[i][1]);
        slant(new THREE.BoxGeometry(0.09, 0.42 * k, L + 0.06), M.wood, s * (gx + 0.1), i, t, -0.2 * k);          // 博风板
        slant(new THREE.BoxGeometry(0.3 * k, 0.26 * k, L + 0.06), M.ridge, s * (gx - 0.22), i, t, 0.1);          // 垂脊
      }
      grp.add(box(0.34 * k, 0.5 * k, 0.3 * k, M.ridge, s * (gx - 0.22), yg + off - 0.02, t * (bg - 0.1)));     // 垂兽
    }
    const yu = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.3 * k, 0.9 * k, 4), M.gold); yu.position.set(s * (gx + 0.16), top - 0.25 - 0.45 * k, 0); yu.rotation.z = Math.PI; grp.add(yu);   // 悬鱼
  }
  grp.position.set(x, y, z); g.add(grp);
}

// 汉白玉栏杆：沿 (x0,z0)→(x1,z1)，立在 y（可沿任意方向）
function balustrade(B, x0, z0, x1, z1, y, step = 2) {
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / step)), ry = Math.atan2(-(z1 - z0), x1 - x0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  for (let i = 0; i <= n; i++) { const px = x0 + (x1 - x0) * i / n, pz = z0 + (z1 - z0) * i / n; B.marble.box(px, y, pz, 0.2, 1.0, 0.2, ry, 63 - 8); B.marble.box(px, y + 1.0, pz, 0.27, 0.1, 0.27, ry); }
  B.marble.box(cx, y + 0.74, cz, L, 0.12, 0.14, ry); B.marble.box(cx, y + 0.1, cz, L, 0.5, 0.07, ry);
}
// 朱漆木栏杆
function woodRail(B, x0, z0, x1, z1, y, h = 0.9) {
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 1.6)), ry = Math.atan2(-(z1 - z0), x1 - x0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  for (let i = 0; i <= n; i++) B.red.box(x0 + (x1 - x0) * i / n, y, z0 + (z1 - z0) * i / n, 0.12, h + 0.1, 0.12, ry, 63 - 8);
  B.red.box(cx, y + h - 0.1, cz, L, 0.1, 0.1, ry); B.red.box(cx, y + h * 0.5, cz, L, 0.06, 0.06, ry); B.red.box(cx, y + 0.1, cz, L, 0.06, 0.06, ry);
}
// 红灯笼（y = 挂点）
const _lg = new THREE.SphereGeometry(1, 7, 5);
function lantern(g, M, x, y, z, r = 0.26) {
  const m = new THREE.Mesh(_lg, M.lantern); m.scale.set(r, r * 0.85, r); m.position.set(x, y - 0.22 - r * 0.85, z); g.add(m);
  g.add(cyl(r * 0.4, r * 0.4, 0.06, M.gold, x, y - 0.25, z, 6), cyl(0.04, 0.015, r * 0.9, M.gold, x, y - 0.22 - r * 2.6, z, 4));
}

// 平曲桥的一段：石板桥面 + 桥墩 + 石望柱栏杆
function flatBridge(B, x1, z1, x2, z2, w, deckY = 0.9) {
  const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz), ry = Math.atan2(-dz, dx), ux = dx / L, uz = dz / L, cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  B.stone.box(cx, deckY - 0.4, cz, L + w * 0.5, 0.4, w, ry);
  const np = Math.max(1, Math.round(L / 5));
  for (let i = 0; i <= np; i++) B.stoneD.box(x1 + dx * i / np, 0, z1 + dz * i / np, 0.7, deckY - 0.4, w * 0.7, ry, 51);
  for (const s of [-1, 1]) { const ox = -uz * s * (w / 2 - 0.14), oz = ux * s * (w / 2 - 0.14); balustrade(B, x1 + ox, z1 + oz, x2 + ox, z2 + oz, deckY, 1.8); }
}
// 廊桥：桥面 + 双排红柱 + 额枋 + 坐凳栏杆 + 灰瓦顶 + 灯笼
function coveredBridge(g, B, M, x1, z1, x2, z2, w, deckY = 0.9) {
  const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz), ry = Math.atan2(-dz, dx), ux = dx / L, uz = dz / L, cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  B.stone.box(cx, deckY - 0.45, cz, L, 0.45, w + 0.3, ry);
  const np = Math.max(2, Math.round(L / 6)), n = Math.max(2, Math.round(L / 3.4));
  for (let i = 0; i <= np; i++) B.stoneD.box(x1 + dx * i / np, 0, z1 + dz * i / np, 0.8, deckY - 0.45, w * 0.8, ry, 51);
  for (const s of [-1, 1]) {
    const ox = -uz * s * (w / 2 - 0.25), oz = ux * s * (w / 2 - 0.25);
    for (let i = 0; i <= n; i++) { const t = (0.3 + i * (L - 0.6) / n) / L; g.add(cyl(0.18, 0.2, 3.1, M.col, x1 + dx * t + ox, deckY, z1 + dz * t + oz, 8)); if (i % 2 === 1 && s > 0) lantern(g, M, x1 + dx * t, deckY + 3.0, z1 + dz * t, 0.24); }
    B.col.box(cx + ox, deckY + 2.8, cz + oz, L, 0.3, 0.2, ry); B.teal.box(cx + ox, deckY + 2.56, cz + oz, L - 0.4, 0.24, 0.12, ry);
    B.red.box(cx + ox, deckY + 0.45, cz + oz, L - 0.4, 0.08, 0.34, ry).box(cx + ox, deckY, cz + oz, L - 0.4, 0.45, 0.06, ry).box(cx + ox * 1.12, deckY + 0.8, cz + oz * 1.12, L - 0.4, 0.07, 0.08, ry);
  }
  B.wood.box(cx, deckY + 3.1, cz, L, 0.25, w + 0.3, ry);
  g.add(tangRoof({ w: L + 1.6, d: w + 2.6, h: 1.9, ridge: L - 1.2, material: M.roof, x: cx, y: deckY + 3.35, z: cz, ry, soffit: 1.2 }));
}
// 石拱桥：桥面随拱起坡，桥下留拱洞
function archBridge(g, M, x1, z1, x2, z2, w, rise = 2.3, y0 = 0.9) {
  const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz), n = 14, hw = w / 2, bS = new Bat(), bR = new Bat();
  const top = (t) => y0 + rise * (1 - (2 * t - 1) ** 2);
  const und = (t) => { const u = (2 * t - 1) / (5 / 7); return Math.abs(u) < 0.999 ? Math.min(top(t) - 0.45, (y0 + rise - 0.5) * Math.sqrt(1 - u * u)) : 0; };
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, xa = -L / 2 + t0 * L, xb = -L / 2 + t1 * L, ya = top(t0), yb = top(t1), ua = und(t0), ub = und(t1);
    bS.quad([xa, ya, hw], [xb, yb, hw], [xb, yb, -hw], [xa, ya, -hw]);
    bS.quad([xa, ua, hw], [xb, ub, hw], [xb, yb, hw], [xa, ya, hw]); bS.quad([xb, ub, -hw], [xa, ua, -hw], [xa, ya, -hw], [xb, yb, -hw]);
    bS.quad([xa, ua, -hw], [xb, ub, -hw], [xb, ub, hw], [xa, ua, hw]);
    for (const s of [-1, 1]) {
      const zz = s * (hw - 0.14);
      bR.box(xa, ya, zz, 0.2, 1.0, 0.2, 0, 63 - 8); bR.box(xa, ya + 1.0, zz, 0.27, 0.1, 0.27);
      if (i === n - 1) { bR.box(xb, yb, zz, 0.2, 1.0, 0.2, 0, 63 - 8); bR.box(xb, yb + 1.0, zz, 0.27, 0.1, 0.27); }
      for (const [lo, hi, th] of [[0.68, 0.82, 0.07], [0.1, 0.58, 0.035]]) {
        bR.quad([xa, ya + lo, zz + th], [xb, yb + lo, zz + th], [xb, yb + hi, zz + th], [xa, ya + hi, zz + th]);
        bR.quad([xb, yb + lo, zz - th], [xa, ya + lo, zz - th], [xa, ya + hi, zz - th], [xb, yb + hi, zz - th]);
        bR.quad([xa, ya + hi, zz + th], [xb, yb + hi, zz + th], [xb, yb + hi, zz - th], [xa, ya + hi, zz - th]);
      }
    }
  }
  const ry = Math.atan2(-dz, dx);
  g.add(put(bS.mesh(M.stone), (x1 + x2) / 2, 0, (z1 + z2) / 2, 0, ry), put(bR.mesh(M.marble), (x1 + x2) / 2, 0, (z1 + z2) / 2, 0, ry));
}

/** 亭子：石台基 + 角柱 + 额枋彩画 + 坐凳栏杆 + 攒尖顶；tiers=2 为重檐。sides = 4 / 6 / 8 */
function pavilion(g, B, M, x, z, y, r, colH, sides, { roof = M.roof, tiers = 1, lanterns = true } = {}) {
  const n = sides, sq = n === 4, by = y + 0.6;
  if (sq) { B.stone.box(x, y, z, r * 2 + 2.2, 0.6, r * 2 + 2.2, 0, 63 - 8); B.stone.box(x, y, z, r * 2 + 3.0, 0.3, r * 2 + 3.0, 0, 63 - 8); }
  else g.add(polyCyl(r + 1.1, r + 1.2, 0.6, n, M.stone, x, y, z), polyCyl(r + 1.6, r + 1.6, 0.3, n, M.stone, x, y, z));
  const pts = sq ? [[r, r], [r, -r], [-r, -r], [-r, r]] : Array.from({ length: n }, (_, i) => [Math.sin(i * 2 * Math.PI / n) * r, Math.cos(i * 2 * Math.PI / n) * r]);
  pts.forEach(([px, pz], i) => {
    g.add(cyl(0.2, 0.23, colH, M.col, x + px, by, z + pz, 8)); B.stoneD.box(x + px, by, z + pz, 0.62, 0.14, 0.62, 0, 63 - 8);
    const [qx, qz] = pts[(i + 1) % n], mx = x + (px + qx) / 2, mz = z + (pz + qz) / 2, L = Math.hypot(qx - px, qz - pz), ry = Math.atan2(-(qz - pz), qx - px);
    B.col.box(mx, by + colH - 0.36, mz, L, 0.36, 0.2, ry); B.teal.box(mx, by + colH - 0.62, mz, L - 0.42, 0.26, 0.12, ry);
    if (i % 2 === (sq ? 0 : 1)) { B.red.box(mx, by + 0.44, mz, L - 0.42, 0.08, 0.36, ry).box(mx, by, mz, L - 0.42, 0.44, 0.06, ry).box(mx, by + 0.82, mz, L - 0.42, 0.07, 0.08, ry); }
    if (lanterns && i % 2 === 0) lantern(g, M, mx, by + colH - 0.6, mz, 0.24);
  });
  const ry0 = by + colH;
  if (tiers === 1) {
    if (sq) g.add(tangRoof({ w: r * 2 + 3.4, d: r * 2 + 3.4, h: r * 1.1 + 1.3, ridge: 0, material: roof, x, y: ry0, z, soffit: 1.5 }));
    else g.add(roundRoof({ r: r + 1.8, h: r * 1.0 + 1.3, sides: n, material: roof, x, y: ry0, z, soffit: 1.6 }));
    return;
  }
  const h1 = r * 0.55 + 0.8, r2 = r * 0.56, dh = 1.35;
  if (sq) {
    g.add(tangRoof({ w: r * 2 + 3.4, d: r * 2 + 3.4, h: h1, ridge: 0, material: roof, x, y: ry0, z, skirt: true, soffit: 1.5 }));
    B.col.box(x, ry0 + h1 * 0.35, z, r2 * 2, h1 * 0.65 + dh, r2 * 2, 0, 51); B.teal.box(x, ry0 + h1 + dh - 0.3, z, r2 * 2 + 0.1, 0.3, r2 * 2 + 0.1, 0, 51);
    B.lat.box(x, ry0 + h1 + 0.1, z, r2 * 2 + 0.06, dh - 0.5, r2 * 2 + 0.06, 0, 51);
    g.add(tangRoof({ w: r2 * 2 + 3.0, d: r2 * 2 + 3.0, h: r2 * 1.2 + 1.5, ridge: 0, material: roof, x, y: ry0 + h1 + dh, z, soffit: 1.4 }));
  } else {
    g.add(roundRoof({ r: r + 1.8, h: h1, sides: n, material: roof, x, y: ry0, z, finial: false, soffit: 1.6 }));
    g.add(polyCyl(r2, r2, h1 * 0.65 + dh, n, M.col, x, ry0 + h1 * 0.35, z), polyCyl(r2 + 0.05, r2 + 0.05, 0.3, n, M.tealM, x, ry0 + h1 + dh - 0.3, z), polyCyl(r2 + 0.03, r2 + 0.03, dh - 0.5, n, M.lat, x, ry0 + h1 + 0.1, z));
    g.add(roundRoof({ r: r2 + 1.6, h: r2 * 1.1 + 1.5, sides: n, material: roof, x, y: ry0 + h1 + dh, z, soffit: 1.5 }));
  }
}

// 一段回廊（中心 x,z，沿 ry 方向长 len）：石台基、内侧红柱 + 额枋 + 坐凳栏杆、外侧粉墙（青砖墙裙、漏窗、瓦压顶）、灰瓦顶、灯笼
function corridor(g, B, M, len, x, z, ry, outer) {
  const dep = 5, c = Math.cos(ry), s = Math.sin(ry), W = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const bx = (b, lx, y, lz, sx, sy, sz, faces = 63) => { const [wx, wz] = W(lx, lz); b.box(wx, y, wz, sx, sy, sz, ry, faces); };
  bx(B.stone, 0, 0, 0, len, 0.5, dep + 0.4, 63 - 8);
  const n = Math.max(2, Math.round(len / 4.4)), zi = -outer * (dep / 2 - 0.4), zo = outer * (dep / 2 - 0.3), bay = (len - 0.6) / n;
  for (let i = 0; i <= n; i++) {
    const lx = -len / 2 + 0.3 + i * bay, [wx, wz] = W(lx, zi);
    g.add(cyl(0.2, 0.23, 3.3, M.col, wx, 0.5, wz, 8)); bx(B.stoneD, lx, 0.5, zi, 0.6, 0.12, 0.6, 63 - 8);
    if (i < n) {
      const mx = lx + bay / 2;
      if (i % 4 !== 2) { bx(B.red, mx, 0.94, zi, bay - 0.5, 0.08, 0.36); bx(B.red, mx, 0.5, zi, bay - 0.5, 0.44, 0.06); bx(B.red, mx, 1.3, zi - outer * 0.16, bay - 0.5, 0.07, 0.08); }
      bx(B.lat, mx, 1.95, zo - outer * 0.31, 1.7, 1.25, 0.04, outer > 0 ? 32 : 16); bx(B.lat, mx, 1.95, zo + outer * 0.31, 1.7, 1.25, 0.04, outer > 0 ? 16 : 32);     // 漏窗（内外两面）
      bx(B.grey, mx, 1.85, zo, 1.95, 1.45, 0.64, 16 + 32);
      if (i % 2 === 0) { const [qx, qz] = W(mx, zi); lantern(g, M, qx, 3.5, qz, 0.24); }
    }
  }
  bx(B.col, 0, 3.5, zi, len, 0.32, 0.2); bx(B.teal, 0, 3.24, zi, len - 0.4, 0.26, 0.12);
  bx(B.white, 0, 1.4, zo, len, 2.7, 0.6, 63 - 8 - 4); bx(B.brick, 0, 0.5, zo, len, 0.9, 0.66, 63 - 8); bx(B.grey, 0, 4.1, zo, len, 0.3, 0.7);
  bx(B.wood, 0, 3.82, 0, len, 0.3, dep - 0.4);
  g.add(tangRoof({ w: len + 1.5, d: dep + 2.4, h: 2.2, ridge: len, material: M.roof, x, y: 4.25, z, ry, soffit: 1.3 }));
}

// 门殿（三间，明间通行）：两侧墙墩 + 红柱 + 额枋斗拱 + 灰瓦庑殿顶；main = 正门（门扇、门钉、踏步）
function gate(g, B, M, x, z, ry, main) {
  const c = Math.cos(ry), s = Math.sin(ry), W = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const bx = (b, lx, y, lz, sx, sy, sz, faces = 63) => { const [wx, wz] = W(lx, lz); b.box(wx, y, wz, sx, sy, sz, ry, faces); };
  bx(B.stone, 0, 0, 0, 16, 0.3, 10.5, 63 - 8);
  for (const k of [-1, 1]) {
    bx(B.brick, k * 5.6, 0.3, 0, 2.6, 1.0, 7.1, 63 - 8); bx(B.white, k * 5.6, 1.3, 0, 2.5, 4.2, 7, 63 - 8 - 4);
    for (const t of [-1, 1]) { bx(B.lat, k * 5.6, 2.3, t * 3.52, 1.5, 1.5, 0.04, t > 0 ? 16 : 32); const [wx, wz] = W(k * 4.2, t * 3.3); g.add(cyl(0.3, 0.33, 5.2, M.col, wx, 0.3, wz, 10)); bx(B.stoneD, k * 4.2, 0.3, t * 3.3, 0.9, 0.18, 0.9, 63 - 8); }
    for (const t of [-1, 1]) { const [wx, wz] = W(k * 7.0, t * 3.3); g.add(cyl(0.3, 0.33, 5.2, M.col, wx, 0.3, wz, 10)); }
    if (main) {
      bx(B.verm, k * 4.05, 0.3, -1.2, 0.12, 4.2, 2.6);
      for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { const [wx, wz] = W(k * 3.97, -2.2 + j * 0.62); g.add(put(new THREE.Mesh(_nail, M.gold), wx, 0.9 + i * 0.6, wz)); }
    }
  }
  for (const t of [-1, 1]) { bx(B.col, 0, 5.0, t * 3.3, 14.6, 0.4, 0.26); bx(B.teal, 0, 4.68, t * 3.3, 14.2, 0.32, 0.14); for (let i = 0; i < 9; i++) bx(B.wood, -6.8 + i * 1.7, 5.4, t * 3.4, 0.6, 0.5, 0.9); }
  bx(B.wood, 0, 5.4, 0, 14.4, 0.5, 6.4);
  g.add(tangRoof({ w: 18.4, d: 11.6, h: 3.7, material: M.roof, x, y: 5.9, z, ry, soffit: 2.3 }));
  if (main) for (let i = 0; i < 2; i++) for (const t of [-1, 1]) bx(B.stone, 0, 0, t * (5.25 + 0.2 + i * 0.4), 8.4, 0.3 * (1 - i / 2), 0.4, 63 - 8);
}
let _nail;

// 画舫（船头朝 +X）
function boat(g, B, M, x, z, ry) {
  const b = new THREE.Group(), hull = new THREE.Shape();
  hull.moveTo(-5.5, -1.3); hull.lineTo(3.6, -1.3); hull.quadraticCurveTo(5.6, -0.9, 6.6, 0); hull.quadraticCurveTo(5.6, 0.9, 3.6, 1.3); hull.lineTo(-5.5, 1.3); hull.lineTo(-6.1, 0.7); hull.lineTo(-6.1, -0.7); hull.closePath();
  const hg = new THREE.ExtrudeGeometry(hull, { depth: 1.0, bevelEnabled: false, curveSegments: 5 }); hg.rotateX(-Math.PI / 2);
  b.add(put(new THREE.Mesh(hg, M.wood), 0, 0.1, 0), box(11, 0.08, 2.3, M.plank, -0.6, 1.1, 0));
  for (const sx of [-3.6, -0.6, 2.4]) for (const sz of [-1, 1]) b.add(cyl(0.09, 0.1, 2.3, M.col, sx, 1.18, sz * 1.0, 6));
  for (const sz of [-1, 1]) b.add(box(6, 0.5, 0.05, M.red, -0.6, 1.18, sz * 1.0), box(6, 0.4, 0.05, M.lat, -0.6, 2.9, sz * 1.0), box(6.2, 0.14, 0.12, M.col, -0.6, 3.34, sz * 1.0));
  b.add(tangRoof({ w: 8.2, d: 3.6, h: 1.0, ridge: 5.6, material: M.roof, x: -0.6, y: 3.48, z: 0, rings: 4, seg: 4, lift: 0.3 }));
  b.add(cyl(0.05, 0.06, 2.6, M.wood, 4.6, 1.1, 0, 5));
  b.position.set(x, 0, z); b.rotation.y = ry; g.add(b);
  lantern(g, M, x + Math.cos(ry) * 4.6, 3.75, z - Math.sin(ry) * 4.6, 0.3);
}

// 石狮（蹲坐，面朝 +Z）
function lion(x, z, M) {
  const L = new THREE.Group(), s = M.stoneD, top = 1.05;
  L.add(box(1.1, 0.22, 1.6, s), box(0.92, 0.66, 1.42, M.stone, 0, 0.22, 0), box(1.1, 0.17, 1.6, s, 0, 0.88, 0));
  const S = (r, sx, sy, sz, px, py, pz) => { const m = sphere(r, s, px, top + py, pz, 10); m.scale.set(sx, sy, sz); return m; };
  L.add(S(0.4, 1, 1.05, 1.3, 0, 0.42, -0.12), S(0.36, 1, 1.25, 0.95, 0, 0.72, 0.2), S(0.4, 1.05, 1, 0.95, 0, 1.2, 0.22), S(0.3, 1, 0.95, 1, 0, 1.24, 0.42));
  L.add(box(0.3, 0.2, 0.22, s, 0, top + 1.07, 0.6));
  for (const k of [-1, 1]) L.add(cyl(0.1, 0.13, 0.8, s, k * 0.22, top, 0.46, 7), S(0.25, 0.9, 1, 1.25, k * 0.3, 0.24, -0.2), box(0.1, 0.12, 0.08, s, k * 0.2, top + 1.52, 0.3));
  L.position.set(x, 0, z); return L;
}

export function build() {
  const g = new THREE.Group();
  const roofM = mat(ROOF, { map: patternTex('roofTile', ROOF) });
  const M = {
    stone: mat(C.stone), stoneD: mat(C.stoneDark), marble: mat(C.marble), brick: mat(C.cityWall), pave: mat(C.paving),
    col: mat(C.tangRed), red: mat(C.vermilion), verm: mat(C.vermilion), wood: mat(C.darkWood), plank: mat(C.wood), white: mat(C.wallWhite), grey: mat(0x5b6066),
    roof: roofM, roofGreen: mat(C.tileGreen), ridge: mat(0x565c63), gold: mat(C.gold), tealM: mat(0x1f6b73),
    lat: mat(0x3a2418), grass: mat(C.grass), rock: mat(C.rock), water: mat(C.water, { shiny: true }), leaf: mat(0x4c8a46), pink: mat(C.peonyPink),
    lantern: mat(0xd8321e, { emissive: 0xd02a12, emissiveIntensity: 0.55 }), glow: mat(0xf2e2b0, { emissive: 0xffd890, emissiveIntensity: 0.5 }),
  };
  const B = {}; for (const k of ['stone', 'stoneD', 'marble', 'brick', 'col', 'red', 'verm', 'wood', 'white', 'grey', 'teal', 'lat']) B[k] = new Bat();
  _nail = new THREE.IcosahedronGeometry(0.06, 0);
  const r = rng(42);

  // ── 湖面 + 叠石驳岸 + 岸边草坡 + 环湖石径 + 院内草坪 ──
  const lake = shore(1), rim = shore(1.035), bank = shore(1.085), path = shore(1.15);
  g.add(slab(lake, ISL.map(i => blob(i.x, i.z, i.rx * 1.02, i.rz * 1.02, i.seed)), 0.05, M.water, 0.1));
  g.add(slab(rim, [lake], 0.55, M.rock, 0));
  g.add(slab(bank, [rim], 0.05, M.grass, 0.1));
  g.add(slab(path, [bank], 0.06, M.pave, 0.12));
  g.add(slab([[-CW.x + 3, -CW.z + 3], [CW.x - 3, -CW.z + 3], [CW.x - 3, CW.z - 3], [-CW.x + 3, CW.z - 3]], [path], 0.05, M.grass, 0.1));
  // 四门通往环湖石径的甬道
  const rS = lakeR(Math.PI / 2, 1.12), rN = lakeR(-Math.PI / 2, 1.12), rE = lakeR(0, 1.12), rW = lakeR(Math.PI, 1.12);
  g.add(plaza(6, CW.z - 2 - (LZ + rS), M.pave, 0, (CW.z - 2 + LZ + rS) / 2, 0.21), plaza(6, CW.z - 2 + (LZ - rN), M.pave, 0, (-CW.z + 2 + LZ - rN) / 2, 0.21));
  g.add(plaza(CW.x - 2 - rE, 6, M.pave, (CW.x - 2 + rE) / 2, LZ, 0.21), plaza(CW.x - 2 - rW, 6, M.pave, -(CW.x - 2 + rW) / 2, LZ, 0.21));

  // ── 岛屿：叠石岸 + 草面 + 散置湖石 ──
  for (const i of ISL) {
    g.add(slab(blob(i.x, i.z, i.rx * 1.02, i.rz * 1.02, i.seed), [], 0.9, M.rock, 0));
    g.add(slab(blob(i.x, i.z, i.rx * 0.95, i.rz * 0.95, i.seed), [], 0.4, M.grass, 0.9));
  }
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  const rock = (x, z, s, y = 0.3) => { const m = new THREE.Mesh(rockGeo, M.rock); m.position.set(x, y + s * 0.2, z); m.scale.set(s * (0.8 + r() * 0.6), s * (0.45 + r() * 0.5), s * (0.8 + r() * 0.6)); m.rotation.set(r() * 3, r() * 3, r() * 3); g.add(m); };
  for (const i of ISL) for (let k = 0; k < 9; k++) { const a = k * 0.7 + i.seed, q = 0.9 + r() * 0.08; rock(i.x + Math.cos(a) * i.rx * q, i.z + Math.sin(a) * i.rz * q, 0.6 + r() * 0.7, 0.7); }
  for (let k = 0; k < 26; k++) { const a = r() * Math.PI * 2, rr = lakeR(a, 1.0 + r() * 0.03); rock(LX + rr * Math.cos(a), LZ + rr * Math.sin(a), 0.6 + r() * 0.7); }
  for (const [x, z, s] of [[-50, -24, 2.2], [-52.5, -21, 1.6], [-47.5, -26, 1.4], [-51, -27, 1.1]]) { rock(x, z, s, IY); rock(x + 0.4, z - 0.3, s * 0.6, IY + s * 0.5); }          // 瑶光殿西侧假山

  // ── 瑶光殿（重檐歇山，岛上主殿）+ 殿前月台 ──
  const T = { wallH: 6.2, roofH: 5.6, eave: 2.3, platformH: 1.5, shrink: 0.2, ridge: 8 };
  g.add(hall({ w: YG.w, d: YG.d, wallH: T.wallH, roofH: T.roofH, eave: T.eave, platformH: T.platformH, tiers: 2, tierShrink: T.shrink, ridge: T.ridge, ornaments: false,
    wall: C.wallWhite, column: C.tangRed, roof: ROOF, x: YG.x, y: IY, z: YG.z }));
  const cw1 = YG.w * (1 - T.shrink), cd1 = YG.d * (1 - T.shrink), roofY = IY + T.platformH + T.wallH + 0.45 + T.roofH * 0.45 * 0.55 + T.wallH * 0.6 + 0.45;
  xieshan(g, M, { w: cw1 + T.eave * 2, d: cd1 + T.eave * 2, h: T.roofH, ridge: T.ridge, gx: cw1 / 2 - 1.0, x: YG.x, y: roofY, z: YG.z });
  g.add(sign('瑶光殿', 4.6, 1.5, { bg: '#1f2a44', fg: '#e8c25a', border: '#c99a35', x: YG.x, y: roofY - 1.15, z: YG.z + cd1 / 2 + 1.0 }));
  const tz = YG.z + (YG.d + T.eave * 1.3) / 2 + 2.2;                       // 月台：殿前石铺平台 + 香炉 + 石灯
  g.add(plaza(18, 9, M.pave, YG.x, tz + 3.2, IY + 0.05));
  g.add(cyl(0.7, 0.5, 0.75, M.gold, YG.x, IY + 0.95, tz + 4.2, 10), cyl(0.78, 0.78, 0.08, M.gold, YG.x, IY + 1.7, tz + 4.2, 10));
  for (let i = 0; i < 3; i++) { const a = i * 2.094; g.add(cyl(0.09, 0.06, 0.6, M.gold, YG.x + Math.sin(a) * 0.45, IY + 0.4, tz + 4.2 + Math.cos(a) * 0.45, 5)); }
  B.stone.box(YG.x, IY, tz + 4.2, 1.9, 0.4, 1.9, 0, 63 - 8);
  const stoneLamp = (lx, lz, y = 0.15) => {
    B.stoneD.box(lx, y, lz, 0.7, 0.2, 0.7, 0, 63 - 8).box(lx, y + 0.2, lz, 0.26, 1.0, 0.26, 0, 51).box(lx, y + 1.2, lz, 0.62, 0.12, 0.62).box(lx, y + 1.75, lz, 0.84, 0.1, 0.84);
    g.add(box(0.44, 0.43, 0.44, M.glow, lx, y + 1.32, lz), cyl(0.03, 0.48, 0.32, M.stoneD, lx, y + 1.85, lz, 4));
  };
  for (const s of [-1, 1]) stoneLamp(YG.x + s * 6.5, tz + 1.2, IY);
  // 岛上配亭 + 岛上松树
  pavilion(g, B, M, -49, -6, IY, 2.3, 3.2, 6);
  pavilion(g, B, M, -9, -5, IY, 2.0, 3.0, 4);

  // ── 望景台：收分砖台 + 石基 + 压檐 + 朱栏 + 正面对称蹬道 + 台上重檐方阁 ──
  {
    const { x, z, s, h } = WJ, st = s - 1.0, yT = IY + h, zf = z + s / 2;
    B.brick.taper(x, IY, z, s, s, st, st, h);
    B.stone.box(x, IY, z, s + 0.4, 0.8, s + 0.4, 0, 51 + 4); B.grey.box(x, yT - 0.3, z, st + 0.5, 0.3, st + 0.5); B.stone.box(x, yT, z, st + 0.1, 0.06, st + 0.1, 0, 4);
    const e = st / 2 - 0.25;
    woodRail(B, x - e, z - e, x + e, z - e, yT); woodRail(B, x - e, z - e, x - e, z + e, yT); woodRail(B, x + e, z - e, x + e, z + e, yT);
    woodRail(B, x - e, z + e, x - 1.5, z + e, yT); woodRail(B, x + 1.5, z + e, x + e, z + e, yT);
    const n = 20, run = (s / 2 - 1.5) / n;                                    // 两跑蹬道沿正面墙对称而上，在正中平台汇合
    for (const k of [-1, 1]) for (let i = 0; i < n; i++) {
      const sx = x + k * (s / 2 - (i + 0.5) * run), top = (i + 1) * h / n;
      B.brick.box(sx, IY, zf + 1.1, run, top - 0.1, 2.2, 0, 16 + (k > 0 ? 1 : 2)); B.stone.box(sx, IY + top - 0.1, zf + 1.1, run + 0.03, 0.1, 2.2, 0, 63 - 8);
    }
    B.brick.box(x, IY, zf + 1.1, 3.0, h, 2.2, 0, 16); B.stone.box(x, yT - 0.02, zf + 1.1, 3.0, 0.06, 2.2, 0, 4 + 16);
    for (const k of [-1, 1]) woodRail(B, x + k * 1.5, zf + 2.1, x + k * (s / 2), zf + 2.1, IY, 0.9);   // 仅示意：蹬道外侧底部护栏
    woodRail(B, x - 1.5, zf + 2.1, x + 1.5, zf + 2.1, yT);
    g.add(hall({ w: 8, d: 8, wallH: 3.6, roofH: 3.6, eave: 1.7, platformH: 0.35, steps: false, ridge: 0, tiers: 2, tierShrink: 0.24, wall: C.wallWhite, column: C.tangRed, roof: ROOF, x, y: yT, z }));
    g.add(sign('望景台', 4.2, 1.2, { bg: '#1f2a44', fg: '#e8c25a', border: '#c99a35', x, y: IY + 3.3, z: zf + 2.26 }));
  }
  // ── 九洲亭（重檐八角）、琉璃亭（绿琉璃六角）──
  pavilion(g, B, M, 20, 24, IY, 3.2, 3.6, 8, { tiers: 2 });
  g.add(sign('九洲亭', 2.2, 0.75, { bg: '#1f2a44', fg: '#e8c25a', border: '#c99a35', x: 20, y: IY + 0.6 + 3.6 + 0.35, z: 24 + 3.2 + 1.0 }));
  pavilion(g, B, M, -74, 22, IY, 2.5, 3.3, 6, { roof: M.roofGreen, tiers: 2 });

  // ── 桥 ──
  const zig = (pts, w, y) => { for (let i = 0; i < pts.length - 1; i++) flatBridge(B, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, y); };
  zig([[24, 73], [16, 60], [26, 46], [18, 35]], 3, 0.9);                               // 南岸 → 九洲亭岛（曲桥）
  coveredBridge(g, B, M, 12, 18, -12, 0, 4);                                           // 九洲亭岛 → 瑶光殿岛（廊桥）
  coveredBridge(g, B, M, 0, -12, 34, -22, 4);                                          // 瑶光殿岛 → 望景台岛（廊桥）
  archBridge(g, M, 65, -28, 104, -32, 4.2, 2.4, 0.75);                                 // 望景台岛 → 东岸（石拱桥）
  zig([[-64, 18], [-56, 10], [-50, 6]], 3, 0.9);                                       // 琉璃亭岛 → 瑶光殿岛
  archBridge(g, M, -84, 25, -105, 31, 3.4, 1.7, 0.75);                                 // 琉璃亭岛 → 西岸（小拱桥）
  zig([[-30, -34], [-24, -48], [-32, -60], [-28, -72]], 3, 0.9);                       // 瑶光殿岛 → 北岸

  // ── 四周回廊 + 四门 + 角亭 ──
  const gw = 7;
  for (const s of [-1, 1]) {
    const lenX = CW.x - gw, lenZ = CW.z - gw;
    corridor(g, B, M, lenX, s * (CW.x + gw) / 2, CW.z, 0, 1);                           // 南
    corridor(g, B, M, lenX, s * (CW.x + gw) / 2, -CW.z, 0, -1);                         // 北
    corridor(g, B, M, lenZ, CW.x, s * (CW.z + gw) / 2, Math.PI / 2, 1);                 // 东（外墙在 +X）
    corridor(g, B, M, lenZ, -CW.x, s * (CW.z + gw) / 2, Math.PI / 2, -1);               // 西（外墙在 -X）
  }
  GATES.forEach(([x, z, ry], i) => gate(g, B, M, x, z, ry, i === 0));
  g.add(sign('九洲池', 5, 1.5, { bg: '#1f2a44', fg: '#e8c25a', border: '#c99a35', x: 0, y: 4.5, z: CW.z + 3.46 }));
  g.add(lion(-6.6, CW.z + 7, M), lion(6.6, CW.z + 7, M));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) pavilion(g, B, M, sx * CW.x, sz * CW.z, 0, 3.2, 3.8, 4, { tiers: 2, lanterns: false });

  // ── 画舫、荷叶 ──
  boat(g, B, M, -34, 40, 0.35); boat(g, B, M, 66, 14, -2.6);
  const leafGeo = new THREE.CircleGeometry(1, 9); leafGeo.rotateX(-Math.PI / 2);
  for (const [a, q] of [[0.5, 0.9], [1.25, 0.88], [2.0, 0.9], [2.75, 0.92], [3.6, 0.9], [4.3, 0.87], [5.1, 0.9], [5.9, 0.92], [1.6, 0.6], [4.75, 0.55]]) {
    const cx = LX + lakeR(a, q) * Math.cos(a), cz = LZ + lakeR(a, q) * Math.sin(a);
    for (let k = 0; k < 16; k++) {
      const px = cx + (r() - 0.5) * 11, pz = cz + (r() - 0.5) * 7, sr = 0.5 + r() * 0.55;
      const m = new THREE.Mesh(leafGeo, M.leaf); m.position.set(px, 0.2 + r() * 0.12, pz); m.scale.set(sr, 1, sr); g.add(m);
      if (k % 5 === 0) g.add(cyl(0.02, 0.02, 0.6, M.leaf, px + 0.3, 0.15, pz, 3), put(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.36, 6), M.pink), px + 0.3, 0.9, pz));
    }
  }

  // ── 湖岸垂柳、环湖石灯、院内乔木、牡丹花圃 ──
  for (let i = 0; i < 60; i++) {
    const a = (i + r() * 0.5) / 60 * Math.PI * 2, rr = lakeR(a, 1.06);
    const x = LX + rr * Math.cos(a), z = LZ + rr * Math.sin(a);
    if (Math.abs(z - 73) < 6 && Math.abs(x - 24) < 6 || Math.abs(x - 104) < 5 && Math.abs(z + 32) < 5 || Math.abs(x + 105) < 5 && Math.abs(z - 31) < 5 || Math.abs(x + 28) < 5 && z < -60) continue;
    g.add(tree(x, z, 8.5 + r() * 3, 'willow'));
  }
  for (let i = 0; i < 28; i++) { const a = (i + 0.5) / 28 * Math.PI * 2, rr = lakeR(a, 1.165); stoneLamp(LX + rr * Math.cos(a), LZ + rr * Math.sin(a)); }
  for (let i = 0; i < 30; i++) {
    const x = -CW.x + 12 + r() * (CW.x * 2 - 24), z = (r() < 0.5 ? -1 : 1) * (CW.z - 9 - r() * 5);
    if (Math.abs(x) < 10) continue;
    g.add(tree(x, z, 9 + r() * 4, r() < 0.35 ? 'pine' : r() < 0.5 ? 'plane' : 'round'));
  }
  for (const s of [-1, 1]) for (let i = 0; i < 7; i++) g.add(tree(s * (CW.x - 10 - r() * 5), -70 + i * 23 + r() * 6, 9 + r() * 3, i % 3 ? 'round' : 'pine'));
  for (const i of ISL.slice(0, 2)) for (let k = 0; k < 5; k++) { const a = k * 1.3 + i.seed; g.add(tree(i.x + Math.cos(a) * i.rx * 0.75, i.z + Math.sin(a) * i.rz * 0.75, 7, k % 2 ? 'pine' : 'round', IY)); }
  for (const s of [-1, 1]) for (let i = 0; i < 7; i++) { g.add(tree(s * (7 + (i % 2) * 2.2), 84 + i * 2.2, 1.5, 'peonyBush')); g.add(tree(s * (7 + (i % 2) * 2.2), -84 - i * 2.2, 1.5, 'peonyBush')); }

  const matOf = { stone: M.stone, stoneD: M.stoneD, marble: M.marble, brick: M.brick, col: M.col, red: M.red, verm: M.verm, wood: M.wood, white: M.white, grey: M.grey, teal: M.tealM, lat: M.lat };
  for (const k of Object.keys(B)) if (B[k].p.length) g.add(B[k].mesh(matOf[k]));
  return finalize(g);
}
