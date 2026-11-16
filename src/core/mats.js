// Shared PBR material library (v2 look). Textures live in assets/textures/<name>/{diff,nor,arm}.jpg (Poly Haven, CC0).
// Safe under Node (tools/check-landmark.mjs): without a DOM every material falls back to a flat colour.
import * as THREE from 'three';

export const HAS_DOM = typeof document !== 'undefined';
const BASE = HAS_DOM ? new URL('../../assets/textures/', import.meta.url).href : '';
const loader = HAS_DOM ? new THREE.TextureLoader() : null;
const texCache = new Map(), matCache = new Map();

// average colour of each texture set, used as the flat fallback and for far-distance tinting
export const TEX_AVG = {
  beige_wall_001: 0x9e8c78, concrete_wall_003: 0xd0bba1, red_brick_03: 0x6b564e, castle_brick_02_red: 0x84634c, concrete_floor_worn_001: 0x565654,
  cobblestone_floor_08: 0x948e82, asphalt_02: 0x5b5a55, grey_roof_tiles_02: 0x797b79, roof_09: 0x897664, aerial_grass_rock: 0x72622b,
};
/** Vertex/material colour that turns texture `name` (average colour above) into `target` (hex): linear target / linear average. */
export function tintFor(name, target, out = [0, 0, 0]) {
  const t = new THREE.Color(target), a = new THREE.Color(TEX_AVG[name] ?? 0xffffff);
  out[0] = t.r / a.r; out[1] = t.g / a.g; out[2] = t.b / a.b; return out;
}

/** One texture map of a PBR set. kind: 'diff' | 'nor' | 'arm'; channel = which uv set it reads (1 = 'uv1'). Cached; repeats; null under Node. */
export function pbrTex(name, kind, channel = 0) {
  if (!HAS_DOM) return null;
  const key = name + '/' + kind + '/' + channel; let t = texCache.get(key);
  if (!t) { t = loader.load(`${BASE}${name}/${kind}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.channel = channel; if (kind === 'diff') t.colorSpace = THREE.SRGBColorSpace; texCache.set(key, t); }
  return t;
}

/**
 * Cached MeshStandardMaterial using a PBR texture set. UVs are expected in "tiles": one UV unit = one texture repeat
 * (callers scale UVs so a repeat covers about 2–4 m). opts are passed to the material (color tints the texture).
 */
export function pbr(name, opts = {}) {
  const key = name + '|' + JSON.stringify(opts, (k, v) => (v && v.isTexture ? v.uuid : v)); let m = matCache.get(key);
  if (m) return m;
  if (!HAS_DOM) m = new THREE.MeshStandardMaterial({ color: opts.color ?? TEX_AVG[name] ?? 0xaaaaaa, roughness: 0.8, side: opts.side ?? THREE.FrontSide });
  else { const arm = pbrTex(name, 'arm'); m = new THREE.MeshStandardMaterial({ map: pbrTex(name, 'diff'), normalMap: pbrTex(name, 'nor'), roughnessMap: arm, metalnessMap: arm, aoMap: arm, metalness: 1, roughness: 1, ...opts }); }
  matCache.set(key, m); return m;
}

/** Cached untextured PBR material. */
export function flat(color, rough = 0.7, metal = 0, extra = {}) {
  const key = 'flat|' + color + '|' + rough + '|' + metal + '|' + JSON.stringify(extra, (k, v) => (v && v.isTexture ? v.uuid : v)); let m = matCache.get(key);
  if (!m) matCache.set(key, m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }));
  return m;
}

/** Canvas texture (sRGB unless data=true). Returns null under Node. */
export function canvasTex(w, h, draw, { repeat = true, data = false, aniso = 8 } = {}) {
  if (!HAS_DOM) return null;
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (!data) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Materials whose emissive glow depends on day/night: gfx.setNight() walks this list.
export const nightLights = [];
/** Register a material as a light source: emissiveIntensity = day by day, night at night. */
export function glow(material, day, night) { material.emissiveIntensity = nightState.on ? night : day; nightLights.push({ material, day, night }); return material; }
/** current day/night state (set by gfx.setNight) so lights created later — lazily loaded landmarks — start in the right state */
export const nightState = { on: false };

let _M = null;
/** Named materials shared by the city generators and the landmark kit. Created on first use. */
export function lib() {
  if (_M) return _M;
  const M = _M = {
    plaster: pbr('beige_wall_001'), plasterWarm: pbr('beige_wall_001', { color: 0xf0d9b8 }), plasterGrey: pbr('concrete_wall_003', { color: 0xe6e6e6 }),
    brick: pbr('red_brick_03'), brickDark: pbr('castle_brick_02_red'), cityBrick: pbr('castle_brick_02_red', { color: 0x9aa0a4 }),
    concrete: pbr('concrete_floor_worn_001'), stone: pbr('concrete_wall_003'), stoneLight: pbr('concrete_wall_003', { color: 0xf2efe6 }), cobble: pbr('cobblestone_floor_08'),
    asphalt: pbr('asphalt_02'), roofClay: pbr('roof_09'), roofGrey: pbr('grey_roof_tiles_02', { color: 0x9aa0a8 }), ground: pbr('aerial_grass_rock', { color: 0x98a583 }),
    glass: flat(0x1c2a36, 0.06, 0.9, { envMapIntensity: 1.3 }), glassBlue: flat(0x27445e, 0.05, 0.95, { envMapIntensity: 1.5 }),
    glassClear: flat(0x9fb8c8, 0.1, 0.6, { transparent: true, opacity: 0.45, depthWrite: false }),
    frame: flat(0xe8e8e4, 0.5), darkFrame: flat(0x2a2d31, 0.5, 0.6), white: flat(0xf2f0ea, 0.8), metal: flat(0x9aa0a6, 0.35, 0.9),
    lacquer: flat(0x8f2018, 0.38), darkWood: flat(0x3a2018, 0.6), wallWhite: flat(0xefe9dc, 0.9), wallRed: flat(0x8a2a20, 0.85), gold: flat(0xd8a62a, 0.3, 1),
    ridge: flat(0x34383d, 0.7), teal: flat(0x1f6b73, 0.5), bronze: flat(0x5a4a32, 0.45, 0.8), line: flat(0xf1f1ea, 0.6), bark: flat(0x4d3b2c, 0.95),
  };
  M.lampGlow = glow(new THREE.MeshStandardMaterial({ color: 0xfff2c8, roughness: 0.4, emissive: 0xffe2a0 }), 0.15, 6);
  return M;
}
