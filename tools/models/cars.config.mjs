// Per-vehicle conversion settings for tools/models/build-cars.mjs (see carla.js api.build for what each field does).
// Coordinates are metres in model space: +Z front, +X left, Y up, ground at y = 0. Boxes are [x0, y0, z0, x1, y1, z1].
// Everything under "erase" / "drop" / "paint2d" exists to remove the real-world brand marks the source models carry;
// tools/models/text_boxes.json (made by find_text.py) additionally lists every piece of text found on the textures, all
// of which is painted out. The game must never show a brand name or logo.
const CARLA = 'CARLA Simulator (carla.org), CC BY 4.0; glTF conversion: Valdrada (M. K. Turkcan)';
const F = (x0, x1, y0, y1, z0) => [x0, y0, z0, x1, y1, 9], B = (x0, x1, y0, y1, z1) => [x0, y0, -9, x1, y1, z1];

export default {
  sedan: { src: 'impala', lod: 'LOD0', credit: CARLA,
    mats: { 'Interior': { as: 'solid', color: [0.035, 0.035, 0.04], rough: 0.85, metal: 0 }, 'PolishedAluminium': { as: 'solid', color: [0.8, 0.8, 0.82], rough: 0.18, metal: 1 }, 'LightText': { noOrm: true, rough: 0.15, metal: 0.2 } },
    drop: [{ mat: 'PolishedAluminium', box: F(-0.16, 0.16, 0.54, 0.68, 2.2), note: 'grille emblem' }, { mat: 'PolishedAluminium', box: B(-0.16, 0.16, 0.86, 1.02, -2.2), note: 'boot emblem' }],
    hubCap: 0.075 },
  suv: { src: 'suv', lod: 'LOD1', credit: CARLA, plateF: [0, 0.69], plateR: [0, 1.06],
    erase: [{ box: [0.2, 1.0, 0.3, 0.65, 1.6, 1.1], mat: '^(?!paint|glass|lens)', note: 'steering-wheel hub / dashboard marks (cabin)' }, { box: F(-0.2, 0.2, 0.96, 1.1, 2.3), note: 'grille badge' }, { box: B(-0.14, 0.14, 1.4, 1.58, -2.4), note: 'tailgate badge' }],
    hubCap: 0.09 },
  taxi: { src: 'taxi', lod: 'LOD1', credit: CARLA, plateF: [0, 0.42], plateR: [0, 0.77],
    drop: [{ mat: 'Details', box: B(-0.14, 0.14, 0.84, 0.97, -2.3), note: 'boot badge' }],
    recolor: [{ mat: 'Details', box: F(-0.37, 0.37, 0.57, 0.86, 2.3), color: [0.012, 0.012, 0.014], rough: 0.45, note: 'grille (LOD1 left it as a pale card with part of the oval badge on it)' }],
    erase: [{ box: [0.18, 0.75, 0.2, 0.58, 1.2, 0.9], mat: '^(?!paint|glass|lens)', note: 'steering-wheel hub / dashboard marks (cabin)' }, { box: B(0.2, 0.66, 0.68, 0.88, -2.2), fill: [10, 10, 12], note: 'US plate on the boot' }, { box: [-0.4, 1.4, -0.5, 0.4, 1.6, -0.05], fill: [235, 230, 210], note: 'roof sign medallion number' }],
    hubCap: 0.08,
    decals: [{ region: 'taxiDoor', side: 'both', zA: 0.86, zB: -0.74, y0: 0.6, y1: 0.8 }, { region: 'taxiSign', c: [0, 1.475, -0.27], w: 0.5, h: 0.094, depth: 0.14 }] },
  police: { src: 'police', lod: 'LOD1', credit: CARLA, paint: 0xf2f3f4,
    erase: [{ box: [0.18, 0.75, 0.2, 0.58, 1.2, 0.9], mat: '^(?!paint|glass|lens)', note: 'steering-wheel hub / dashboard marks (cabin)' }, { box: F(-0.2, 0.2, 0.62, 0.9, 2.2), note: 'grille badge' }, { box: B(-0.4, 0.4, 0.86, 0.95, -2.3), note: 'boot lettering' }],
    hubCap: 0.08,
    lights: [{ p: [0.78, 0.76, 2.5], col: 'white' }, { p: [-0.78, 0.76, 2.5], col: 'white' }, { p: [0.7, 0.955, -2.5], col: 'red' }, { p: [-0.7, 0.955, -2.5], col: 'red' }],
    decals: [{ region: 'policeBlue', side: 'both', zA: 1.02, zB: -1.06, y0: 0.7, y1: 0.79, nu: 24 }, { region: 'police', side: 'both', zA: 0.86, zB: -0.2, y0: 0.655, y1: 0.835, off: 0.009 }],
    boxes: [{ c: [0.3, 1.668, -0.04], s: [0.46, 0.05, 0.2], glow: 'red' }, { c: [-0.3, 1.668, -0.04], s: [0.46, 0.05, 0.2], glow: 'blue' }] },
  sports: { src: 'mustang', lod: 'LOD0', credit: CARLA,
    drop: [{ mat: 'Details|LightsText', box: F(-0.13, 0.13, 0.62, 0.8, 2.0), note: 'grille emblem' }, { mat: 'Details|LightsText', box: F(-0.45, 0.45, 0.805, 0.9, 2.05), note: 'bonnet-edge letters' }, { mat: 'Details|LightsText', box: B(-0.09, 0.09, 0.6, 0.8, -2.0), note: 'fuel-cap emblem' }],
    erase: [{ box: [0.15, 0.65, -0.1, 0.6, 1.15, 0.7], mat: '^(?!paint|glass|lens)', note: 'steering-wheel hub / dashboard marks (cabin)' }, { box: F(-0.5, 0.5, 0.79, 0.9, 1.9), note: 'bonnet-edge lettering' }],
    lights: [{ p: [0.7, 0.73, 2.2], col: 'white' }, { p: [-0.7, 0.73, 2.2], col: 'white' }, { p: [0.63, 0.72, -2.2], col: 'red' }, { p: [-0.63, 0.72, -2.2], col: 'red' }],
    hubCap: 0.07, tyreText: true },
  van: { src: 'van', lod: 'LOD1', credit: CARLA,
    drop: [{ mat: 'Details', box: F(-0.15, 0.15, 0.73, 1.01, 2.6), note: 'grille star' }],
    boxes: [{ c: [0, 0.87, 2.83], s: [0.3, 0.28, 0.03], color: [0.02, 0.02, 0.022], rough: 0.5, name: 'grilleBlank' }],
    erase: [{ box: [0.25, 1.2, 1.1, 0.75, 1.8, 2.0], mat: '^(?!paint|glass|lens)', note: 'steering-wheel hub / dashboard marks (cabin)' }, { box: F(-0.16, 0.16, 0.72, 1.02, 2.5), note: 'grille star texels' }, { box: B(0.15, 1.05, 0.95, 1.2, -2.6), note: 'rear door lettering' }],
    hubCap: 0.09 },
  bus: { src: 'minibus', lod: 'LOD1', credit: CARLA, plateF: [0, 0.5], plateR: [0, 0.47],
    erase: [{ box: [0.35, 1.1, 2.1, 1.0, 1.75, 2.95], mat: '^(?!paint|glass|lens)', note: 'steering-wheel hub / dashboard marks (cabin)' }, { box: F(-0.7, 0.7, 1.05, 1.5, 2.9), note: 'front badge + lettering' }, { box: B(-1.1, 1.1, 0.7, 0.9, -2.9), note: 'rear model name' }],
    hubCap: 0.1,
    decals: [{ region: 'busSide', side: 'both', zA: 0.95, zB: -0.85, y0: 1.02, y1: 1.17 }, { region: 'busNum', c: [0, 1.5, 0], w: 0.5, h: 0.125, dirs: [-1], snap: true }] },
  truck: { src: 'boxtruck26', lod: 'LOD1', credit: 'Valdrada (M. K. Turkcan), CC BY 4.0', keepLamp: true,
    lights: [{ p: [0.95, 0.95, 5], col: 'white' }, { p: [-0.95, 0.95, 5], col: 'white' }, { p: [0.5, 1.0, -5], col: 'red' }, { p: [-0.5, 1.0, -5], col: 'red' }],
    decals: [{ region: 'truck', side: 'both', zA: 0.5, zB: -3.98, y0: 2.25, y1: 2.95, nu: 2, nv: 1 }] },
};
