// 齐云塔 — 金代 13 层方形密檐砖塔（约 35m），抛物线外轮廓（中下部微鼓、上部急收）。+Z = 院门（南）。
// 塔：台基 + 须弥座 + 高大的首层（南券门、三面盲券、砖雕斗拱）+ 13 重叠涩密檐（菱角牙子、檐角风铎、层间小龛）+ 相轮宝珠刹。
// 塔院：红墙灰瓦顶小院、山门（门钉、匾、石狮）、甬道、香炉、石碑、石灯、后殿、古柏。
import { THREE, C, mat, box, cyl, sphere, plaza, gableRoof, tangRoof, hall, sign, tree, patternTex, rng, finalize } from './_kit.js';

const WALL_T = 0.9, WALL_H = 3.4;
const WX = 27, WZF = 30, WZB = -35;
const TZ = -3;                                   // 塔中心
const GATE = { z: WZF, w: 11, d: 5.6, open: 3.4, h: 4.6 };
const HALL = { z: -26.5, w: 15, d: 8 };          // 后殿
const WALLS = [
  [-WX, WZF, -GATE.w / 2, WZF], [GATE.w / 2, WZF, WX, WZF],
  [-WX, WZF, -WX, WZB], [WX, WZF, WX, WZB], [-WX, WZB, WX, WZB],
];
const wallCol = ([x1, z1, x2, z2]) => z1 === z2
  ? { x: (x1 + x2) / 2, z: z1, w: Math.abs(x2 - x1), d: WALL_T }
  : { x: x1, z: (z1 + z2) / 2, w: WALL_T, d: Math.abs(z2 - z1) };
const sideW = (GATE.w - GATE.open) / 2;

export const meta = {
  colliders: [
    { x: 0, z: TZ, w: 11, d: 11 },
    ...WALLS.map(wallCol),
    { x: -(GATE.open / 2 + sideW / 2), z: GATE.z, w: sideW, d: GATE.d },
    { x: GATE.open / 2 + sideW / 2, z: GATE.z, w: sideW, d: GATE.d },
    { x: 0, z: HALL.z, w: HALL.w + 2.4, d: HALL.d + 2.4 },
    { x: -8, z: 15, w: 2, d: 2.6 }, { x: 8, z: 15, w: 2, d: 2.6 },      // 石碑
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
  /** 方台（四面梯形，无顶底）：底半边 hb，顶半边 ht */
  frustum(x, y, z, hb, ht, h) {
    const c = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
    for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; this.quad([x + a[0] * hb, y, z + a[1] * hb], [x + b[0] * hb, y, z + b[1] * hb], [x + b[0] * ht, y + h, z + b[1] * ht], [x + a[0] * ht, y + h, z + a[1] * ht], hb * 2, h); }
    return this;
  }
  mesh(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.computeVertexNormals();
    return new THREE.Mesh(g, material);
  }
}

// 券形薄片（矩形 + 半圆顶），底边中点在原点，朝 +Z
const _arch = new Map();
function archGeo(w, h, dep) {
  const key = `${w.toFixed(2)}|${h.toFixed(2)}|${dep}`; let geo = _arch.get(key);
  if (!geo) { const r = w / 2, s = new THREE.Shape(); s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, h - r); s.absarc(0, h - r, r, 0, Math.PI, false); s.lineTo(-r, 0); geo = new THREE.ExtrudeGeometry(s, { depth: dep, bevelEnabled: false, curveSegments: 7 }); _arch.set(key, geo); }
  return geo;
}
/** 在指定的面（k=0 南,1 东,2 北,3 西）上贴一个券洞：外圈砖券 + 深色洞口 */
function archWin(g, x0, z0, half, y, w, h, M, faces, dark = M.dark, frame = 0.28) {
  for (const k of faces) {
    const a = k * Math.PI / 2, sx = Math.sin(a), cz = Math.cos(a);
    const fr = new THREE.Mesh(archGeo(w + frame, h + frame / 2, 0.07), M.course); fr.position.set(x0 + sx * (half - 0.01), y - 0.02, z0 + cz * (half - 0.01)); fr.rotation.y = a; g.add(fr);
    const dk = new THREE.Mesh(archGeo(w, h, 0.1), dark); dk.position.set(x0 + sx * (half - 0.01), y, z0 + cz * (half - 0.01)); dk.rotation.y = a; g.add(dk);
  }
}

/** 一重密檐：从 y（塔身顶，半边 half）起叠涩外挑 nC 层（第 2 层是菱角牙子），檐口，再反叠涩 nB 层收回到 nextHalf。返回檐顶高度。 */
function eave(B, g, M, x0, z0, half, y, nextHalf, { nC = 6, cH = 0.09, cS = 0.095, nB = 4, bH = 0.075 } = {}) {
  for (let k = 0; k < nC; k++) {
    const o = half + (k + 1) * cS;
    if (k === 1) {
      const oo = half + cS, n = Math.max(4, Math.floor(oo * 2 / 0.3));
      B.course.box(x0, y + k * cH, z0, oo * 2, cH, oo * 2, 0, 51);
      for (let i = 0; i < n; i++) { const t = -oo + (i + 0.5) * oo * 2 / n; for (const s of [1, -1]) { B.course.box(x0 + t, y + k * cH, z0 + s * oo, 0.15, cH, 0.15, Math.PI / 4, 51 + 8); B.course.box(x0 + s * oo, y + k * cH, z0 + t, 0.15, cH, 0.15, Math.PI / 4, 51 + 8); } }
    } else B.course.box(x0, y + k * cH, z0, o * 2, cH, o * 2, 0, 51 + 8);
  }
  y += nC * cH;
  const out = half + nC * cS + 0.05;
  B.eave.box(x0, y, z0, out * 2, 0.07, out * 2);
  y += 0.07;
  for (let k = 0; k < nB; k++) { const o = out - 0.05 - (k + 1) * (out - 0.05 - nextHalf) / (nB + 0.6); B.course.box(x0, y + k * bH, z0, o * 2, bH, o * 2, 0, 51 + 4); }
  for (const sx of [1, -1]) for (const sz of [1, -1]) { g.add(cyl(0.012, 0.012, 0.16, M.bronze, x0 + sx * (out - 0.06), y - 0.3, z0 + sz * (out - 0.06), 4)); g.add(cyl(0.03, 0.085, 0.17, M.bronze, x0 + sx * (out - 0.06), y - 0.47, z0 + sz * (out - 0.06), 6)); }
  return y + nB * bH;
}

// 抛物线轮廓：下部微鼓，越往上收得越急
const prof = (t) => 1 + 0.15 * t - 0.7 * Math.pow(t, 2.5);

function pagoda(g, B, M, z0) {
  // 台基 + 踏步 + 须弥座
  B.stone.box(0, 0, z0, 12.4, 0.7, 12.4, 0, 63 - 8).box(0, 0.58, z0, 12.6, 0.12, 12.6);
  for (let i = 0; i < 4; i++) B.stone.box(0, 0, z0 + 6.3 + 0.15 + i * 0.3, 3.2, 0.7 * (1 - i / 4), 0.3, 0, 63 - 8 - 32);
  let y = 0.7;
  for (const [s, h, m] of [[10.2, 0.3, 'course'], [9.6, 0.25, 'course'], [9.0, 0.6, 'brick'], [9.5, 0.2, 'course'], [10.0, 0.25, 'course']]) { B[m].box(0, y, z0, s, h, s, 0, 63 - 8); y += h; }
  for (let i = 0; i < 9; i++) for (const s of [1, -1]) { const t = -4 + i; B.course.box(t, 1.25, z0 + s * 4.52, 0.16, 0.6, 0.06).box(s * 4.52, 1.25, z0 + t, 0.06, 0.6, 0.16); }
  for (let i = 0; i < 5; i++) B.stone.box(0, 0.7, z0 + 5.0 + 0.1 + (i + 0.5) * 0.26, 2.2, (y - 0.7) * (1 - i / 5), 0.26, 0, 63 - 8 - 32);
  // 首层：高塔身，角倚柱，南券门，三面盲券，檐下砖雕斗拱
  const s0 = 3.9, H1 = 6.2;
  B.brick.frustum(0, y, z0, s0, s0 - 0.08, H1);
  B.course.box(0, y, z0, s0 * 2 + 0.12, 0.18, s0 * 2 + 0.12, 0, 51 + 4);
  for (const sx of [1, -1]) for (const sz of [1, -1]) B.course.box(sx * (s0 - 0.22), y + 0.18, z0 + sz * (s0 - 0.22), 0.52, H1 - 0.18, 0.52, 0, (sx > 0 ? 1 : 2) + (sz > 0 ? 16 : 32));
  archWin(g, 0, z0, s0 - 0.02, y + 0.2, 1.7, 3.1, M, [0], M.dark, 0.5);
  archWin(g, 0, z0, s0 - 0.02, y + 1.2, 1.5, 2.4, M, [1, 2, 3], M.niche, 0.36);
  B.course.box(0, y + H1 - 1.0, z0, s0 * 2 + 0.06, 0.14, s0 * 2 + 0.06, 0, 51);                       // 普拍枋
  for (let i = 0; i < 9; i++) for (const s of [1, -1]) {                                               // 砖雕斗拱一排
    const t = -3.5 + i * 0.875, yy = y + H1 - 0.86;
    B.course.box(t, yy, z0 + s * (s0 - 0.02), 0.5, 0.2, 0.2).box(t, yy + 0.2, z0 + s * (s0 + 0.03), 0.8, 0.2, 0.3).box(t, yy + 0.4, z0 + s * (s0 + 0.08), 1.1, 0.2, 0.4);
    B.course.box(s * (s0 - 0.02), yy, z0 + t, 0.2, 0.2, 0.5).box(s * (s0 + 0.03), yy + 0.2, z0 + t, 0.3, 0.2, 0.8).box(s * (s0 + 0.08), yy + 0.4, z0 + t, 0.4, 0.2, 1.1);
  }
  y += H1;
  // 13 重密檐
  const N = 13;
  let top = s0 - 0.08;
  for (let i = 0; i < N; i++) {
    const sNext = i < N - 1 ? s0 * prof((i + 1) / (N - 1)) + (i === 0 ? 0 : 0) : top * 0.6;
    y = eave(B, g, M, 0, z0, top, y, i < N - 1 ? Math.min(sNext, top + 0.3) : sNext, i === 0 ? { nC: 7, nB: 5 } : {});
    if (i === N - 1) break;
    const bh = 0.98 - i * 0.03;
    B.brick.frustum(0, y, z0, sNext, sNext - 0.03, bh);
    archWin(g, 0, z0, sNext - 0.01, y + bh * 0.2, 0.36, bh * 0.62, M, i % 2 ? [1, 3] : [0, 2], M.dark, 0.16);
    top = sNext - 0.03; y += bh;
  }
  // 塔顶：叠涩收顶 + 相轮宝珠刹
  let r = top * 0.62;
  for (let k = 0; k < 5; k++) { B.course.box(0, y, z0, r * 2, 0.16, r * 2, 0, 51 + 4); y += 0.16; r *= 0.8; }
  const pts = [[0.02, 0], [0.7, 0], [0.76, 0.14], [0.5, 0.3], [0.62, 0.42], [0.74, 0.62], [0.6, 0.86], [0.34, 0.98], [0.2, 1.04]];
  for (let k = 0; k < 5; k++) { const yy = 1.12 + k * 0.3, rr = 0.52 - k * 0.07; pts.push([0.16, yy], [rr, yy + 0.05], [rr, yy + 0.15], [0.16, yy + 0.2]); }
  pts.push([0.12, 2.7], [0.3, 2.82], [0.34, 3.0], [0.22, 3.2], [0.06, 3.3], [0.02, 3.75]);
  const fin = new THREE.Mesh(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), 14), M.iron); fin.position.set(0, y - 0.02, z0); g.add(fin);
}

function wallSeg(B, g, M, [x1, z1, x2, z2]) {
  const horiz = z1 === z2, L = horiz ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, ry = horiz ? 0 : Math.PI / 2;
  B.stoneD.box(cx, 0, cz, L, 0.55, WALL_T + 0.16, ry, 63 - 8);
  B.red.box(cx, 0.55, cz, L, WALL_H - 0.55, WALL_T, ry, 63 - 8 - 4);
  B.eave.box(cx, WALL_H, cz, L + 0.1, 0.12, WALL_T + 0.36, ry);
  g.add(gableRoof(L + 0.3, WALL_T + 0.9, 0.55, M.roof, cx, WALL_H + 0.12, cz, ry));
}

function gateHouse(g, B, M) {
  const { z, w, d, open, h } = GATE, y0 = 0.3;
  B.stone.box(0, 0, z, w + 1.6, y0, d + 2.0, 0, 63 - 8);
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) B.stone.box(0, 0, z + s * (d / 2 + 1.0 + 0.15 + i * 0.3), 4.6, y0 * (1 - i / 2), 0.3, 0, 63 - 8);
  for (const sx of [-1, 1]) {
    const cx = sx * (open / 2 + sideW / 2);
    B.stoneD.box(cx, y0, z, sideW + 0.1, 0.7, d - 0.5, 0, 63 - 8);
    B.red.box(cx, y0 + 0.7, z, sideW, h - 0.7, d - 0.6, 0, 63 - 8 - 4);
    for (const sz of [-1, 1]) {                                                            // 两侧圆券盲窗
      const m = new THREE.Mesh(archGeo(1.3, 1.5, 0.08), M.dark); m.position.set(cx, y0 + 1.5, z + sz * (d / 2 - 0.3)); m.rotation.y = sz > 0 ? 0 : Math.PI; g.add(m);
      const f = new THREE.Mesh(archGeo(1.6, 1.68, 0.05), M.stone); f.position.set(cx, y0 + 1.44, z + sz * (d / 2 - 0.3)); f.rotation.y = sz > 0 ? 0 : Math.PI; g.add(f);
    }
  }
  B.red.box(0, y0 + 3.5, z, open, h - 3.5, d - 0.6, 0, 16 + 32 + 8);                         // 门洞上方墙
  B.wood.box(0, y0 + 3.3, z, open + 0.2, 0.22, d - 0.4);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(0.2, 0.23, h, M.col, sx * (open / 2 + 0.24), y0, z + sz * (d / 2 - 0.22), 10));
  // 敞开的朱漆门扇 + 门钉
  const nail = new THREE.IcosahedronGeometry(0.05, 0);
  for (const sx of [-1, 1]) {
    B.verm.box(sx * (open / 2 - 0.1), y0, z + 0.2, 0.1, 3.0, 1.6);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) { const n = new THREE.Mesh(nail, M.gold); n.position.set(sx * (open / 2 - 0.17), y0 + 0.5 + i * 0.52, z - 0.4 + j * 0.4); g.add(n); }
    B.stoneD.box(sx * (open / 2 - 0.28), y0, z + 1.25, 0.5, 0.5, 0.5, 0, 63 - 8);            // 门枕石
  }
  B.wood.box(0, y0 + h, z, w + 0.5, 0.3, d + 0.1);
  for (let i = 0; i < 9; i++) for (const sz of [-1, 1]) B.wood.box(-w / 2 + 0.6 + i * (w - 1.2) / 8, y0 + h + 0.3, z + sz * (d / 2 - 0.1), 0.5, 0.3, 0.7);     // 檐下斗拱
  g.add(tangRoof({ w: w + 3.4, d: d + 3.4, h: 2.7, ridge: w * 0.62, material: M.roof, y: y0 + h + 0.6, z }));
  g.add(sign('齐云塔院', 2.9, 0.9, { bg: '#1d2f4f', fg: '#e8c45a', border: '#c9a227', x: 0, y: y0 + 3.98, z: z + d / 2 - 0.22 }));
}

// 石狮（蹲坐，面朝 +Z）
function lion(x, z, M) {
  const L = new THREE.Group(), s = M.stoneD, top = 1.0;
  L.add(box(1.0, 0.2, 1.5, s), box(0.84, 0.64, 1.32, M.stone, 0, 0.2, 0), box(1.0, 0.16, 1.5, s, 0, 0.84, 0));
  const S = (r, sx, sy, sz, px, py, pz) => { const m = sphere(r, s, px, top + py, pz, 10); m.scale.set(sx, sy, sz); return m; };
  L.add(S(0.38, 1, 1.05, 1.3, 0, 0.4, -0.12), S(0.34, 1, 1.25, 0.95, 0, 0.7, 0.2), S(0.38, 1.05, 1, 0.95, 0, 1.15, 0.22), S(0.28, 1, 0.95, 1, 0, 1.18, 0.4));
  L.add(box(0.28, 0.2, 0.2, s, 0, top + 1.02, 0.57));
  for (const k of [-1, 1]) L.add(cyl(0.09, 0.12, 0.78, s, k * 0.2, top, 0.44, 7), S(0.24, 0.9, 1, 1.25, k * 0.28, 0.22, -0.2), box(0.1, 0.12, 0.08, s, k * 0.18, top + 1.45, 0.3));
  L.position.set(x, 0, z); return L;
}

// 石碑：龟趺 + 碑身 + 碑首
function stele(B, g, M, x, z) {
  B.stoneD.box(x, 0.15, z, 1.5, 0.5, 2.3, 0, 63 - 8);
  const head = sphere(0.36, M.stoneD, x, 0.75, z + 1.3, 8); head.scale.set(1, 0.8, 1.3); g.add(head);
  B.slate.box(x, 0.65, z, 1.15, 2.7, 0.32, 0, 63 - 8).box(x, 3.35, z, 1.3, 0.62, 0.42);
  B.stoneD.box(x, 0.65, z, 1.3, 0.16, 0.5);
}

export function build() {
  const g = new THREE.Group();
  const BR = 0x8c8a84;
  const M = {
    brick: mat(BR, { map: patternTex('brick', BR) }), course: mat(0x99978f, { map: patternTex('brick', 0x99978f) }), dark: mat(0x241f1c), niche: mat(0x6f6c66), eave: mat(0x55554f),
    stone: mat(C.stone), stoneD: mat(C.stoneDark), slate: mat(0x55524c), red: mat(C.wallRed), verm: mat(C.vermilion), col: mat(C.tangRed), wood: mat(C.darkWood),
    gold: mat(C.gold), bronze: mat(C.bronze), iron: mat(0x3d3b38, { shiny: true }), roof: mat(C.tileGrey), pave: mat(C.paving), grass: mat(C.grass),
  };
  const B = {}; for (const k of ['brick', 'course', 'eave', 'stone', 'stoneD', 'slate', 'red', 'verm', 'wood']) B[k] = new Bat();

  // ── 铺地：院内青砖地、中轴甬道、两侧草地花池、门前小广场
  g.add(plaza(2 * WX - 1, WZF - WZB - 1, M.pave, 0, (WZF + WZB) / 2, 0.15));
  g.add(plaza(3.4, WZF - TZ - 9.5, M.stone, 0, (WZF + TZ + 6.5) / 2 + 1.3, 0.2));
  g.add(plaza(34, 9, M.pave, 0, WZF + 5.2, 0.15));
  for (const s of [-1, 1]) for (const [zc, len] of [[13, 22], [-12, 20]]) {
    g.add(plaza(11, len, M.grass, s * 17.5, zc, 0.22));
    B.stoneD.box(s * 17.5, 0.15, zc + len / 2, 11.3, 0.22, 0.2).box(s * 17.5, 0.15, zc - len / 2, 11.3, 0.22, 0.2).box(s * 12, 0.15, zc, 0.2, 0.22, len).box(s * 23, 0.15, zc, 0.2, 0.22, len);
  }

  for (const w of WALLS) wallSeg(B, g, M, w);
  gateHouse(g, B, M);
  pagoda(g, B, M, TZ);
  g.add(sign('齐云塔', 0.62, 1.5, { bg: '#4a4640', fg: '#e8cf8a', vertical: true, x: 0, y: 2.3 + 4.75, z: TZ + 3.9 }));

  // ── 后殿（三间小殿）
  g.add(hall({ w: HALL.w, d: HALL.d, wallH: 4.2, roofH: 3.6, eave: 1.8, platformH: 0.9, wall: C.wallRed, column: C.tangRed, roof: C.tileGrey, z: HALL.z }));

  // ── 塔前：香炉、石灯、石碑；门外石狮
  const bz = TZ + 12.5;
  B.stone.box(0, 0.15, bz, 2.4, 0.35, 2.4, 0, 63 - 8);
  g.add(cyl(0.8, 0.55, 0.8, M.bronze, 0, 1.1, bz, 12), cyl(0.88, 0.88, 0.08, M.bronze, 0, 1.9, bz, 12));
  for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.5; g.add(cyl(0.11, 0.07, 0.65, M.bronze, Math.sin(a) * 0.5, 0.5, bz + Math.cos(a) * 0.5, 6)); }
  for (const s of [-1, 1]) { g.add(box(0.1, 0.5, 0.26, M.bronze, s * 0.9, 1.75, bz)); g.add(cyl(0.035, 0.035, 1.3, M.bronze, s * 0.55, 1.98, bz, 5)); }
  g.add(tangRoof({ w: 2.4, d: 2.4, h: 0.7, ridge: 0, material: M.bronze, y: 3.28, z: bz, rings: 3, seg: 3 }));
  for (const s of [-1, 1]) for (const lz of [bz - 3, 22]) {                                   // 石灯
    const lx = s * 3.4;
    B.stoneD.box(lx, 0.15, lz, 0.7, 0.2, 0.7, 0, 63 - 8).box(lx, 0.35, lz, 0.26, 1.1, 0.26, 0, 51).box(lx, 1.45, lz, 0.62, 0.12, 0.62).box(lx, 2.0, lz, 0.8, 0.1, 0.8);
    g.add(box(0.44, 0.43, 0.44, mat(0xf2e2b0, { emissive: 0xffd890, emissiveIntensity: 0.5 }), lx, 1.57, lz));
    for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) B.stoneD.box(lx + a * 0.22, 1.57, lz + b * 0.22, 0.07, 0.43, 0.07, 0, 51);
    g.add(cyl(0.03, 0.46, 0.32, M.stoneD, lx, 2.1, lz, 4));
  }
  stele(B, g, M, -8, 15); stele(B, g, M, 8, 15);
  g.add(lion(-4.4, GATE.z + GATE.d / 2 + 2.6, M), lion(4.4, GATE.z + GATE.d / 2 + 2.6, M));

  // ── 古柏（院内成行、院外沿墙）+ 后殿前两株松
  const r = rng(11);
  const pts = [[-21, 23], [21, 23], [-14, 23], [14, 23], [-21, 15], [21, 15], [-14, 4], [14, 4], [-21, 5], [21, 5], [-21, -5], [21, -5], [-14, -12], [14, -12], [-21, -14], [21, -14], [-21, -21], [21, -21],
    [-31.5, 36], [31.5, 36], [-12, 37], [12, 37], [-31.5, 20], [31.5, 20], [-31.5, 4], [31.5, 4], [-31.5, -12], [31.5, -12], [-31.5, -28], [31.5, -28], [-20, -38], [0, -38.3], [20, -38]];
  for (const [x, z] of pts) g.add(tree(x + (r() - 0.5), z + (r() - 0.5), 8 + r() * 4.5, 'cypress'));
  g.add(tree(-11.5, -17.5, 7.5, 'pine'), tree(11.5, -17.5, 8, 'pine'));

  const matOf = { brick: M.brick, course: M.course, eave: M.eave, stone: M.stone, stoneD: M.stoneD, slate: M.slate, red: M.red, verm: M.verm, wood: M.wood };
  for (const k of Object.keys(B)) if (B[k].p.length) g.add(B[k].mesh(matOf[k]));
  return finalize(g);
}
