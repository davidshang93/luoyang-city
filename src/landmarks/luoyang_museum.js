// 洛阳博物馆新馆：倒梯形“大鼎”
import { THREE, C, mat, tex, box, tiledBox, cyl, plaza, sign, tree, patternTex, finalize } from './_kit.js';

export const meta = { colliders: [{ x: 0, z: 0, w: 112, d: 112 }] };

function stripeTex() {
  const t = tex('museum|stripe', 64, 64, (g, w, h) => {
    g.fillStyle = '#d9c9a0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c4b184'; g.fillRect(0, 0, w, 6);
    g.fillStyle = '#e6d9b6'; g.fillRect(0, 6, w, 3);
  });
  if (t) t.repeat.set(1, 10);
  return t;
}

// AI 模型（混元图生 3D）：assets/models/luoyang_museum.glb 替换主体建筑；四周水池和广场仍是代码版。
export const glb = { file: 'luoyang_museum' };

export function build(_kit, o = {}) {
  const g = new THREE.Group();
  const stone = mat(0xd9c9a0, { map: stripeTex(), key: 'ms' });
  const paveM = mat(C.paving, { map: patternTex('paving', C.paving) });
  const water = mat(C.water, { opacity: 0.85 });

  // 水池（三面）+ 前广场
  g.add(plaza(150, 12, water, 0, -69, 0.15));
  g.add(plaza(12, 126, water, -69, 6, 0.15));
  g.add(plaza(12, 126, water, 69, 6, 0.15));
  g.add(plaza(150, 12, water, 0, 69, 0.15));
  g.add(plaza(150, 8, paveM, 0, 71, 0.25, 4));
  g.add(plaza(40, 14, paveM, 0, 68, 0.3, 4)); // 过水池的石桥
  g.add(plaza(30, 8, paveM, 0, 71, 0.3, 4));
  if (o.glb) return finalize(g);

  // 倒梯形主体：底 104 → 顶 130，高 30
  const H = 30, bot = 104, top = 130;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(top / Math.SQRT2, bot / Math.SQRT2, H, 4, 1), stone);
  body.rotation.y = Math.PI / 4; body.position.y = 1 + H / 2;
  g.add(body);
  g.add(box(bot + 2, 1, bot + 2, mat(C.stoneDark), 0, 0, 0)); // 基座
  g.add(box(top + 0.6, 1.4, top + 0.6, mat(0xb9a87c), 0, 1 + H - 0.6, 0)); // 檐口

  // 屋顶 13 个方形凸起
  const sizes = [[16, 7], [12, 5], [10, 8], [14, 4], [9, 6], [11, 9], [8, 5], [13, 6], [10, 4], [7, 7], [12, 8], [9, 4], [8, 6]];
  const pos = [[-40, -38], [-12, -42], [18, -38], [44, -40], [-44, -8], [-18, -14], [10, -10], [38, -6], [-40, 24], [-10, 20], [18, 26], [44, 24], [-22, 44]];
  const roofTop = 1 + H + 0.8;
  const skyM = mat(C.glassBlue, { shiny: true });
  sizes.forEach(([s, h], i) => {
    g.add(box(s, h, s, stone, pos[i][0], roofTop, pos[i][1]));
    g.add(box(s * 0.7, 0.3, s * 0.7, skyM, pos[i][0], roofTop + h, pos[i][1]));
  });

  // 正面（+Z，北）入口：内凹门洞 + 大台阶
  const fz = (y) => (bot / 2) + (top - bot) / 2 * (y / H); // 正面墙在高度 y 处的 z
  const doorW = 36, doorH = 17;
  g.add(box(doorW, doorH, 1, mat(C.glassDark, { shiny: true }), 0, 1, fz(8) - 3));
  // 门洞深框（侧壁 + 顶 + 底）
  g.add(box(2.5, doorH + 2, 8, stone, -doorW / 2 - 1.2, 1, fz(8) + 1));
  g.add(box(2.5, doorH + 2, 8, stone, doorW / 2 + 1.2, 1, fz(8) + 1));
  g.add(box(doorW + 6.2, 3.2, 8, stone, 0, 1 + doorH, fz(8) + 1));
  for (let i = -2; i <= 2; i++) g.add(box(0.6, doorH, 0.6, mat(C.steel), i * 7, 1, fz(8) - 2.4));
  g.add(sign('洛阳博物馆', 26, 3.4, { bg: '#2b2a26', fg: '#e8d9a8', x: 0, y: 1 + doorH + 1.6, z: fz(8) + 5.05 }));
  // 台阶
  for (let i = 0; i < 6; i++) g.add(box(50, 0.2 * (6 - i), 2, mat(C.stone), 0, 0, fz(8) + 4 + i * 2));
  // 侧面小门 + 条窗
  g.add(box(30, 3, 0.3, mat(C.glassDark, { shiny: true }), 0, 24, fz(24) + 0.2));

  // 树
  for (let i = -3; i <= 3; i++) { g.add(tree(i * 20, 74, 8, 'round')); }
  for (const x of [-72, 72]) for (let z = -50; z <= 50; z += 25) g.add(tree(x, z, 7, 'plane'));
  return finalize(g);
}
