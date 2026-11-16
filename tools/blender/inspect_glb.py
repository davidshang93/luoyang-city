# Inspect a GLB and render a preview.  Usage:
#   Blender --background --factory-startup --python tools/blender/inspect_glb.py -- model.glb preview.png
import bpy, sys, math, mathutils
argv = sys.argv[sys.argv.index('--') + 1:]
src, out = argv[0], argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
verts = sum(len(o.data.vertices) for o in meshes)
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
lo = mathutils.Vector((1e9,) * 3); hi = mathutils.Vector((-1e9,) * 3)
for o in meshes:
    for c in o.bound_box:
        w = o.matrix_world @ mathutils.Vector(c)
        lo = mathutils.Vector(map(min, lo, w)); hi = mathutils.Vector(map(max, hi, w))
size = hi - lo; ctr = (hi + lo) / 2
print('STATS meshes=%d verts=%d tris=%d size=(%.2f, %.2f, %.2f) materials=%d' % (len(meshes), verts, tris, size.x, size.y, size.z, len(bpy.data.materials)))
for img in bpy.data.images:
    if img.size[0]: print('IMAGE', img.name, img.size[0], 'x', img.size[1])
for m in bpy.data.materials:
    if m.use_nodes:
        print('MATERIAL', m.name, [n.type for n in m.node_tree.nodes if n.type in ('TEX_IMAGE', 'NORMAL_MAP', 'BSDF_PRINCIPLED')])
# render
scn = bpy.context.scene
scn.render.engine = 'BLENDER_EEVEE_NEXT'
scn.render.resolution_x, scn.render.resolution_y = 1100, 800
scn.render.filepath = out
world = bpy.data.worlds.new('w'); scn.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.62, 0.74, 0.88, 1); world.node_tree.nodes['Background'].inputs[1].default_value = 1.0
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 4; sun.rotation_euler = (math.radians(50), 0, math.radians(35)); scn.collection.objects.link(sun)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scn.collection.objects.link(cam); scn.camera = cam
R = max(size.x, size.y, size.z)
cam.location = ctr + mathutils.Vector((R * 1.05, -R * 1.45, R * 0.6))
cam.rotation_euler = (ctr - cam.location).to_track_quat('-Z', 'Y').to_euler()
cam.data.clip_end = R * 20
bpy.ops.render.render(write_still=True)
print('RENDERED', out)
