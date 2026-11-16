// 洛邑古城 — 老城里的仿古文旅街区。+Z=南。
// 外圈 + 内圈两层仿古街屋围出环形步行街（硬山 / 庑殿灰瓦顶、红柱、格扇门窗、挑廊、幌子、檐下灯笼，街上横拉灯笼串）；
// 南面正中三门洞城门楼“洛邑古城”（青砖城台、垛口、门钉大门、重檐歇山城楼、石狮），门内大道上立四柱三楼牌坊；
// 中央“新潭”水面（圆角驳岸）：水上戏台、九曲桥 + 六角亭、廊桥 + 重檐方亭、八角亭、乌篷船、荷叶；东西两条水系（石拱桥、垂柳）；
// 北侧文庙大成殿、西侧三重檐楼阁、东侧书院；南岸灯笼墙。夜里窗、灯笼都会亮。
// 文峰塔由独立模块放在本地 (85, 165)（占地南缘外），南缘 x∈[62,108] 留空做成水边平台。
import { THREE, C, mat, box, cyl, sphere, plaza, hall, tangRoof, roundRoof, sign, tree, patternTex, rng, finalize } from './_kit.js';

const DEPTH = 14;          // 街屋进深
const GATE = { z: 142, w: 56, d: 14, h: 9 };
const POND = { x: 0, z: -5, w: 150, d: 90 };
const PAIFANG = { z: 97, cols: [-8.6, -3.6, 3.6, 8.6] };

// 街屋带：axis 'x' = 沿 X 排列（中心 z=c），axis 'z' = 沿 Z 排列（中心 x=c）；face = 正面朝向 (+1/-1)
const BANDS = [
  // 外圈（正面朝内）
  { axis: 'x', c: -143, a: -210, b: -7, face: 1 }, { axis: 'x', c: -143, a: 7, b: 210, face: 1 },
  { axis: 'x', c: 143, a: -210, b: -GATE.w / 2 - 1, face: -1 }, { axis: 'x', c: 143, a: GATE.w / 2 + 1, b: 61, face: -1 }, { axis: 'x', c: 143, a: 109, b: 210, face: -1 },
  { axis: 'z', c: -203, a: -136, b: -7, face: 1 }, { axis: 'z', c: -203, a: 7, b: 136, face: 1 },
  { axis: 'z', c: 203, a: -136, b: -7, face: -1 }, { axis: 'z', c: 203, a: 7, b: 136, face: -1 },
  // 内圈（正面朝外，面向环形步行街）
  { axis: 'x', c: -117, a: -184, b: -8, face: -1 }, { axis: 'x', c: -117, a: 8, b: 184, face: -1 },
  { axis: 'x', c: 117, a: -184, b: -20, face: 1 }, { axis: 'x', c: 117, a: 20, b: 184, face: 1 },
  { axis: 'z', c: -177, a: -110, b: -7, face: -1 }, { axis: 'z', c: -177, a: 7, b: 110, face: -1 },
  { axis: 'z', c: 177, a: -110, b: -7, face: 1 }, { axis: 'z', c: 177, a: 7, b: 110, face: 1 },
];

// 内部院落街区中心（每个约 30x32）
const COURTS = [[-125, 72], [125, 72], [-125, -78], [125, 40], [-70, 85], [70, 85]];

// 城门：4 个墩（门洞：中 7m，两侧 5m）
const PIERS = [[-28, -13.5], [-8.5, -3.5], [3.5, 8.5], [13.5, 28]];
const OPENINGS = [[-13.5, -8.5, 5.5], [-3.5, 3.5, 7], [8.5, 13.5, 5.5]];

export const meta = {
  colliders: [
    ...BANDS.map(b => b.axis === 'x'
      ? { x: (b.a + b.b) / 2, z: b.c, w: b.b - b.a, d: DEPTH }
      : { x: b.c, z: (b.a + b.b) / 2, w: DEPTH, d: b.b - b.a }),
    ...PIERS.map(([a, b]) => ({ x: (a + b) / 2, z: GATE.z, w: b - a, d: GATE.d })),
    ...COURTS.flatMap(([cx, cz]) => [
      { x: cx, z: cz - 11, w: 30, d: 10 }, { x: cx, z: cz + 11, w: 30, d: 10 },
      { x: cx - 11, z: cz, w: 10, d: 8 }, { x: cx + 11, z: cz, w: 10, d: 8 },
    ]),
    { x: 0, z: -85, w: 34, d: 18 },        // 北侧大成殿
    { x: -125, z: -5, w: 18, d: 18 },        // 西侧楼阁
    { x: 125, z: -30, w: 22, d: 12 },        // 东侧书院
    ...PAIFANG.cols.map(x => ({ x, z: PAIFANG.z, w: 1.1, d: 1.6 })),   // 牌坊柱
  ],
};

// ── 小批处理器（kit 的 Batch 没有导出）：把很多盒子 / 面片攒成一个网格；at() 设置之后所有图元的平移 + 绕 Y 旋转
class Bat {
  constructor() { this.p = []; this.u = []; this.c = 1; this.s = 0; this.ox = 0; this.oy = 0; this.oz = 0; }
  at(x = 0, z = 0, ry = 0, y = 0) { this.ox = x; this.oy = y; this.oz = z; this.c = Math.cos(ry); this.s = Math.sin(ry); return this; }
  v(q, s, t) { this.p.push(this.ox + q[0] * this.c + q[2] * this.s, this.oy + q[1], this.oz - q[0] * this.s + q[2] * this.c); this.u.push(s, t); }
  quad(a, b, c, d, uw = 1, uh = 1) { this.v(a, 0, 0); this.v(b, uw, 0); this.v(c, uw, uh); this.v(a, 0, 0); this.v(c, uw, uh); this.v(d, 0, uh); return this; }
  tri(a, b, c) { this.v(a, 0, 0); this.v(b, 1, 0); this.v(c, 0.5, 1); return this; }
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
  /** 追加一个现成几何体（只取位置），缩放后放到 (x,y,z) */
  geo(g, x, y, z, sx = 1, sy = sx, sz = sx) {
    const P = g.attributes.position, I = g.index, n = I ? I.count : P.count;
    for (let i = 0; i < n; i++) { const k = I ? I.getX(i) : i; this.v([x + P.getX(k) * sx, y + P.getY(k) * sy, z + P.getZ(k) * sz], 0, 0); }
    return this;
  }
  mesh(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.computeVertexNormals();
    return new THREE.Mesh(g, material);
  }
}
const put = (m, x, y, z, rx = 0, ry = 0, rz = 0) => { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); return m; };
function polyCyl(rt, rb, h, n, material, x, y, z) { const geo = new THREE.CylinderGeometry(rt, rb, h, n, 1).toNonIndexed(); geo.deleteAttribute('normal'); geo.computeVertexNormals(); return put(new THREE.Mesh(geo, material), x, y + h / 2, z); }
// 平面多边形（可带洞）挤出成薄片/台
function slab(outer, holes, h, material, y) {
  const V = (p) => new THREE.Vector2(p[0], -p[1]);
  const shape = new THREE.Shape(outer.map(V));
  for (const hpts of holes) shape.holes.push(new THREE.Path(hpts.map(V)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, material); m.position.y = y; return m;
}
// 新潭岸线：圆角矩形（超椭圆）+ 轻微起伏；grow = 向外扩的米数
const pondPts = (grow = 0, n = 72) => {
  const p = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), k = 1 + 0.018 * Math.sin(5 * a + 1); p.push([POND.x + Math.sign(c) * Math.pow(Math.abs(c), 0.55) * (POND.w / 2 + grow) * k, POND.z + Math.sign(s) * Math.pow(Math.abs(s), 0.55) * (POND.d / 2 + grow) * k]); }
  return p;
};
/** 两层 hall() 的上层屋顶位置（和 kit 里 hall 的排布公式一致） */
const hallTop = ({ w, d, wallH, roofH, eave, platformH, shrink }) => { const cy1 = platformH + wallH + 0.45 + roofH * 0.45 * 0.55; return { cw: w * (1 - shrink), cd: d * (1 - shrink), roofY: cy1 + wallH * 0.6 + 0.45, rw: w * (1 - shrink) + eave * 2, rd: d * (1 - shrink) + eave * 2 }; };

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
  const r = rng(20251114);
  const latTex = patternTex('lattice', 0xd9c9a2, 0x4a2a1a);
  const M = {
    roof: mat(C.tileGrey), ridge: mat(0x4b5057),
    white: mat(C.wallWhite), cream: mat(0xe8dcc2), brick: mat(C.brickGrey), cityWall: mat(C.cityWall),
    stone: mat(C.stone), stoneD: mat(C.stoneDark), marble: mat(C.marble),
    col: mat(C.tangRed), red: mat(C.vermilion), wood: mat(C.darkWood), plank: mat(C.wood), teal: mat(0x1f6b73), gold: mat(C.gold), signB: mat(0x1c2a44),
    lat: mat(0xffffff, { map: latTex, emissive: 0xffb060, emissiveIntensity: 0.25, key: 'luoyiLattice' }),
    lantern: mat(0xd8321e, { emissive: 0xd02810, emissiveIntensity: 0.6 }),
    banner: [mat(0xb3261e, { double: true }), mat(0x2c4f8a, { double: true }), mat(0xd9a531, { double: true })],
    pave: mat(C.paving), paveRed: mat(0xb9ab92, { map: patternTex('stone', 0xb9ab92) }),
    water: mat(C.water, { shiny: true }), leaf: mat(0x4c8a46), pink: mat(C.peonyPink),
  };
  if (latTex) M.lat.emissiveMap = latTex;                 // 夜里只有窗纸透光，窗棂保持暗
  const B = {}; for (const k of ['roof', 'ridge', 'white', 'cream', 'brick', 'cityWall', 'stone', 'stoneD', 'marble', 'col', 'red', 'wood', 'teal', 'gold', 'signB', 'lat', 'lantern', 'banner0', 'banner1', 'banner2']) B[k] = new Bat();
  const setT = (x = 0, z = 0, ry = 0) => { for (const k in B) B[k].at(x, z, ry); };
  const ICO = new THREE.IcosahedronGeometry(1, 0), SPH = new THREE.SphereGeometry(1, 7, 5);
  /** 朝 +Z 的格扇面片（背面 = 朝 -Z） */
  const latQ = (cx, y, z, w, h, back = false) => back
    ? B.lat.quad([cx + w / 2, y, z], [cx - w / 2, y, z], [cx - w / 2, y + h, z], [cx + w / 2, y + h, z], w / 1.1, h / 1.1)
    : B.lat.quad([cx - w / 2, y, z], [cx + w / 2, y, z], [cx + w / 2, y + h, z], [cx - w / 2, y + h, z], w / 1.1, h / 1.1);
  // 精致灯笼（世界坐标；y = 挂点）
  const lantern = (x, y, z, rad = 0.3) => {
    B.lantern.geo(SPH, x, y - 0.2 - rad * 0.85, z, rad, rad * 0.85, rad);
    B.gold.box(x, y - 0.24, z, rad * 0.8, 0.07, rad * 0.8).box(x, y - 0.2 - rad * 1.7 - 0.05, z, rad * 0.7, 0.07, rad * 0.7).box(x, y - 0.2 - rad * 2.6, z, 0.06, rad * 0.8, 0.06, 0, 51);
  };
  const shopSigns = ['茶', '酒', '客栈', '汉服'];
  let nHouse = 0;

  // ── 单栋街屋（本地正面朝 +Z），直接写进批处理器
  function house(hx, hz, ry, w, d) {
    setT(hx, hz, ry); nHouse++;
    const floors = r() < 0.38 ? 3 : 2, fh = 3.5, H = floors * fh, y0 = 0.4, v = r(), wallB = v < 0.55 ? B.white : v < 0.78 ? B.cream : B.brick;
    const hip = floors === 3 ? r() < 0.55 : r() < 0.2, balc = r() < 0.55, zf = d / 2 - 0.3;
    B.stone.box(0, 0, 0, w, y0, d, 0, 51 + 4);
    wallB.box(0, y0, 0, w - 0.2, H, d - 0.6, 0, 51);
    if (wallB !== B.brick) B.brick.box(0, y0, -zf - 0.02, w - 0.2, 0.9, 0.06, 0, 32).box(0, y0, 0, w - 0.14, 0.9, d - 0.66, 0, 3);   // 背面、侧面青砖墙裙
    for (const s of [-1, 1]) B.lat.box(s * (w / 2 - 0.09), y0 + fh + 1.1, 0, 0.04, 1.3, 1.4, 0, s > 0 ? 1 : 2);                       // 侧面小窗
    const nb = Math.max(2, Math.round(w / 3.3)), bay = (w - 0.4) / nb;
    for (let i = 0; i <= nb; i++) B.col.box(-w / 2 + 0.2 + i * bay, y0, zf + 0.06, 0.28, H, 0.28, 0, 16 + 1 + 2);
    for (let f = 0; f < floors; f++) {
      const yf = y0 + f * fh;
      B.wood.box(0, yf + fh - 0.42, zf + 0.04, w - 0.3, 0.42, 0.2, 0, 16 + 8); B.teal.box(0, yf + fh - 0.66, zf + 0.02, w - 0.5, 0.24, 0.14, 0, 16 + 8);
      for (let i = 0; i < nb; i++) {
        const cx = -w / 2 + 0.2 + (i + 0.5) * bay, pw = bay - 0.5;
        if (f === 0) { latQ(cx, yf + 0.55, zf + 0.03, pw, 2.25); B.wood.box(cx, yf, zf + 0.03, pw, 0.55, 0.06, 0, 16); }
        else { latQ(cx, yf + 0.95, zf + 0.03, pw - 0.2, 1.8); B.wood.box(cx, yf + 0.83, zf + 0.06, pw, 0.12, 0.18, 0, 16 + 4 + 8); }
        if (f > 0 || i % 2) latQ(cx, yf + 1.15, -zf - 0.03, Math.min(1.5, pw - 0.5), 1.3, true);       // 背面小窗
      }
    }
    if (balc) {                                                                                          // 二层挑廊 + 朱栏
      const by = y0 + fh, bz = zf + 0.95;
      B.wood.box(0, by - 0.12, zf + 0.55, w - 0.1, 0.13, 0.95, 0, 63 - 32);
      B.red.box(0, by + 0.86, bz, w - 0.2, 0.09, 0.09, 0, 63 - 3).box(0, by + 0.3, bz, w - 0.2, 0.06, 0.06, 0, 16 + 32 + 4);
      for (let i = 0; i <= nb * 2; i++) B.red.box(-w / 2 + 0.2 + i * bay / 2, by, bz, 0.09, 0.9, 0.09, 0, 16 + 1 + 2 + 32);
    } else if (floors === 2 || r() < 0.5) {                                                              // 一层披檐
      const ye = y0 + fh, x = w / 2;
      B.roof.quad([-x, ye - 0.15, zf + 1.4], [x, ye - 0.15, zf + 1.4], [x, ye + 0.55, zf + 0.1], [-x, ye + 0.55, zf + 0.1]);
      B.wood.quad([x, ye - 0.2, zf + 1.4], [-x, ye - 0.2, zf + 1.4], [-x, ye + 0.5, zf + 0.1], [x, ye + 0.5, zf + 0.1]).box(0, ye - 0.3, zf + 1.36, w, 0.14, 0.08, 0, 16 + 8);
    }
    // 屋顶：庑殿（kit 曲面顶）或 硬山（两段举折的瓦坡 + 山墙 + 正脊）
    if (hip) g.add(tangRoof({ w: w + 1.4, d: d + 2.4, h: 2.5 + (floors - 2) * 0.4, ridge: w * 0.72, lift: 0.5, rings: 3, seg: 4, material: M.roof, x: hx, y: y0 + H, z: hz, ry }));
    else {
      const hd = d / 2 + 1.2, rh = 2.5 + (floors - 2) * 0.3, yE = y0 + H - 0.25, ym = yE + rh * 0.36, yR = yE + rh, x = w / 2 + 0.04;
      for (const s of [1, -1]) {
        const A = [-s * x, yE, s * hd], Bq = [s * x, yE, s * hd], Cq = [s * x, ym, s * hd / 2], Dq = [-s * x, ym, s * hd / 2], E = [s * x, yR, 0], F = [-s * x, yR, 0];
        B.roof.quad(A, Bq, Cq, Dq).quad(Dq, Cq, E, F);
        B.wood.quad([Bq[0], yE - 0.06, Bq[2]], [A[0], yE - 0.06, A[2]], [Dq[0], ym - 0.06, Dq[2]], [Cq[0], ym - 0.06, Cq[2]]).box(0, yE - 0.2, s * (hd - 0.05), w, 0.16, 0.1, 0, (s > 0 ? 16 : 32) + 8);
      }
      for (const s of [1, -1]) {                                                                          // 山墙尖
        const X = s * (w / 2 + 0.05), P0 = [X, yE - 0.3, 0], pts = [[X, yE, hd], [X, ym, hd / 2], [X, yR, 0], [X, ym, -hd / 2], [X, yE, -hd]];
        for (let i = 0; i < 4; i++) s > 0 ? B.brick.tri(pts[i], pts[i + 1], P0) : B.brick.tri(pts[i + 1], pts[i], P0);
        s > 0 ? B.brick.tri(pts[4], pts[0], P0) : B.brick.tri(pts[0], pts[4], P0);
        B.ridge.box(s * (w / 2 - 0.1), yR - 0.05, 0, 0.34, 0.6, 0.36);
      }
      B.ridge.box(0, yR - 0.1, 0, w + 0.1, 0.32, 0.3, 0, 63 - 8 - 3);
    }
    // 檐下灯笼、无字匾 / 有字招牌、幌子
    const ly = y0 + fh - (balc ? 0.15 : 0.75), lz = zf + (balc ? 0.95 : 0.75);
    for (const s of [-1, 1]) B.lantern.geo(ICO, s * (w / 2 - 1.3), ly - 0.42, lz, 0.3, 0.36, 0.3);
    const bw = Math.min(3.0, bay * 0.95), sy = y0 + 2.85;
    if (nHouse % 37 === 5 && shopSigns.length) {
      const c = Math.cos(ry), s = Math.sin(ry), lzs = zf + 0.24, t = shopSigns.shift();
      g.add(sign(t, t.length > 1 ? 2.6 : 1.5, 1.0, { bg: '#1c2a44', fg: '#f0cf6a', border: '#d4a93a', x: hx + lzs * s, y: sy + 0.25, z: hz + lzs * c, ry }));
    } else if (r() < 0.6) { B.gold.box(0, sy - 0.06, zf + 0.18, bw + 0.12, 0.67, 0.04, 0, 16); B.signB.box(0, sy, zf + 0.2, bw, 0.55, 0.05, 0, 16); }
    if (r() < 0.32) {
      const k = Math.floor(r() * 3), bx = w / 2 - 2.0 - r() * 2, yb = y0 + fh + (balc ? -2.9 : 0.5);
      B['banner' + k].quad([bx, yb, zf + 0.35], [bx, yb, zf + 1.0], [bx, yb + 2.3, zf + 1.0], [bx, yb + 2.3, zf + 0.35]);
      B.wood.box(bx, yb + 2.3, zf + 0.65, 0.06, 0.06, 0.9);
    }
  }

  // ── 沿各街屋带排房子
  for (const b of BANDS) {
    let p = b.a;
    while (b.b - p > 6) {
      let w = 9 + Math.floor(r() * 6);
      if (b.b - p - w < 7) w = b.b - p;           // 收尾
      const mid = p + w / 2;
      if (b.axis === 'x') house(mid, b.c, b.face > 0 ? 0 : Math.PI, w, DEPTH - 1);
      else house(b.c, mid, b.face > 0 ? Math.PI / 2 : -Math.PI / 2, w, DEPTH - 1);
      p += w;
    }
  }
  // ── 内部四合院式小街区（四栋围合，中间小院 + 一棵树）
  for (const [cx, cz] of COURTS) {
    for (const [dx, dz, ry] of [[0, -11, 0], [0, 11, Math.PI], [-11, 0, Math.PI / 2], [11, 0, -Math.PI / 2]]) house(cx + dx, cz + dz, ry, dx === 0 ? 30 : 8, 10);
    g.add(plaza(14, 12, M.paveRed, cx, cz, 0.15));
  }
  setT();

  // ── 环形步行街 + 城门大道铺装（中间一条深色石带）
  g.add(plaza(392, 12, M.pave, 0, -130, 0.15), plaza(392, 12, M.pave, 0, 129.5, 0.15), plaza(12, 247, M.pave, -190, 0, 0.15), plaza(12, 247, M.pave, 190, 0, 0.15));
  g.add(plaza(380, 1.6, M.stoneD, 0, -130, 0.2), plaza(380, 1.6, M.stoneD, 0, 129.5, 0.2), plaza(1.6, 258, M.stoneD, -190, 0, 0.2), plaza(1.6, 258, M.stoneD, 190, 0, 0.2));
  g.add(plaza(36, 59, M.paveRed, 0, 94, 0.15), plaza(6, 59, M.stone, 0, 94, 0.2));                 // 城门大道 (z 64.5–123.5) + 御道石
  g.add(plaza(14, 18, M.paveRed, 0, -101, 0.15));                                                   // 北侧通道
  // 东西向横街（东、西门 → 新潭）、楼阁和书院前的小广场
  g.add(plaza(98, 8, M.pave, 135, 0, 0.15), plaza(40, 8, M.pave, -106, 3, 0.15), plaza(44, 8, M.pave, -162, 0, 0.15), plaza(30, 30, M.paveRed, -125, -5, 0.14), plaza(26, 12, M.paveRed, 125, -18, 0.14));
  // 街上横拉的灯笼串
  const string = (x0, z0, x1, z1) => {
    const n = 6, pts = [];
    for (const [px, pz] of [[x0, z0], [x1, z1]]) B.wood.box(px, 0, pz, 0.16, 5.6, 0.16, 0, 51);
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push([x0 + (x1 - x0) * t, 5.5 - 1.1 * (1 - (2 * t - 1) ** 2), z0 + (z1 - z0) * t]); }
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[i + 1]; B.wood.quad(a, b, [b[0], b[1] + 0.05, b[2]], [a[0], a[1] + 0.05, a[2]]).quad(b, a, [a[0], a[1] + 0.05, a[2]], [b[0], b[1] + 0.05, b[2]]); }
    for (let i = 1; i < n; i++) B.lantern.geo(ICO, pts[i][0], pts[i][1] - 0.38, pts[i][2], 0.28, 0.34, 0.28);
  };
  for (let x = -165; x <= 165; x += 30) { string(x, -135.4, x, -124.6); if (Math.abs(x) > 30) string(x, 124.2, x, 135); }
  for (let z = -105; z <= 105; z += 30) { string(-195.4, z, -184.6, z); string(184.6, z, 195.4, z); }

  // ── 中央水面“新潭”：圆角驳岸 + 环湖铺地
  const zN = POND.z - POND.d / 2, zS = POND.z + POND.d / 2, xW = -POND.w / 2, xE = POND.w / 2;
  g.add(slab(pondPts(0.05), [], 0.05, M.water, 0.1));
  g.add(slab(pondPts(0.75), [pondPts(0)], 0.45, M.stone, 0));
  g.add(slab([[-86, zN - 11], [86, zN - 11], [86, zS + 25], [-86, zS + 25]], [pondPts(0.75)], 0.05, M.paveRed, 0.1));

  // 水中戏台（面向南岸，+Z）：石台、朱栏、歇山顶、后台屏风墙（出将 / 入相）
  {
    const sx = -25, sz = -2, fy = 1.45, ch = 5.4;
    B.stone.box(sx, 0, sz, 19, 1.3, 14, 0, 51).box(sx, 1.18, sz, 19.3, 0.14, 14.3);
    B.wood.box(sx, 1.3, sz, 18, 0.15, 13, 0, 63 - 8);
    for (const [cx, cz] of [[-8, 5.6], [8, 5.6], [-8, -5.6], [8, -5.6], [-3, 5.6], [3, 5.6], [-8, 0], [8, 0]]) { g.add(cyl(0.3, 0.34, ch, M.col, sx + cx, fy, sz + cz, 10)); B.stoneD.box(sx + cx, fy, sz + cz, 0.9, 0.16, 0.9, 0, 63 - 8); }
    B.col.box(sx, fy, sz - 5.6, 16, ch, 0.3, 0, 16 + 32);                                           // 后台屏风墙
    latQ(sx, fy + 0.6, sz - 5.43, 7, 3.6);
    for (const s of [-1, 1]) { B.wood.box(sx + s * 5.6, fy, sz - 5.42, 1.7, 2.9, 0.06, 0, 16); B.gold.box(sx + s * 5.6, fy + 3.0, sz - 5.42, 1.5, 0.5, 0.05, 0, 16); }
    for (const zz of [5.6, -5.6]) { B.col.box(sx, fy + ch - 0.42, sz + zz, 16.6, 0.42, 0.26); B.teal.box(sx, fy + ch - 0.72, sz + zz, 16.2, 0.3, 0.14); }
    for (const xx of [8, -8]) { B.col.box(sx + xx, fy + ch - 0.42, sz, 0.26, 0.42, 11.4); B.teal.box(sx + xx, fy + ch - 0.72, sz, 0.14, 0.3, 11); }
    B.wood.box(sx, fy + ch, sz, 17.2, 0.5, 12.4);
    for (let i = 0; i < 9; i++) for (const zz of [6.1, -6.1]) B.wood.box(sx - 8 + i * 2, fy + ch, sz + zz, 0.5, 0.5, 0.9);
    const R = { w: 22.5, d: 17.5, h: 4.8, ridge: 8 };
    g.add(tangRoof({ w: R.w, d: R.d, h: R.h, ridge: R.ridge, material: M.roof, x: sx, y: fy + ch + 0.5, z: sz, chiwen: false, soffit: 2.7 }));
    xieshan(g, M, { w: R.w, d: R.d, h: R.h, ridge: R.ridge, gx: 7.6, x: sx, y: fy + ch + 0.5, z: sz });
    g.add(sign('水上戏台', 5.2, 1.3, { bg: '#1f3c5e', fg: '#f0cf6a', border: '#d4a93a', x: sx, y: fy + ch - 0.2, z: sz + 5.95 }));
    for (const s of [-1, 1]) {                                                                         // 台边朱栏（两侧 + 后）
      B.red.box(sx + s * 8.8, fy + 0.8, sz, 0.1, 0.1, 12.4).box(sx + s * 8.8, fy + 0.35, sz, 0.06, 0.06, 12.4);
      for (let i = 0; i <= 8; i++) B.red.box(sx + s * 8.8, fy - 0.1, sz - 6.2 + i * 1.55, 0.12, 1.0, 0.12, 0, 51);
      lantern(sx + s * 5.5, fy + ch - 0.4, sz + 6.3, 0.42); lantern(sx + s * 10.2, fy + ch + 0.3, sz + 7.4, 0.36);
    }
    // 戏台后连北岸的平桥
    const len = (sz - 7) - zN + 1.5, cz = (zN - 1.5 + sz - 7) / 2;
    B.stone.box(sx, 0.75, cz, 4, 0.4, len);
    for (let i = 0; i <= 5; i++) B.stoneD.box(sx, 0, zN + 2 + i * (len - 5) / 5, 3, 0.75, 0.7, 0, 51);
    for (const s of [-1, 1]) { B.marble.box(sx + s * 1.85, 1.15 + 0.72, cz, 0.14, 0.12, len).box(sx + s * 1.85, 1.15 + 0.1, cz, 0.07, 0.5, len); for (let i = 0; i <= 18; i++) B.marble.box(sx + s * 1.85, 1.15, cz - len / 2 + 0.2 + i * (len - 0.4) / 18, 0.2, 1.0, 0.2, 0, 63 - 8); }
  }

  // 平曲桥的一段 / 亭子（石台基、角柱、额枋、坐凳栏杆、攒尖顶，可重檐）
  const flatBridge = (x1, z1, x2, z2, w, deckY) => {
    const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz), ry = Math.atan2(-dz, dx), ux = dx / L, uz = dz / L, cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    B.stone.box(cx, deckY - 0.4, cz, L + w * 0.6, 0.4, w, ry);
    const np = Math.max(1, Math.round(L / 5));
    for (let i = 0; i <= np; i++) B.stoneD.box(x1 + dx * i / np, 0, z1 + dz * i / np, 0.7, deckY - 0.4, w * 0.7, ry, 51);
    for (const s of [-1, 1]) {
      const ox = -uz * s * (w / 2 - 0.14), oz = ux * s * (w / 2 - 0.14), n = Math.max(1, Math.round(L / 1.8));
      for (let i = 0; i <= n; i++) { const px = x1 + ox + dx * i / n, pz = z1 + oz + dz * i / n; B.marble.box(px, deckY, pz, 0.2, 0.95, 0.2, ry, 63 - 8); B.marble.box(px, deckY + 0.95, pz, 0.26, 0.09, 0.26, ry); }
      B.marble.box(cx + ox, deckY + 0.7, cz + oz, L, 0.12, 0.13, ry).box(cx + ox, deckY + 0.1, cz + oz, L, 0.46, 0.07, ry);
    }
  };
  const pavilion = (x, z, y, rad, colH, sides, tiers = 1) => {
    const n = sides, sq = n === 4, by = y + 0.7;
    if (sq) B.stone.box(x, y, z, rad * 2 + 2.4, 0.7, rad * 2 + 2.4, 0, 63 - 8); else g.add(polyCyl(rad + 1.2, rad + 1.3, 0.7, n, M.stone, x, y, z));
    const pts = sq ? [[rad, rad], [rad, -rad], [-rad, -rad], [-rad, rad]] : Array.from({ length: n }, (_, i) => [Math.sin(i * 2 * Math.PI / n) * rad, Math.cos(i * 2 * Math.PI / n) * rad]);
    pts.forEach(([px, pz], i) => {
      g.add(cyl(0.2, 0.23, colH, M.col, x + px, by, z + pz, 8)); B.stoneD.box(x + px, by, z + pz, 0.62, 0.14, 0.62, 0, 63 - 8);
      const [qx, qz] = pts[(i + 1) % n], mx = x + (px + qx) / 2, mz = z + (pz + qz) / 2, L = Math.hypot(qx - px, qz - pz), ry = Math.atan2(-(qz - pz), qx - px);
      B.col.box(mx, by + colH - 0.36, mz, L, 0.36, 0.2, ry); B.teal.box(mx, by + colH - 0.62, mz, L - 0.42, 0.26, 0.12, ry);
      if (i % 2 === (sq ? 0 : 1)) B.red.box(mx, by + 0.44, mz, L - 0.42, 0.08, 0.36, ry).box(mx, by, mz, L - 0.42, 0.44, 0.06, ry).box(mx, by + 0.82, mz, L - 0.42, 0.07, 0.08, ry);
      if (i % 2 === 0) lantern(mx, by + colH - 0.6, mz, 0.26);
    });
    const ry0 = by + colH;
    if (tiers === 1) { g.add(sq ? tangRoof({ w: rad * 2 + 3.4, d: rad * 2 + 3.4, h: rad * 1.1 + 1.3, ridge: 0, material: M.roof, x, y: ry0, z, soffit: 1.5 }) : roundRoof({ r: rad + 1.8, h: rad + 1.3, sides: n, material: M.roof, x, y: ry0, z, soffit: 1.6 })); return; }
    const h1 = rad * 0.55 + 0.8, r2 = rad * 0.56, dh = 1.4;
    g.add(tangRoof({ w: rad * 2 + 3.6, d: rad * 2 + 3.6, h: h1, ridge: 0, material: M.roof, x, y: ry0, z, skirt: true, soffit: 1.6 }));
    B.col.box(x, ry0 + h1 * 0.35, z, r2 * 2, h1 * 0.65 + dh, r2 * 2, 0, 51); B.teal.box(x, ry0 + h1 + dh - 0.3, z, r2 * 2 + 0.1, 0.3, r2 * 2 + 0.1, 0, 51);
    for (let k = 0; k < 4; k++) { B.lat.at(x, z, k * Math.PI / 2); latQ(0, ry0 + h1 + 0.15, r2 + 0.03, r2 * 2 - 0.5, dh - 0.55); } B.lat.at();
    g.add(tangRoof({ w: r2 * 2 + 3.2, d: r2 * 2 + 3.2, h: r2 * 1.2 + 1.6, ridge: 0, material: M.roof, x, y: ry0 + h1 + dh, z, soffit: 1.5 }));
  };

  // 九曲桥：南岸 → 湖心六角亭
  {
    const pts = [[-60, zS + 1.5], [-60, 28], [-48, 20], [-60, 10], [-48, 0], [-58, -10], [-56, -18.5]];
    for (let i = 0; i < pts.length - 1; i++) flatBridge(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 2.8, 0.65);
    pavilion(-55, -24, 0, 3.3, 3.4, 6);
  }
  // 廊桥：南北横跨水面（x=40），中间一座重檐方亭
  {
    const bx = 40, len = POND.d + 5;
    B.stone.box(bx, 0.3, POND.z, 6.2, 0.5, len);
    for (let i = 0; i <= 12; i++) B.stoneD.box(bx, 0, POND.z - len / 2 + 2 + i * (len - 4) / 12, 4.6, 0.3, 0.8, 0, 51);
    for (let i = 0; i <= 22; i++) {
      const zz = POND.z - len / 2 + 1 + i * (len - 2) / 22; if (Math.abs(zz - POND.z) < 5.5) continue;
      for (const s of [-1, 1]) g.add(cyl(0.18, 0.2, 3.2, M.col, bx + s * 2.6, 0.8, zz, 8));
      if (i % 2 === 0) lantern(bx, 3.95, zz, 0.28);
    }
    for (const s of [-1, 1]) for (const t of [-1, 1]) {
      const l = len / 2 - 6, cz = POND.z + t * (5.5 + l / 2);
      B.col.box(bx + s * 2.6, 3.7, cz, 0.2, 0.3, l); B.teal.box(bx + s * 2.6, 3.46, cz, 0.12, 0.24, l - 0.4);
      B.red.box(bx + s * 2.6, 1.25, cz, 0.34, 0.08, l - 0.4).box(bx + s * 2.6, 0.8, cz, 0.06, 0.45, l - 0.4).box(bx + s * 2.78, 1.6, cz, 0.08, 0.07, l - 0.4);
    }
    B.wood.box(bx, 4.0, POND.z, 6, 0.25, len);
    g.add(tangRoof({ w: len + 1, d: 8.4, h: 2.4, ridge: len - 4, lift: 0.4, rings: 4, seg: 10, material: M.roof, x: bx, y: 4.25, z: POND.z, ry: Math.PI / 2, soffit: 1.3 }));
    B.stone.box(bx, 0, POND.z, 11.5, 0.8, 11.5, 0, 51 + 4);
    for (const [cx, cz] of [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5]]) g.add(cyl(0.3, 0.33, 6.6, M.col, bx + cx, 0.8, POND.z + cz, 10));
    for (const s of [-1, 1]) { B.col.box(bx, 6.9, POND.z + s * 4.5, 9.4, 0.4, 0.26).box(bx + s * 4.5, 6.9, POND.z, 0.26, 0.4, 9.4); B.teal.box(bx, 6.6, POND.z + s * 4.5, 9, 0.3, 0.14).box(bx + s * 4.5, 6.6, POND.z, 0.14, 0.3, 9); }
    g.add(tangRoof({ w: 14.5, d: 14.5, h: 2.2, ridge: 0, lift: 0.6, material: M.roof, x: bx, y: 7.3, z: POND.z, skirt: true, soffit: 2.6 }));
    B.col.box(bx, 8.0, POND.z, 6.4, 3.1, 6.4, 0, 51);
    for (let k = 0; k < 4; k++) { B.lat.at(bx, POND.z, k * Math.PI / 2); latQ(0, 9.3, 3.23, 5.6, 1.3); } B.lat.at();
    B.teal.box(bx, 10.7, POND.z, 6.5, 0.4, 6.5, 0, 51);
    g.add(tangRoof({ w: 11, d: 11, h: 3.8, ridge: 0, lift: 0.8, material: M.roof, x: bx, y: 11.1, z: POND.z, soffit: 2.2 }));
    for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) lantern(bx + cx * 6.4, 7.1, POND.z + cz * 6.4, 0.4);
  }
  // 湖心八角亭（孤岛）+ 乌篷船 + 荷叶
  pavilion(10, 22, 0, 3.0, 3.2, 8);
  const boat = (x, z, ry) => {
    const b = new THREE.Group(), hull = new THREE.Shape();
    hull.moveTo(-3.2, 0); hull.quadraticCurveTo(-2.2, -0.85, 0, -0.9); hull.quadraticCurveTo(2.4, -0.85, 3.6, 0); hull.quadraticCurveTo(2.4, 0.85, 0, 0.9); hull.quadraticCurveTo(-2.2, 0.85, -3.2, 0);
    const hg = new THREE.ExtrudeGeometry(hull, { depth: 0.55, bevelEnabled: false, curveSegments: 5 }); hg.rotateX(-Math.PI / 2);
    b.add(put(new THREE.Mesh(hg, M.wood), 0, 0.1, 0));
    const aw = new THREE.CylinderGeometry(0.85, 0.85, 2.6, 8, 1, true, 0, Math.PI); aw.rotateZ(Math.PI / 2); aw.rotateX(-Math.PI / 2);
    b.add(put(new THREE.Mesh(aw, mat(0x2a2622, { double: true })), -0.2, 0.62, 0), cyl(0.03, 0.03, 3.4, M.plank, 2.6, 0.6, 0.3, 4));
    b.position.set(x, 0, z); b.rotation.y = ry; g.add(b);
  };
  boat(8, -28, 0.4); boat(60, 16, -1.2); boat(-10, 33, 2.9);
  const leafGeo = new THREE.CircleGeometry(1, 8); leafGeo.rotateX(-Math.PI / 2);
  const bLeaf = new Bat(), bPink = new Bat(), cone = new THREE.ConeGeometry(1, 1, 6);
  for (const [cx, cz] of [[-66, -36], [-30, 32], [62, -34], [58, 30], [14, -42], [-68, 4], [22, 6]]) for (let k = 0; k < 14; k++) {
    const px = cx + (r() - 0.5) * 12, pz = cz + (r() - 0.5) * 7, sr = 0.45 + r() * 0.5;
    bLeaf.geo(leafGeo, px, 0.2 + r() * 0.1, pz, sr, 1, sr);
    if (k % 5 === 0) { bLeaf.box(px + 0.3, 0.15, pz, 0.04, 0.6, 0.04, 0, 51); bPink.geo(cone, px + 0.3, 0.93, pz, 0.16, 0.36, 0.16); }
  }
  g.add(bLeaf.mesh(M.leaf), bPink.mesh(M.pink));

  // ── 东西两条水系：石驳岸 + 小石拱桥 + 过街石板桥
  const archBridge = (x, z0, z1, w, rise, y0) => {
    const L = z1 - z0, n = 10, hw = w / 2, top = (t) => y0 + rise * (1 - (2 * t - 1) ** 2);
    const und = (t) => { const u = (2 * t - 1) / 0.6; return Math.abs(u) < 0.999 ? Math.min(top(t) - 0.35, (y0 + rise - 0.4) * Math.sqrt(1 - u * u)) : 0; };
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, za = z0 + t0 * L, zb = z0 + t1 * L, ya = top(t0), yb = top(t1), ua = und(t0), ub = und(t1);
      B.stone.quad([x - hw, ya, za], [x - hw, yb, zb], [x + hw, yb, zb], [x + hw, ya, za]);
      B.stone.quad([x + hw, ua, za], [x + hw, ya, za], [x + hw, yb, zb], [x + hw, ub, zb]).quad([x - hw, ua, zb], [x - hw, yb, zb], [x - hw, ya, za], [x - hw, ua, za]);
      B.stoneD.quad([x - hw, ua, za], [x + hw, ua, za], [x + hw, ub, zb], [x - hw, ub, zb]);
      for (const s of [-1, 1]) {
        const xx = x + s * (hw - 0.13);
        B.marble.box(xx, ya, za, 0.18, 0.9, 0.18, 0, 63 - 8); if (i === n - 1) B.marble.box(xx, yb, zb, 0.18, 0.9, 0.18, 0, 63 - 8);
        for (const o of [0.05, -0.05]) { const A = [xx + o, ya + 0.15, za], Bq = [xx + o, yb + 0.15, zb], Cq = [xx + o, yb + 0.75, zb], Dq = [xx + o, ya + 0.75, za]; o > 0 ? B.marble.quad(Bq, A, Dq, Cq) : B.marble.quad(A, Bq, Cq, Dq); }
      }
    }
  };
  for (const [x0, x1, zc, bridges] of [[74, 165, 8, [108, 146]], [-165, -74, 20, [-108, -146]]]) {
    const L = x1 - x0, cx = (x0 + x1) / 2;
    g.add(plaza(L, 5, M.water, cx, zc, 0.17));
    for (const s of [-1, 1]) B.stone.box(cx, 0, zc + s * 2.75, L, 0.5, 0.5, 0, 63 - 8);
    B.stone.box(x0 < 0 ? x0 - 0.25 : x1 + 0.25, 0, zc, 0.5, 0.5, 6);
    for (const bxx of bridges) archBridge(bxx, zc - 5.5, zc + 5.5, 3.2, 1.5, 0.3);
    const wx = x0 < 0 ? -80.5 : 80.5; B.stone.box(wx, 0.3, zc, 8, 0.3, 6.4, 0, 63 - 8);                    // 环湖步道过水的石板桥
    for (let x = x0 + 16; x < x1 - 4; x += 12) if (bridges.every(b => Math.abs(b - x) > 4) && Math.abs(Math.abs(x) - 80) > 8) g.add(tree(x, zc + (Math.round(x / 12) % 2 ? 5.2 : -5.2), 7.5, 'willow'));
  }

  // ── 城门楼：青砖城台三门洞（木过梁）、垛口、门钉大门、台上重檐歇山城楼
  {
    const gz = GATE.z, gh = GATE.h, zf = gz + GATE.d / 2;
    for (const [a, b] of PIERS) B.cityWall.box((a + b) / 2, 0, gz, b - a, gh, GATE.d, 0, 63 - 8 - 4);
    for (const [a, b, oh] of OPENINGS) {
      B.cityWall.box((a + b) / 2, oh, gz, b - a, gh - oh, GATE.d, 0, 16 + 32 + 8);
      B.wood.box((a + b) / 2, oh - 0.5, gz, b - a, 0.5, GATE.d + 0.1, 0, 16 + 32 + 8);                       // 木过梁
      for (let k = 0; k < 5; k++) for (const s of [-1, 1]) B.wood.box((a + b) / 2 + s * ((b - a) / 2 - 0.16), 0.2, gz - 5.4 + k * 2.7, 0.3, oh - 0.7, 0.3, 0, 51);   // 排叉柱
      g.add(plaza(b - a, GATE.d + 2, M.paveRed, (a + b) / 2, gz, 0.2));
      const lw = (b - a) / 2 - 0.3, dh = oh - 0.9;                                                         // 敞开的门扇 + 门钉
      for (const s of [-1, 1]) {
        const dx = (a + b) / 2 + s * ((b - a) / 2 - 0.42), dz = gz + 2.2 + lw / 2;
        B.red.box(dx, 0.2, dz, 0.12, dh, lw);
        for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) B.gold.geo(ICO, dx - s * 0.07, 0.8 + i * (dh - 1.1) / 5, dz - lw / 2 + 0.35 + j * (lw - 0.7) / 3, 0.07);
      }
    }
    B.stone.box(0, 0, gz, GATE.w + 0.4, 1.0, GATE.d + 0.4, 0, 51);                                          // 石基
    for (let k = 0; k < 3; k++) B.cityWall.box(0, gh - 0.45 + k * 0.15, gz, GATE.w + 0.2 + k * 0.24, 0.15, GATE.d + 0.2 + k * 0.24, 0, 63 - (k < 2 ? 4 : 0));
    g.add(plaza(GATE.w - 1, GATE.d - 1, M.stoneD, 0, gz, gh + 0.03));
    for (const s of [-1, 1]) {                                                                             // 垛口女儿墙（前后 + 两端）
      B.cityWall.box(0, gh, gz + s * (GATE.d / 2 - 0.2), GATE.w, 0.9, 0.45, 0, 63 - 8);
      for (let i = 0; i < 28; i++) B.cityWall.box(-GATE.w / 2 + 1 + i * 2, gh + 0.9, gz + s * (GATE.d / 2 - 0.2), 1.3, 0.6, 0.45, 0, 63 - 8);
      B.cityWall.box(s * (GATE.w / 2 - 0.2), gh, gz, 0.45, 0.9, GATE.d - 0.9, 0, 63 - 8);
      for (let i = 0; i < 6; i++) B.cityWall.box(s * (GATE.w / 2 - 0.2), gh + 0.9, gz - 5 + i * 2, 0.45, 0.6, 1.3, 0, 63 - 8);
    }
    const T = { w: 34, d: 9.4, wallH: 6, roofH: 4.8, eave: 2.1, platformH: 0.5, shrink: 0.16 }, top = hallTop(T);
    g.add(hall({ w: T.w, d: T.d, wallH: T.wallH, roofH: T.roofH, eave: T.eave, platformH: T.platformH, tiers: 2, tierShrink: T.shrink, ridge: 16, ornaments: false,
      wall: C.wallWhite, column: C.tangRed, roof: C.tileGrey, platform: C.stoneDark, steps: false, y: gh, z: gz }));
    xieshan(g, M, { w: top.rw, d: top.rd, h: T.roofH, ridge: 16, gx: top.cw / 2 - 1.3, y: gh + top.roofY, z: gz });
    g.add(sign('洛邑古城', 8.5, 2.3, { bg: '#1f3c5e', fg: '#f0cf6a', border: '#d4a93a', x: 0, y: gh - 1.75, z: zf + 0.08 }));
    g.add(sign('洛邑古城', 6, 1.7, { bg: '#1f3c5e', fg: '#f0cf6a', border: '#d4a93a', x: 0, y: gh + top.roofY - 1.3, z: gz + top.cd / 2 + 1.0 }));
    g.add(sign('洛邑古城', 6, 1.7, { bg: '#1f3c5e', fg: '#f0cf6a', border: '#d4a93a', x: 0, y: gh - 1.6, z: gz - GATE.d / 2 - 0.08, ry: Math.PI }));
    for (const s of [-1, 1]) {
      g.add(lion(s * 6, zf + 1.0, M));
      const li = lion(s * 6, gz - GATE.d / 2 - 1.2, M); li.rotation.y = Math.PI; g.add(li);
      for (const xx of [11, 20.5]) lantern(s * xx, gh + T.platformH + T.wallH + 0.2, gz + T.d / 2 + 1.3, 0.75);     // 城楼檐下大灯笼
    }
  }

  // ── 牌坊：四柱三楼（门内大道上）
  {
    const pz = PAIFANG.z, [x0, x1, x2, x3] = PAIFANG.cols;
    for (const [x, h] of [[x0, 6.2], [x1, 8.2], [x2, 8.2], [x3, 6.2]]) {
      g.add(cyl(0.3, 0.34, h, M.col, x, 0.6, pz, 10)); B.stone.box(x, 0, pz, 1.0, 0.6, 1.5, 0, 63 - 8);
      for (const s of [-1, 1]) { g.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.3, 12), M.stone), x, 1.15, pz + s * 0.85, 0, 0, Math.PI / 2)); B.stone.box(x, 0.6, pz + s * 0.85, 0.34, 0.3, 0.9, 0, 63 - 8); }   // 抱鼓石
    }
    const bay = (xa, xb, y, big) => {
      const cx = (xa + xb) / 2, L = xb - xa;
      B.col.box(cx, y, pz, L + 0.9, 0.5, 0.36).box(cx, y - 1.5, pz, L - 0.5, 0.42, 0.3); B.teal.box(cx, y - 0.3, pz, L - 0.6, 0.3, 0.2);
      B.signB.box(cx, y - 1.05, pz, L - 0.9, 0.72, 0.14); B.gold.box(cx, y - 1.08, pz, L - 0.78, 0.78, 0.1);
      for (let i = 0; i < (big ? 5 : 3); i++) B.wood.box(cx - L / 2 + 0.6 + i * (L - 1.2) / (big ? 4 : 2), y + 0.5, pz, 0.5, 0.45, 1.3);
      g.add(tangRoof({ w: L + 3.0, d: 3.6, h: big ? 1.7 : 1.4, ridge: L + 0.6, material: M.roof, x: cx, y: y + 0.95, z: pz, rings: 4, seg: 6, lift: 0.5, soffit: 1.3 }));
    };
    bay(x0, x1, 6.3, false); bay(x2, x3, 6.3, false); bay(x1, x2, 8.3, true);
    g.add(sign('河洛古韵', 4.6, 0.7, { bg: '#1c2a44', fg: '#f0cf6a', x: 0, y: 7.61, z: pz + 0.08 }));
    g.add(sign('洛邑古城', 4.6, 0.7, { bg: '#1c2a44', fg: '#f0cf6a', x: 0, y: 7.61, z: pz - 0.08, ry: Math.PI }));
    for (const x of [x1, x2]) lantern(x + (x < 0 ? 1.2 : -1.2), 6.75, pz, 0.45);
  }

  // ── 内部大建筑：文庙大成殿（重檐歇山）、三重檐楼阁、书院
  {
    const T = { w: 30, d: 14, wallH: 6.5, roofH: 5.5, eave: 2.4, platformH: 1.2, shrink: 0.2 }, top = hallTop(T);
    g.add(hall({ w: T.w, d: T.d, wallH: T.wallH, roofH: T.roofH, tiers: 2, tierShrink: T.shrink, ridge: 10, ornaments: false, wall: C.wallRed, column: C.tangRed, z: -85 }));
    xieshan(g, M, { w: top.rw, d: top.rd, h: T.roofH, ridge: 10, gx: top.cw / 2 - 1.1, y: top.roofY, z: -85 });
    g.add(sign('大成殿', 4.4, 1.4, { bg: '#1f3c5e', fg: '#f0cf6a', border: '#d4a93a', x: 0, y: top.roofY - 1.2, z: -85 + top.cd / 2 + 1.0 }));
    g.add(plaza(26, 14, M.paveRed, 0, -68, 0.15));
    g.add(cyl(0.75, 0.52, 0.8, M.gold, 0, 1.0, -66, 10), cyl(0.82, 0.82, 0.08, M.gold, 0, 1.8, -66, 10)); B.stone.box(0, 0.15, -66, 2.0, 0.4, 2.0, 0, 63 - 8);
    for (let i = 0; i < 3; i++) { const a = i * 2.094; g.add(cyl(0.09, 0.06, 0.6, M.gold, Math.sin(a) * 0.48, 0.5, -66 + Math.cos(a) * 0.48, 5)); }
    for (const s of [-1, 1]) { g.add(tree(s * 11, -68, 9, 'cypress'), tree(s * 16, -72, 8, 'cypress')); B.stoneD.box(s * 6, 0.15, -64, 1.4, 0.5, 0.7, 0, 63 - 8).box(s * 6, 0.65, -64, 1.0, 2.4, 0.3); }
  }
  g.add(hall({ w: 13, d: 13, wallH: 5, roofH: 4.5, eave: 2, tiers: 3, tierShrink: 0.18, wall: C.wallWhite, column: C.tangRed, x: -125, z: -5 }));
  g.add(hall({ w: 20, d: 10, wallH: 5, roofH: 4.2, tiers: 1, wall: C.wallWhite, column: C.tangRed, x: 125, z: -30 }));
  g.add(sign('河洛书院', 4.5, 1.3, { bg: '#1f3c5e', fg: '#f0cf6a', border: '#d4a93a', x: 125, y: 5.2, z: -24.4 }));

  // ── 南岸灯笼墙（两架）
  for (const s of [-1, 1]) {
    const cx = s * 50, cz = 51, wd = 15, rows = 4, cols = 11;
    for (const xx of [-wd / 2, 0, wd / 2]) B.wood.box(cx + xx, 0, cz, 0.22, 5.4, 0.22, 0, 51 + 4);
    for (let j = 0; j <= rows; j++) B.wood.box(cx, 1.5 + j * 0.95, cz, wd, 0.07, 0.07);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) B.lantern.geo(ICO, cx - wd / 2 + 0.75 + i * (wd - 1.5) / (cols - 1), 1.5 + j * 0.95 + 0.48, cz, 0.3, 0.36, 0.3);
    B.roof.quad([cx - wd / 2 - 0.4, 5.3, cz + 0.7], [cx + wd / 2 + 0.4, 5.3, cz + 0.7], [cx + wd / 2 + 0.4, 5.75, cz], [cx - wd / 2 - 0.4, 5.75, cz]).quad([cx + wd / 2 + 0.4, 5.3, cz - 0.7], [cx - wd / 2 - 0.4, 5.3, cz - 0.7], [cx - wd / 2 - 0.4, 5.75, cz], [cx + wd / 2 + 0.4, 5.75, cz]);
    B.wood.box(cx, 5.2, cz, wd + 0.8, 0.1, 1.4);
  }

  // ── 文峰塔南缘水边平台（塔本体由 wenfengta 模块放置，此处只铺地 + 栏杆，不放实体）
  g.add(plaza(46, 14, M.paveRed, 85, 143, 0.15));
  for (const xx of [62.5, 107.5]) { B.marble.box(xx, 0.85, 143, 0.14, 0.12, 13).box(xx, 0.2, 143, 0.07, 0.5, 13); for (let i = 0; i <= 6; i++) B.marble.box(xx, 0, 136.6 + i * 2.13, 0.2, 1.05, 0.2, 0, 63 - 8); }

  // ── 柳树（水边）+ 其它树
  const trees = [];
  for (let x = -80; x <= 80; x += 13) { trees.push([x, zN - 8, 'willow'], [x, zS + 20, 'willow']); }
  for (let z = zN + 6; z <= zS; z += 13) { if (Math.abs(z - 20) > 6) trees.push([xW - 8.5, z, 'willow']); if (Math.abs(z - 8) > 6) trees.push([xE + 8.5, z, 'willow']); }
  for (let x = -160; x <= 160; x += 20) if (Math.abs(x) > 24) trees.push([x, -98, 'round']);
  for (let z = -60; z <= 90; z += 22) { if (Math.abs(z - 20) > 8) trees.push([-155, z, 'round']); if (Math.abs(z - 8) > 8) trees.push([155, z, 'round']); }
  for (let z = 70; z <= 110; z += 13) { if (Math.abs(z - PAIFANG.z) > 5) trees.push([-24, z, 'round'], [24, z, 'round']); }
  for (const [cx, cz] of COURTS) trees.push([cx + 3, cz + 1, 'round']);
  for (const [x, z, k] of trees) if (!(Math.abs(x - 40) < 6 && z > zS) && !(Math.abs(x + 60) < 4 && z > zS) && !(Math.abs(Math.abs(x) - 50) < 9 && Math.abs(z - 51) < 4)) g.add(tree(x, z, k === 'willow' ? 8.5 : 9, k));

  // ── 灯笼柱：沿水边步道、城门大道
  const posts = [];
  for (let x = -66; x <= 66; x += 11) posts.push([x, zN - 3.5, 0], [x, zS + 3.5, 0]);
  for (let z = zN + 12; z < zS - 6; z += 11) posts.push([xW - 3.5, z, 1], [xE + 3.5, z, 1]);
  for (let z = 68; z <= 120; z += 10) if (Math.abs(z - PAIFANG.z) > 4) posts.push([-15, z, 1], [15, z, 1]);
  for (const [x, z, ax] of posts) {
    if (Math.abs(x - 40) < 4.5 || Math.abs(x + 60) < 3 || Math.abs(x + 25) < 3.5 || (Math.abs(x) > 70 && (Math.abs(z - 8) < 4.5 || Math.abs(z - 20) < 4.5))) continue;
    B.wood.box(x, 0, z, 0.16, 3.9, 0.16, 0, 51).box(x, 0, z, 0.4, 0.3, 0.4, 0, 51 + 4);
    ax ? B.wood.box(x, 3.7, z, 0.08, 0.08, 1.3) : B.wood.box(x, 3.7, z, 1.3, 0.08, 0.08);
    for (const s of [-1, 1]) lantern(x + (ax ? 0 : s * 0.55), 3.72, z + (ax ? s * 0.55 : 0), 0.26);
  }

  for (const k of Object.keys(B)) if (B[k].p.length) g.add(B[k].mesh(k.startsWith('banner') ? M.banner[+k.slice(6)] : M[k]));
  return finalize(g);
}
