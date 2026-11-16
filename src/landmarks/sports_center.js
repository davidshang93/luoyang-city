// 洛阳体育中心体育场：椭圆看台碗 + 东西两片月牙罩棚。bearing 180
import { THREE, C, mat, box, cyl, plaza, disc, sign, tree, lamp, patternTex, finalize } from './_kit.js';

const AO = 124, BO = 114;           // 外墙半轴
const AI = 78, BI = 58;             // 看台内缘
const WALL = 26;                    // 外墙高

export const meta = { colliders: (() => {
  const out = [];
  for (let k = 0; k < 14; k++) {
    const t = k / 14 * Math.PI * 2, t2 = (k + 1) / 14 * Math.PI * 2, f = 0.9;
    const p1 = [AO * f * Math.cos(t), BO * f * Math.sin(t)], p2 = [AO * f * Math.cos(t2), BO * f * Math.sin(t2)];
    const dx = p2[0] - p1[0], dz = p2[1] - p1[1];
    out.push({ x: (p1[0] + p2[0]) / 2, z: (p1[1] + p2[1]) / 2, w: Math.hypot(dx, dz) + 4, d: 24, rot: Math.atan2(-dz, dx) });
  }
  out.push({ x: 0, z: 0, w: 120, d: 100 });
  return out;
})() };

// 椭圆之间的带状面：(a0,b0,y0) → (a1,b1,y1)，可限定角度范围
function strip(a0, b0, y0, a1, b1, y1, material, seg = 64) {
  const pos = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    pos.push(a0 * c, y0, b0 * s, a1 * c, y1, b1 * s);
  }
  for (let i = 0; i < seg; i++) { const k = i * 2; idx.push(k, k + 1, k + 3, k, k + 3, k + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g, material);
}

// 月牙罩棚：side = +1 东 / -1 西
function canopy(side, matTop, matEdge) {
  const grp = new THREE.Group();
  const N = 28, ext = 1.05, pos = [], idx = [];
  const A = 127, B = 117;
  for (let i = 0; i <= N; i++) {
    const u = -1 + 2 * i / N, th = u * ext;
    const w = 0.42 * Math.cos(u * Math.PI / 2);
    const ox = side * A * Math.cos(th), oz = B * Math.sin(th);
    const ix = ox * (1 - w), iz = oz * (1 - w * 0.9);
    const hOut = 30 + 3 * (1 - Math.abs(u)), hIn = 42 - 6 * Math.abs(u);
    pos.push(ox, hOut, oz, ix, hIn, iz, ox, hOut - 1.2, oz, ix, hIn - 1.2, iz);
  }
  for (let i = 0; i < N; i++) {
    const k = i * 4, n = k + 4;
    idx.push(k, k + 1, n + 1, k, n + 1, n); // 上表面
    idx.push(k + 2, n + 3, k + 3, k + 2, n + 2, n + 3); // 下表面
    idx.push(k + 1, k + 3, n + 3, k + 1, n + 3, n + 1); // 内缘
    idx.push(k, n, n + 2, k, n + 2, k + 2); // 外缘
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  grp.add(new THREE.Mesh(geo, matTop));
  // 桅杆 + 拉索
  const mast = (a, b, r, m) => {
    const v = new THREE.Vector3().subVectors(b, a), len = v.length();
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.2, len, 6), m);
    c.position.copy(a).addScaledVector(v, 0.5); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
    return c;
  };
  for (const u of [-0.62, 0, 0.62]) {
    const th = u * ext, bx = side * (AO + 3) * Math.cos(th), bz = (BO + 3) * Math.sin(th);
    const top = new THREE.Vector3(side * 108 * Math.cos(th), 82, 100 * Math.sin(th));
    grp.add(mast(new THREE.Vector3(bx, 0, bz), top, 0.9, matEdge));
    for (let j = -3; j <= 3; j++) {
      const uu = u + j * 0.07, t2 = uu * ext, w = 0.42 * Math.cos(Math.max(-1, Math.min(1, uu)) * Math.PI / 2);
      const ox = side * 127 * Math.cos(t2), oz = 117 * Math.sin(t2);
      grp.add(mast(top, new THREE.Vector3(ox * (1 - w * 0.9), 40.5 - 6 * Math.abs(uu), oz * (1 - w * 0.9)), 0.12, matEdge));
    }
  }
  return grp;
}

export function build() {
  const g = new THREE.Group();
  const conc = mat(0xb4b4b0, { double: true, key: 'bowl' }), concD = mat(C.concreteDark, { double: true, key: 'bowlD' });
  const red = mat(0xc4352b, { double: true, key: 'seatR' }), blue = mat(0x2f5fa8, { double: true, key: 'seatB' }), white = mat(0xe8e8e4, { double: true, key: 'seatW' });
  const paveM = mat(C.paving, { map: patternTex('paving', C.paving) });

  // 外围平台与大台阶（椭圆环）
  g.add(strip(AO + 11, BO + 11, 0.15, AO + 11, BO + 11, 0.15, paveM));
  const rings = [[AO + 11, BO + 11, 0.5], [AO + 8, BO + 8, 1.0], [AO + 5, BO + 5, 1.5]];
  for (let i = 0; i < 3; i++) {
    const [a, b, h] = rings[i], [a2, b2] = i < 2 ? [rings[i + 1][0], rings[i + 1][1]] : [AO + 1, BO + 1];
    g.add(strip(a, b, h, a2, b2, h, mat(C.stone, { double: true, key: 'stepTop' })));
    g.add(strip(a, b, 0.15, a, b, h, mat(C.stoneDark, { double: true, key: 'stepRise' })));
  }
  // 地面铺装圈
  g.add(strip(AO + 11, BO + 11, 0.18, AO + 8, BO + 8, 0.18, paveM));
  // 外墙
  g.add(strip(AO, BO, 1.5, AO, BO, WALL, conc));
  g.add(strip(AO * 0.98, BO * 0.98, WALL - 4, AO, BO, WALL + 0.5, concD));
  // 看台：下层红蓝带，上层灰
  const bands = [[0.0, 0.18, red], [0.18, 0.36, blue], [0.36, 0.5, white], [0.5, 0.58, concD], [0.58, 0.78, red], [0.78, 0.97, blue], [0.97, 1.0, concD]];
  const lerp = (a, b, t) => a + (b - a) * t;
  const yAt = (t) => 2 + 21 * t + 3 * Math.pow(t, 3);
  for (const [t0, t1, m] of bands) {
    g.add(strip(lerp(AI, AO, t0), lerp(BI, BO, t0), yAt(t0), lerp(AI, AO, t1), lerp(BI, BO, t1), yAt(t1), m));
  }
  // 看台阶梯线（环向分隔带）
  for (let k = 1; k < 12; k++) { const t = k / 12; g.add(strip(lerp(AI, AO, t), lerp(BI, BO, t), yAt(t) + 0.12, lerp(AI, AO, t) + 0.35, lerp(BI, BO, t) + 0.35, yAt(t) + 0.12, mat(0x77777a, { double: true, key: 'ln' }), 64)); }
  g.add(strip(AI - 1, BI - 1, 0.15, AI, BI, 2, concD)); // 内圈矮墙
  g.add(strip(AI, BI, 2, AI, BI, 2.0, concD));

  // 场地：红色环形跑道 + 绿色草坪
  const trackM = mat(0xb9402e, { double: true, key: 'track' });
  g.add(strip(66, 47, 0.28, 76, 56, 0.28, trackM));
  const gm = new THREE.Mesh(new THREE.CircleGeometry(1, 48), mat(0x4d8f3a, { double: true, key: 'turf' }));
  gm.rotation.x = -Math.PI / 2; gm.scale.set(66, 47, 1); gm.position.y = 0.3; g.add(gm);
  for (let i = -4; i <= 3; i++) g.add(plaza(11, 70, mat(0x5a9c45, { key: 'stripe' }), i * 11 + 5.5, 0, 0.34));
  const lineM = mat(0xf2f2ee);
  g.add(plaza(0.4, 54, lineM, 0, 0, 0.38)); // 中线
  g.add(plaza(100, 0.4, lineM, 0, 27, 0.38)); g.add(plaza(100, 0.4, lineM, 0, -27, 0.38));
  g.add(plaza(0.4, 54, lineM, 50, 0, 0.38)); g.add(plaza(0.4, 54, lineM, -50, 0, 0.38));
  const cc = new THREE.Mesh(new THREE.RingGeometry(8, 8.4, 24), lineM); cc.rotation.x = -Math.PI / 2; cc.position.y = 0.39; g.add(cc);

  // 月牙罩棚
  const roofM = mat(0xf2f2f0, { double: true, key: 'roofW' }), steel = mat(0xcfd3d6);
  g.add(canopy(1, roofM, steel)); g.add(canopy(-1, roofM, steel));

  // 入口门洞（外墙深色块）+ 灯 + 树
  for (let k = 0; k < 12; k++) {
    const t = k / 12 * Math.PI * 2 + 0.26;
    g.add(box(8, 8, 3, mat(C.glassDark), (AO + 1) * Math.cos(t), 1.5, (BO + 1) * Math.sin(t), -Math.atan2(BO * Math.cos(t), -AO * Math.sin(t)) + Math.PI / 2 * 0));
  }
  g.add(sign('洛阳体育中心', 26, 3.4, { bg: '#16355f', fg: '#ffffff', x: 0, y: 12, z: BO + 3.5 }));
  for (let k = 0; k < 24; k++) { const t = k / 24 * Math.PI * 2 + 0.1; g.add(tree(Math.cos(t) * (AO + 9.5), Math.sin(t) * (BO + 9.5), 7, k % 3 ? 'round' : 'plane')); }
  return finalize(g);
}
