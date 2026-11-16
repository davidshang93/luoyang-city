# Image-to-3D through the public Hunyuan3D-2 demo on Hugging Face (free, per-account GPU quota).
# Usage: .venv/bin/python tools/hf/hunyuan_space.py <input image> <output.glb> [space]
import sys, shutil, time, os
from gradio_client import Client, handle_file
src, dst = sys.argv[1], sys.argv[2]
space = sys.argv[3] if len(sys.argv) > 3 else "tencent/Hunyuan3D-2.1"
t0 = time.time()
c = Client(space, verbose=False, hf_token=os.environ.get("HF_TOKEN") or None)
kw = dict(image=handle_file(src), mv_image_front=None, mv_image_back=None, mv_image_left=None, mv_image_right=None,
          steps=30, guidance_scale=5.0, seed=1234, octree_resolution=384, check_box_rembg=True, num_chunks=8000, randomize_seed=False)
if "2.1" not in space: kw["caption"] = None   # the 2.0 demos also take a text caption
res = c.predict(api_name="/generation_all", **kw)
files = [r for r in res[:2] if r]
print("returned:", [(type(r).__name__, str(r)[:120]) for r in res[:2]], "stats:", str(res[3])[:300])
def path_of(r): return r.get("value", r.get("path")) if isinstance(r, dict) else r
textured = path_of(res[1]) or path_of(res[0])
shutil.copy(textured, dst)
print("SAVED", dst, os.path.getsize(dst), "bytes in", round(time.time() - t0), "s")
