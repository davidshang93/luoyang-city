// Pass 1: cut Luoyang urban area out of the Henan OSM extract → raw JSON (lon/lat).
import { createOSMStream } from 'osm-pbf-parser-node';
import { writeFileSync } from 'node:fs';

const [, , pbfPath, outPath] = process.argv;
const BBOX = { w: 112.33, e: 112.63, s: 34.53, n: 34.77 };
const M = 0.03; // margin for node capture
const inBox = (lon, lat) => lon >= BBOX.w - M && lon <= BBOX.e + M && lat >= BBOX.s - M && lat <= BBOX.n + M;

const nodes = new Map();          // id -> [lon,lat]
const poiNodes = [];
const ways = new Map();           // id -> {refs, tags}
const relations = [];
let nNodes = 0, nWays = 0;

for await (const it of createOSMStream(pbfPath, { withTags: true, withInfo: false })) {
  if (it.type === 'node') {
    nNodes++;
    if (!inBox(it.lon, it.lat)) continue;
    nodes.set(it.id, [it.lon, it.lat]);
    const t = it.tags;
    if (t && (t.name || t.railway === 'station' || t.aeroway)) poiNodes.push({ id: it.id, lon: it.lon, lat: it.lat, tags: t });
  } else if (it.type === 'way') {
    nWays++;
    let hit = false;
    for (const r of it.refs) if (nodes.has(r)) { hit = true; break; }
    if (!hit) continue;
    ways.set(it.id, { refs: it.refs, tags: it.tags || {} });
  } else if (it.type === 'relation') {
    const t = it.tags || {};
    if (!(t.type === 'multipolygon' || t.type === 'route' || t.type === 'boundary')) continue;
    const mem = (it.members || []).filter(m => m.type === 'way' && ways.has(m.ref));
    if (!mem.length) continue;
    if (t.type === 'route' && !['subway', 'train', 'railway'].includes(t.route)) continue;
    if (t.type === 'boundary') continue;
    relations.push({ id: it.id, tags: t, members: mem.map(m => ({ ref: m.ref, role: m.role })) });
  }
}

const coords = refs => refs.map(r => nodes.get(r)).filter(Boolean).map(c => [+c[0].toFixed(6), +c[1].toFixed(6)]);
const out = { bbox: BBOX, ways: [], relations: [], pois: poiNodes };
const relWayIds = new Set(relations.flatMap(r => r.members.map(m => m.ref)));
for (const [id, w] of ways) {
  const hasTags = Object.keys(w.tags).length > 0;
  if (!hasTags && !relWayIds.has(id)) continue;
  out.ways.push({ id, tags: w.tags, pts: coords(w.refs), closed: w.refs[0] === w.refs[w.refs.length - 1] });
}
out.relations = relations;
writeFileSync(outPath, JSON.stringify(out));

const count = (pred) => out.ways.filter(pred).length;
console.log(JSON.stringify({
  scanned: { nNodes, nWays }, nodesInBox: nodes.size, ways: out.ways.length, relations: relations.length, pois: poiNodes.length,
  highways: count(w => w.tags.highway), majorHighways: count(w => /^(motorway|trunk|primary|secondary|tertiary)(_link)?$/.test(w.tags.highway || '')),
  residential: count(w => /^(residential|unclassified|living_street)$/.test(w.tags.highway || '')),
  buildings: count(w => w.tags.building), rail: count(w => w.tags.railway), water: count(w => w.tags.natural === 'water' || w.tags.waterway),
  aeroway: count(w => w.tags.aeroway), parks: count(w => w.tags.leisure === 'park'),
}, null, 1));
