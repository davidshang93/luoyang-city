// Ground plane, water, green areas, airport pavement — all flat ground decals (v2: PBR ground and grass, reflective rippling water).
import * as THREE from 'three';
import { pbrTex, tintFor } from '../core/mats.js';
import { Grid, addRibbon, ribbonMesh, newOut, decalMat, pipFlat } from '../core/util.js';
import { canvasTex } from '../core/mats.js';

const GREEN_COL = [0xd9ffc8, 0xa8e0a0, 0xe6ffcc, 0xfff7c0, 0xb0f0c0];   // multipliers for the grass texture, by kind

/** tex (optional): name of the PBR texture the material uses — colours are then converted to tints of that texture */
function polyMesh(polys, colorOf, material, order, tex) {
  const pos = [], col = [], idx = [], uv = [], uv1 = []; const c = new THREE.Color(), cv = [0, 0, 0];
  polys.forEach((flat, pi) => {
    const contour = []; for (let i = 0; i < flat.length; i += 2) contour.push(new THREE.Vector2(flat[i], flat[i + 1]));
    let faces; try { faces = THREE.ShapeUtils.triangulateShape(contour, []); } catch { return; }
    const base = pos.length / 3, hex = colorOf(pi); if (tex) tintFor(tex, hex, cv); else { c.setHex(hex); cv[0] = c.r; cv[1] = c.g; cv[2] = c.b; }
    for (const p of contour) { pos.push(p.x, 0, p.y); col.push(cv[0], cv[1], cv[2]); uv.push(p.x / 14, p.y / 14); uv1.push(p.x / 4, p.y / 4); }
    for (const f of faces) { // make every triangle face up (+Y) so lighting is right
      const A = contour[f[0]], B = contour[f[1]], C = contour[f[2]];
      if ((B.y - A.y) * (C.x - A.x) - (B.x - A.x) * (C.y - A.y) >= 0) idx.push(base + f[0], base + f[1], base + f[2]); else idx.push(base + f[0], base + f[2], base + f[1]);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('uv1', new THREE.Float32BufferAttribute(uv1, 2));
  const nrm = new Float32Array(pos.length); for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setIndex(new THREE.Uint32BufferAttribute(idx, 1));
  const m = new THREE.Mesh(g, material); m.renderOrder = order; m.frustumCulled = false; m.receiveShadow = true; m.matrixAutoUpdate = false;
  return m;
}

export class Areas {
  constructor(scene, data) {
    const group = new THREE.Group(); group.name = 'areas'; scene.add(group);
    // ground
    // open ground between buildings: worn concrete / packed dirt, a little warm; one repeat = 6 m
    const gm = new THREE.MeshStandardMaterial({ color: new THREE.Color().fromArray(tintFor('concrete_floor_worn_001', 0x5e5a50)), roughness: 1 });
    { const l = new THREE.TextureLoader(), base = new URL('../../assets/textures/concrete_floor_worn_001/', import.meta.url).href, ld = (f, srgb) => { const t = l.load(base + f); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(12000, 12000); t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }; gm.map = ld('diff.jpg', true); gm.normalMap = ld('nor.jpg'); gm.roughnessMap = ld('arm.jpg'); }
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(72000, 72000), gm);
    ground.rotation.x = -Math.PI / 2; ground.position.set(2000, 0, 3000); ground.renderOrder = -30; ground.receiveShadow = true; scene.add(ground);
    this.decals = group;   // everything else here is a flat decal on that plane

    // green
    const side = THREE.DoubleSide;
    group.add(polyMesh(data.green.map(g => g[1]), i => GREEN_COL[data.green[i][0]] || GREEN_COL[0], decalMat({ vertexColors: true, side, map: pbrTex('aerial_grass_rock', 'diff'), normalMap: pbrTex('aerial_grass_rock', 'nor'), roughness: 1 }), -28));
    // water (polygons + river centre-lines as ribbons)
    // water: dark, glossy, reflects the sky; a tileable ripple normal map (16 m per repeat, on uv1) drifts slowly
    this.ripple = canvasTex(256, 256, (g, w, h) => {
      const img = g.createImageData(w, h), H = (x, y) => { let v = 0; for (const [fx, fy, a, ph] of [[1, 2, 1, 0], [3, 1, 0.6, 1.3], [2, 5, 0.45, 2.1], [6, 3, 0.3, 0.7], [5, 8, 0.22, 4.0], [11, 7, 0.14, 5.2], [9, 13, 0.1, 2.9]]) v += a * Math.sin((fx * x / w + fy * y / h) * 6.2832 + ph + 0.8 * Math.sin((fy * x / w - fx * y / h) * 6.2832)); return v; };
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dx = (H(x + 1, y) - H(x - 1, y)) * 0.9, dy = (H(x, y + 1) - H(x, y - 1)) * 0.9, l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4; img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255; }
      g.putImageData(img, 0, 0);
    }, { data: true });
    this.ripple.channel = 1; this.ripple.repeat.set(0.16, 0.16);
    this.waterMat = new THREE.MeshStandardMaterial({ color: 0x2f5266, roughness: 0.09, metalness: 0.82, normalMap: this.ripple, normalScale: new THREE.Vector2(0.3, 0.3), envMapIntensity: 1.1, side, depthTest: false, depthWrite: false });
    group.add(polyMesh(data.water, () => 0xffffff, this.waterMat, -27));
    const rv = newOut();
    for (const r of data.riverLines) addRibbon(rv, r.pts, r.w, 0, 40);
    if (rv.idx.length) { const m = ribbonMesh(rv, this.waterMat, -27); m.frustumCulled = false; group.add(m); }

    // airport pavement
    const aero = data.aero;
    group.add(polyMesh(aero.aprons, () => 0xb9b9b3, decalMat({ vertexColors: true, side }), -26));
    const tw = newOut(); for (const t of aero.taxiways) addRibbon(tw, t.pts, t.w, 0, 20);
    if (tw.idx.length) { const m = ribbonMesh(tw, decalMat({ map: canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#55585b'; g.fillRect(0, 0, w, h); g.fillStyle = '#d8b030'; g.fillRect(w / 2 - 2, 0, 4, h); }) }), -25.5); m.frustumCulled = false; group.add(m); }
    const rw = newOut(); for (const r of aero.runways) addRibbon(rw, r.pts, Math.max(45, r.w), 0, 60);
    if (rw.idx.length) { const m = ribbonMesh(rw, decalMat({ map: canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#35373a'; g.fillRect(0, 0, w, h); g.fillStyle = '#ecece6'; g.fillRect(w * 0.03, 0, 5, h); g.fillRect(w * 0.97 - 5, 0, 5, h); g.fillRect(w / 2 - 4, 0, 8, h * 0.5); }) }), -25); m.frustumCulled = false; group.add(m); }
    this.runways = aero.runways;

    // water lookup
    this.waterGrid = new Grid(250); this.water = data.water;
    data.water.forEach((p, i) => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let k = 0; k < p.length; k += 2) { x0 = Math.min(x0, p[k]); x1 = Math.max(x1, p[k]); z0 = Math.min(z0, p[k + 1]); z1 = Math.max(z1, p[k + 1]); } if ((x1 - x0) * (z1 - z0) > 400) this.waterGrid.addBox(x0, z0, x1, z1, i); });
    this.riverGrid = new Grid(250); this.rivers = data.riverLines;
    data.riverLines.forEach((r, ri) => { const p = r.pts; for (let i = 0; i + 3 < p.length; i += 2) this.riverGrid.addBox(Math.min(p[i], p[i + 2]) - r.w / 2, Math.min(p[i + 1], p[i + 3]) - r.w / 2, Math.max(p[i], p[i + 2]) + r.w / 2, Math.max(p[i + 1], p[i + 3]) + r.w / 2, ri * 4096 + i / 2); });
    this.green = data.green;
  }

  /** drift the water ripples */
  update(t) { this.ripple.offset.set(t * 0.012, t * 0.007); }

  inWater(x, z) {
    const a = this.waterGrid.at(x, z);
    if (a) for (const i of a) if (pipFlat(x, z, this.water[i])) return true;
    const b = this.riverGrid.at(x, z);
    if (b) for (const code of b) { const r = this.rivers[Math.floor(code / 4096)], i = (code % 4096) * 2, p = r.pts; const dx = p[i + 2] - p[i], dz = p[i + 3] - p[i + 1], L2 = dx * dx + dz * dz || 1e-9; let t = ((x - p[i]) * dx + (z - p[i + 1]) * dz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t; if (Math.hypot(x - p[i] - dx * t, z - p[i + 1] - dz * t) < r.w / 2) return true; }
    return false;
  }
}
