/**
 * The poblacion around the site.
 *
 * The reference photographs always show the town behind the church: rows of
 * low houses with galvanised or terracotta roofs, sari-sari stores, tricycles,
 * power poles, and beyond them the flat lahar plain with a low line of trees.
 * Without this the model reads as a building floating in a field, so we build
 * a believable ring of town geometry fed by a deterministic RNG.
 *
 * Draw cost is kept trivial by merging everything into a handful of meshes.
 */
import * as THREE from 'three';
import { Builder, box, cylinder, TEXSCALE } from './kit.js';
import { L, SCOPE } from './layout.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function buildTown(parent, M, seed = 7731) {
  const b = new Builder('town');
  const r = rng(seed);
  const G = new THREE.Group();
  G.name = 'town';
  parent.add(G);

  const hw0 = L.highway.cx - L.highway.halfWidth;
  const hw1 = L.highway.cx + L.highway.halfWidth;

  // Keep-out zones so nothing grows inside the modelled campus/shrine/plaza.
  const blocked = [
    { x0: -156, z0: -100, x1: -8, z1: 80 },   // campus + shrine
    { x0: -72, z0: -96, x1: -8, z1: -32 },    // plaza
    { x0: hw0 - 4, z0: -320, x1: hw1 + 4, z1: 320 }, // highway corridor
    { x0: 10, z0: 40, x1: 110, z1: -40 },     // municipal hall block
    { x0: 10, z0: 50, x1: 60, z1: 96 },       // market
  ];
  const isBlocked = (x, z, pad = 0) => blocked.some((k) =>
    x > k.x0 - pad && x < k.x1 + pad && z > Math.min(k.z0, k.z1) - pad && z < Math.max(k.z0, k.z1) + pad);

  /**
   * Everything from here down to the horizon ring is the surrounding poblacion:
   * houses, the barangay chapel row, two-storey commercial strip, highway power
   * poles with their catenary cables. All of it is OUT OF SCOPE — the brief is
   * the DCT campus, the shrine and the church park. Skipped wholesale when
   * SCOPE.poblacion is false; the horizon ring below is kept regardless because
   * without it the ground plane ends in a hard seam against the sky.
   *
   * This block was 65,000 triangles.
   */
  let count = 0;
  if (SCOPE.poblacion) {

  /* --------------------------------------------------------- house blocks */
  const tryHouse = (x, z, force = false) => {
    if (!force && isBlocked(x, z, 2)) return false;
    const w = 7 + r() * 9;
    const d = 6 + r() * 8;
    const h = 2.9 + r() * 1.4;
    const floors = r() > 0.78 ? 2 : 1;
    const H = floors === 2 ? h * 2 : h;
    const rot = (r() - 0.5) * 0.25 + (r() > 0.5 ? 0 : Math.PI / 2);
    const wallKey = ['houseWallA', 'houseWallB', 'houseWallC', 'houseWallD'][Math.floor(r() * 4)];
    const g = box(w, H, d, 2.2);
    g.rotateY(rot);
    g.translate(x, H / 2, z);
    b.addGeo(g, wallKey);

    // Roof: shallow gable of GI sheet or a hip of clay tiles
    const tile = r() > 0.55;
    const rise = 0.9 + r() * 1.1;
    const roofKey = tile ? 'roofTile' : (r() > 0.6 ? 'galv' : 'roofRust');
    const rw = w * 0.58, rd = d * 0.58;
    const ang = Math.atan2(rise, rd);
    for (const s of [-1, 1]) {
      const rg = box(w + 1.1, 0.1, Math.hypot(rd, rise) + 0.3, 1.4);
      rg.rotateX(s * ang);
      rg.rotateY(rot);
      const oz = s * rd / 2;
      rg.translate(x + Math.sin(rot) * oz, H + rise / 2, z + Math.cos(rot) * oz);
      b.addGeo(rg, roofKey);
    }
    // A few openings + a door so it doesn't read as a plain box
    const nWin = 2 + Math.floor(r() * 3);
    for (let i = 0; i < nWin; i++) {
      const wx = (r() - 0.5) * (w - 2.0);
      const wy = 1.2 + (floors === 2 && r() > 0.5 ? h : 0);
      const wg = box(0.9, 1.1, 0.12, 1);
      wg.rotateY(rot);
      wg.translate(x + Math.cos(rot) * wx, wy, z - Math.sin(rot) * wx - d / 2 + 0.2);
      b.addGeo(wg, 'glassDark');
    }
    // Sari-sari store awning on a few
    if (r() > 0.72) {
      const ag = box(w * 0.6, 0.08, 1.6, 1.4);
      ag.rotateY(rot);
      ag.translate(x, 2.5, z - d / 2 - 0.8);
      b.addGeo(ag, 'galv');
      for (const s of [-1, 1]) {
        const pg = cylinder(0.05, 0.05, 2.4, 5);
        pg.translate(x + Math.cos(rot) * s * w * 0.28, 1.2, z - d / 2 - 1.5);
        b.addGeo(pg, 'steel');
      }
    }
    count++;
    return true;
  };

  // Rows along the two streets, in blocks behind them.
  for (let ring = 0; ring < 9; ring++) {
    const dist = 30 + ring * 26;
    for (let i = 0; i < 26; i++) {
      const t = (i / 26) * 2 - 1;
      // West side (behind the campus)
      tryHouse(-170 - dist * 0.6 + (r() - 0.5) * 22, t * 250 + (r() - 0.5) * 14);
      // East side
      tryHouse(26 + dist * 0.6 + (r() - 0.5) * 22, t * 250 + (r() - 0.5) * 14);
    }
  }

  // A denser block on the near east side so the street reads as urban.
  for (let i = 0; i < 46; i++) {
    const x = 18 + r() * 46;
    const z = -170 + r() * 190;
    if (Math.abs(z - L.frontageRoad.z) > 9) tryHouse(x, z, x < 60 && Math.abs(z + 64) < 30);
  }

  /* ------------------------------------------------------------- chapel row */
  // One small barangay chapel + a couple of commercial buildings on the highway.
  {
    const x = 30, z = 20, W = 16, D = 10, H = 5;
    b.add(box(W, H, D, 2.2), 'houseWallB', { pos: [x, H / 2, z], collide: true });
    b.add(box(W + 1.2, 0.4, D + 1.2, 2), 'paintWhite', { pos: [x, H + 0.2, z] });
    b.add(box(W + 0.6, 0.5, D + 0.6, 1.6), 'roofTile', { pos: [x, H + 0.7, z] });
    b.add(box(2.2, 3.2, 0.2, 1), 'woodDark', { pos: [x, 1.6, z - D / 2 - 0.05] });
    for (const s of [-1, 1]) b.add(box(0.9, 1.6, 0.14, 1), 'glassDark', { pos: [x + s * 4.5, 2.6, z - D / 2 - 0.05] });
    // small cross on the gable
    b.add(box(0.16, 1.5, 0.16, 1), 'paintWhite', { pos: [x, H + 1.6, z - D / 2 + 0.4] });
    b.add(box(0.9, 0.16, 0.16, 1), 'paintWhite', { pos: [x, H + 1.9, z - D / 2 + 0.4] });
  }
  // Two-storey commercial strip on the east side of the highway
  {
    const x = 22, z = 74, W = 24, D = 12, H = 7.2;
    b.add(box(W, H, D, 2.2), 'houseWallD', { pos: [x, H / 2, z], collide: true });
    for (let f = 0; f < 2; f++) {
      for (let i = 0; i < 5; i++) {
        b.add(box(2.3, 1.7, 0.16, 1), 'glassDark', { pos: [x - W / 2 + 3 + i * 4.4, 2.4 + f * 3.2, z - D / 2 - 0.05] });
      }
    }
    b.add(box(W + 1.4, 0.35, D + 1.4, 2), 'paintWhite', { pos: [x, H + 0.15, z] });
    // signboard
    b.add(box(W * 0.8, 1.2, 0.2, 1), 'paintRed', { pos: [x, H + 1.0, z - D / 2 + 0.4] });
  }

  /* ---------------------------------------------------------- power poles */
  for (let z = -260; z < 260; z += 34) {
    for (const s of [-1, 1]) {
      const x = s * (L.highway.halfWidth + 3.4);
      b.add(cylinder(0.15, 0.22, 9.5, 7), 'concreteDark', { pos: [x, 4.75, z] });
      // crossarm
      b.add(box(0.12, 0.12, 2.6, 1), 'woodDark', { pos: [x, 8.6, z] });
      for (const o of [-1.0, 0, 1.0]) {
        b.add(cylinder(0.06, 0.08, 0.34, 5), 'glassDark', { pos: [x, 8.85, z + o] });
      }
    }
  }
  // Overhead cables — catenaries as thin tri-segment lines of boxes.
  for (let z = -260; z < 260 - 34; z += 34) {
    for (const s of [-1, 1]) {
      const x = s * (L.highway.halfWidth + 3.4);
      for (const o of [-1.0, 0, 1.0]) {
        for (let k = 0; k < 3; k++) {
          const t0 = k / 3, t1 = (k + 1) / 3;
          const sag = (t) => -Math.sin(t * Math.PI) * 1.1;
          const z0 = z + o * 0 + t0 * 34, z1 = z + t1 * 34;
          const y0 = 8.95 + sag(t0), y1 = 8.95 + sag(t1);
          const len = Math.hypot(z1 - z0, y1 - y0);
          const g = box(0.035, 0.035, len, 1);
          g.rotateX(Math.atan2(y1 - y0, z1 - z0));
          g.translate(x + o * 0.0, (y0 + y1) / 2, (z0 + z1) / 2);
          b.addGeo(g, 'ironDark');
        }
      }
    }
  }

  }

  /* ---------------------------------------------------- distant tree line */
  // A ring of dark tree blobs breaks the horizon and hides the ground seam.
  // Kept even when the poblacion is culled: it is scenery BEHIND the three
  // subjects, and without it the ground plane ends in a visible seam.
  if (SCOPE.horizon) for (let i = 0; i < 320; i++) {
    const a = (i / 260) * Math.PI * 2 + r() * 0.3;
    const rad = 190 + r() * 340;
    const x = -20 + Math.cos(a) * rad;
    const z = -40 + Math.sin(a) * rad;
    if (isBlocked(x, z, 6)) continue;
    const s = 5.5 + r() * 8;
    const g = new THREE.SphereGeometry(1, 7, 5);
    g.scale(s * (1 + r() * 0.45), s * 0.72, s * (1 + r() * 0.35));
    g.translate(x, s * 0.5, z);
    b.addGeo(g, 'treeFar');
  }

  b.buildInto(G, M);
  G.userData = { houses: count };
  return G;
}
