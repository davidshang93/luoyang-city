// HUD: minimap, speedometer, place name, toast, full map with teleport.
const $ = (id) => document.getElementById(id);
const ROAD_COL = ['#f6c453', '#f6c453', '#ffffff', '#ffffff', '#e2e2e2', '#bdbdbd', '#e8d9a0', '#d8c7a8'];
const ROAD_W = [5, 4.5, 4, 3, 2.2, 1.3, 1.6, 1.6];
const CAT_COL = { 古迹: '#c0392b', 商场: '#d35400', 交通: '#2471a3', 现代地标: '#7d3c98', 公园: '#1e8449' };
const BOUNDS = { x0: -11600, x1: 16300, z0: -10500, z1: 16600 };

export class Hud {
  constructor(game) {
    this.g = game; this.mm = $('minimap').getContext('2d'); this.frame = 0; this.lastPlace = ''; this.lastLm = null; this.mapOpen = false;
    this._buildList();
    $('mapCanvas').addEventListener('click', (e) => { const r = e.target.getBoundingClientRect(), u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height; game.teleportTo(BOUNDS.x0 + u * (BOUNDS.x1 - BOUNDS.x0), BOUNDS.z0 + v * (BOUNDS.z1 - BOUNDS.z0)); this.toggleMap(false); });
    $('mapClose').addEventListener('click', () => this.toggleMap(false));
  }

  _buildList() {
    const el = $('mapList'), cats = {};
    for (const l of this.g.landmarks.list) (cats[l.cat] ||= []).push(l);
    el.innerHTML = '';
    for (const cat of ['古迹', '交通', '商场', '现代地标', '公园']) {
      if (!cats[cat]) continue;
      const h = document.createElement('h4'); h.textContent = cat; h.style.color = CAT_COL[cat]; el.appendChild(h);
      for (const l of cats[cat]) { const b = document.createElement('button'); b.textContent = l.name; b.dataset.id = l.id; b.onclick = () => { this.g.teleport(l.id); this.toggleMap(false); }; el.appendChild(b); }
    }
  }

  _renderBigMap() {
    const cv = $('mapCanvas'), W = cv.width, H = cv.height, c = cv.getContext('2d'), g = this.g;
    const sx = W / (BOUNDS.x1 - BOUNDS.x0), sz = H / (BOUNDS.z1 - BOUNDS.z0), X = x => (x - BOUNDS.x0) * sx, Z = z => (z - BOUNDS.z0) * sz;
    c.fillStyle = '#ebe6d9'; c.fillRect(0, 0, W, H);
    const poly = (p) => { c.beginPath(); for (let i = 0; i < p.length; i += 2) i ? c.lineTo(X(p[i]), Z(p[i + 1])) : c.moveTo(X(p[i]), Z(p[i + 1])); c.closePath(); c.fill(); };
    c.fillStyle = '#cfe3bf'; for (const [, p] of g.areas.green) poly(p);
    c.fillStyle = '#9cc4e0'; for (const p of g.areas.water) poly(p);
    c.strokeStyle = '#9cc4e0'; c.lineCap = 'round';
    for (const r of g.areas.rivers) { c.lineWidth = Math.max(1, r.w * sx); c.beginPath(); for (let i = 0; i < r.pts.length; i += 2) i ? c.lineTo(X(r.pts[i]), Z(r.pts[i + 1])) : c.moveTo(X(r.pts[i]), Z(r.pts[i + 1])); c.stroke(); }
    for (let pass = 5; pass >= 0; pass--) {
      c.strokeStyle = pass <= 1 ? '#e8a838' : pass <= 3 ? '#ffffff' : '#d5d0c4'; c.lineWidth = [2.2, 2, 1.8, 1.3, 0.9, 0.5][pass];
      c.beginPath(); for (const w of g.roads.ways) { if (w.cls !== pass) continue; const p = w.pts; c.moveTo(X(p[0]), Z(p[1])); for (let i = 2; i < p.length; i += 2) c.lineTo(X(p[i]), Z(p[i + 1])); } c.stroke();
    }
    c.strokeStyle = '#555'; c.lineWidth = 1.2; c.setLineDash([5, 4]);
    for (const k in g.transit.routes) { const p = g.transit.routes[k].pts; c.beginPath(); for (let i = 0; i < p.length; i += 2) i ? c.lineTo(X(p[i]), Z(p[i + 1])) : c.moveTo(X(p[i]), Z(p[i + 1])); c.stroke(); }
    c.setLineDash([]);
    c.font = 'bold 11px "PingFang SC",sans-serif'; c.textBaseline = 'middle';
    for (const l of g.landmarks.list) { c.fillStyle = CAT_COL[l.cat] || '#333'; c.beginPath(); c.arc(X(l.x), Z(l.z), 4, 0, 6.3); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.strokeText(l.name, X(l.x) + 6, Z(l.z)); c.fillText(l.name, X(l.x) + 6, Z(l.z)); }
    this.bigMap = c.getImageData(0, 0, W, H); this.X = X; this.Z = Z;
  }

  toggleMap(on = !this.mapOpen) {
    this.mapOpen = on; $('map').style.display = on ? 'flex' : 'none';
    if (!on) return;
    if (!this.bigMap) this._renderBigMap();
    const c = $('mapCanvas').getContext('2d'); c.putImageData(this.bigMap, 0, 0);
    const p = this.g.player, x = this.X(p.px), z = this.Z(p.pz);
    c.fillStyle = '#e11'; c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.arc(x, z, 7, 0, 6.3); c.stroke(); c.fill();
    c.font = 'bold 13px "PingFang SC",sans-serif'; c.strokeText('你在这里', x + 10, z - 10); c.fillText('你在这里', x + 10, z - 10);
  }

  toast(text, ms = 2600) { const t = $('toast'); t.textContent = text; t.style.opacity = 1; clearTimeout(this._tt); this._tt = setTimeout(() => t.style.opacity = 0, ms); }

  update(dt) {
    const g = this.g, p = g.player, px = p.px, pz = p.pz;
    this.frame++;
    if (this.frame % 3 === 0) this._minimap(px, pz, g.cam.yaw);
    if (this.frame % 12 === 0) {
      const v = p.vehicle;
      $('speed').style.display = v ? 'block' : 'none';
      if (v) $('speedNum').textContent = Math.round(Math.abs(v.v) * 3.6);
      const lm = g.landmarks.at(px, pz, 25), road = g.roads.nearest(px, pz, 60);
      const place = (lm ? lm.name : '') + (lm && road?.way.name ? ' · ' : '') + (road?.way.name || (lm ? '' : '洛阳'));
      if (place !== this.lastPlace) { $('place').textContent = place; this.lastPlace = place; }
      if (lm && lm !== this.lastLm) this.toast('📍 ' + lm.name);
      this.lastLm = lm;
      const car = !v && g.nearCar(); $('hint').style.display = car ? 'block' : 'none';
      $('fps').textContent = g.fps.toFixed(0) + ' fps';
    }
  }

  _minimap(px, pz, yaw) {
    const c = this.mm, S = 190, R = 330, s = S / (R * 2), g = this.g;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const MX = (x, z) => S / 2 + (-(x - px) * fz + (z - pz) * fx) * s, MY = (x, z) => S / 2 - ((x - px) * fx + (z - pz) * fz) * s;
    c.save(); c.clearRect(0, 0, S, S); c.beginPath(); c.arc(S / 2, S / 2, S / 2 - 1, 0, 6.3); c.clip();
    c.fillStyle = '#39424a'; c.fillRect(0, 0, S, S);
    c.lineCap = 'round'; c.lineJoin = 'round';
    // rivers
    c.strokeStyle = '#4a86b0';
    for (const r of g.areas.rivers) { if (r.w < 20) continue; const q = r.pts; let near = false; for (let i = 0; i < q.length; i += 2) if (Math.abs(q[i] - px) < R * 1.6 + r.w && Math.abs(q[i + 1] - pz) < R * 1.6 + r.w) { near = true; break; } if (!near) continue; c.lineWidth = r.w * s; c.beginPath(); for (let i = 0; i < q.length; i += 2) i ? c.lineTo(MX(q[i], q[i + 1]), MY(q[i], q[i + 1])) : c.moveTo(MX(q[i], q[i + 1]), MY(q[i], q[i + 1])); c.stroke(); }
    const seen = new Set();
    g.roads.grid.query(px - R * 1.45, pz - R * 1.45, px + R * 1.45, pz + R * 1.45, code => seen.add(Math.floor(code / 4096)));
    const byCls = [[], [], [], [], [], [], [], []]; for (const wi of seen) byCls[g.roads.ways[wi].cls].push(g.roads.ways[wi]);
    for (const cls of [7, 5, 6, 4, 3, 2, 1, 0]) {
      c.strokeStyle = ROAD_COL[cls]; c.lineWidth = Math.max(ROAD_W[cls] * 0.55, 1); c.globalAlpha = cls >= 5 ? 0.55 : 0.95; c.beginPath();
      for (const w of byCls[cls]) { const q = w.pts; c.moveTo(MX(q[0], q[1]), MY(q[0], q[1])); for (let i = 2; i < q.length; i += 2) c.lineTo(MX(q[i], q[i + 1]), MY(q[i], q[i + 1])); }
      c.stroke();
    }
    c.globalAlpha = 1; c.font = 'bold 10px "PingFang SC",sans-serif'; c.textAlign = 'center';
    for (const l of g.landmarks.list) { const d = Math.hypot(l.x - px, l.z - pz); if (d > R * 1.4) continue; const x = MX(l.x, l.z), y = MY(l.x, l.z); c.fillStyle = CAT_COL[l.cat] || '#fff'; c.beginPath(); c.arc(x, y, 4.5, 0, 6.3); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 1.2; c.stroke(); c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 2.5; c.strokeText(l.name, x, y - 8); c.fillText(l.name, x, y - 8); }
    // traffic dots
    c.fillStyle = '#9fd0ff'; for (const t of g.traffic.cars) c.fillRect(MX(t.x, t.z) - 1.5, MY(t.x, t.z) - 1.5, 3, 3);
    // player arrow (points along player heading relative to camera yaw)
    const ph = (p => (p.vehicle ? p.vehicle.h : p.h))(g.player) - yaw;
    c.translate(S / 2, S / 2); c.rotate(-ph); c.fillStyle = '#fff'; c.strokeStyle = '#111'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -8); c.lineTo(6, 7); c.lineTo(0, 3.5); c.lineTo(-6, 7); c.closePath(); c.fill(); c.stroke();
    c.restore();
    // north marker
    const na = Math.atan2(-fx, fz); // direction of north (-Z) on the rotated map
    const nx = S / 2 + Math.sin(-yaw + Math.PI) * (S / 2 - 11), ny = S / 2 - Math.cos(-yaw + Math.PI) * (S / 2 - 11);
    c.fillStyle = '#e74c3c'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('N', nx, ny);
  }
}
