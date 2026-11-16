// Pass 2: data-src/luoyang-raw.json (OSM, lon/lat) → src/data/*.json (metres, game-ready).
// Map data © OpenStreetMap contributors (ODbL).
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url);
const raw = JSON.parse(readFileSync(new URL('data-src/luoyang-raw.json', ROOT)));
const landmarks = JSON.parse(readFileSync(new URL('src/data/landmarks.json', ROOT))).filter(l => !l.hidden);

// ── projection: origin = 应天门, 1:1 metres, +X east, +Z south ──
export const LON0 = 112.4545, LAT0 = 34.6776;
const KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KZ = 110950;
const proj = ([lon, lat]) => [(lon - LON0) * KX, -(lat - LAT0) * KZ];
const r1 = v => Math.round(v * 10) / 10;
const flat = pts => { const o = []; for (const p of pts) o.push(r1(p[0]), r1(p[1])); return o; };

// ── geometry helpers ──
function dp(pts, eps) { // Douglas-Peucker
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); let md = 0, mi = -1;
    const ax = pts[a][0], az = pts[a][1], dx = pts[b][0] - ax, dz = pts[b][1] - az, L = Math.hypot(dx, dz) || 1e-9;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dz - (pts[i][1] - az) * dx) / L; if (d > md) { md = d; mi = i; } }
    if (md > eps) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const signedArea = pts => { let a = 0; for (let i = 0, n = pts.length; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
const centroid = pts => { let x = 0, z = 0; for (const p of pts) { x += p[0]; z += p[1]; } return [x / pts.length, z / pts.length]; };
function ring(ptsLL, eps) { // closed way → simplified open ring, CCW
  let pts = ptsLL.map(proj);
  if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
  if (eps && pts.length > 4) { // closed ring: split at the point farthest from pts[0], simplify both halves
    let fi = 1, fd = 0; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > fd) { fd = d; fi = i; } }
    const a = dp(pts.slice(0, fi + 1), eps), b = dp([...pts.slice(fi), pts[0]], eps);
    pts = a.concat(b.slice(1, -1));
  }
  if (pts.length < 3) return null;
  if (signedArea(pts) < 0) pts.reverse();
  return pts;
}
function pip(x, z, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
const hash = (x, z) => { let h = (Math.round(x * 3) * 73856093) ^ (Math.round(z * 3) * 19349663); h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

const wayById = new Map(raw.ways.map(w => [w.id, w]));
function stitchRings(memberWays) { // join open ways into closed rings by endpoint
  const segs = memberWays.map(w => w.pts.slice()), rings = [];
  const key = p => p[0].toFixed(6) + ',' + p[1].toFixed(6);
  while (segs.length) {
    let cur = segs.pop(), guard = 0;
    while (key(cur[0]) !== key(cur[cur.length - 1]) && guard++ < 5000) {
      const end = key(cur[cur.length - 1]); let found = false;
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        if (key(s[0]) === end) { cur = cur.concat(s.slice(1)); segs.splice(i, 1); found = true; break; }
        if (key(s[s.length - 1]) === end) { cur = cur.concat(s.slice(0, -1).reverse()); segs.splice(i, 1); found = true; break; }
      }
      if (!found) break;
    }
    if (cur.length >= 4) rings.push(cur);
  }
  return rings;
}

// ── landmark exclusion rects ──
const lmRects = landmarks.map(l => { const [x, z] = proj([l.lon, l.lat]); const th = Math.PI - l.bearing * Math.PI / 180; return { id: l.id, x, z, hw: l.w / 2 + 4, hd: l.d / 2 + 4, c: Math.cos(th), s: Math.sin(th) }; });
function inLandmark(x, z, pad = 0) { for (const r of lmRects) { const dx = x - r.x, dz = z - r.z; if (Math.abs(dx) > 800 || Math.abs(dz) > 800) continue; const lx = dx * r.c - dz * r.s, lz = dx * r.s + dz * r.c; if (Math.abs(lx) < r.hw + pad && Math.abs(lz) < r.hd + pad) return r.id; } return null; }

// ════════════ ROADS ════════════
const CLS = { motorway: 0, trunk: 1, primary: 2, secondary: 3, tertiary: 4, residential: 5, unclassified: 5, living_street: 5, motorway_link: 6, trunk_link: 6, primary_link: 6, secondary_link: 6, tertiary_link: 6, pedestrian: 7 };
const DEFW = [[23, 12], [21, 11.5], [21, 11], [15, 9], [11, 7], [7.5, 5.5], [7, 6.5], [9, 9]]; // [two-way, one-way] metres
const names = [], nameIdx = new Map();
const nameId = n => { if (!n) return -1; if (!nameIdx.has(n)) { nameIdx.set(n, names.length); names.push(n); } return nameIdx.get(n); };
const roads = [];
const nodeUse = new Map(); // how many road ways touch each node
for (const w of raw.ways) if (CLS[w.tags.highway] !== undefined) for (const p of w.pts) { const k = p[0] + ',' + p[1]; nodeUse.set(k, (nodeUse.get(k) || 0) + 1); }
for (const w of raw.ways) {
  const t = w.tags, cls = CLS[t.highway];
  if (cls === undefined || w.pts.length < 2) continue;
  if (t.area === 'yes' || t.tunnel === 'yes' && cls >= 5) continue;
  const oneway = t.oneway === 'yes' || t.junction === 'roundabout' || t.highway === 'motorway' ? 1 : 0;
  const lanes = parseInt(t.lanes);
  let width = Number.isFinite(lanes) && lanes > 0 && lanes < 12 ? Math.max(DEFW[cls][1] * 0.8, lanes * 3.5 + 1.5) : DEFW[cls][oneway];
  const pts = dpKeep(w.pts, 0.6);
  let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  if (len < 4) continue;
  roads.push([cls, r1(width), oneway | (t.bridge && t.bridge !== 'no' ? 2 : 0) | (t.tunnel === 'yes' ? 4 : 0), nameId(t.name), flat(pts)]);
}
// (dpKeep is hoisted) simplify between junction nodes only
function dpKeep(ptsLL, eps) {
  const out = []; let start = 0;
  for (let i = 1; i < ptsLL.length; i++) {
    if (i === ptsLL.length - 1 || nodeUse.get(ptsLL[i][0] + ',' + ptsLL[i][1]) > 1) {
      const part = dp(ptsLL.slice(start, i + 1).map(proj), eps);
      for (let k = out.length ? 1 : 0; k < part.length; k++) out.push(part[k]);
      start = i;
    }
  }
  return out;
}
// road segment spatial hash (for filler-building clearance)
const CELL = 60, segGrid = new Map();
for (const r of roads) { const p = r[4], hw = r[1] / 2; for (let i = 0; i + 3 < p.length; i += 2) { const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3]; const x0 = Math.floor((Math.min(ax, bx) - 40) / CELL), x1 = Math.floor((Math.max(ax, bx) + 40) / CELL), z0 = Math.floor((Math.min(az, bz) - 40) / CELL), z1 = Math.floor((Math.max(az, bz) + 40) / CELL); for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) { const k = gx + ',' + gz; let a = segGrid.get(k); if (!a) segGrid.set(k, a = []); a.push([ax, az, bx, bz, hw]); } } }
function roadClear(x, z, margin) { const a = segGrid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)); if (!a) return true; for (const s of a) { const dx = s[2] - s[0], dz = s[3] - s[1], L2 = dx * dx + dz * dz || 1e-9; let t = ((x - s[0]) * dx + (z - s[1]) * dz) / L2; t = Math.max(0, Math.min(1, t)); if (Math.hypot(x - s[0] - t * dx, z - s[1] - t * dz) < s[4] + margin) return false; } return true; }

// ════════════ RAIL ════════════
const rails = [], namedRail = {};
for (const w of raw.ways) {
  const t = w.tags;
  if (t.railway !== 'rail' || t.tunnel === 'yes' || w.pts.length < 2) continue;
  const hs = t.highspeed === 'yes' || /高速|高铁|客运专线/.test(t.name || '') ? 1 : 0;
  const pts = dp(w.pts.map(proj), 0.5);
  rails.push([hs | (t.service ? 2 : 0) | (t.bridge && t.bridge !== 'no' ? 4 : 0), flat(pts)]);
  if (t.name && !t.service) (namedRail[t.name] ||= []).push(pts);
}
function longestChain(segs) { // greedy endpoint stitching → longest polyline
  const key = p => Math.round(p[0] * 2) + ',' + Math.round(p[1] * 2);
  const pool = segs.map(s => s.slice()); let best = [], bestLen = 0;
  while (pool.length) {
    let cur = pool.pop(), grown = true;
    while (grown) {
      grown = false;
      for (let i = 0; i < pool.length; i++) {
        const s = pool[i], h = key(cur[0]), e = key(cur[cur.length - 1]);
        if (key(s[0]) === e) cur = cur.concat(s.slice(1));
        else if (key(s[s.length - 1]) === e) cur = cur.concat(s.slice(0, -1).reverse());
        else if (key(s[s.length - 1]) === h) cur = s.slice(0, -1).concat(cur);
        else if (key(s[0]) === h) cur = s.slice(1).reverse().concat(cur);
        else continue;
        pool.splice(i, 1); grown = true; break;
      }
    }
    let len = 0; for (let i = 1; i < cur.length; i++) len += Math.hypot(cur[i][0] - cur[i - 1][0], cur[i][1] - cur[i - 1][1]);
    if (len > bestLen) { bestLen = len; best = cur; }
  }
  return { pts: best, len: bestLen };
}
const routes = {};
for (const [key, name] of [['hsr', '徐兰高速线'], ['longhai', '陇海线'], ['jiaoliu', '焦柳线']]) {
  const c = longestChain(namedRail[name] || []);
  if (c.pts.length > 1 && c.pts[0][0] > c.pts[c.pts.length - 1][0]) c.pts.reverse(); // west → east
  routes[key] = { name, len: Math.round(c.len), pts: flat(c.pts) };
}

// ════════════ AREAS ════════════
const water = [], green = [], aero = { runways: [], taxiways: [], aprons: [] }, riverLines = [];
const GREEN = { 'leisure=park': 0, 'leisure=garden': 0, 'natural=wood': 1, 'landuse=forest': 1, 'natural=scrub': 1, 'landuse=grass': 2, 'landuse=meadow': 2, 'landuse=recreation_ground': 2, 'leisure=pitch': 4, 'landuse=farmland': 3, 'landuse=cemetery': 1, 'natural=grassland': 2, 'leisure=golf_course': 2 };
const greenKind = t => { for (const k of ['leisure', 'natural', 'landuse']) { const v = GREEN[k + '=' + t[k]]; if (v !== undefined) return v; } return -1; };
function addArea(t, ptsLL) {
  if (t.natural === 'water' || t.waterway === 'riverbank' || t.landuse === 'reservoir' || t.landuse === 'basin') { const r = ring(ptsLL, 1.5); if (r && Math.abs(signedArea(r)) > 60) water.push(flat(r)); return; }
  const gk = greenKind(t);
  if (gk >= 0) { const r = ring(ptsLL, 2); if (r && Math.abs(signedArea(r)) > (gk === 2 ? 900 : 400)) green.push([gk, flat(r)]); }
}
for (const w of raw.ways) {
  const t = w.tags;
  if (t.aeroway === 'runway') aero.runways.push({ w: parseFloat(t.width) || 45, pts: flat(w.pts.map(proj)) });
  else if (t.aeroway === 'taxiway') aero.taxiways.push({ w: 23, pts: flat(dp(w.pts.map(proj), 0.5)) });
  else if (t.aeroway === 'apron' && w.closed) { const r = ring(w.pts, 1); if (r) aero.aprons.push(flat(r)); }
  if (t.waterway === 'river' || t.waterway === 'stream' || t.waterway === 'canal') { const W = { 洛河: 190, 伊河: 150, 涧河: 28, 瀍河: 22 }[t.name] || (t.waterway === 'river' ? 16 : 0); if (W) riverLines.push({ w: W, name: t.name || '', pts: flat(dp(w.pts.map(proj), 2)) }); }
  if (w.closed && w.pts.length >= 4) addArea(t, w.pts);
}
for (const rel of raw.relations) {
  if (rel.tags.type !== 'multipolygon') continue;
  const outers = rel.members.filter(m => m.role !== 'inner').map(m => wayById.get(m.ref)).filter(Boolean);
  for (const rg of stitchRings(outers)) addArea(rel.tags, rg);
}
aero.runways = aero.runways.filter(r => r.pts.length >= 4 && Math.abs(r.pts[0]) < 20000);

// ════════════ BUILDINGS ════════════
const buildings = []; // [height, type, flatRing]   type: 0 low housing, 1 apartments, 2 commercial/office, 3 industrial, 4 public
const bGrid = new Map(), BC = 100; // centroid grid for coverage tests
const TYPE = { apartments: 1, residential: 1, house: 0, detached: 0, dormitory: 1, commercial: 2, retail: 2, office: 2, hotel: 2, industrial: 3, warehouse: 3, school: 4, university: 4, hospital: 4, college: 4, public: 4, government: 4, kindergarten: 4, train_station: 4, transportation: 4 };
let skippedLm = 0;
function pushBuilding(h, type, pts, area) { buildings.push([r1(h), type, flat(pts)]); const c = centroid(pts); const k = Math.floor(c[0] / BC) + ',' + Math.floor(c[1] / BC); let a = bGrid.get(k); if (!a) bGrid.set(k, a = []); a.push([c[0], c[1], area]); }
function addBuilding(t, ptsLL) {
  const pts = ring(ptsLL, 0.5); if (!pts) return;
  const area = Math.abs(signedArea(pts)); if (area < 30) return;
  if (t.building === 'roof' || t.building === 'construction' || t.building === 'ruins') return;
  const c = centroid(pts);
  if (inLandmark(c[0], c[1])) { skippedLm++; return; }
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
  // oriented aspect via longest edge
  let le = 0; for (let i = 0; i < pts.length; i++) { const q = pts[(i + 1) % pts.length]; le = Math.max(le, Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1])); }
  const aspect = le * le / area, r = hash(c[0], c[1]), r2 = hash(c[1] + 7, c[0] - 3);
  let type = TYPE[t.building] ?? (t.amenity === 'school' || t.amenity === 'hospital' || t.amenity === 'university' ? 4 : t.shop ? 2 : 5), h;
  const lv = parseFloat(t['building:levels']), ht = parseFloat(t.height);
  if (Number.isFinite(ht) && ht > 2 && ht < 400) h = ht;
  else if (Number.isFinite(lv) && lv > 0 && lv < 90) h = lv * (type === 2 ? 4 : 3.1) + 1.5;
  else if (type === 3) h = 8 + r * 7;
  else if (type === 4) h = area > 1500 && t.building === 'hospital' ? 30 + r * 30 : 14 + r * 9;
  else if (type === 2) h = area < 900 ? 24 + r * 60 : area < 4000 ? 20 + r * 30 : 16 + r * 12;
  else if (area < 70) h = 3.5 + r * 2;
  else if (area < 180) h = 7 + r * 7;
  else if (area > 6000) { h = 10 + r * 10; if (type === 5) type = 3; }
  else if (area > 1800 && aspect < 3) { h = 14 + r * 14; if (type === 5) type = 2; }
  else if (aspect >= 3.2) { h = r < 0.72 ? 15.5 + Math.floor(r2 * 3) * 3.1 : r < 0.92 ? 34 : 54; if (type === 5) type = h > 20 ? 1 : 0; }
  else { const low = type === 1 ? 0.35 : 0.7, mid = type === 1 ? 0.78 : 0.93; h = r < low ? 12 + r2 * 10 : r < mid ? 36 + r2 * 20 : 78 + r2 * 22; if (type === 5) type = h > 25 ? 1 : 0; }
  pushBuilding(h, type === 5 ? 0 : type, pts, area);
}
for (const w of raw.ways) if (w.tags.building && w.closed && w.pts.length >= 4) addBuilding(w.tags, w.pts);
for (const rel of raw.relations) if (rel.tags.building && rel.tags.type === 'multipolygon') { const outers = rel.members.filter(m => m.role !== 'inner').map(m => wayById.get(m.ref)).filter(Boolean); for (const rg of stitchRings(outers)) addBuilding(rel.tags, rg); }
const realCount = buildings.length;

// ── filler buildings inside landuse polygons that OSM left empty ──
const waterPolys = water.map(f => { const p = []; for (let i = 0; i < f.length; i += 2) p.push([f[i], f[i + 1]]); return p; }).filter(p => Math.abs(signedArea(p)) > 3000);
const waterBB = waterPolys.map(p => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const q of p) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); } return [x0, x1, z0, z1]; });
const inWater = (x, z) => { for (let i = 0; i < waterPolys.length; i++) { const b = waterBB[i]; if (x < b[0] || x > b[1] || z < b[2] || z > b[3]) continue; if (pip(x, z, waterPolys[i])) return true; } return false; };
function coverage(poly, bb) { let a = 0; for (let gx = Math.floor(bb[0] / BC); gx <= Math.floor(bb[1] / BC); gx++) for (let gz = Math.floor(bb[2] / BC); gz <= Math.floor(bb[3] / BC); gz++) for (const b of bGrid.get(gx + ',' + gz) || []) if (pip(b[0], b[1], poly)) a += b[2]; return a; }
let fillers = 0;
const LU = { residential: 'res', commercial: 'com', retail: 'com', industrial: 'ind' };
const luPolys = raw.ways.filter(w => w.closed && LU[w.tags.landuse]).map(w => ({ kind: LU[w.tags.landuse], pts: ring(w.pts, 1.5) })).filter(l => l.pts);
for (const lu of luPolys) {
  const poly = lu.pts, area = Math.abs(signedArea(poly));
  if (area < 3500 || area > 2.5e6) continue;
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of poly) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
  if (coverage(poly, [x0, x1, z0, z1]) / area > 0.05) continue;
  // align the grid to the polygon's longest edge
  let le = 0, ang = 0; for (let i = 0; i < poly.length; i++) { const q = poly[(i + 1) % poly.length], L = Math.hypot(q[0] - poly[i][0], q[1] - poly[i][1]); if (L > le) { le = L; ang = Math.atan2(q[1] - poly[i][1], q[0] - poly[i][0]); } }
  const c = Math.cos(ang), s = Math.sin(ang), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, R = Math.hypot(x1 - x0, z1 - z0) / 2;
  const seed = hash(cx, cz), seed2 = hash(cz, cx);
  let bw, bd, sx, sz, h, type;
  if (lu.kind === 'ind') { bw = 62; bd = 28; sx = 82; sz = 52; h = 9 + seed * 5; type = 3; }
  else if (lu.kind === 'com') { bw = 30; bd = 26; sx = 56; sz = 50; h = 24 + seed * 60; type = 2; }
  else if (seed < 0.4) { bw = 46; bd = 12; sx = 56; sz = 30; h = 18.6; type = 0; }             // 6F 板楼小区
  else if (seed < 0.7) { bw = 38; bd = 15; sx = 54; sz = 46; h = 34 + Math.floor(seed2 * 3) * 9.3; type = 1; } // 11–17F 小高层
  else { bw = 30; bd = 20; sx = 56; sz = 62; h = 78 + Math.floor(seed2 * 4) * 6.2; type = 1; }  // 26–33F 高层
  for (let u = -R; u <= R; u += sx) for (let v = -R; v <= R; v += sz) {
    const bx = cx + u * c - v * s, bz = cz + u * s + v * c;
    const corners = [[-bw / 2, -bd / 2], [bw / 2, -bd / 2], [bw / 2, bd / 2], [-bw / 2, bd / 2]].map(([a, b]) => [bx + a * c - b * s, bz + a * s + b * c]);
    if (!corners.every(p => pip(p[0], p[1], poly))) continue;
    if (!roadClear(bx, bz, Math.max(bw, bd) / 2 + 3) || !corners.every(p => roadClear(p[0], p[1], 4))) continue;
    if (inLandmark(bx, bz, 20) || inWater(bx, bz)) continue;
    const hh = type === 2 ? 20 + hash(bx, bz) * 70 : h + (type === 3 ? hash(bx, bz) * 3 : 0);
    if (signedArea(corners) < 0) corners.reverse();
    pushBuilding(hh, type, corners, bw * bd); fillers++;
  }
}

// ════════════ WRITE ════════════
const out = (name, data) => { const s = JSON.stringify(data); writeFileSync(new URL('src/data/' + name, ROOT), s); return `${name} ${(s.length / 1e6).toFixed(2)}MB`; };
const lmOut = landmarks.map(l => { const [x, z] = proj([l.lon, l.lat]); return { id: l.id, name: l.name, cat: l.cat, x: r1(x), z: r1(z), w: l.w, d: l.d, rot: +(Math.PI - l.bearing * Math.PI / 180).toFixed(4) }; });
const stations = raw.pois.filter(p => p.tags.railway === 'station' && (p.tags.station === 'subway' || p.tags.subway === 'yes' || /地铁|轨道交通/.test(p.tags.network || ''))).map(p => { const [x, z] = proj([p.lon, p.lat]); return [p.tags.name, r1(x), r1(z)]; });
console.log([
  out('roads.json', { names, ways: roads }),
  out('rails.json', { ways: rails, routes }),
  out('areas.json', { water, green, riverLines, aero }),
  out('buildings.json', buildings),
  out('places.json', { origin: [LON0, LAT0], landmarks: lmOut, metro: stations }),
].join('\n'));
console.log({ roads: roads.length, rails: rails.length, routes: Object.fromEntries(Object.entries(routes).map(([k, v]) => [k, v.len + 'm/' + v.pts.length / 2 + 'pts'])), water: water.length, green: green.length, riverLines: riverLines.length, runways: aero.runways.length, taxiways: aero.taxiways.length, aprons: aero.aprons.length, realBuildings: realCount, skippedInLandmarks: skippedLm, fillers, metro: stations.length });
