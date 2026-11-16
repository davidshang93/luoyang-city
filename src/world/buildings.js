// Generic city buildings (38k real footprints + heights) — v2 look.
//  • Base LOD (everything in view): per 400 m tile, one merged wall mesh + roofs. Walls use ONE material that samples a texture
//    array of facade styles (windows with their own roughness / metalness / night-light mask), so a tile costs 2–3 draw calls.
//  • Detail LOD (within ~300 m): per 200 m cell, real 3D facade parts are ADDED on top of the base walls — wall skin with window
//    openings (so the windows sit 25 cm back), sills, balconies, AC units, drainpipes, cornices, shopfronts with signs and
//    awnings, roof tanks / solar heaters / plant. Nothing is swapped, so there is no popping of the building shapes.
//  • Collision lookup (hit) is unchanged from v1.
import * as THREE from 'three';
import { Grid, hash2, pipFlat } from '../core/util.js';
import { pbr, canvasTex, glow, tintFor, TEX_AVG } from '../core/mats.js';
import { Batch, triangulate, insetPoly, polyArea } from '../gen/batch.js';

const TILE = 400, CELL = 200, PAR = 1.0, DETAIL_R = 270, DETAIL_DROP = 400;
const css = (hex) => '#' + hex.toString(16).padStart(6, '0');
const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };

// ── facade styles ── lay = layer in the facade texture array; bay/fl = nominal bay width / floor height (m);
// win = window opening inside one bay×floor cell [x0, x1, y0, y1] (0..1, y from the floor up); skin = PBR texture of the wall skin.
const ST = {
  res: { lay: 0, bay: 3.6, fl: 3.0, win: [0.13, 0.87, 0.30, 0.84], skin: 'beige_wall_001', D: 0.24, pal: [0xe6d9c0, 0xdcc9a8, 0xd9d6cf, 0xe8e2d6, 0xcbb797, 0xd8bfa0, 0xc6ccd0, 0xe3c9a6, 0xbfae98, 0xd2b48c] },
  old: { lay: 1, bay: 3.3, fl: 3.0, win: [0.20, 0.80, 0.32, 0.80], skin: 'red_brick_03', D: 0.16, pal: [0x9a5b45, 0x8a5340, 0xa5694f, 0x7d5a4a, 0x93604e, 0xa89f93] },
  office: { lay: 2, bay: 3.0, fl: 3.9, win: [0.03, 0.97, 0, 1], skin: null, D: 0.2, pal: [0xffffff, 0xd9f2ff, 0xe6fff2, 0xfff5e0, 0xc8d8e8, 0xb8c4c4] },
  com: { lay: 3, bay: 6.0, fl: 4.5, win: [0.08, 0.92, 0.42, 0.82], skin: 'concrete_wall_003', D: 0.22, pal: [0xcfc8ba, 0xb9c0c6, 0xd8d2c4, 0xa9a59c, 0xc9b9a0, 0xdadada] },
  ind: { lay: 4, bay: 6.0, fl: 6.0, win: [0.15, 0.85, 0.62, 0.86], skin: null, D: 0.1, pal: [0xc5ced6, 0xd6d3c8, 0x8fa9c4, 0xb9c2c8, 0xd9d9d4, 0x9fb0a4] },
  pub: { lay: 5, bay: 3.6, fl: 3.6, win: [0.12, 0.88, 0.28, 0.84], skin: 'concrete_wall_003', D: 0.22, pal: [0xe6e0d2, 0xd9d2c2, 0xe8e2da, 0xc9b8a0, 0xb5654f, 0xdcdcd6] },
  vil: { lay: 6, bay: 3.6, fl: 3.1, win: [0.27, 0.73, 0.34, 0.78], skin: 'beige_wall_001', D: 0.14, pal: [0xe8e4da, 0xd8c9a8, 0xcbb894, 0xc48a6a, 0xe0d6bd, 0xd9d9d2] },
};
const LAYERS = ['res', 'old', 'office', 'com', 'ind', 'pub', 'vil'];
const FLAT_ROOF = [0x8f8f8a, 0x9a9c9e, 0x70747a, 0xa3a39c, 0x7d6f66, 0x5f6a62, 0xb0aca4];
const TILE_ROOF = [0x9a5a44, 0x8a4e3c, 0x6f7376, 0x7d8388, 0xa5644c, 0x5d6a78];
const SHOPS = ['牛肉汤', '不翻汤', '洛阳水席', '烩面馆', '羊肉汤', '胡辣汤', '浆面条', '锅贴', '肉夹馍', '凉皮米线', '饺子馆', '包子铺', '兰州拉面', '黄焖鸡米饭', '麻辣烫', '串串香', '老火锅', '烧烤', '卤肉熟食', '馄饨小笼包',
  '便利店', '生活超市', '水果店', '粮油调料', '烟酒副食', '茶叶', '牡丹花茶', '牡丹饼', '蛋糕房', '奶茶', '大药房', '诊所', '口腔门诊', '眼镜店', '理发店', '美容美甲', '干洗店', '足疗按摩', '照相馆', '打印复印',
  '手机维修', '电脑数码', '家电维修', '五金日杂', '建材灯具', '窗帘布艺', '油漆涂料', '开锁配钥匙', '电动车', '汽车美容', '洗车', '轮胎修理', '快递驿站', '房产中介', '彩票站', '文具店', '新华书店', '童装', '女装', '鞋店',
  '花店', '宠物店', '宾馆', '棋牌室'];
const SIGN_BG = ['#a3201c', '#1f5c3a', '#1d4f9c', '#b3541e', '#7a1a14', '#22607a', '#3b3f45', '#8a2f55', '#c08a1a', '#5a3a8a', '#0f6a6a', '#b0271f'];

function rngOf(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/** Draw the 7 facade layers (4×4 bay×floor cells each) → { map, pbr } DataArrayTextures. pbr: R = night-light mask, G = roughness, B = metalness. */
function facadeTextures() {
  const S = 512, C = 128, N = LAYERS.length, col = new Uint8Array(S * S * 4 * N), prm = new Uint8Array(S * S * 4 * N);
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c.getContext('2d', { willReadFrequently: true }); };
  const g = mk(), q = mk();                        // g = colour, q = pbr params
  const P = (lit, rough, metal) => `rgb(${lit ? 255 : 0},${Math.round(rough * 255)},${Math.round(metal * 255)})`;
  const GLASS = ['#4a5560', '#434e5a', '#525d66', '#3d4852', '#59626a'], CURT = ['#cdb99a', '#e9e6df', '#b9c4cc', '#d8c8b0', '#a8b4a0', '#e4d2c0'];
  LAYERS.forEach((name, li) => {
    const st = ST[name], rnd = rngOf(77 + li * 31), wall = st.skin ? css(TEX_AVG[st.skin]) : name === 'ind' ? '#ffffff' : '#30343a';
    g.fillStyle = wall; g.fillRect(0, 0, S, S); q.fillStyle = P(0, name === 'ind' ? 0.55 : 0.92, name === 'ind' ? 0.35 : 0); q.fillRect(0, 0, S, S);
    // wall weathering: faint vertical streaks and blotches (kept subtle — the PBR skin takes over up close)
    for (let k = 0; k < 260; k++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${0.02 + rnd() * 0.035})`; const w = 2 + rnd() * 10; g.fillRect(rnd() * S, rnd() * S, w, 20 + rnd() * 120); }
    if (name === 'ind') { for (let x = 0; x < S; x += 8) { g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(x, 0, 2, S); g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x + 4, 0, 2, S); } }
    if (name === 'old') { g.fillStyle = 'rgba(0,0,0,0.10)'; for (let y = 0; y < S; y += 5) g.fillRect(0, y, S, 1); }
    if (name === 'com') { g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 1; for (let k = 0; k <= 8; k++) { g.beginPath(); g.moveTo(k * 64, 0); g.lineTo(k * 64, S); g.moveTo(0, k * 64 + 20); g.lineTo(S, k * 64 + 20); g.stroke(); } }
    for (let cy = 0; cy < 4; cy++) for (let cx = 0; cx < 4; cx++) {
      const X = cx * C, Y = cy * C, [a, b, c0, c1] = st.win, x0 = X + a * C, w = (b - a) * C, y0 = Y + c0 * C, h = (c1 - c0) * C;   // canvas y = up (row 0 of the data is v = 0)
      const r = rnd(), lit = rnd() < (name === 'office' ? 0.34 : name === 'ind' ? 0.1 : 0.3);
      if (name === 'ind' && (cx + cy) % 2) continue;                           // sheds: windows only in some bays
      if (name === 'office') {                                                 // curtain wall: spandrel + vision glass + mullions
        g.fillStyle = ['#46586a', '#4c6074', '#405264', '#506274'][Math.floor(r * 4)]; g.fillRect(X, Y, C, C); q.fillStyle = P(lit, 0.07, 0.9); q.fillRect(X, Y, C, C);
        g.fillStyle = '#39485a'; g.fillRect(X, Y, C, C * 0.2); q.fillStyle = P(0, 0.2, 0.8); q.fillRect(X, Y, C, C * 0.2);
        if (r > 0.72) { g.fillStyle = 'rgba(230,230,220,0.35)'; g.fillRect(X + 4, Y + C * 0.55, C - 8, C * 0.45); }    // blinds
        g.fillStyle = '#23282e'; g.fillRect(X, Y, 3, C); g.fillRect(X + C - 3, Y, 3, C); g.fillRect(X, Y, C, 3); g.fillRect(X + C / 2 - 1, Y + C * 0.2, 2, C * 0.8);
        q.fillStyle = P(0, 0.5, 0.6); q.fillRect(X, Y, 3, C); q.fillRect(X + C - 3, Y, 3, C); q.fillRect(X, Y, C, 3);
        continue;
      }
      const frame = name === 'old' ? ['#e4e0d4', '#6f8a78', '#8a6a4a'][Math.floor(r * 3)] : name === 'com' ? '#2c3036' : '#ecece6';
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x0 - 2, y0 + h, w + 4, 3);                 // shadow under the lintel
      g.fillStyle = frame; g.fillRect(x0, y0, w, h); q.fillStyle = P(0, 0.5, 0.1); q.fillRect(x0, y0, w, h);
      const curtain = r > 0.52 && name !== 'com' && name !== 'ind', pane = (px, pw) => {
        const gy = y0 + 3, gh = h - 6;
        g.fillStyle = GLASS[Math.floor(rnd() * GLASS.length)]; g.fillRect(px, gy, pw, gh); q.fillStyle = P(lit, 0.08, 0.8); q.fillRect(px, gy, pw, gh);
        if (curtain && rnd() < 0.8) { const cw = pw * (0.3 + rnd() * 0.7); g.fillStyle = CURT[Math.floor(rnd() * CURT.length)]; g.fillRect(rnd() < 0.5 ? px : px + pw - cw, gy, cw, gh); q.fillStyle = P(lit, 0.45, 0.25); q.fillRect(px, gy, pw, gh); }
        const gr = g.createLinearGradient(0, gy, 0, gy + gh); gr.addColorStop(0, 'rgba(0,0,0,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0.10)'); g.fillStyle = gr; g.fillRect(px, gy, pw, gh);
      };
      const panes = name === 'com' ? 4 : w > 70 ? 3 : 2, pw = (w - 3 * (panes + 1)) / panes;
      for (let k = 0; k < panes; k++) pane(x0 + 3 + k * (pw + 3), pw);
      if (name !== 'com' && name !== 'ind') { g.fillStyle = frame; g.fillRect(x0, y0 + h * 0.68, w, 2); }   // transom bar
    }
    col.set(g.getImageData(0, 0, S, S).data, li * S * S * 4); prm.set(q.getImageData(0, 0, S, S).data, li * S * S * 4);
  });
  const arr = (data, srgb) => { const t = new THREE.DataArrayTexture(data, S, S, N); t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.anisotropy = 8; t.needsUpdate = true; return t; };
  return { map: arr(col, true), pbr: arr(prm, false) };
}

// "Interior mapping": every bay × floor cell of a facade is a little room box behind the glass. A ray from the eye through the
// window pane is intersected with that box in the fragment shader, so the rooms have real parallax without any geometry.
// Rooms differ by a hash of their cell: wall colour, a door, a cabinet or sofa, curtains; at night some are lit with a ceiling lamp.
const INTERIOR_GLSL = /* glsl */`
float ihash( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
vec3 interiorRoom( vec2 uvCell, vec3 rd, float layer, float salt, float lit, float night ) {
	vec2 id = floor( uvCell ), cp = fract( uvCell );
	// nominal room size in metres: bay width, floor height, depth ( offices and shops are deeper )
	vec3 size = layer < 0.5 ? vec3( 3.6, 3.0, 4.2 ) : layer < 1.5 ? vec3( 3.3, 3.0, 3.8 ) : layer < 2.5 ? vec3( 3.0, 3.9, 9.0 ) : layer < 3.5 ? vec3( 6.0, 4.5, 9.0 ) : layer < 4.5 ? vec3( 6.0, 6.0, 12.0 ) : vec3( 3.6, 3.4, 5.0 );
	float h1 = ihash( id + salt ), h2 = ihash( id * 1.7 + salt + 3.1 ), h3 = ihash( id.yx + salt * 0.37 + 9.2 );
	vec3 d = rd / size; d /= max( d.z, 1e-4 );                                  // cell units, d.z = 1 reaches the back wall
	float tx = d.x > 0.0 ? ( 1.0 - cp.x ) / d.x : ( d.x < 0.0 ? - cp.x / d.x : 1e5 );
	float ty = d.y > 0.0 ? ( 1.0 - cp.y ) / d.y : ( d.y < 0.0 ? - cp.y / d.y : 1e5 );
	float t = min( min( tx, ty ), 1.0 );
	vec3 hit = vec3( cp + d.xy * t, t );
	vec3 wallCol = h1 < 0.3 ? vec3( 0.86, 0.82, 0.72 ) : h1 < 0.55 ? vec3( 0.9, 0.9, 0.86 ) : h1 < 0.75 ? vec3( 0.72, 0.8, 0.74 ) : h1 < 0.9 ? vec3( 0.74, 0.8, 0.86 ) : vec3( 0.86, 0.74, 0.66 );
	bool office = layer > 1.5 && layer < 4.5;
	vec3 col;
	if ( t >= 1.0 ) {                                                           // back wall: door, cabinet, picture
		col = wallCol;
		float dx = 0.12 + 0.55 * h2;
		if ( ! office && hit.x > dx && hit.x < dx + 0.26 && hit.y < 0.7 ) col = vec3( 0.42, 0.29, 0.18 ) * ( hit.x < dx + 0.02 || hit.x > dx + 0.24 || hit.y > 0.67 ? 0.6 : 1.0 );
		float px = fract( dx + 0.45 );
		if ( hit.x > px && hit.x < px + 0.2 && hit.y > 0.42 && hit.y < 0.62 && px < 0.78 ) col = mix( vec3( 0.25, 0.3, 0.36 ), vec3( 0.7, 0.5, 0.3 ), h3 );
		if ( office && fract( hit.x * 3.0 ) < 0.9 && hit.y < 0.36 ) col = vec3( 0.36, 0.38, 0.42 );       // desks / partitions
	} else if ( tx < ty ) {                                                     // side walls
		col = wallCol * 0.86;
		if ( ! office && hit.y < 0.3 && hit.z > 0.35 && hit.z < 0.9 && h2 > 0.4 ) col = mix( vec3( 0.5, 0.2, 0.16 ), vec3( 0.2, 0.3, 0.42 ), h3 );   // sofa / bed
	} else if ( d.y < 0.0 ) col = mix( vec3( 0.4, 0.28, 0.18 ), vec3( 0.55, 0.53, 0.5 ), step( 0.6, h3 ) ) * ( 0.8 + 0.2 * step( 0.5, fract( hit.x * 6.0 ) ) );   // floor
	else {                                                                      // ceiling with its lamp
		col = vec3( 0.9, 0.9, 0.87 );
		float lamp = office ? step( 0.82, fract( hit.z * 3.0 ) ) : 1.0 - smoothstep( 0.05, 0.12, length( ( hit.xz - vec2( 0.5, 0.5 ) ) * vec2( 1.0, 1.3 ) ) );
		col += lamp * mix( 0.25, 4.0, lit * night );
	}
	float corner = min( min( hit.x, 1.0 - hit.x ), min( hit.y, 1.0 - hit.y ) );
	col *= 0.62 + 0.38 * smoothstep( 0.0, 0.14, corner + ( 1.0 - hit.z ) * 0.1 );          // darker in the corners
	float day = 0.07 + 0.55 * exp( - hit.z * 2.4 ) * ( 0.5 + 0.5 * hit.y );                 // daylight falls off away from the window
	vec3 lamplight = mix( vec3( 1.25, 0.98, 0.66 ), vec3( 1.1, 1.12, 1.15 ), float( office ) * 0.8 + step( 0.85, h3 ) * 0.5 ) * ( 0.75 + 0.5 * hit.y );
	vec3 light = mix( vec3( day ), lit * lamplight * 0.6 + 0.004, night );
	col *= light;
	// curtains just behind the glass ( homes only ): drawn from one or both sides
	if ( ! office && h2 > 0.35 ) {
		float w = 0.12 + 0.3 * h1, cx = h3 < 0.5 ? cp.x : min( cp.x, 1.0 - cp.x );
		if ( cx < w ) { vec3 cc = h3 < 0.33 ? vec3( 0.86, 0.84, 0.78 ) : h1 < 0.5 ? vec3( 0.62, 0.5, 0.4 ) : vec3( 0.5, 0.58, 0.62 ); col = cc * ( 0.82 + 0.18 * sin( cx * 150.0 ) ) * mix( vec3( 0.42 ), lit * lamplight * 0.5 + 0.006, night ); }
	}
	return col;
}`;

function signAtlas() {
  return canvasTex(2048, 2048, (g) => {
    SHOPS.forEach((name, i) => {
      const x = (i % 4) * 512, y = Math.floor(i / 4) * 128, bg = SIGN_BG[(i * 7) % SIGN_BG.length], light = i % 5 === 3;
      g.fillStyle = light ? '#f1ede2' : bg; g.fillRect(x, y, 512, 128); g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(x, y, 512, 12); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, y + 120, 512, 8);
      g.fillStyle = light ? bg : (i % 3 === 1 ? '#ffe9a8' : '#ffffff'); g.textAlign = 'center'; g.textBaseline = 'middle';
      let fs = 84; g.font = `bold ${fs}px "PingFang SC","Microsoft YaHei",sans-serif`; while (g.measureText(name).width > 470 && fs > 30) { fs -= 6; g.font = `bold ${fs}px "PingFang SC","Microsoft YaHei",sans-serif`; }
      g.fillText(name, x + 256, y + 68);
    });
  }, { repeat: false });
}

export class Buildings {
  /** specs: optional hand-written facade descriptions (src/data/facade-specs.json), matched to buildings by a point inside the footprint */
  constructor(scene, data, roads, specs) {
    this.data = data; this.scene = scene; this.roads = null; this.spec = new Map();
    this.group = new THREE.Group(); this.group.name = 'buildings'; scene.add(this.group);
    this.tiles = new Map(); this.cells = new Map();
    this.grid = new Grid(80);         // collision: building index by bbox
    this.bbox = new Float32Array(data.length * 4);
    data.forEach((b, i) => {
      const p = b[2]; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (let k = 0; k < p.length; k += 2) { x0 = Math.min(x0, p[k]); x1 = Math.max(x1, p[k]); z0 = Math.min(z0, p[k + 1]); z1 = Math.max(z1, p[k + 1]); }
      this.bbox.set([x0, x1, z0, z1], i * 4);
      this.grid.addBox(x0, z0, x1, z1, i);
      const tx = Math.floor(p[0] / TILE), tz = Math.floor(p[1] / TILE), key = tx + ',' + tz;
      let t = this.tiles.get(key); if (!t) this.tiles.set(key, t = { idx: [], mesh: null, cx: (tx + 0.5) * TILE, cz: (tz + 0.5) * TILE });
      t.idx.push(i);
      const cx = Math.floor(p[0] / CELL), cz = Math.floor(p[1] / CELL), ck = cx + ',' + cz;
      let c = this.cells.get(ck); if (!c) this.cells.set(ck, c = { idx: [], obj: null, cx: (cx + 0.5) * CELL, cz: (cz + 0.5) * CELL });
      c.idx.push(i);
    });
    for (const sp of (specs && specs.specs) || []) { const a = this.grid.at(sp.at[0], sp.at[1]); if (a) for (const i of a) if (pipFlat(sp.at[0], sp.at[1], data[i][2])) { this.spec.set(i, sp); break; } }
    this.loaded = 0; this.detailCount = 0;
    this._materials();
  }

  _materials() {
    const ft = facadeTextures(), white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); white.needsUpdate = true; white.colorSpace = THREE.SRGBColorSpace;
    const wall = this.matWall = new THREE.MeshStandardMaterial({ vertexColors: true, map: white, roughness: 1, metalness: 1, emissive: 0xffd9a0, envMapIntensity: 1.15 });
    wall.onBeforeCompile = (sh) => {
      sh.uniforms.facadeMap = { value: ft.map }; sh.uniforms.facadePbr = { value: ft.pbr };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float layer;\nvarying float vLayer;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLayer = layer;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform highp sampler2DArray facadeMap;\nuniform highp sampler2DArray facadePbr;\nvarying float vLayer;\n' + INTERIOR_GLSL)
        // glassK: 1 on window glass close to the camera (there the flat painted pane is replaced by a mirror-like pane with a room behind it)
        .replace('#include <map_fragment>', '#include <map_fragment>\nfloat fLay = floor( vLayer + 0.5 );\nvec4 fcol = texture( facadeMap, vec3( vMapUv, fLay ) );\nvec4 fpbr = texture( facadePbr, vec3( vMapUv, fLay ) );\nfloat glassK = ( 1.0 - smoothstep( 0.10, 0.16, fpbr.g ) ) * ( 1.0 - smoothstep( 120.0, 190.0, length( vViewPosition ) ) );\ndiffuseColor.rgb = mix( diffuseColor.rgb * fcol.rgb, vec3( 0.065, 0.075, 0.085 ), glassK );')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix( roughnessFactor * fpbr.g, 0.1, glassK );')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix( metalnessFactor * fpbr.b, 1.0, glassK );')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float nightK = totalEmissiveRadiance.r;                       // emissive is ( 1, .85, .63 ) × 0 by day, × 1.5 at night
totalEmissiveRadiance *= fpbr.r * fcol.rgb * 2.5;             // far away: lit windows are flat glowing panes
if ( glassK > 0.01 ) {
	vec3 wRay = ( vec4( - vViewPosition, 0.0 ) * viewMatrix ).xyz;            // world space, camera → fragment
	vec3 wN = normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
	vec3 wT = normalize( cross( wN, vec3( 0.0, 1.0, 0.0 ) ) );                 // along +u
	vec3 rd = vec3( dot( wRay, wT ), wRay.y, - dot( wRay, wN ) );             // tangent space, z into the building
	vec3 wPos = cameraPosition + wRay;
	vec3 room = interiorRoom( vMapUv * 4.0, rd, fLay, floor( wPos.x * 0.031 ) + 7.0 * floor( wPos.z * 0.031 ), step( 0.5, fpbr.r ), min( nightK, 1.0 ) );
	totalEmissiveRadiance = mix( totalEmissiveRadiance, room * 0.93, glassK );
}`);
    };
    wall.customProgramCacheKey = () => 'facade-interior-1';
    glow(wall, 0, 1.5);
    this.matRoof = pbr('concrete_floor_worn_001', { vertexColors: true });
    this.matTile = pbr('roof_09', { vertexColors: true, side: THREE.DoubleSide });
    // wall skins: the shared PBR sets plus weathering — rain streaks running down, large blotches and a dirty band above the ground
    const grimy = (m) => { m = m.clone(); m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nfloat gHash( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }\nfloat gNoise( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f ); return mix( mix( gHash( i ), gHash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( gHash( i + vec2( 0.0, 1.0 ) ), gHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y ); }')
        .replace('#include <color_fragment>', '#include <color_fragment>\n{ vec3 gW = cameraPosition + ( vec4( - vViewPosition, 0.0 ) * viewMatrix ).xyz; float gA = gW.x * 0.71 + gW.z * 0.71, gB = gW.x * 0.71 - gW.z * 0.71;\nfloat gS = gNoise( vec2( gA * 2.3, gW.y * 0.09 ) ) * gNoise( vec2( gB * 2.3, gW.y * 0.07 + 5.0 ) ), gL = gNoise( vec2( gA + gB, gW.y ) * 0.16 );\ndiffuseColor.rgb *= ( 1.0 - 0.5 * smoothstep( 0.22, 0.75, gS ) ) * ( 0.84 + 0.3 * gL ) * mix( 0.72, 1.0, smoothstep( 0.1, 1.5 + gL, gW.y ) ); }'); };
      m.customProgramCacheKey = () => 'grimy'; return m; };
    this.skin = { beige_wall_001: grimy(pbr('beige_wall_001', { vertexColors: true })), red_brick_03: grimy(pbr('red_brick_03', { vertexColors: true })), concrete_wall_003: grimy(pbr('concrete_wall_003', { vertexColors: true })) };
    // steel bars (security cages, balcony rails, drying racks): alpha-tested grid, one repeat = 0.6 m
    this.matGrille = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.6, alphaTest: 0.5, side: THREE.DoubleSide,
      map: canvasTex(64, 64, (g) => { g.clearRect(0, 0, 64, 64); g.fillStyle = '#fff'; for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 3, 64); g.fillRect(0, 0, 64, 4); g.fillRect(0, 30, 64, 3); }) });
    this.matTrim = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.05 });
    this.matGlass = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.85, envMapIntensity: 1.0 });
    const atlas = signAtlas();
    this.matSign = glow(new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.5, emissive: 0xffffff, emissiveMap: atlas }), 0.12, 1.4);
  }

  /** Deterministic description of building i: volumes (podium / tower / setback), style, colours. */
  plan(i) {
    const [h, type, p] = this.data[i], n = p.length / 2, r = hash2(p[0], p[1]), r2 = hash2(p[1], p[0]), r3 = hash2(p[0] + 7.3, p[1] - 3.1), area = polyArea(p);
    let sk;
    if (type === 0) sk = h < 10 ? (r < 0.65 ? 'vil' : 'old') : (r < 0.42 ? 'old' : 'res');
    else if (type === 1) sk = h > 30 ? 'res' : (r < 0.66 ? 'res' : 'old');
    else if (type === 2) sk = h > 24 ? (r < 0.62 ? 'office' : 'com') : 'com';
    else if (type === 3) sk = 'ind'; else sk = 'pub';
    const ov = this.spec.get(i) || {}; if (ST[ov.sk]) sk = ov.sk;                         // hand-written facade description wins over the rules
    const st = ST[sk], target = ov.wall !== undefined ? +ov.wall : st.pal[Math.floor(r2 * st.pal.length)], k = ov.wall !== undefined ? 0.9 : 0.8 + r3 * 0.12;
    const tint = st.skin ? tintFor(st.skin, target) : lin(target); tint[0] *= k; tint[1] *= k; tint[2] *= k;
    const quad = n === 4, e0 = Math.hypot(p[2] - p[0], p[3] - p[1]), e1 = n > 2 ? Math.hypot(p[4] - p[2], p[5] - p[3]) : 0, shortSide = Math.min(e0, e1);
    // roofs: pitched on small rectangular low blocks, low gable on sheds, flat otherwise
    let roof = 'flat';
    if (quad && shortSide > 4 && shortSide < 22) { if ((sk === 'vil' && r3 < 0.7) || (sk === 'old' && h < 24 && r3 < 0.5)) roof = 'hip'; else if (sk === 'ind' && shortSide < 40 && r3 < 0.75) roof = 'shed'; }
    if (sk === 'ind' && quad && shortSide >= 22 && shortSide < 60 && r3 < 0.75) roof = 'shed';
    const vols = [];
    if (quad && (type === 1 || type === 2) && h >= 45 && area >= 700 && shortSide > 22 && r3 < 0.6) {          // podium + tower
      const ph = sk === 'office' ? 13.5 : 9, podSt = ST.com, pt = podSt.pal[Math.floor(r * podSt.pal.length)];
      vols.push({ p, y0: 0, y1: ph, st: podSt, sk: 'com', tint: tintFor(podSt.skin, pt), roof: 'flat', pod: true });
      vols.push({ p: insetPoly(p, 3 + r * 3.5), y0: ph, y1: h, st, sk, tint, roof: 'flat' });
    } else if (quad && sk === 'res' && h >= 48 && shortSide > 13 && r3 > 0.62) {                                // penthouse setback
      const top = h - st.fl * 2;
      vols.push({ p, y0: 0, y1: top, st, sk, tint, roof: 'flat', terrace: true });
      vols.push({ p: insetPoly(p, 2.4), y0: top, y1: h, st, sk, tint, roof: 'flat' });
    } else vols.push({ p, y0: 0, y1: h, st, sk, tint, roof });
    return { vols, sk, st, tint, r, r2, r3, area, type, h, ov, roofCol: lin(FLAT_ROOF[Math.floor(r * FLAT_ROOF.length)]), tileCol: tintFor('roof_09', TILE_ROOF[Math.floor(r2 * TILE_ROOF.length)]), uoff: Math.floor(r3 * 4) };
  }

  // ── base LOD ──
  _build(tile) {
    const W = new Batch(true), R = new Batch(), T = new Batch();
    const roofAvg = lin(TEX_AVG.concrete_floor_worn_001);
    for (const i of tile.idx) {
      const pl = this.plan(i);
      for (const v of pl.vols) {
        const p = v.p, n = p.length / 2, st = v.st, H = v.y1 - v.y0, nf = Math.max(1, Math.round(H / st.fl)), [tr, tg, tb] = v.tint, pitched = v.roof === 'hip' || v.roof === 'shed';
        const top = v.y1 + (pitched ? 0 : PAR);
        const wallOnRoof = st.skin || v.sk === 'ind' ? lin(st.pal[Math.floor(pl.r2 * st.pal.length)]) : lin(0x3a4048), wr = wallOnRoof[0] / roofAvg[0], wg = wallOnRoof[1] / roofAvg[1], wb = wallOnRoof[2] / roofAvg[2];
        let u = pl.uoff;
        for (let a = 0; a < n; a++) {
          const b = (a + 1) % n, ax = p[a * 2], az = p[a * 2 + 1], bx = p[b * 2], bz = p[b * 2 + 1], L = Math.hypot(bx - ax, bz - az); if (L < 0.2) continue;
          const nb = Math.max(1, Math.round(L / st.bay)), nx = (bz - az) / L, nz = -(bx - ax) / L, u0 = u / 4, u1 = (u + nb) / 4; u += nb;
          W.quad(bx, v.y0, bz, ax, v.y0, az, ax, v.y1, az, bx, v.y1, bz, nx, 0, nz, tr, tg, tb, u1, pl.uoff / 4, u0, (pl.uoff + nf) / 4, st.lay);
          if (!pitched) R.quad(bx, v.y1, bz, ax, v.y1, az, ax, top, az, bx, top, bz, nx, 0, nz, wr, wg, wb, 0, 0, L / 3, 0.33); // parapet outside (plain wall)
        }
        if (pitched) this._pitched(v, pl, T, R, wr, wg, wb);
        else {
          const q = insetPoly(p, 0.3), [rr, rg, rb] = pl.roofCol, cr = rr / roofAvg[0], cg = rg / roofAvg[1], cb = rb / roofAvg[2];
          for (let a = 0; a < n; a++) {
            const b = (a + 1) % n;
            R.quad(p[a * 2], top, p[a * 2 + 1], p[b * 2], top, p[b * 2 + 1], q[b * 2], top, q[b * 2 + 1], q[a * 2], top, q[a * 2 + 1], 0, 1, 0, wr * 1.05, wg * 1.05, wb * 1.05, 0, 0, 1, 0.1);     // parapet cap
            const L = Math.hypot(q[b * 2] - q[a * 2], q[b * 2 + 1] - q[a * 2 + 1]) || 1, inx = -(q[b * 2 + 1] - q[a * 2 + 1]) / L, inz = (q[b * 2] - q[a * 2]) / L;
            R.quad(q[a * 2], v.y1, q[a * 2 + 1], q[b * 2], v.y1, q[b * 2 + 1], q[b * 2], top, q[b * 2 + 1], q[a * 2], top, q[a * 2 + 1], inx, 0, inz, wr * 0.85, wg * 0.85, wb * 0.85, 0, 0, L / 3, 0.33); // parapet inside
          }
          R.poly(q, triangulate(q), v.y1, cr, cg, cb, 3);
          // stair / lift bulkhead so the skyline is not a row of flat lids
          if (!v.pod && !v.terrace && pl.area > 160 && n <= 8) {
            let cx = 0, cz = 0; for (let k = 0; k < n; k++) { cx += p[k * 2]; cz += p[k * 2 + 1]; } cx /= n; cz /= n;
            const ex = p[2] - p[0], ez = p[3] - p[1], el = Math.hypot(ex, ez) || 1, ux = ex / el, uz = ez / el, bw = Math.min(7, el * 0.3), bd = Math.min(4.5, Math.sqrt(pl.area) * 0.25), bh = pl.h > 40 ? 4.6 : 3.1;
            const ox = cx + ux * (pl.r - 0.5) * el * 0.35, oz = cz + uz * (pl.r - 0.5) * el * 0.35;
            if (pipFlat(ox, oz, p)) { R.ebox(ox, oz, ux, uz, -bw / 2, bw / 2, -bd / 2, bd / 2, v.y1, v.y1 + bh, wr * 0.95, wg * 0.95, wb * 0.95, 31, 3); R.ebox(ox, oz, ux, uz, -bw / 2 - 0.25, bw / 2 + 0.25, -bd / 2 - 0.25, bd / 2 + 0.25, v.y1 + bh, v.y1 + bh + 0.2, wr * 1.1, wg * 1.1, wb * 1.1, 63, 3); }
          }
        }
      }
    }
    const g = new THREE.Group(); g.matrixAutoUpdate = false;
    for (const m of [W.mesh(this.matWall), R.mesh(this.matRoof), T.mesh(this.matTile)]) if (m) g.add(m);
    return g;
  }

  /** hip / low gable roof over a 4-corner footprint: T = tiled faces, R = wall-coloured gable ends */
  _pitched(v, pl, T, R, wr, wg, wb) {
    const p = insetPoly(v.p, -0.45), y = v.y1, P = (k) => [p[k * 2], p[k * 2 + 1]];
    let q = [P(0), P(1), P(2), P(3)];
    if (Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]) < Math.hypot(q[2][0] - q[1][0], q[2][1] - q[1][1])) q = [q[1], q[2], q[3], q[0]];   // make edge 0→1 the long side
    const long = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]), short = Math.hypot(q[2][0] - q[1][0], q[2][1] - q[1][1]);
    const shed = v.roof === 'shed', rh = shed ? Math.max(1.2, short * 0.11) : Math.min(6, Math.max(1.6, short * 0.3)), k = shed ? 0 : Math.min(0.45, short * 0.5 / long);
    const ma = [(q[3][0] + q[0][0]) / 2, (q[3][1] + q[0][1]) / 2], mb = [(q[1][0] + q[2][0]) / 2, (q[1][1] + q[2][1]) / 2];
    const ra = [ma[0] + (mb[0] - ma[0]) * k, ma[1] + (mb[1] - ma[1]) * k], rb = [mb[0] + (ma[0] - mb[0]) * k, mb[1] + (ma[1] - mb[1]) * k];
    const [cr, cg, cb] = shed ? tintFor('roof_09', [0x6f8fb0, 0x8a9096, 0x9aa7ad, 0x5f86b5][Math.floor(pl.r * 4)]) : pl.tileCol;
    const face = (pts) => {                                             // pts: [x, y, z] × 3 or 4, any winding → made to face up
      const [A, B, C] = pts; let nx = (B[1] - A[1]) * (C[2] - A[2]) - (B[2] - A[2]) * (C[1] - A[1]), ny = (B[2] - A[2]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[2] - A[2]), nz = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
      const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L; if (ny < 0) { pts.reverse(); nx = -nx; ny = -ny; nz = -nz; }
      const [a, b, c, d] = pts, sl = Math.hypot(short / 2, rh) / 1.1, ul = long / 1.1;
      if (d) T.quad(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2], nx, ny, nz, cr, cg, cb, 0, 0, ul, sl);
      else { const o = T.v; T.p.push(...a, ...b, ...c); T.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz); T.c.push(cr, cg, cb, cr, cg, cb, cr, cg, cb); T.u.push(0, 0, short / 1.1, 0, short / 2.2, sl); T.i.push(o, o + 1, o + 2); T.v += 3; }
    };
    const E = (pt) => [pt[0], y, pt[1]], RA = [ra[0], y + rh, ra[1]], RB = [rb[0], y + rh, rb[1]];
    face([E(q[0]), E(q[1]), RB, RA]); face([E(q[2]), E(q[3]), RA, RB]);
    if (k > 0) { face([E(q[1]), E(q[2]), RB]); face([E(q[3]), E(q[0]), RA]); }
    else { R.tri(...E(q[1]), ...E(q[2]), ...RB, wr, wg, wb); R.tri(...E(q[2]), ...E(q[1]), ...RB, wr, wg, wb); R.tri(...E(q[3]), ...E(q[0]), ...RA, wr, wg, wb); R.tri(...E(q[0]), ...E(q[3]), ...RA, wr, wg, wb); }
  }

  // ── detail LOD ──
  _detail(cell) {
    const B = { beige_wall_001: new Batch(), red_brick_03: new Batch(), concrete_wall_003: new Batch(), trim: new Batch(), glass: new Batch(), sign: new Batch(), grille: new Batch() };
    const WHITE = lin(0xeeece6), DARK = lin(0x2b2e33), GREY = lin(0x9aa0a6), ACW = lin(0xdedbd2), STONE = lin(0x7c7a76), GL = lin(0x4a545c), GLB = lin(0x8496a2), DOOR = lin(0x4a3528), SOLAR = lin(0x1b2a4a), STEEL = lin(0xb8bcc0);
    const AWN = [lin(0x8a1f1f), lin(0x1f5c3a), lin(0x1d4f9c), lin(0xb3541e), lin(0x555a60)];
    const roads = this.roads;
    for (const i of cell.idx) {
      const pl = this.plan(i), rnd = rngOf(Math.floor(pl.r * 1e9) + 17);
      const accent = pl.ov.accent ?? pl.r3 < 0.38, balcStyle = pl.ov.balc ?? Math.floor(pl.r2 * 3), cornerWin = pl.sk === 'res' && pl.r > 0.7;
      for (const v of pl.vols) {
        const p = v.p, n = p.length / 2, st = v.st, sk = v.sk, H = v.y1 - v.y0, nf = Math.max(1, Math.round(H / st.fl)), fh = H / nf, D = st.D, [tr, tg, tb] = v.tint, flat = v.roof === 'flat';
        const S = st.skin ? B[st.skin] : null, top = v.y1 + (flat ? PAR : 0), [wa, wb_, wc, wd] = st.win;
        const act = accent ? [tr * 0.62, tg * 0.6, tb * 0.58] : [tr, tg, tb];
        for (let a = 0; a < n; a++) {
          const b = (a + 1) % n, ax = p[a * 2], az = p[a * 2 + 1], L = Math.hypot(p[b * 2] - ax, p[b * 2 + 1] - az); if (L < 2.2) continue;
          const ux = (p[b * 2] - ax) / L, uz = (p[b * 2 + 1] - az) / L, nx = uz, nz = -ux, nb = Math.max(1, Math.round(L / st.bay)), bw = L / nb;
          const mx = ax + ux * L / 2, mz = az + uz * L / 2;
          let shop = false;
          if (roads && v.y0 === 0 && L > 5 && (sk === 'res' || sk === 'old' || sk === 'vil' || sk === 'com') && fh >= 2.8) { const hit = roads.nearest(mx + nx * 7, mz + nz * 7, 22, 5); shop = !!hit && hit.d < hit.way.w / 2 + 13 && hit.way.cls >= 2; }
          const south = nz > 0.35, balc = (sk === 'res' || (sk === 'old' && pl.r2 < 0.55)) && south && L > 9 && !v.pod, tower = sk === 'res' && pl.h > 30;
          if (S) {
            const w0 = wa * bw;
            // piers between window columns (the end ones wrap the corner)
            for (let k = 0; k <= nb; k++) { const s0 = k === 0 ? -D : k * bw - w0, s1 = k === nb ? L + D : k * bw + w0; S.ebox(ax, az, ux, uz, s0, s1, 0, D, v.y0, top, tr, tg, tb, 13, 3); }
            // spandrels between window rows; the top one runs up into the parapet
            for (let f = 0; f <= nf; f++) {
              const y0 = f === 0 ? v.y0 : v.y0 + (f - 1 + wd) * fh, y1 = f === nf ? top : v.y0 + (f + wc) * fh; if (y1 - y0 < 0.05) continue;
              const band = accent && f > 0 && f < nf && (sk === 'res' ? f % 3 === 0 : true), c = band ? act : v.tint;
              if (f === 0 && shop) continue;
              S.ebox(ax, az, ux, uz, 0, L, 0, D - 0.03, y0, y1, c[0], c[1], c[2], 1 | (f < nf ? 16 : 0) | (f > 0 ? 32 : 0), 3);
            }
            // window sills, AC units, balconies
            // building entrance on every other long wall that has no shops: door, glazed transom, canopy, step
            const doorK = !shop && v.y0 === 0 && L > 14 && a % 2 === 0 && (sk === 'res' || sk === 'old' || sk === 'pub') ? nb >> 1 : -1;
            for (let f = shop ? 1 : 0; f < nf; f++) for (let k = 0; k < nb; k++) {
              const s0 = k * bw + w0, s1 = (k + 1) * bw - w0, ys = v.y0 + (f + wc) * fh, yf = v.y0 + f * fh;
              if (f === 0 && k === doorK) {
                const dt = Math.min(2.25, wd * fh - 0.3), yt = wd * fh;
                B.trim.ebox(ax, az, ux, uz, s0, s1, D - 0.05, D + 0.02, 0.15, yt, WHITE[0], WHITE[1], WHITE[2], 1, 3);
                B.trim.ebox(ax, az, ux, uz, s0 + 0.1, s1 - 0.1, D + 0.02, D + 0.05, 0.15, dt, DOOR[0], DOOR[1], DOOR[2], 29, 3);
                B.trim.ebox(ax, az, ux, uz, (s0 + s1) / 2 - 0.03, (s0 + s1) / 2 + 0.03, D + 0.05, D + 0.07, 0.15, dt, DARK[0], DARK[1], DARK[2], 1, 3);
                B.glass.ebox(ax, az, ux, uz, s0 + 0.1, s1 - 0.1, D + 0.02, D + 0.04, dt + 0.08, yt - 0.08, GL[0], GL[1], GL[2], 1, 3);
                B.trim.ebox(ax, az, ux, uz, s0 - 0.35, s1 + 0.35, D, D + 1.35, yt + 0.08, yt + 0.22, WHITE[0], WHITE[1], WHITE[2], 61, 3);
                B.concrete_wall_003.ebox(ax, az, ux, uz, s0 - 0.2, s1 + 0.2, D, D + 1.1, 0, 0.15, 0.55, 0.55, 0.55, 29, 2.5);
                continue;
              }
              const yh = v.y0 + (f + wd) * fh;                                   // window head
              if (balc && k % 3 !== 1 && f > 0) {
                const e = D + 1.2, a0 = s0 - 0.28, a1 = s1 + 0.28;
                if (sk === 'old') {                                              // open slab balcony with a steel-bar rail, sometimes a drying rack
                  B.trim.ebox(ax, az, ux, uz, a0, a1, D, e, yf - 0.13, yf + 0.02, STONE[0], STONE[1], STONE[2], 61, 3);
                  B.grille.ebox(ax, az, ux, uz, a0, a1, D, e, yf + 0.02, yf + 1.05, STEEL[0], STEEL[1], STEEL[2], 13, 0.6);
                  if (rnd() < 0.3) B.grille.ebox(ax, az, ux, uz, a0 + 0.2, a1 - 0.2, e, e + 0.7, yf + 1.9, yf + 1.92, STEEL[0], STEEL[1], STEEL[2], 16, 0.6);
                } else if (balcStyle === 0) {                                    // enclosed, glazed balcony: solid apron, glass band, slim frame
                  B.trim.ebox(ax, az, ux, uz, a0, a1, D, e, yf - 0.12, yf + 0.92, WHITE[0], WHITE[1], WHITE[2], 45, 3);
                  B.glass.ebox(ax, az, ux, uz, a0 + 0.03, a1 - 0.03, D, e - 0.03, yf + 0.92, yf + fh - 0.3, GLB[0], GLB[1], GLB[2], 13, 3);
                  B.trim.ebox(ax, az, ux, uz, a0, a1, D, e, yf + fh - 0.3, yf + fh - 0.12, WHITE[0], WHITE[1], WHITE[2], 45, 3);
                  for (const m of [a0, a0 + (a1 - a0) / 3, a0 + (a1 - a0) * 2 / 3, a1 - 0.06]) B.trim.ebox(ax, az, ux, uz, m, m + 0.06, e - 0.04, e + 0.015, yf + 0.92, yf + fh - 0.3, WHITE[0], WHITE[1], WHITE[2], 13, 3);
                  B.trim.ebox(ax, az, ux, uz, a0, a1, e - 0.04, e + 0.015, yf + 1.9, yf + 1.96, WHITE[0], WHITE[1], WHITE[2], 49, 3);
                } else if (balcStyle === 1) {                                    // open balcony, solid parapet with a steel top rail
                  B.trim.ebox(ax, az, ux, uz, a0, a1, D, e, yf - 0.13, yf + 0.02, WHITE[0], WHITE[1], WHITE[2], 61, 3);
                  B.trim.ebox(ax, az, ux, uz, a0, a1, e - 0.08, e, yf + 0.02, yf + 0.9, act[0], act[1], act[2], 31, 3);
                  B.trim.ebox(ax, az, ux, uz, a0, a0 + 0.08, D, e - 0.08, yf + 0.02, yf + 0.9, act[0], act[1], act[2], 28, 3);
                  B.trim.ebox(ax, az, ux, uz, a1 - 0.08, a1, D, e - 0.08, yf + 0.02, yf + 0.9, act[0], act[1], act[2], 28, 3);
                  B.grille.ebox(ax, az, ux, uz, a0, a1, D, e, yf + 0.9, yf + 1.12, STEEL[0], STEEL[1], STEEL[2], 13, 0.6);
                } else {                                                         // bay window: a shallow glass box on two slabs
                  B.trim.ebox(ax, az, ux, uz, s0 - 0.1, s1 + 0.1, D, D + 0.55, ys - 0.14, ys, WHITE[0], WHITE[1], WHITE[2], 61, 3);
                  B.trim.ebox(ax, az, ux, uz, s0 - 0.1, s1 + 0.1, D, D + 0.55, yh, yh + 0.14, WHITE[0], WHITE[1], WHITE[2], 61, 3);
                  B.glass.ebox(ax, az, ux, uz, s0 - 0.04, s1 + 0.04, D, D + 0.5, ys, yh, GLB[0], GLB[1], GLB[2], 13, 3);
                  for (const m of [s0 - 0.06, (s0 + s1) / 2 - 0.03, s1]) B.trim.ebox(ax, az, ux, uz, m, m + 0.06, D + 0.47, D + 0.52, ys, yh, WHITE[0], WHITE[1], WHITE[2], 13, 3);
                }
                continue;
              }
              // modern towers: air-conditioner ledge with louvres beside the window, in the bays without a balcony
              if (tower && f > 0 && (k % 3 === 1 || !balc)) {
                const c1 = s1 + w0 * 0.9, c0 = c1 - 1.05;
                B.trim.ebox(ax, az, ux, uz, c0, c1, D, D + 0.7, yf + 0.05, yf + 0.15, WHITE[0], WHITE[1], WHITE[2], 61, 3);
                for (let q = 0; q < 4; q++) B.trim.ebox(ax, az, ux, uz, c0, c1, D + 0.62, D + 0.7, yf + 0.3 + q * 0.2, yf + 0.38 + q * 0.2, GREY[0], GREY[1], GREY[2], 49, 3);
                if (rnd() < 0.7) B.trim.ebox(ax, az, ux, uz, c0 + 0.1, c1 - 0.1, D + 0.05, D + 0.5, yf + 0.15, yf + 0.85, ACW[0], ACW[1], ACW[2], 29, 3);
              }
              // old walk-ups and village houses: steel security cages on the low floors, here and there higher up
              if ((sk === 'old' || sk === 'vil') && !(f === 0 && k === doorK) && (f < 2 ? rnd() < 0.75 : rnd() < 0.14)) {
                B.grille.ebox(ax, az, ux, uz, s0 - 0.05, s1 + 0.05, D, D + 0.42, ys - 0.12, yh + 0.05, STEEL[0], STEEL[1], STEEL[2], 13 | 32, 0.6);
              }
              if (sk !== 'com') B.trim.ebox(ax, az, ux, uz, s0 - 0.06, s1 + 0.06, D - 0.04, D + 0.09, ys - 0.09, ys, WHITE[0], WHITE[1], WHITE[2], 49, 3);
              if ((sk === 'res' || sk === 'old' || sk === 'vil') && !tower && f > 0 && rnd() < 0.42) {
                const cs = s1 - 0.95, cy = ys - 0.82;
                B.trim.ebox(ax, az, ux, uz, cs, cs + 0.86, D, D + 0.36, cy, cy + 0.6, ACW[0], ACW[1], ACW[2], 61, 3);
                B.trim.ebox(ax, az, ux, uz, cs + 0.08, cs + 0.62, D + 0.36, D + 0.37, cy + 0.07, cy + 0.53, DARK[0], DARK[1], DARK[2], 1, 3);
                B.trim.ebox(ax, az, ux, uz, cs - 0.04, cs + 0.9, D, D + 0.4, cy - 0.05, cy, GREY[0], GREY[1], GREY[2], 61, 3);
              }
            }
            // plinth, drainpipe, cornice
            if (v.y0 === 0 && !shop) B.concrete_wall_003.ebox(ax, az, ux, uz, -D, L + D, D - 0.02, D + 0.05, 0, 0.55, 0.42, 0.42, 0.42, 17, 2.5);
            if (L > 6) B.trim.ebox(ax, az, ux, uz, 0.3, 0.42, D, D + 0.13, v.y0, v.y1, GREY[0], GREY[1], GREY[2], 13, 3);
            if (flat) B.trim.ebox(ax, az, ux, uz, -D - 0.12, L + D + 0.12, 0, D + 0.14, top - 0.22, top + 0.06, WHITE[0], WHITE[1], WHITE[2], 49, 3);
            if (cornerWin && nb >= 3 && !balc) for (let f = 1; f < nf; f++) { const y0 = v.y0 + (f + wc) * fh, y1 = v.y0 + (f + wd) * fh; B.glass.ebox(ax, az, ux, uz, -D - 0.02, w0, 0, D + 0.02, y0, y1, GL[0], GL[1], GL[2], 13, 3); B.glass.ebox(ax, az, ux, uz, L - w0, L + D + 0.02, 0, D + 0.02, y0, y1, GL[0], GL[1], GL[2], 13, 3); }
            // stair core above the entrance: a slightly proud, darker strip with small landing windows half a floor up
            if (doorK >= 0 && nf >= 3) {
              const c0 = doorK * bw + 0.1, c1 = (doorK + 1) * bw - 0.1, o1 = D + 0.14, y0 = v.y0 + fh * (wd + 0.12);
              S.ebox(ax, az, ux, uz, c0, c1, D - 0.02, o1, y0, top + 0.35, tr * 0.74, tg * 0.74, tb * 0.76, 29, 3);
              for (let f = 1; f < nf; f++) { const y = v.y0 + (f + 0.42) * fh; B.glass.ebox(ax, az, ux, uz, c0 + 0.55, c1 - 0.55, o1, o1 + 0.02, y, y + 0.95, GL[0], GL[1], GL[2], 1, 3); B.trim.ebox(ax, az, ux, uz, c0 + 0.47, c1 - 0.47, o1, o1 + 0.07, y - 0.08, y, WHITE[0], WHITE[1], WHITE[2], 61, 3); B.trim.ebox(ax, az, ux, uz, (c0 + c1) / 2 - 0.025, (c0 + c1) / 2 + 0.025, o1 + 0.02, o1 + 0.04, y, y + 0.95, WHITE[0], WHITE[1], WHITE[2], 13, 3); }
            }
            // old walk-ups: concrete eaves slab; tall slabs: an open frame ("crown") of posts and beams on the roof edge
            if (flat && sk === 'old') B.concrete_wall_003.ebox(ax, az, ux, uz, -D - 0.5, L + D + 0.5, 0, D + 0.6, top - 0.1, top + 0.08, 0.72, 0.72, 0.72, 61, 2.5);
            if (flat && tower && (pl.ov.crown ?? (pl.h > 50 && pl.r3 > 0.45)) && v.y1 === pl.h && L > 8) {
              B.trim.ebox(ax, az, ux, uz, -D, L + D, -0.3, D, top + 2.7, top + 3.1, WHITE[0], WHITE[1], WHITE[2], 63, 3);
              for (let k = 0; k <= nb; k += 2) B.trim.ebox(ax, az, ux, uz, Math.min(L - 0.3, k * bw) - 0.0, Math.min(L - 0.3, k * bw) + 0.3, -0.3, 0, top, top + 2.7, WHITE[0], WHITE[1], WHITE[2], 15, 3);
            }
          } else if (sk === 'office') {
            for (let k = 0; k <= nb; k++) B.trim.ebox(ax, az, ux, uz, k * bw - 0.07, k * bw + 0.07, 0, 0.24, v.y0, top, DARK[0], DARK[1], DARK[2], 13, 3);
            for (let f = 0; f <= nf; f++) { const y = v.y0 + f * fh; B.trim.ebox(ax, az, ux, uz, 0, L, 0, 0.14, Math.max(v.y0, y - 0.28), Math.min(top, y + 0.3), DARK[0], DARK[1], DARK[2], 49, 3); }
            B.trim.ebox(ax, az, ux, uz, -0.2, L + 0.2, 0, 0.34, top - 0.9, top + 0.1, STEEL[0] * 0.8, STEEL[1] * 0.8, STEEL[2] * 0.8, 49, 3);
            if (v.y0 === 0 && L > 16 && a === 0) { B.trim.ebox(ax, az, ux, uz, L / 2 - 4.5, L / 2 + 4.5, 0, 3.4, 3.7, 3.95, WHITE[0], WHITE[1], WHITE[2], 61, 3); for (const s of [-4, 4]) B.trim.ebox(ax, az, ux, uz, L / 2 + s - 0.15, L / 2 + s + 0.15, 3, 3.3, 0, 3.7, STEEL[0], STEEL[1], STEEL[2], 15, 3); }
          } else if (sk === 'ind') {
            if (L > 14) for (let k = 1; k < nb; k += 3) { const c = k * bw; B.trim.ebox(ax, az, ux, uz, c - 2, c + 2, 0, 0.1, 0, Math.min(4.4, H - 0.6), 0.16, 0.2, 0.27, 29, 3); B.trim.ebox(ax, az, ux, uz, c - 2.2, c + 2.2, 0, 0.16, Math.min(4.4, H - 0.6), Math.min(4.7, H - 0.3), WHITE[0], WHITE[1], WHITE[2], 61, 3); }
            B.concrete_wall_003.ebox(ax, az, ux, uz, -0.05, L + 0.05, 0, 0.08, 0, 0.9, 0.5, 0.5, 0.5, 17, 2.5);
            if (L > 8) B.trim.ebox(ax, az, ux, uz, 0.3, 0.44, 0.1, 0.24, 0, v.y1, GREY[0], GREY[1], GREY[2], 13, 3);
          }
          // shopfronts: glazing, sign board, awning (podiums get one big sign per edge instead)
          if (shop) {
            const o = S ? D : 0.05;
            if (v.pod || sk === 'com') {
              B.glass.ebox(ax, az, ux, uz, 0.4, L - 0.4, o - 0.04, o + 0.03, 0.3, Math.min(3.6, fh - 0.5), GL[0] * 0.8, GL[1] * 0.8, GL[2] * 0.8, 1, 3);
              B.trim.ebox(ax, az, ux, uz, 0, L, o, o + 1.6, Math.min(3.9, fh - 0.3), Math.min(4.1, fh - 0.1), DARK[0], DARK[1], DARK[2], 61, 3);
              const sw = Math.min(L - 2, 14), si = Math.floor(rnd() * SHOPS.length);
              if (sw > 5 && H > 7) this._sign(B, ax, az, ux, uz, L / 2 - sw / 2, L / 2 + sw / 2, o + 0.32, H - 3.1, H - 0.9, si, DARK);
            } else {
              const per = bw < 3.2 && nb > 1 ? 2 : 1;
              for (let k = 0; k + per <= nb; k += per) {
                const s0 = k * bw + 0.18, s1 = (k + per) * bw - 0.18, si = Math.floor(rnd() * SHOPS.length), yt = Math.min(2.72, fh - 0.5);
                B.glass.ebox(ax, az, ux, uz, s0 + 0.1, s1 - 0.1, o - 0.06, o + 0.02, 0.32, yt, GL[0] * 0.75, GL[1] * 0.75, GL[2] * 0.75, 1, 3);
                B.trim.ebox(ax, az, ux, uz, s0, s1, o - 0.06, o + 0.05, 0, 0.32, STONE[0], STONE[1], STONE[2], 17, 3);
                B.trim.ebox(ax, az, ux, uz, (s0 + s1) / 2 - 0.04, (s0 + s1) / 2 + 0.04, o, o + 0.06, 0.32, yt, DARK[0], DARK[1], DARK[2], 13, 3);
                if (S) { S.ebox(ax, az, ux, uz, k * bw - 0.18, k * bw + 0.18, 0, D + 0.04, 0, fh + wc * fh, tr, tg, tb, 13, 3); if (k + per >= nb) S.ebox(ax, az, ux, uz, L - 0.18, L + D, 0, D + 0.04, 0, fh + wc * fh, tr, tg, tb, 13, 3); S.ebox(ax, az, ux, uz, 0, L, 0, D - 0.03, yt, fh + wc * fh, tr, tg, tb, 33, 3); }
                this._sign(B, ax, az, ux, uz, s0, s1, o + 0.3, yt + 0.08, yt + 0.08 + Math.min(0.95, (s1 - s0) / 4), si, DARK);
                if (rnd() < 0.38) { const c = AWN[Math.floor(rnd() * AWN.length)]; B.trim.ebox(ax, az, ux, uz, s0, s1, o, o + 1.15, yt - 0.06, yt + 0.02, c[0], c[1], c[2], 61, 3); }
              }
            }
          }
        }
        // roof clutter on flat roofs
        if (flat && !v.terrace && pl.area > 110) {
          const inner = insetPoly(p, 2.2), ex = p[2] - p[0], ez = p[3] - p[1], el = Math.hypot(ex, ez) || 1, ux = ex / el, uz = ez / el;
          let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let k = 0; k < n; k++) { x0 = Math.min(x0, p[k * 2]); x1 = Math.max(x1, p[k * 2]); z0 = Math.min(z0, p[k * 2 + 1]); z1 = Math.max(z1, p[k * 2 + 1]); }
          const want = Math.min(sk === 'res' || sk === 'old' || sk === 'vil' ? 14 : 6, Math.floor(pl.area / 70));
          for (let k = 0, tries = 0; k < want && tries < want * 5; tries++) {
            const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0); if (!pipFlat(x, z, inner)) continue; k++;
            if (sk === 'res' || sk === 'old' || sk === 'vil') {                 // solar water heater: tilted panel + tank
              B.trim.ebox(x, z, ux, uz, -1, 1, -0.7, 0.6, v.y1 + 0.35, v.y1 + 0.45, SOLAR[0], SOLAR[1], SOLAR[2], 61, 3);
              B.trim.ebox(x, z, ux, uz, -1.05, 1.05, 0.6, 1.0, v.y1 + 0.5, v.y1 + 0.95, STEEL[0], STEEL[1], STEEL[2], 63, 3);
              B.trim.ebox(x, z, ux, uz, -0.9, -0.82, -0.6, 0.9, v.y1, v.y1 + 0.5, GREY[0], GREY[1], GREY[2], 15, 3); B.trim.ebox(x, z, ux, uz, 0.82, 0.9, -0.6, 0.9, v.y1, v.y1 + 0.5, GREY[0], GREY[1], GREY[2], 15, 3);
            } else if (sk === 'ind') { B.trim.prism(x, z, 0.7, v.y1, v.y1 + 1.1, 8, STEEL[0], STEEL[1], STEEL[2]); }
            else {                                                              // condenser / air-handling unit
              const w = 1.4 + rnd() * 1.6; B.trim.ebox(x, z, ux, uz, -w, w, -1, 1, v.y1 + 0.25, v.y1 + 1.9, GREY[0], GREY[1], GREY[2], 63, 3); B.trim.ebox(x, z, ux, uz, -w - 0.05, w + 0.05, -1.05, 1.05, v.y1 + 1.9, v.y1 + 2.0, DARK[0], DARK[1], DARK[2], 63, 3);
            }
          }
          if ((sk === 'res' || sk === 'old') && pl.area > 240) { let cx = (x0 + x1) / 2 + ux * 6, cz = (z0 + z1) / 2 + uz * 6; if (pipFlat(cx, cz, inner)) { B.trim.prism(cx, cz, 1.25, v.y1 + 0.9, v.y1 + 3.1, 12, STEEL[0], STEEL[1], STEEL[2]); B.concrete_wall_003.ebox(cx, cz, ux, uz, -1.4, 1.4, -1.4, 1.4, v.y1, v.y1 + 0.9, 0.6, 0.6, 0.6, 31, 2.5); } }
          if (pl.h > 70 && v.y1 === pl.h) { const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; B.trim.ebox(cx, cz, ux, uz, -0.14, 0.14, -0.14, 0.14, v.y1, v.y1 + 14, STEEL[0], STEEL[1], STEEL[2], 31, 3); }
        }
      }
    }
    const g = new THREE.Group(); g.matrixAutoUpdate = false;
    for (const k of Object.keys(this.skin)) { const m = B[k].mesh(this.skin[k]); if (m) g.add(m); }
    for (const m of [B.trim.mesh(this.matTrim), B.glass.mesh(this.matGlass), B.sign.mesh(this.matSign, false), B.grille.mesh(this.matGrille, false)]) if (m) g.add(m);
    return g;
  }

  _sign(B, ax, az, ux, uz, s0, s1, o, y0, y1, si, DARK) {
    B.trim.ebox(ax, az, ux, uz, s0, s1, o - 0.3, o - 0.01, y0, y1, DARK[0], DARK[1], DARK[2], 60, 3);
    const nx = uz, nz = -ux, x0 = ax + ux * s0 + nx * o, z0 = az + uz * s0 + nz * o, x1 = ax + ux * s1 + nx * o, z1 = az + uz * s1 + nz * o;
    const u0 = (si % 4) / 4, v1 = 1 - Math.floor(si / 4) / 16, v0 = v1 - 1 / 16;      // canvas rows run top-down
    // viewer in front sees s1 on the left, so u runs right→left along s to keep the text readable
    B.sign.quad(x1, y0, z1, x0, y0, z0, x0, y1, z0, x1, y1, z1, nx, 0, nz, 1, 1, 1, u0, v0, u0 + 0.25, v1);
  }

  /** Stream base tiles (up to `budget` per call) and detail cells; drop far ones. Returns tiles still pending. */
  update(cx, cz, viewDist, budget = 2) {
    const R = viewDist + TILE * 0.7, cand = [];
    for (const t of this.tiles.values()) {
      const d = Math.hypot(t.cx - cx, t.cz - cz);
      if (d < R) { if (!t.mesh) cand.push([d, t]); else t.mesh.visible = true; }
      else if (t.mesh && d > R + TILE * 2) { t.mesh.traverse(o => o.geometry && o.geometry.dispose()); this.group.remove(t.mesh); t.mesh = null; this.loaded--; }
    }
    if (cand.length) { cand.sort((a, b) => a[0] - b[0]); for (let i = 0; i < Math.min(budget, cand.length); i++) { const t = cand[i][1]; t.mesh = this._build(t); this.group.add(t.mesh); this.loaded++; } }
    // detail cells: build the nearest missing one, at most one per call (and only once the base tiles are in)
    if (!this.noDetail) {
      let best = null, bd = DETAIL_R + CELL * 0.5;
      const gx = Math.floor(cx / CELL), gz = Math.floor(cz / CELL);
      for (let ix = gx - 3; ix <= gx + 3; ix++) for (let iz = gz - 3; iz <= gz + 3; iz++) { const c = this.cells.get(ix + ',' + iz); if (!c || c.obj) continue; const d = Math.hypot(c.cx - cx, c.cz - cz); if (d < bd) { bd = d; best = c; } }
      if (best && (cand.length < 3 || budget > 2)) { best.obj = this._detail(best); this.group.add(best.obj); this.detailCount++; }
      if ((this._tick = (this._tick || 0) + 1) % 30 === 0) for (const c of this.cells.values()) if (c.obj && Math.hypot(c.cx - cx, c.cz - cz) > DETAIL_DROP) { c.obj.traverse(o => o.geometry && o.geometry.dispose()); this.group.remove(c.obj); c.obj = null; this.detailCount--; }
      if (best) return cand.length + 1;
    }
    return cand.length;
  }

  /** Is point (x,z) inside any building footprint? */
  hit(x, z) {
    const a = this.grid.at(x, z); if (!a) return false;
    for (let k = 0; k < a.length; k++) { const i = a[k], b = i * 4; if (x < this.bbox[b] || x > this.bbox[b + 1] || z < this.bbox[b + 2] || z > this.bbox[b + 3]) continue; if (pipFlat(x, z, this.data[i][2])) return true; }
    return false;
  }
}
