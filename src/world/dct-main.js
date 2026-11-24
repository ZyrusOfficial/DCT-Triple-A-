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
  /**
   * FRONT PLANE of the shell, in AUTHORED Z.
   *
   * This was MAIN.z - d/2, documented as "world Z of the façade plane". It is
   * not a world coordinate at all. The Builder translates everything by
   * (-MAIN.x, 0, -MAIN.z) and then the group yaws +pi/2, so authored (ax, az)
   * becomes world
   *
   *     world_x = MAIN.x + (az - MAIN.z)
   *     world_z = MAIN.z - (ax - MAIN.x)
   *
   * Authored Z is therefore the building's DEPTH axis. At MAIN.z - d/2 the front
   * plane landed at world x -93.75 — the BACK of the building, away from the
   * campus — so the entrance projection, porte-cochère, doors, crest and statue
   * niche were all built facing an empty field behind the school. The elevation
   * you meet walking up the drive was the plain rear wall of windows.
   *
   * At MAIN.z + d/2 the front plane lands at world x -78.25, which is the
   * campus-facing façade, and everything hanging off frontZ comes back round to
   * the right side.
   */
  const frontZ = MAIN.z + MAIN.d / 2;
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
        b.addGeo(p.geo.clone().translate(MAIN.x + x, y, frontZ + 0.01), p.key);
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
    b.add(box(W, 0.1, 0.16, 2), 'paintWhite', { pos: [MAIN.x, f * FH + 1.02, frontZ + 0.06] });
  }

  /* ===================================================== CENTRAL ENTRY BAY */
  /**
   * Face of the entrance projection.
   *
   * With frontZ on the campus side, the projection stands PROUD of the façade,
   * i.e. further out along authored +Z. Every detail offset that used to read
   * `EZ - n` (outward from the old face) must read `EZ + n` now, or the doors,
   * crest, niche and statue all end up buried inside the block.
   */
  /**
   * EZ is the OUTER FACE of the entrance projection, not frontZ + entryProj.
   *
   * The piers are box(..., MAIN.entryProj + 0.6, ...) centred on
   * frontZ + entryProj/2, so their outer face sits at frontZ + entryProj + 0.3 —
   * 0.3 m proud of the naive value. Using the naive one put every façade detail
   * (windows, sills, reveals, crest, statue niche) 30 cm INSIDE the masonry:
   * the projection read as four blank storeys of concrete with nothing on it.
   */
  const EZ = frontZ + MAIN.entryProj + 0.3;
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
        pos: [MAIN.x + sx * (OW / 2 + pw / 2), EH / 2, frontZ + MAIN.entryProj / 2],
        collide: true,
      });
    }
    // lintel over the opening
    b.add(box(OW, EH - 3.9, MAIN.entryProj + 0.6, TEXSCALE.concrete), 'dctWall', {
      pos: [MAIN.x, 3.9 + (EH - 3.9) / 2, frontZ + MAIN.entryProj / 2],
    });

    // Banding continues around the projection
    for (let f = 1; f <= N; f++) {
      b.add(box(MAIN.entryW + 0.3, 0.42, MAIN.entryProj + 0.9, 2), 'dctBand',
        { pos: [MAIN.x, f * FH - 0.2, frontZ + MAIN.entryProj / 2] });
    }

    // Pediment + cornice
    b.add(box(MAIN.entryW + 1.4, 0.5, MAIN.entryProj + 1.6, 2), 'paintWhite',
      { pos: [MAIN.x, EH + 0.2, frontZ + MAIN.entryProj / 2] });
    // Little raking pediment on top of the entrance
    const shape = new THREE.Shape();
    const gw = MAIN.entryW + 1.2, gh = 1.5;
    shape.moveTo(-gw / 2, 0); shape.lineTo(gw / 2, 0); shape.lineTo(0, gh); shape.closePath();
    const ped = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false });
    ped.translate(MAIN.x, EH + 0.45, frontZ + MAIN.entryProj + 0.05);
    b.addGeo(ped, 'paintWhite');
    // Keystone crest
    {
      const crest = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), M.crest);
      crest.position.set(MAIN.x, EH - 1.4, EZ + 0.06);
      // PlaneGeometry faces local +Z, and this face now points +Z too, so the
      // half-turn that used to be needed here would aim it into the masonry.
      // Left upright; the group's own yaw handles the rest.
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
            { pos: [x, y, EZ + 0.05] });
          /**
           * windowUnit builds its frame facing LOCAL -Z, which was correct when
           * the entrance face pointed that way. Now that frontZ is on the campus
           * side the face points +Z, so every unit on it has to be yawed half a
           * turn or it is backface-culled and the projection reads as four
           * storeys of blank concrete with a shadow where the glass should be.
           */
          for (const p of windowUnit(winW, winH, {
            depth: 0.16, frame: 0.075,
            glassKey: nightMode && f % 2 === 0 ? 'glassLit' : 'glass',
            frameKey: 'paintWhite', mullions: 1, transom: true,
          })) {
            b.addGeo(p.geo.clone().rotateY(Math.PI).translate(x, y, EZ + 0.02), p.key);
          }
          // sill
          b.add(box(winW + 0.4, 0.1, 0.24, 1), 'paintWhite',
            { pos: [x, y - winH / 2 - 0.16, EZ + 0.08] });
        }
      }
    }

    /* ---------- statue niche ---------- */
    const nicheY0 = FH * 3.4, nicheH = FH * 1.5;
    // Dark recess
    b.add(box(2.5, nicheH, 0.5, 1.5), 'interior', { pos: [MAIN.x, nicheY0 + nicheH / 2, EZ - 0.28] });
    // Side jambs & lintel
    for (const s of [-1, 1]) {
      b.add(box(0.36, nicheH + 0.4, 0.75, 1.5), 'paintWhite', { pos: [MAIN.x + s * 1.43, nicheY0 + nicheH / 2, EZ - 0.15] });
      // slim engaged columns on the jambs
      const cp = column(0.19, nicheH * 0.86, { key: 'paintCream', baseH: 0.12, capH: 0.12, segments: 10 });
      for (const p of cp) b.addGeo(p.geo.clone().translate(MAIN.x + s * 1.43, nicheY0 + nicheH * 0.07, EZ + 0.22), p.key);
    }
    b.add(box(3.2, 0.4, 0.9, 1.5), 'paintWhite', { pos: [MAIN.x, nicheY0 + nicheH + 0.1, EZ - 0.1] });
    // Arched head
    const ah = cylinder(1.25, 1.25, 0.4, 14, 1);
    ah.rotateX(Math.PI / 2);
    ah.translate(MAIN.x, nicheY0 + nicheH, EZ - 0.25);
    b.addGeo(ah, 'interior');
    // Balcony
    b.add(box(4.6, 0.28, 1.5, 2), 'paintWhite', { pos: [MAIN.x, nicheY0 - 0.14, EZ + 0.55], collide: true });
    for (const p of railingLine(MAIN.x - 2.2, EZ + 1.28, MAIN.x + 2.2, EZ + 1.28, nicheY0, 0.9, { spacing: 0.2 })) {
      b.addGeo(p.geo.clone().translate(0, 0, 0), p.key);
    }
    // Balusters (chunky, readable at distance)
    for (let i = 0; i < 11; i++) {
      const x = MAIN.x - 2.0 + i * 0.4;
      b.add(cylinder(0.055, 0.075, 0.68, 6), 'paintWhite', { pos: [x, nicheY0 + 0.44, EZ + 1.24] });
    }
    // Saint Dominic statue: robe, hood, head, halo, lily
    const sy = nicheY0 + 0.1;
    b.add(cylinder(0.42, 0.62, 1.55, 12), 'statue', { pos: [MAIN.x, sy + 0.78, EZ - 0.1] });
    b.add(cylinder(0.3, 0.42, 0.55, 12), 'statue', { pos: [MAIN.x, sy + 1.8, EZ - 0.1] });
    b.add(sphere(0.2, 12), 'statue', { pos: [MAIN.x, sy + 2.2, EZ - 0.1] });
    b.add(cylinder(0.3, 0.3, 0.06, 12), 'gold', { pos: [MAIN.x, sy + 2.28, EZ - 0.03], rot: [Math.PI / 2 - 0.3, 0, 0] });
    // Lily in one hand
    b.add(cylinder(0.025, 0.025, 1.0, 5), 'paintWhite', { pos: [MAIN.x + 0.5, sy + 1.5, EZ - 0.18] });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      b.add(sphere(0.07, 6), 'paintWhite', {
        pos: [MAIN.x + 0.5 + Math.cos(a) * 0.08, sy + 2.02, EZ - 0.18 + Math.sin(a) * 0.08],
      });
    }
    // Book in the other hand
    b.add(box(0.12, 0.42, 0.3, 1), 'woodDark', { pos: [MAIN.x - 0.45, sy + 1.5, EZ - 0.2], rot: [0, 0, 0.15] });

    /* ---------- main doors ---------- */
    const dz = EZ - 0.02;
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
    /**
     * The canopy bears on the projection's face and cantilevers OUTWARD.
     *
     * It used to be centred on EZ - cd/2, which was correct when the entrance
     * was on the far side, but after the flip that put the slab 2.8 m inside the
     * façade: a concrete soffit through the lobby at y 1.95, low enough to duck
     * under, with its timber roof structure visible beyond it. The giveaway in
     * the walk-in render was a hard-edged brown diagonal across the ceiling —
     * not a ceiling finish, an outside roof seen from inside.
     */
    const cz = EZ + cd / 2;
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
    /**
     * The arcade is an EXTERIOR walkway: it stands 2.6 m out from the façade on
     * the campus side, which after the frontZ flip is frontZ + 2.6. With the
     * old minus sign the whole 95 m arcade — columns, lean-to roof, fascia — was
     * built 2.6 m INSIDE the building, putting a diagonal timber slab through
     * the entrance lobby at eye height and a row of columns down the corridor.
     */
    const arcZ = frontZ + 2.6;
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
   * THE FRAME — this is the whole difficulty, and it has cost two rewrites.
   *
   * `b` is a single Builder covering the shell AND this interior. Its geometry is
   * authored in world-ish XZ, then at build time every piece is translated by
   * (-MAIN.x, 0, -MAIN.z) and parented to a group carrying yaw +pi/2. The net
   * mapping from an AUTHORED position (ax, az) to a WORLD position is therefore
   *
   *     world_x = MAIN.x + (az - MAIN.z)
   *     world_z = MAIN.z - (ax - MAIN.x)
   *
   * which is a 90-degree swap plus a mirror. That is why the shell, authored as a
   * box of width W along authored-X, correctly comes out 96 m long along WORLD Z.
   *
   * So inside this block, "authored X" is the building's LENGTH axis and
   * "authored Z" is its DEPTH axis. It is confusing, and the way to stay sane is
   * to work in a local frame and convert once:
   *
   *     ax = MAIN.x + zLocal      (zLocal = along the length, in world Z terms)
   *     az = MAIN.z - xLocal      (xLocal = across the depth, in world X terms)
   *
   * Everything below is written against zLocal (0..96 along the building) and
   * xLocal (-7.3..+7.3 across it, 0 = corridor centreline) and converted with
   * `P()`. Nothing here should contain a raw MAIN.x or MAIN.z.
   */
  {
    const H1 = FH - 0.35;                  // floor-to-ceiling
    const cW = 2.2;                        // corridor clear width
    const LX = D - WT * 2;                 // 14.6 clear depth, across the building
    const LZ = W - WT * 2;                 // 95.1 clear length, along it
    const roomD = (LX - cW) / 2;           // 6.2, one classroom deep
    const bays = 10;
    const bayW = LZ / bays;                // 9.51 per bay, along the length
    /**
     * zLocal/xLocal -> authored XZ. See the frame note above.
     * zLocal is measured from the building's low-Z end; xLocal from the
     * corridor centreline, positive toward the façade (+X in world terms).
     */
    const PX = (xLocal) => MAIN.x - xLocal;                 // authored X is along the length
    const PZ = (zLocal) => MAIN.z - xLocal_to_z(zLocal);     // placeholder, replaced below
    // (kept simple and explicit instead:)
    /**
     * Conversion from building-local metres to the authored frame.
     *
     * zLocal runs 0..96 along the building (world Z). xLocal runs -7.3..+7.3
     * across it (world X), 0 on the corridor centreline.
     *
     * Applying the frame rule world_x = MAIN.x + (az - MAIN.z) and
     * world_z = MAIN.z - (ax - MAIN.x) and inverting:
     *   to get world Z = MAIN.z - 48 + zLocal  we need az such that
     *   MAIN.x + (az - MAIN.z) ... does not involve Z at all.
     * The clean inversion is: authored X carries the LENGTH, authored Z the
     * DEPTH, and both are measured with the same sign flip that the shell uses:
     *   ax = MAIN.x + (zLocal - 48)      -> length, centred on the group
     *   az = MAIN.z + xLocal             -> depth, centred on the group
     */
    const zMid = W / 2;                    // 48
    const axOf = (zLocal) => MAIN.x + (zLocal - zMid);
    const azOf = (xLocal) => MAIN.z + xLocal;

    const z0 = WT;                         // zLocal of the clear interior's start
    const xHalf = LX / 2;                  // 7.3

    /**
     * The entrance passage occupies whole bays, never part of one.
     *
     * zMid = 48 lands precisely on a bay boundary, so the door sits between bays
     * 4 and 5 (zLocal 38.49..48.00 and 48.00..57.51). Taking both gives the lobby
     * a 19 m frontage — a fifth of the building, for a door in the middle of it —
     * and, more to the point, lets the corridor wall be a plain run of solid
     * spans and openings with nothing straddling a bay boundary.
     */
    const ccBay0 = Math.floor((zMid - WT) / bayW) - 1;
    const ccBay1 = Math.floor((zMid - WT) / bayW);
    const ccZ0 = z0 + ccBay0 * bayW;
    const ccZ1 = z0 + (ccBay1 + 1) * bayW;
    const ccMid = (ccZ0 + ccZ1) / 2;       // == zMid, the door's own centre
    /**
     * Half-width of the clear LOBBY between the two flanking stair halls.
     *
     * The passage occupies two bays; the stair halls take 6.5 m at each end of
     * that run, leaving this much clear in the middle. It is deliberately close
     * to half the entrance projection's width so the lobby you walk into is
     * roughly the width of the thing you walked through.
     */
    const LOBBY_HALF = 3.1;

    for (let f = 0; f < N; f++) {
      const y0 = f * FH;
      const floorY = f === 0 ? 0.085 : 0.025;

      /* ---------------------------------------------------------- floors */
      // Corridor tile, running the length. In authored terms that is X.
      b.add(box(LZ, 0.06, cW, 2.2), 'tileRed', {
        pos: [axOf(zMid), y0 + floorY, azOf(0)],
      });
      // Classroom vinyl either side, across the depth (authored Z).
      for (const sx of [-1, 1]) {
        b.add(box(LZ, 0.06, roomD, 2.6), 'classroomFloor', {
          pos: [axOf(zMid), y0 + floorY, azOf(sx * (cW / 2 + roomD / 2))],
        });
      }
      // Ceiling over the whole plate.
      b.add(box(LZ, 0.10, LX, 3), 'ceilingBoard', {
        pos: [axOf(zMid), y0 + H1, azOf(0)],
      });

      /* --------------------------------------------- corridor walls + doors */
      /**
       * The corridor wall, drawn as a run of SOLID spans with openings punched
       * through them.
       *
       * The older shape of this loop was one classroom door per bay, positioned
       * relative to the bay's own centre, plus — on the entrance bay only — a
       * wider opening positioned absolutely at zMid. Two things made that fail.
       * zMid is a bay BOUNDARY (48.0 on a 9.51 m pitch starting at 0.45), not a
       * bay centre, so the entrance straddles bays 4 and 5; and a blanket "skip
       * the whole entry bay" removed bay 5's door but left bay 4 sealed and
       * furnished, walling the passage off one metre from its own threshold.
       *
       * So the wall is now built from a per-side list of openings, each a
       * (centre, width) in zLocal, and the solid spans fill the gaps between
       * them. Snapping the entrance to whole bays is what makes this simple: the
       * passage is exactly bays [ccBay0, ccBay1], so there is no partial bay to
       * reason about and no doorway half-swallowed by a wall.
       */
      const openS = [];       // { c, w } in zLocal, per side
      for (let i = 0; i < bays; i++) {
        if (i >= ccBay0 && i <= ccBay1) {
          // replaced by the cross-corridor mouth
          openS.push({ c: z0 + i * bayW, w: bayW, wide: true });
          continue;
        }
        openS.push({ c: z0 + i * bayW + 0.62, w: 1.0 });
      }

      for (const sx of [-1, 1]) {
        const azWall = azOf(sx * cW / 2);
        // solid wall from the end of one opening to the start of the next
        const edges = [z0];
        for (const o of openS) { edges.push(o.c, o.c + o.w); }
        edges.push(z0 + bays * bayW);

        for (let k = 0; k < edges.length; k += 2) {
          const a = edges[k], bEnd = edges[k + 1];
          if (bEnd - a > 0.02) {
            b.add(box(bEnd - a, H1, 0.12, 3), 'interiorPlaster', {
              pos: [axOf((a + bEnd) / 2), y0 + H1 / 2, azWall],
            });
          }
        }

        for (const o of openS) {
          const doorW = o.w, doorZl = o.c;
          // head over the opening
          b.add(box(doorW, H1 - 2.14, 0.12, 3), 'interiorPlaster', {
            pos: [axOf(doorZl + doorW / 2), y0 + 2.14 + (H1 - 2.14) / 2, azWall],
          });
          if (o.wide) continue;   // a passage mouth, not a doorway: no trim, no leaf
          // architrave: flat standing-band on the corridor face
          for (const q of [0, 1]) {
            b.add(box(0.07, 2.10, 0.10, 1), 'wood', {
              pos: [axOf(doorZl + (q === 0 ? -0.035 : doorW + 0.035)), y0 + 1.05, azWall - sx * 0.02],
            });
          }
          b.add(box(doorW + 0.08, 0.08, 0.10, 1), 'wood', {
            pos: [axOf(doorZl + doorW / 2), y0 + 2.14, azWall - sx * 0.02],
          });
          /**
           * OPEN DOOR, swung back inside the classroom.
           *
           * Previously this leaf sat IN the opening, so every doorway on the
           * corridor was a solid timber panel: you could not see into a single
           * room from the spine, which defeats the point of furnishing them. A
           * leaf hinged at one jamb and opened 80 degrees stands nearly
           * perpendicular to the wall, inside the room, leaving the opening
           * clear. Rotating in the XZ plane (about Y) does that; note the
           * thickness goes in the box's THIRD argument because it ends up
           * across the corridor.
           */
          b.add(box(0.045, 2.02, doorW, 1), 'wood', {
            pos: [axOf(doorZl - 0.02), y0 + 1.01, azWall + sx * 0.52],
            rot: [0, Math.PI / 2 * 0.88, 0],
          });
          // borrowed light high in the wall, beside the leaf
          b.add(box(bayW * 0.46, 0.62, 0.05, 1.4), 'glassDark', {
            pos: [axOf(doorZl + bayW * 0.34), y0 + 2.52, azWall + sx * 0.08],
          });
        }
      }

      /* ------------------------------------------------------ classroom fit-out */
      for (let i = 0; i < bays; i++) {
        const zl = z0 + (i + 0.5) * bayW;
        for (const sx of [-1, 1]) {
          /**
           * Skip the bay that looks onto the entrance, on the façade side only:
           * that is where the cross-corridor comes through, so a classroom here
           * would block the way in.
           */
          if (i >= ccBay0 && i <= ccBay1 && sx > 0) continue;
          // across-the-building bounds of this room, in xLocal
          const xl0 = sx < 0 ? -xHalf : cW / 2;
          const xl1 = sx < 0 ? -cW / 2 : xHalf;
          const xlMid = (xl0 + xl1) / 2;

          // partition between this room and the next, along the length
          if (i > 0) {
            b.add(box(0.10, H1, roomD, 3), 'interiorPlaster', {
              pos: [axOf(z0 + i * bayW + 0.05), y0 + H1 / 2, azOf(xlMid)],
            });
          }

          // chalkboard on the OUTER wall, long along the corridor
          const boardXl = sx < 0 ? xl0 + 0.10 : xl1 - 0.10;
          b.add(box(bayW * 0.62, 1.12, 0.06, 1), 'chalkboard', {
            pos: [axOf(zl), y0 + 1.74, azOf(boardXl)],
          });
          for (const ry of [0.36, 2.34]) {
            b.add(box(bayW * 0.66, ry === 0.36 ? 0.07 : 0.06, 0.12, 1), 'wood', {
              pos: [axOf(zl), y0 + ry, azOf(boardXl + sx * 0.03)],
            });
          }

          // teacher's desk, long along the corridor
          b.add(box(1.38, 0.06, 0.64, 2), 'deskTop', {
            pos: [axOf(zl + 0.9), y0 + 0.78, azOf(boardXl - sx * 1.05)],
          });
          for (const qz of [-1, 1]) {
            b.add(box(0.06, 0.75, 0.58, 1), 'deskFrame', {
              pos: [axOf(zl + 0.9 + qz * 0.6), y0 + 0.39, azOf(boardXl - sx * 1.05)],
            });
          }

          // desks: 3 across the room, 4 rows along it
          const cols2 = 3, rows = 4;
          for (let c = 0; c < cols2; c++) {
            for (let r2 = 0; r2 < rows; r2++) {
              /**
               * Desk columns march from the board back into the room.
               *
               * `boardXl` is already inset 0.10 from the wall, and the room is
               * roomD (6.2) deep with the board at its far edge. Column centres
               * must stay inside [xl0+0.9, xl1-0.9] or the outermost chairs push
               * through the outer wall — which is what put desk vertices at
               * x -94.9, beyond the building's -93.3 face.
               */
              /**
               * March INWARD from the board.
               *
               * The board sits at the OUTER edge of its room, so for sx = -1
               * (the room on the -xLocal side) "inward" means increasing xl,
               * and for sx = +1 it means decreasing. That is -sx, not +sx.
               * With +sx every column marched through the outer wall: desk
               * vertices landed at x -95, past the building's -93.3 face, and
               * the rooms rendered empty.
               */
              const dAvail = roomD - 2.2;                 // usable depth
              const dxl = boardXl - sx * (0.9 + (c + 0.5) * (dAvail / cols2));
              const dzl = zl - bayW / 2 + 1.9 + r2 * ((bayW - 2.4) / rows);
              const dy = y0 + 0.045;
              b.add(box(0.64, 0.05, 0.46, 2), 'deskTop',
                { pos: [axOf(dzl), dy + 0.72, azOf(dxl)] });
              for (const qx of [-1, 1]) for (const qz of [-1, 1]) {
                b.add(box(0.045, 0.70, 0.045, 1), 'deskFrame',
                  { pos: [axOf(dzl + qx * 0.27), dy + 0.35, azOf(dxl + qz * 0.18)] });
              }
              // chair
              b.add(box(0.40, 0.045, 0.38, 1.6), 'deskTop',
                { pos: [axOf(dzl), dy + 0.44, azOf(dxl - sx * 0.54)] });
              b.add(box(0.40, 0.34, 0.04, 1.6), 'deskTop',
                { pos: [axOf(dzl), dy + 0.63, azOf(dxl - sx * 0.72)] });
              for (const qx of [-1, 1]) for (const qz of [-1, 1]) {
                b.add(box(0.035, 0.44, 0.035, 1), 'deskFrame',
                  { pos: [axOf(dzl + qx * 0.16), dy + 0.22, azOf(dxl - sx * 0.54 + qz * 0.15)] });
              }
            }
          }

          // fluorescent batten and a clock over the door
          b.add(box(1.15, 0.07, 0.20, 1), 'fluorescent',
            { pos: [axOf(zl), y0 + H1 - 0.08, azOf(xlMid)] });
          b.add(cylinder(0.19, 0.19, 0.05, 16), 'clockFace', {
            pos: [axOf(zl - bayW * 0.30), y0 + 2.70, azOf(xl0 + 0.14)],
            rot: [0, 0, Math.PI / 2],
          });

          // pinned display board on the partition
          b.add(box(bayW * 0.42, 0.85, 0.05, 1.2), 'paintCream', {
            pos: [axOf(zl + bayW * 0.16), y0 + 1.62, azOf(xlMid)],
          });
        }
      }

      /* ------------------------------------------------------------ stairs */
      /**
       * The stairs were centred on zMid, which is the same zLocal as the front
       * door: the flight climbed straight up through the entrance. Its lowest
       * treads landed at y 1.95 right over the doorway, so walking in you met a
       * concrete soffit at head height and a timber stringer across the lobby,
       * and the run of treads blocked the way through to the spine.
       *
       * Two stairwells now, one at each END of the building, each a straight
       * flight lying along the length inside the outer wall. Nothing occupies
       * the middle, so the entrance bay belongs to the entrance.
       */
      if (f < N - 1) {
        /**
         * Two dog-leg stair halls, flanking the entrance lobby.
         *
         * They were first pushed out to the far ends of the building to get them
         * out of the doorway, but that left the lobby 19 m wide — two whole bays
         * of clear floor, five times the width of the entrance projection, with
         * nothing in it. The passage is two bays wide whatever happens, because
         * the door falls on a bay boundary; so the flanking 6.5 m strips on each
         * side are now the stair halls. That gives the extra width a purpose,
         * puts the stairs where people actually arrive, and leaves a 6 m lobby
         * between them that matches the entrance.
         *
         * Each flight runs ACROSS the strip, against the outer wall, from the
         * lobby end of the strip toward the bay boundary.
         */
        for (const endSign of [-1, 1]) {
          const sgn = -endSign;   // endSign -1 = the low-zLocal strip
          const xlSt = sgn * (xHalf - 1.45);
          const steps = 22;
          const rise = FH / steps;
          const run = 0.29;
          // strip spans ccZ0..ccZ0+LOBBY/2 on one side, and the mirror on the other
          const stripNear = sgn < 0 ? ccZ0 : ccZ1 - LOBBY_HALF;
          const zStart = sgn < 0 ? stripNear + 0.35 : stripNear + LOBBY_HALF - 0.35;
          const dir = sgn < 0 ? +1 : -1;
          for (let i = 0; i < steps; i++) {
            const zStep = zStart + dir * (i + 0.5) * run;
            b.add(box(run * 0.96, rise * (i + 1), 2.1, 1), 'concreteTrim', {
              pos: [axOf(zStep), y0 + rise * (i + 1) / 2, azOf(xlSt)],
            });
          }
          // shaft wall between the flight and the lobby
          b.add(box(steps * run, FH, 0.12, 2), 'interiorPlaster', {
            pos: [axOf(zStart + dir * (steps * run) / 2), y0 + FH / 2, azOf(xlSt - sgn * 1.35)],
          });
          for (let i = 0; i < steps; i += 3) {
            b.add(cylinder(0.035, 0.035, 0.95, 6), 'steel', {
              pos: [axOf(zStart + dir * (i + 0.5) * run), y0 + rise * i + 0.48,
                    azOf(xlSt + sgn * 1.15)],
            });
          }
        }
      }
    }

    /**
     * ENTRANCE CROSS-CORRIDOR.
     *
     * The spine runs the building's LENGTH, but the door is in the middle of one
     * LONG side — so walking in you were standing in a classroom, with desks on
     * all sides and no way through to the rest of the building. A building's
     * entrance has to open onto its circulation.
     *
     * This is the missing link: a cross-corridor on each floor running from the
     * façade wall through the depth to the spine, in the bay that faces the door.
     * It is 2.4 m wide in Z, centred on MAIN.z, and it takes the place of the
     * two classroom rows in that one bay.
     *
     * The bay index is derived, not guessed: bays run from zLocal = WT upward in
     * steps of bayW, and the door is at world z = MAIN.z, which is zLocal =
     * W/2 = 48. Bay (48 - WT)/bayW.
     */
    /**
     * Cross-corridor geometry, and the two frames it has to satisfy at once.
     *
     * It runs ACROSS the building - through the depth - so in the authored frame
     * that is the xLocal axis: from the facade-side wall (xl = +xHalf) inward to
     * the spine (xl = +cW/2). Its centre is therefore at xLocal
     * (xHalf + cW/2)/2 and its length is roomD. In the other axis it is a short
     * slot centred on the door, which is at zLocal = W/2.
     *
     * Getting this wrong is easy and silent: the first attempt passed the two
     * axes the other way round and built a 6.2 m corridor running along the
     * REAR half of the building, nowhere near the door.
     */
    const xCrossMid = (xHalf + cW / 2) / 2;
    for (let f = 0; f < N; f++) {
      const y0 = f * FH;
      const floorY = f === 0 ? 0.085 : 0.025;
      /**
       * Floor: its LENGTH runs through the depth, its WIDTH across the door slot.
       *
       * Laid 1 cm ABOVE the classroom vinyl, not at the same level. Both plates
       * are 6 cm thick and the vinyl runs the full length of the building, so at
       * equal heights the passage floor z-fought and lost: the lobby read as
       * blue-grey vinyl with a terracotta spine visible only beyond the end of
       * it. Card-carrying z-fighting, and the fix is to lift the tile clear.
       */
      const ccLen = ccZ1 - ccZ0;
      const hallW = ccLen / 2 - LOBBY_HALF;
      // Clear lobby: terracotta, exactly as wide as the framed entrance hall.
      b.add(box(2 * LOBBY_HALF, 0.06, roomD, 2.2), 'tileRed', {
        pos: [axOf(ccMid), y0 + floorY + 0.01, azOf(xCrossMid)],
      });
      // Flanking stair halls: vinyl, at the ordinary classroom level.
      for (const sgn of [-1, 1]) {
        b.add(box(hallW, 0.06, roomD, 2.6), 'classroomFloor', {
          pos: [axOf(ccMid + sgn * (LOBBY_HALF + hallW / 2)), y0 + floorY, azOf(xCrossMid)],
        });
      }
      // The ceiling still spans the whole run, lobby and both stair halls.
      b.add(box(ccLen, 0.10, roomD + 0.4, 3), 'ceilingBoard', {
        pos: [axOf(ccMid), y0 + H1, azOf(xCrossMid)],
      });
      /**
       * The outer flanks of the passage: the floor-plate edges of the two bays
       * it occupies, left standing when the rooms were suppressed.
       */
      for (const sgn of [-1, 1]) {
        b.add(box(0.10, H1, roomD, 3), 'interiorPlaster', {
          pos: [axOf(ccMid + sgn * (ccLen / 2 + 0.05)), y0 + H1 / 2, azOf(xCrossMid)],
        });
      }
      /**
       * A pilaster at each corner of the clear lobby, framing it.
       *
       * Not a wall: the stair halls have to stay open to the lobby or the stairs
       * sit behind a door in a corner nobody finds. Two square piers where the
       * entrance hall ends and the stair halls begin are enough to stop the
       * 19 m run reading as one huge empty room — and square concrete piers are
       * what the reference photographs show anyway.
       */
      for (const sgn of [-1, 1]) {
        for (const face of [-1, 1]) {
          b.add(box(0.42, H1, 0.42, 3), 'concreteTrim', {
            pos: [axOf(ccMid + sgn * LOBBY_HALF), y0 + H1 / 2,
                  azOf(xCrossMid + face * (roomD / 2 - 0.25))],
          });
        }
      }
    }

    /* ------------------------------------------------------- entrance lobby */
    /**
     * Fitted out in WORLD coordinates, converted once.
     *
     * The previous version placed its furniture relative to the spine with
     * xlCnt = cW/2 - 0.35 ("clear of the spine, so circulation is never
     * blocked"). Both halves of that were wrong. cW/2 is 1.1, so xl 0.75 is
     * INSIDE a 2.2 m corridor, and zl 50.4 is the entrance bay. The result was a
     * 5.4 m timber screen standing across the mouth of the new cross-corridor —
     * a dark wall dead ahead of anyone walking in, which no amount of ceiling or
     * stair fixing could clear. The honour boards had the mirror-image bug: at
     * -cW/2 - 0.02 they sat 2 cm BEHIND the corridor wall and were never visible
     * from anywhere.
     *
     * So: aim at world positions, and let atWorld do the conversion. Inverting
     * the mapping (world_x = MAIN.x + pz - MAIN.z, world_z = MAIN.z - px + MAIN.x)
     * gives px = MAIN.x + MAIN.z - wz and pz = wx - MAIN.x + MAIN.z.
     */
    {
      const atWorld = (wx, wz) => [MAIN.x + MAIN.z - wz, 0, wx - MAIN.x + MAIN.z];
      const ccx = MAIN.x + xCrossMid;                 // cross-corridor centre, world x
      const zN = MAIN.z - 1.25;                       // its north side wall
      const zS = MAIN.z + 1.25;                       // its south side wall
      const yL = 0.085;                               // ground-floor finish level

      /**
       * Reception counter, against the north wall and facing the door.
       *
       * 0.62 deep by 3.2 long. Its west end stops 1.5 m short of the spine
       * doorway, so you can walk in, turn left and be in the main corridor
       * without going round anything.
       */
      {
        const [cx, , cz] = atWorld(ccx, zN + 0.33);
        b.add(box(0.62, 1.05, 3.2, 2), 'woodDark',
          { pos: [cx, yL + 0.525, cz] });
        b.add(box(0.80, 0.08, 3.5, 2), 'deskTop',
          { pos: [cx, yL + 1.09, cz] });
      }

      /**
       * Crest on the far wall of the corridor, square to the door.
       *
       * PlaneGeometry faces local +Z, and the group's yaw turns that into world
       * +X — that is, back toward the entrance — so rotation.y stays 0. The old
       * placement buried it 2 cm inside the wall; this one stands 5 cm proud.
       */
      {
        const crest2 = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), M.crest);
        const [kx, , kz] = atWorld(MAIN.x - cW / 2 + 0.05, MAIN.z);
        crest2.position.set(kx, 3.1, kz);
        crest2.rotation.y = 0;
        b.addSign(crest2);
      }

      // Honour boards, on the south wall of the cross-corridor, facing across
      // it. Long along world X, so the length goes in the box's Z argument.
      for (const dx of [-1.7, 1.7]) {
        const [fx, , fz] = atWorld(ccx + dx, zS - 0.07);
        b.add(box(0.12, 1.5, 3.0, 1.6), 'woodDark',
          { pos: [fx, 2.05, fz] });
        const [px2, , pz2] = atWorld(ccx + dx, zS - 0.15);
        b.add(box(0.05, 1.3, 2.8, 1), 'paintCream',
          { pos: [px2, 2.05, pz2] });
        const [rx, , rz] = atWorld(ccx + dx, zS - 0.19);
        for (let i = 0; i < 9; i++) {
          b.add(box(0.02, 0.09, 2.5, 1), 'dctBand',
            { pos: [rx, 1.52 + i * 0.13, rz] });
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
    sign.position.set(0, H + 1.0, frontZ + MAIN.entryProj + 0.02 - MAIN.z);
    sign.rotation.y = Math.PI;
    group.add(sign);
    // crest + statue placement handled by builders (already rebased)
  }
  return { group, colliders: b.colliders };
}
