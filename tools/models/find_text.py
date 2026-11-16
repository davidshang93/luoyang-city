# Finds every piece of text on the vehicle colour textures (brand names, plates, liveries, tyre lettering) with the macOS
# Vision OCR, in all 8 orientations / mirrorings, on the whole image and on enlarged tiles, plain and brightened.
# Usage: swiftc -O -o /tmp/ocr tools/models/ocr.swift
#        node tools/models/build-cars.mjs dumptex <texDir> impala suv ...
#        python3 tools/models/find_text.py /tmp/ocr <texDir> <workDir> tools/models/text_boxes.json
# Output: { "<car>__<texture>": [ { "box": [x0, y0, x1, y1] (0..1, origin top-left), "text": ..., "conf": ... }, ... ] }
import sys, os, json, subprocess, re
from PIL import Image, ImageOps
ocr, src, work, out = sys.argv[1:5]
os.makedirs(work, exist_ok=True)
ROT = {0: None, 90: Image.ROTATE_90, 180: Image.ROTATE_180, 270: Image.ROTATE_270}
def inv_rot(k, u, v): return (u, v) if k == 0 else (1 - v, u) if k == 90 else (1 - u, 1 - v) if k == 180 else (v, 1 - u)
res = {}
for fn in sorted(os.listdir(src)):
    if not fn.endswith('.png'): continue
    im = Image.open(os.path.join(src, fn)).convert('RGB'); W, H = im.size
    tiles = [(0, 0, 1, 1)]
    if max(W, H) >= 1024: tiles += [(x, y, x + 0.56, y + 0.56) for x in (0, 0.44) for y in (0, 0.44)]
    if max(W, H) >= 2048: tiles += [(x * 0.25, y * 0.25, x * 0.25 + 0.31, y * 0.25 + 0.31) for x in range(4) for y in range(4) if x < 3.1 and y < 3.1 and x * 0.25 + 0.31 <= 1.07 and y * 0.25 + 0.31 <= 1.07]
    jobs = {}
    for ti, (a, b, c, d) in enumerate(tiles):
        c = min(c, 1); d = min(d, 1)
        crop = im.crop((int(a * W), int(b * H), int(c * W), int(d * H)))
        k = 2048 / max(crop.size); crop = crop.resize((int(crop.width * k), int(crop.height * k)), Image.LANCZOS) if k > 1.05 or k < 0.6 else crop
        for enh in (0, 1):
            e = crop if enh == 0 else ImageOps.autocontrast(ImageOps.equalize(crop.convert('L'))).convert('RGB')
            for flip in (0, 1):
                f = e.transpose(Image.FLIP_LEFT_RIGHT) if flip else e
                for rot in (0, 90, 180, 270):
                    r = f.transpose(ROT[rot]) if ROT[rot] is not None else f
                    p = os.path.join(work, 'v_%d_%d_%d_%d.png' % (ti, enh, flip, rot)); r.save(p); jobs[p] = (a, b, c, d, flip, rot)
    found = []
    paths = list(jobs)
    for i in range(0, len(paths), 16):
        o = subprocess.run([ocr] + paths[i:i + 16], capture_output=True, text=True).stdout
        for line in o.splitlines():
            try: j = json.loads(line)
            except Exception: continue
            t = j['text'].strip()
            if j['conf'] < 0.3 or len(re.findall(r'[A-Za-z0-9一-鿿]', t)) < 2: continue
            a, b, c, d, flip, rot = jobs[j['file']]; x0, y0, x1, y1 = j['box']; pts = []
            for (u, v) in ((x0, y0), (x1, y1)):
                u, v = inv_rot(rot, u, v)
                if flip: u = 1 - u
                pts.append((a + u * (c - a), b + v * (d - b)))
            box = [min(pts[0][0], pts[1][0]), min(pts[0][1], pts[1][1]), max(pts[0][0], pts[1][0]), max(pts[0][1], pts[1][1])]
            found.append({'box': [round(v, 4) for v in box], 'text': t, 'conf': round(j['conf'], 2), 'flip': flip, 'rot': rot})
    # merge overlapping detections (keep the union box and the most confident reading)
    found.sort(key=lambda f: -f['conf']); merged = []
    for f in found:
        for m in merged:
            a, b = f['box'], m['box']; ix = min(a[2], b[2]) - max(a[0], b[0]); iy = min(a[3], b[3]) - max(a[1], b[1])
            if ix > 0 and iy > 0 and ix * iy > 0.3 * min((a[2] - a[0]) * (a[3] - a[1]), (b[2] - b[0]) * (b[3] - b[1])):
                m['box'] = [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]; break
        else: merged.append(dict(f))
    res[fn[:-4]] = merged
    print(fn, len(found), '->', len(merged), '|', ' / '.join(sorted(set(m['text'] for m in merged)))[:600], flush=True)
    for p in paths: os.remove(p)
json.dump(res, open(out, 'w'), ensure_ascii=False, indent=0)
