// 王府井百货：7 层大型百货（米黄石材 + 玻璃幕），转角圆弧玻璃入口，屋顶红字钢架，大幅 LED 屏，正面（北）朝 +Z
import { THREE, C, mat, box, cyl, plaza, tower, sign, finalize } from './_kit.js';
import { COL, mallBlock, entrance, ledWall, fins, belt, cylFacade, signFrame, pavingZone, planter, treeRow, bench, lampRow, carpark, led, lightStrips } from './_retail.js';

export const meta = {
  colliders: [{ x: -14, z: -20, w: 148, d: 80 }, { x: 60, z: 6, w: 28, d: 28 }],
};

export function build() {
  const g = new THREE.Group();
  pavingZone(g, { x: 0, z: 47, w: 180, d: 50, col: C.paving, accent: 0xa9a294, band: 16 });

  // 米黄色石材主体 7 层 36m
  mallBlock(g, { x: -14, z: -20, w: 148, d: 80, h: 36, floor: 5.14, bay: 6, wall: 0xe0cfa0, glass: C.glassGreen, cap: 0xcbb888, sky: 3, seed: 21, beltCol: 0xd4c08c,
    plant: { ac: 8, cool: 3, rooms: 3, stacks: 4, pipes: 4, mast: true, avoid: [[-8, 17, 48, 6], [60, 6, 30, 30]] } });
  // 石材竖向壁柱 + 腰线
  fins(g, { x0: -86, x1: 46, z: 20.3, y: 4.8, h: 31, pitch: 12, t: 1.2, depth: 0.6, col: 0xd4c08c });
  belt(g, { x: -14, y: 4.9, z: 20.5, w: 149, d: 0.8, t: 0.5, col: 0xcbb888 });
  // 大幅 LED 屏
  ledWall(g, { x: -62, y: 10, z: 20.5, w: 28, h: 14, seed: 12 });
  ledWall(g, { x: -30, y: 10, z: 20.5, w: 22, h: 14, seed: 14, dim: 0.15 });
  ledWall(g, { x: 18, y: 24, z: 20.5, w: 26, h: 8, seed: 16 });
  ledWall(g, { x: 30, y: 10, z: 20.5, w: 16, h: 12, seed: 18, dim: 0.2 });

  // 转角圆弧玻璃幕墙入口
  cylFacade(g, { x: 60, z: 6, r: 14, h: 36, floor: 6, glass: C.glassBlue, band: 0xcbb888 });
  entrance(g, { x: 60, z: 19.6, w: 18, h: 6.4, dc: 9, fascia: 0xb3261e, steps: 3, pillars: 4 });
  // 屋顶红字钢架
  signFrame(g, { x: -8, z: 17, y: 37, w: 44, h: 7 });
  g.add(sign('王府井百货', 44, 7, { bg: '#c8161d', fg: '#ffffff', border: '#ffe08a', emissive: true, x: -8, y: 41, z: 17.2 }));

  // 步行广场：树阵、灯、座椅、停车位
  for (let r = 0; r < 2; r++) treeRow(g, { x0: -80, x1: 70, z: 36 + r * 14, n: 12, kind: 'plane', th: 7 });
  lampRow(g, { x0: -80, x1: 80, z: 30, n: 7, h: 8 });
  for (let i = 0; i < 4; i++) bench(g, -45 + i * 22, 56, 0, 0.15, 3);
  planter(g, { x: -80, z: 62, w: 8, d: 5, kind: 'peonyBush', th: 3.5, grass: true }); planter(g, { x: 80, z: 62, w: 8, d: 5, kind: 'peonyBush', th: 3.5, grass: true });
  carpark(g, { x: 66, z: 64, w: 36, d: 14, y: 0.2, seed: 4, fill: 0.8, rows: 1, base: false });
  return finalize(g);
}
