// 应天门（隋唐洛阳城宫城正南门，2019 复建）。“凹”字形：中央城楼 + 东西垛楼 + 南伸飞廊 + 东西三出阙。
// 正面 +Z（南）。城台高 13m，3 个门道（必须留空），城楼重檐庑殿顶，通高约 48m。
import { THREE, C, mat, box, cyl, plaza, hall, tangRoof, sign, patternTex, flag, finalize } from './_kit.js';

const BRICK = 0x7c8183, ROOF = 0x4a5057;
const HALL_ROOF = ROOF;   // hall() 内部用 颜色×同色贴图，传浅一些的色使最终效果≈ROOF

// 布局常量
const CEN = { x0: -32, x1: 32, z0: -52, z1: -24, h: 13 };                // 中央城台
const DOORS = [[-17, -11], [-3.5, 3.5], [11, 17]];                        // 三门道（x 范围）
const DOOR_H = 8.6;
const SIDE = { xi: 32, xo: 78, z0: -50, z1: -27, h: 12 };                  // 两翼城墙台
const FEI = { x: 70, w: 11, z0: -27, z1: 32, h: 10 };                     // 飞廊台（x=±70）
const QUE = [                                                            // 三出阙：母阙 → 子阙，向外递减
  { x: 66, z: 41, w: 16, d: 18, h: 17, top: 11 },
  { x: 77.5, z: 39, w: 8, d: 14, h: 13.5, top: 8 },
  { x: 84, z: 37, w: 5.5, d: 10, h: 10, top: 5.5 },
];

const colliders = [];
// 门道之间的墩台
{
  const xs = [CEN.x0, ...DOORS.flat(), CEN.x1];
  for (let i = 0; i < xs.length; i += 2) colliders.push({ x: (xs[i] + xs[i + 1]) / 2, z: (CEN.z0 + CEN.z1) / 2, w: xs[i + 1] - xs[i], d: CEN.z1 - CEN.z0 });
}
for (const s of [-1, 1]) {
  colliders.push({ x: s * (SIDE.xi + SIDE.xo) / 2, z: (SIDE.z0 + SIDE.z1) / 2, w: SIDE.xo - SIDE.xi, d: SIDE.z1 - SIDE.z0 });
  colliders.push({ x: s * FEI.x, z: (FEI.z0 + FEI.z1) / 2, w: FEI.w, d: FEI.z1 - FEI.z0 });
  for (const q of QUE) colliders.push({ x: s * q.x, z: q.z, w: q.w, d: q.d });
}
// 贴图材质：底色由贴图提供，材质色用白色（避免 颜色×贴图 叠加变暗）
const tm = (color, kind, line = 0x000000) => { const t = patternTex(kind, color, line); return mat(t ? 0xffffff : color, { map: t }); };

export const meta = { colliders };

// 墙台：砖砌，略带收分（底座 + 主体 + 顶面女墙）
function platform(g, brick, cap, x0, x1, z0, z1, h, parapet = true) {
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  g.add(box(w + 0.8, 1.0, d + 0.8, cap, cx, 0, cz));        // 石质基座
  g.add(box(w, h - 1.0, d, brick, cx, 1.0, cz));
  g.add(box(w + 0.5, 0.4, d + 0.5, cap, cx, h - 0.4, cz));  // 压顶
  if (parapet) {
    for (const zz of [z0 + 0.3, z1 - 0.3]) g.add(box(w, 1.2, 0.5, brick, cx, h, zz));
    for (const xx of [x0 + 0.3, x1 - 0.3]) g.add(box(0.5, 1.2, d, brick, xx, h, cz));
  }
}

// 门道拱券：门洞上部的砖填充（半椭圆拱），沿 Z 方向贯通
function archFill(x0, x1, z0, z1, material) {
  const xc = (x0 + x1) / 2, r = (x1 - x0) / 2, spring = DOOR_H - 2.8;
  const pts = [new THREE.Vector2(x1, DOOR_H + 0.05), new THREE.Vector2(x0, DOOR_H + 0.05), new THREE.Vector2(x0, spring)];
  for (let i = 1; i < 12; i++) { const a = Math.PI - i / 12 * Math.PI; pts.push(new THREE.Vector2(xc + r * Math.cos(a), spring + 2.7 * Math.sin(a))); }
  pts.push(new THREE.Vector2(x1, spring));
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: z1 - z0, bevelEnabled: false });
  const m = new THREE.Mesh(geo, material); m.position.z = z0; return m;
}

// 廊屋：沿 X（或旋转后沿 Z）的长廊，红柱 + 庑殿顶
function gallery(g, len, dep, colH, x, y, z, ry, roofMat, red, wall) {
  const grp = new THREE.Group();
  grp.add(box(len, 0.4, dep, mat(C.stone), 0, 0, 0));
  const n = Math.max(2, Math.round(len / 3.6));
  for (let i = 0; i <= n; i++) for (const zz of [-dep / 2 + 0.4, dep / 2 - 0.4]) grp.add(cyl(0.25, 0.28, colH, red, -len / 2 + 0.4 + i * (len - 0.8) / n, 0.4, zz, 8));
  grp.add(box(len - 0.6, colH * 0.55, 0.3, wall, 0, 0.4, -dep / 2 + 0.6));   // 背墙（半高）
  grp.add(box(len, 0.5, dep, mat(C.darkWood), 0, colH + 0.3, 0));
  grp.add(tangRoof({ w: len + 2, d: dep + 2.4, h: 2.6, ridge: len - dep * 0.3, material: roofMat, y: colH + 0.75 }));
  grp.position.set(x, y, z); grp.rotation.y = ry;
  g.add(grp);
}

// 阙楼：砖台 + 台上单檐小殿（四阿顶）
function queTower(g, q, sx, brick, cap, roofMat) {
  const x = sx * q.x;
  platform(g, brick, cap, x - q.w / 2, x + q.w / 2, q.z - q.d / 2, q.z + q.d / 2, q.h, true);
  const hw = q.w - 2.2, hd = q.d - 2.6;
  g.add(hall({ w: hw, d: hd, wallH: q.top * 0.5, roofH: q.top * 0.45, eave: Math.min(2, q.w * 0.18), platformH: 0.4, steps: false,
    wall: C.wallWhite, column: C.tangRed, roof: HALL_ROOF, x, y: q.h, z: q.z }));
}

// AI 模型（混元图生 3D）：assets/models/yingtianmen.glb。模型正面朝它自己的 +X，所以绕 Y 转 -90° 让正面朝本地 +Z。
// 模型约 165(宽) x 142(深) x 56(高) m：北侧城楼、两翼垛楼、南伸飞廊、南端两座阙楼，中间是朝南敞开的院子。
// 模型的门洞不是真通道，所以 GLB 版城台整体是实心碰撞。
export const glb = {
  file: 'yingtianmen', yaw: -Math.PI / 2,
  colliders: [
    { x: 2, z: -24, w: 92, d: 72 },                                         // 城楼 + 城台
    { x: 70, z: -6, w: 14, d: 132 }, { x: -66, z: -6, w: 14, d: 132 },       // 东西飞廊
    { x: 74, z: -30, w: 22, d: 30 }, { x: -70, z: -30, w: 22, d: 30 },       // 垛楼
    { x: 56, z: -54, w: 16, d: 12 }, { x: -52, z: -54, w: 16, d: 12 }, { x: 54, z: -40, w: 12, d: 8 }, { x: -50, z: -40, w: 12, d: 8 },
    { x: 56, z: -14, w: 16, d: 5 }, { x: -52, z: -14, w: 16, d: 5 },
    { x: 46, z: 59.5, w: 22, d: 24 }, { x: -26, z: 59.5, w: 22, d: 24 },     // 阙楼
    { x: 60, z: 56, w: 10, d: 10 }, { x: -48, z: 56, w: 24, d: 10 },
  ],
};

export function build(_kit, o = {}) {
  const g = new THREE.Group();
  if (o.glb) {
    g.add(plaza(118, 60, mat(C.paving, { map: patternTex('paving', C.paving) }), 2, 30, 0.15, 4));
    g.add(plaza(14, 62, mat(0xb9b09c, { map: patternTex('stone', 0xb9b09c) }), 2, 43, 0.2, 3));
    for (const s of [-1, 1]) { g.add(flag(10 + s * 14, 72, 16, 0xc8281c)); g.add(flag(10 + s * 22, 72, 16, 0xd9a531)); }
    return finalize(g);
  }
  const brick = tm(BRICK, 'brick');
  const cap = mat(C.stoneDark, { map: patternTex('stone', C.stoneDark) });
  const red = mat(C.tangRed), white = mat(C.wallWhite);
  const roofMat = tm(ROOF, 'roofTile');

  // ── 广场铺装（凹字内 + 门前）──
  g.add(plaza(120, 79, mat(C.paving, { map: patternTex('paving', C.paving) }), 0, 15.5, 0.15, 4));
  g.add(plaza(14, 60, mat(0xb9b09c, { map: patternTex('stone', 0xb9b09c) }), 0, 25, 0.2, 3));   // 御道

  // ── 中央城台（三门道留空）──
  const xs = [CEN.x0, ...DOORS.flat(), CEN.x1];
  for (let i = 0; i < xs.length; i += 2) {
    g.add(box(xs[i + 1] - xs[i], 1.0, CEN.z1 - CEN.z0 + 0.8, cap, (xs[i] + xs[i + 1]) / 2, 0, (CEN.z0 + CEN.z1) / 2));
    g.add(box(xs[i + 1] - xs[i], DOOR_H - 1.0, CEN.z1 - CEN.z0, brick, (xs[i] + xs[i + 1]) / 2, 1.0, (CEN.z0 + CEN.z1) / 2));
  }
  for (const [a, b] of DOORS) g.add(archFill(a, b, CEN.z0, CEN.z1, brick));
  g.add(box(CEN.x1 - CEN.x0, CEN.h - DOOR_H - 0.4, CEN.z1 - CEN.z0, brick, 0, DOOR_H, (CEN.z0 + CEN.z1) / 2));
  g.add(box(CEN.x1 - CEN.x0 + 0.5, 0.4, CEN.z1 - CEN.z0 + 0.5, cap, 0, CEN.h - 0.4, (CEN.z0 + CEN.z1) / 2));
  // 门道内深色（门扇、地面）
  for (const [a, b] of DOORS) {
    g.add(plaza(b - a, CEN.z1 - CEN.z0, mat(0x8d8a82), (a + b) / 2, (CEN.z0 + CEN.z1) / 2, 0.2));
    // 敞开的朱红门扇（贴在门道两侧内壁，不挡通道）
    for (const xx of [a + 0.12, b - 0.12]) g.add(box(0.2, DOOR_H - 3.2, 3.2, mat(0x7a2418), xx, 0, CEN.z1 - 3));
  }
  // 城台顶女墙（正面留出城楼位置以外）
  for (const zz of [CEN.z0 + 0.3, CEN.z1 - 0.3]) g.add(box(CEN.x1 - CEN.x0, 1.2, 0.5, brick, 0, CEN.h, zz));

  // ── 中央城楼：面阔九间，重檐庑殿顶 ──
  const main = hall({ w: 46, d: 19, wallH: 10, roofH: 11, eave: 3.2, platformH: 1.4, tiers: 2, tierShrink: 0.12, steps: false,
    wall: C.wallWhite, column: C.tangRed, roof: HALL_ROOF, x: 0, y: CEN.h, z: (CEN.z0 + CEN.z1) / 2 });
  g.add(main);
  g.add(sign('应天门', 12, 4.2, { bg: '#1f2a44', fg: '#e8c25a', border: '#c99a35', x: 0, y: CEN.h + 1.4 + 10 + 0.45 + 4.95 * 0.55 + 3.6, z: (CEN.z0 + CEN.z1) / 2 + 19 * 0.88 / 2 + 0.6 }));
  // 鸱吻（正脊两端金色）
  const ridgeY = CEN.h + (main.userData.height || 47 - CEN.h);
  for (const s of [-1, 1]) g.add(box(1.2, 2.6, 0.8, mat(C.gold, { shiny: true }), s * 13.2, ridgeY - 0.3, (CEN.z0 + CEN.z1) / 2));

  for (const s of [-1, 1]) {
    // ── 两翼城墙台 + 连廊 + 垛楼 ──
    const xa = s > 0 ? SIDE.xi : -SIDE.xo, xb = s > 0 ? SIDE.xo : -SIDE.xi;
    platform(g, brick, cap, xa, xb, SIDE.z0, SIDE.z1, SIDE.h);
    const sz = (SIDE.z0 + SIDE.z1) / 2;
    gallery(g, 16, 8, 4.2, s * 44, SIDE.h, sz, 0, roofMat, red, white);
    g.add(hall({ w: 17, d: 13, wallH: 6.5, roofH: 6, eave: 2.4, platformH: 0.8, tiers: 1, steps: false,
      wall: C.wallWhite, column: C.tangRed, roof: HALL_ROOF, x: s * 64, y: SIDE.h, z: sz }));

    // ── 南伸飞廊（城台 + 廊屋）──
    platform(g, brick, cap, s * FEI.x - FEI.w / 2, s * FEI.x + FEI.w / 2, FEI.z0, FEI.z1, FEI.h);
    gallery(g, FEI.z1 - FEI.z0 - 6, 7, 4.0, s * FEI.x, FEI.h, (FEI.z0 + FEI.z1) / 2 + 1, Math.PI / 2 * -s, roofMat, red, white);

    // ── 三出阙（母阙最高，两子阙向外递减）──
    for (const q of QUE) queTower(g, q, s, brick, cap, roofMat);

    // 门前旗杆
    g.add(flag(s * 26, 6, 16, 0xc8281c));
    g.add(flag(s * 26, 22, 16, 0xd9a531));
  }
  return finalize(g);
}
