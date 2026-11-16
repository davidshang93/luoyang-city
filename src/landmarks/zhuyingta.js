// 朱樱塔 — 洛浦公园东段的现代仿唐观光塔，高 99.6m。八角形平面，9 个可见层，
// 每层八角出檐（深灰瓦）+ 红色柱廊 + 玻璃塔心，顶部八角攒尖 + 高塔刹；底部两层八角裙房平台。檐口金红色灯带（少量自发光）。
import { THREE, C, mat, box, cyl, sphere, plaza, roundRoof, windowTex, patternTex, finalize } from './_kit.js';

const OCT = Math.PI / 8;   // 让八角形的平边朝向 ±X / ±Z

export const meta = {
  colliders: [{ x: 0, z: 0, w: 48, d: 48 }],
};

// 八角柱（可开口），uv 按 bays × rows 平铺，用于玻璃幕墙贴图
function octPrism(r, h, material, y, { open = false, bays = 2, rows = 1 } = {}) {
  const geo = new THREE.CylinderGeometry(r, r, h, 8, 1, open);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8 * bays, uv.getY(i) * rows);
  const m = new THREE.Mesh(geo, material); m.position.set(0, y + h / 2, 0); m.rotation.y = OCT; return m;
}

export function build() {
  const g = new THREE.Group();
  const stoneM = mat(0xd8d0c0, { map: patternTex('stone', 0xd8d0c0) });
  const red = mat(C.vermilion);
  const roofM = mat(0x3a3e44, { map: patternTex('roofTile', 0x3a3e44) });
  const glassMap = windowTex('grid', 0x6a2a1e, 0x2f4a5e);
  const glass = mat(glassMap ? 0xffffff : 0x3a3f4a, { map: glassMap, key: 'zyGlass' });
  const podMap = windowTex('mall', 0xd8d0c0, 0x35546b);
  const podium = mat(podMap ? 0xffffff : 0xd8d0c0, { map: podMap, key: 'zyPod' });
  const glow = mat(0xffb347, { emissive: 0xff9a2a, emissiveIntensity: 0.7 });
  const rail = mat(0xe9e4d8);
  const gold = mat(C.gold, { shiny: true });

  // ── 场地铺装
  g.add(plaza(59, 59, mat(C.paving, { map: patternTex('paving', C.paving) }), 0, 0, 0.15, 4));

  // ── 两层八角裙房平台
  const pods = [{ r: 25.5, h: 5.2, y: 0 }, { r: 19.5, h: 5, y: 5.2 }];
  for (const p of pods) {
    g.add(octPrism(p.r - 0.6, p.h - 0.5, podium, p.y, { bays: 3, rows: 1 }));
    g.add(octPrism(p.r, 0.5, stoneM, p.y + p.h - 0.5));
    g.add(octPrism(p.r - 0.3, 1.1, rail, p.y + p.h, { open: true }));     // 栏板
    // 红柱廊
    for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; g.add(cyl(0.3, 0.32, p.h - 0.5, red, Math.sin(a) * (p.r - 0.35), p.y, Math.cos(a) * (p.r - 0.35), 8)); }
  }
  // 正面大台阶（+Z）
  for (let i = 0; i < 10; i++) g.add(box(12, 5.2 * (1 - i / 10), 0.6, stoneM, 0, 0, 23.4 + i * 0.6));
  for (const s of [-1, 1]) g.add(box(0.8, 1.2, 6.2, stoneM, s * 6.4, 0, 26.5));

  // ── 塔身 9 层
  let y = 10.2, R = 11.9, fh = 6.3;
  for (let f = 0; f < 9; f++) {
    g.add(octPrism(R + 0.6, 0.6, stoneM, y));                       // 楼板/平座
    g.add(octPrism(R + 0.4, 1.0, rail, y + 0.6, { open: true }));   // 栏杆
    g.add(octPrism(R * 0.8, fh, glass, y + 0.6, { bays: 2, rows: 2 }));
    for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8 + OCT / 2 * 0; const rr = R * 0.97; g.add(cyl(0.32, 0.36, fh - 0.4, red, Math.sin(a) * rr, y + 0.6, Math.cos(a) * rr, 8)); }
    g.add(octPrism(R + 0.2, 0.7, mat(C.tangRed), y + fh - 0.2));    // 额枋
    const eave = 2.6 - f * 0.08, roofY = y + fh + 0.5, roofH = 2.2;
    const rr = roundRoof({ r: R + eave, h: roofH, sides: 8, lift: 0.9, material: roofM, y: roofY, finial: false });
    rr.rotation.y = OCT; g.add(rr);
    g.add(octPrism(R + eave + 0.05, 0.22, glow, roofY + 0.62, { open: true }));   // 檐口灯带
    y = roofY + roofH * 0.55;
    R *= 0.955; fh *= 0.975;
  }

  // ── 顶部八角攒尖 + 塔刹
  const top = roundRoof({ r: R + 2.4, h: 6, sides: 8, lift: 1.0, material: roofM, y, finial: false });
  top.rotation.y = OCT; g.add(top);
  g.add(octPrism(R + 2.45, 0.22, glow, y + 0.62, { open: true }));
  let sy = y + 5.6;
  g.add(cyl(1.0, 1.4, 1.6, gold, 0, sy, 0, 12)); sy += 1.6;              // 刹座
  g.add(sphere(1.2, gold, 0, sy + 0.9, 0, 12)); sy += 1.8;              // 覆钵
  for (let i = 0; i < 7; i++) g.add(cyl(1.1 - i * 0.09, 1.1 - i * 0.09, 0.3, gold, 0, sy + i * 1.0, 0, 12));   // 相轮
  g.add(cyl(0.22, 0.32, 7.5, gold, 0, sy, 0, 8)); sy += 7.5;            // 刹杆
  g.add(sphere(0.6, gold, 0, sy + 0.4, 0, 10));                         // 宝珠
  g.add(cyl(0.02, 0.12, Math.max(1.5, 99.6 - sy - 1.0), gold, 0, sy + 1.0, 0, 6));     // 刹尖到 99.6m

  return finalize(g);
}
