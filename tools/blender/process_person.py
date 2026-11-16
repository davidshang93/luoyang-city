# Convert one Microsoft Rocketbox avatar (3ds Max Biped FBX + TGA textures) into a small game-ready rigged GLB with
# two embedded clips, `walk` (in-place loop) and `idle`.
# Usage: Blender --background --factory-startup --python tools/blender/process_person.py -- \
#          <avatar.fbx> <walk.fbx> <idle.fbx> <out.glb> [--texdir DIR] [--info out.json] [--fps 15] [--body 1024] [--head 512] [--alpha 512]
#   --texdir  folder with *_body_color.tga, *_head_color.tga, *_opacity_color.tga (default: folder of avatar.fbx)
#   --info    writes {height, bones, tris, walkDuration, walkSpeed, walkSpeedClip, ...} as JSON
# Batch driver for all 8 avatars: tools/models/build-people.sh
#
# What it does
#   * bakes the Biped armature transform (0.01 scale, -90 deg yaw) so the armature is identity, metres, Z up in Blender
#     (= Y up, facing +Z in glTF), feet on z=0
#   * reduces the skeleton to KEEP (26 bones): facial/eye bones merge into Head, finger segments merge into Finger0
#     (thumb) / Finger1 (other four fingers), toes keep Toe0
#   * retargets each clip in world space: every kept bone takes the world rotation of the same-named bone of the clip's
#     own armature; the pelvis also takes the world position, scaled by the leg-length ratio. The clip's forward drift is
#     removed (linear over the clip) so `walk` is in place; vertical bob and side sway stay
#   * resamples at --fps, keys only rotations (plus pelvis location), exports GLB with materials body/head/alpha,
#     then patches the GLB JSON (alphaMode MASK 0.5 + doubleSided on alpha) and drops non-root translation / all scale tracks
import bpy, sys, os, math, json, struct, argparse, glob
from mathutils import Matrix, Vector, Quaternion

argv = sys.argv[sys.argv.index('--') + 1:]
ap = argparse.ArgumentParser()
ap.add_argument('avatar'); ap.add_argument('walk'); ap.add_argument('idle'); ap.add_argument('dst')
ap.add_argument('--texdir', default=''); ap.add_argument('--info', default='')
ap.add_argument('--fps', type=int, default=15)
ap.add_argument('--body', type=int, default=1024); ap.add_argument('--head', type=int, default=512); ap.add_argument('--alpha', type=int, default=512)
ap.add_argument('--cutoff', type=float, default=0.5)
a = ap.parse_args(argv)
texdir = a.texdir or os.path.dirname(os.path.abspath(a.avatar))
tmpdir = os.path.splitext(os.path.abspath(a.dst))[0] + '_tex_tmp'
os.makedirs(tmpdir, exist_ok=True)

KEEP = ['Bip01 Pelvis', 'Bip01 Spine', 'Bip01 Spine1', 'Bip01 Spine2', 'Bip01 Neck', 'Bip01 Head']
for s in ('L', 'R'):
    KEEP += [f'Bip01 {s} Clavicle', f'Bip01 {s} UpperArm', f'Bip01 {s} Forearm', f'Bip01 {s} Hand',
             f'Bip01 {s} Finger0', f'Bip01 {s} Finger1',
             f'Bip01 {s} Thigh', f'Bip01 {s} Calf', f'Bip01 {s} Foot', f'Bip01 {s} Toe0']
ROOT = 'Bip01 Pelvis'

def merge_target(name, bones):
    """kept bone that receives the weights of `name`"""
    import re
    m = re.match(r'Bip01 ([LR]) Finger(\d)', name)
    if m: return f'Bip01 {m.group(1)} Finger0' if m.group(2) == '0' else f'Bip01 {m.group(1)} Finger1'
    b = bones.get(name)
    while b is not None and b.name not in KEEP: b = b.parent
    return b.name if b else ROOT

# ---------------------------------------------------------------- avatar
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=a.avatar, automatic_bone_orientation=False)
arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
mesh = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
for o in (arm, mesh): o.animation_data_clear()
for o in list(bpy.context.scene.objects):
    if o not in (arm, mesh): bpy.data.objects.remove(o, do_unlink=True)
for pb in arm.pose.bones:
    pb.matrix_basis = Matrix(); pb.rotation_mode = 'QUATERNION'
bpy.context.view_layer.update()

# bake the mesh in its bind pose to world space, unparent, then bake the armature transform and re-skin
mw = mesh.matrix_world.copy()
mesh.parent = None; mesh.matrix_world = mw
for o in bpy.context.scene.objects: o.select_set(False)
mesh.select_set(True); bpy.context.view_layer.objects.active = mesh
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
mesh.select_set(False); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
mesh.parent = arm; mesh.matrix_parent_inverse = Matrix()
mod = next((m for m in mesh.modifiers if m.type == 'ARMATURE'), None) or mesh.modifiers.new('Armature', 'ARMATURE')
mod.object = arm
bpy.context.view_layer.update()

# weights: merge removed bones into their kept target, delete removed bones
bones = {b.name: b for b in arm.data.bones}
vg = mesh.vertex_groups
for k in KEEP:
    if k not in vg: vg.new(name=k)
idx = {g.index: g.name for g in vg}
for v in mesh.data.vertices:
    acc = {}
    for g in v.groups:
        n = idx[g.group]
        if n in KEEP: continue
        t = merge_target(n, bones); acc[t] = acc.get(t, 0) + g.weight
    for t, w in acc.items():
        vg[t].add([v.index], w, 'ADD')
for g in list(vg):
    if g.name not in KEEP: vg.remove(g)
bpy.ops.object.mode_set(mode='EDIT')
for eb in list(arm.data.edit_bones):
    if eb.name not in KEEP: arm.data.edit_bones.remove(eb)
bpy.ops.object.mode_set(mode='OBJECT')
missing = [k for k in KEEP if k not in arm.data.bones]
assert not missing, missing
# renormalise weights and keep 4 influences
mesh.select_set(True); bpy.context.view_layer.objects.active = mesh
bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
bpy.ops.object.mode_set(mode='OBJECT')
arm.name = 'Rig'; arm.data.name = 'Rig'; mesh.name = 'Body'
for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'

# order kept bones parent-first
order = [b.name for b in arm.data.bones if b.parent is None]
i = 0
while i < len(order):
    order += [c.name for c in arm.data.bones[order[i]].children]; i += 1

def leg_len(ab, world):
    p = [world @ ab[f'Bip01 L {n}'].head_local for n in ('Thigh', 'Calf', 'Foot')]
    return (p[1] - p[0]).length + (p[2] - p[1]).length
LEG_A = leg_len(arm.data.bones, Matrix())
vs = [v.co for v in mesh.data.vertices]
height = max(v.z for v in vs); floor = min(v.z for v in vs)
print('AVATAR height', round(height, 3), 'floor', round(floor, 4), 'leg', round(LEG_A, 3))

# ---------------------------------------------------------------- materials / textures
def find_tex(kind):
    g = glob.glob(os.path.join(texdir, f'*_{kind}_color.tga'))
    return g[0] if g else None

def bleed_rgb(img, iters=16, thresh=0.5):
    """Edge padding for the alpha texture: texels with alpha < thresh get the colour of the nearest texels with
    alpha >= thresh (iterative 8-neighbour dilation, `iters` px), the rest get the mean opaque colour, so bilinear
    filtering / mipmaps never pull a foreign colour into the cut-out edge. The alpha channel is left unchanged."""
    import numpy as np
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32); img.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    rgb = px[..., :3].copy(); known = px[..., 3] >= thresh
    if not known.any(): return
    mean = rgb[known].mean(0)
    rgb[~known] = 0
    for _ in range(iters):
        if known.all(): break
        acc = np.zeros_like(rgb); cnt = np.zeros((h, w), np.float32)
        kf = known.astype(np.float32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy == 0 and dx == 0: continue
                acc += np.roll(np.roll(rgb * kf[..., None], dy, 0), dx, 1)
                cnt += np.roll(np.roll(kf, dy, 0), dx, 1)
        grow = (~known) & (cnt > 0)
        rgb[grow] = acc[grow] / cnt[grow][:, None]
        known = known | grow
    rgb[~known] = mean
    px[..., :3] = rgb
    img.pixels.foreach_set(px.ravel())

def prep_image(src, size, fmt, name):
    img = bpy.data.images.load(src)
    if max(img.size) > size: img.scale(size, size)
    ext = 'jpg' if fmt == 'JPEG' else 'png'
    out = os.path.join(tmpdir, f'{name}.{ext}')
    sc = bpy.context.scene.render.image_settings
    sc.file_format = fmt; sc.quality = 85
    sc.color_mode = 'RGB' if fmt == 'JPEG' else 'RGBA'
    sc.compression = 90
    if fmt == 'PNG': bleed_rgb(img)
    # save_render applies the scene view transform (AgX by default), which darkens textures: use Standard (identity)
    vs = bpy.context.scene.view_settings
    vs.view_transform = 'Standard'; vs.look = 'None'; vs.exposure = 0; vs.gamma = 1
    img.save_render(out, scene=bpy.context.scene)
    bpy.data.images.remove(img)
    im = bpy.data.images.load(out); im.name = name
    return im

def make_mat(name, img, alpha):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.85; bsdf.inputs['Metallic'].default_value = 0.0
    if alpha:
        nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
        m.use_backface_culling = False
    else:
        m.use_backface_culling = True
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return m

kinds = {}
for i, m in enumerate(mesh.data.materials):
    n = m.name.lower()
    kinds[i] = 'alpha' if 'opacity' in n else 'head' if 'head' in n else 'body'
mats = {}
mats['body'] = make_mat('body', prep_image(find_tex('body'), a.body, 'JPEG', 'body'), False)
mats['head'] = make_mat('head', prep_image(find_tex('head'), a.head, 'JPEG', 'head'), False)
if 'alpha' in kinds.values():
    src = find_tex('opacity'); assert src, 'alpha material but no opacity texture'
    mats['alpha'] = make_mat('alpha', prep_image(src, a.alpha, 'PNG', 'alpha'), True)
names = [kinds[i] for i in range(len(mesh.data.materials))]
uniq = list(dict.fromkeys(names))
remap = [uniq.index(n) for n in names]
old_idx = [p.material_index for p in mesh.data.polygons]
mesh.data.materials.clear()  # (this resets polygon material indices, so they are restored below)
for n in uniq: mesh.data.materials.append(mats[n])
for p, oi in zip(mesh.data.polygons, old_idx): p.material_index = remap[oi]
# keep only the first UV map
while len(mesh.data.uv_layers) > 1: mesh.data.uv_layers.remove(mesh.data.uv_layers[-1])
tris = sum(len(p.vertices) - 2 for p in mesh.data.polygons)

# ---------------------------------------------------------------- animation retarget
REST = {b.name: b.matrix_local.copy() for b in arm.data.bones}
PARENT = {b.name: (b.parent.name if b.parent else None) for b in arm.data.bones}

def retarget(path, action_name, inplace):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False)
    new = [o for o in bpy.data.objects if o not in before]
    src = next(o for o in new if o.type == 'ARMATURE')
    act = src.animation_data.action
    f0, f1 = int(round(act.frame_range[0])), int(round(act.frame_range[1]))
    src_fps = bpy.context.scene.render.fps / bpy.context.scene.render.fps_base
    leg_b = leg_len(src.data.bones, src.matrix_world)  # rest-pose leg length of the clip armature (world, metres)
    # the clip armature's object transform is animated, so measure the rest leg in armature space times its scale
    sc = src.matrix_world.to_scale()[0]
    leg_b = leg_len(src.data.bones, Matrix.Scale(sc, 4))
    ratio = LEG_A / leg_b
    dur = (f1 - f0) / src_fps
    n = max(1, round(dur * a.fps))
    samples = []
    for i in range(n + 1):
        t = f0 + (f1 - f0) * i / n
        bpy.context.scene.frame_set(int(math.floor(t)), subframe=t - math.floor(t))
        W = src.matrix_world
        fr = {}
        for name in KEEP:
            M = W @ src.pose.bones[name].matrix
            fr[name] = (M.to_translation(), M.to_3x3().normalized().to_quaternion())
        samples.append(fr)
    p0 = samples[0][ROOT][0]; p1 = samples[-1][ROOT][0]
    drift = Vector((p1.x - p0.x, p1.y - p0.y, 0))
    speed = drift.length / dur
    heading = math.degrees(math.atan2(drift.x, -drift.y)) if drift.length > 1e-4 else 0.0
    # loop seam check: compare local rotations of first and last sample
    seam = 0.0
    for name in KEEP:
        q0 = samples[0][name][1]; q1 = samples[-1][name][1]
        seam = max(seam, math.degrees(q0.rotation_difference(q1).angle))
    for o in new: bpy.data.objects.remove(o, do_unlink=True)
    for ac in [x for x in bpy.data.actions if x.users == 0]: bpy.data.actions.remove(ac)

    acn = bpy.data.actions.new(action_name)
    arm.animation_data_create(); arm.animation_data.action = acn
    base = Vector((p0.x, p0.y, 0))
    for i, fr in enumerate(samples):
        frac = i / n
        P = {}
        for name in order:
            loc, q = fr[name]
            if name == ROOT:
                pos = loc - base - (drift * frac if inplace else Vector())
                if not inplace: pos = loc - base
                pos = pos * ratio
                P[name] = Matrix.LocRotScale(pos, q, None)
            else:
                P[name] = Matrix.LocRotScale(Vector(), q, None)
        for name in order:
            pb = arm.pose.bones[name]
            par = PARENT[name]
            if par is None:
                basis = REST[name].inverted() @ P[name]
                pb.location = basis.to_translation()
                pb.rotation_quaternion = basis.to_quaternion()
            else:
                L = REST[par].inverted() @ REST[name]
                qb = L.to_quaternion().inverted() @ P[par].to_quaternion().inverted() @ P[name].to_quaternion()
                pb.location = Vector(); pb.rotation_quaternion = qb
        # keep quaternions continuous
        for name in order:
            pb = arm.pose.bones[name]
            if i > 0:
                prev = prevq[name]
                if prev.dot(pb.rotation_quaternion) < 0: pb.rotation_quaternion = -pb.rotation_quaternion
            pb.keyframe_insert('rotation_quaternion', frame=i, group=name)
            if name == ROOT: pb.keyframe_insert('location', frame=i, group=name)
        prevq = {nm: arm.pose.bones[nm].rotation_quaternion.copy() for nm in order}
    for fc in acn.fcurves:
        for k in fc.keyframe_points: k.interpolation = 'LINEAR'
    acn.use_fake_user = True
    trk = arm.animation_data.nla_tracks.new(); trk.name = action_name
    trk.strips.new(action_name, 0, acn)
    arm.animation_data.action = None
    return dict(duration=n / a.fps, srcDuration=dur, speed=speed, heading=heading, seamDeg=seam, ratio=ratio, frames=n)

wk = retarget(a.walk, 'walk', True)
il = retarget(a.idle, 'idle', True)
print('WALK', wk); print('IDLE', il)

# rest pose for export; drop every action except the two clips
for ac in list(bpy.data.actions):
    if ac.name not in ('walk', 'idle'): bpy.data.actions.remove(ac)
for pb in arm.pose.bones: pb.matrix_basis = Matrix()
bpy.context.scene.render.fps = a.fps; bpy.context.scene.render.fps_base = 1
bpy.context.scene.frame_start = 0; bpy.context.scene.frame_end = max(wk['frames'], il['frames'])
bpy.context.scene.frame_set(0)

# ---------------------------------------------------------------- export
for o in bpy.context.scene.objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=a.dst, export_format='GLB', use_selection=False,
    export_image_format='AUTO', export_texcoords=True, export_normals=True, export_tangents=False,
    export_materials='EXPORT', export_skins=True, export_all_influences=False, export_morph=False,
    export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True, export_frame_step=1,
    export_optimize_animation_size=False, export_def_bones=False, export_anim_single_armature=True,
    export_yup=True, export_apply=False, export_extras=False, export_cameras=False, export_lights=False)

# ---------------------------------------------------------------- patch GLB: alpha mode, drop unwanted channels, repack
def read_glb(p):
    b = open(p, 'rb').read()
    assert b[:4] == b'glTF'
    off = 12; js = None; bin_ = b''
    while off < len(b):
        ln, ty = struct.unpack_from('<II', b, off); chunk = b[off + 8: off + 8 + ln]
        if ty == 0x4E4F534A: js = json.loads(chunk)
        elif ty == 0x004E4942: bin_ = chunk
        off += 8 + ln
    return js, bin_

def write_glb(p, js, bin_):
    j = json.dumps(js, separators=(',', ':')).encode()
    j += b' ' * ((4 - len(j) % 4) % 4)
    bin_ += b'\0' * ((4 - len(bin_) % 4) % 4)
    total = 12 + 8 + len(j) + 8 + len(bin_)
    with open(p, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(j), 0x4E4F534A)); f.write(j)
        f.write(struct.pack('<II', len(bin_), 0x004E4942)); f.write(bin_)

js, bin_ = read_glb(a.dst)
for m in js.get('materials', []):
    if m['name'] == 'alpha':
        m['alphaMode'] = 'MASK'; m['alphaCutoff'] = a.cutoff; m['doubleSided'] = True
    else:
        m.pop('alphaMode', None); m.pop('alphaCutoff', None)
nodes = js['nodes']
root_nodes = {i for i, nd in enumerate(nodes) if nd.get('name') == ROOT}
for an in js.get('animations', []):
    keep_ch = []
    for ch in an['channels']:
        tp = ch['target'].get('path'); nd = ch['target'].get('node')
        if tp == 'scale': continue
        if tp == 'translation' and nd not in root_nodes: continue
        if nd is not None and nodes[nd].get('name') not in KEEP: continue
        keep_ch.append(ch)
    used = sorted({c['sampler'] for c in keep_ch})
    sm = {old: new for new, old in enumerate(used)}
    an['samplers'] = [an['samplers'][o] for o in used]
    for c in keep_ch: c['sampler'] = sm[c['sampler']]
    an['channels'] = keep_ch
# repack: keep only referenced accessors / bufferViews
used_acc = set()
def mark(v):
    if v is not None: used_acc.add(v)
for me in js.get('meshes', []):
    for pr in me['primitives']:
        for v in pr['attributes'].values(): mark(v)
        mark(pr.get('indices'))
for sk in js.get('skins', []): mark(sk.get('inverseBindMatrices'))
for an in js.get('animations', []):
    for s in an['samplers']: mark(s['input']); mark(s['output'])
acc_old = js['accessors']; acc_map = {}; new_acc = []
for i, ac in enumerate(acc_old):
    if i in used_acc: acc_map[i] = len(new_acc); new_acc.append(ac)
used_bv = {ac['bufferView'] for ac in new_acc if 'bufferView' in ac} | {im['bufferView'] for im in js.get('images', []) if 'bufferView' in im}
bv_map = {}; new_bv = []; out = bytearray()
for i, bv in enumerate(js['bufferViews']):
    if i not in used_bv: continue
    while len(out) % 4: out += b'\0'
    data = bin_[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']]
    nb = dict(bv); nb['byteOffset'] = len(out); out += data
    bv_map[i] = len(new_bv); new_bv.append(nb)
for ac in new_acc:
    if 'bufferView' in ac: ac['bufferView'] = bv_map[ac['bufferView']]
for im in js.get('images', []):
    if 'bufferView' in im: im['bufferView'] = bv_map[im['bufferView']]
for me in js.get('meshes', []):
    for pr in me['primitives']:
        pr['attributes'] = {k: acc_map[v] for k, v in pr['attributes'].items()}
        if 'indices' in pr: pr['indices'] = acc_map[pr['indices']]
for sk in js.get('skins', []):
    if 'inverseBindMatrices' in sk: sk['inverseBindMatrices'] = acc_map[sk['inverseBindMatrices']]
for an in js.get('animations', []):
    for s in an['samplers']: s['input'] = acc_map[s['input']]; s['output'] = acc_map[s['output']]
js['accessors'] = new_acc; js['bufferViews'] = new_bv
js['buffers'] = [{'byteLength': len(out)}]
write_glb(a.dst, js, bytes(out))

nbones = len(js['skins'][0]['joints'])
size = os.path.getsize(a.dst)
info = dict(height=round(height, 3), floor=round(floor, 4), bones=nbones, tris=tris, size=size,
            walkDuration=round(wk['duration'], 4), walkSpeed=round(wk['speed'] * wk['ratio'], 3),
            walkSpeedClip=round(wk['speed'], 3), walkHeadingDeg=round(wk['heading'], 2), walkSeamDeg=round(wk['seamDeg'], 2),
            idleDuration=round(il['duration'], 4), idleSeamDeg=round(il['seamDeg'], 2), idleDriftSpeed=round(il['speed'], 4),
            legRatio=round(wk['ratio'], 4), materials=[m['name'] for m in js['materials']],
            animations=[an['name'] for an in js['animations']])
print('INFO', json.dumps(info))
if a.info:
    with open(a.info, 'w') as f: json.dump(info, f, indent=1)
import shutil; shutil.rmtree(tmpdir, ignore_errors=True)
