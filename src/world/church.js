/**
 * Diocesan Shrine and Parish of San Nicolas de Tolentino.
 *
 * Reference: front elevation photographs taken from the plaza. Key features:
 *   • Single-nave church, ~34 m long, 17.4 m wide, 12 m to the eaves.
 *   • Central gable with a small square lantern + octagonal drum + cream dome
 *     and a white Latin cross — reads as a "wedding cake" steeple.
 *   • Two low flanking gables at ±9 m, each with a small statue niche.
 *   • Deep front porch (portico) with a flat slab roof carried on 6 round
 *     columns, dark timber soffit, wide steps down to the forecourt.
 *   • "SAN NICOLAS DE TOLENTINO PARISH" in spaced dark letters across the
 *     portico fascia.
 *   • Warm cream stucco throughout, with a giant clam-shell ornament above
 *     the central gable.
 *   • Free-standing bell tower ~26 m SE of the façade, at the corner of the
 *     forecourt: red brick base with cream pilaster bands, three open arched
 *     stages with balustrades, cream octagonal drum, dome, and cross.
 *   • A statue of Santa Maria / Saint Nicholas stands in front-left of the
 *     porch on a moulded plinth.
 */
import * as THREE from 'three';
import { Builder, box, plane, cylinder, sphere, wallWithOpenings, windowUnit,
         column, railingLine, gableRoof, dome, cross, TEXSCALE } from './kit.js';
import { put } from './place.js';

// Local frame: origin at the centre of the nave at grade; +Z faces the plaza
// (i.e. the façade faces south-ish toward the park in our world layout).
import { L } from './layout.js';

/**
 * The nave is authored with its long axis along local +Z (façade at +Z) and the
 * width along local X. That is the same axis the porch projects along, so the
 * façade stays square to the porch. The group is then yawed so local +Z points
 * east (toward the plaza) — this is what makes the building read correctly from
 * the park in the reference photographs.
 */
export const CHURCH = {
  x: L.church.x,
  z: L.church.z,
  rotY: L.church.rotY,
  naveW: 19.0,
  naveL: 38.0,
  wallH: 11.8,
  gableRise: 5.6,
  porchW: 26.0,
  porchD: 8.6,
  porchH: 8.4,
  // Bell tower: free-standing at the south-east corner of the forecourt,
  // exactly as in the photos (tower on the right when facing the façade).
  tower: { x: 15.5, z: 21.0 },
};

export function buildChurch(parent, M, { nightMode = false } = {}) {
  const b = new Builder('church');
  const { naveW: NW, naveL: NL, wallH: WH } = CHURCH;

  /* ============================================================ NAVE BODY */
  // Side walls: 3 tall arched windows per side, plus lower blind arcade.
  const sideOpenings = [];
  for (let i = -1; i <= 1; i++) {
    sideOpenings.push({ x: i * 9.0, y: 7.4, w: 2.2, h: 5.0 });
  }

  for (const side of [-1, 1]) {
    const parts = wallWithOpenings(NL, WH, 0.9, sideOpenings, TEXSCALE.churchWall);
    for (const g of parts) {
      g.translate(0, 0, side * NW / 2);
      g.rotateY(side > 0 ? Math.PI / 2 : -Math.PI / 2);
      b.addGeo(g, 'churchWall');
    }
    // Windows recessed into those side walls. The panel runs along local Z, so
    // each window is placed at (0, y, ±naveW/2) and turned to face outward.
    for (const op of sideOpenings) {
      const win = windowUnit(op.w, op.h, {
        depth: 0.22, frame: 0.09, glassKey: nightMode ? 'glassLit' : 'glass',
        frameKey: 'churchTrim', mullions: 1, transom: true,
      });
      for (const p of win) {
        // windowUnit authors in the XY plane facing +Z; rotate so it faces
        // outward on this side wall, then push to the wall face.
        put(b, p.geo, p.key, [0, op.y, side * (NW / 2 + 0.05)],
          { yaw: side > 0 ? Math.PI / 2 : -Math.PI / 2 });
      }
      // Pilaster caps flanking each window
      for (const s of [-1, 1]) {
        b.add(box(0.34, WH, 0.5, 2), 'churchTrim', {
          pos: [side * (NW / 2 + 0.2), WH / 2, op.x + s * (op.w / 2 + 0.85)],
        });
      }
    }
    // Cornice band
    b.add(box(0.55, 0.42, NL, 2), 'churchTrim', { pos: [side * (NW / 2 + 0.12), WH - 0.1, 0] });
    b.add(box(0.4, 0.22, NL, 2), 'churchTrim', { pos: [side * (NW / 2 + 0.05), 3.1, 0] });
    // Buttress piers along the nave
    for (let i = -2; i <= 2; i++) {
      b.add(box(0.6, WH - 0.6, 0.75, 2), 'churchWall', {
        pos: [side * (NW / 2 + 0.3), (WH - 0.6) / 2, i * 7.2],
      });
      b.add(box(0.75, 0.3, 0.9, 2), 'churchTrim', { pos: [side * (NW / 2 + 0.34), WH - 0.75, i * 7.2] });
    }
  }

  // Rear (apse) end: wall with a tall lancet, then a shallow polygonal apse.
  {
    const parts = wallWithOpenings(NW + 0.9, WH, 0.7,
      [{ x: 0, y: 6.6, w: 3.0, h: 5.4 }], TEXSCALE.churchWall);
    for (const g of parts) {
      g.translate(0, 0, -NL / 2);
      g.rotateY(Math.PI);
      b.addGeo(g, 'churchWall');
    }
    // Apse: five short wall pieces on a shallow fan, closed by a shed roof.
    const rr = NW * 0.34, apseD = 4.6;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI * 0.36 + (i / 4) * Math.PI * 0.72;
      const px = Math.sin(a) * rr, pz = -NL / 2 - Math.cos(a) * apseD * 0.72;
      b.add(box(0.55, WH - 2.2, 3.2, 2), 'churchWall',
        { pos: [px, (WH - 2.2) / 2, pz], rot: [0, -a, 0], pivot: [px, (WH - 2.2) / 2, pz] });
    }
    // apse roof + cap
    b.add(box(NW * 0.82, 0.34, apseD + 1.0, 2), 'churchTrim',
      { pos: [0, WH - 2.1, -NL / 2 - apseD * 0.36] });
    b.add(box(NW * 0.90, 0.42, 0.55, 2), 'churchTrim', { pos: [0, WH - 0.1, -NL / 2 - 0.35] });
  }

  // Floor slab & interior floor
  b.add(box(NW + 1.2, 0.5, NL + 0.8, TEXSCALE.concrete), 'concreteDark', { pos: [0, 0.25, 0], collide: true });
  b.add(box(NW - 1.0, 0.1, NL - 1.0, TEXSCALE.paving), 'tileCream', { pos: [0, 0.52, 0] });
  b.add(box(NW * 0.7, 0.1, 5.2, TEXSCALE.paving), 'tileCream', { pos: [0, 0.52, -NL / 2 - 1.6] });

  /* ========================================================= FRONT FAÇADE */
  // Local frame: nave spans z ∈ [-NL/2, +NL/2]; the façade is the +Z end and
  // the plaza is further +Z. The porch projects from +NL/2 outward.
  const facadeZ = NL / 2;
  // The front wall has a large central door and two side doors.
  {
    const ops = [
      { x: 0, y: 2.35, w: 3.4, h: 4.7 },     // main door
      { x: -6.4, y: 1.9, w: 1.9, h: 3.8 },   // side doors
      { x: 6.4, y: 1.9, w: 1.9, h: 3.8 },
    ];
    const parts = wallWithOpenings(NW + 0.9, WH, 0.9, ops, TEXSCALE.churchWall);
    for (const g of parts) { g.translate(0, 0, facadeZ); b.addGeo(g, 'churchWall', true); }
  }

  // Central gable (triangular pediment with the shell ornament)
  {
    const gW = 9.6, gH = CHURCH.gableRise;
    const shape = new THREE.Shape();
    shape.moveTo(-gW / 2, 0); shape.lineTo(gW / 2, 0); shape.lineTo(0, gH); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: false });
    geo.translate(0, WH, facadeZ - 0.1);
    b.addGeo(geo, 'churchWall');
    // Raking cornice
    for (const s of [-1, 1]) {
      const len = Math.hypot(gW / 2, gH);
      const a = Math.atan2(gH, gW / 2) * s;
      const c = box(len + 0.4, 0.34, 0.95, 2);
      c.rotateZ(-a);
      c.translate(s * gW / 4, WH + gH / 2 + 0.1, facadeZ + 0.3);
      b.addGeo(c, 'churchTrim');
    }
    // Shell / fan ornament (built from thin radial plates)
    const shell = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const a = (-0.72 + (i / 8) * 1.44);
      put(b, box(0.16, 1.5, 0.16, 1), 'churchTrim',
        [Math.sin(a) * 0.95, WH + 2.55 + Math.cos(a) * 0.95, facadeZ + 0.62], { roll: a });
    }
    b.add(cylinder(0.34, 0.34, 0.2, 10), 'churchTrim', {
      pos: [0, WH + 2.5, facadeZ + 0.68], rot: [Math.PI / 2, 0, 0],
    });
  }

  // Flanking gablets (each with a niche) at ±9 m
  for (const s of [-1, 1]) {
    const gw = 4.2, gh = 2.0;
    const shape = new THREE.Shape();
    shape.moveTo(-gw / 2, 0); shape.lineTo(gw / 2, 0); shape.lineTo(0, gh); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.55, bevelEnabled: false });
    geo.translate(s * 8.6, WH - 1.3, facadeZ - 0.05);
    b.addGeo(geo, 'churchWall');
    // Niche (blind arch recess) on the gablet face
    b.add(box(1.5, 2.5, 0.25, 1.5), 'interior', { pos: [s * 8.6, WH + 1.4, facadeZ + 0.5] });
    b.add(box(1.7, 0.16, 0.5, 1.5), 'churchTrim', { pos: [s * 8.6, WH + 2.7, facadeZ + 0.6] });
    // Small cross finial
    for (const p of cross(1.1, 0.09, 0.09, 'churchTrim')) {
      b.addGeo(p.geo.clone().translate(s * 8.6, WH + 2.2, facadeZ + 0.4), p.key);
    }
    // Pilasters framing the gable
    for (const q of [-1, 1]) {
      b.add(box(0.5, 2.4, 0.42, 2), 'churchTrim', { pos: [s * 8.6 + q * gw / 2, WH - 0.2, facadeZ + 0.3] });
    }
  }

  /* ---------------------------------------------------------- CENTRE STEEPLE */
  // The little dome sits on the ridge of the nave roof, over the crossing —
  // i.e. centred on the nave, not hung off the façade. Roof ridge height is
  // wallH + roof rise (3.4). We start the lantern there.
  {
    const y0 = WH + 3.4;
    const sz = 0;   // centred over the nave
    b.add(box(2.5, 2.2, 2.5, 2), 'churchWall', { pos: [0, y0 + 1.1, sz] });
    // Arched openings on 4 sides
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      b.add(box(1.0, 1.3, 0.16, 1), nightMode ? 'glassLit' : 'glassDark', {
        pos: [Math.sin(a) * 1.26, y0 + 1.2, sz + Math.cos(a) * 1.26],
        rot: [0, a, 0],
        pivot: [Math.sin(a) * 1.26, y0 + 1.2, sz + Math.cos(a) * 1.26],
      });
    }
    b.add(box(3.0, 0.24, 3.0, 2), 'churchTrim', { pos: [0, y0 + 2.3, sz] });
    // Octagonal drum
    b.add(cylinder(1.45, 1.55, 1.7, 8), 'churchTrim', { pos: [0, y0 + 3.3, sz] });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.add(box(0.34, 1.5, 0.34, 1), 'churchTrim', {
        pos: [Math.sin(a) * 1.5, y0 + 3.3, sz + Math.cos(a) * 1.5], rot: [0, a, 0],
        pivot: [Math.sin(a) * 1.5, y0 + 3.3, sz + Math.cos(a) * 1.5],
      });
    }
    // Dome
    for (const p of dome(1.62, { key: 'churchDome', seg: 20, rings: 9, squash: 0.92 })) {
      b.addGeo(p.geo.clone().translate(0, y0 + 4.15, sz), p.key);
    }
    b.add(cylinder(0.2, 0.26, 0.5, 8), 'churchTrim', { pos: [0, y0 + 5.7, sz] });
    for (const p of cross(1.5, 0.1, 0.1, 'churchTrim')) {
      b.addGeo(p.geo.clone().translate(0, y0 + 5.9, sz), p.key);
    }
  }

  /* --------------------------------------------------------------- PORTICO */
  {
    const PZ = facadeZ + CHURCH.porchD / 2;
    const PW = CHURCH.porchW, PD = CHURCH.porchD, PH = CHURCH.porchH;
    // Slab roof with a slight fascia
    b.add(box(PW, 0.55, PD, 2), 'churchTrim', { pos: [0, PH, PZ] });
    b.add(box(PW + 0.5, 0.22, PD + 0.5, 2), 'churchTrim', { pos: [0, PH + 0.36, PZ] });
    // Roof deck hidden behind a low parapet
    b.add(box(PW + 0.5, 0.5, 0.16, 2), 'churchTrim', { pos: [0, PH + 0.66, PZ + PD / 2 + 0.17] });
    // Fascia band that carries the lettering
    b.add(box(PW + 0.6, 0.9, 0.24, 2), 'churchWall', { pos: [0, PH - 0.6, PZ + PD / 2 + 0.03] });

    // Lettering
    {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(PW * 0.86, 0.72), M.signChurch);
      sign.position.set(0, PH - 0.62, PZ + PD / 2 + 0.18);
      sign.castShadow = false;
      b.addSign(sign);
    }

    // Columns: 6 across the front edge
    const colX = [-10.4, -6.2, -2.1, 2.1, 6.2, 10.4];
    for (const x of colX) {
      const parts = column(0.46, PH - 0.7, { key: 'churchTrim', baseH: 0.32, capH: 0.3, segments: 16 });
      for (const p of parts) b.addGeo(p.geo.clone().translate(x, 0, PZ + PD / 2 - 0.55), p.key);
      b.addCollider([x - 0.55, 0, PZ + PD / 2 - 1.1], [x + 0.55, PH, PZ + PD / 2 - 0.0]);
    }
    // Side columns at the porch corners, one bay back
    for (const x of [-PW / 2 + 0.6, PW / 2 - 0.6]) {
      const parts = column(0.42, PH - 0.7, { key: 'churchTrim', baseH: 0.3, capH: 0.28, segments: 14 });
      for (const p of parts) b.addGeo(p.geo.clone().translate(x, 0, PZ - 1.2), p.key);
    }

    // Entrance steps (three risers) across the full porch width
    for (let i = 0; i < 3; i++) {
      b.add(box(PW + 1.4, 0.16, 0.42, TEXSCALE.paving), 'paving', {
        pos: [0, 0.08 + i * 0.16, PZ + PD / 2 + 1.35 - i * 0.42],
      });
    }
    b.add(box(PW + 1.6, 0.2, 1.9, TEXSCALE.paving), 'paving', { pos: [0, 0.1, PZ + PD / 2 + 2.1] });

    // Porch floor
    b.add(box(PW, 0.12, PD, TEXSCALE.paving), 'paving', { pos: [0, 0.56, PZ] });
    // Dark timber soffit (very visible from below in the references)
    b.add(box(PW - 0.3, 0.06, PD - 0.3, 1), 'woodDark', { pos: [0, PH - 0.3, PZ] });
    for (let i = -5; i <= 5; i++) {
      b.add(box(PW - 0.4, 0.14, 0.14, 1), 'woodDark', { pos: [0, PH - 0.36, PZ + i * 0.78] });
    }

    // Main door (double leaf, dark timber with carved panels)
    {
      const dz = facadeZ + 0.35;
      b.add(box(3.5, 0.18, 0.9, 1), 'churchTrim', { pos: [0, 5.0, facadeZ + 0.18] });
      for (const s of [-1, 1]) {
        b.add(box(1.62, 4.5, 0.13, 1.2), 'woodDark', { pos: [s * 0.86, 2.4, dz], collide: true });
        // carved upper panel
        b.add(box(1.1, 1.7, 0.05, 1), 'wood', { pos: [s * 0.86, 3.6, dz + 0.1] });
        b.add(box(0.9, 1.5, 0.04, 1), 'wood', { pos: [s * 0.86, 1.6, dz + 0.1] });
        // handle
        b.add(cylinder(0.045, 0.045, 0.55, 6), 'brass', { pos: [s * 0.24, 2.3, dz + 0.16] });
      }
      // Transom light above the door
      b.add(box(3.2, 0.55, 0.1, 1), nightMode ? 'glassLit' : 'glass', { pos: [0, 4.85, dz + 0.02] });
      // Frame
      b.add(box(3.75, 0.2, 0.34, 1), 'churchTrim', { pos: [0, 0.1, dz] });
      for (const s of [-1, 1]) b.add(box(0.22, 4.9, 0.34, 1), 'churchTrim', { pos: [s * 1.86, 2.5, dz] });
    }

    // Two side doors, simpler
    for (const s of [-1, 1]) {
      const dz = facadeZ + 0.35;
      b.add(box(1.9, 3.8, 0.12, 1.2), 'woodDark', { pos: [s * 6.4, 1.95, dz], collide: true });
      b.add(box(2.1, 0.18, 0.3, 1), 'churchTrim', { pos: [s * 6.4, 3.9, dz + 0.02] });
      // Lamp over each side door
      b.add(cylinder(0.06, 0.06, 0.5, 6), 'ironDark', { pos: [s * 6.4, 4.4, dz + 0.3] });
      b.add(box(0.24, 0.3, 0.24, 1), nightMode ? 'lampGlow' : 'glassDark', { pos: [s * 6.4, 4.15, dz + 0.3] });
    }
  }

  /* ------------------------------------------------------------- BELL TOWER */
  buildBellTower(b, M, CHURCH.tower.x, CHURCH.tower.z, nightMode);

  /* --------------------------------------------------------- FORECOURT DECOR */
  // Saint Nicholas statue on the left of the porch
  {
    const sx = -11.5, sz = facadeZ + 9.5;
    b.add(box(2.4, 0.5, 2.4, 1.5), 'concreteTrim', { pos: [sx, 0.25, sz], collide: true });
    b.add(box(1.9, 0.9, 1.9, 1.5), 'concrete', { pos: [sx, 0.95, sz] });
    b.add(box(1.3, 0.35, 1.3, 1.5), 'pavingRed', { pos: [sx, 1.55, sz] });
    // Robed figure (simplified but readable silhouette)
    b.add(cylinder(0.34, 0.55, 1.5, 10), 'statueRobed', { pos: [sx, 2.45, sz] });
    b.add(cylinder(0.28, 0.34, 0.6, 10), 'statueRobed', { pos: [sx, 3.45, sz] });
    b.add(sphere(0.19, 10), 'statue', { pos: [sx, 3.86, sz] });
    // halo + book
    b.add(cylinder(0.3, 0.3, 0.05, 12), 'gold', { pos: [sx, 3.92, sz - 0.12], rot: [Math.PI / 2 - 0.35, 0, 0] });
    b.add(box(0.36, 0.46, 0.11, 1), 'woodDark', { pos: [sx + 0.44, 2.85, sz + 0.16], rot: [0, 0.2, -0.15] });
    b.addCollider([sx - 1.3, 0, sz - 1.3], [sx + 1.3, 1.8, sz + 1.3]);
  }

  // Bell (the big bronze bell on an A-frame to the left of the porch)
  {
    const bx = -15.2, bz = facadeZ + 6.0;
    for (const s of [-1, 1]) {
      const leg = box(0.16, 3.4, 0.16, 1);
      leg.rotateZ(s * 0.16);
      leg.translate(bx + s * 0.62, 1.7, bz);
      b.addGeo(leg, 'ironDark');
    }
    b.add(box(1.55, 0.16, 0.16, 1), 'ironDark', { pos: [bx, 3.36, bz] });
    // Bell body
    b.add(cylinder(0.3, 0.62, 0.95, 14), 'brass', { pos: [bx, 2.85, bz] });
    b.add(cylinder(0.66, 0.66, 0.1, 14), 'brass', { pos: [bx, 2.36, bz] });
    b.add(cylinder(0.09, 0.09, 0.4, 8), 'brass', { pos: [bx, 3.5, bz] });
    b.add(sphere(0.13, 8), 'brass', { pos: [bx, 2.4, bz] });
    b.addCollider([bx - 0.9, 0, bz - 0.6], [bx + 0.9, 3.5, bz + 0.6]);
  }

  // Planter beds flanking the steps
  for (const s of [-1, 1]) {
    const px = s * 15.2, pz = facadeZ + 10.6;
    b.add(box(3.4, 0.55, 2.2, 1.5), 'concreteTrim', { pos: [px, 0.28, pz], collide: true });
    b.add(box(3.1, 0.2, 1.9, 1.5), 'soil', { pos: [px, 0.6, pz] });
  }

  // Roof over the nave: a long low gable with clay-red ribbed sheet
  {
    // gableRoof() puts the ridge along local X; the nave runs along local Z,
    // so rotate the finished roof 90°. gableRoof's `w` therefore becomes the
    // nave length and its `d` the nave width.
    const roofParts = gableRoof(NL + 1.4, NW, 3.6, {
      key: 'roofRib', overhang: 0.9, fasciaKey: 'churchTrim', thickness: 0.12,
    });
    for (const p of roofParts) {
      const g = p.geo.clone();
      g.rotateY(Math.PI / 2);
      g.translate(0, WH, 0);
      b.addGeo(g, p.key);
    }
    // Gable-end infill so you can't see into the roof void from the ends.
    for (const sg of [-1, 1]) {
      const sh = new THREE.Shape();
      sh.moveTo(-NW / 2, 0); sh.lineTo(NW / 2, 0); sh.lineTo(0, 3.6); sh.closePath();
      const gg = new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: false });
      gg.translate(0, WH, sg * (NL / 2) - (sg > 0 ? 0 : 0.3));
      gg.rotateY(0);
      b.addGeo(gg, 'churchWall');
    }
    // Ceiling / attic darkness inside so no sky leaks
    b.add(box(NL - 0.4, 0.2, NW - 0.4, 2), 'interior', { pos: [0, WH - 0.2, 0] });
  }

  /* ---------------------------------------------------------------- BUILD */
  const group = new THREE.Group();
  group.position.set(CHURCH.x, 0, CHURCH.z);
  group.rotation.y = CHURCH.rotY;
  parent.add(group);

  // signs are special-cased meshes
  const signs = b.signs || [];
  b.signs = undefined;
  b.buildInto(group, M);
  for (const s of signs) group.add(s);

  return { group, builder: b, colliders: b.colliders };
}

/**
 * A half-disc "arch head" in the XY plane facing +Z. Used for the tops of the
 * arched openings on the bell tower and the lantern — a cylinder rotated onto
 * its side sticks out both ways and reads as a flying saucer.
 */
function halfDisc(r, segments = 14) {
  const g = new THREE.CircleGeometry(r, segments, 0, Math.PI);
  return g;
}

/* ------------------------------------------------------------------------ */
function buildBellTower(b, M, tx, tz, nightMode) {
  const H = 25.0;
  const baseW = 4.4;

  // -- Base: red brick with cream bands and quoins
  b.add(box(baseW + 0.5, 0.6, baseW + 0.5, TEXSCALE.brick), 'concreteTrim', { pos: [tx, 0.3, tz], collide: true });
  b.add(box(baseW, 9.0, baseW, TEXSCALE.brick), 'brick', { pos: [tx, 5.1, tz], collide: true });
  // cream string courses
  for (const y of [9.7, 4.6, 1.0]) {
    b.add(box(baseW + 0.22, 0.36, baseW + 0.22, 2), 'churchTrim', { pos: [tx, y, tz] });
  }
  // cream corner pilasters
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.add(box(0.5, 9.2, 0.5, 2), 'churchTrim', { pos: [tx + sx * baseW / 2, 5.1, tz + sz * baseW / 2] });
  }
  // Tall narrow arched windows on the shaft (front + sides)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    put(b, box(0.7, 4.6, 0.14, 1), 'glassDark',
      [tx + Math.sin(a) * (baseW / 2 + 0.02), 5.4, tz + Math.cos(a) * (baseW / 2 + 0.02)], { yaw: a });
    put(b, box(0.95, 0.2, 0.3, 1), 'churchTrim',
      [tx + Math.sin(a) * (baseW / 2 + 0.08), 7.9, tz + Math.cos(a) * (baseW / 2 + 0.08)], { yaw: a });
  }

  // -- First open stage: balustraded gallery + arched belfry openings
  const stageW = 3.9;
  b.add(box(baseW + 0.7, 0.5, baseW + 0.7, 2), 'churchTrim', { pos: [tx, 9.85, tz] });
  b.add(box(stageW, 0.4, stageW, TEXSCALE.brick), 'brick', { pos: [tx, 10.3, tz] });
  // 4 corner piers
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.add(box(0.62, 4.6, 0.62, 2), 'churchTrim', { pos: [tx + sx * stageW / 2, 12.8, tz + sz * stageW / 2] });
  }
  // Arched openings (dark, with a bell silhouette inside)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    b.add(box(2.5, 4.2, 0.12, 1), nightMode ? 'glassLit' : 'interior', {
      pos: [tx + Math.sin(a) * (stageW / 2 - 0.25), 12.7, tz + Math.cos(a) * (stageW / 2 - 0.25)], rot: [0, a, 0],
    });
    // arch head (half-cylinder pressed against the opening)
    const arch = cylinder(1.25, 1.25, 0.12, 12, 1);
    arch.rotateX(Math.PI / 2);
    arch.translate(tx + Math.sin(a) * (stageW / 2 - 0.2), 14.8, tz + Math.cos(a) * (stageW / 2 - 0.2));
    if (Math.abs(Math.sin(a)) > 0.5) arch.rotateY(Math.PI / 2);
    b.addGeo(arch, nightMode ? 'glassLit' : 'interior');
  }
  // Bell visible in the tower
  b.add(cylinder(0.34, 0.72, 1.1, 14), 'brass', { pos: [tx, 12.5, tz] });
  b.add(cylinder(0.76, 0.76, 0.1, 14), 'brass', { pos: [tx, 11.94, tz] });

  // balustrade railing round the gallery
  const rr = stageW / 2 + 0.36;
  b.add(box(stageW + 0.9, 0.24, 0.24, 2), 'churchTrim', { pos: [tx, 10.55, tz + rr] });
  b.add(box(stageW + 0.9, 0.24, 0.24, 2), 'churchTrim', { pos: [tx, 10.55, tz - rr] });
  b.add(box(0.24, 0.24, stageW + 0.9, 2), 'churchTrim', { pos: [tx + rr, 10.55, tz] });
  b.add(box(0.24, 0.24, stageW + 0.9, 2), 'churchTrim', { pos: [tx - rr, 10.55, tz] });

  // -- Upper stage (narrower) with 4 arched windows
  const upW = 2.9;
  b.add(box(stageW + 0.9, 0.55, stageW + 0.9, 2), 'churchTrim', { pos: [tx, 15.35, tz] });
  b.add(box(upW, 4.2, upW, TEXSCALE.brick), 'brick', { pos: [tx, 17.7, tz] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.add(box(0.44, 4.3, 0.44, 2), 'churchTrim', { pos: [tx + sx * upW / 2, 17.7, tz + sz * upW / 2] });
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    put(b, box(1.1, 2.4, 0.12, 1), nightMode ? 'glassLit' : 'glassDark',
      [tx + Math.sin(a) * (upW / 2 + 0.01), 17.9, tz + Math.cos(a) * (upW / 2 + 0.01)], { yaw: a });
  }
  b.add(box(stageW + 0.5, 0.5, stageW + 0.5, 2), 'churchTrim', { pos: [tx, 19.95, tz] });

  // -- Octagonal lantern + dome + cross
  b.add(cylinder(1.32, 1.5, 1.9, 8), 'churchTrim', { pos: [tx, 21.15, tz] });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    put(b, box(0.4, 1.6, 0.14, 1), nightMode ? 'glassLit' : 'glassDark',
      [tx + Math.sin(a) * 1.42, 21.2, tz + Math.cos(a) * 1.42], { yaw: a });
  }
  b.add(cylinder(1.7, 1.55, 0.3, 8), 'churchTrim', { pos: [tx, 22.3, tz] });
  for (const p of dome(1.62, { key: 'churchDome', seg: 20, rings: 9, squash: 1.0 })) {
    b.addGeo(p.geo.clone().translate(tx, 22.45, tz), p.key);
  }
  b.add(sphere(0.2, 10), 'churchTrim', { pos: [tx, 24.2, tz] });
  for (const p of cross(1.7, 0.11, 0.11, 'churchTrim')) {
    b.addGeo(p.geo.clone().translate(tx, 24.25, tz), p.key);
  }

  b.addCollider([tx - baseW / 2, 0, tz - baseW / 2], [tx + baseW / 2, H, tz + baseW / 2]);
}
