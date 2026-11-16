# Print an ASCII height map of a GLB (top view, three.js axes: columns = +X to the right, rows = -Z at the top).
# Usage: Blender --background --factory-startup --python tools/blender/heightmap_glb.py -- model.glb [cell_m]
import bpy, sys, mathutils
argv = sys.argv[sys.argv.index('--') + 1:]
cell = float(argv[1]) if len(argv) > 1 else 4.0
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=argv[0])
H = {}
lo = [1e9] * 3; hi = [-1e9] * 3
for o in bpy.context.scene.objects:
    if o.type != 'MESH': continue
    for v in o.data.vertices:
        w = o.matrix_world @ v.co
        x, z, y = w.x, -w.y, w.z          # three.js: X = blender X, Z = -blender Y, Y(up) = blender Z
        k = (int(x // cell), int(z // cell)); H[k] = max(H.get(k, 0), y)
        for i, c in enumerate((x, y, z)): lo[i] = min(lo[i], c); hi[i] = max(hi[i], c)
print('BBOX three.js x[%.1f, %.1f] y[%.1f, %.1f] z[%.1f, %.1f]' % (lo[0], hi[0], lo[1], hi[1], lo[2], hi[2]))
xs = range(int(lo[0] // cell), int(hi[0] // cell) + 1); zs = range(int(lo[2] // cell), int(hi[2] // cell) + 1)
top = hi[1]
print('cols x from %.0f step %.0f; rows z from %.0f; digit = height/top*9 (top=%.1f m), . = empty' % (xs[0] * cell, cell, zs[0] * cell, top))
for gz in zs:
    print('%5.0f ' % (gz * cell) + ''.join(('.' if (gx, gz) not in H else str(min(9, int(H[(gx, gz)] / top * 9.99)))) for gx in xs))
