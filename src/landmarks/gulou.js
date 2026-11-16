// 老城鼓楼 — 明代，骑东大街而建。青砖高台 20(X) x 17(Z) x 9m（四面略有收分），拱券门洞沿本地 Z 轴贯通（宽 6m 高 6.5m）。
// 台上单层重檐歇山木构楼（红柱灰瓦），总高约 21m。+Z=东：匾“就日”；-Z=西：匾“瞻云”。
// 细节：石砌须弥座、券脸石、叠涩压檐、四面垛口、门洞内敞开的朱漆门扇（门钉、铺首）、两侧登台马道、石狮、文保碑、檐下灯笼。
import { THREE, C, mat, box, cyl, sphere, plaza, hall, sign, patternTex, finalize } from './_kit.js';

const W = 20, D = 17, H = 9, SPAN = 6, OPEN_H = 6.5, BAT = 0.3;      // BAT = 台壁收分（顶比底每边收进的米数）
const STAIR = { w: 2.3, z0: -7.4, z1: 7.4 };                           // 两侧登台马道（贴南北侧壁，向东升高）

export const meta = {
  colliders: [
    { x: -(SPAN / 2 + (W - SPAN) / 4), z: 0, w: (W - SPAN) / 2, d: D },
    { x: (SPAN / 2 + (W - SPAN) / 4), z: 0, w: (W - SPAN) / 2, d: D },
    { x: -(W / 2 + STAIR.w / 2 + 0.2), z: 0, w: STAIR.w + 0.5, d: STAIR.z1 - STAIR.z0 },
    { x: (W / 2 + STAIR.w / 2 + 0.2), z: 0, w: STAIR.w + 0.5, d: STAIR.z1 - STAIR.z0 },
  ],
};

// ── 小批处理器（kit 的 Batch 没有导出）：把很多盒子攒成一个网格，可只出指定的面
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
  mesh(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.computeVertexNormals();
    return new THREE.Mesh(g, material);
  }
}
const put = (m, x, y, z, rx = 0, ry = 0, rz = 0) => { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); return m; };

// 砖台本体：正立面梯形 + 券洞，沿 Z 挤出，再把顶点按高度向内收（四面收分）
function platformGeo() {
  const hw = W / 2, sp = OPEN_H - SPAN / 2, s = new THREE.Shape();
  s.moveTo(-hw, 0); s.lineTo(-SPAN / 2, 0); s.lineTo(-SPAN / 2, sp); s.absarc(0, sp, SPAN / 2, Math.PI, 0, true);
  s.lineTo(SPAN / 2, 0); s.lineTo(hw, 0); s.lineTo(hw, H); s.lineTo(-hw, H); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: D, bevelEnabled: false, curveSegments: 18 });
  geo.translate(0, 0, -D / 2);
  const P = geo.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const y = P.getY(i), k = y / H; let x = P.getX(i);
    if (Math.abs(x) > hw - 0.01) x -= Math.sign(x) * BAT * k;
    P.setXYZ(i, x, y, P.getZ(i) * (1 - BAT / (D / 2) * k));
  }
  geo.computeVertexNormals();
  return geo;
}
// 让贴在 +Z 台壁上的构件跟着台壁一起后仰
function lean(geo) { const P = geo.attributes.position; for (let i = 0; i < P.count; i++) P.setZ(i, P.getZ(i) - BAT * P.getY(i) / H); geo.computeVertexNormals(); return geo; }

// 券脸石：半圆环（r → r+t），厚 dep，立在 +Z 台壁上
function archRingGeo(r, t, dep, y, z) {
  const ring = new THREE.Shape();
  ring.absarc(0, 0, r + t, 0, Math.PI, false); ring.lineTo(-r, 0); ring.absarc(0, 0, r, Math.PI, 0, true); ring.lineTo(r + t, 0);
  const geo = new THREE.ExtrudeGeometry(ring, { depth: dep, bevelEnabled: false, curveSegments: 14 });
  geo.translate(0, y, z);
  return lean(geo);
}
const leanBox = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y + h / 2, z + d / 2); return lean(g); };

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

// 红灯笼：y = 挂点高度
function lantern(g, x, y, z, r, M) {
  const b = sphere(r, M.lantern, x, y - 0.3 - r * 0.85, z, 10); b.scale.y = 0.85; g.add(b);
  g.add(cyl(0.012, 0.012, 0.3, M.black, x, y - 0.3, z, 4));
  g.add(cyl(r * 0.42, r * 0.42, 0.07, M.gold, x, y - 0.34, z, 8), cyl(r * 0.42, r * 0.42, 0.07, M.gold, x, y - 0.3 - r * 1.7 - 0.03, z, 8));
  g.add(cyl(0.05, 0.02, r * 0.9, M.gold, x, y - 0.3 - r * 1.7 - 0.03 - r * 0.9, z, 5));
}

// 石狮（蹲坐，面朝 +Z）
function lion(x, z, ry, M) {
  const L = new THREE.Group(), s = M.stoneD, top = 1.05;
  L.add(box(1.1, 0.22, 1.6, s), box(0.92, 0.66, 1.42, M.stone, 0, 0.22, 0), box(1.1, 0.17, 1.6, s, 0, 0.88, 0));
  const S = (r, sx, sy, sz, px, py, pz) => { const m = sphere(r, s, px, top + py, pz, 10); m.scale.set(sx, sy, sz); return m; };
  L.add(S(0.4, 1, 1.05, 1.3, 0, 0.42, -0.12), S(0.36, 1, 1.25, 0.95, 0, 0.72, 0.2), S(0.4, 1.05, 1, 0.95, 0, 1.2, 0.22), S(0.3, 1, 0.95, 1, 0, 1.24, 0.42));
  L.add(box(0.3, 0.2, 0.22, s, 0, top + 1.07, 0.6), box(0.1, 0.12, 0.08, s, 0.2, top + 1.52, 0.3), box(0.1, 0.12, 0.08, s, -0.2, top + 1.52, 0.3));
  for (const k of [-1, 1]) L.add(cyl(0.1, 0.13, 0.8, s, k * 0.22, top, 0.46, 7), S(0.25, 0.9, 1, 1.25, k * 0.3, 0.24, -0.2), box(0.2, 0.12, 0.3, s, k * 0.22, top, 0.52));
  L.add(S(0.15, 1, 1, 1, 0.2, 0.16, 0.62));                                 // 脚下绣球
  return put(L, x, 0, z, 0, ry);
}

export function build() {
  const g = new THREE.Group();
  const M = {
    brick: mat(0x8e908f, { map: patternTex('brick', 0x8e908f) }), brickL: mat(0x9c9e9c, { map: patternTex('brick', 0x9c9e9c) }),
    stone: mat(C.stone), stoneD: mat(C.stoneDark), pave: mat(C.paving),
    red: mat(C.tangRed), col: mat(C.tangRed), roof: mat(C.tileGrey), ridge: mat(0x4b5057), verm: mat(C.vermilion), wood: mat(C.darkWood), gold: mat(C.gold), black: mat(C.black),
    lantern: mat(0xd8321e, { emissive: 0xd02a12, emissiveIntensity: 0.55 }),
  };
  const bBrick = new Bat(), bBrickL = new Bat(), bStone = new Bat(), bStoneD = new Bat(), bRed = new Bat(), bWood = new Bat();
  const pw = (W - SPAN) / 2, hwT = W / 2 - BAT, hdT = D / 2 - BAT;       // 台顶半宽 / 半深

  // ── 青砖高台 + 券洞
  g.add(new THREE.Mesh(platformGeo(), M.brick));
  g.add(plaza(SPAN + 0.2, D + 6, M.pave, 0, 0, 0.15));                                          // 门洞内外的石板路
  for (const s of [-1, 1]) {
    const cx = s * (SPAN / 2 + pw / 2);
    bStone.box(cx, 0, 0, pw + 0.3, 0.35, D + 0.3).box(cx, 0.35, 0, pw + 0.16, 0.6, D + 0.16, 0, 63 - 12).box(cx, 0.95, 0, pw + 0.3, 0.2, D + 0.3);   // 须弥座石基
    bStoneD.box(s * (SPAN / 2 - 0.04), 0, 0, 0.16, 3.5, D - 0.6, 0, s > 0 ? 2 : 1);                                                                 // 券洞内石墙裙
  }
  // 台顶：叠涩压檐三层 + 墁砖台面 + 四面垛口女儿墙
  for (let k = 0; k < 3; k++) bBrickL.box(0, H - 0.48 + k * 0.16, 0, (hwT + 0.1 + k * 0.11) * 2, 0.16, (hdT + 0.1 + k * 0.11) * 2, 0, 63 - (k < 2 ? 4 : 0));
  g.add(plaza(hwT * 2 - 0.8, hdT * 2 - 0.8, M.stoneD, 0, 0, H + 0.03));
  const par = (x0, z0, x1, z1) => {
    const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.abs(x1 - x0) > 0.01 ? 0 : Math.PI / 2, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    bBrick.box(cx, H, cz, L, 0.85, 0.45, ry, 63 - 8); bBrickL.box(cx, H + 0.85, cz, L + 0.06, 0.1, 0.55, ry);
    const n = Math.max(1, Math.round(L / 1.55));
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; bBrick.box(x0 + (x1 - x0) * t, H + 0.95, z0 + (z1 - z0) * t, L / n - 0.55, 0.6, 0.45, ry, 63 - 8); }
  };
  const px = hwT - 0.12, pz = hdT - 0.12;
  par(-px, pz, px, pz); par(-px, -pz, px, -pz);
  for (const s of [-1, 1]) par(s * px, -pz, s * px, STAIR.z1 - 2.2);                               // 侧面女儿墙在马道口留缺

  // ── 两个立面（东 / 西相同，西面转 180°）：券脸石、门额石匾框、排水石槽
  const face = (text) => {
    const f = new THREE.Group(), sp = OPEN_H - SPAN / 2, zf = D / 2;
    f.add(new THREE.Mesh(archRingGeo(SPAN / 2, 0.55, 0.22, sp, zf - 0.08), M.stone));
    f.add(new THREE.Mesh(archRingGeo(SPAN / 2 + 0.55, 0.16, 0.3, sp, zf - 0.08), M.stoneD));
    for (const s of [-1, 1]) f.add(new THREE.Mesh(leanBox(0.55, sp - 1.15, 0.2, s * (SPAN / 2 + 0.275), 1.15, zf - 0.06), M.stone));
    f.add(new THREE.Mesh(leanBox(0.7, 0.75, 0.3, 0, OPEN_H - 0.05, zf - 0.06), M.stoneD));                     // 券顶龙门石
    f.add(new THREE.Mesh(leanBox(3.9, 1.5, 0.16, 0, OPEN_H + 0.72, zf - 0.04), M.stoneD));                     // 匾框
    for (const s of [-1, 1]) f.add(new THREE.Mesh(leanBox(0.3, 0.26, 0.7, s * 7.2, H - 0.9, zf - 0.1), M.stone));   // 吐水石槽
    const sg = sign(text, 3.5, 1.2, { bg: '#4f4d47', fg: '#e8cf8a', x: 0, y: OPEN_H + 1.47, z: zf - BAT * (OPEN_H + 1.47) / H + 0.14 });
    sg.rotation.x = -Math.atan(BAT / H); f.add(sg);
    return f;
  };
  g.add(face('就日'));
  const west = face('瞻云'); west.rotation.y = Math.PI; g.add(west);

  // ── 门洞内敞开的朱漆城门（贴在洞壁上）：门钉 7 路、铺首、门槛石
  const nail = new THREE.IcosahedronGeometry(0.075, 0);
  for (const s of [-1, 1]) {
    const dx = s * (SPAN / 2 - 0.2), dz = D / 2 - 2.7;
    bRed.box(dx, 0.2, dz, 0.14, 5.2, 2.9);
    for (const zz of [dz - 1.45, dz + 1.45]) bWood.box(dx, 0.2, zz, 0.2, 5.2, 0.14);
    for (let i = 0; i < 7; i++) for (let j = 0; j < 5; j++) g.add(put(new THREE.Mesh(nail, M.gold), dx - s * 0.08, 0.85 + i * 0.68, dz - 1.1 + j * 0.55));
    g.add(put(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 5, 10), M.gold), dx - s * 0.1, 2.3, dz + 1.15, 0, Math.PI / 2));
    bStoneD.box(s * (SPAN / 2 - 0.45), 0.15, D / 2 - 1.1, 0.7, 0.75, 0.7);                         // 门枕石
  }

  // ── 台上木构楼：重檐歇山，红柱灰瓦
  const T = { w: 13, d: 9, wallH: 4.2, roofH: 3.5, eave: 1.8, platformH: 0.45, shrink: 0.18, ridge: 3 };
  g.add(hall({ w: T.w, d: T.d, wallH: T.wallH, roofH: T.roofH, eave: T.eave, platformH: T.platformH, tiers: 2, tierShrink: T.shrink, ridge: T.ridge,
    wall: C.wallRed, column: C.tangRed, roof: C.tileGrey, platform: C.stoneDark, steps: false, ornaments: false, y: H }));
  const cy1 = T.platformH + T.wallH + 0.45 + T.roofH * 0.45 * 0.55, cw1 = T.w * (1 - T.shrink), cd1 = T.d * (1 - T.shrink);
  const roofY = H + cy1 + T.wallH * 0.6 + 0.45;
  xieshan(g, M, { w: cw1 + T.eave * 2, d: cd1 + T.eave * 2, h: T.roofH, ridge: T.ridge, gx: cw1 / 2 - 0.5, y: roofY });
  // 月台踏步（东西各一）+ 木栏杆
  const pwid = T.w + T.eave * 1.3, pdep = T.d + T.eave * 1.3;
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) bStoneD.box(0, H, s * (pdep / 2 + 0.16 + i * 0.3), 3.6, 0.45 - i * 0.15, 0.32, 0, 63 - 8);
  const rail = (x0, z0, x1, z1) => {
    const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.abs(x1 - x0) > 0.01 ? 0 : Math.PI / 2, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, y0 = H + T.platformH;
    bRed.box(cx, y0 + 0.82, cz, L, 0.1, 0.12, ry).box(cx, y0 + 0.42, cz, L, 0.07, 0.08, ry).box(cx, y0 + 0.08, cz, L, 0.07, 0.08, ry);
    const n = Math.max(1, Math.round(L / 1.5));
    for (let i = 0; i <= n; i++) bRed.box(x0 + (x1 - x0) * i / n, y0, z0 + (z1 - z0) * i / n, 0.13, 1.0, 0.13, 0, 63 - 8);
  };
  const rx = pwid / 2 - 0.15, rz = pdep / 2 - 0.15;
  for (const s of [-1, 1]) { rail(s * rx, -rz, s * rx, rz); for (const t of [-1, 1]) rail(t * 2.1, s * rz, t * rx, s * rz); }
  // 上檐下“鼓楼”竖匾（东面）
  g.add(sign('鼓楼', 1.5, 0.95, { bg: '#1d2f4f', fg: '#e8c45a', border: '#c9a227', x: 0, y: roofY - 0.75, z: cd1 / 2 + 0.75 }));
  // 檐下灯笼
  const ly = H + T.platformH + T.wallH - 0.25;
  for (const sz of [-1, 1]) { for (const sx of [-1.5, 1.5]) lantern(g, sx * 1.45, ly, sz * (T.d / 2 + 0.75), 0.36, M); for (const sx of [-1, 1]) lantern(g, sx * (T.w / 2 + 0.6), ly, sz * (T.d / 2 + 0.6), 0.42, M); }

  // ── 两侧登台马道：条石踏步 + 砖砌实心梯身 + 外侧随坡砖栏
  const n = 34, run = (STAIR.z1 - STAIR.z0 - 1.6) / n, rise = H / n;
  for (const s of [-1, 1]) {
    const cx = s * (W / 2 - 0.35 + STAIR.w / 2);
    for (let i = 0; i < n; i++) {
      const zz = STAIR.z0 + (i + 0.5) * run, top = (i + 1) * rise;
      bBrick.box(cx, 0, zz, STAIR.w + 0.7, top - 0.12, run, 0, s > 0 ? 1 + 32 : 2 + 32);
      bStone.box(cx, top - 0.12, zz, STAIR.w + 0.7, 0.12, run + 0.04, 0, 63 - 8);
    }
    bBrick.box(cx, 0, STAIR.z1 - 0.8, STAIR.w + 0.7, H, 1.6, 0, (s > 0 ? 1 : 2) + 16 + 32);          // 梯顶平台
    bStone.box(cx, H, STAIR.z1 - 0.8, STAIR.w + 0.7, 0.04, 1.6, 0, 4);
    const sh = new THREE.Shape(), z0 = STAIR.z0, z1 = STAIR.z1 - 1.6;                                // 随坡砖栏（在 Z-Y 平面画，再挤出 0.36 厚）
    sh.moveTo(z0, 0); sh.lineTo(z1, 0); sh.lineTo(STAIR.z1, 0); sh.lineTo(STAIR.z1, H + 0.95); sh.lineTo(z1, H + 0.95); sh.lineTo(z0, rise + 0.95); sh.closePath();
    const wg = new THREE.ExtrudeGeometry(sh, { depth: 0.36, bevelEnabled: false }); wg.rotateY(-Math.PI / 2);
    g.add(put(new THREE.Mesh(wg, M.brick), s * (W / 2 + STAIR.w + 0.2) + 0.18, 0, 0));
    bBrickL.box(s * (W / 2 + STAIR.w + 0.2), H + 0.95, STAIR.z1 - 0.8, 0.46, 0.1, 1.64);
    bBrick.box(cx, H, STAIR.z1 - 0.18, STAIR.w + 0.7, 0.95, 0.36, 0, 63 - 8);
  }

  // ── 门前：石狮一对（东面）、拴马桩（西面）、文保碑
  g.add(lion(-(SPAN / 2 + 1.5), D / 2 + 1.7, 0, M), lion(SPAN / 2 + 1.5, D / 2 + 1.7, 0, M));
  for (const s of [-1, 1]) { bStoneD.box(s * (SPAN / 2 + 1.2), 0, -D / 2 - 1.3, 0.34, 1.5, 0.34, 0, 63 - 8); g.add(sphere(0.22, M.stoneD, s * (SPAN / 2 + 1.2), 1.62, -D / 2 - 1.3, 8)); }
  bStoneD.box(7.2, 0, D / 2 + 1.5, 1.7, 0.45, 0.8).box(7.2, 0.45, D / 2 + 1.5, 1.3, 1.5, 0.3).box(7.2, 1.95, D / 2 + 1.5, 1.45, 0.22, 0.4);
  g.add(sign('鼓楼', 1.0, 0.5, { bg: 'transparent', fg: '#2c2a26', x: 7.2, y: 1.45, z: D / 2 + 1.66 }));

  g.add(bBrick.mesh(M.brick), bBrickL.mesh(M.brickL), bStone.mesh(M.stone), bStoneD.mesh(M.stoneD), bRed.mesh(M.verm), bWood.mesh(M.wood));
  return finalize(g);
}
