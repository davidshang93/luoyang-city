# Normalise an AI-generated GLB for the game: one mesh, sits on the ground, centred, scaled to real metres,
# decimated, textures resized, re-exported as GLB (JPEG textures).
# Usage: Blender --background --factory-startup --python tools/blender/process_glb.py -- in.glb out.glb --width 174 [--tris 60000] [--tex 2048] [--yaw 0]
#        [--cut x0:x1:y0:y1 ...] [--remap axis:a:b:factor ...] [--height 88]
# --cut and --remap work in Blender axes (X = three.js X, Y = -three.js Z, Z = up), in metres, after the model has been
# scaled to --width and centred (tools/blender/heightmap_glb.py prints a map in three.js axes to pick the numbers).
#   --cut    deletes every face whose centre is inside the box (any height) and caps the holes it leaves.
#   --remap  piecewise stretch: coordinates between a and b are scaled by factor about a, everything beyond b is shifted
#            (e.g. z:8:60:1.55 makes a tower taller without stretching its platform; x:0:60:0.5 shortens long wings).
#   --height uniform vertical stretch to an exact total height (applied last).
import bpy, bmesh, sys, math, mathutils, argparse
argv = sys.argv[sys.argv.index('--') + 1:]
ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('dst')
ap.add_argument('--width', type=float, required=True, help='target size in metres of the longest horizontal side')
ap.add_argument('--tris', type=int, default=60000)
ap.add_argument('--tex', type=int, default=2048)
ap.add_argument('--yaw', type=float, default=0, help='extra rotation about the up axis, degrees')
ap.add_argument('--cut', action='append', default=[]); ap.add_argument('--remap', action='append', default=[])
ap.add_argument('--height', type=float, default=0)
a = ap.parse_args(argv)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.src)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for o in bpy.context.scene.objects: o.select_set(o.type == 'MESH')
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1: bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
for o in list(bpy.context.scene.objects):
    if o != obj: bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

def bbox():
    vs = [obj.matrix_world @ v.co for v in obj.data.vertices]
    lo = mathutils.Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    hi = mathutils.Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    return lo, hi

if a.yaw:
    obj.rotation_euler.z = math.radians(a.yaw); bpy.ops.object.transform_apply(rotation=True)
lo, hi = bbox(); size = hi - lo
k = a.width / max(size.x, size.y)
obj.scale = (k, k, k); bpy.ops.object.transform_apply(scale=True)
lo, hi = bbox()
obj.location = (-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z); bpy.ops.object.transform_apply(location=True)

if a.cut or a.remap or a.height:
    bm = bmesh.new(); bm.from_mesh(obj.data); uvl = bm.loops.layers.uv.active
    for spec in a.cut:
        x0, x1, y0, y1 = map(float, spec.split(':'))
        # slice the mesh along the four sides of the box first, so the cut edges come out straight instead of jagged
        for co, no in (((x0, 0, 0), (1, 0, 0)), ((x1, 0, 0), (1, 0, 0)), ((0, y0, 0), (0, 1, 0)), ((0, y1, 0), (0, 1, 0))):
            near = [g for g in list(bm.verts) + list(bm.edges) + list(bm.faces) if all(x0 - 6 < v.co.x < x1 + 6 and y0 - 6 < v.co.y < y1 + 6 for v in (g.verts if hasattr(g, 'verts') else [g]))]
            bmesh.ops.bisect_plane(bm, geom=near, dist=0.0005, plane_co=co, plane_no=no)
        dead = [f for f in bm.faces if x0 < f.calc_center_median().x < x1 and y0 < f.calc_center_median().y < y1]
        bmesh.ops.delete(bm, geom=dead, context='FACES')
        edges = [e for e in bm.edges if e.is_boundary and all(x0 - 1.5 < v.co.x < x1 + 1.5 and y0 - 1.5 < v.co.y < y1 + 1.5 for v in e.verts)]
        old = set(bm.faces)
        new = bmesh.ops.holes_fill(bm, edges=edges, sides=0)['faces']
        if uvl:  # give the caps the texture coordinates of the surface they touch
            for f in new:
                for l in f.loops:
                    for o in l.vert.link_loops:
                        if o.face in old: l[uvl].uv = o[uvl].uv; break
        bmesh.ops.triangulate(bm, faces=new)
        print('CUT', spec, 'removed', len(dead), 'faces, capped', len(new), 'holes')
    for spec in a.remap:
        ax, lo_, hi_, f = spec.split(':'); i = 'xyz'.index(ax); lo_, hi_, f = float(lo_), float(hi_), float(f)
        for v in bm.verts:
            c = v.co[i]
            if c > hi_: v.co[i] = c + (hi_ - lo_) * (f - 1)
            elif c > lo_: v.co[i] = lo_ + (c - lo_) * f
    bm.normal_update(); bm.to_mesh(obj.data); bm.free(); obj.data.update()
    lo, hi = bbox()
    if a.height: obj.scale = (1, 1, a.height / (hi.z - lo.z)); bpy.ops.object.transform_apply(scale=True); lo, hi = bbox()
    obj.location = (-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z); bpy.ops.object.transform_apply(location=True)

tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
if tris > a.tris:
    m = obj.modifiers.new('dec', 'DECIMATE'); m.ratio = a.tris / tris
    bpy.ops.object.modifier_apply(modifier=m.name)
bpy.ops.object.shade_smooth()
for img in bpy.data.images:
    w, h = img.size
    if w > a.tex or h > a.tex:
        s = a.tex / max(w, h); img.scale(max(1, int(w * s)), max(1, int(h * s)))
lo, hi = bbox(); size = hi - lo
print('PROCESSED tris=%d size=(%.1f, %.1f, %.1f) k=%.3f' % (sum(len(p.vertices) - 2 for p in obj.data.polygons), size.x, size.y, size.z, k))
bpy.ops.export_scene.gltf(filepath=a.dst, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=85, export_yup=True, export_apply=True)
print('EXPORTED', a.dst)
