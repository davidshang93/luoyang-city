// 文峰塔 — 老城东南隅，方形九层密檐砖塔，约 30m，底边约 8m，青灰砖，逐层收分。
// 每层：略带收分的塔身 + 券窗 + 叠涩出檐（含一道菱角牙子）+ 反叠涩收顶 + 檐角风铎；首层南面券门、石匾“文峰塔”；塔顶四角攒尖 + 宝瓶刹。
// 塔下：须弥座、汉白玉栏杆月台、踏步、香炉、石灯、石碑、古柏。
import { THREE, C, mat, box, cyl, sphere, plaza, sign, tree, patternTex, finalize } from './_kit.js';

export const meta = {
  colliders: [{ x: 0, z: 0, w: 10, d: 10 }],
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
  const key = `${w}|${h}|${dep}`; let geo = _arch.get(key);
  if (!geo) { const r = w / 2, s = new THREE.Shape(); s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, h - r); s.absarc(0, h - r, r, 0, Math.PI, false); s.lineTo(-r, 0); geo = new THREE.ExtrudeGeometry(s, { depth: dep, bevelEnabled: false, curveSegments: 7 }); _arch.set(key, geo); }
  return geo;
}
/** 在 4 个面（或指定的面 k=0 南,1 东,2 北,3 西）上贴一个券窗：外圈砖券 + 深色窗洞 */
function archWin(g, x0, z0, half, y, w, h, M, faces = [0, 1, 2, 3], dark = M.dark) {
  for (const k of faces) {
    const a = k * Math.PI / 2, sx = Math.sin(a), cz = Math.cos(a);
    const fr = new THREE.Mesh(archGeo(w + 0.28, h + 0.14, 0.07), M.course); fr.position.set(x0 + sx * (half - 0.01), y - 0.02, z0 + cz * (half - 0.01)); fr.rotation.y = a; g.add(fr);
    const dk = new THREE.Mesh(archGeo(w, h, 0.1), dark); dk.position.set(x0 + sx * (half - 0.01), y, z0 + cz * (half - 0.01)); dk.rotation.y = a; g.add(dk);
    g.add(box(w + 0.36, 0.09, 0.16, M.course, x0 + sx * (half + 0.03), y - 0.11, z0 + cz * (half + 0.03), a));      // 窗台
  }
}

/**
 * 一重密檐：从 y（塔身顶，半边 half）起叠涩外挑 nC 层（第 2 层是菱角牙子），檐口板，再反叠涩 nB 层收回到 nextHalf。返回檐顶高度。
 */
function eave(B, g, M, x0, z0, half, y, nextHalf, { nC = 6, cH = 0.1, cS = 0.1, nB = 5, bH = 0.09 } = {}) {
  for (let k = 0; k < nC; k++) {
    const o = half + (k + 1) * cS;
    if (k === 1) {                                                            // 菱角牙子：一排转 45° 的砖角
      const oo = half + cS, n = Math.max(4, Math.floor(oo * 2 / 0.3));
      B.course.box(x0, y + k * cH, z0, oo * 2, cH, oo * 2, 0, 51);
      for (let i = 0; i < n; i++) { const t = -oo + (i + 0.5) * oo * 2 / n; for (const s of [1, -1]) { B.course.box(x0 + t, y + k * cH, z0 + s * oo, 0.15, cH, 0.15, Math.PI / 4, 51 + 8); B.course.box(x0 + s * oo, y + k * cH, z0 + t, 0.15, cH, 0.15, Math.PI / 4, 51 + 8); } }
    } else B.course.box(x0, y + k * cH, z0, o * 2, cH, o * 2, 0, 51 + 8);
  }
  y += nC * cH;
  const out = half + nC * cS + 0.05;
  B.dark.box(x0, y, z0, out * 2, 0.07, out * 2);                               // 檐口（深色瓦口）
  y += 0.07;
  for (let k = 0; k < nB; k++) { const o = out - 0.05 - (k + 1) * (out - 0.05 - nextHalf) / (nB + 0.6); B.course.box(x0, y + k * bH, z0, o * 2, bH, o * 2, 0, 51 + 4); }
  // 檐角风铎
  for (const sx of [1, -1]) for (const sz of [1, -1]) { g.add(cyl(0.012, 0.012, 0.16, M.bronze, x0 + sx * (out - 0.06), y - 0.3, z0 + sz * (out - 0.06), 4)); g.add(cyl(0.03, 0.085, 0.17, M.bronze, x0 + sx * (out - 0.06), y - 0.47, z0 + sz * (out - 0.06), 6)); }
  return y + nB * bH;
}

// 汉白玉栏杆：沿 (x0,z0)→(x1,z1)，立在 y
function balustrade(B, x0, z0, x1, z1, y) {
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 1.7)), ry = Math.abs(x1 - x0) > 0.01 ? 0 : Math.PI / 2, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  for (let i = 0; i <= n; i++) { const px = x0 + (x1 - x0) * i / n, pz = z0 + (z1 - z0) * i / n; B.box(px, y, pz, 0.2, 1.0, 0.2, 0, 63 - 8); B.box(px, y + 1.0, pz, 0.26, 0.08, 0.26); B.box(px, y + 1.08, pz, 0.16, 0.16, 0.16, 0, 63 - 8); }
  B.box(cx, y + 0.76, cz, L, 0.12, 0.14, ry); B.box(cx, y + 0.12, cz, L, 0.5, 0.08, ry); B.box(cx, y, cz, L, 0.12, 0.16, ry, 63 - 8);
}

export function build() {
  const g = new THREE.Group();
  const M = {
    brick: mat(0x9a9b97, { map: patternTex('brick', 0x9a9b97) }), course: mat(0xa6a7a3, { map: patternTex('brick', 0xa6a7a3) }), dark: mat(0x23201d), eave: mat(0x5c5d5b), niche: mat(0x7f807c),
    stone: mat(C.stone), stoneD: mat(C.stoneDark), marble: mat(C.marble), bronze: mat(C.bronze), pave: mat(C.paving),
  };
  const B = { brick: new Bat(), course: new Bat(), dark: new Bat(), stone: new Bat(), stoneD: new Bat(), marble: new Bat() };

  // ── 铺地 + 月台（汉白玉栏杆，南面留口设踏步）
  g.add(plaza(19.6, 19.6, M.pave, 0, 0, 0.15));
  const TR = 6.4, TY = 0.55;
  B.stone.box(0, 0, 0, TR * 2, TY, TR * 2, 0, 63 - 8).box(0, TY - 0.12, 0, TR * 2 + 0.2, 0.12, TR * 2 + 0.2);
  for (let i = 0; i < 3; i++) B.stone.box(0, 0, TR + 0.17 + i * 0.32, 3.4, TY * (1 - i / 3), 0.32, 0, 63 - 8 - 32);
  const e = TR - 0.2;
  balustrade(B.marble, -e, -e, e, -e, TY); balustrade(B.marble, -e, -e, -e, e, TY); balustrade(B.marble, e, -e, e, e, TY);
  balustrade(B.marble, -e, e, -1.9, e, TY); balustrade(B.marble, 1.9, e, e, e, TY);

  // ── 须弥座（下枋、束腰、上枋）
  let y = TY;
  for (const [s, h, m] of [[9.7, 0.3, 'stone'], [9.3, 0.22, 'stoneD'], [8.7, 0.5, 'stone'], [9.1, 0.2, 'stoneD'], [9.5, 0.28, 'stone']]) { B[m].box(0, y, 0, s, h, s, 0, 63 - 8); y += h; }
  for (let i = 0; i < 12; i++) for (const s of [1, -1]) { const t = -3.85 + i * 0.7; B.stoneD.box(t, TY + 0.56, s * 4.36, 0.1, 0.42, 0.04).box(s * 4.36, TY + 0.56, t, 0.04, 0.42, 0.1); }   // 束腰隔身板柱
  const baseTop = y;
  const nSt = 8, run = 0.3;                                                        // 上塔踏步（南）
  for (let i = 0; i < nSt; i++) B.stone.box(0, TY, 4.75 + 0.1 + (i + 0.5) * run, 2.3, (baseTop - TY) * (1 - i / nSt), run, 0, 63 - 8 - 32);
  for (const s of [-1, 1]) B.stoneD.box(s * 1.33, TY, 4.85 + nSt * run / 2, 0.36, (baseTop - TY) * 0.62, nSt * run + 0.2);

  // ── 塔身九层
  const FLOORS = 9, bodyH = [3.4, 1.7, 1.62, 1.54, 1.46, 1.38, 1.3, 1.22, 1.14];
  let half = 4.0;
  for (let f = 0; f < FLOORS; f++) {
    const h = bodyH[f], top = half - (f === 0 ? 0.12 : 0.06), next = half * (f < 5 ? 0.952 : 0.94);
    B.brick.frustum(0, y, 0, half, top, h);
    B.course.box(0, y, 0, half * 2 + 0.1, 0.14, half * 2 + 0.1, 0, 51 + 4);                                  // 层脚腰线
    for (const sx of [1, -1]) for (const sz of [1, -1]) B.course.box(sx * (half - 0.2), y + 0.14, sz * (half - 0.2), 0.46, h - 0.14, 0.46, 0, (sx > 0 ? 1 : 2) + (sz > 0 ? 16 : 32));   // 角倚柱
    const mid = (half + top) / 2;
    if (f === 0) {
      archWin(g, 0, 0, mid + 0.04, y + 0.16, 1.5, 2.6, M, [0]);                                               // 南券门
      archWin(g, 0, 0, mid + 0.04, y + 0.5, 1.3, 2.2, M, [1, 2, 3], M.niche);                                 // 其余三面盲券
      g.add(box(2.0, 0.12, 0.3, M.stone, 0, y, mid + 0.2));
      g.add(sign('文峰塔', 1.7, 0.55, { bg: '#4f4d47', fg: '#e8cf8a', x: 0, y: y + 3.12, z: half + 0.03 }));
    } else archWin(g, 0, 0, mid + 0.03, y + h * 0.3, 0.62, Math.min(1.1, h * 0.58), M);
    y = eave(B, g, M, 0, 0, top, y + h, f === FLOORS - 1 ? top * 0.72 : next, f === 0 ? { nC: 7, nB: 6 } : {});
    half = next;
  }

  // ── 塔顶：叠涩四角攒尖 + 宝瓶刹
  let r = half * 0.9;
  for (let k = 0; k < 6; k++) { B.course.box(0, y, 0, r * 2, 0.16, r * 2, 0, 51 + 4); y += 0.16; r *= 0.78; }
  const pts = [[0.02, 0], [0.62, 0], [0.68, 0.12], [0.5, 0.26], [0.42, 0.42], [0.3, 0.5], [0.62, 0.8], [0.8, 1.15], [0.72, 1.55], [0.42, 1.85], [0.24, 2.0], [0.24, 2.12], [0.4, 2.2], [0.24, 2.3], [0.1, 2.4], [0.07, 2.95], [0.16, 3.05], [0.02, 3.3]];
  const fin = new THREE.Mesh(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), 14), M.bronze); fin.position.y = y - 0.02; g.add(fin);

  // ── 塔前：香炉、石灯一对、石碑；四角古柏
  const by = TY;
  g.add(cyl(0.5, 0.36, 0.5, M.bronze, 0, by + 0.5, 8.3 - 0.05, 10), cyl(0.56, 0.56, 0.07, M.bronze, 0, by + 1.0, 8.25, 10));
  for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.5; g.add(cyl(0.07, 0.05, 0.52, M.bronze, Math.sin(a) * 0.32, by, 8.25 + Math.cos(a) * 0.32, 5)); }
  for (const s of [-1, 1]) g.add(box(0.08, 0.3, 0.16, M.bronze, s * 0.56, by + 0.95, 8.25));
  B.stone.box(0, 0.15, 8.25, 1.7, 0.4, 1.7, 0, 63 - 8);
  for (const s of [-1, 1]) {                                                       // 石灯
    const lx = s * 3.2, lz = 8.4;
    B.stoneD.box(lx, 0.15, lz, 0.7, 0.2, 0.7, 0, 63 - 8).box(lx, 0.35, lz, 0.26, 1.0, 0.26, 0, 51).box(lx, 1.35, lz, 0.62, 0.12, 0.62).box(lx, 1.9, lz, 0.8, 0.1, 0.8);
    g.add(box(0.44, 0.43, 0.44, mat(0xf2e2b0, { emissive: 0xffd890, emissiveIntensity: 0.5 }), lx, 1.47, lz));
    for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) B.stoneD.box(lx + a * 0.22, 1.47, lz + b * 0.22, 0.07, 0.43, 0.07, 0, 51);
    g.add(cyl(0.03, 0.46, 0.32, M.stoneD, lx, 2.0, lz, 4));
  }
  B.stoneD.box(7.6, 0.15, 5.2, 0.9, 0.4, 1.6, 0, 63 - 8).box(7.6, 0.55, 5.2, 0.28, 2.0, 1.1).box(7.6, 2.55, 5.2, 0.4, 0.3, 1.25);
  for (const [tx, tz, th] of [[-8.4, -8.4, 8], [8.4, -8.4, 7.2], [-8.4, 8.2, 6.6], [8.4, 8.2, 6.2], [-8.5, 0, 7], [0, -8.6, 7.4]]) g.add(tree(tx, tz, th, 'cypress'));

  for (const k of Object.keys(B)) if (B[k].p.length) g.add(B[k].mesh(k === 'dark' ? M.eave : M[k]));
  return finalize(g);
}
