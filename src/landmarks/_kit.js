// Shared modelling kit for all landmark modules (v2 look: PBR materials, real textures, detailed roofs / halls / towers / trees).
// Conventions: metres, Y up, +X east, +Z south (so -Z is north). Front of a model faces +Z.
// Every helper that takes (x, y, z) treats y as the BOTTOM of the shape (it "sits" on y).
// Node-safe: tools/check-landmark.mjs imports this without a DOM — every texture then is null and materials are flat colours.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pbrTex, glow, HAS_DOM } from '../core/mats.js';

export { THREE };
const TEX_BASE = HAS_DOM ? new URL('../../assets/textures/', import.meta.url).href : '';
const lerp = THREE.MathUtils.lerp, clamp = THREE.MathUtils.clamp;

// ───────────────────────── palette ─────────────────────────
export const C = {
  // Tang / traditional
  tangRed: 0x9c2a1f, vermilion: 0xb5341f, darkWood: 0x4a2a1a, wood: 0x7a4a2a,
  tileGrey: 0x3f444a, tileBlack: 0x2b2e33, tileGreen: 0x2f6b4f, tileYellow: 0xd9a531, tileBlue: 0x2c4f8a,
  wallWhite: 0xece6d8, wallCream: 0xe3d7b8, wallRed: 0x8f3326, brickGrey: 0x7d7f80, cityWall: 0x8a8576,
  stone: 0xb8b2a4, stoneDark: 0x8d897f, marble: 0xe9e7e1, gold: 0xd4a93a, bronze: 0x6d5a3a,
  // modern
  concrete: 0xbdbdb8, concreteDark: 0x8e8f8c, glassBlue: 0x6fa3c7, glassDark: 0x35546b, glassGreen: 0x6fae9f,
  steel: 0x9aa3ab, white: 0xf2f2ee, black: 0x1c1d1f, asphalt: 0x3a3c3f, paving: 0xc9c2b2, pavingRed: 0xb07a63,
  // nature
  grass: 0x6f9a4a, leaf: 0x3f7a3a, leafDark: 0x2f5f2f, trunk: 0x5a4030, water: 0x3f7fa6, earth: 0x9b8a6a, rock: 0x8c8676,
  peonyPink: 0xe86a9a, peonyRed: 0xc92a4a, peonyWhite: 0xf5e9ef, peonyPurple: 0x9a4aa8,
};

// ───────────────────────── colour helpers ─────────────────────────
const _c = new THREE.Color();
const lin = (hex) => { _c.setHex(hex); return [_c.r, _c.g, _c.b]; };
const lum = (hex) => { const [r, g, b] = lin(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const sat = (hex) => { const [r, g, b] = lin(hex), mx = Math.max(r, g, b); return mx ? (mx - Math.min(r, g, b)) / mx : 0; };
/** linear rgb of a hex colour with the albedo capped (pure white walls burn out under the HDR sun) */
const albedo = (hex, cap = 0.74) => { const d = lin(hex), mx = Math.max(d[0], d[1], d[2]); return mx > cap ? d.map(v => v * cap / mx) : d; };
const scaled = (hex, k) => { const [r, g, b] = lin(hex); return new THREE.Color().setRGB(r * k, g * k, b * k); };
const css = (hex) => '#' + hex.toString(16).padStart(6, '0');
const std = (p) => new THREE.MeshStandardMaterial(p);
/** Seeded random (deterministic layouts). */
export function rng(seed = 1) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const hash3 = (a, b, c) => ((Math.round(a * 7.3) * 73856093) ^ (Math.round(b * 7.3) * 19349663) ^ (Math.round(c * 13.1) * 83492791)) >>> 0;

// ───────────────────────── textures ─────────────────────────
const texCache = new Map();
/** Cached canvas texture. draw(ctx, w, h). Returns null under Node (no DOM) — materials then fall back to flat colour. opts: repeat, data (non-colour, e.g. bump) */
export function tex(key, w, h, draw, { repeat = true, data = false } = {}) {
  if (!HAS_DOM) return null;
  let t = texCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  t = new THREE.CanvasTexture(c);
  if (!data) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 8;
  texCache.set(key, t);
  return t;
}

// linear-space average colour [r, g, b, grey] of each Poly Haven diffuse map (measured) — used to tint a texture to an exact target colour
const TEX_AVG = {
  aerial_grass_rock: [0.169, 0.121, 0.025, 0.116], asphalt_02: [0.104, 0.103, 0.091, 0.102], beige_wall_001: [0.340, 0.262, 0.188, 0.275],
  castle_brick_02_red: [0.234, 0.128, 0.075, 0.147], cobblestone_floor_08: [0.298, 0.271, 0.227, 0.274], concrete_floor_worn_001: [0.093, 0.094, 0.089, 0.093],
  concrete_wall_003: [0.631, 0.496, 0.355, 0.515], red_brick_03: [0.150, 0.095, 0.078, 0.107],
};
/** Grey-scale copy of a diffuse map (so a red brick texture can be tinted to grey city-wall brick without colour noise). */
function desatTex(name, contrast = 0.5) {
  const key = 'desat|' + name + contrast; let t = texCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d', { willReadFrequently: true });
  const v = Math.round(Math.pow(TEX_AVG[name][3], 1 / 2.2) * 255); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, 0, 1024, 1024);
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  const img = new Image();
  img.onload = () => { g.drawImage(img, 0, 0, 1024, 1024); const d = g.getImageData(0, 0, 1024, 1024), a = d.data; for (let i = 0; i < a.length; i += 4) { const y = v + (0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2] - v) * contrast; a[i] = a[i + 1] = a[i + 2] = y; } g.putImageData(d, 0, 0); t.needsUpdate = true; };
  img.src = `${TEX_BASE}${name}/diff.jpg`;
  texCache.set(key, t);
  return t;
}

/** Dressed-stone slabs: the worn-concrete diffuse map with running-bond joints (4 x 8 slabs per repeat) and slight per-slab shade — paving, platforms, steps. */
function slabTex() {
  const key = 'slabs'; let t = texCache.get(key);
  if (t) return t;
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  const paint = (img) => {
    if (img) g.drawImage(img, 0, 0, S, S); else { g.fillStyle = '#565654'; g.fillRect(0, 0, S, S); }
    const r = rng(5), cw = S / 4, rh = S / 8;
    for (let j = 0; j < 8; j++) for (let i = -1; i < 4; i++) {
      const x = i * cw + (j % 2 ? cw / 2 : 0), y = j * rh, v = r();
      g.fillStyle = v < 0.5 ? `rgba(0,0,0,${(0.5 - v) * 0.22})` : `rgba(255,255,255,${(v - 0.5) * 0.14})`; g.fillRect(x, y, cw, rh);
      g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x, y, cw, 3); g.fillRect(x, y, 3, rh);
      g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(x + 3, y + 3, cw - 3, 2); g.fillRect(x + 3, y + 3, 2, rh - 3);
    }
  };
  paint(null);
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  const img = new Image(); img.onload = () => { paint(img); t.needsUpdate = true; }; img.src = `${TEX_BASE}concrete_floor_worn_001/diff.jpg`;
  texCache.set(key, t);
  return t;
}

/** Window-grid texture: one tile = one bay x one floor. style: 'glass' | 'grid' | 'office' | 'apartment' | 'mall'. (tower() no longer needs it — it builds real facade depth.) */
export function windowTex(style = 'office', wall = 0xbdbdb8, glass = 0x35546b) {
  const t = tex(`win|${style}|${wall}|${glass}`, 128, 128, (g, w, h) => {
    const k = w / 64, R = (x, y, a, b) => g.fillRect(x * k, y * k, a * k, b * k);
    g.fillStyle = css(wall); g.fillRect(0, 0, w, h);
    const gl = g.createLinearGradient(0, 0, 0, h); gl.addColorStop(0, css(glass)); gl.addColorStop(1, '#' + scaled(glass, 0.55).getHexString());
    g.fillStyle = gl;
    if (style === 'glass') { R(0, 0, 64, 64); g.fillStyle = 'rgba(255,255,255,0.25)'; R(0, 0, 64, 2); R(0, 0, 2, 64); g.fillStyle = 'rgba(255,255,255,0.08)'; R(8, 8, 20, 48); }
    else if (style === 'grid') { R(6, 10, 52, 44); }
    else if (style === 'apartment') { R(8, 16, 20, 30); R(38, 16, 18, 30); g.fillStyle = 'rgba(0,0,0,0.18)'; R(0, 54, 64, 3); g.fillStyle = 'rgba(255,255,255,0.5)'; R(7, 46, 22, 1.5); R(37, 46, 20, 1.5); }
    else if (style === 'mall') { R(0, 34, 64, 26); g.fillStyle = 'rgba(255,255,255,0.2)'; R(0, 34, 64, 2); }
    else { R(5, 14, 54, 34); g.fillStyle = 'rgba(255,255,255,0.15)'; R(5, 14, 54, 3); g.fillStyle = 'rgba(0,0,0,0.25)'; R(31, 14, 2, 34); }
  });
  if (t) t.userData.window = { style, wall, glass };
  return t;
}

/**
 * Pattern marker textures. kind: 'brick' | 'tiles' | 'paving' | 'stone' | 'rock' | 'grass' | 'roofTile' | 'lattice'.
 * mat(color, { map: patternTex(kind, base) }) turns brick / tiles / paving / stone / rock / grass / roofTile into a real PBR material tinted to `base`
 * (tiled in metres automatically); 'lattice' stays a canvas texture with one grid cell per UV unit (use with tiledBox).
 */
export function patternTex(kind, base = 0xb8b2a4, line = 0x000000) {
  const hi = kind === 'lattice', S = hi ? 128 : 32;
  const t = tex(`pat|${kind}|${base}|${line}`, S, S, (g, w, h) => {
    g.fillStyle = css(base); g.fillRect(0, 0, w, h);
    if (!hi) return;
    g.strokeStyle = css(line); g.globalAlpha = 0.85; g.lineWidth = 7;
    for (let x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.lineWidth = 3; g.globalAlpha = 0.6;
    for (let x = 32; x < w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 32; y < h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.globalAlpha = 1;
  });
  if (t) t.userData.pattern = { kind, base, line };
  return t;
}

// roof tiles: ridged canvas texture (4 tile rows per repeat = 1.2 m) used as colour + bump; tinted per roof colour
let TILE_AVG = 0.42;
const tileTex = (data) => tex('roofTiles' + (data ? 'B' : ''), 128, 128, (g, w, h) => {
  g.fillStyle = '#6c6c6c'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 32) { const gr = g.createLinearGradient(x + 3, 0, x + 29, 0); gr.addColorStop(0, '#7c7c7c'); gr.addColorStop(0.5, '#ececec'); gr.addColorStop(1, '#7c7c7c'); g.fillStyle = gr; g.fillRect(x + 3, 0, 26, h); }
  for (let y = 0; y < h; y += 32) { g.fillStyle = 'rgba(0,0,0,.26)'; g.fillRect(0, y, w, 4); g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(0, y + 4, w, 3); }
  if (!data) { const d = g.getImageData(0, 0, w, h).data; let s = 0; for (let i = 0; i < d.length; i += 16) s += Math.pow(d[i] / 255, 2.2); TILE_AVG = s / (d.length / 16); }
}, { data });
const eaveTex = () => tex('eaveEnds', 64, 32, (g) => {      // 瓦当 + 滴水, 2 per repeat
  g.fillStyle = '#3c3c3c'; g.fillRect(0, 0, 64, 32);
  for (const x of [16, 48]) {
    g.fillStyle = '#8a8a8a'; g.beginPath(); g.moveTo(x - 16, 0); g.lineTo(x + 16, 0); g.lineTo(x + 16, 12); g.quadraticCurveTo(x, 34, x - 16, 12); g.fill();
    g.fillStyle = '#f0f0f0'; g.beginPath(); g.arc(x, 11, 9.5, 0, 6.3); g.fill(); g.fillStyle = '#9a9a9a'; g.beginPath(); g.arc(x, 11, 6, 0, 6.3); g.fill(); g.fillStyle = '#e0e0e0'; g.beginPath(); g.arc(x, 11, 2.5, 0, 6.3); g.fill();
  }
});
const rafterTex = () => tex('rafters', 64, 64, (g) => {     // 椽子: 2 lacquered rafters per repeat seen from below
  g.fillStyle = '#2c1710'; g.fillRect(0, 0, 64, 64);
  for (const x of [5, 37]) { const gr = g.createLinearGradient(x, 0, x + 22, 0); gr.addColorStop(0, '#5e1c12'); gr.addColorStop(0.5, '#a8382a'); gr.addColorStop(1, '#5e1c12'); g.fillStyle = gr; g.fillRect(x, 0, 22, 64); g.fillStyle = '#d8c9a0'; g.fillRect(x + 2, 0, 18, 5); }
});
const rippleTex = () => tex('ripples', 256, 256, (g) => {
  g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256); const r = rng(11);
  for (let i = 0; i < 260; i++) { const x = r() * 256, y = r() * 256, rad = 6 + r() * 22, v = r() < 0.5 ? 255 : 0;
    for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad); gr.addColorStop(0, `rgba(${v},${v},${v},.22)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`); g.fillStyle = gr; g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2); } }
}, { data: true });
const leafTex = () => tex('leaves', 256, 256, (g) => {
  const r = rng(7);
  for (let i = 0; i < 440; i++) { const a = r() * 6.28, rad = 116 * Math.sqrt(r()), x = 128 + Math.cos(a) * rad, y = 128 + Math.sin(a) * rad; g.fillStyle = `hsl(${88 + r() * 36}, ${38 + r() * 24}%, ${15 + r() * 21}%)`; g.save(); g.translate(x, y); g.rotate(r() * 6.28); g.beginPath(); g.ellipse(0, 0, 8 + r() * 8, 3.5 + r() * 3, 0, 0, 6.28); g.fill(); g.restore(); }
}, { repeat: false });
const latticeTex = (bar) => tex('hallLattice|' + bar, 128, 128, (g) => {   // 格扇: wooden bars over paper, 4 x 4 cells per repeat
  g.fillStyle = '#d9c9a2'; g.fillRect(0, 0, 128, 128); g.fillStyle = css(bar);
  for (let i = 0; i <= 4; i++) { g.fillRect(i * 32 - 3, 0, 6, 128); g.fillRect(0, i * 32 - 3, 128, 6); }
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillRect(i * 32 + 10, j * 32 + 14.5, 12, 3); g.fillRect(i * 32 + 14.5, j * 32 + 10, 3, 12); }
});

// ───────────────────────── materials ─────────────────────────
// Every material is a MeshStandardMaterial. material.userData: { base: original hex, kind, tile: metres per texture repeat (finalize()
// then box-projects UVs in metres, so textures never stretch), roof: true for tile roofs }.
const TEX_GAIN = { cobblestone_floor_08: 0.8, castle_brick_02_red: 0.9, aerial_grass_rock: 0.9, concrete_floor_worn_001: 0.85 };
function texMat(name, hex, tile, desat = false, contrast = 0.5) {
  const slab = name === 'slab'; if (slab) name = 'concrete_floor_worn_001';
  let m;
  if (!HAS_DOM) m = std({ color: hex, roughness: 0.85 });
  else {
    const arm = pbrTex(name, 'arm'), avg = TEX_AVG[name], gk = TEX_GAIN[name] || 1, d = albedo(hex).map(v => v * gk);
    m = std({ map: slab ? slabTex() : desat ? desatTex(name, contrast) : pbrTex(name, 'diff'), normalMap: pbrTex(name, 'nor'), roughnessMap: arm, metalnessMap: arm, aoMap: arm, metalness: 1, roughness: 1 });
    m.color.setRGB(Math.min(8, d[0] / (desat ? avg[3] : avg[0])), Math.min(8, d[1] / (desat ? avg[3] : avg[1])), Math.min(8, d[2] / (desat ? avg[3] : avg[2])));
  }
  m.userData = { tile, kind: 'tex' };
  return m;
}
/** painted / plastered surface of any colour: exact colour + fine plaster grain (normal + roughness only) */
function finishMat(hex) {
  const m = HAS_DOM ? std({ roughness: 1, roughnessMap: pbrTex('beige_wall_001', 'arm'), normalMap: pbrTex('beige_wall_001', 'nor') }) : std({ roughness: 0.85 });
  m.color.setRGB(...albedo(hex));
  m.userData = { tile: 3, kind: 'fin' };
  return m;
}
const flatMat = (hex, rough = 0.7, metal = 0, kind = 'flat') => { const m = std({ color: hex, roughness: rough, metalness: metal }); m.userData = { kind }; return m; };
const glassCache = new Map();
function glassMat(hex, k = 0.75) { const key = hex + '|' + k; let m = glassCache.get(key); if (!m) { m = std({ color: scaled(hex, k), roughness: 0.06, metalness: 0.92, envMapIntensity: 1.35 }); m.userData = { kind: 'glass', base: hex }; glassCache.set(key, m); } return m; }
function waterMat(hex, opacity) {
  const [wr, wg, wb] = lin(hex), m = std({ color: new THREE.Color().setRGB(wr * 0.5 + 0.06, wg * 0.5 + 0.07, wb * 0.4 + 0.05), roughness: 0.07, metalness: 0.6, envMapIntensity: 1.25, bumpMap: rippleTex(), bumpScale: 1.2 });
  if (opacity !== undefined && opacity < 1) { m.transparent = true; m.opacity = Math.max(opacity, 0.8); m.depthWrite = false; }
  m.userData = { tile: 9, kind: 'water' };
  return m;
}
const roofCache = new Map();
/** glazed / grey tile roof material for a base colour (shared by tangRoof, roundRoof, gableRoof, hall, pagoda) */
function roofTileMat(hex) {
  let m = roofCache.get(hex); if (m) return m;
  const glazed = sat(hex) > 0.3, d = lin(hex), lift = glazed ? 1.2 : 1.55, map = tileTex(false);
  m = std({ map, bumpMap: tileTex(true), bumpScale: 3.5, roughness: glazed ? 0.34 : 0.72, metalness: glazed ? 0.12 : 0.04 });
  const k = map ? lift / TILE_AVG : 1;
  m.color.setRGB(d[0] * k + (glazed || !map ? 0 : 0.02), d[1] * k + (glazed || !map ? 0 : 0.02), d[2] * k + (glazed || !map ? 0 : 0.022));
  m.userData = { tile: 1.2, kind: 'roof', roof: true, base: hex, glazed };
  roofCache.set(hex, m); return m;
}
const roofTrimCache = new Map();
/** the other materials a tile roof needs: eave tile-ends, ridges, ridge ornaments */
function roofTrim(hex) {
  let t = roofTrimCache.get(hex); if (t) return t;
  const glazed = sat(hex) > 0.3, d = lin(hex);
  const eave = std({ map: eaveTex(), roughness: glazed ? 0.4 : 0.7, metalness: 0.05 }); eave.color.setRGB(d[0] * (glazed ? 1.5 : 2.6) + 0.02, d[1] * (glazed ? 1.5 : 2.6) + 0.02, d[2] * (glazed ? 1.5 : 2.6) + 0.02); eave.userData = { kind: 'trim' };
  const ridge = std({ color: scaled(hex, glazed ? 0.8 : 1.15), roughness: glazed ? 0.35 : 0.68 }); ridge.userData = { kind: 'trim' };
  const orn = std({ color: scaled(hex, glazed ? 1.1 : 1.9), roughness: glazed ? 0.3 : 0.6 }); orn.userData = { kind: 'trim' };
  t = { eave, ridge, orn }; roofTrimCache.set(hex, t); return t;
}
let _soffit, _paneMat, _litMat, _leafMat, _lampGlow, _darkFrame, _lightFrame, _teal;
const tealMat = () => _teal || (_teal = flatMat(0x1f6b73, 0.5));
const barkCache = new Map();
const barkMat = (hex) => { let m = barkCache.get(hex); if (!m) barkCache.set(hex, m = flatMat(hex, 0.95)); return m; };
const soffitMat = () => _soffit || (_soffit = Object.assign(std({ color: rafterTex() ? 0xffffff : 0x6a2a1c, map: rafterTex(), roughness: 0.6 }), { userData: { kind: 'trim' } }));
const paneMat = () => _paneMat || (_paneMat = Object.assign(std({ vertexColors: true, roughness: 0.1, metalness: 0.6, envMapIntensity: 1.25 }), { userData: { kind: 'glass' } }));
const litMat = () => _litMat || (_litMat = glow(Object.assign(std({ color: 0x2a3440, roughness: 0.12, metalness: 0.5, emissive: 0xffd9a0 }), { userData: { kind: 'glass' } }), 0, 1.6));
const darkFrame = () => _darkFrame || (_darkFrame = flatMat(0x2a2d31, 0.5, 0.6, 'metal'));
const lightFrame = () => _lightFrame || (_lightFrame = flatMat(0xe8e8e4, 0.5, 0, 'flat'));
const lampGlow = () => _lampGlow || (_lampGlow = glow(Object.assign(std({ color: 0xfff2c8, roughness: 0.4, emissive: 0xffe2a0 }), { userData: { kind: 'glow' } }), 0.15, 6));
function leafMat() {
  if (_leafMat) return _leafMat;
  const map = leafTex();
  _leafMat = std({ map, color: map ? 0xffffff : 0x3f7a3a, alphaTest: map ? 0.4 : 0, side: THREE.DoubleSide, roughness: 1, metalness: 0, envMapIntensity: 0.4, vertexColors: true });
  _leafMat.userData = { kind: 'leaf', depthMat: map ? new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.4 }) : null };
  return _leafMat;
}
const latticeCache = new Map();
function latticeMat(bar) {
  let m = latticeCache.get(bar); if (m) return m;
  const map = latticeTex(bar);
  m = std({ map, color: map ? 0xffffff : 0xb09a70, roughness: 0.75, emissive: 0xffb060, emissiveMap: map });
  glow(m, 0, 0.75); m.userData = { tile: 1.0, kind: 'tex' };
  latticeCache.set(bar, m); return m;
}

// semantic look of the palette colours: [kind, ...args]
const SEM = new Map([
  [C.tangRed, ['flat', 0.42]], [C.vermilion, ['flat', 0.42]], [C.darkWood, ['flat', 0.62]], [C.wood, ['flat', 0.68]],
  [C.tileGrey, ['roof']], [C.tileBlack, ['roof']], [C.tileGreen, ['roof']], [C.tileYellow, ['roof']], [C.tileBlue, ['roof']],
  [C.wallWhite, ['tex', 'beige_wall_001', 3]], [C.wallCream, ['tex', 'beige_wall_001', 3]], [C.wallRed, ['tex', 'beige_wall_001', 3]],
  [C.brickGrey, ['tex', 'castle_brick_02_red', 2.4, true]], [C.cityWall, ['tex', 'castle_brick_02_red', 2.8, true]],
  [C.stone, ['tex', 'slab', 4]], [C.stoneDark, ['tex', 'slab', 4]], [C.marble, ['tex', 'beige_wall_001', 4]],
  [C.gold, ['flat', 0.3, 1, 'metal']], [C.bronze, ['flat', 0.45, 0.85, 'metal']], [C.steel, ['flat', 0.42, 0.75, 'metal']],
  [C.concrete, ['tex', 'concrete_floor_worn_001', 4]], [C.concreteDark, ['tex', 'concrete_floor_worn_001', 4]],
  [C.glassBlue, ['glass', 0.95]], [C.glassDark, ['glass', 1]], [C.glassGreen, ['glass', 0.95]],
  [C.black, ['flat', 0.5]], [C.asphalt, ['tex', 'asphalt_02', 5]], [C.paving, ['tex', 'cobblestone_floor_08', 3]], [C.pavingRed, ['tex', 'cobblestone_floor_08', 3]],
  [C.grass, ['tex', 'aerial_grass_rock', 10]], [C.leaf, ['flat', 0.95]], [C.leafDark, ['flat', 0.95]], [C.trunk, ['flat', 0.95]],
  [C.water, ['water']], [C.earth, ['tex', 'beige_wall_001', 4]], [C.rock, ['tex', 'concrete_wall_003', 26, true, 0.8]],
  [C.peonyPink, ['flat', 0.8]], [C.peonyRed, ['flat', 0.8]], [C.peonyWhite, ['flat', 0.8]], [C.peonyPurple, ['flat', 0.8]],
]);
function patternMat(kind, hex) {
  if (kind === 'roofTile') return roofTileMat(hex);
  if (kind === 'paving') return texMat('cobblestone_floor_08', hex, 3);
  if (kind === 'rock') return texMat('concrete_wall_003', hex, 26, true, 0.8);       // weathered cliff / boulders
  if (kind === 'grass') return texMat('aerial_grass_rock', hex, 12);
  if (kind === 'stone' || kind === 'tiles') return texMat('slab', hex, 4);
  if (kind === 'brick') {
    const [r, , b] = lin(hex);
    if (r > b * 1.8 && sat(hex) > 0.4) return texMat('red_brick_03', hex, 1.8);
    return texMat('castle_brick_02_red', hex, 2.4, true);                             // grey city-wall brick
  }
  return null;
}

const matCache = new Map();
/**
 * Cached PBR material. opts: { shiny, emissive, emissiveIntensity, opacity, double, map (THREE.Texture), key }.
 * Palette colours (C.*) get a matching real texture / finish automatically (stone, plaster, brick, tile, glass, metal, water, grass…);
 * any other colour gets a painted-plaster finish. `map: patternTex(...)` → real PBR texture tinted to the colour (see patternTex).
 * Emissive materials glow weakly by day and strongly in night mode.
 */
export function mat(color, opts = {}) {
  const key = [color, opts.shiny ? 1 : 0, opts.emissive || 0, opts.emissiveIntensity ?? '', opts.opacity ?? 1, opts.double ? 1 : 0, opts.map ? opts.map.uuid : '', opts.key || ''].join('|');
  let m = matCache.get(key);
  if (m) return m;
  const pat = opts.map && opts.map.userData && opts.map.userData.pattern, win = opts.map && opts.map.userData && opts.map.userData.window;
  const see = opts.opacity !== undefined && opts.opacity < 1, sem = SEM.get(color);
  if (opts.emissive) {
    m = std({ color, map: opts.map || null, emissive: opts.emissive, roughness: 0.55 }); m.userData = { kind: 'glow' };
    const ei = opts.emissiveIntensity ?? 0.6; glow(m, ei * 0.45, ei * 3);
  } else if (pat && !see && (m = patternMat(pat.kind, color === 0xffffff ? pat.base : color))) { /* real PBR texture */ }
  else if (opts.map) { m = std({ color, map: opts.map, roughness: win ? 0.45 : 0.8, metalness: win ? 0.25 : 0 }); m.userData = { kind: 'legacy' }; }
  else if (sem && sem[0] === 'water') m = waterMat(color, opts.opacity);
  else if (see) { const gl = sem && sem[0] === 'glass'; m = std({ color: gl ? scaled(color, 0.7) : color, roughness: 0.1, metalness: gl ? 0.7 : 0.15, envMapIntensity: 1.2 }); m.userData = { kind: 'glass' }; }
  else if (sem && sem[0] === 'glass') m = glassMat(color, sem[1]);
  else if (sem && sem[0] === 'roof') m = roofTileMat(color);
  else if (sem && sem[0] === 'tex') m = texMat(sem[1], color, sem[2], sem[3], sem[4]);
  else if (sem && sem[0] === 'flat') m = flatMat(color, opts.shiny ? Math.min(sem[1], 0.28) : sem[1], sem[2] ?? (opts.shiny ? 0.4 : 0), sem[3]);
  else if (opts.shiny) m = flatMat(color, 0.2, 0.7, 'metal');
  else m = finishMat(color);
  if (m.userData.roof && (opts.double || see)) { const ud = m.userData; m = m.clone(); m.userData = { ...ud }; }
  if (see) { m.transparent = true; m.opacity = opts.opacity; m.depthWrite = false; }
  if (opts.double) m.side = THREE.DoubleSide;
  if (m.userData.base === undefined) m.userData.base = pat && color === 0xffffff ? pat.base : color;
  matCache.set(key, m);
  return m;
}

// ───────────────────────── batched geometry (internal) ─────────────────────────
const _m4 = new THREE.Matrix4(), _n3 = new THREE.Matrix3(), _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3();
const BOX_F = [ // [bit, 4 corners (sx,sy,sz multipliers), normal]
  [1, [[1, 0, 1], [1, 0, -1], [1, 1, -1], [1, 1, 1]], [1, 0, 0]], [2, [[-1, 0, -1], [-1, 0, 1], [-1, 1, 1], [-1, 1, -1]], [-1, 0, 0]],
  [4, [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]], [0, 1, 0]], [8, [[-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1]], [0, -1, 0]],
  [16, [[-1, 0, 1], [1, 0, 1], [1, 1, 1], [-1, 1, 1]], [0, 0, 1]], [32, [[1, 0, -1], [-1, 0, -1], [-1, 1, -1], [1, 1, -1]], [0, 0, -1]],
];
const QUV = [0, 0, 1, 0, 1, 1, 0, 1], QI = [0, 1, 2, 0, 2, 3];
/** Collects many boxes / quads / geometries into ONE mesh (far cheaper than a Mesh per part). */
class Batch {
  constructor(colors = false) { this.p = []; this.n = []; this.u = []; this.c = colors ? [] : null; this.col = [1, 1, 1]; }
  /** quad from 4 corners [x,y,z] (counter-clockwise seen from the front) */
  quad(a, b, c, d, nrm, uv = QUV) {
    const P = [a, b, c, d];
    if (!nrm) { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]; nrm = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]; const l = Math.hypot(nrm[0], nrm[1], nrm[2]) || 1; nrm = [nrm[0] / l, nrm[1] / l, nrm[2] / l]; }
    for (const i of QI) { this.p.push(P[i][0], P[i][1], P[i][2]); this.n.push(nrm[0], nrm[1], nrm[2]); this.u.push(uv[i * 2], uv[i * 2 + 1]); if (this.c) this.c.push(this.col[0], this.col[1], this.col[2]); }
    return this;
  }
  /** box centred on (x, z), bottom at y. faces bitmask: 1 +x, 2 -x, 4 top, 8 bottom, 16 +z, 32 -z */
  box(x, y, z, sx, sy, sz, ry = 0, faces = 63) {
    const cs = Math.cos(ry), sn = Math.sin(ry), hx = sx / 2, hz = sz / 2;
    for (const [bit, cor, nr] of BOX_F) {
      if (!(faces & bit)) continue;
      const P = cor.map(k => { const lx = k[0] * hx, lz = k[2] * hz; return [x + lx * cs + lz * sn, y + k[1] * sy, z - lx * sn + lz * cs]; });
      this.quad(P[0], P[1], P[2], P[3], [nr[0] * cs + nr[2] * sn, nr[1], -nr[0] * sn + nr[2] * cs]);
    }
    return this;
  }
  /** append a BufferGeometry, optionally transformed by a Matrix4 */
  geo(g, m) {
    const src = g.index ? g.toNonIndexed() : g, P = src.attributes.position, N = src.attributes.normal, U = src.attributes.uv;
    if (m) _n3.getNormalMatrix(m);
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i); if (m) _v.applyMatrix4(m); this.p.push(_v.x, _v.y, _v.z);
      _v.fromBufferAttribute(N, i); if (m) _v.applyMatrix3(_n3).normalize(); this.n.push(_v.x, _v.y, _v.z);
      this.u.push(U ? U.getX(i) : 0, U ? U.getY(i) : 0); if (this.c) this.c.push(this.col[0], this.col[1], this.col[2]);
    }
    return this;
  }
  cyl(rTop, rBot, h, x, y, z, seg = 10, open = true) { return this.geo(new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open), _m4.makeTranslation(x, y + h / 2, z)); }
  get empty() { return this.p.length === 0; }
  mesh(material, ownUV = false) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    if (this.c) g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    if (ownUV) g.userData.ownUV = true;
    return new THREE.Mesh(g, material);
  }
  addTo(group, material, ownUV = false) { if (!this.empty) group.add(this.mesh(material, ownUV)); return group; }
}

// ───────────────────────── primitives ─────────────────────────
function place(mesh, x, y, z, ry) { mesh.position.set(x, y, z); if (ry) mesh.rotation.y = ry; return mesh; }

/** Box sitting on y. (Textured materials are tiled in metres automatically by finalize().) */
export function box(w, h, d, material, x = 0, y = 0, z = 0, ry = 0) {
  return place(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material), x, y + h / 2, z, ry);
}

/** Box whose side faces repeat a canvas texture every (tileW x tileH) metres — for windowTex / patternTex('lattice') / own tex() materials. */
export function tiledBox(w, h, d, material, tileW = 4, tileH = 3.5, x = 0, y = 0, z = 0, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (!material.userData.tile) {
    const uv = g.attributes.uv; // face order: +x, -x, +y, -y, +z, -z ; 4 verts each
    const scale = [[d / tileW, h / tileH], [d / tileW, h / tileH], [w / tileW, d / tileW], [w / tileW, d / tileW], [w / tileW, h / tileH], [w / tileW, h / tileH]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * Math.max(1, Math.round(scale[f][0])), uv.getY(k) * Math.max(1, Math.round(scale[f][1]))); }
  }
  return place(new THREE.Mesh(g, material), x, y + h / 2, z, ry);
}

/** Vertical cylinder / cone-frustum sitting on y. */
export function cyl(rTop, rBot, h, material, x = 0, y = 0, z = 0, seg = 16) {
  return place(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), material), x, y + h / 2, z, 0);
}

/** Sphere centred at (x,y,z). */
export function sphere(r, material, x = 0, y = 0, z = 0, seg = 16) {
  return place(new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg >> 1)), material), x, y, z, 0);
}

/** Flat horizontal rectangle (paving, water, lawn) at height y. Use y >= 0.15 so it draws above city roads. `tile` only matters for canvas-texture materials. */
export function plaza(w, d, material, x = 0, z = 0, y = 0.15, tile = 0) {
  const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2);
  if (tile && !material.userData.tile) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * d / tile); }
  return place(new THREE.Mesh(g, material), x, y, z, 0);
}

/** Flat disc at height y. */
export function disc(r, material, x = 0, z = 0, y = 0.15, seg = 32) {
  const g = new THREE.CircleGeometry(r, seg); g.rotateX(-Math.PI / 2);
  return place(new THREE.Mesh(g, material), x, y, z, 0);
}

/** Extruded polygon prism: pts = [[x,z],...] (counter-clockwise or clockwise), from y to y+h. */
export function prism(pts, h, material, y = 0) {
  const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], -p[1])));
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  return place(new THREE.Mesh(g, material), 0, y, 0, 0);
}

/** Gable (two-slope) roof: ridge runs along X. Sits on y, spans w x d, rises h. With a tile material it gets tile rows down the slope and a ridge cap. */
export function gableRoof(w, d, h, material, x = 0, y = 0, z = 0, ry = 0) {
  const b = new Batch(), hw = w / 2, hd = d / 2, sl = Math.hypot(hd, h), T = 1.2;
  b.quad([-hw, 0, hd], [hw, 0, hd], [hw, h, 0], [-hw, h, 0], null, [-hw / T, 0, hw / T, 0, hw / T, sl / T, -hw / T, sl / T]);
  b.quad([hw, 0, -hd], [-hw, 0, -hd], [-hw, h, 0], [hw, h, 0], null, [hw / T, 0, -hw / T, 0, -hw / T, sl / T, hw / T, sl / T]);
  for (const s of [1, -1]) { const A = [s * hw, 0, s * hd], B = [s * hw, 0, -s * hd], Cc = [s * hw, h, 0]; b.quad(A, B, Cc, Cc, [s, 0, 0], [hd / T, 0, -hd / T, 0, 0, h / T, 0, h / T]); }
  b.quad([-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd], [0, -1, 0]);
  const roof = !!material.userData.roof, mesh = b.mesh(material, roof);
  if (!roof || h < 0.45 || w < 0.5) return place(mesh, x, y, z, ry);
  const grp = new THREE.Group(), rr = clamp(d * 0.045, 0.09, 0.26), br = new Batch();
  br.box(0, h - rr * 0.5, 0, w + 0.08, rr * 1.5, rr * 1.5);
  grp.add(mesh); br.addTo(grp, roofTrim(material.userData.base).ridge);
  return place(grp, x, y, z, ry);
}

// ───────────────────────── Chinese roofs ─────────────────────────
let _chiwenGeo;
function chiwenGeo() {  // 鸱吻: unit height 3, body on x∈[-0.75,0.75], tail hooks towards -x
  if (_chiwenGeo) return _chiwenGeo;
  const s = new THREE.Shape(); s.moveTo(-0.75, 0); s.lineTo(0.75, 0); s.quadraticCurveTo(0.98, 1.4, -0.05, 2.5); s.quadraticCurveTo(-0.65, 3.0, -1.25, 2.6); s.quadraticCurveTo(-0.4, 2.1, -0.5, 1.1); s.lineTo(-0.75, 0);
  _chiwenGeo = new THREE.ExtrudeGeometry(s, { depth: 0.56, bevelEnabled: false, curveSegments: 5 }); _chiwenGeo.translate(0, 0, -0.28);
  return _chiwenGeo;
}
/** 宝顶: base drum + gold orb + spire */
function addFinial(bR, bG, r0, fh, y) {
  bR.cyl(r0 * 1.15, r0 * 1.5, fh * 0.2, 0, y, 0, 10, false);
  bG.geo(new THREE.SphereGeometry(r0 * 1.05, 10, 7), _m4.makeScale(1, 0.85, 1).setPosition(0, y + fh * 0.2 + r0 * 0.8, 0));
  bG.cyl(0.03, r0 * 0.42, fh * 0.62, 0, y + fh * 0.2 + r0 * 1.5, 0, 8, false);
}
/** picks the tile material set for whatever material a module passed */
function roofSet(material) {
  if (!material) material = roofTileMat(C.tileGrey);
  const k = material.userData.kind;
  if (!material.userData.roof && !material.transparent && (k === 'fin' || k === 'flat' || k === 'tex') && typeof material.userData.base === 'number') material = roofTileMat(material.userData.base);
  return material.userData.roof ? { tile: material, ...roofTrim(material.userData.base), plain: false } : { tile: material, plain: true };
}
/**
 * Generic curved roof shell: S sides, each `seg` quads wide, `rings` quads up the slope.
 * P(s,u,t) → [x,y,z] surface point; UV(s,u,t,x,z) → [u,v] tile coords; along(s,u,x,z) → metres along the eave; inner(s,u) → [x,z] soffit inner edge.
 */
function roofShell(grp, { S, seg, rings, P, UV, along, inner, fh, set }) {
  const pos = [], uv = [], idx = [], per = seg + 1, ringN = per * S;
  for (let k = 0; k <= rings; k++) { const t = k / rings; for (let s = 0; s < S; s++) for (let i = 0; i <= seg; i++) { const u = i / seg, p = P(s, u, t), q = UV(s, u, t, p[0], p[2]); pos.push(p[0], p[1], p[2]); uv.push(q[0], q[1]); } }
  for (let k = 0; k < rings; k++) for (let s = 0; s < S; s++) for (let i = 0; i < seg; i++) { const a0 = k * ringN + s * per + i; idx.push(a0, a0 + 1, a0 + ringN + 1, a0, a0 + ringN + 1, a0 + ringN); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  g.userData.ownUV = true;
  grp.add(new THREE.Mesh(g, set.tile));
  // eave fascia (瓦当/滴水), rafter soffit, ceiling board
  const bE = new Batch(), bS = new Batch(), bB = new Batch();
  for (let s = 0; s < S; s++) for (let i = 0; i < seg; i++) {
    const u0 = i / seg, u1 = (i + 1) / seg, T0 = P(s, u0, 0), T1 = P(s, u1, 0), B0 = [T0[0], T0[1] - fh, T0[2]], B1 = [T1[0], T1[1] - fh, T1[2]];
    const a0 = along(s, u0, T0[0], T0[2]), a1 = along(s, u1, T1[0], T1[2]);
    bE.quad(B0, B1, T1, T0, null, [a0 / 0.6, 0, a1 / 0.6, 0, a1 / 0.6, 1, a0 / 0.6, 1]);
    const i0 = inner(s, u0), i1 = inner(s, u1), I0 = [i0[0], -0.02, i0[1]], I1 = [i1[0], -0.02, i1[1]];
    bS.quad(B0, I0, I1, B1, null, [a0 / 0.7, 0, a0 / 0.7, 1, a1 / 0.7, 1, a1 / 0.7, 0]);
  }
  for (let s = 0; s < S; s++) { const i0 = inner(s, 0), i1 = inner(s, 1); bB.quad([0, -0.02, 0], [i1[0], -0.02, i1[1]], [i0[0], -0.02, i0[1]], [0, -0.02, 0], [0, -1, 0]); }
  if (set.plain) { bE.addTo(grp, set.tile); bS.addTo(grp, set.tile); bB.addTo(grp, set.tile); }
  else { bE.addTo(grp, set.eave, true); bS.addTo(grp, soffitMat(), true); bB.addTo(grp, mat(C.darkWood)); }
}
/** hip ridge (垂脊/戗脊) along pts (eave → top) with upturned tip and ridge beasts */
function addHip(bR, bO, pts, rr, hi, beasts) {
  const p0 = pts[0], p1 = pts[1], a = Math.atan2(p0.x - p1.x, p0.z - p1.z), sa = Math.sin(a), ca = Math.cos(a);
  const all = [new THREE.Vector3(p0.x + sa * rr * 3.4, p0.y + rr * 2.6, p0.z + ca * rr * 3.4), new THREE.Vector3(p0.x + sa * rr * 1.9, p0.y + rr * 0.7, p0.z + ca * rr * 1.9), ...pts];
  const cv = new THREE.CatmullRomCurve3(all);
  bR.geo(new THREE.TubeGeometry(cv, hi ? 11 : 4, rr, hi ? 5 : 3, false));
  if (hi) bR.geo(new THREE.SphereGeometry(rr * 1.05, 5, 3), _m4.makeTranslation(all[0].x, all[0].y, all[0].z));
  if (!beasts) return;
  for (const t of [0.2, 0.25, 0.3, 0.35]) { const p = cv.getPoint(t); bO.box(p.x, p.y + rr * 0.6, p.z, rr * 0.7, rr * (t > 0.33 ? 2.3 : 1.5), rr * 0.9, a); }
}

/**
 * Chinese curved hip roof (庑殿 / 攒尖). Eave outline is w x d (already includes overhang), sits on y, rises h.
 * ridge = ridge length along X (0 → pyramid). curve >1 = more concave. lift = how much the corners sweep up.
 * Built-in detail: tile rows + bump, eave tile-ends, rafter soffit, four hip ridges with beasts, main ridge + 鸱吻 (chiwen: false to omit), 宝顶 on pyramids.
 * soffit = eave depth (m) if known; skirt: true for a lower "skirt" roof whose top is buried in the next storey.
 */
export function tangRoof({ w, d, h, ridge = Math.max(0, w - d), curve = 1.7, lift = h * 0.22, material, x = 0, y = 0, z = 0, ry = 0, rings = 8, seg = 8, soffit, skirt = false, chiwen = true } = {}) {
  const set = roofSet(material), grp = new THREE.Group(), big = Math.max(w, d), hi = rings > 4 && big >= 7, T = 1.2;
  if (!hi) { rings = Math.min(rings, 5); seg = Math.min(seg, 4); }
  const A = (t) => lerp(w / 2, ridge / 2, t), B = (t) => lerp(d / 2, 0.02, t), Y = (t) => h * Math.pow(t, curve);
  const corner = (s, t) => { const a = A(t), b = B(t); return s === 0 ? [-a, b] : s === 1 ? [a, b] : s === 2 ? [a, -b] : [-a, -b]; };
  const P = (s, u, t) => { const p0 = corner(s, t), p1 = corner((s + 1) % 4, t), cn = Math.pow(Math.abs(u - 0.5) * 2, 3); return [lerp(p0[0], p1[0], u), Y(t) + lift * cn * (1 - t) * (1 - t), lerp(p0[1], p1[1], u)]; };
  const slF = Math.hypot(d / 2, h), slS = Math.hypot((w - ridge) / 2, h);
  const ins = clamp(soffit ?? Math.min(w, d) * 0.2, 0.3, Math.min(w, d) / 2 - 0.05), iw = w / 2 - ins, id = d / 2 - ins;
  const icorner = (s) => (s === 0 ? [-iw, id] : s === 1 ? [iw, id] : s === 2 ? [iw, -id] : [-iw, -id]);
  const fh = clamp(big * 0.008 + 0.1, 0.12, 0.24);
  roofShell(grp, { S: 4, seg, rings, P, fh, set,
    UV: (s, u, t, px, pz) => (s % 2 ? [pz / T, t * slS / T] : [px / T, t * slF / T]),
    along: (s, u, px, pz) => (s % 2 ? pz : px),
    inner: (s, u) => { const a = icorner(s), b = icorner((s + 1) % 4); return [lerp(a[0], b[0], u), lerp(a[1], b[1], u)]; } });
  if (set.plain) return place(grp, x, y, z, ry);
  const bR = new Batch(), bO = new Batch(), bG = new Batch(), rr = clamp(big * 0.0065 + 0.07, 0.09, 0.24), n = hi ? 10 : 5, tEnd = skirt ? 0.72 : 1;
  for (let s = 0; s < 4; s++) { const pts = []; for (let k = 0; k <= n; k++) { const p = P(s, 0, k / n * tEnd); pts.push(new THREE.Vector3(p[0], p[1] + rr * 0.45, p[2])); } addHip(bR, bO, pts, rr, hi, hi && big >= 9); }
  if (!skirt) {
    if (ridge > 0.5) {
      const rh = h * 0.07 + 0.25, th = clamp(rr * 2.2, 0.3, 0.62);
      bR.box(0, h - 0.12, 0, ridge + 0.6, rh, th); bR.box(0, h - 0.12 + rh, 0, ridge + 0.75, 0.07, th + 0.12);
      if (chiwen && h >= 1.3 && !hi) { for (const sx of [1, -1]) bO.box(sx * (ridge / 2 + 0.2), h - 0.12, 0, th * 1.5, rh + Math.min(0.9, h * 0.22), th * 1.15); }
      else if (chiwen && h >= 1.3) { const cs = clamp(h * 0.24 + 0.3, 0.6, 3.0) / 3; for (const sx of [1, -1]) { _m4.compose(_v.set(sx * (ridge / 2 + 0.3 - 0.55 * cs), h - 0.12 + rh * 0.35, 0), _q.setFromEuler(_e.set(0, sx > 0 ? 0 : Math.PI, 0)), _s.set(cs, cs, Math.max(cs, th / 0.56 * 0.9))); bO.geo(chiwenGeo(), _m4); } }
    } else addFinial(bR, bG, Math.max(0.3, w * 0.03), Math.max(0.8, h * 0.22), h - 0.1);
  }
  bR.addTo(grp, set.ridge); bO.addTo(grp, set.orn); bG.addTo(grp, mat(C.gold));
  return place(grp, x, y, z, ry);
}

/** Round / polygonal curved roof (攒尖圆顶). r = eave (corner) radius, sides = 4/6/8 for polygon or 24+ for round. Polygons get hip ridges on every corner. */
export function roundRoof({ r, h, curve = 1.7, lift = h * 0.15, sides = 24, material, x = 0, y = 0, z = 0, finial = true, soffit } = {}) {
  const set = roofSet(material), grp = new THREE.Group(), S = sides, poly = S <= 12, T = 1.2, seg = poly ? (r > 6 ? 4 : 2) : 1, rings = r > 5 ? 8 : 5;
  const cdir = (i) => { const a = (i % S) * Math.PI * 2 / S; return [Math.sin(a), Math.cos(a)]; };
  const P = (s, u, t) => {
    const c0 = cdir(s), c1 = cdir(s + 1), rad = Math.max(0.02, r * (1 - t)), cn = Math.pow(Math.abs(u - 0.5) * 2, 3), q = (1 - t) * (1 - t);
    return [lerp(c0[0], c1[0], u) * rad, h * Math.pow(t, curve) + lift * q * (poly ? 0.3 + 0.7 * cn : 0.4 + 0.6 * q * q), lerp(c0[1], c1[1], u) * rad];
  };
  const ap = r * Math.cos(Math.PI / S), sl = Math.hypot(ap, h), circ = Math.max(1, Math.round(Math.PI * 2 * r / T));
  const ins = clamp(soffit ?? r * 0.22, 0.3, r - 0.05), ri = r - ins, fh = clamp(r * 0.015 + 0.1, 0.12, 0.24);
  const edir = (s) => { const c0 = cdir(s), c1 = cdir(s + 1), l = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]); return [(c1[0] - c0[0]) / l, (c1[1] - c0[1]) / l]; };
  roofShell(grp, { S, seg, rings, P, fh, set,
    UV: (s, u, t, px, pz) => { if (!poly) return [(s + u) * circ / S, t * sl / T]; const e = edir(s); return [(px * e[0] + pz * e[1]) / T, t * sl / T]; },
    along: (s, u, px, pz) => { if (!poly) return (s + u) * Math.PI * 2 * r / S; const e = edir(s); return px * e[0] + pz * e[1]; },
    inner: (s, u) => { const c0 = cdir(s), c1 = cdir(s + 1); return [lerp(c0[0], c1[0], u) * ri, lerp(c0[1], c1[1], u) * ri]; } });
  if (set.plain) return place(grp, x, y, z, 0);
  const bR = new Batch(), bO = new Batch(), bG = new Batch(), rr = clamp(r * 0.013 + 0.07, 0.09, 0.24), hi = r >= 4;
  if (poly) for (let s = 0; s < S; s++) { const pts = [], n = hi ? 10 : 5; for (let k = 0; k <= n; k++) { const p = P(s, 0, k / n * (finial ? 1 : 0.94)); pts.push(new THREE.Vector3(p[0], p[1] + rr * 0.45, p[2])); } addHip(bR, bO, pts, rr, hi, hi && r >= 6); }
  if (finial) addFinial(bR, bG, Math.max(0.3, r * 0.06), Math.max(0.8, h * 0.25) * 1.3, h - 0.1);
  bR.addTo(grp, set.ridge); bO.addTo(grp, set.orn); bG.addTo(grp, mat(C.gold));
  return place(grp, x, y, z, 0);
}

/**
 * A complete traditional Chinese hall (殿): stone platform (+ balustrade, steps), lacquered columns on stone bases, lintels with painted band,
 * bracket sets (斗拱), lattice doors / windows (glow at night), 1-3 tiers of curved tile roof with ridges and 鸱吻.
 * w = width along X, d = depth along Z, front faces +Z. Returns Group; group.userData.height = total height.
 * ornaments: false → no 鸱吻 (when the module adds its own ridge ends, e.g. 歇山 gables).
 */
export function hall({ w = 24, d = 14, wallH = 6, roofH = 5, eave = 2.4, platformH = 1.2, tiers = 1, tierShrink = 0.2,
  wall = C.wallRed, column = C.tangRed, roof = C.tileGrey, platform = C.stone, door = C.darkWood, ridge, lift, x = 0, y = 0, z = 0, ry = 0, steps = true, ornaments = true } = {}) {
  const g = new THREE.Group();
  const roofMat = roofTileMat(roof), fine = w >= 9;
  const bStone = new Batch(), bRail = new Batch(), bWall = new Batch(), bCol = new Batch(), bWood = new Batch(), bTeal = new Batch(), bLat = new Batch(), bDoor = new Batch();
  const pw = w + eave * 1.3, pd = d + eave * 1.3;
  if (platformH > 0) {
    bStone.box(0, 0, 0, pw, platformH, pd, 0, 63 - 8);
    if (platformH >= 0.45) bStone.box(0, platformH - 0.14, 0, pw + 0.22, 0.14, pd + 0.22);
    const sw = Math.min(w * 0.45, 12);
    if (steps) {
      const n = clamp(Math.round(platformH / 0.17), 3, 9), run = 2.0 / n;
      for (let i = 0; i < n; i++) bStone.box(0, 0, pd / 2 + run * (i + 0.5) + 0.05, sw, platformH * (1 - i / n), run, 0, 63 - 8 - 32);
      for (const s of [-1, 1]) bStone.box(s * (sw / 2 + 0.2), 0, pd / 2 + 1.05, 0.4, platformH * 0.55, 2.1);
    }
    if (steps && fine && platformH >= 1.0) {            // 汉白玉栏杆
      const hx = pw / 2 - 0.22, hz = pd / 2 - 0.22, y0 = platformH;
      const edge = (x0, z0, x1, z1) => {
        const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 2.1));
        for (let i = 0; i <= n; i++) { const px = x0 + (x1 - x0) * i / n, pz = z0 + (z1 - z0) * i / n; bRail.box(px, y0, pz, 0.2, 1.05, 0.2, 0, 63 - 8); bRail.box(px, y0 + 1.05, pz, 0.27, 0.14, 0.27); }
        bRail.box((x0 + x1) / 2, y0 + 0.78, (z0 + z1) / 2, Math.abs(x1 - x0) + 0.1, 0.12, Math.abs(z1 - z0) + 0.1);
        bRail.box((x0 + x1) / 2, y0 + 0.14, (z0 + z1) / 2, Math.abs(x1 - x0) + 0.07, 0.5, Math.abs(z1 - z0) + 0.07);
      };
      edge(-hx, -hz, hx, -hz); edge(-hx, -hz, -hx, hz); edge(hx, -hz, hx, hz); edge(-hx, hz, -sw / 2 - 0.3, hz); edge(sw / 2 + 0.3, hz, hx, hz);
    }
  }
  let cy = platformH, cw = w, cd = d, ch = wallH;
  for (let t = 0; t < tiers; t++) {
    const last = t === tiers - 1, cr = clamp(ch * 0.05, 0.2, 0.4), zf = cd / 2 - 0.2, xf = cw / 2 - 0.3;
    bWall.box(0, cy, 0, cw - 0.8, ch, cd - 0.8, 0, 63 - 8);
    // columns all round, on stone bases
    const nx = Math.max(2, Math.round(cw / 4)), nz = Math.max(1, Math.round(cd / 4)), cols = [];
    for (let i = 0; i <= nx; i++) for (const zz of [zf, -zf]) cols.push([-xf + i * (xf * 2) / nx, zz]);
    for (let j = 1; j < nz; j++) for (const xx of [xf, -xf]) cols.push([xx, -zf + j * (zf * 2) / nz]);
    const cg = new THREE.CylinderGeometry(cr * 0.9, cr, ch, fine ? 10 : 8, 1, true);
    for (const [cx, cz] of cols) { bCol.geo(cg, _m4.makeTranslation(cx, cy + ch / 2, cz)); if (t === 0) bStone.box(cx, cy, cz, cr * 2.7, 0.16, cr * 2.7, 0, 63 - 8); }
    // lintel (额枋, column colour) with a blue-green painted band (彩画) under it
    const ly = cy + ch - 0.56;
    bCol.box(0, ly, zf, cw - 0.3, 0.44, 0.3).box(0, ly, -zf, cw - 0.3, 0.44, 0.3).box(xf, ly, 0, 0.3, 0.44, cd - 0.2).box(-xf, ly, 0, 0.3, 0.44, cd - 0.2);
    bTeal.box(0, ly - 0.3, zf, cw - 0.5, 0.3, 0.22).box(0, ly - 0.3, -zf, cw - 0.5, 0.3, 0.22).box(xf, ly - 0.3, 0, 0.22, 0.3, cd - 0.4).box(-xf, ly - 0.3, 0, 0.22, 0.3, cd - 0.4);
    // bracket sets (斗拱): plate + two tiers of crossed arms on every column and between columns
    const by = cy + ch - 0.1, bs = clamp(eave / 2.4, 0.55, 1.3);
    bWood.box(0, by, 0, cw + 0.36, 0.13, cd + 0.16).box(0, by + 0.13, 0, cw - 0.3, 0.42, cd - 0.5, 0, 63 - 12);
    const sets = cols.slice();
    if (fine) { for (let i = 0; i < nx; i++) for (const zz of [zf, -zf]) sets.push([-xf + (i + 0.5) * (xf * 2) / nx, zz]); for (let j = 0; j < nz; j++) for (const xx of [xf, -xf]) sets.push([xx, -zf + (j + 0.5) * (zf * 2) / nz]); }
    for (const [cx, cz] of sets) {
      bWood.box(cx, by + 0.13, cz, 1.15 * bs, 0.2, 0.36 * bs).box(cx, by + 0.13, cz, 0.36 * bs, 0.2, 1.15 * bs);
      bWood.box(cx, by + 0.33, cz, 1.85 * bs, 0.22, 0.32 * bs).box(cx, by + 0.33, cz, 0.32 * bs, 0.22, 1.85 * bs);
    }
    // doors / lattice windows between the columns
    const bayW = xf * 2 / nx, pwid = bayW - cr * 2 - 0.12, zp = cd / 2 - 0.34, hh = ch - 0.9;
    for (let i = 0; i < nx; i++) {
      const cx = -xf + (i + 0.5) * bayW, mid = Math.abs(i - (nx - 1) / 2);
      if (t === 0 && mid <= (nx >= 5 ? 1 : 0.5)) {        // door bay: solid lower panels, lattice above
        bDoor.box(cx, cy + 0.04, zp, pwid, hh * 0.3, 0.1, 0, 16 + 4); bLat.box(cx, cy + 0.04 + hh * 0.3, zp, pwid, hh * 0.7, 0.07, 0, 16);
        for (const k of [-0.5, 0, 0.5]) bDoor.box(cx + k * pwid, cy + 0.04, zp + 0.03, 0.09, hh, 0.1, 0, 16 + 3);
        bDoor.box(cx, cy + 0.04 + hh * 0.3, zp + 0.03, pwid, 0.09, 0.1, 0, 16 + 12).box(cx, cy + 0.04 + hh - 0.09, zp + 0.03, pwid, 0.09, 0.1, 0, 16 + 12);
        if (mid < 0.6) bDoor.box(cx, cy + 0.04, -zp, pwid, hh, 0.1, 0, 32);   // back door
      } else {                                            // window bay: sill wall + lattice window
        const y0 = cy + (t === 0 ? hh * 0.34 : hh * 0.22), wh = (t === 0 ? hh * 0.62 : hh * 0.66);
        bLat.box(cx, y0, zp, pwid, wh, 0.07, 0, 16); bDoor.box(cx, y0 - 0.1, zp + 0.03, pwid + 0.06, 0.1, 0.14, 0, 16 + 12 + 3).box(cx, y0 + wh, zp + 0.03, pwid + 0.06, 0.09, 0.1, 0, 16 + 12);
        if (t > 0) bLat.box(cx, y0, -zp, pwid, wh, 0.07, 0, 32);
      }
    }
    if (t > 0) for (let j = 0; j < nz; j++) { const cz = -zf + (j + 0.5) * (zf * 2) / nz, sw2 = zf * 2 / nz - cr * 2 - 0.12, y0 = cy + hh * 0.22, wh = hh * 0.66; for (const sx of [1, -1]) bLat.box(sx * (cw / 2 - 0.34), y0, cz, 0.07, wh, sw2, 0, sx > 0 ? 1 : 2); }
    const rh = roofH * (last ? 1 : 0.45);
    g.add(tangRoof({ w: cw + eave * 2, d: cd + eave * 2, h: rh, ridge: last ? (ridge ?? Math.max(0, (cw - cd) * 0.9 + cd * 0.25)) : cw * 0.72, lift, material: roofMat, y: cy + ch + 0.45,
      soffit: eave + 0.15, skirt: !last, chiwen: ornaments, rings: fine ? 8 : 4, seg: fine ? 8 : 4 }));
    cy += ch + 0.45 + (last ? rh : rh * 0.55);
    cw *= (1 - tierShrink); cd *= (1 - tierShrink); ch = wallH * 0.6;
  }
  bStone.addTo(g, mat(platform, { map: patternTex('stone', platform) })); bRail.addTo(g, mat(C.marble)); bWall.addTo(g, mat(wall)); bCol.addTo(g, mat(column));
  bWood.addTo(g, mat(C.darkWood)); bTeal.addTo(g, tealMat()); bLat.addTo(g, latticeMat(door)); bDoor.addTo(g, mat(door));
  g.userData.height = cy;
  return place(g, x, y, z, ry);
}

/** Pagoda (塔): `floors` stacked storeys with tile eaves, balconies and a gold spire. sides = 4 (square), 6, 8 or 24 (round). */
export function pagoda({ floors = 7, r = 5, floorH = 4, shrink = 0.07, sides = 8, eave = 1.4, wall = C.wallCream, roof = C.tileGrey, base = 1.5, x = 0, y = 0, z = 0, finialH } = {}) {
  const g = new THREE.Group(), roofMat = roofTileMat(roof), rot = sides === 4 ? Math.PI / 4 : 0;
  const bWall = new Batch(), bWood = new Batch(), bRed = new Batch(), bDark = new Batch(), bStone = new Batch(), bG = new Batch();
  const ring = (b, rt, rb, h, yy, open = false) => b.geo(new THREE.CylinderGeometry(rt, rb, h, sides, 1, open), _m4.makeRotationY(rot).setPosition(0, yy + h / 2, 0));
  ring(bStone, r * 1.5, r * 1.6, base, 0); ring(bStone, r * 1.56, r * 1.56, 0.18, base - 0.18);
  let cy = base, cr = r;
  for (let f = 0; f < floors; f++) {
    ring(bWall, cr * 0.97, cr, floorH, cy, true);
    ring(bWood, cr * 1.02, cr * 1.02, 0.3, cy + floorH - 0.3, true); ring(bRed, cr * 1.03, cr * 1.03, 0.22, cy + floorH - 0.62, true);
    if (f > 0) { ring(bWood, cr + eave * 0.42, cr + eave * 0.3, 0.16, cy - 0.02); ring(bRed, cr + eave * 0.4, cr + eave * 0.4, 0.75, cy + 0.14, true); }
    const ap = cr * Math.cos(Math.PI / sides) * 0.985, n = sides > 12 ? 4 : sides;   // door / window niches
    for (let k = 0; k < n; k++) { const a = rot + (k + 0.5) * Math.PI * 2 / n, dw = Math.min(1.5, cr * 0.42), dh = floorH * 0.52; if ((k + f) % 2 === 0 || sides === 4) bDark.box(Math.sin(a) * ap, cy + (f ? 0.9 : 0.1), Math.cos(a) * ap, dw, dh, 0.16, a, 16 + 3 + 4); }
    const rr = roundRoof({ r: cr + eave, h: floorH * 0.38, sides, material: roofMat, y: cy + floorH, finial: false, soffit: eave + 0.1 }); rr.rotation.y = rot; g.add(rr);
    cy += floorH + floorH * 0.2; cr *= (1 - shrink); floorH *= 0.96;
  }
  const fh = finialH ?? r * 1.2, r0 = cr * 0.3;   // 塔刹
  bG.cyl(r0, r0 * 1.2, fh * 0.14, 0, cy, 0, 10, false);
  for (let i = 0; i < 5; i++) bG.cyl(r0 * (0.95 - i * 0.13), r0 * (0.95 - i * 0.13), fh * 0.05, 0, cy + fh * (0.2 + i * 0.1), 0, 10, false);
  bG.cyl(0.04, r0 * 0.3, fh * 0.86, 0, cy + fh * 0.14, 0, 8, false);
  bG.geo(new THREE.SphereGeometry(r0 * 0.42, 8, 6), _m4.makeTranslation(0, cy + fh * 0.76, 0));
  bStone.addTo(g, mat(C.stone)); bWall.addTo(g, mat(wall)); bWood.addTo(g, mat(C.darkWood)); bRed.addTo(g, mat(C.tangRed)); bDark.addTo(g, mat(0x24160f)); bG.addTo(g, mat(C.gold));
  g.userData.height = cy + fh;
  return place(g, x, y, z, 0);
}

// ───────────────────────── modern buildings ─────────────────────────
// window = [a, b] fraction of each floor height that is glass; pier = pier width as a fraction of the bay; rec = glass set-back (m)
const TOWER_STYLE = {
  office: { a: 0.24, b: 0.86, pier: 0.13, rec: 0.3 }, grid: { a: 0.2, b: 0.8, pier: 0.24, rec: 0.32 }, apartment: { a: 0.3, b: 0.84, pier: 0.26, rec: 0.3 },
  mall: { a: 0.1, b: 0.5, pier: 0.1, rec: 0.28 }, glass: { a: 0.0, b: 0.93, pier: 0, rec: 0.12 },
};
const PANE_APT = [0x34495c, 0x3a5266, 0x2c3e4e, 0x34495c, 0x4a6a88, 0xcdb99a, 0xe9e6df, 0x34495c, 0x40586c, 0x2c3e4e], PANE_OFF = [0x3d6283, 0x456d90, 0x365877, 0x31506c];
/**
 * Modern block with real facade depth: recessed reflective glass, floor spandrels, piers, mullions, per-window variation (some lit at night),
 * parapet and roof plant. style: 'office' | 'grid' | 'apartment' (bay windows + AC units) | 'mall' (ribbon windows) | 'glass' (curtain wall).
 * The envelope is exactly w x h x d (only balconies / AC units stick out ≤ 0.7 m). roof: false → no parapet / roof plant.
 */
export function tower(w, h, d, { style = 'office', wall = C.concrete, glass = C.glassDark, bay = 4, floor = 3.6, shiny = false, x = 0, y = 0, z = 0, ry = 0, roof = true } = {}) {
  const g = new THREE.Group(), S = TOWER_STYLE[style] || TOWER_STYLE.office, rec = Math.min(S.rec, w / 6, d / 6);
  const nF = Math.max(1, Math.round(h / floor)), fh = h / nF, curtain = style === 'glass';
  const wallM = mat(wall), glassM = SEM.get(glass)?.[0] === 'glass' ? mat(glass) : glassMat(glass, 0.95), frameM = curtain || style === 'office' ? darkFrame() : lightFrame();
  const bW = new Batch(), bF = new Batch(), bP = new Batch(true), bL = new Batch(), bX = new Batch(), rnd = rng(hash3(w, h, d) ^ hash3(x, y, z));
  g.add(box(w - rec * 2, h - 0.04, d - rec * 2, glassM));
  // floor spandrels: full slabs, so the corners and the roof are closed
  const a0 = !curtain && y < 0.5 && style !== 'apartment' && style !== 'mall' ? 0.06 : S.a;
  for (let f = 0; f <= nF; f++) {
    const y0 = f === 0 ? 0 : (f - 1 + S.b) * fh, y1 = f === nF ? h : (f + (f === 0 ? a0 : S.a)) * fh;
    if (y1 - y0 > 0.03) (curtain && f > 0 && f < nF ? bF : bW).box(0, y0, 0, w, y1 - y0, d);
  }
  if (curtain && y > 0.5) bF.box(0, 0, 0, w, 0.9, d, 0, 51);
  // piers / fins, panes, extras per side: [length, half-depth to the facade, axis]
  const sides = [[w, d / 2, 0, 1], [w, d / 2, 0, -1], [d, w / 2, 1, 1], [d, w / 2, 1, -1]];
  const cells = sides.reduce((s, [L]) => s + Math.max(1, Math.round(L / bay)) * nF, 0), detail = cells <= 2600, pal = style === 'apartment' ? PANE_APT : PANE_OFF;
  const cw = Math.max(rec + 0.2, curtain ? 0.16 : 0.5);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) (curtain ? bF : bW).box(sx * (w / 2 - cw / 2), 0, sz * (d / 2 - cw / 2), cw, h, cw, 0, 51);
  for (const [L, off, ax, sg] of sides) {
    const nB = Math.max(1, Math.round(L / bay)), bwid = L / nB, pwid = curtain ? 0.07 : clamp(bwid * S.pier, 0.14, 1.3), ryS = ax ? Math.PI / 2 : 0;
    const at = (t, o) => (ax ? [sg * (off - o), t] : [t, sg * (off - o)]);     // t = position along the side, o = distance inside the envelope
    for (let b = 1; b < nB; b++) { const [px, pz] = at(-L / 2 + b * bwid, rec / 2); (curtain ? bF : bW).box(px, 0, pz, pwid, h, rec + (curtain ? 0.1 : 0), ryS, 51); }
    if (style === 'office' || style === 'apartment') for (let b = 0; b < nB; b++) { const [px, pz] = at(-L / 2 + (b + 0.5) * bwid, rec - 0.05); if (style === 'apartment') { const [qx, qz] = at(-L / 2 + (b + 0.5) * bwid, rec / 2); bW.box(qx, 0, qz, pwid * 0.6, h, rec, ryS, 51); } else bF.box(px, 0, pz, 0.06, h, 0.1, ryS, 51); }
    if (!detail || curtain || style === 'mall') continue;
    const front = ax === 0, wy = (S.b - S.a) * fh;
    for (let f = 0; f < nF; f++) for (let b = 0; b < nB; b++) {
      const tc = -L / 2 + (b + 0.5) * bwid, yb = (f + S.a) * fh, r = rnd(), [px, pz] = at(tc, rec - 0.02);
      if (r < 0.1) bL.box(px, yb + 0.04, pz, bwid - pwid - 0.06, wy - 0.08, 0.02, ryS, sg > 0 ? 16 : 32);
      else { _c.setHex(pal[Math.floor(r * 97) % pal.length]); bP.col = [_c.r, _c.g, _c.b]; bP.box(px, yb + 0.04, pz, bwid - pwid - 0.06, wy - 0.08, 0.02, ryS, sg > 0 ? 16 : 32); }
      if (style !== 'apartment' || f === 0 && y < 0.5) continue;
      if (front && (b + (f >> 3)) % 3 !== 1) {              // enclosed balcony / bay window
        const [qx, qz] = at(tc, -0.3); bW.box(qx, yb - S.a * fh * 0.6, qz, bwid - pwid * 1.3, S.a * fh * 0.6 + 0.35, 0.62, ryS, 63 - 8); bX.box(qx, yb + 0.35, qz, bwid - pwid * 1.3 - 0.1, wy - 0.4, 0.56, ryS, 63 - 12); bW.box(qx, yb + wy - 0.06, qz, bwid - pwid * 1.3, 0.12, 0.66, ryS);
      } else if (r > 0.45 && r < 0.8) { const [qx, qz] = at(tc + bwid * 0.22, -0.2); bF.box(qx, yb - 0.75, qz, 0.85, 0.58, 0.36, ryS); }
    }
  }
  if (style === 'apartment' && detail) for (let f = 0; f < nF; f++) for (const sg of [1, -1]) bF.box(0, (f + S.a) * fh - 0.07, sg * (d / 2 + 0.03), w - 0.5, 0.07, 0.12);
  // roof: parapet + a little plant on slender towers
  if (roof) {
    const pt = 0.2, pi = 0.12, ph = Math.min(0.95, h * 0.2);
    for (const sg of [1, -1]) { bW.box(0, h, sg * (d / 2 - pi - pt / 2), w - pi * 2, ph, pt, 0, 63 - 8); bW.box(sg * (w / 2 - pi - pt / 2), h, 0, pt, ph, d - pi * 2, 0, 63 - 8); }
    if (h > Math.min(w, d) * 1.3 && Math.min(w, d) > 12) {
      const q = rng(hash3(w, d, h));
      for (const [sx, sz] of [[1, 1], [-1, -1], [1, -1]]) bF.box(sx * w * (0.26 + q() * 0.08), h, sz * d * (0.24 + q() * 0.08), 1.6 + q() * 1.4, 1.0 + q() * 0.6, 1.4 + q());
      if (style === 'apartment') bF.cyl(1.0, 1.0, 1.7, -w * 0.3, h + 0.4, d * 0.26, 12, false);
    }
  }
  bW.addTo(g, wallM); bF.addTo(g, frameM); bP.addTo(g, paneMat()); bL.addTo(g, litMat()); bX.addTo(g, glassM);
  g.userData = { w, h, d };
  return place(g, x, y, z, ry);
}

// ───────────────────────── signs, trees, street furniture ─────────────────────────
const cssHex = (s) => { const m = /^#?([0-9a-f]{6})$/i.exec(s || ''); return m ? parseInt(m[1], 16) : 0x808080; };
const cssLum = (s) => lum(cssHex(s));
const goldish = (s) => { const [r, , b] = lin(cssHex(s)); return r > 0.4 && b < r * 0.6; };
/** Text sign board (supports Chinese). Faces +Z. Centre at (x, y, z). opts: bg ('transparent' ok), fg, border, emissive (glows at night), vertical */
export function sign(text, w, h, { bg = '#b3261e', fg = '#ffffff', border = null, emissive = false, x = 0, y = 0, z = 0, ry = 0, vertical = false } = {}) {
  const pxH = 256, pxW = Math.min(2048, Math.max(128, Math.round(w / h * pxH)));
  const plaque = bg !== 'transparent' && cssLum(bg) < 0.2 && goldish(fg);   // dark board, bright text, framed → 匾额 in brush-style font
  const font = plaque ? '"Kaiti SC","STKaiti","KaiTi","PingFang SC",serif' : '"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif';
  const t = tex(`sign|${text}|${bg}|${fg}|${border}|${pxW}|${vertical}`, vertical ? pxH : pxW, vertical ? pxW : pxH, (g, cw, ch) => {
    if (bg !== 'transparent') {
      g.fillStyle = bg; g.fillRect(0, 0, cw, ch);
      const gr = g.createLinearGradient(0, 0, 0, ch); gr.addColorStop(0, 'rgba(255,255,255,.10)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.14)'); g.fillStyle = gr; g.fillRect(0, 0, cw, ch);
    }
    if (border) { g.strokeStyle = border; g.lineWidth = 14; g.strokeRect(7, 7, cw - 14, ch - 14); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 3; g.strokeRect(16, 16, cw - 32, ch - 32); }
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    const chars = [...text], wt = plaque ? '' : 'bold ';
    if (bg !== 'transparent') { g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 6; g.shadowOffsetY = 3; }
    if (vertical) {
      const size = Math.min(cw * 0.78, (ch * 0.92) / chars.length);
      g.font = `${wt}${size}px ${font}`;
      chars.forEach((c, i) => g.fillText(c, cw / 2, ch / 2 + (i - (chars.length - 1) / 2) * size * 1.05));
    } else {
      let size = ch * (plaque ? 0.74 : 0.7);
      g.font = `${wt}${size}px ${font}`;
      const tw = g.measureText(text).width, lim = cw * (border ? 0.86 : 0.92);
      if (tw > lim) { size *= lim / tw; g.font = `${wt}${size}px ${font}`; }
      g.fillText(text, cw / 2, ch / 2 + size * 0.04);
    }
  }, { repeat: false });
  const clear = bg === 'transparent';
  const m = std({ map: t, color: t ? 0xffffff : 0xb3261e, roughness: 0.55, metalness: 0, side: THREE.DoubleSide, transparent: clear, alphaTest: clear ? 0.08 : 0, emissive: 0xffffff, emissiveMap: t });
  if (!t) m.emissive.setHex(0x000000);
  glow(m, emissive ? 0.4 : 0, emissive ? 2.4 : 0.22);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(vertical ? h : w, vertical ? w : h), m);
  mesh.userData.keep = true; // signs are never merged (own texture)
  mesh.receiveShadow = true;
  return place(mesh, x, y, z, ry);
}

const TREE = {  // crown: centre height, radius x / y (× h), cards, card size range (× h), tint, trunk colour, trunk height
  round: { cy: 0.7, rx: 0.3, ry: 0.25, n: 42, s0: 0.27, s1: 0.17, tint: [0.92, 1.0, 0.85], trunk: 0x4d3b2c, th: 0.55 },
  plane: { cy: 0.68, rx: 0.36, ry: 0.26, n: 48, s0: 0.27, s1: 0.16, tint: [1.0, 1.08, 0.78], trunk: 0x9c9482, th: 0.5 },
  willow: { cy: 0.74, rx: 0.3, ry: 0.2, n: 26, s0: 0.26, s1: 0.14, tint: [1.12, 1.25, 0.72], trunk: 0x4d3b2c, th: 0.6 },
  pine: { cone: 0.25, n: 20, s0: 0.24, s1: 0.15, tint: [0.3, 0.43, 0.32], trunk: 0x4a3526, th: 0.3 },
  cypress: { cone: 0.13, n: 16, s0: 0.18, s1: 0.11, tint: [0.27, 0.39, 0.29], trunk: 0x4a3526, th: 0.25 },
  peonyBush: { cy: 0.38, rx: 0.5, ry: 0.3, n: 12, s0: 0.5, s1: 0.25, tint: [0.72, 0.95, 0.68], th: 0 },
};
/** Tree built from textured leaf cards (alpha-tested, casts leaf-shaped shadows). kind: 'round' | 'plane'(法桐) | 'willow' | 'pine' | 'cypress'(柏) | 'peonyBush'. ~150 triangles. */
export function tree(x = 0, z = 0, h = 8, kind = 'round', y = 0) {
  const g = new THREE.Group(), K = TREE[kind] || TREE.round, r = rng(hash3(x, z, h) + 17), p = [], nn = [], uu = [], cc = [];
  const card = (cx, cy, cz, sx, sy, ex, ey, ez, ox, oy, oz, tint) => {
    _m4.makeRotationFromEuler(_e.set(ex, ey, ez));
    let nx = cx - ox, ny = cy - oy + sy * 0.6, nz = cz - oz; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    const el = _m4.elements, flip = el[8] * nx + el[9] * ny + el[10] * nz < 0, v = 0.78 + r() * 0.44;
    const q = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([a, b]) => [cx + el[0] * a * sx + el[4] * b * sy, cy + el[1] * a * sx + el[5] * b * sy, cz + el[2] * a * sx + el[6] * b * sy, a + 0.5, b + 0.5]);
    for (const i of (flip ? [0, 2, 1, 0, 3, 2] : QI)) { p.push(q[i][0], q[i][1], q[i][2]); nn.push(nx, ny, nz); uu.push(q[i][3], q[i][4]); cc.push(tint[0] * v, tint[1] * v, tint[2] * v * 0.95); }
  };
  if (K.th) {
    const th = h * K.th, bt = new Batch();
    bt.geo(new THREE.CylinderGeometry(h * 0.018, h * 0.042, th, 6, 1, true), _m4.makeTranslation(0, th / 2, 0));
    if (!K.cone) for (let i = 0; i < 3; i++) { const a = i * 2.1 + r() * 0.8; _m4.compose(_v.set(Math.cos(a) * h * 0.07, th + h * 0.04, Math.sin(a) * h * 0.07), _q.setFromEuler(_e.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6)), _s.set(1, 1, 1)); bt.geo(new THREE.CylinderGeometry(h * 0.008, h * 0.018, h * 0.3, 5, 1, true), _m4); }
    g.add(bt.mesh(barkMat(K.trunk)));
  }
  if (K.cone) {      // conifer: solid dark cones + leaf cards hugging the surface to break up the silhouette
    const up = kind === 'cypress', bc = new Batch(), tiers = up ? 1 : 3, R0 = h * K.cone;
    for (let i = 0; i < tiers; i++) { const rr = R0 * (1 - i * 0.24), ch = up ? h * 0.84 : h * (0.44 - i * 0.03), y0 = up ? h * 0.16 : h * (0.2 + i * 0.235); bc.geo(new THREE.ConeGeometry(rr, ch, 7, 1, i > 0), _m4.makeRotationY(i * 0.7).setPosition(0, y0 + ch / 2, 0)); }
    g.add(bc.mesh(barkMat(up ? 0x2c4a31 : 0x33583a)));
    for (let i = 0; i < K.n; i++) { const t = 0.22 + 0.7 * (i + r()) / K.n, a = r() * 6.283, rad = R0 * (up ? (1 - (t - 0.16) / 0.84) : (1 - ((t - 0.2) % 0.235) / 0.44) * (1 - Math.floor((t - 0.2) / 0.235) * 0.24)) * 0.86 + h * 0.01, s = h * (K.s1 + (K.s0 - K.s1) * (1 - t)) * (0.85 + r() * 0.4);
      card(Math.cos(a) * rad, h * t, Math.sin(a) * rad, s, s * (up ? 1.5 : 1.1), 0, Math.PI / 2 - a, (r() - 0.5) * 0.7, 0, h * t - s, 0, K.tint); }
  } else {
    const oy = h * K.cy, R = h * K.rx;
    for (let i = 0; i < K.n; i++) { const a = r() * 6.283, el = (r() - 0.3) * 1.7, rad = R * Math.cbrt(0.25 + 0.75 * r()), s = h * (K.s1 + (K.s0 - K.s1) * r()) * (kind === 'peonyBush' ? 1 : 1.25);
      card(Math.cos(a) * Math.cos(el) * rad, oy + Math.sin(el) * rad * K.ry / K.rx, Math.sin(a) * Math.cos(el) * rad, s, s, r() * 3.1, r() * 6.283, r() * 3.1, 0, oy - R * 0.2, 0, K.tint); }
    if (kind === 'willow') for (let i = 0; i < 22; i++) { const a = i / 22 * 6.283 + r() * 0.3, rad = R * (0.75 + r() * 0.45), sy = h * (0.3 + r() * 0.16); card(Math.cos(a) * rad, oy - h * 0.06 - sy * 0.4, Math.sin(a) * rad, h * 0.13, sy, 0, -a + Math.PI / 2 + (r() - 0.5) * 0.8, 0, 0, oy - h, 0, [1.2, 1.32, 0.7]); }
    if (kind === 'peonyBush') { const cols = [C.peonyPink, C.peonyRed, C.peonyWhite, C.peonyPurple]; for (let i = 0; i < 5; i++) { const a = i * 1.26 + r(), m = new THREE.Mesh(new THREE.IcosahedronGeometry(h * 0.15, 0), mat(cols[i % 4])); m.position.set(Math.cos(a) * h * 0.3, h * 0.6 + (i % 2) * h * 0.1, Math.sin(a) * h * 0.3); g.add(m); } }
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); lg.setAttribute('normal', new THREE.Float32BufferAttribute(nn, 3)); lg.setAttribute('uv', new THREE.Float32BufferAttribute(uu, 2)); lg.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
  g.add(new THREE.Mesh(lg, leafMat()));
  return place(g, x, y, z, 0);
}

/** Street lamp (dark tapered pole, arm towards +X, lamp head that lights up at night). */
export function lamp(x = 0, z = 0, h = 8, y = 0) {
  const g = new THREE.Group(), b = new Batch(), k = h / 8;
  b.box(0, 0, 0, 0.42 * k, 0.5 * k, 0.42 * k, 0, 63 - 8); b.cyl(0.06 * k, 0.1 * k, h, 0, 0, 0, 8);
  b.box(0.62 * k, h - 0.16, 0, 1.45 * k, 0.09, 0.11); b.box(0.14 * k, h - 0.5 * k, 0, 0.07, 0.4 * k, 0.07, 0, 51);
  b.box(1.3 * k, h - 0.2, 0, 0.8 * k, 0.13, 0.32 * k);
  g.add(b.mesh(darkFrame()), box(0.66 * k, 0.05, 0.25 * k, lampGlow(), 1.3 * k, h - 0.25, 0));
  return place(g, x, y, z, 0);
}

/** Flag pole with a waving flag (default: red). */
export function flag(x = 0, z = 0, h = 14, color = 0xd4281c, y = 0) {
  const g = new THREE.Group(), b = new Batch();
  b.box(0, 0, 0, 0.7, 0.35, 0.7, 0, 63 - 8); b.cyl(0.05, 0.09, h, 0, 0, 0, 8);
  g.add(b.mesh(mat(C.steel)), sphere(0.13, mat(C.gold), 0, h + 0.1, 0, 8));
  const fg = new THREE.PlaneGeometry(2.4, 1.6, 8, 1), P = fg.attributes.position;
  for (let i = 0; i < P.count; i++) { const u = (P.getX(i) + 1.2) / 2.4; P.setZ(i, Math.sin(u * 5.2) * 0.13 * u); P.setY(i, P.getY(i) - u * u * 0.12); }
  fg.computeVertexNormals();
  const f = new THREE.Mesh(fg, mat(color, { double: true })); f.position.set(1.27, h - 1.0, 0); g.add(f);
  return place(g, x, y, z, 0);
}

// ───────────────────────── finalize (merge → few draw calls) ─────────────────────────
const _pq = new THREE.Quaternion(), _pp = new THREE.Vector3(), _ps = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _cc = new THREE.Vector3(), _nn = new THREE.Vector3(), _t = new THREE.Vector3(), _bb = new THREE.Vector3();
/** Box-project UVs in metres (tile = metres per texture repeat) onto a non-indexed geometry, in the un-rotated frame of the object (qInv). */
function projectUV(g, tile, qInv) {
  const P = g.attributes.position.array, n = P.length / 3, uv = new Float32Array(n * 2), k = 1 / tile, V = [_a, _b, _cc];
  for (let i = 0; i + 2 < n; i += 3) {
    for (let j = 0; j < 3; j++) { V[j].set(P[(i + j) * 3], P[(i + j) * 3 + 1], P[(i + j) * 3 + 2]); if (qInv) V[j].applyQuaternion(qInv); }
    _nn.subVectors(_b, _a).cross(_t.subVectors(_cc, _a)); const l = _nn.length();
    if (l < 1e-9 || Math.abs(_nn.y) > 0.985 * l) { for (let j = 0; j < 3; j++) { uv[(i + j) * 2] = V[j].x * k; uv[(i + j) * 2 + 1] = -V[j].z * k; } continue; }
    _nn.divideScalar(l);
    const hl = Math.hypot(_nn.x, _nn.z); _t.set(_nn.z / hl, 0, -_nn.x / hl);
    if (Math.abs(_t.x) > 0.95) _t.set(Math.sign(_t.x), 0, 0); else if (Math.abs(_t.z) > 0.95) _t.set(0, 0, Math.sign(_t.z));
    if (Math.abs(_nn.y) < 0.05) _bb.set(0, 1, 0); else _bb.crossVectors(_nn, _t).normalize();
    for (let j = 0; j < 3; j++) { uv[(i + j) * 2] = V[j].dot(_t) * k; uv[(i + j) * 2 + 1] = V[j].dot(_bb) * k; }
  }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
}
/**
 * Merge every mesh in `group` by material into a handful of meshes. ALWAYS return finalize(group) from build().
 * Objects with userData.keep = true (signs, animated parts) are left as-is. Materials with userData.tile get world-scale UVs here
 * (unless the geometry has userData.ownUV). Merged meshes cast and receive shadows.
 */
export function finalize(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map(), keep = [], rel = new THREE.Matrix4();
  const isKept = (o) => { for (let p = o; p && p !== group; p = p.parent) if (p.userData.keep) return p; return null; };
  const keptRoots = new Set();
  group.traverse(o => {
    if (!o.isMesh) return;
    const k = isKept(o);
    if (k) { keptRoots.add(k); return; }
    const m = o.material, vc = !!m.vertexColors, own = !!o.geometry.userData.ownUV;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name) && !(vc && name === 'color')) g.deleteAttribute(name);
    g.morphAttributes = {};
    if (!g.attributes.normal) g.computeVertexNormals();
    rel.multiplyMatrices(inv, o.matrixWorld);
    g.applyMatrix4(rel);
    if (m.userData.tile && !own) { rel.decompose(_pp, _pq, _ps); projectUV(g, m.userData.tile, Math.abs(_pq.w) > 0.99999 ? null : _pq.invert()); }
    else if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (vc && !g.attributes.color) g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
    if (!buckets.has(m)) buckets.set(m, []);
    buckets.get(m).push(g);
  });
  for (const k of keptRoots) { k.updateMatrixWorld(true); const mw = new THREE.Matrix4().multiplyMatrices(inv, k.matrixWorld); keep.push([k, mw]); }
  const out = new THREE.Group();
  out.userData = { ...group.userData };
  for (const [m, geos] of buckets) {
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, m);
    mesh.castShadow = !m.transparent; mesh.receiveShadow = true;
    if (m.userData.depthMat) mesh.customDepthMaterial = m.userData.depthMat;
    out.add(mesh);
  }
  for (const [k, mw] of keep) { k.removeFromParent(); mw.decompose(k.position, k.quaternion, k.scale); out.add(k); }
  return out;
}

export const kit = { THREE, C, mat, tex, windowTex, patternTex, box, tiledBox, cyl, sphere, plaza, disc, prism, gableRoof, tangRoof, roundRoof, hall, pagoda, tower, sign, tree, lamp, flag, finalize, rng };
export default kit;
