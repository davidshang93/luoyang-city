// 天子驾六博物馆（周王城广场）。+Z = 南（广场正面）。
// 北半：灰白石材的低矮入口建筑（约 50x52m，盝顶：平屋顶 + 四坡瓦檐），正中凹入式门廊、方石柱、青铜大门（门钉）、馆名匾；门前一对子母阙、一对青铜方鼎、旗杆。
// 南半：广场中央“天子驾六”青铜群雕——六匹奔马（两列 x 三排）牵引一辆带华盖的轺车，立在 2m 高的石台上；四周铺装分区、花坛牡丹、行道树、路灯。
import { THREE, C, mat, box, cyl, sphere, plaza, tangRoof, sign, tree, lamp, flag, finalize } from './_kit.js';

const MUS = { x0: -25, x1: 25, zB: -54.5, zF: -3, zR: -6.5, port: 9, plinth: 0.9, wallTop: 8.2 };   // zR = 门廊后墙，port = 门廊半宽
const SC = { z: 21, w: 10, d: 24, top: 2.4 };                                                       // 群雕石台
const QUE = [[-15.5, 6], [15.5, 6]];

export const meta = {
  colliders: [
    { x: 0, z: (MUS.zB + MUS.zR) / 2, w: 50, d: MUS.zR - MUS.zB },                                   // 博物馆主体
    { x: -(MUS.port + 25) / 2, z: (MUS.zR + MUS.zF) / 2, w: 25 - MUS.port, d: MUS.zF - MUS.zR },     // 门廊两翼
    { x: (MUS.port + 25) / 2, z: (MUS.zR + MUS.zF) / 2, w: 25 - MUS.port, d: MUS.zF - MUS.zR },
    { x: 0, z: SC.z, w: SC.w + 1.6, d: SC.d + 1.6 },                                                 // 雕塑石台
    ...QUE.map(([x, z]) => ({ x: x + Math.sign(x) * 1.0, z, w: 5.6, d: 2.8 })),                      // 子母阙
    ...[-1, 1].flatMap(s => [{ x: s * 28, z: 14, w: 16, d: 9 }, { x: s * 28, z: 38, w: 16, d: 9 }]), // 花坛
  ],
};

// ── 小批处理器（kit 的 Batch 没有导出）
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
  /** 收分方柱（四面梯形 + 顶）：底 wb x db，顶 wt x dt */
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

const UP = new THREE.Vector3(0, 1, 0);
/** 两点之间的圆台（a 端半径 r0，b 端 r1） */
function seg(grp, M, a, b, r0, r1, n = 8) {
  const A = new THREE.Vector3(a[0], a[1], a[2]), d = new THREE.Vector3(b[0], b[1], b[2]).sub(A), L = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, L, n, 1), M);
  m.position.copy(A).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(UP, d.normalize()); grp.add(m); return m;
}
/** 椭球 */
function ell(grp, M, c, rx, ry, rz, n = 12) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, n, Math.max(6, Math.round(n * 0.66))), M); m.scale.set(rx, ry, rz); m.position.set(c[0], c[1], c[2]); grp.add(m); return m; }

// 奔马（朝 +Z，蹄底 y≈0；pose 0 = 四蹄伸展腾跃，1 = 收蹄蓄势）。单位尺度下身长约 4.4m，肩高约 3.3m。
function horse(M, pose, s = 0.82) {
  const h = new THREE.Group(), b = M.bronze, d = M.bronzeD;
  ell(h, b, [0, 2.78, 0], 0.72, 0.8, 1.7); ell(h, b, [0, 2.9, 1.2], 0.7, 0.92, 0.9); ell(h, b, [0, 2.95, -1.3], 0.76, 0.88, 0.98);        // 躯干、胸、臀
  seg(h, b, [0, 3.05, 1.55], [0, 4.4, 2.6], 0.66, 0.36, 10);                                                                               // 颈
  ell(h, b, [0, 4.45, 2.62], 0.34, 0.4, 0.42, 8); seg(h, b, [0, 4.5, 2.6], [0, 3.85, 3.6], 0.36, 0.2, 8); ell(h, b, [0, 3.83, 3.62], 0.2, 0.2, 0.24, 8);   // 头、吻
  seg(h, b, [0, 4.2, 2.75], [0, 3.72, 3.35], 0.22, 0.14, 6);                                                                               // 下颌
  for (const k of [-1, 1]) seg(h, b, [k * 0.17, 4.7, 2.5], [k * 0.22, 5.08, 2.36], 0.09, 0.02, 5);                                         // 耳
  for (let i = 0; i < 6; i++) { const t = i / 5, m = box(0.1, 0.5 - t * 0.12, 0.42, d, 0, 0, 0); m.position.set(0, 3.55 + t * 1.2, 1.25 + t * 1.05); m.rotation.x = -0.75; h.add(m); }   // 鬃
  h.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0, 3.3, -2.1], [0, 3.6, -2.75], [0, 3.25, -3.4], [0, 2.5, -3.9]].map(p => new THREE.Vector3(p[0], p[1], p[2]))), 8, 0.15, 6), d));   // 尾
  const legs = pose === 0
    ? [[[0.38, 2.45, 1.35], [0.38, 1.85, 2.35], [0.38, 1.3, 3.2]], [[-0.38, 2.45, 1.35], [-0.38, 1.65, 2.2], [-0.38, 0.9, 2.85]],
      [[0.44, 2.6, -1.4], [0.44, 1.55, -2.15], [0.44, 0.14, -2.7]], [[-0.44, 2.6, -1.4], [-0.44, 1.45, -1.95], [-0.44, 0.14, -2.4]]]
    : [[[0.38, 2.45, 1.35], [0.38, 1.6, 2.1], [0.38, 1.05, 1.45]], [[-0.38, 2.45, 1.35], [-0.38, 1.75, 2.3], [-0.38, 1.0, 1.85]],
      [[0.44, 2.6, -1.4], [0.44, 1.5, -1.6], [0.44, 0.14, -1.0]], [[-0.44, 2.6, -1.4], [-0.44, 1.45, -1.85], [-0.44, 0.14, -1.35]]];
  legs.forEach(([a, k, f], i) => {
    seg(h, b, a, k, i < 2 ? 0.3 : 0.36, 0.15, 7); ell(h, b, k, 0.16, 0.16, 0.16, 6); seg(h, b, k, f, 0.13, 0.09, 6);
    const hoof = cyl(0.11, 0.15, 0.2, d, f[0], f[1] - 0.14, f[2], 7); h.add(hoof);
  });
  h.add(put(new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.09, 5, 14), d), 0, 3.15, 1.62, 0.95));      // 轭（颈圈）
  seg(h, d, [0.3, 4.05, 3.3], [0.5, 3.4, 1.7], 0.03, 0.03, 4); seg(h, d, [-0.3, 4.05, 3.3], [-0.5, 3.4, 1.7], 0.03, 0.03, 4);   // 缰
  h.scale.setScalar(s);
  return h;
}
function put(m, x, y, z, rx = 0, ry = 0, rz = 0) { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); return m; }

// 轺车（朝 +Z）：双轮（辐条）、车舆、辕、衡、华盖伞、驭者。原点 = 两轮中点的地面
function chariot(M) {
  const c = new THREE.Group(), b = M.bronze, d = M.bronzeD, R = 1.55;
  for (const sx of [-1, 1]) {
    c.add(put(new THREE.Mesh(new THREE.TorusGeometry(R, 0.11, 6, 28), d), sx * 2.05, R, 0, 0, Math.PI / 2));
    const hub = cyl(0.26, 0.26, 0.7, b, 0, 0, 0, 10); hub.rotation.z = Math.PI / 2; hub.position.set(sx * 2.05, R, 0); c.add(hub);
    for (let k = 0; k < 9; k++) c.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.07, R * 2 - 0.1, 0.07), b), sx * 2.05, R, 0, k * Math.PI / 9));
  }
  const ax = cyl(0.1, 0.1, 4.7, d, 0, 0, 0, 8); ax.rotation.z = Math.PI / 2; ax.position.set(0, R, 0); c.add(ax);
  // 车舆：底板 + 四周栏（立柱 + 上下横枋），后面留口
  c.add(box(3.0, 0.22, 2.5, b, 0, R + 0.1, 0));
  const rail = (x0, z0, x1, z1) => {
    const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.abs(x1 - x0) > 0.01 ? 0 : Math.PI / 2, n = Math.round(L / 0.42);
    c.add(box(L, 0.1, 0.1, d, (x0 + x1) / 2, R + 1.22, (z0 + z1) / 2, ry), box(L, 0.07, 0.07, d, (x0 + x1) / 2, R + 0.76, (z0 + z1) / 2, ry));
    for (let i = 0; i <= n; i++) c.add(box(0.07, 0.95, 0.07, b, x0 + (x1 - x0) * i / n, R + 0.3, z0 + (z1 - z0) * i / n));
  };
  rail(-1.42, 1.18, 1.42, 1.18); rail(-1.42, -1.18, -1.42, 1.18); rail(1.42, -1.18, 1.42, 1.18); rail(-1.42, -1.18, -0.55, -1.18); rail(0.55, -1.18, 1.42, -1.18);
  // 辕（曲木，前端上翘）+ 衡
  c.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0, R + 0.05, -1.0], [0, R + 0.05, 1.6], [0, R + 0.5, 4.2], [0, R + 1.35, 6.3], [0, R + 1.75, 7.1]].map(p => new THREE.Vector3(p[0], p[1], p[2]))), 14, 0.12, 6), d));
  const heng = cyl(0.09, 0.09, 4.4, d, 0, 0, 0, 6); heng.rotation.z = Math.PI / 2; heng.position.set(0, R + 1.72, 7.0); c.add(heng);
  // 华盖：伞杆 + 伞面 + 伞骨 + 盖弓帽垂饰 + 顶珠
  const uy = R + 4.9, ur = 3.1;
  c.add(cyl(0.07, 0.09, 4.7, d, 0, R + 0.3, -0.2, 6));
  c.add(put(new THREE.Mesh(new THREE.ConeGeometry(ur, 0.95, 20, 1, true), M.bronzeDS), 0, uy + 0.47, -0.2));
  c.add(put(new THREE.Mesh(new THREE.TorusGeometry(ur, 0.07, 5, 20), d), 0, uy, -0.2, Math.PI / 2));
  for (let k = 0; k < 20; k++) { const a = k * Math.PI / 10; seg(c, d, [0, uy + 0.97, -0.2], [Math.sin(a) * ur, uy + 0.02, -0.2 + Math.cos(a) * ur], 0.035, 0.035, 4); c.add(cyl(0.02, 0.07, 0.34, b, Math.sin(a) * ur, uy - 0.36, -0.2 + Math.cos(a) * ur, 5)); }
  c.add(sphere(0.2, b, 0, uy + 1.12, -0.2, 8), cyl(0.2, 0.3, 0.14, d, 0, uy + 0.9, -0.2, 8));
  // 驭者：长袍、双臂前伸执辔、冠
  c.add(cyl(0.3, 0.52, 1.7, b, 0, R + 0.32, 0.45, 10)); ell(c, b, [0, R + 2.3, 0.45], 0.25, 0.3, 0.26, 8); c.add(box(0.36, 0.2, 0.3, d, 0, R + 2.55, 0.42));
  for (const sx of [-1, 1]) { seg(c, b, [sx * 0.36, R + 1.85, 0.45], [sx * 0.3, R + 1.5, 1.2], 0.13, 0.09, 6); seg(c, d, [sx * 0.3, R + 1.5, 1.2], [sx * 0.9, R + 2.05, 7.6], 0.025, 0.025, 4); }
  return c;
}

// 子母阙：母阙（重檐）+ 外侧子阙。out = 子阙所在一侧 (+1/-1)
function que(g, B, M, x, z, out) {
  const tower = (cx, w, d, h, tiers) => {
    B.stoneD.box(cx, 0.15, z, w + 0.7, 0.5, d + 0.7, 0, 63 - 8);
    B.wall.taper(cx, 0.65, z, w, d, w - 0.3, d - 0.2, h);
    for (let k = 0; k < 4; k++) B.wall.box(cx, 0.65 + h * (0.22 + k * 0.2), z, w - 0.07 * (k + 1) * 0.3 * 2 + 0.1, 0.08, d + 0.06);          // 石块缝线
    let y = 0.65 + h, ww = w - 0.3, dd = d - 0.2;
    for (let t = 0; t < tiers; t++) {
      for (let k = 0; k < 3; k++) B.wall.box(cx, y + k * 0.22, z, ww + (k + 1) * 0.36, 0.22, dd + (k + 1) * 0.36, 0, 63 - (k < 2 ? 4 : 0));   // 层层外挑的斗拱石
      B.frieze.box(cx, y + 0.66, z, ww + 1.0, 0.42, dd + 1.0, 0, 51);
      g.add(tangRoof({ w: ww + 2.7, d: dd + 2.5, h: 1.15, ridge: ww * 0.75, material: M.roof, x: cx, y: y + 1.08, z, rings: 4, seg: 4 }));
      y += 1.08 + 0.5;
      if (t < tiers - 1) { ww *= 0.72; dd *= 0.72; B.wall.box(cx, y, z, ww, 0.9, dd, 0, 51); y += 0.9; }
    }
  };
  tower(x, 2.9, 2.0, 6.4, 2);
  tower(x + out * 2.5, 2.0, 1.6, 4.0, 1);
}

// 青铜方鼎（立在石座上）
function ding(g, B, M, x, z) {
  B.stone.box(x, 0.15, z, 3.0, 0.7, 2.4, 0, 63 - 8);
  const y = 0.85, b = M.bronze, d = M.bronzeD;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(0.17, 0.12, 0.95, b, x + sx * 0.82, y, z + sz * 0.55, 7));
  g.add(box(2.2, 1.15, 1.6, b, x, y + 0.9, z), box(2.34, 0.14, 1.74, d, x, y + 2.0, z), box(2.24, 0.3, 1.64, d, x, y + 1.3, z));
  for (const sx of [-1, 1]) { g.add(box(0.14, 0.62, 0.5, b, x + sx * 0.9, y + 2.14, z), box(0.16, 0.14, 0.62, d, x + sx * 0.9, y + 2.76, z)); }
}

export function build() {
  const g = new THREE.Group();
  const M = {
    wall: mat(0xd6d3c8), stone: mat(C.stone), stoneD: mat(C.stoneDark), frieze: mat(0x5a5348), roof: mat(C.tileGrey), glass: mat(C.glassDark),
    bronze: mat(C.bronze), bronzeD: mat(0x45392a, { shiny: true }), bronzeDS: mat(0x45392a, { shiny: true, double: true }), gold: mat(C.gold),
    pave: mat(C.paving), grass: mat(C.grass), verm: mat(C.tangRed),
    glow: mat(0xfff0c0, { emissive: 0xffd890, emissiveIntensity: 0.6 }), lit: mat(0x39424c, { emissive: 0xffd9a0, emissiveIntensity: 0.2 }),
  };
  const B = {}; for (const k of ['wall', 'stone', 'stoneD', 'frieze', 'glass', 'lit']) B[k] = new Bat();

  // ── 广场铺装：整片石铺地 + 中轴深色石带 + 雕塑周围一圈深色石
  g.add(plaza(88, 108, M.pave, 0, 0, 0.15));
  g.add(plaza(22, 52, M.stoneD, 0, 27.5, 0.2));
  g.add(plaza(16, 30, M.stone, 0, SC.z, 0.25));
  for (const s of [-1, 1]) g.add(plaza(1.2, 104, M.stoneD, s * 36, 0, 0.2), plaza(1.2, 52, M.stoneD, s * 12, 27.5, 0.26));

  // ── 博物馆 ──────────────────────────────────────────
  const { x0, x1, zB, zF, zR, port, plinth, wallTop } = MUS, cz = (zB + zF) / 2, dep = zF - zB, Y0 = 0.15 + plinth;
  B.stoneD.box(0, 0.15, cz, 52.4, plinth, dep + 2.4, 0, 63 - 8).box(0, Y0 - 0.14, cz, 52.7, 0.14, dep + 2.7);
  for (let i = 0; i < 6; i++) B.stone.box(0, 0.15, zF + 1.2 + 0.18 + i * 0.36, 22, plinth * (1 - i / 6), 0.36, 0, 63 - 8 - 32);      // 正面大台阶
  for (const s of [-1, 1]) B.stoneD.box(s * 11.5, 0.15, zF + 2.3, 1.0, plinth + 0.35, 2.3, 0, 63 - 8);
  const wh = wallTop - Y0;
  B.wall.box(0, Y0, (zB + zR) / 2, 50, wh, zR - zB, 0, 63 - 8);                                            // 主体
  for (const s of [-1, 1]) B.wall.box(s * (port + 25) / 2, Y0, (zR + zF) / 2, 25 - port, wh, zF - zR, 0, 63 - 8 - 32);   // 两翼
  B.wall.box(0, Y0 + 5.7, (zR + zF) / 2, port * 2, wh - 5.7, zF - zR, 0, 16 + 8 + 4);                       // 门廊上方过梁
  // 墙面：深色石勒脚、壁柱、檐下青铜饰带、每间一扇竖条窗
  const side = (ax, c, a, b, sg) => {            // ax 0: 沿 X 的墙面（z=c），1: 沿 Z 的墙面（x=c）；sg = 朝外方向
    const L = b - a, n = Math.round(L / 6.2), bw = L / n, ry = ax ? Math.PI / 2 : 0;
    const at = (t, o) => (ax ? [c + sg * o, t] : [t, c + sg * o]);
    { const [px, pz] = at((a + b) / 2, 0.07); B.stoneD.box(px, Y0, pz, L, 1.2, 0.14, ry, 63 - 8); const [qx, qz] = at((a + b) / 2, 0.06); B.frieze.box(qx, wallTop - 1.15, qz, L, 0.75, 0.12, ry); }
    for (let i = 0; i <= n; i++) { const [px, pz] = at(a + i * bw, 0.11); B.wall.box(px, Y0, pz, 0.95, wh, 0.22, ry, 63 - 8); }
    for (let i = 0; i < n; i++) { const [px, pz] = at(a + (i + 0.5) * bw, 0.02); B.glass.box(px, Y0 + 2.0, pz, 1.3, 3.6, 0.04, ry); const [qx, qz] = at(a + (i + 0.5) * bw, 0.05); B.stoneD.box(qx, Y0 + 1.82, qz, 1.7, 0.18, 0.1, ry).box(qx, Y0 + 5.6, qz, 1.7, 0.18, 0.1, ry); }
  };
  side(0, zB, x0, x1, -1); side(1, x0, zB, zF, -1); side(1, x1, zB, zF, 1); side(0, zF, x0, -port, 1); side(0, zF, port, x1, 1);
  // 门廊：方石柱 4 根、后墙青铜大门（门钉 + 铺首）、两侧玻璃门、馆名匾
  for (const cx of [-6, -2.6, 2.6, 6]) { B.stone.box(cx, Y0, zF - 0.7, 1.0, 5.7, 1.0, 0, 51); B.stoneD.box(cx, Y0, zF - 0.7, 1.2, 0.5, 1.2, 0, 63 - 8).box(cx, Y0 + 5.3, zF - 0.7, 1.25, 0.4, 1.25, 0, 63 - 4); }
  B.frieze.box(0, Y0, zR + 0.12, 5.0, 4.9, 0.24, 0, 63 - 8 - 32);
  const nail = new THREE.IcosahedronGeometry(0.07, 0);
  for (const s of [-1, 1]) {
    g.add(box(2.2, 4.5, 0.12, M.bronze, s * 1.12, Y0, zR + 0.3));
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) g.add(put(new THREE.Mesh(nail, M.gold), s * (0.4 + j * 0.48), Y0 + 0.7 + i * 0.66, zR + 0.4));
    g.add(put(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 5, 10), M.gold), s * 0.3, Y0 + 2.1, zR + 0.42));
    B.lit.box(s * 5.6, Y0, zR + 0.04, 3.4, 3.6, 0.06); B.frieze.box(s * 5.6, Y0 + 3.6, zR + 0.06, 3.8, 0.25, 0.14).box(s * 5.6, Y0, zR + 0.08, 0.12, 3.6, 0.14);
  }
  g.add(sign('天子驾六博物馆', 13, 1.5, { bg: '#26221d', fg: '#e8cf8a', border: '#8a6d2f', emissive: true, x: 0, y: Y0 + 6.55, z: zF + 0.05 }));
  for (const cx of [-7.6, -4.3, 0, 4.3, 7.6]) g.add(box(0.5, 0.06, 0.5, M.glow, cx, Y0 + 5.62, zF - 1.9));          // 门廊顶的筒灯
  // 盝顶：四坡瓦檐 + 中间平屋顶（带高侧窗的阁楼层）
  B.frieze.box(0, wallTop, cz, 50.5, 0.3, dep + 0.5);
  g.add(tangRoof({ w: 55.5, d: dep + 5.5, h: 3.0, ridge: 22, material: M.roof, y: wallTop + 0.3, z: cz, skirt: true, soffit: 2.9, lift: 0.5 }));
  const aw = 33, ad = 25, ay = wallTop + 0.3;
  B.wall.box(0, ay, cz, aw, 3.3, ad, 0, 63 - 8); B.lit.box(0, ay + 1.75, cz, aw + 0.08, 0.95, ad + 0.08, 0, 51); B.frieze.box(0, ay + 3.3, cz, aw + 0.6, 0.28, ad + 0.6);
  for (let i = 0; i <= 10; i++) for (const s of [-1, 1]) B.wall.box(-aw / 2 + i * aw / 10, ay + 1.7, cz + s * (ad / 2 + 0.03), 0.5, 1.05, 0.12);
  for (let i = 0; i <= 8; i++) for (const s of [-1, 1]) B.wall.box(s * (aw / 2 + 0.03), ay + 1.7, cz - ad / 2 + i * ad / 8, 0.12, 1.05, 0.5);

  // ── 门前：子母阙、方鼎、旗杆
  que(g, B, M, QUE[0][0], QUE[0][1], -1); que(g, B, M, QUE[1][0], QUE[1][1], 1);
  ding(g, B, M, -8.6, 2.6); ding(g, B, M, 8.6, 2.6);
  for (let i = 0; i < 3; i++) g.add(flag(-31 + i * 2.6, 2, i === 1 ? 15 : 13.5));

  // ── “天子驾六”青铜群雕 ─────────────────────────────
  const bz = SC.z, top = SC.top;
  B.stoneD.box(0, 0.15, bz, SC.w + 1.6, 0.45, SC.d + 1.6, 0, 63 - 8).box(0, top - 0.3, bz, SC.w + 0.5, 0.3, SC.d + 0.5);
  B.stone.box(0, 0.6, bz, SC.w, top - 0.9, SC.d, 0, 51);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) B.frieze.box(s * (SC.w / 2 + 0.04), 1.0, bz - 7.6 + i * 7.6, 0.08, 0.95, 6.2);     // 两侧青铜浮雕板
  g.add(sign('天子驾六', 4.6, 1.15, { bg: '#26221d', fg: '#e8cf8a', border: '#8a6d2f', x: 0, y: 1.45, z: bz + SC.d / 2 + 0.06 }));
  [8.0, 2.9, -2.2].forEach((rz, ri) => { for (const sx of [-1, 1]) { const h = horse(M, (ri + (sx > 0 ? 1 : 0)) % 2); h.position.set(sx * 1.75, top, bz + rz); g.add(h); } });
  const ch = chariot(M); ch.position.set(0, top, bz - 8.4); g.add(ch);
  seg(g, M.bronzeD, [0, top + 3.25, bz - 1.3], [0, top + 3.0, bz + 9.0], 0.07, 0.07, 5);                          // 长辕延伸到头排
  for (const rz of [9.3, 4.2]) { const y = cyl(0.07, 0.07, 3.6, M.bronzeD, 0, 0, 0, 5); y.rotation.z = Math.PI / 2; y.position.set(0, top + 3.0, bz + rz); g.add(y); }
  for (let i = 0; i < 10; i++) for (const s of [-1, 1]) g.add(box(0.5, 0.12, 0.5, M.glow, s * (SC.w / 2 + 1.6), 0.26, bz - 11.2 + i * 2.5));   // 地埋灯

  // ── 花坛（石围边 + 草地 + 牡丹）、行道树、路灯、石凳
  for (const s of [-1, 1]) for (const z of [14, 38]) {
    B.stone.box(s * 28, 0.15, z, 16, 0.5, 9, 0, 51).box(s * 28, 0.65, z, 16.3, 0.1, 9.3, 0, 63 - 8);
    g.add(plaza(15.2, 8.2, M.grass, s * 28, z, 0.78));
    for (let i = 0; i < 5; i++) g.add(tree(s * 28 - 5.6 + i * 2.8, z + (i % 2 ? 1.6 : -1.6), 1.9, 'peonyBush', 0.78));
    g.add(tree(s * 28, z, 6.5, 'pine', 0.78));
    for (const zz of [z - 5.6, z + 5.6]) B.stoneD.box(s * 28, 0.15, zz, 3.2, 0.45, 0.6, 0, 63 - 8);
  }
  for (const s of [-1, 1]) for (let i = 0; i <= 10; i++) g.add(tree(s * 39.5, -48 + i * 9.6, 10 + (i % 2 ? 0 : 1.2), 'plane'));
  for (const s of [-1, 1]) for (const z of [10, 24, 38, 51]) { const l = lamp(s * 16.5, z, 6.5); l.rotation.y = s > 0 ? Math.PI : 0; g.add(l); }

  const matOf = { wall: M.wall, stone: M.stone, stoneD: M.stoneD, frieze: M.frieze, glass: M.glass, lit: M.lit };
  for (const k of Object.keys(B)) if (B[k].p.length) g.add(B[k].mesh(matOf[k]));
  return finalize(g);
}
