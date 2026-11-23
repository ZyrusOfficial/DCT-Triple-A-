/**
 * Dominican College of Tarlac — Main Building.
 *
 * Reference: street elevation from MacArthur Highway + the SSC/administration
 * block photographs. Distinguishing features:
 *   • Four storeys, very long (~100 m) slab running parallel to the highway.
 *   • Cream painted concrete with mauve-pink banding between floors.
 *   • A projecting central entrance bay, one storey taller, carrying the
 *     school crest and a recessed statue niche (Saint Dominic) with a
 *     balustraded balcony.
 *   • Rows of identical square-hopper windows, 3 per bay, with pale reveals.
 *   • A full-width covered drive / porte-cochère at ground level with a
 *     shallow gable steel roof, painted white columns.
 *   • Green GI steel roof, low pitch, deep eaves.
 *   • The "DOMINICAN COLLEGE OF TARLAC" gilt/painted lettering on the pediment.
 */
import * as THREE from 'three';
import { Builder, box, plane, cylinder, sphere, wallWithOpenings, windowUnit,
         column, railingLine, gableRoof, hipRoof, TEXSCALE } from './kit.js';
import { L } from './layout.js';

export const MAIN = {
  x: L.mainBuilding.x,
  z: L.mainBuilding.z,
  rotY: L.mainBuilding.rotY,
  w: L.mainBuilding.w,
  d: L.mainBuilding.d,
  floorH: L.mainBuilding.floorH,
  floors: L.mainBuilding.floors,
  entryW: 20.0,
  entryProj: 3.4,
};

export function buildMainBuilding(parent, M, opts = {}) {
  const { nightMode = false } = opts;
  const b = new Builder('main');
  const { w: W, d: D, floorH: FH, floors: N } = MAIN;
  const H = FH * N;
  const frontZ = MAIN.z - MAIN.d / 2; // world Z of the façade plane
  const hw = W / 2, hd = D / 2;

  /* ============================================================ MASSING */
  // Core volume
  b.add(box(W, H, D, TEXSCALE.concrete), 'dctWall', { pos: [MAIN.x, H / 2, MAIN.z], collide: true });

  // Floor bands (pink) — read strongly in every photo of this building.
  for (let f = 1; f <= N; f++) {
    b.add(box(W + 0.3, 0.42, D + 0.3, 2), 'dctBand', { pos: [MAIN.x, f * FH - 0.2, MAIN.z] });
  }
  // Base plinth
  b.add(box(W + 0.5, 1.1, D + 0.5, TEXSCALE.concrete), 'dctAccent', { pos: [MAIN.x, 0.55, MAIN.z], collide: true });

  // Roof
  {
    const parts = hipRoof(W + 1.0, D + 1.4, 2.6, { key: 'roofGray', overhang: 1.1 });
    for (const p of parts) b.addGeo(p.geo.clone().translate(MAIN.x, H, MAIN.z), p.key);
    // Parapet
    for (const [sx, sz, w2, d2] of [[0, -1, W + 0.6, 0.35], [0, 1, W + 0.6, 0.35], [-1, 0, 0.35, D + 0.6], [1, 0, 0.35, D + 0.6]]) {
      b.add(box(w2, 0.75, d2, 2), 'dctWall', {
        pos: [MAIN.x + sx * hw, H + 0.35, MAIN.z + sz * hd],
      });
    }
  }

  /* ========================================================== WINDOW GRID */
  // 4 windows per structural bay, bays of 6 m across the full façade.
  const bay = 6.0;
  const nBays = Math.round(W / bay);
  const winW = 1.15, winH = 1.85;
  const entryHalf = MAIN.entryW / 2;
  const cols = [];
  for (let i = 0; i < nBays * 3; i++) {
    const x = -hw + 1.5 + (i * (W - 3.0)) / (nBays * 3 - 1);
    if (Math.abs(x) < entryHalf + 1.2) continue; // skip the entrance bay
    cols.push(x);
  }

  for (let f = 0; f < N; f++) {
    const y = f * FH + FH * 0.56;
    for (const x of cols) {
      // Front face windows
      for (const p of windowUnit(winW, winH, {
        depth: 0.16, frame: 0.075,
        glassKey: nightMode && (f % 2 === 0) ? 'glassLit' : 'glass',
        frameKey: 'paintWhite', mullions: 1, transom: true,
      })) {
        b.addGeo(p.geo.clone().translate(MAIN.x + x, y, frontZ - 0.01), p.key);
      }
      // Rear face
      for (const p of windowUnit(winW, winH, {
        depth: 0.16, frame: 0.075,
        glassKey: nightMode && (f % 3 === 0) ? 'glassLit' : 'glass',
        frameKey: 'paintWhite', mullions: 1,
      })) {
        b.addGeo(p.geo.clone().rotateY(Math.PI).translate(MAIN.x + x, y, MAIN.z + hd + 0.01), p.key);
      }
    }
    // Side windows
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const z = MAIN.z - hd + 3.0 + i * 4.2;
        for (const p of windowUnit(winW, winH, { depth: 0.16, frame: 0.075, frameKey: 'paintWhite', glassKey: 'glass' })) {
          b.addGeo(p.geo.clone().rotateY(sx * Math.PI / 2).translate(MAIN.x + sx * hw, y, z), p.key);
        }
      }
    }
  }

  // Horizontal string courses on the façade (thin white lines between windows)
  for (let f = 0; f <= N; f++) {
    b.add(box(W, 0.1, 0.16, 2), 'paintWhite', { pos: [MAIN.x, f * FH + 1.02, frontZ - 0.06] });
  }

  /* ===================================================== CENTRAL ENTRY BAY */
  const EZ = frontZ - MAIN.entryProj;
  {
    const EH = H + 1.6; // taller
    b.add(box(MAIN.entryW, EH, MAIN.entryProj + 0.6, TEXSCALE.concrete), 'dctWall',
      { pos: [MAIN.x, EH / 2, frontZ - MAIN.entryProj / 2], collide: true });

    // Banding continues around the projection
    for (let f = 1; f <= N; f++) {
      b.add(box(MAIN.entryW + 0.3, 0.42, MAIN.entryProj + 0.9, 2), 'dctBand',
        { pos: [MAIN.x, f * FH - 0.2, frontZ - MAIN.entryProj / 2] });
    }

    // Pediment + cornice
    b.add(box(MAIN.entryW + 1.4, 0.5, MAIN.entryProj + 1.6, 2), 'paintWhite',
      { pos: [MAIN.x, EH + 0.2, frontZ - MAIN.entryProj / 2] });
    // Little raking pediment on top of the entrance
    const shape = new THREE.Shape();
    const gw = MAIN.entryW + 1.2, gh = 1.5;
    shape.moveTo(-gw / 2, 0); shape.lineTo(gw / 2, 0); shape.lineTo(0, gh); shape.closePath();
    const ped = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false });
    ped.translate(MAIN.x, EH + 0.45, frontZ - MAIN.entryProj + 0.05);
    b.addGeo(ped, 'paintWhite');
    // Keystone crest
    {
      const crest = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), M.crest);
      crest.position.set(MAIN.x, EH - 1.4, EZ - 0.06);
      crest.rotation.y = Math.PI;
      b.addSign(crest);
    }

    /* ---------- statue niche ---------- */
    const nicheY0 = FH * 3.4, nicheH = FH * 1.5;
    // Dark recess
    b.add(box(2.5, nicheH, 0.5, 1.5), 'interior', { pos: [MAIN.x, nicheY0 + nicheH / 2, EZ + 0.28] });
    // Side jambs & lintel
    for (const s of [-1, 1]) {
      b.add(box(0.36, nicheH + 0.4, 0.75, 1.5), 'paintWhite', { pos: [MAIN.x + s * 1.43, nicheY0 + nicheH / 2, EZ + 0.15] });
      // slim engaged columns on the jambs
      const cp = column(0.19, nicheH * 0.86, { key: 'paintCream', baseH: 0.12, capH: 0.12, segments: 10 });
      for (const p of cp) b.addGeo(p.geo.clone().translate(MAIN.x + s * 1.43, nicheY0 + nicheH * 0.07, EZ - 0.22), p.key);
    }
    b.add(box(3.2, 0.4, 0.9, 1.5), 'paintWhite', { pos: [MAIN.x, nicheY0 + nicheH + 0.1, EZ + 0.1] });
    // Arched head
    const ah = cylinder(1.25, 1.25, 0.4, 14, 1);
    ah.rotateX(Math.PI / 2);
    ah.translate(MAIN.x, nicheY0 + nicheH, EZ + 0.25);
    b.addGeo(ah, 'interior');
    // Balcony
    b.add(box(4.6, 0.28, 1.5, 2), 'paintWhite', { pos: [MAIN.x, nicheY0 - 0.14, EZ - 0.55], collide: true });
    for (const p of railingLine(MAIN.x - 2.2, EZ - 1.28, MAIN.x + 2.2, EZ - 1.28, nicheY0, 0.9, { spacing: 0.2 })) {
      b.addGeo(p.geo.clone().translate(0, 0, 0), p.key);
    }
    // Balusters (chunky, readable at distance)
    for (let i = 0; i < 11; i++) {
      const x = MAIN.x - 2.0 + i * 0.4;
      b.add(cylinder(0.055, 0.075, 0.68, 6), 'paintWhite', { pos: [x, nicheY0 + 0.44, EZ - 1.24] });
    }
    // Saint Dominic statue: robe, hood, head, halo, lily
    const sy = nicheY0 + 0.1;
    b.add(cylinder(0.42, 0.62, 1.55, 12), 'statue', { pos: [MAIN.x, sy + 0.78, EZ + 0.1] });
    b.add(cylinder(0.3, 0.42, 0.55, 12), 'statue', { pos: [MAIN.x, sy + 1.8, EZ + 0.1] });
    b.add(sphere(0.2, 12), 'statue', { pos: [MAIN.x, sy + 2.2, EZ + 0.1] });
    b.add(cylinder(0.3, 0.3, 0.06, 12), 'gold', { pos: [MAIN.x, sy + 2.28, EZ + 0.03], rot: [Math.PI / 2 - 0.3, 0, 0] });
    // Lily in one hand
    b.add(cylinder(0.025, 0.025, 1.0, 5), 'paintWhite', { pos: [MAIN.x + 0.5, sy + 1.5, EZ + 0.18] });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      b.add(sphere(0.07, 6), 'paintWhite', {
        pos: [MAIN.x + 0.5 + Math.cos(a) * 0.08, sy + 2.02, EZ + 0.18 + Math.sin(a) * 0.08],
      });
    }
    // Book in the other hand
    b.add(box(0.12, 0.42, 0.3, 1), 'woodDark', { pos: [MAIN.x - 0.45, sy + 1.5, EZ + 0.2], rot: [0, 0, 0.15] });

    /* ---------- main doors ---------- */
    const dz = EZ + 0.02;
    b.add(box(5.4, 0.3, 0.9, 2), 'paintWhite', { pos: [MAIN.x, 3.5, dz + 0.1] });
    for (const s of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        const x = MAIN.x + s * (0.75 + i * 1.5);
        b.add(box(1.4, 3.2, 0.14, 1.2), 'woodDark', { pos: [x, 1.7, dz], collide: true });
        b.add(box(0.95, 1.9, 0.05, 1), 'glass', { pos: [x, 2.2, dz - 0.08] });
        b.add(cylinder(0.03, 0.03, 0.9, 5), 'chrome', { pos: [x + (s > 0 ? -0.5 : 0.5), 1.5, dz - 0.12] });
      }
    }
    b.add(box(6.4, 0.24, 0.5, 2), 'paintWhite', { pos: [MAIN.x, 3.42, dz - 0.04] });

    /* ---------- porte-cochère ---------- */
    const cw = MAIN.entryW + 4.0, cd = 6.0, ch = 4.5;
    const cz = EZ - cd / 2;
    b.add(box(cw + 1.4, 0.42, cd + 1.0, 2), 'paintWhite', { pos: [MAIN.x, ch, cz] });
    // Shallow steel roof over the canopy
    {
      const parts = gableRoof(cw + 1.4, cd + 1.4, 0.9, { key: 'roofRib', overhang: 0.5, fasciaKey: 'paintWhite', thickness: 0.08 });
      for (const p of parts) b.addGeo(p.geo.clone().translate(MAIN.x, ch + 0.2, cz), p.key);
    }
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const x = MAIN.x + s * (2.2 + i * 3.0);
        const cp = column(0.28, ch - 0.3, { key: 'paintWhite', baseH: 0.16, capH: 0.16, segments: 12 });
        for (const p of cp) b.addGeo(p.geo.clone().translate(x, 0, cz + cd / 2 - 0.9), p.key);
        b.addCollider([x - 0.34, 0, cz + cd / 2 - 1.24], [x + 0.34, ch, cz + cd / 2 - 0.56]);
      }
    }
    // Steps up to the lobby
    for (let i = 0; i < 3; i++) {
      b.add(box(cw + 1.0, 0.15, 1.6, TEXSCALE.paving), 'granite', {
        pos: [MAIN.x, 0.075 + i * 0.15, cz + cd / 2 + 1.2 - i * 0.5],
      });
    }
  }

  /* ====================================================== GROUND FLOOR ARCADE */
  // Continuous white columns along the front at 6 m centres with a lean-to roof —
  // the "walkway" that all the students use in the photos.
  {
    const arcZ = frontZ - 2.6;
    for (let x = -hw + 2.0; x <= hw - 2.0; x += 5.6) {
      if (Math.abs(MAIN.x + x - MAIN.x) < MAIN.entryW / 2 + 2.5) continue;
      const cp = column(0.2, 3.3, { key: 'paintWhite', baseH: 0.12, capH: 0.12, segments: 10 });
      for (const p of cp) b.addGeo(p.geo.clone().translate(MAIN.x + x, 0, arcZ), p.key);
      b.addCollider([MAIN.x + x - 0.26, 0, arcZ - 0.26], [MAIN.x + x + 0.26, 3.4, arcZ + 0.26]);
    }
    // lean-to roof
    b.add(box(W - 1.0, 0.16, 3.2, 2), 'roofRib', {
      pos: [MAIN.x, 3.55, arcZ + 1.0], rot: [-0.1, 0, 0],
    });
    b.add(box(W - 1.0, 0.22, 0.3, 2), 'paintWhite', { pos: [MAIN.x, 3.4, arcZ - 0.7] });
  }

  /* ============================================================== BUILD */
  const group = new THREE.Group();
  group.position.set(MAIN.x, 0, MAIN.z);
  group.rotation.y = MAIN.rotY;
  // Everything below was authored in the local frame centred on (0,0,0) with
  // the façade facing -Z; shift by -MAIN.x/-MAIN.z to place it into that frame.
  group.position.set(MAIN.x, 0, MAIN.z);
  group.updateMatrix();
  parent.add(group);
  const signs = b.signs || [];
  b.signs = undefined;
  // Rebase geometry from world coords into the rotated local frame.
  for (const [, geos] of b.bins) for (const g of geos) g.translate(-MAIN.x, 0, -MAIN.z);
  b.buildInto(group, M);
  for (const s of signs) {
    s.position.x -= MAIN.x;
    s.position.z -= MAIN.z;
    group.add(s);
  }

  // Main façade lettering: DOMINICAN COLLEGE OF TARLAC across the entry cornice
  {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(16, 1.56), M.signDCT);
    sign.position.set(0, H + 1.0, frontZ - MAIN.entryProj - 0.02 - MAIN.z);
    sign.rotation.y = Math.PI;
    group.add(sign);
    // crest + statue placement handled by builders (already rebased)
  }
  return { group, colliders: b.colliders };
}
