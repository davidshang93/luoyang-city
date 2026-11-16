// 丽景门 — 洛阳老城西门。正面(+Z)=西：瓮城+箭楼、护城河、三孔石桥；背面(-Z)=东，接老城西大街。
// 门洞沿本地 Z 轴贯通 (x ∈ [-4, 4])，城台/瓮城前墙都拆成左右两块，碰撞盒同样留出通道。
import { THREE, C, mat, box, tiledBox, cyl, sphere, plaza, hall, tangRoof, sign, tree, flag, patternTex, finalize } from './_kit.js';

const GATE = 8;            // 门洞宽
const MAIN = { z: -15, d: 24, w: 40, h: 12 };   // 主城台
const BARB = { z0: -3, z1: 34, half: 26, wall: 7, h: 10, frontD: 10 }; // 瓮城

export const meta = {
  colliders: [
    // 主城台：门洞两侧
    { x: -12, z: MAIN.z, w: 16, d: MAIN.d },
    { x: 12, z: MAIN.z, w: 16, d: MAIN.d },
    // 城墙
    { x: -40, z: -16, w: 40, d: 14 },
    { x: 40, z: -16, w: 40, d: 14 },
    // 瓮城侧墙
    { x: -22.5, z: 10.5, w: 7, d: 27 },
    { x: 22.5, z: 10.5, w: 7, d: 27 },
    // 瓮城前墙（箭楼台）：门洞两侧
    { x: -15, z: 29, w: 22, d: 10 },
    { x: 15, z: 29, w: 22, d: 10 },
  ],
};

// 拱券上方的“拱肩”：跨度 span，起拱高 spring，顶 top，沿 Z 厚 depth
function archSpandrel(span, spring, top, depth, material, x = 0, z = 0) {
  const r = span / 2, pts = [new THREE.Vector2(-r, spring)];
  for (let i = 1; i < 14; i++) { const a = Math.PI - i * Math.PI / 14; pts.push(new THREE.Vector2(Math.cos(a) * r, spring + Math.sin(a) * r)); }
  pts.push(new THREE.Vector2(r, spring), new THREE.Vector2(r, top), new THREE.Vector2(-r, top));
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth, bevelEnabled: false, curveSegments: 1 });
  geo.translate(0, 0, -depth / 2);
  const m = new THREE.Mesh(geo, material); m.position.set(x, 0, z); return m;
}

// 带门洞的城台：总宽 w，高 h，深 d，门洞宽 span、高 openH
function archedBlock(g, { w, h, d, span, openH, x = 0, z = 0, material, trim }) {
  const pw = (w - span) / 2;
  for (const s of [-1, 1]) g.add(tiledBox(pw, h, d, material, 2, 1, x + s * (span / 2 + pw / 2), 0, z));
  g.add(archSpandrel(span, openH - span / 2, h, d, material, x, z));
  // 券脸（拱圈石边）
  if (trim) for (const zz of [z + d / 2 + 0.05, z - d / 2 - 0.05]) {
    const r = span / 2, ring = new THREE.Shape();
    ring.absarc(0, 0, r + 0.7, 0, Math.PI, false); ring.lineTo(-r, 0); ring.absarc(0, 0, r, Math.PI, 0, true); ring.lineTo(r + 0.7, 0);
    const geo = new THREE.ExtrudeGeometry(ring, { depth: 0.2, bevelEnabled: false, curveSegments: 10 });
    geo.translate(0, 0, -0.1);
    const m = new THREE.Mesh(geo, trim); m.position.set(x, openH - span / 2, zz); g.add(m);
  }
  // 门洞内铺地
  g.add(plaza(span, d + 0.2, mat(C.paving, { map: patternTex('paving', C.paving) }), x, z, 0.15, 2));
}

// 垛口（沿 X 或 Z 方向的一排）
function battlement(g, ax, az, bx, bz, y, material) {
  const len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(-(bz - az), bx - ax);
  const cx = (ax + bx) / 2, cz = (az + bz) / 2;
  g.add(box(len, 0.9, 0.6, material, cx, y, cz, ry));
  const n = Math.floor(len / 2.2);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    g.add(box(1.2, 0.9, 0.6, material, cx + Math.cos(ry) * t * len, y + 0.9, cz - Math.sin(ry) * t * len, ry));
  }
}

// AI 模型（混元图生 3D）：assets/models/lijingmen.glb（62 x 39 x 33.5m，主城台 + 三重檐城楼，门洞沿 Z）。
// 只替换主城台和城楼；两侧城墙、瓮城、箭楼、护城河和桥仍是代码版。门洞中心在模型 x≈+2.2，所以整体左移 2.2。
export const glb = {
  file: 'lijingmen', x: -2.2, z: MAIN.z,
  colliders: [
    { x: -12.3, z: -16, w: 20.4, d: 34 }, { x: 11.2, z: -16, w: 18, d: 34 },   // 城台：门洞两侧
    { x: -28.7, z: -23, w: 9, d: 7 }, { x: -28.7, z: -9.4, w: 9, d: 7 }, { x: 24.3, z: -23, w: 9, d: 7 }, { x: 24.3, z: -9.4, w: 9, d: 7 },
    ...meta.colliders.slice(2),
  ],
};

export function build(_kit, o = {}) {
  const g = new THREE.Group();
  const brick = mat(0x9c9d9a, { map: patternTex('brick', 0x9c9d9a) });
  const brickDark = mat(0x85878a, { map: patternTex('brick', 0x85878a) });
  const stoneM = mat(C.stone, { map: patternTex('stone', C.stone) });
  const capM = mat(0x5f6163);
  const pave = mat(C.paving, { map: patternTex('paving', C.paving) });

  if (!o.glb) {
  // ── 主城台（带大拱门洞 8m 宽 9m 高）
  archedBlock(g, { w: MAIN.w, h: MAIN.h, d: MAIN.d, span: GATE, openH: 9, z: MAIN.z, material: brick, trim: stoneM });
  g.add(box(MAIN.w + 0.4, 0.3, MAIN.d + 0.4, capM, 0, MAIN.h - 0.3, MAIN.z));          // 台顶压檐
  battlement(g, -MAIN.w / 2 + 0.3, MAIN.z + MAIN.d / 2 - 0.3, MAIN.w / 2 - 0.3, MAIN.z + MAIN.d / 2 - 0.3, MAIN.h, brickDark);
  g.add(box(MAIN.w - 1, 1.1, 0.5, brickDark, 0, MAIN.h, MAIN.z - MAIN.d / 2 + 0.3));  // 女儿墙（城内侧）
  // 城台东侧（城内）马道台阶，两侧
  for (const s of [-1, 1]) for (let i = 0; i < 12; i++) g.add(box(4, MAIN.h * (i + 1) / 12, 1, brick, s * (MAIN.w / 2 - 3 - 4), 0, MAIN.z - MAIN.d / 2 - 0.5 - (11 - i) * 1));

  // ── 主城楼：三重檐歇山，红柱，通高约 31m
  const tower = hall({ w: 26, d: 13, wallH: 5, roofH: 4.5, eave: 2.2, platformH: 0.6, tiers: 3, tierShrink: 0.2, wall: C.wallRed, column: C.tangRed, roof: C.tileGrey, platform: C.stoneDark, steps: false, y: MAIN.h, z: MAIN.z });
  g.add(tower);
  // 彩画额枋（绿/蓝）
  g.add(box(26.6, 0.6, 13.6, mat(0x2f6b6a), 0, MAIN.h + 0.6 + 4.4, MAIN.z));
  g.add(box(21.4, 0.45, 11, mat(0x2f6b6a), 0, MAIN.h + 7.16 + 2.5, MAIN.z));
  // 回廊栏杆
  for (const zz of [MAIN.z + 8.3, MAIN.z - 8.3]) g.add(box(29, 0.9, 0.2, mat(C.tangRed), 0, MAIN.h + 0.6, zz));
  // 檐下红灯笼
  const lantern = mat(0xd8321e, { emissive: 0xc0200e, emissiveIntensity: 0.5 });
  for (const xx of [-9, -3, 3, 9]) { g.add(cyl(0.03, 0.03, 1.2, mat(C.black), xx, MAIN.h + 4.6, MAIN.z + 7.6, 4)); g.add(sphere(0.55, lantern, xx, MAIN.h + 4.2, MAIN.z + 7.6, 8)); }
  // 匾额“丽景门”（二层檐下，正面）
  g.add(sign('丽景门', 6.5, 2, { bg: '#1f3c5e', fg: '#f0cf6a', border: '#d4a93a', x: 0, y: MAIN.h + 8.9, z: MAIN.z + 5.55 }));
  }

  // ── 城墙（两侧，青灰砖，高 12m）
  for (const s of [-1, 1]) {
    const cx = s * 40;
    g.add(tiledBox(40, 12, 14, brick, 2, 1, cx, 0, -16));
    g.add(box(40, 0.3, 14.4, capM, cx, 11.7, -16));
    battlement(g, s * 20.3, -9.3, s * 59.7, -9.3, 12, brickDark);
    g.add(box(39.4, 1.0, 0.5, brickDark, cx, 12, -22.7));
    // 马面
    g.add(tiledBox(7, 12, 4, brick, 2, 1, s * 48, 0, -7));
    // 墙顶旗
    g.add(flag(s * 30, -12, 6, s > 0 ? 0xd4281c : 0xe0b020, 12));
  }

  // ── 瓮城：两侧墙 + 前墙（带门洞）+ 箭楼
  for (const s of [-1, 1]) {
    const cx = s * (BARB.half - BARB.wall / 2), zLen = 34 - 6 - BARB.z0; // 侧墙到前墙内侧
    g.add(tiledBox(BARB.wall, BARB.h, 27, brick, 2, 1, cx, 0, BARB.z0 + 27 / 2));
    g.add(box(BARB.wall + 0.3, 0.3, 27, capM, cx, BARB.h - 0.3, BARB.z0 + 27 / 2));
    battlement(g, s * (BARB.half - 0.3), BARB.z0 + 0.3, s * (BARB.half - 0.3), 24, BARB.h, brickDark);
    g.add(box(0.5, 1.0, 26, brickDark, s * (BARB.half - BARB.wall + 0.3), BARB.h, BARB.z0 + 13.5));
    void zLen;
  }
  archedBlock(g, { w: BARB.half * 2, h: BARB.h, d: BARB.frontD, span: GATE, openH: 8, z: 29, material: brick, trim: stoneM });
  g.add(box(BARB.half * 2 + 0.4, 0.3, BARB.frontD + 0.4, capM, 0, BARB.h - 0.3, 29));
  for (const s of [-1, 1]) battlement(g, s * 12, 33.7, s * 25.7, 33.7, BARB.h, brickDark);
  // 箭楼：青砖楼身 + 箭窗 + 歇山灰瓦顶
  const arrowY = BARB.h;
  g.add(tiledBox(22, 7.5, 8, brickDark, 2, 1, 0, arrowY, 29));
  g.add(box(22.6, 0.5, 8.6, capM, 0, arrowY + 7.5, 29));
  const winM = mat(0x1a1a1c);
  for (let r = 0; r < 2; r++) for (let i = 0; i < 9; i++) {
    const xx = -9.6 + i * 2.4, yy = arrowY + 1.6 + r * 3;
    g.add(box(0.9, 1.0, 0.12, winM, xx, yy, 33.02));
    g.add(box(0.9, 1.0, 0.12, winM, xx, yy, 24.98));
  }
  for (const s of [-1, 1]) for (let r = 0; r < 2; r++) for (let i = 0; i < 2; i++) g.add(box(0.12, 1.0, 0.9, winM, s * 11.02, arrowY + 1.6 + r * 3, 27 + i * 4));
  g.add(tangRoof({ w: 26, d: 12, h: 4.2, ridge: 15, y: arrowY + 8, z: 29 }));
  g.add(sign('丽景门', 4.2, 1.3, { bg: '#7a776e', fg: '#2a2016', border: '#5a574e', x: 0, y: 8.6, z: 34.08 }));
  // 瓮城内地面
  g.add(plaza(38, 26, pave, 0, 10.5, 0.15, 4));

  // ── 护城河 + 驳岸
  const water = mat(C.water, { shiny: true });
  g.add(plaza(118, 12, water, 0, 44, 0.15));
  for (const zz of [37.6, 50.4]) for (const s of [-1, 1]) g.add(box(53, 0.7, 0.8, stoneM, s * 32.5, 0, zz));
  // 三孔石桥（桥面沿 Z，宽 10m）
  {
    const L = 19, half = L / 2, topY = 1.3, rampY = 0.25, flatH = 5.5;
    const sh = new THREE.Shape();
    sh.moveTo(-half, 0); sh.lineTo(-half, rampY); sh.lineTo(-flatH, topY); sh.lineTo(flatH, topY); sh.lineTo(half, rampY); sh.lineTo(half, 0);
    const arches = [[3.6, 3.4, 0.95], [0, 3.8, 1.05], [-3.6, 3.4, 0.95]]; // [centre, span, rise]
    for (const [c, sp, rise] of arches) {
      sh.lineTo(c + sp / 2, 0);
      for (let i = 1; i < 8; i++) { const a = i * Math.PI / 8; sh.lineTo(c + Math.cos(a) * sp / 2, Math.sin(a) * rise); }
      sh.lineTo(c - sp / 2, 0);
    }
    sh.lineTo(-half, 0);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 10, bevelEnabled: false, curveSegments: 1 });
    geo.translate(0, 0, -5); geo.rotateY(Math.PI / 2);
    const br = new THREE.Mesh(geo, stoneM); br.position.set(0, 0, 44); g.add(br);
    // 桥面铺装 + 石栏杆
    g.add(plaza(9.4, 11, pave, 0, 44, topY + 0.02, 2));
    const rail = mat(C.marble);
    for (const s of [-1, 1]) {
      g.add(box(0.25, 0.25, 11, rail, s * 4.8, topY + 0.85, 44));
      for (let i = 0; i <= 8; i++) g.add(box(0.3, 1.1, 0.3, rail, s * 4.8, topY, 44 - 5.5 + i * 11 / 8));
      for (const e of [-1, 1]) g.add(box(0.35, 0.9, 4, rail, s * 4.8, (topY + rampY) / 2 - 0.15, 44 + e * 7.6, 0));
    }
  }
  // 通道铺地（桥前、城内西大街方向）
  g.add(plaza(14, 3.5, pave, 0, 53, 0.15, 2));
  g.add(plaza(12, 26, pave, 0, -40, 0.15, 2));
  g.add(plaza(16, 2.6, pave, 0, 35.5, 0.15, 2));

  // ── 绿化：城墙内外的树
  for (let i = 0; i < 6; i++) { g.add(tree(-55 + i * 7, -30, 8, 'round')); g.add(tree(20 + i * 7, -30, 8, 'round')); }
  for (let i = 0; i < 8; i++) { const x = -56 + i * 16; if (Math.abs(x) > 8) g.add(tree(x, 53.5, 7, 'willow')); }
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) g.add(tree(s * (34 + i * 9), 30, 7, 'willow'));
  // 城门前石狮（简化）
  for (const s of [-1, 1]) { g.add(box(1.4, 1.2, 2, stoneM, s * 6.5, 0, 35.8)); g.add(box(1.0, 1.4, 1.0, mat(C.stoneDark), s * 6.5, 1.2, 36.1)); }

  return finalize(g);
}
