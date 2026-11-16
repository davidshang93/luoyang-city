// Tool page logic: decode a raw CARLA / Valdrada vehicle GLB (meshopt + KTX2), show it for inspection, and rebuild it as a
// plain GLB for the game (one LOD, wheels split off as wheel_fl/fr/rl/rr, brand marks removed, textures edited + resized).
// Driven from Node by tools/models/build-cars.mjs through window.api.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x9aa4ad);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(4, 8, 6); scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x6f7377, roughness: 0.95 })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
const camera = new THREE.PerspectiveCamera(35, canvas.width / canvas.height, 0.05, 200);
const holder = new THREE.Group(); scene.add(holder);

const ktx2 = new KTX2Loader().setTranscoderPath('/node_modules/three/examples/jsm/libs/basis/').detectSupport(renderer);
// force plain RGBA output so the pixels can be read back, edited and re-encoded
ktx2.workerConfig = { astcSupported: false, astcHDRSupported: false, etc1Supported: false, etc2Supported: false, dxtSupported: false, bptcSupported: false, pvrtcSupported: false };
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(ktx2);

let cur = null;   // { name, gltf, lods: Map(name -> Object3D), extras, tex: Map(name -> {canvas, tex}) }

function texCanvas(t) {
  const m = t.mipmaps && t.mipmaps[0] ? t.mipmaps[0] : t.image, w = m.width, h = m.height, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (m.data) g.putImageData(new ImageData(new Uint8ClampedArray(m.data.buffer, m.data.byteOffset, w * h * 4), w, h), 0, 0); else g.drawImage(m, 0, 0);
  return c;
}

const api = window.api = {
  async load(name, dir = '/assets/third_party_raw/carla_fleet24/') {
    const gltf = await loader.loadAsync(dir + name + '.glb');
    holder.clear(); holder.add(gltf.scene);
    const root = gltf.scene.children[0], lods = new Map(); let extras = null;
    gltf.scene.traverse(o => { if (/^LOD\d$/.test(o.name)) lods.set(o.name, o); if (o.userData && o.userData.hubs) extras = o.userData; });
    const tex = new Map();
    gltf.scene.traverse(o => { if (!o.isMesh) return; for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) { const t = o.material[k]; if (!t) continue; if (!t.name) t.name = t.uuid; let e = tex.get(t.name); while (e && e.tex !== t) { t.name += '_b'; e = tex.get(t.name); } if (!e) tex.set(t.name, { tex: t, slot: k }); } });
    cur = { name, gltf, lods, extras, tex, root };
    const info = { extras, lods: {}, textures: [...tex].map(([n, v]) => ({ name: n, slot: v.slot, w: (v.tex.mipmaps?.[0] || v.tex.image).width, h: (v.tex.mipmaps?.[0] || v.tex.image).height, cs: v.tex.colorSpace })) };
    for (const [n, o] of lods) { info.lods[n] = []; o.traverse(m => { if (m.isMesh) info.lods[n].push({ mat: m.material.name, tris: m.geometry.index.count / 3, maps: ['map', 'normalMap', 'roughnessMap', 'emissiveMap'].filter(k => m.material[k]).map(k => k + '=' + m.material[k].name) }); }); }
    return info;
  },
  /** show one LOD; view = [camx,camy,camz, tx,ty,tz]; hide/only = material-name regex source */
  show({ lod = 'LOD0', view = [5, 2.2, 6, 0, 0.7, 0], hide = null, only = null, fov = 35, bg = null } = {}) {
    for (const [n, o] of cur.lods) o.visible = n === lod;
    cur.lods.get(lod).traverse(m => { if (m.isMesh) m.visible = (!hide || !new RegExp(hide).test(m.material.name)) && (!only || new RegExp(only).test(m.material.name)); });
    camera.fov = fov; camera.updateProjectionMatrix();
    camera.position.set(view[0], view[1], view[2]); camera.lookAt(view[3], view[4], view[5]);
    if (bg) scene.background = new THREE.Color(bg);
    renderer.render(scene, camera);
    return true;
  },
  texture(name, max = 1024) {
    const c = texCanvas(cur.tex.get(name).tex); let o = c;
    if (Math.max(c.width, c.height) > max) { o = document.createElement('canvas'); const k = max / Math.max(c.width, c.height); o.width = c.width * k; o.height = c.height * k; o.getContext('2d').drawImage(c, 0, 0, o.width, o.height); }
    return o.toDataURL('image/png');
  },
};

// ───────────────────────── inspection helpers ─────────────────────────
/** orthographic view with a metric grid; dir = front|rear|left|right|top; returns a JPEG data URL. c = centre [h, v] in metres, span = width in metres */
api.ortho = function ({ lod = 'LOD0', dir = 'front', c = [0, 0.8], span = 2.6, hide = null, only = null, grid = 0.1 } = {}) {
  for (const [n, o] of cur.lods) o.visible = n === lod;
  cur.lods.get(lod).traverse(m => { if (m.isMesh) m.visible = (!hide || !new RegExp(hide).test(m.material.name)) && (!only || new RegExp(only).test(m.material.name)); });
  const W = canvas.width, H = canvas.height, hs = span / 2, vs = hs * H / W;
  const cam = new THREE.OrthographicCamera(-hs, hs, vs, -vs, 0.01, 60);
  // horizontal axis h and its sign on screen, per direction
  const D = { front: { pos: [c[0], c[1], 20], up: [0, 1, 0], look: [c[0], c[1], 0], hAxis: 'x', hSign: 1, vAxis: 'y' }, rear: { pos: [c[0], c[1], -20], up: [0, 1, 0], look: [c[0], c[1], 0], hAxis: 'x', hSign: -1, vAxis: 'y' },
    left: { pos: [20, c[1], c[0]], up: [0, 1, 0], look: [0, c[1], c[0]], hAxis: 'z', hSign: -1, vAxis: 'y' }, right: { pos: [-20, c[1], c[0]], up: [0, 1, 0], look: [0, c[1], c[0]], hAxis: 'z', hSign: 1, vAxis: 'y' },
    top: { pos: [c[0], 20, c[1]], up: [0, 0, -1], look: [c[0], 0, c[1]], hAxis: 'x', hSign: 1, vAxis: 'z' } }[dir];
  cam.position.set(...D.pos); cam.up.set(...D.up); cam.lookAt(...D.look);
  ground.visible = false; renderer.render(scene, cam); ground.visible = true;
  const o = document.createElement('canvas'); o.width = W; o.height = H; const g = o.getContext('2d'); g.drawImage(canvas, 0, 0);
  g.font = '11px monospace'; g.lineWidth = 1;
  const vSign = D.vAxis === 'z' ? 1 : -1;   // screen y grows down; world y grows up, world z (top view, up = -z) grows down
  for (let k = Math.ceil((c[0] - hs) / grid); k * grid <= c[0] + hs; k++) { const hv = k * grid, sx = W / 2 + (hv - c[0]) * D.hSign * W / span; const major = k % 5 === 0; g.strokeStyle = major ? 'rgba(255,255,0,0.55)' : 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(sx, 0); g.lineTo(sx, H); g.stroke(); if (major || span < 1.2) { g.fillStyle = '#ff0'; g.fillText(D.hAxis + '=' + hv.toFixed(2), sx + 2, 12); } }
  for (let k = Math.ceil((c[1] - vs) / grid); k * grid <= c[1] + vs; k++) { const vv = k * grid, sy = H / 2 + (vv - c[1]) * vSign * W / span; const major = k % 5 === 0; g.strokeStyle = major ? 'rgba(0,255,255,0.55)' : 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(0, sy); g.lineTo(W, sy); g.stroke(); if (major || span < 1.2) { g.fillStyle = '#0ff'; g.fillText(D.vAxis + '=' + vv.toFixed(2), 2, sy - 2); } }
  return o.toDataURL('image/jpeg', 0.9);
};

// ───────────────────────── rebuild ─────────────────────────
const inBox = (b, x, y, z, g = 0) => x >= b[0] - g && x <= b[3] + g && y >= b[1] - g && y <= b[4] + g && z >= b[2] - g && z <= b[5] + g;

/** flatten one LOD into world-space primitives: { name, mat, pos, nrm, uv, idx } */
function collect(lod) {
  const out = [], root = cur.lods.get(lod); root.updateWorldMatrix(true, true);
  root.traverse(m => {
    if (!m.isMesh) return;
    const g = m.geometry, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, n = P.count, v = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
    const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld); pos.set([v.x, v.y, v.z], i * 3);
      if (N) { v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nrm.set([v.x, v.y, v.z], i * 3); }
      if (U) { uv[i * 2] = U.getX(i); uv[i * 2 + 1] = U.getY(i); }
    }
    out.push({ name: m.material.name, mat: m.material, pos, nrm, uv, idx: Uint32Array.from(g.index.array), hasN: !!N });
  });
  return out;
}

/** erase every texel whose surface point lies inside box (metres, model space) from the textures of matching prims */
function eraseTexels(prims, canv, op) {
  const re = new RegExp(op.mat || '.'), grow = op.grow ?? 0.025; let hits = 0;
  const cy = op.cyl, b = op.box || [cy.c[0] - cy.hw, cy.c[1] - cy.r1, cy.c[2] - cy.r1, cy.c[0] + cy.hw, cy.c[1] + cy.r1, cy.c[2] + cy.r1];
  const inside = cy ? (X, Y, Z) => { if (Math.abs(X - cy.c[0]) > cy.hw) return false; const r = Math.hypot(Y - cy.c[1], Z - cy.c[2]); return r >= cy.r0 && r <= cy.r1; } : (X, Y, Z) => inBox(b, X, Y, Z, 0.004);
  const slots = [['map', 'color'], ['normalMap', 'normal'], ['roughnessMap', 'orm']];
  for (const [slot, kind] of slots) {
    const done = new Set();
    for (const p of prims) {
      if (!re.test(p.name) || !p.mat[slot]) continue;
      const tname = p.mat[slot].name, c = canv.get(tname); if (!c || done.has(tname + p.name)) continue; done.add(tname + p.name);
      const W = c.width, H = c.height, mask = new Uint8Array(W * H); let x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (let t = 0; t < p.idx.length; t += 3) {
        const a = p.idx[t], bb = p.idx[t + 1], cc = p.idx[t + 2], P = p.pos, U = p.uv;
        const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2], bx = P[bb * 3], by = P[bb * 3 + 1], bz = P[bb * 3 + 2], cx = P[cc * 3], cy = P[cc * 3 + 1], cz = P[cc * 3 + 2];
        if (Math.max(ax, bx, cx) < b[0] - grow || Math.min(ax, bx, cx) > b[3] + grow || Math.max(ay, by, cy) < b[1] - grow || Math.min(ay, by, cy) > b[4] + grow || Math.max(az, bz, cz) < b[2] - grow || Math.min(az, bz, cz) > b[5] + grow) continue;
        // triangle in texel space (wrap by the first vertex)
        const ou = Math.floor(Math.min(U[a * 2], U[bb * 2], U[cc * 2])), ov = Math.floor(Math.min(U[a * 2 + 1], U[bb * 2 + 1], U[cc * 2 + 1]));
        const u0 = (U[a * 2] - ou) * W, v0 = (U[a * 2 + 1] - ov) * H, u1 = (U[bb * 2] - ou) * W, v1 = (U[bb * 2 + 1] - ov) * H, u2 = (U[cc * 2] - ou) * W, v2 = (U[cc * 2 + 1] - ov) * H;
        const den = (v1 - v2) * (u0 - u2) + (u2 - u1) * (v0 - v2); if (Math.abs(den) < 1e-9) continue;
        const mx0 = Math.floor(Math.min(u0, u1, u2)) - 1, mx1 = Math.ceil(Math.max(u0, u1, u2)) + 1, my0 = Math.floor(Math.min(v0, v1, v2)) - 1, my1 = Math.ceil(Math.max(v0, v1, v2)) + 1;
        if ((mx1 - mx0) * (my1 - my0) > 4e6) continue;
        for (let y = my0; y <= my1; y++) for (let x = mx0; x <= mx1; x++) {
          const px = x + 0.5, py = y + 0.5; let l0 = ((v1 - v2) * (px - u2) + (u2 - u1) * (py - v2)) / den, l1 = ((v2 - v0) * (px - u2) + (u0 - u2) * (py - v2)) / den, l2 = 1 - l0 - l1;
          const e = 1.2 / Math.sqrt(Math.abs(den)) + 0.02; if (l0 < -e || l1 < -e || l2 < -e) continue;
          const X = ax * l0 + bx * l1 + cx * l2, Y = ay * l0 + by * l1 + cy * l2, Z = az * l0 + bz * l1 + cz * l2;
          if (!inside(X, Y, Z)) continue;
          const tx = ((x % W) + W) % W, ty = ((y % H) + H) % H; mask[ty * W + tx] = 1; hits++;
          if (tx < x0) x0 = tx; if (tx > x1) x1 = tx; if (ty < y0) y0 = ty; if (ty > y1) y1 = ty;
        }
      }
      if (x1 < 0) continue;
      fillMask(c, mask, x0, y0, x1, y1, kind, op);
    }
  }
  return hits;
}


/** fill the masked texels of canvas c (mask = Uint8Array W*H, bounds x0..x1 / y0..y1): flat normal, given colour, or diffusion in-fill */
function fillMask(c, mask, x0, y0, x1, y1, kind, op = {}) {
  const W = c.width, H = c.height, pad = op.pad ?? 3; x0 = Math.max(0, x0 - pad - 1); y0 = Math.max(0, y0 - pad - 1); x1 = Math.min(W - 1, x1 + pad + 1); y1 = Math.min(H - 1, y1 + pad + 1);
  const w = x1 - x0 + 1, h = y1 - y0 + 1, g = c.getContext('2d'), im = g.getImageData(x0, y0, w, h), d = im.data; let m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[y * w + x] = mask ? mask[(y + y0) * W + x + x0] : (x > pad && y > pad && x < w - 1 - pad && y < h - 1 - pad ? 1 : 0);
  if (mask) for (let k = 0; k < pad; k++) { const n = m.slice(); for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (!m[y * w + x] && (m[y * w + x - 1] || m[y * w + x + 1] || m[(y - 1) * w + x] || m[(y + 1) * w + x])) n[y * w + x] = 1; m = n; }
  const flat = kind === 'normal' ? [128, 128, 255] : kind === 'color' ? op.fill : kind === 'orm' ? op.orm : null;
  if (flat) { for (let i = 0; i < w * h; i++) if (m[i]) { d[i * 4] = flat[0]; d[i * 4 + 1] = flat[1]; d[i * 4 + 2] = flat[2]; } }
  else {
    const f = new Float32Array(w * h * 3); let sr = 0, sg = 0, sb = 0, sn = 0;
    for (let i = 0; i < w * h; i++) { f[i * 3] = d[i * 4]; f[i * 3 + 1] = d[i * 4 + 1]; f[i * 3 + 2] = d[i * 4 + 2]; if (!m[i]) { sr += d[i * 4]; sg += d[i * 4 + 1]; sb += d[i * 4 + 2]; sn++; } }
    if (sn) for (let i = 0; i < w * h; i++) if (m[i]) { f[i * 3] = sr / sn; f[i * 3 + 1] = sg / sn; f[i * 3 + 2] = sb / sn; }
    const its = Math.min(400, Math.max(60, Math.max(w, h))) ;
    for (let it = 0; it < its; it++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!m[i]) continue; const l = x > 0 ? i - 1 : i, r = x < w - 1 ? i + 1 : i, u = y > 0 ? i - w : i, dn = y < h - 1 ? i + w : i; for (let k = 0; k < 3; k++) f[i * 3 + k] = (f[l * 3 + k] + f[r * 3 + k] + f[u * 3 + k] + f[dn * 3 + k]) / 4; }
    for (let i = 0; i < w * h; i++) if (m[i]) { d[i * 4] = f[i * 3]; d[i * 4 + 1] = f[i * 3 + 1]; d[i * 4 + 2] = f[i * 3 + 2]; }
  }
  g.putImageData(im, x0, y0);
}
/** paint out a rectangle given in 0..1 texture coordinates */
function fillRect2d(c, r, kind, op = {}) { const W = c.width, H = c.height, g = 0.004; fillMask(c, null, Math.floor((r[0] - g) * W), Math.floor((r[1] - g) * H), Math.ceil((r[2] + g) * W), Math.ceil((r[3] + g) * H), kind, Object.assign({ pad: 2 }, op)); }

/** remove triangles (centroid in box, material matches); returns removed count */
function dropTris(prims, op) {
  const re = new RegExp(op.mat || '.'), b = op.box; let n = 0;
  for (const p of prims) {
    if (!re.test(p.name)) continue; const keep = [];
    for (let t = 0; t < p.idx.length; t += 3) {
      const a = p.idx[t] * 3, bb = p.idx[t + 1] * 3, c = p.idx[t + 2] * 3, P = p.pos;
      if (b && !inBox(b, (P[a] + P[bb] + P[c]) / 3, (P[a + 1] + P[bb + 1] + P[c + 1]) / 3, (P[a + 2] + P[bb + 2] + P[c + 2]) / 3)) keep.push(p.idx[t], p.idx[t + 1], p.idx[t + 2]); else n++;
    }
    p.idx = Uint32Array.from(keep);
  }
  return n;
}

function raycaster(prims) {
  const meshes = prims.filter(p => p.idx.length).map(p => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p.pos, 3)); g.setIndex(new THREE.BufferAttribute(p.idx, 1)); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); m.updateMatrixWorld(); return m; });
  const rc = new THREE.Raycaster();
  return (o, d) => { rc.set(new THREE.Vector3(...o), new THREE.Vector3(...d).normalize()); const h = rc.intersectObjects(meshes, false); return h.length ? h[0].point : null; };
}

function compact(pos, nrm, uv, idx, col, shift) {
  const map = new Map(), P = [], N = [], U = [], C = [], I = [];
  for (const i of idx) { let j = map.get(i); if (j === undefined) { j = P.length / 3; map.set(i, j); P.push(pos[i * 3] - shift[0], pos[i * 3 + 1] - shift[1], pos[i * 3 + 2] - shift[2]); N.push(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]); if (uv) U.push(uv[i * 2], uv[i * 2 + 1]); if (col) C.push(col[i * 3], col[i * 3 + 1], col[i * 3 + 2]); } I.push(j); }
  return { pos: new Float32Array(P), nrm: new Float32Array(N), uv: uv ? new Float32Array(U) : null, col: col ? new Float32Array(C) : null, idx: new Uint32Array(I) };
}

async function encodeImage(c, size, q, mime = 'image/jpeg') {
  const k = Math.min(1, size / Math.max(c.width, c.height)), o = document.createElement('canvas'); o.width = Math.max(4, Math.round(c.width * k)); o.height = Math.max(4, Math.round(c.height * k));
  const g = o.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, o.width, o.height);
  const blob = await new Promise(r => o.toBlob(r, mime, q)); return new Uint8Array(await blob.arrayBuffer());
}

function writeGLB(json, chunks) {
  let off = 0; json.bufferViews = [];
  for (const c of chunks) { c.view = json.bufferViews.length; const v = { buffer: 0, byteOffset: off, byteLength: c.data.byteLength }; if (c.target) v.target = c.target; json.bufferViews.push(v); off += (c.data.byteLength + 3) & ~3; }
  json.buffers = [{ byteLength: off }];
  for (const a of json.accessors) { a.bufferView = chunks[a.bufferView].view; }
  for (const im of json.images || []) im.bufferView = chunks[im.bufferView].view;
  const bin = new Uint8Array(off); let o = 0; for (const c of chunks) { bin.set(new Uint8Array(c.data.buffer, c.data.byteOffset, c.data.byteLength), o); o += (c.data.byteLength + 3) & ~3; }
  let js = new TextEncoder().encode(JSON.stringify(json)); const pad = (4 - js.length % 4) % 4; if (pad) { const t = new Uint8Array(js.length + pad).fill(32); t.set(js); js = t; }
  const out = new Uint8Array(12 + 8 + js.length + 8 + bin.length), dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, out.length, true);
  dv.setUint32(12, js.length, true); dv.setUint32(16, 0x4e4f534a, true); out.set(js, 20);
  dv.setUint32(20 + js.length, bin.length, true); dv.setUint32(24 + js.length, 0x004e4942, true); out.set(bin, 28 + js.length);
  return out;
}

/** cfg: see tools/models/cars.config.mjs */
api.build = async function (cfg) {
  const ex = Object.assign({}, cur.extras, cfg.extras || {}), log = [];
  let prims = collect(cfg.lod || 'LOD1');
  for (const add of cfg.also || []) prims.push(...collect(add.lod).filter(p => new RegExp(add.mat).test(p.name)));
  // editable copies of every texture
  const canv = new Map(); for (const [n, v] of cur.tex) canv.set(n, texCanvas(v.tex));
  // material rules
  const rule = name => { for (const [re, r] of Object.entries(cfg.mats || {})) if (new RegExp(re).test(name)) return r; return {}; };
  const kindOf = p => { const r = rule(p.name); if (r.as) return r.as; if (/^paint:/.test(p.name)) return 'paint'; if (/^glass/.test(p.name)) return 'glass'; if (/^lens/.test(p.name)) return 'lens'; if (/LicensePlate/.test(p.name)) return 'plate'; if (/^lamp(:lamp)?$/.test(p.name)) return cfg.keepLamp ? 'solid' : 'drop'; const im = p.mat.map && (p.mat.map.mipmaps?.[0] || p.mat.map.image); return im && im.width > 8 ? 'tex' : 'solid'; };
  for (const p of prims) p.kind = kindOf(p);
  // plates: remember where they were, then remove them
  const plate = { F: cfg.plateF || null, R: cfg.plateR || null };
  for (const p of prims) if (p.kind === 'plate') { for (const s of ['F', 'R']) { let y0 = 1e9, y1 = -1e9, n = 0; for (let i = 0; i < p.pos.length; i += 3) if ((p.pos[i + 2] > 0) === (s === 'F')) { y0 = Math.min(y0, p.pos[i + 1]); y1 = Math.max(y1, p.pos[i + 1]); n++; } if (n && !plate[s]) plate[s] = [0, +((y0 + y1) / 2).toFixed(3)]; } p.idx = new Uint32Array(0); }
  for (const p of prims) if (p.kind === 'drop') p.idx = new Uint32Array(0);
  for (const op of cfg.drop || []) log.push(`drop ${op.mat || ''} ${op.note || ''}: ${dropTris(prims, op)} tris`);
  // triangles turned into a flat-coloured part (for pieces whose texture mapping is beyond repair)
  for (const [i, op] of (cfg.recolor || []).entries()) {
    const re = new RegExp(op.mat || '.'), b = op.box; let n = 0;
    for (const p of [...prims]) {
      if (!re.test(p.name) || p.kind === 'paint' || p.kind === 'glass' || !p.idx.length) continue; const keep = [], take = [];
      for (let t = 0; t < p.idx.length; t += 3) { const a = p.idx[t] * 3, bb = p.idx[t + 1] * 3, c = p.idx[t + 2] * 3, P = p.pos; (inBox(b, (P[a] + P[bb] + P[c]) / 3, (P[a + 1] + P[bb + 1] + P[c + 1]) / 3, (P[a + 2] + P[bb + 2] + P[c + 2]) / 3) ? take : keep).push(p.idx[t], p.idx[t + 1], p.idx[t + 2]); }
      if (!take.length) continue; p.idx = Uint32Array.from(keep); n += take.length / 3;
      prims.push({ name: 'detail:recolor' + i, kind: 'solid', mat: { color: { r: op.color[0], g: op.color[1], b: op.color[2] }, metalness: op.metal ?? 0, roughness: op.rough ?? 0.6, map: null }, pos: p.pos, nrm: p.nrm, uv: p.uv, idx: Uint32Array.from(take), hasN: p.hasN });
    }
    log.push(`recolor ${op.note || ''}: ${n} tris`);
  }
  for (const op of cfg.erase || []) log.push(`erase ${op.mat || ''} ${op.note || ''}: ${eraseTexels(prims, canv, op)} texels`);
  for (const h of ex.hubs) {
    if (cfg.hubCap) log.push(`hub cap ${h.id}: ${eraseTexels(prims, canv, { cyl: { c: h.p, hw: 0.32, r0: 0, r1: cfg.hubCap }, mat: '^(?!paint|glass|lens)', pad: 2 })} texels`);
    if (cfg.tyreText) log.push(`tyre wall ${h.id}: ${eraseTexels(prims, canv, { cyl: { c: h.p, hw: 0.32, r0: h.r * (cfg.tyre0 ?? 0.68), r1: h.r * 0.955 }, mat: '^(?!paint|glass|lens)', fill: [14, 14, 15], orm: [255, 225, 0], pad: 1 })} texels`);
  }
  // every piece of text the OCR pass found on a colour texture (and the same spot of the matching normal map)
  for (const [tname, boxes] of Object.entries(cfg.ocr || {})) {
    const c = canv.get(tname); if (!c) continue; const nm = new Set();
    for (const p of prims) if (p.mat.map && p.mat.map.name === tname && p.mat.normalMap) nm.add(p.mat.normalMap.name);
    for (const b of boxes) { fillRect2d(c, b, 'color'); for (const n of nm) fillRect2d(canv.get(n), b, 'normal'); }
    log.push(`ocr ${tname}: ${boxes.length} text boxes painted out`);
  }
  for (const op of cfg.rect2d || []) { const c = canv.get(op.tex); if (!c) { log.push('rect2d: no texture ' + op.tex); continue; } for (const r of op.rects) fillRect2d(c, r, op.kind || 'color', op); }
  for (const op of cfg.paint2d || []) { const c = canv.get(op.tex); if (!c) { log.push('paint2d: no texture ' + op.tex); continue; } const g = c.getContext('2d'); g.fillStyle = op.fill; for (const r of op.rects) g.fillRect(r[0] * c.width, r[1] * c.height, r[2] * c.width, r[3] * c.height); }
  prims = prims.filter(p => p.idx.length);

  // wheels: triangles entirely inside a hub cylinder
  const hubs = ex.hubs.map(h => ({ ...h })), wr = cfg.wheelHalf ?? 0.2;
  const names = hubs.map(h => 'wheel_' + (h.p[2] > 0 ? 'f' : 'r') + (h.p[0] > 0 ? 'l' : 'r'));
  const wheelOf = (P, i) => { for (let k = 0; k < hubs.length; k++) { const h = hubs[k], dx = P[i * 3] - h.p[0]; if (Math.abs(dx) > Math.max(wr, (cfg.wheelW || 0))) continue; if (Math.hypot(P[i * 3 + 1] - h.p[1], P[i * 3 + 2] - h.p[2]) <= h.r * (cfg.wheelR || 1.035)) return k; } return -1; };
  const parts = [];   // { node, kind, name, mat, pos, nrm, uv, idx, col }
  for (const p of prims) {
    const body = [], wh = hubs.map(() => []);
    for (let t = 0; t < p.idx.length; t += 3) {
      const a = p.idx[t], b = p.idx[t + 1], c = p.idx[t + 2]; let k = -1;
      if (p.kind !== 'glass' && p.kind !== 'paint' && p.kind !== 'lens' && !rule(p.name).noWheel) { k = wheelOf(p.pos, a); if (k >= 0 && (wheelOf(p.pos, b) !== k || wheelOf(p.pos, c) !== k)) k = -1; }
      (k < 0 ? body : wh[k]).push(a, b, c);
    }
    if (body.length) parts.push({ node: 'body', src: p, idx: body });
    wh.forEach((w, k) => { if (w.length) parts.push({ node: names[k], src: p, idx: w, shift: hubs[k].p }); });
  }
  // body surface ray tests (decal projection, lamp positions)
  const hit = raycaster(prims.filter(p => p.kind !== 'glass' || true));

  // glTF assembly
  const json = { asset: { version: '2.0', generator: 'luoyang-city tools/models/build-cars.mjs' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: cfg.type, children: [] }], meshes: [], materials: [], accessors: [], textures: [], images: [], samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }] };
  const chunks = [], matIx = new Map(), texIx = new Map();
  const acc = (arr, type, comp, target, minmax) => { chunks.push({ data: arr, target }); const a = { bufferView: chunks.length - 1, componentType: comp, count: arr.length / { SCALAR: 1, VEC2: 2, VEC3: 3 }[type], type }; if (minmax) { const n = { VEC3: 3 }[type], mn = Array(n).fill(1e9), mx = Array(n).fill(-1e9); for (let i = 0; i < arr.length; i++) { mn[i % n] = Math.min(mn[i % n], arr[i]); mx[i % n] = Math.max(mx[i % n], arr[i]); } a.min = mn; a.max = mx; } json.accessors.push(a); return json.accessors.length - 1; };
  const texture = async (t, kind, size) => {
    const key = t.name + ':' + size; if (texIx.has(key)) return texIx.get(key);
    const data = await encodeImage(canv.get(t.name), size, kind === 'normal' ? 0.9 : 0.86); chunks.push({ data });
    json.images.push({ name: t.name, mimeType: 'image/jpeg', bufferView: chunks.length - 1 }); json.textures.push({ sampler: 0, source: json.images.length - 1 });
    texIx.set(key, json.textures.length - 1); return json.textures.length - 1;
  };
  const sz = Object.assign({ color: 1024, normal: 512, orm: 512 }, cfg.texSize || {});
  const lin = v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  /** untextured parts (and parts whose "texture" is a flat swatch) become vertex colours in one of three shared materials */
  const solidColor = p => {
    if (p._sc) return p._sc; const r = rule(p.name), m = p.mat; let c = r.color || [m.color.r, m.color.g, m.color.b];
    if (!r.color && m.map) { const cv = canv.get(m.map.name), px = cv.getContext('2d').getImageData(0, 0, 1, 1).data; c = [c[0] * lin(px[0] / 255), c[1] * lin(px[1] / 255), c[2] * lin(px[2] / 255)]; }
    const metal = r.metal ?? (m.metalnessMap ? 0 : m.metalness), rough = r.rough ?? m.roughness;
    return (p._sc = { c, cls: metal >= 0.5 ? 'metal' : rough < 0.45 ? 'gloss' : 'matte' });
  };
  const material = async (p) => {
    const r = rule(p.name), kind = p.kind; let key = kind === 'tex' ? kind + ':' + (r.name || p.name.replace(/^detail:/, '')) : kind;
    if (kind === 'solid') { const sc = solidColor(p); key = 'solid:' + sc.cls; }
    if (matIx.has(key)) return matIx.get(key);
    const m = p.mat, d = { name: key, pbrMetallicRoughness: {} }, pb = d.pbrMetallicRoughness;
    if (kind === 'paint') { pb.baseColorFactor = [1, 1, 1, 1]; pb.metallicFactor = 0.5; pb.roughnessFactor = 0.4; }
    else if (kind === 'glass' || kind === 'lens') { pb.baseColorFactor = [m.color.r, m.color.g, m.color.b, m.opacity]; pb.metallicFactor = 0; pb.roughnessFactor = 0.05; d.alphaMode = 'BLEND'; }
    else if (kind === 'tex') {
      const s = Object.assign({}, sz, r.size || {});
      pb.baseColorFactor = r.color ? [...r.color, 1] : [m.color.r, m.color.g, m.color.b, 1];
      pb.baseColorTexture = { index: await texture(m.map, 'color', s.color) };
      pb.metallicFactor = r.metal ?? Math.min(1, m.metalness); pb.roughnessFactor = r.rough ?? Math.min(1, m.roughness);
      if (m.roughnessMap && !r.noOrm) pb.metallicRoughnessTexture = { index: await texture(m.roughnessMap, 'orm', s.orm) }; else if (r.noOrm) { pb.metallicFactor = r.metal ?? 0; pb.roughnessFactor = r.rough ?? 0.5; }
      if (m.normalMap && !r.noNormal) d.normalTexture = { index: await texture(m.normalMap, 'normal', s.normal) };
    } else { const sc = solidColor(p); pb.baseColorFactor = [1, 1, 1, 1]; pb.metallicFactor = sc.cls === 'metal' ? 1 : 0; pb.roughnessFactor = sc.cls === 'metal' ? 0.22 : sc.cls === 'gloss' ? 0.28 : 0.8; }
    if (m.side === THREE.DoubleSide || r.doubleSided) d.doubleSided = true;
    json.materials.push(d); matIx.set(key, json.materials.length - 1); return json.materials.length - 1;
  };
  const nodeMesh = new Map();
  const addPrim = async (node, g, matIndex, shift, flatCol) => {
    if (flatCol) { const n = g.pos.length / 3; g.col = new Float32Array(n * 3); for (let i = 0; i < n; i++) g.col.set(flatCol, i * 3); }
    let mi = nodeMesh.get(node);
    if (mi === undefined) { json.meshes.push({ name: node, primitives: [] }); mi = json.meshes.length - 1; nodeMesh.set(node, mi); const n = { name: node, mesh: mi }; if (shift) n.translation = shift; json.nodes.push(n); json.nodes[0].children.push(json.nodes.length - 1); }
    const at = { POSITION: acc(g.pos, 'VEC3', 5126, 34962, true), NORMAL: acc(g.nrm, 'VEC3', 5126, 34962) };
    if (g.uv) at.TEXCOORD_0 = acc(g.uv, 'VEC2', 5126, 34962); if (g.col) at.COLOR_0 = acc(g.col, 'VEC3', 5126, 34962);
    const big = g.pos.length / 3 > 65535, ix = big ? g.idx : Uint16Array.from(g.idx);
    json.meshes[mi].primitives.push({ attributes: at, indices: acc(ix, 'SCALAR', big ? 5125 : 5123, 34963), material: matIndex });
  };
  // merge parts that end up with the same node + material
  const merged = new Map(); let tris = 0;
  for (const part of parts) {
    const mIx = await material(part.src), key = part.node + '|' + mIx, textured = !!json.materials[mIx].pbrMetallicRoughness.baseColorTexture;
    const g = compact(part.src.pos, part.src.nrm, textured ? part.src.uv : null, part.idx, null, part.shift || [0, 0, 0]);
    if (part.src.kind === 'solid') { const c = solidColor(part.src).c, n = g.pos.length / 3; g.col = new Float32Array(n * 3); for (let i = 0; i < n; i++) g.col.set(c, i * 3); }
    let m = merged.get(key); if (!m) merged.set(key, (m = { node: part.node, mIx, shift: part.shift, list: [] })); m.list.push(g); tris += g.idx.length / 3;
  }
  const join = list => { if (list.length === 1) return list[0]; let nv = 0, ni = 0; for (const g of list) { nv += g.pos.length / 3; ni += g.idx.length; } const o = { pos: new Float32Array(nv * 3), nrm: new Float32Array(nv * 3), uv: list[0].uv ? new Float32Array(nv * 2) : null, col: list[0].col ? new Float32Array(nv * 3) : null, idx: new Uint32Array(ni) }; let v = 0, i = 0; for (const g of list) { o.pos.set(g.pos, v * 3); o.nrm.set(g.nrm, v * 3); if (o.uv) o.uv.set(g.uv, v * 2); if (o.col) o.col.set(g.col, v * 3); for (let k = 0; k < g.idx.length; k++) o.idx[i + k] = g.idx[k] + v; v += g.pos.length / 3; i += g.idx.length; } return o; };
  const order = ['body', ...names];
  for (const m of [...merged.values()].sort((a, b) => order.indexOf(a.node) - order.indexOf(b.node))) await addPrim(m.node, join(m.list), m.mIx, m.shift);

  // lamp glow cards (white / red / amber / blue discs just outside the body; the game lights them at night)
  const glow = { pos: [], nrm: [], col: [], idx: [] };
  const disc = (x, y, z, r, dir, col, axis = 'z', ry = 1) => { const b = glow.pos.length / 3, N = 10; glow.pos.push(x, y, z); glow.nrm.push(axis === 'z' ? 0 : dir, 0, axis === 'z' ? dir : 0); glow.col.push(...col); for (let k = 0; k < N; k++) { const a = k / N * 6.2832, c = Math.cos(a) * r, s = Math.sin(a) * r * ry; if (axis === 'z') glow.pos.push(x + c, y + s, z); else glow.pos.push(x, y + s, z + c); glow.nrm.push(axis === 'z' ? 0 : dir, 0, axis === 'z' ? dir : 0); glow.col.push(...col); } for (let k = 0; k < N; k++) { const i1 = b + 1 + k, i2 = b + 1 + (k + 1) % N; if ((axis === 'z') === (dir > 0)) glow.idx.push(b, i1, i2); else glow.idx.push(b, i2, i1); } };
  const COL = { white: [1, 0.96, 0.86], red: [1, 0.05, 0.03], amber: [1, 0.5, 0.05], blue: [0.05, 0.2, 1] };
  const lights = cfg.lights || (ex.lights || []).filter(l => /^front-low_beam|^back-position/.test(l.name) || (/^back-brake/.test(l.name) && !(ex.lights || []).some(k => /^back-position/.test(k.name)))).map(l => ({ p: l.p, col: /^front/.test(l.name) ? 'white' : 'red' }));
  const seen = [];
  for (const l of lights) {
    const dir = l.dir ?? (l.p[2] > 0 ? 1 : -1), r = l.r ?? (l.col === 'white' ? 0.07 : 0.06); let [x, y, z] = l.p;
    if (seen.some(s => Math.hypot(s[0] - x, s[1] - y) < 0.05 && s[2] === dir)) continue; seen.push([x, y, dir]);
    if (!l.fixed) { const h = hit([x, y, dir * 12], [0, 0, -dir]); if (h) z = h.z + dir * 0.012; }
    disc(x, y, z, r, dir, COL[l.col], 'z', l.ry ?? 1);
  }
  const glowMat = () => { let gi = matIx.get('glow'); if (gi === undefined) { json.materials.push({ name: 'glow', pbrMetallicRoughness: { baseColorFactor: [0, 0, 0, 1], metallicFactor: 0, roughnessFactor: 1 }, emissiveFactor: [1, 1, 1] }); gi = json.materials.length - 1; matIx.set('glow', gi); } return gi; };
  if (glow.idx.length) await addPrim('glow', { pos: new Float32Array(glow.pos), nrm: new Float32Array(glow.nrm), col: new Float32Array(glow.col), uv: null, idx: new Uint32Array(glow.idx) }, glowMat());

  // decals: plates, door bands, roof signs. UV 0..1 over the named atlas region; the game maps them into its decal atlas.
  json.materials.push({ name: 'decal', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.4 } }); const decalMat = json.materials.length - 1;
  const decal = async (name, P, U, I) => { const N = new Float32Array(P.length); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals(); N.set(g.attributes.normal.array); await addPrim('decal:' + name, { pos: new Float32Array(P), nrm: N, uv: new Float32Array(U), col: null, idx: new Uint32Array(I) }, decalMat); };
  const plates = {};
  for (const s of ['F', 'R']) {
    const pl = plate[s]; if (!pl) continue; const dir = s === 'F' ? 1 : -1, w = 0.44, h = 0.14, [x, y] = pl; let z = pl[2];
    if (z == null) { z = -1e9; for (const [ox, oy] of [[0, 0], [-w / 2, 0], [w / 2, 0], [0, h / 2], [0, -h / 2], [-w / 2, h / 2], [w / 2, -h / 2], [-w / 2, -h / 2], [w / 2, h / 2]]) { const hp = hit([x + ox, y + oy, dir * 12], [0, 0, -dir]); if (hp) z = Math.max(z, hp.z * dir); } z = z * dir + dir * 0.012; }
    const x0 = x - dir * w / 2, x1 = x + dir * w / 2;
    await decal('plate' + s, [x0, y - h / 2, z, x1, y - h / 2, z, x1, y + h / 2, z, x0, y + h / 2, z], [0, 0, 1, 0, 1, 1, 0, 1], [0, 1, 2, 0, 2, 3]); plates[s] = [x, y, +z.toFixed(3)];
    // dark backing so the edge of the plate reads
    const bk = 0.012, zb = z - dir * 0.006; await addPrim('body', { pos: new Float32Array([x0 - dir * bk, y - h / 2 - bk, zb, x1 + dir * bk, y - h / 2 - bk, zb, x1 + dir * bk, y + h / 2 + bk, zb, x0 - dir * bk, y + h / 2 + bk, zb]), nrm: new Float32Array([0, 0, dir, 0, 0, dir, 0, 0, dir, 0, 0, dir]), uv: null, col: null, idx: new Uint32Array([0, 1, 2, 0, 2, 3]) }, await material({ name: 'detail:plateBack', kind: 'solid', mat: { color: { r: 0.02, g: 0.02, b: 0.022 }, metalness: 0, roughness: 0.6 } }), null, [0.02, 0.02, 0.022]);
  }
  for (const d of cfg.decals || []) {
    if (d.side) {   // band projected on the body side(s): z from zA (front end) to zB (rear end), y0..y1
      for (const s of d.side === 'both' ? [1, -1] : [d.side]) {
        const nu = d.nu || 14, nv = d.nv || 2, P = [], U = [], I = [];
        for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
          const u = i / nu, v = j / nv, zz = s > 0 ? d.zA + (d.zB - d.zA) * u : d.zB + (d.zA - d.zB) * u, yy = d.y0 + (d.y1 - d.y0) * v;
          const h = hit([s * 8, yy, zz], [-s, 0, 0]); P.push((h ? h.x : s * ex.size[0] / 2) + s * (d.off ?? 0.006), yy, zz); U.push(u, v);
        }
        for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, e = c + 1; if (s > 0) I.push(a, b, e, a, e, c); else I.push(a, b, e, a, e, c); }
        // make the winding face outwards
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals(); if (g.attributes.normal.getX(0) * s < 0) for (let k = 0; k < I.length; k += 3) { const t = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = t; }
        await decal(d.region, P, U, I);
      }
    } else {        // flat card facing ±Z: centre c, size w × h
      for (const dir of d.dirs || [1, -1]) { let [x, y, z] = d.c; if (d.snap) { let m = -1e9; for (const ox of [-d.w / 2, 0, d.w / 2]) { const hp = hit([x + ox, y, dir * 12], [0, 0, -dir]); if (hp) m = Math.max(m, hp.z * dir); } z = m * dir + dir * 0.008; } const zz = z + dir * (d.depth || 0) / 2 + dir * 0.004, x0 = x - dir * d.w / 2, x1 = x + dir * d.w / 2; await decal(d.region, [x0, y - d.h / 2, zz, x1, y - d.h / 2, zz, x1, y + d.h / 2, zz, x0, y + d.h / 2, zz], [0, 0, 1, 0, 1, 1, 0, 1], [0, 1, 2, 0, 2, 3]); }
    }
  }
  // extra solid boxes (roof sign body, light bar …): { c:[x,y,z], s:[w,h,d], color, rough, metal, glow:'red' }
  for (const b of cfg.boxes || []) {
    const g = new THREE.BoxGeometry(b.s[0], b.s[1], b.s[2]).toNonIndexed(); g.translate(...b.c); const n = g.attributes.position.count, idx = Uint32Array.from({ length: n }, (_, i) => i);
    if (b.glow) { const col = new Float32Array(n * 3); for (let i = 0; i < n; i++) col.set(COL[b.glow], i * 3); const gi = glowMat(); await addPrim('lampbox', { pos: g.attributes.position.array, nrm: g.attributes.normal.array, uv: null, col, idx }, gi); }
    else await addPrim('body', { pos: g.attributes.position.array, nrm: g.attributes.normal.array, uv: null, col: null, idx }, await material({ name: 'detail:' + (b.name || 'box'), kind: 'solid', mat: { color: { r: b.color[0], g: b.color[1], b: b.color[2] }, metalness: b.metal ?? 0, roughness: b.rough ?? 0.5 } }), null, b.color);
  }

  // size + metadata for the game
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (const p of prims) for (let i = 0; i < p.idx.length; i++) { const v = p.idx[i] * 3; for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p.pos[v + k]); mx[k] = Math.max(mx[k], p.pos[v + k]); } }
  const fr = hubs.filter(h => h.p[2] > 0), re = hubs.filter(h => h.p[2] < 0);
  json.nodes[0].extras = { type: cfg.type, length: +(mx[2] - mn[2]).toFixed(3), width: +(cfg.width ?? (mx[0] - mn[0])).toFixed(3), height: +mx[1].toFixed(3), zMin: +mn[2].toFixed(3), zMax: +mx[2].toFixed(3), wheelRadius: +fr[0].r.toFixed(3), wheelBase: +(fr[0].p[2] - re[0].p[2]).toFixed(3), plates, source: cfg.credit, ...(cfg.paint != null ? { paint: cfg.paint } : {}) };
  const glb = writeGLB(json, chunks);
  let bin = ''; for (let i = 0; i < glb.length; i += 0x8000) bin += String.fromCharCode.apply(null, glb.subarray(i, i + 0x8000));
  return { b64: btoa(bin), bytes: glb.length, tris, draws: json.meshes.reduce((s, m) => s + m.primitives.length, 0), materials: json.materials.map(m => m.name), images: json.images.map(im => im.name), extras: json.nodes[0].extras, log };
};

/** load a converted (plain) GLB for checking: paint gets a mid blue, decals a pale card colour, glow cards their own colour */
api.loadBuilt = async function (url, paint = 0x2c5aa0) {
  const gltf = await new GLTFLoader().loadAsync(url + '?t=' + Date.now()); holder.clear(); holder.add(gltf.scene);
  let tris = 0, draws = 0;
  gltf.scene.traverse(o => { if (!o.isMesh) return; draws++; tris += o.geometry.index.count / 3; const n = o.material.name;
    if (n === 'paint') o.material = new THREE.MeshPhysicalMaterial({ color: paint, metalness: 0.6, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.04 });
    else if (n === 'glow') o.material = new THREE.MeshBasicMaterial({ vertexColors: true });
    else if (n === 'decal') o.material = new THREE.MeshBasicMaterial({ color: /plate/.test(o.name) ? 0x2244cc : 0xe8e0c0 }); });
  cur = { name: url, gltf, lods: new Map([['LOD0', gltf.scene]]), extras: gltf.scene.children[0].userData, tex: new Map() };
  return { tris, draws, extras: cur.extras };
};
window.THREE = THREE; window.tool = { renderer, scene, camera, holder, texCanvas, get cur() { return cur; } };
document.title = 'ready';
