// Example landmark module — copy this structure. See docs/LANDMARK_SPEC.md.
import { THREE, C, mat, box, cyl, plaza, hall, pagoda, tower, sign, tree, flag, patternTex, finalize } from './_kit.js';

export const meta = {
  // Boxes (local coords, metres) that block cars / the player. Leave walkable plazas & gate passages uncovered.
  colliders: [
    { x: 0, z: -20, w: 30, d: 18 },      // main hall
    { x: 45, z: 10, w: 20, d: 20 },      // office tower
    { x: -45, z: 10, w: 9, d: 9 },       // pagoda
  ],
};

export function build() {
  const g = new THREE.Group();
  g.add(plaza(140, 90, mat(C.paving, { map: patternTex('paving', C.paving) }), 0, 0, 0.15, 4));
  g.add(hall({ w: 26, d: 14, wallH: 6, roofH: 5.5, tiers: 2, z: -20 }));
  g.add(pagoda({ floors: 7, r: 4, floorH: 3.6, x: -45, z: 10 }));
  g.add(tower(20, 60, 20, { style: 'glass', glass: C.glassBlue, shiny: true, x: 45, z: 10 }));
  g.add(sign('示例地标', 12, 2.4, { x: 45, y: 8, z: 20.1 }));
  for (let i = -3; i <= 3; i++) g.add(tree(i * 18, 38, 9, i % 2 ? 'pine' : 'round'));
  g.add(flag(0, 30, 14));
  return finalize(g);
}
