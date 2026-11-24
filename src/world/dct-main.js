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
  /**
   * Core volume — a SHELL, not a filled block.
   *
   * This used to be one solid box(W, H, D), which made the largest building on
   * the site exactly as thick as its façade: there was no inside to model, and
   * the brief asks for interiors on both the college and the shrine. It is now
   * four perimeter walls and a ground slab, leaving a hollow 93 x 12.5 m interior
   * four storeys deep.
   *
   * Wall thickness 0.45 is chosen to swallow the window reveals — windowUnit is
   * 0.16 deep and its sills are 0.24, so a thinner wall would let the frames
   * poke through into the rooms.
   *
   * The whole core used to be the building's collider. It cannot be now, or the
   * player could never get in, so the colliders become the four walls and the
   * floor, and the doorway in the entrance projection is left open.
   */
  const WT = 0.45;
  {
    // front and rear walls
    for (const sz of [-1, 1]) {
      b.add(box(W, H, WT, TEXSCALE.concrete), 'dctWall', {
        pos: [MAIN.x, H / 2, MAIN.z + sz * (hd - WT / 2)], collide: true,
      });
    }
    // end walls
    for (const sx of [-1, 1]) {
      b.add(box(WT, H, D - WT * 2, TEXSCALE.concrete), 'dctWall', {
        pos: [MAIN.x + sx * (hw - WT / 2), H / 2, MAIN.z], collide: true,
      });
    }
    /**
     * Structural ground slab. Author it BELOW the finish floors.
     *
     * This is the fourth time in this project that an exterior structural
     * surface has out-ranked an interior finish, and it is the same shape of
     * bug every time: the slab was box(...,0.1,...) at y 0.05, so its top was
     * y 0.10, while the corridor tile and the classroom vinyl sit at 0.03 with
     * 0.06 thickness — top y 0.06. Walking the corridor, ray-casting down
     * returned concreteDark at every one of 30 probe points: the structural
     * slab had buried every finished floor on the ground storey.
     *
     * Keep the slab top at 0.04 and start the finishes at 0.05.
     */
    b.add(box(W - WT * 2, 0.08, D - WT * 2, 3), 'concreteDark',
      { pos: [MAIN.x, 0.0, MAIN.z] });
  }

  /**
   * Floor bands (pink) — read strongly in every photo of this building, but they
   * are a FAÇADE device.
   *
   * They were built as box(W+0.3, 0.42, D+0.3) — the full footprint of the
   * building, all the way through. That was invisible while the core was one
   * solid box. The moment the building got a hollow interior, those four bands
   * became four 96 x 0.42 x 16 m pink slabs cutting straight across every
   * corridor and classroom at each floor level. Standing in the corridor,
   * ray-casting up returned main:dctBand at 3.49 m and main:ceilingBoard just
   * 1 cm above it — the band was the ceiling.
   *
   * They are now a thin skin on the two long faces only, which is where you can
   * actually see them.
   */
  for (let f = 1; f <= N; f++) {
    for (const sz of [-1, 1]) {
      b.add(box(W + 0.3, 0.42, 0.34, 2), 'dctBand', {
        pos: [MAIN.x, f * FH - 0.2, MAIN.z + sz * (hd + 0.15)],
      });
    }
    // wrap around both ends, so the band reads in three-quarter views too
    for (const sx of [-1, 1]) {
      b.add(box(0.34, 0.42, D + 0.3, 2), 'dctBand', {
        pos: [MAIN.x + sx * (hw + 0.15), f * FH - 0.2, MAIN.z],
      });
    }
  }
  /**
   * Base plinth — also a facade ring, not a full slab.
   *
   * As a solid box(W+0.5, 1.1, D+0.5) it put 1.1 m of concrete across the whole
   * ground floor, which would have left the lobby and every ground-floor
   * classroom standing on a raised block with no way down. Ring only.
   */
  for (const sz of [-1, 1]) {
    b.add(box(W + 0.5, 1.1, 0.5, TEXSCALE.concrete), 'dctAccent', {
      pos: [MAIN.x, 0.55, MAIN.z + sz * (hd + 0.25)], collide: true,
    });
  }
  for (const sx of [-1, 1]) {
    b.add(box(0.5, 1.1, D + 0.5, TEXSCALE.concrete), 'dctAccent', {
      pos: [MAIN.x + sx * (hw + 0.25), 0.55, MAIN.z], collide: true,
    });
  }

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
    /**
     * Windows behind the entrance projection.
     *
     * This used to skip every column within the entrance bay, on the reasoning
     * that the projecting bay covers that stretch of wall. It does not: the
     * projection is 3.4 m deep and 20 m wide, so from any angle off dead-centre
     * you see past it to a 20 m wide, four-storey-high blank of bare concrete —
     * the "gap in the window grid". The wall is still there and still visible, so
     * it gets its windows.
     */
    if (Math.abs(x) < 0.4) continue;   // only clear the centre line, for the door
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
    /**
     * The projection is hollow, and has a lobby you can walk through.
     *
     * It was a solid box 20 m wide and 3.4 m deep, and the "doors" on its face
     * were collidable timber leaves — so the main building had a doorway painted
     * on it and no way in. It is now two piers flanking a 5.6 m entrance
     * passage, plus a lintel over it, and the passage runs straight through to
     * the nave of the interior.
     */
    const OW = 5.6;                        // clear opening width
    for (const sx of [-1, 1]) {
      const pw = (MAIN.entryW - OW) / 2;    // pier width
      b.add(box(pw, EH, MAIN.entryProj + 0.6, TEXSCALE.concrete), 'dctWall', {
        pos: [MAIN.x + sx * (OW / 2 + pw / 2), EH / 2, frontZ - MAIN.entryProj / 2],
        collide: true,
      });
    }
    // lintel over the opening
    b.add(box(OW, EH - 3.9, MAIN.entryProj + 0.6, TEXSCALE.concrete), 'dctWall', {
      pos: [MAIN.x, 3.9 + (EH - 3.9) / 2, frontZ - MAIN.entryProj / 2],
    });

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

    /**
     * Windows on the projection's front face.
     *
     * The surface you look straight at walking up the drive had no opening on it
     * at all above the door — four storeys of flat concrete under the pediment.
     * Three evenly spaced lights per floor, inset a little so they read as
     * punched through the projection rather than stuck on it.
     */
    {
      const cols = 3;
      const span = MAIN.entryW - 4.6;
      for (let f = 1; f < N; f++) {
        const y = f * FH + FH * 0.56;
        for (let c = 0; c < cols; c++) {
          const x = MAIN.x + (c - (cols - 1) / 2) * (span / (cols - 1));
          // the crest and statue niche occupy the centre column at the top
          const topFloor = f === N - 1;
          if (topFloor && c === 1) continue;
          // reveal: a shallow recess so the light sits in the wall
          b.add(box(winW + 0.30, winH + 0.30, 0.06, 1), 'dctBand',
            { pos: [x, y, EZ - 0.05] });
          for (const p of windowUnit(winW, winH, {
            depth: 0.16, frame: 0.075,
            glassKey: nightMode && f % 2 === 0 ? 'glassLit' : 'glass',
            frameKey: 'paintWhite', mullions: 1, transom: true,
          })) {
            b.addGeo(p.geo.clone().translate(x, y, EZ - 0.02), p.key);
          }
          // sill
          b.add(box(winW + 0.4, 0.1, 0.24, 1), 'paintWhite',
            { pos: [x, y - winH / 2 - 0.16, EZ - 0.08] });
        }
      }
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
    /**
     * Doors, now OPEN.
     *
     * These were four closed collidable leaves filling the doorway, which is
     * what made the entrance read as a lobby nobody was allowed into. Two leaves
     * are pinched back against the reveal, leaves swung into the lobby, so the
     * centre is clear and the building is enterable.
     */
    for (const s of [-1, 1]) {
      // outer leaf, folded back flat against the jamb
      b.add(box(0.14, 3.2, 1.5, 1.2), 'woodDark',
        { pos: [MAIN.x + s * 2.72, 1.7, dz - 0.78], rot: [0, 0, 0] });
      b.add(box(0.05, 2.0, 1.05, 1), 'glass',
        { pos: [MAIN.x + s * 2.64, 2.2, dz - 0.78] });
      // inner leaf, swung open into the lobby
      b.add(box(1.45, 3.2, 0.14, 1.2), 'woodDark',
        { pos: [MAIN.x + s * 1.95, 1.7, dz + 0.62], rot: [0, s * 0.42, 0] });
      b.add(cylinder(0.03, 0.03, 0.9, 5), 'chrome',
        { pos: [MAIN.x + s * 1.42, 1.5, dz + 0.30] });
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

  /* ============================================================== INTERIOR */
  /**
   * The inside of the main building.
   *
   * The brief is maximum detail on the college, interiors included, and this was
   * a solid block with a façade on it — 96 x 12.5 m of nothing, four storeys
   * deep, behind a doorway you could not walk through. Everything below is
   * authored in the same local frame as the shell (given, y up, front face
   * toward -Z) so it comes out correctly through the group's yaw.
   *
   * Plan, following how this kind of 1950s-70s Philippine college slab is
   * actually organised:
   *   • a 2.2 m spine corridor down the middle of each floor, running the full
   *     length, with classrooms either side;
   *   • classrooms 8.4 m wide, 6.0 m deep, ten a floor;
   *   • an entrance lobby on the ground floor with the office and stair landing;
   *   • a stair well at each end, one flight per floor.
   *
   * The corridor is kept clear so it works as circulation, and each room is
   * furnished from the kit that already exists for the classroom blocks:
   * chalkboard, 3 x 3 desks plus chairs, teacher's desk, fluorescent batten and
   * a wall clock. Reusing those materials is why this costs texture memory
   * nothing — they are already resident.
   */
  {
    const IW = W - WT * 2;                 // clear interior width
    const ID = D - WT * 2;                 // clear interior depth
    const zF = MAIN.z - hd + WT;           // inner face of the front wall
    const zB = MAIN.z + hd - WT;           // inner face of the rear wall
    const H1 = FH - 0.35;                  // floor-to-ceiling
    const cW = 2.2;                        // corridor width
    const roomD = (ID - cW) / 2;           // depth of one classroom

    // A room bay is 8.4 m; the two end bays absorb the remainder.
    const bays = 10;
    const bayW = IW / bays;
    /**
     * x0 is a WORLD coordinate.
     *
     * Everything else in `buildMainBuilding` after the massing pass is authored
     * in world space and rebased into the group's local frame at the very end
     * (`for (const [, geos] of b.bins) for (const g of geos) g.translate(-MAIN.x, 0, -MAIN.z)`).
     * Writing `x0 = -hw + WT` here put it at -47.55 instead of MAIN.x - hw + WT =
     * -133.55, so every classroom, partition, desk, chair, chalkboard and stair
     * was built between x -47 and -38 — a hundred metres east of the building,
     * out on the lawn. The corridor itself was empty, which is why it rendered as
     * a clean bare tunnel.
     */
    const x0 = MAIN.x - hw + WT;

    for (let f = 0; f < N; f++) {
      const y0 = f * FH;

      /* ---------------------------------------------------------- floors */
      /**
       * Finishes sit at 0.055 centre with 0.06 thickness, i.e. top y 0.085 —
       * clear above the structural slab's top at 0.04 on the ground storey, and
       * above each storey's own slab on the floors above. On upper floors the
       * slab is the ceiling slab below, whose top is at y0, so 0.025 centre is
       * enough; using one height everywhere keeps the trim lines consistent.
       */
      const floorY = f === 0 ? 0.085 : 0.025;
      // Corridor: terracotta tile, the colour every one of these buildings has.
      b.add(box(IW, 0.06, cW, 2.2), 'tileRed',
        { pos: [MAIN.x, y0 + floorY, MAIN.z] });
      // Classrooms either side: grey-green vinyl.
      for (const sz of [-1, 1]) {
        b.add(box(IW, 0.06, roomD, 2.6), 'classroomFloor',
          { pos: [MAIN.x, y0 + floorY, MAIN.z + sz * (cW / 2 + roomD / 2)] });
      }
      // Ceiling over the whole floor plate.
      b.add(box(IW, 0.10, ID, 3), 'ceilingBoard',
        { pos: [MAIN.x, y0 + H1, MAIN.z] });

      /* --------------------------------------------- corridor walls + doors */
      for (const sz of [-1, 1]) {
        const wz = MAIN.z + sz * (cW / 2);
        for (let i = 0; i < bays; i++) {
          const bx = x0 + (i + 0.5) * bayW;
          /**
           * Each classroom gets a door and a borrowed light onto the corridor.
           * The door is left open — a corridor lined with closed doors is a
           * corridor with nothing to see in it, and the point of modelling the
           * rooms is that they can be seen.
           */
          const doorW = 1.0;
          const doorX = bx - bayW / 2 + doorW / 2 + 0.12;
          // solid wall, split around the door opening
          const segW = bayW - doorW - 0.24;
          b.add(box(segW, H1, 0.12, 3), 'interiorPlaster', {
            pos: [doorX + doorW / 2 + segW / 2, y0 + H1 / 2, wz],
          });
          // door head
          b.add(box(doorW + 0.24, H1 - 2.14, 0.12, 3), 'interiorPlaster',
            { pos: [doorX, y0 + 2.14 + (H1 - 2.14) / 2, wz] });
          // timber architrave + an open leaf standing back against the wall
          for (const q of [-1, 1]) {
            b.add(box(0.07, 2.10, 0.17, 1), 'wood',
              { pos: [doorX + q * (doorW / 2 + 0.035), y0 + 1.05, wz] });
          }
          b.add(box(doorW + 0.2, 0.08, 0.17, 1), 'wood',
            { pos: [doorX, y0 + 2.14, wz] });
          b.add(box(0.05, 2.02, 0.86, 1), 'wood', {
            pos: [doorX + doorW / 2 + 0.10, y0 + 1.01, wz + sz * 0.60],
            rot: [0, sz * 1.30, 0],
          });
          // borrowed-light glazed panel high in the wall
          b.add(box(bayW * 0.46, 0.62, 0.05, 1.4), 'glassDark',
            { pos: [bx + bayW * 0.18, y0 + 2.52, wz + sz * 0.08] });
        }
      }

      /* ------------------------------------------------------ classroom fit-out */
      for (let i = 0; i < bays; i++) {
        const bx = x0 + (i + 0.5) * bayW;
        for (const sz of [-1, 1]) {
          const rz0 = MAIN.z + sz * (cW / 2);          // corridor side
          const rz1 = MAIN.z + sz * (cW / 2 + roomD);   // outer wall side
          /**
           * Partitions between rooms. The outer wall already exists as the
           * shell; these are the walls between one classroom and the next.
           */
          if (i > 0) {
            b.add(box(0.10, H1, roomD, 3), 'interiorPlaster', {
              pos: [x0 + i * bayW + 0.05, y0 + H1 / 2, (rz0 + rz1) / 2],
            });
          }

          const midZ = (rz0 + rz1) / 2;

          /**
           * Chalkboard and the teacher's end.
           *
           * Board on the outer wall, so daylight comes in over the pupils'
           * shoulders — the arrangement in every photo of these rooms.
           */
          const boardZ = rz1 - sz * 0.10;
          b.add(box(bayW * 0.62, 1.12, 0.06, 1), 'chalkboard',
            { pos: [bx, y0 + 1.74, boardZ] });
          b.add(box(bayW * 0.66, 0.07, 0.12, 1), 'wood',
            { pos: [bx, y0 + 0.36, boardZ - sz * 0.03] });
          b.add(box(bayW * 0.66, 0.06, 0.12, 1), 'wood',
            { pos: [bx, y0 + 2.34, boardZ - sz * 0.03] });

          // teacher's desk, angled slightly to the room
          b.add(box(1.38, 0.06, 0.64, 2), 'deskTop',
            { pos: [bx + 0.9, y0 + 0.78, rz1 - sz * 1.05] });
          for (const qx of [-1, 1]) {
            b.add(box(0.06, 0.75, 0.58, 1), 'deskFrame',
              { pos: [bx + 0.9 + qx * 0.6, y0 + 0.39, rz1 - sz * 1.05] });
          }

          /**
           * Desks: three columns across the room, four rows deep, each with a
           * top, four legs and a chair. 12 per room, 10 rooms a floor, 4 floors
           * = 480 desks and 480 chairs, which is the reason these are built from
           * plain boxes rather than anything clever.
           */
          const cols2 = 3, rows = 4;
          for (let c = 0; c < cols2; c++) {
            for (let r = 0; r < rows; r++) {
              const dx = bx + (c - (cols2 - 1) / 2) * (bayW / (cols2 + 0.9));
              const dz = rz1 - sz * (1.9 + r * ((roomD - 2.4) / rows));
              const dy = y0 + 0.045;
              b.add(box(0.64, 0.05, 0.46, 2), 'deskTop', { pos: [dx, dy + 0.72, dz] });
              for (const qx of [-1, 1]) for (const qz of [-1, 1]) {
                b.add(box(0.045, 0.70, 0.045, 1), 'deskFrame',
                  { pos: [dx + qx * 0.27, dy + 0.35, dz + qz * 0.18] });
              }
              // chair: seat, back, four legs
              b.add(box(0.40, 0.045, 0.38, 1.6), 'deskTop',
                { pos: [dx, dy + 0.44, dz + sz * 0.54] });
              b.add(box(0.40, 0.34, 0.04, 1.6), 'deskTop',
                { pos: [dx, dy + 0.63, dz + sz * 0.72] });
              for (const qx of [-1, 1]) for (const qz of [-1, 1]) {
                b.add(box(0.035, 0.44, 0.035, 1), 'deskFrame',
                  { pos: [dx + qx * 0.16, dy + 0.22, dz + sz * 0.54 + qz * 0.15] });
              }
            }
          }

          // fluorescent batten on the ceiling, and a clock over the door
          b.add(box(1.15, 0.07, 0.20, 1), 'fluorescent',
            { pos: [bx, y0 + H1 - 0.08, midZ] });
          b.add(cylinder(0.19, 0.19, 0.05, 16), 'clockFace',
            { pos: [bx, y0 + 2.70, rz0 + sz * 0.10], rot: [Math.PI / 2, 0, 0] });

          // a pinned display board on one side wall
          b.add(box(bayW * 0.42, 0.85, 0.05, 1.2), 'paintCream', {
            pos: [x0 + i * bayW + 0.16, y0 + 1.62, midZ + roomD * 0.16],
            rot: [0, Math.PI / 2, 0],
          });
        }
      }

      /* ------------------------------------------------------------ stairs */
      /**
       * One straight flight per storey at each end, landing on the floor above.
       * Built as a run of treads in a 3.0 m well, with a stringer and a rail.
       */
      if (f < N - 1) {
        for (const sx of [-1, 1]) {
          const sx0 = MAIN.x + sx * (hw - WT - 1.5);
          const steps = 22;
          const rise = FH / steps;
          const run = 0.29;
          for (let i = 0; i < steps; i++) {
            b.add(box(2.9, rise, run * 0.96, 1), 'concreteTrim', {
              pos: [sx0, y0 + rise * (i + 0.5), MAIN.z + (i - steps / 2) * run],
            });
          }
          // stringer wall on the outside of the flight
          b.add(box(0.12, FH, steps * run, 2), 'interiorPlaster', {
            pos: [sx0 + sx * 1.5, y0 + FH / 2, MAIN.z],
          });
          // handrail on the inner side
          for (let i = 0; i < steps; i += 3) {
            b.add(cylinder(0.035, 0.035, 0.95, 6), 'steel', {
              pos: [sx0 - sx * 1.35, y0 + rise * i + 0.48, MAIN.z + (i - steps / 2) * run],
            });
          }
          b.add(cylinder(0.045, 0.045, steps * run, 6), 'wood', {
            pos: [sx0 - sx * 1.35, y0 + FH * 0.55, MAIN.z],
            rot: [Math.PI / 2 - Math.atan2(FH, steps * run), 0, 0],
          });
        }
      }
    }

    /* ------------------------------------------------------- entrance lobby */
    /**
     * The lobby sits directly inside the entrance and is deliberately double
     * height — this building has a tall projecting bay over its door and the
     * ceiling follows it up, which is what makes the arrival read.
     */
    {
      /**
       * LOBBY.
       *
       * The corridor runs along local X (which is world X here, since the group
       * yaw maps local +X to world -Z — no: it maps local +X to world +Z. Either
       * way, the SPINE of this floor plate runs along the building's long axis,
       * and the lobby is the stretch of it immediately inside the door).
       *
       * The first version put the counter and a 8.4 m timber screen straight
       * across the entry, spanning the full width at local z lz0..lz1 — which is
       * ACROSS the corridor, not beside it. Ray-casting along the corridor from
       * inside hit woodDark at 10 m from the door: the lobby furniture was a wall
       * sealing the building off from its own classrooms. It is now set to ONE
       * SIDE of the spine, in the recess left of the door, and the corridor runs
       * through clear.
       */
      // polished floor along the spine, from the door inward
      b.add(box(5.0, 0.06, MAIN.entryW, 2.0), 'tileCream',
        { pos: [MAIN.x + 0.5, 0.03, MAIN.z] });

      /**
       * Reception counter against the front wall, to the LEFT of the door as you
       * come in, facing back up the corridor. A counter, a transaction top, and
       * a low screen behind it — not across the circulation line.
       */
      const cntX = MAIN.x - 3.4;    // left of the door, inside
      const cntZ = MAIN.z - 2.6;    // against the facade side
      b.add(box(0.6, 1.05, 4.6, 2), 'woodDark', { pos: [cntX, 0.55, cntZ] });
      b.add(box(0.78, 0.09, 4.6, 2), 'deskTop', { pos: [cntX, 1.12, cntZ] });
      // screen behind it, against the wall
      b.add(box(0.12, 2.4, 5.4, 2), 'wood', { pos: [MAIN.x - 6.9, 1.2, cntZ] });
      for (let i = 0; i < 8; i++) {
        b.add(box(0.18, 2.4, 0.16, 1), 'woodDark',
          { pos: [MAIN.x - 6.82, 1.2, cntZ - 2.1 + i * 0.6] });
      }

      /**
       * The school crest, in the lobby where every visitor sees it, on the wall
       * facing the door.
       */
      const crest2 = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), M.crest);
      crest2.position.set(MAIN.x - 6.86, 3.3, cntZ);
      crest2.rotation.y = Math.PI / 2;
      b.addSign(crest2);

      /**
       * Honour boards on the corridor walls opposite the counter, which is
       * where they are in the real building — long glazed cases of gilt-framed
       * class lists, one per decade.
       */
      for (const sz of [-1, 1]) {
        b.add(box(4.2, 1.5, 0.10, 1.6), 'woodDark',
          { pos: [MAIN.x + 1.0, 2.05, MAIN.z + sz * 1.06] });
        b.add(box(4.0, 1.3, 0.05, 1), 'paintCream',
          { pos: [MAIN.x + 1.0, 2.05, MAIN.z + sz * 1.00] });
        for (let i = 0; i < 9; i++) {
          b.add(box(3.7, 0.09, 0.02, 1), 'dctBand',
            { pos: [MAIN.x + 1.0, 1.52 + i * 0.13, MAIN.z + sz * 0.96] });
        }
      }
    }
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
