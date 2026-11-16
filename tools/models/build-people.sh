#!/bin/sh
# Re-convert all 8 Rocketbox avatars into assets/models/people/*.glb (+ index.json).
# Usage: sh tools/models/build-people.sh   (from anywhere; needs Blender 4.5 at ~/Applications/Blender.app)
# Raw inputs: assets/third_party_raw/rocketbox/ (MIT, Microsoft Rocketbox). Converter: tools/blender/process_person.py
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BL="${BLENDER:-$HOME/Applications/Blender.app/Contents/MacOS/Blender}"
RAW="$ROOT/assets/third_party_raw/rocketbox"
OUT="$ROOT/assets/models/people"
mkdir -p "$OUT"
for pair in f01:Female_Adult_01 f03:Female_Adult_03 f05:Female_Adult_05 f08:Female_Adult_08 \
            m01:Male_Adult_01 m04:Male_Adult_04 m09:Male_Adult_09 m12:Male_Adult_12; do
  id="${pair%%:*}"; name="${pair#*:}"; sex="$(printf %s "$id" | cut -c1)"
  echo "== $id ($name)"
  "$BL" --background --factory-startup --python "$ROOT/tools/blender/process_person.py" -- \
    "$RAW/$name/$name.fbx" "$RAW/animations/${sex}_walk_neutral_01.max.fbx" "$RAW/animations/${sex}_idle_neutral_01.max.fbx" \
    "$OUT/$id.glb" --info "$OUT/$id.info.json" 2>&1 | grep -E '^(INFO \{|AVATAR|WALK|IDLE)|Error|Traceback' || true
  test -s "$OUT/$id.info.json" || { echo "conversion failed for $id"; exit 1; }
done
node -e '
const fs = require("fs"), path = require("path"), out = process.argv[1], ids = ["f01","f03","f05","f08","m01","m04","m09","m12"];
const list = ids.map(id => { const f = path.join(out, id + ".info.json"), i = JSON.parse(fs.readFileSync(f)); fs.unlinkSync(f);
  return { id, file: id + ".glb", sex: id[0], height: +i.height.toFixed(2), walkDuration: i.walkDuration, walkSpeed: i.walkSpeed,
           bones: i.bones, tris: i.tris, bytes: i.size }; });
fs.writeFileSync(path.join(out, "index.json"), JSON.stringify(list, null, 1) + "\n");
console.log(JSON.stringify(list, null, 1));' "$OUT"
