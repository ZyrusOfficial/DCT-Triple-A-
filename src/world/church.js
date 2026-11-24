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
import { buildChurchInterior, robedFigure } from './church-interior.js';
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
  /**
   * Bell tower placement, in the church's LOCAL frame.
   *
   * Local +Z is the façade direction (toward the plaza, world +X after the
   * +π/2 yaw). Local +X maps to world −Z, i.e. SOUTH. In the photographs the
   * campanile stands on the LEFT as you face the church from the plaza, which
   * is on the façade side and toward the south — so local (+x, +z).
   */
  tower: { x: 10.5, z: 15.5 },
};

export function buildChurch(parent, M, { nightMode = false } = {}) {
  const b = new Builder('church');
  const churchLights = [];
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

  /**
   * The shrine stands ~1.1 m above the plaza on a broad stone platform, with a
   * flight of steps across the whole façade — this is what makes it read as the
   * dominant building in the photographs rather than a shed at ground level.
   */
  const PLINTH = 1.15;
  // bp = "plinth builder": stays at grade, so it lives outside the lifted group.
  const bp = new Builder('church-plinth');
  bp.add(box(NW + 9.0, PLINTH, NL + 12.0, TEXSCALE.concrete), 'concreteTrim',
    { pos: [0, PLINTH / 2, -1.0], collide: true });
  bp.add(box(NW + 8.6, 0.05, NL + 11.6, TEXSCALE.paving), 'pavingRed',
    { pos: [0, PLINTH + 0.025, -1.0] });
  // Grand steps across the façade, descending to the forecourt
  for (let i = 0; i < 4; i++) {
    bp.add(box(NW + 8.2, 0.29, 0.72, TEXSCALE.paving), 'concreteTrim', {
      pos: [0, 0.145 + i * 0.29, NL / 2 + 6.0 - i * 0.72],
    });
  }
  for (const sx of [-1, 1]) {
    bp.add(box(0.75, 1.3, 3.6, 2), 'concreteTrim',
      { pos: [sx * (NW / 2 + 4.5), 0.65, NL / 2 + 4.4], collide: true });
  }
  /**
   * FLOOR SLAB — deliberately NOT inside the nave.
   *
   * The church body group is lifted onto the plinth by PLINTH = 1.15 m, so a slab
   * authored at y 0.25 with 0.5 thickness lands with its TOP at 1.65 m — half a
   * metre above the interior's own floor at 1.15 + 0.03. It out-ranked
   * everything the interior built in the sanctuary: ray-casting straight down
   * over the altar gave church:concreteDark at 1.65, ahead of
   * church-interior:sanctuaryFloor at 1.21, and the sanctuary read as a blown-out
   * white pool with a floating altar.
   *
   * This is the SAME class of bug as the tileCream nave floor that used to sit at
   * y 0.52 and bury the whole interior. The lesson generalises: the exterior
   * shell must never own a surface inside the nave. What is left here is a narrow
   * apron ring — enough to close the gap between the wall footings and the
   * plinth from outside, with a hole where the interior's floor goes.
   */
  for (const [aw, ad, ax, az] of [
    // front and rear aprons, outside the nave
    [NW + 1.2, 0.6, 0, NL / 2 + 0.1],
    [NW + 1.2, 0.6, 0, -NL / 2 - 0.1],
    // side aprons
    [0.6, NL + 1.4, NW / 2 + 0.3, 0],
    [0.6, NL + 1.4, -NW / 2 - 0.3, 0],
  ]) {
    b.add(box(aw, 0.5, ad, TEXSCALE.concrete), 'concreteDark',
      { pos: [ax, 0.25, az], collide: true });
  }
  /**
   * NO NAVE FLOOR HERE.
   *
   * There used to be a tileCream slab filling the nave at y 0.52, and it was the
   * pale surface you saw when you walked in — sitting half a metre ABOVE the
   * interior's own floor, so the interior floor, red runner and sanctuary
   * platform were all buried under it. It also made the nave read as a white
   * tiled hall rather than the stone floor in the references.
   *
   * Confirmed by ray-casting down from inside: first hit church:tileCream at
   * 1.28 m, ahead of church-interior:sanctuaryFloor at 1.79 m.
   *
   * The nave floor belongs to church-interior.js, which builds it together with
   * the runner and the sanctuary platform. The apse surround outside the south
   * wall is kept, since nothing inside replaces it.
   */
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
  /**
   * Reading the reference elevation:
   *   • The porch is nearly as wide as the church and only ~6 m deep.
   *   • It is carried on SIX heavy round columns (Ø ≈ 0.95 m) standing on
   *     square plinths, standing clear of the façade so there is a proper
   *     dark walkway behind them.
   *   • A deep flat slab roof with a bold white fascia band, and the parish
   *     name in spaced dark letters across that band.
   *   • Three shallow steps run the full width, with cheek walls.
   */
  {
    const PW = NW + 5.0;          // porch slightly wider than the nave
    const PD = 6.6;               // depth
    const PH = 8.0;               // underside of the slab
    const PZ = facadeZ + PD / 2;  // centre of the porch
    const colR = 0.48;

    // Slab + fascia
    b.add(box(PW, 0.62, PD, 2), 'churchTrim', { pos: [0, PH + 0.31, PZ] });
    b.add(box(PW + 0.7, 0.26, PD + 0.7, 2), 'churchTrim', { pos: [0, PH + 0.75, PZ] });
    // Bold fascia band that carries the lettering
    b.add(box(PW + 0.5, 1.05, 0.3, 2), 'churchWall', { pos: [0, PH - 0.3, PZ + PD / 2 - 0.05] });
    // Thin white cornice above and below the band
    b.add(box(PW + 0.8, 0.12, 0.42, 2), 'churchTrim', { pos: [0, PH + 0.24, PZ + PD / 2 + 0.02] });
    b.add(box(PW + 0.8, 0.12, 0.42, 2), 'churchTrim', { pos: [0, PH - 0.86, PZ + PD / 2 + 0.02] });

    // Lettering
    {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(PW * 0.9, 0.82), M.signChurch);
      sign.position.set(0, PH - 0.3, PZ + PD / 2 + 0.18);
      b.addSign(sign);
    }

    // Six columns across the front, standing on plinths
    const colX = [-10.3, -6.2, -2.1, 2.1, 6.2, 10.3];
    const cz = PZ + PD / 2 - 0.75;
    for (const x of colX) {
      // plinth
      b.add(box(1.16, 0.42, 1.16, 1.6), 'churchTrim', { pos: [x, 0.21, cz] });
      // shaft (slightly tapered, as in the photo)
      b.add(cylinder(colR * 0.93, colR, PH - 0.95, 20, 1.6), 'churchWall',
        { pos: [x, 0.42 + (PH - 0.95) / 2, cz] });
      // base moulding + capital
      b.add(cylinder(colR * 1.13, colR * 1.22, 0.2, 20, 1.6), 'churchTrim',
        { pos: [x, 0.52, cz] });
      b.add(box(colR * 2.3, 0.2, colR * 2.3, 1.6), 'churchTrim',
        { pos: [x, PH - 0.62, cz] });
      b.add(cylinder(colR * 1.16, colR * 1.0, 0.18, 20, 1.6), 'churchTrim',
        { pos: [x, PH - 0.44, cz] });
      b.addCollider([x - 0.62, 0, cz - 0.62], [x + 0.62, PH, cz + 0.62]);
    }

    /**
     * Porch open sides. These must NOT be solid walls: a solid slab turns the
     * portico into a box and the result is a black hole from every angle except
     * straight on. In the reference the porch is open — a colonnade of three
     * arches each side. We build a solid head wall with three round-arched
     * openings punched through it.
     */
    for (const sx of [-1, 1]) {
      const wallX = sx * (PW / 2 - 0.18);
      const headY = PH - 0.9;          // springing height of the arches
      // spandrel / head beam above the arches
      b.add(box(0.44, 0.95, PD - 0.5, 2), 'churchWall',
        { pos: [wallX, PH - 0.45, PZ] });
      // piers between the arches
      for (const zz of [PZ - PD / 2 + 0.3, PZ - PD / 6, PZ + PD / 6, PZ + PD / 2 - 0.3]) {
        b.add(box(0.44, headY - 0.55, 0.5, 2), 'churchWall',
          { pos: [wallX, 0.55 + (headY - 0.55) / 2, zz], collide: true });
      }
      // arch heads (half discs), one per bay
      for (const zz of [PZ - PD / 3, PZ, PZ + PD / 3]) {
        put(b, halfDisc(0.86, 14), 'churchWall', [wallX, headY - 0.55, zz],
          { yaw: sx * Math.PI / 2 });
      }
      // low balustrade across each opening
      b.add(box(0.3, 0.5, PD - 0.9, 2), 'churchTrim',
        { pos: [wallX, 0.25, PZ], collide: true });
    }

    // Floor: raised slab with a tiled surface
    b.add(box(PW, 0.5, PD + 0.4, 2), 'churchTrim', { pos: [0, 0.25, PZ] });
    b.add(box(PW - 0.5, 0.06, PD, TEXSCALE.paving), 'tileCream', { pos: [0, 0.53, PZ] });

    // Three steps down to the forecourt
    for (let i = 0; i < 3; i++) {
      b.add(box(PW + 1.6, 0.17, 0.5, TEXSCALE.paving), 'paving', {
        pos: [0, 0.085 + i * 0.17, PZ + PD / 2 + 1.35 - i * 0.5],
      });
    }
    // cheek walls either side of the steps
    for (const sx of [-1, 1]) {
      b.add(box(0.45, 0.62, 1.9, 2), 'churchTrim',
        { pos: [sx * (PW / 2 + 0.75), 0.31, PZ + PD / 2 + 0.85], collide: true });
    }

    /**
     * Soffit. In reality this is a deep brown timber ceiling that receives a lot
     * of bounced light from the white forecourt — so it must NOT read as a black
     * hole. We use the paler timber plus a dedicated warm fill light underneath.
     */
    b.add(box(PW - 0.4, 0.09, PD - 0.4, 1.4), 'woodSoffit', { pos: [0, PH - 0.52, PZ] });
    for (let i = -3; i <= 3; i++) {
      b.add(box(PW - 0.5, 0.2, 0.2, 1.4), 'woodSoffit', { pos: [0, PH - 0.6, PZ + i * 0.9] });
    }
    for (const sx of [-1, 1]) {
      b.add(box(0.24, 0.24, PD - 0.4, 1.4), 'woodSoffit', { pos: [sx * (PW / 2 - 0.45), PH - 0.62, PZ] });
    }
    // Bright painted coffer panels between the beams catch the bounce.
    for (let i = -3; i < 3; i++) {
      b.add(box(PW - 1.0, 0.06, 0.66, 1), 'soffitPanel',
        { pos: [0, PH - 0.47, PZ + i * 0.9 + 0.45] });
    }
    // A soft warm point light so the porch interior is legible at any sun angle.
    const pl = new THREE.PointLight(0xfff2dc, 26.0, 26, 1.7);
    pl.position.set(0, PH - 1.5, PZ - 0.4);
    churchLights.push(pl);

    /* ---------------- main door: double leaf, dark timber, carved panels ---- */
    {
      const dz = facadeZ + 0.44;
      // arched reveal
      b.add(box(4.2, 0.5, 0.95, 1.5), 'churchTrim', { pos: [0, 5.15, facadeZ + 0.34] });
      for (const s of [-1, 1]) {
        b.add(box(0.34, 5.0, 0.95, 1.5), 'churchTrim', { pos: [s * 1.95, 2.5, facadeZ + 0.34] });
        /**
         * Leaf, standing OPEN.
         *
         * The interior is a fully modelled space and the whole point is that you
         * can walk into it, so a shut leaf (which is also a collider) walls it
         * off. Each leaf is hinged at its outer jamb and swung ~94 degrees into
         * the nave.
         *
         * put() rotates about the geometry's own origin BEFORE translating, so
         * the geometry is offset half a leaf along +X first to put the rotation
         * centre on the hinge.
         */
        {
          const HALF = 0.86;
          const hinge = s * 1.76;          // outer jamb, in the shrine's local X
          const swing = s * Math.PI * 0.52 * -1;
          // The leaf and its carved panels are built as one hinged assembly, so
          // they swing together: each piece is offset to the hinge before the
          // shared rotation.
          const leaf = new THREE.BoxGeometry(1.72, 4.6, 0.16);
          leaf.translate(HALF, 0, 0);
          put(b, leaf, 'woodDark', [hinge, 2.35, dz], { yaw: swing });

          for (const [py, ph] of [[1.2, 1.75], [3.15, 1.35]]) {
            const panel = new THREE.BoxGeometry(1.16, ph, 0.06);
            panel.translate(HALF, 0, 0.11);
            put(b, panel, 'wood', [hinge, 2.35 + py - 1.0, dz], { yaw: swing });
          }
          // handle, on the leading stile
          const grip = new THREE.CylinderGeometry(0.045, 0.045, 0.6, 6);
          grip.rotateX(Math.PI / 2);
          grip.translate(1.62, 0, 0.18);
          put(b, grip, 'brass', [hinge, 2.35, dz], { yaw: swing });
        }
      }
      // transom light
      b.add(box(3.3, 0.6, 0.12, 1), nightMode ? 'glassLit' : 'glass', { pos: [0, 4.9, dz + 0.02] });
    }

    /* --------------------------- two side doors, simpler ------------------ */
    /**
     * Side doors.
     *
     * These were a single flat slab of `woodDark` recessed behind the porch,
     * with a plain surround. In shade they carried no value at all and read as
     * two black holes punched in the façade — the first thing the eye went to
     * from the plaza.
     *
     * A door is legible from its construction, not its colour: two leaves, a
     * centre stile, raised panels, a transom over the head, a threshold and a
     * pair of handles. All of that sits a few centimetres proud of the wall, so
     * it catches the porch light and the opening stops being a void.
     */
    for (const s of [-1, 1]) {
      const dz = facadeZ + 0.42;
      const dx = s * (NW / 2 - 2.4);
      // recess: a shallow dark reveal behind the leaves
      b.add(box(2.1, 3.55, 0.10, 1.2), 'woodDark', { pos: [dx, 1.85, dz - 0.03], collide: true });
      // two leaves, each with a centre stile and two raised panels
      for (const q of [-1, 1]) {
        const lx = dx + q * 0.51;
        b.add(box(0.98, 3.5, 0.06, 1.2), 'wood', { pos: [lx, 1.82, dz + 0.05] });
        for (const py of [0.85, 2.15]) {
          b.add(box(0.74, 1.05, 0.035, 1), 'woodDark', { pos: [lx, py, dz + 0.09] });
          b.add(box(0.80, 1.11, 0.02, 1), 'churchTrim', { pos: [lx, py, dz + 0.075] });
        }
        // handle
        b.add(cylinder(0.028, 0.028, 0.16, 6), 'brass',
          { pos: [lx - q * 0.36, 1.62, dz + 0.11], rot: [Math.PI / 2, 0, 0] });
      }
      // transom light over the head
      b.add(box(1.96, 0.42, 0.08, 1), 'windowGlow',
        { pos: [dx, 3.78, dz + 0.02] });
      b.add(box(2.1, 0.09, 0.14, 1), 'churchTrim', { pos: [dx, 3.56, dz + 0.04] });
      // surround, archivolt and threshold
      b.add(box(2.35, 0.22, 0.44, 1.5), 'churchTrim', { pos: [dx, 4.06, dz + 0.05] });
      for (const q of [-1, 1]) {
        b.add(box(0.22, 4.0, 0.44, 1.5), 'churchTrim', { pos: [dx + q * 1.16, 2.05, dz + 0.05] });
        b.add(box(0.10, 3.6, 0.10, 1), 'pavingRed', { pos: [dx + q * 1.30, 1.80, dz + 0.12] });
      }
      b.add(box(2.5, 0.10, 0.62, 1.5), 'pavingRed', { pos: [dx, 0.05, dz + 0.20] });
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
    /**
     * San Nicolas de Tolentino in the porch forecourt.
     *
     * This is the figure a visitor walks up to, so it gets the same lathed-robe
     * builder as the retablo niches instead of three stacked cylinders — which at
     * this scale rendered as a black cone with a white ball balanced on it.
     *
     * Built at 1.35x niche scale and in the OUTDOOR robe material. The near-black
     * Dominican habit used inside the nave collapses into a featureless silhouette
     * out here, where the only light is sky against a pale porch; churchyard
     * statues here are almost always painted pale anyway.
     */
    {
      const fig = robedFigure({
        robe: 'statueRobedOutdoor', dark: 'statueRobedOutdoor', skin: 'statue',
        halo: true, book: true, staff: false, scale: 1.35,
      });
      for (const { geo, key } of fig) {
        const gg = geo.clone();
        gg.rotateY(0.7);
        gg.translate(sx, 1.72, sz);
        b.addGeo(gg, key);
      }
    }
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

  /**
   * Roof over the nave.
   *
   * gableRoof() authors a roof whose ridge runs along local X, with the two
   * slopes falling toward ±Z, and it is centred on the origin. The nave here
   * runs along local Z, so the finished geometry is yawed 90° — after which the
   * ridge runs along Z (correct) and the slopes fall toward ±X (correct).
   *
   * The gable-end infill is a triangle extruded along +Z; ExtrudeGeometry puts
   * its profile on z = 0..depth, and the triangle's apex must reach the ridge,
   * so the infill is authored in the ROOF's frame and yawed with it rather than
   * being placed by hand at ±NL/2 (which is what put a slab through the nave).
   */
  {
    const RISE = 3.6;
    const roofParts = gableRoof(NL + 1.4, NW, RISE, {
      key: 'roofRib', overhang: 0.9, fasciaKey: 'churchTrim', thickness: 0.12,
    });
    for (const p of roofParts) {
      const g = p.geo.clone();
      g.rotateY(Math.PI / 2);
      g.translate(0, WH, 0);
      b.addGeo(g, p.key);
    }

    /**
     * Gable-end infill. The nave runs along local Z, so the gable end is a thin
     * vertical triangular plate spanning X and rising in Y, extruded along +Z.
     * No yaw is needed — the profile already lies in the correct plane.
     */
    for (const sg of [-1, 1]) {
      const sh = new THREE.Shape();
      sh.moveTo(-NW / 2, 0);
      sh.lineTo(NW / 2, 0);
      sh.lineTo(0, RISE);
      sh.closePath();
      const gg = new THREE.ExtrudeGeometry(sh, { depth: 0.36, bevelEnabled: false });
      // ExtrudeGeometry occupies z ∈ [0, depth]; pull it back so it straddles
      // the nave end wall rather than sitting entirely proud of it.
      gg.translate(0, WH, sg * (NL / 2) - (sg > 0 ? 0.36 : 0));
      b.addGeo(gg, 'churchWall');
    }

    /**
     * Attic floor. Its job is only to stop daylight leaking through the roof
     * void when you look up from inside the nave, so it sits just under the
     * eaves and is cancelled by the coved ceiling below it. Crucially it must
     * NOT be visible from outside through the head openings — see the porch
     * head fills, which are what actually keep the wall opaque.
     *
     * X is the nave WIDTH and Z is the nave LENGTH here; swapping them produced
     * a slab projecting past the church on all four sides.
     */
    /**
     * NO FLAT NAVE CEILING HERE.
     *
     * There used to be one at WH - 0.28 and it was why the nave never showed its
     * roof: the interior builds a pitched boarded ceiling over exposed scissor
     * trusses whose ridge is well above the wall head, so a slab at wall-plate
     * level sealed it off completely. Every "why are the trusses invisible"
     * investigation was looking at THIS slab, through the shell's material.
     *
     * Found by casting a ray straight up from the nave floor: the first hit was
     * church:soffitPanel at 9.59 m, ahead of church-interior:trussWood at
     * 13.18 m and the interior boarding above that.
     *
     * The nave is closed by the pitched ceiling in church-interior.js and by the
     * roof structure outside it, so nothing is open to the sky.
     */
  }

  /* ---------------------------------------------------------------- BUILD */
  // Two groups at the same XZ: the plinth stays at grade, the church body is
  // lifted onto it. Both share the survey yaw.
  const plinthGroup = new THREE.Group();
  plinthGroup.position.set(CHURCH.x, 0, CHURCH.z);
  plinthGroup.rotation.y = CHURCH.rotY;
  parent.add(plinthGroup);
  const pSigns = bp.signs || []; bp.signs = undefined;
  bp.buildInto(plinthGroup, M);
  for (const s2 of pSigns) plinthGroup.add(s2);

  const group = new THREE.Group();
  group.position.set(CHURCH.x, PLINTH, CHURCH.z);
  group.rotation.y = CHURCH.rotY;
  parent.add(group);

  // signs are special-cased meshes
  const signs = b.signs || [];
  b.signs = undefined;
  b.buildInto(group, M);
  for (const s of signs) group.add(s);

  /**
   * Interior, parented to the body group so it inherits the survey position and
   * the +pi/2 yaw. Built after the shell so it can sit inside it.
   */
  const interior = buildChurchInterior(group, M, {
    naveW: NW, naveL: NL, wallH: WH, gableRise: CHURCH.gableRise,
  });

  /**
   * Two interior point lights only. A closed masonry box gets no sun and no
   * skylight, and each extra point light multiplies shader permutations for
   * every material in the scene — so the interreflection stand-in on the
   * interior materials does the rest.
   */
  const naveLight = new THREE.PointLight(0xfff6e8, 20, 52, 1.15);
  naveLight.position.set(0, WH - 1.6, 4.0);
  // Intensity 18 at 9.4 m directly over the altar turned the whole sanctuary
  // into a white bloom (the marble and cloth both clipped to pure white, so the
  // altar read as a glowing slab). Drop it, pull it back behind the retablo so
  // it rakes the reredos instead of spot-lighting the mensa, and warm it.
  const altarLight = new THREE.PointLight(0xffe0ad, 7.5, 22, 1.5);
  altarLight.position.set(0, WH - 3.4, -NL / 2 + 1.2);
  /**
   * Low fill, standing in for floor bounce.
   *
   * Two point lights hung near the roof wash the tops of the walls and the
   * ceiling, but a point light's inverse-square falloff means the floor 9 m
   * below them gets a fraction of that. In a real nave the floor is lit by
   * light bouncing off itself — which a forward renderer does not compute. This
   * third light sits low and near the aisle, is dim, and its whole job is to
   * give the floor and pews a base level so the nave does not read as a pit
   * below a bright ceiling.
   */
  const floorFill = new THREE.PointLight(0xffe9cc, 14, 34, 1.0);
  floorFill.position.set(0, 1.6, -2.0);
  group.add(naveLight, altarLight, floorFill);
  churchLights.push(naveLight, altarLight, floorFill);

  for (const l of churchLights) group.add(l);

  // Colliders: the plinth's own colliders are world-space already relative to
  // the group, so merge and shift both sets into true world space.
  const colliders = [
    ...bp.colliders.map((c) => shiftBox(c, CHURCH.x, 0, CHURCH.z, CHURCH.rotY)),
    ...b.colliders.map((c) => shiftBox(c, CHURCH.x, PLINTH, CHURCH.z, CHURCH.rotY)),
  ];
  return { group, plinthGroup, builder: b, colliders, lights: churchLights, interior };
}

/** Rotate an AABB corners by yaw and translate; returns a new AABB. */
function shiftBox(c, dx, dy, dz, yaw) {
  const cs = Math.cos(yaw), sn = Math.sin(yaw);
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (const x of [c.min.x, c.max.x]) {
    for (const y of [c.min.y, c.max.y]) {
      for (const z of [c.min.z, c.max.z]) {
        const wx = x * cs + z * sn + dx;
        const wz = -x * sn + z * cs + dz;
        const p = new THREE.Vector3(wx, y + dy, wz);
        min.min(p); max.max(p);
      }
    }
  }
  return { min, max };
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
/**
 * The detached bell tower (campanile) east of the shrine.
 *
 * Reference reading: a tall red-brick shaft on a stone base, with cream string
 * courses and corner quoins, then an open belfry stage with a round-arched
 * opening on each face, then a smaller open lantern stage, then an octagonal
 * drum carrying a small dome and a cross. About 2.2× the nave height.
 *
 * Everything here is authored with put() so no geometry is ever rotated after
 * being translated into world space.
 */
function buildBellTower(b, M, tx, tz, nightMode) {
  const baseW = 4.6;      // brick shaft
  const shaftH = 11.0;
  const stageW = 4.1;     // open belfry
  const upW = 3.4;        // lantern stage

  /* ------------------------------------------------------------ stone base */
  b.add(box(baseW + 1.1, 0.75, baseW + 1.1, TEXSCALE.concrete), 'concreteTrim',
    { pos: [tx, 0.375, tz], collide: true });
  b.add(box(baseW + 0.75, 0.3, baseW + 0.75, TEXSCALE.concrete), 'concreteDark',
    { pos: [tx, 0.9, tz] });

  /* ---------------------------------------------------------- brick shaft  */
  b.add(box(baseW, shaftH, baseW, TEXSCALE.brick), 'brick', { pos: [tx, 1.05 + shaftH / 2, tz], collide: true });
  // cream string courses — three of them, as in the photos
  for (const y of [1.35, 6.5, 10.6]) {
    b.add(box(baseW + 0.26, 0.34, baseW + 0.26, 2.4), 'churchTrim', { pos: [tx, y, tz] });
  }
  // corner quoins
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.add(box(0.52, shaftH, 0.52, 2.4), 'churchTrim',
      { pos: [tx + sx * (baseW / 2 - 0.06), 1.05 + shaftH / 2, tz + sz * (baseW / 2 - 0.06)] });
  }
  // Tall round-arched windows on the shaft, one per face
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const dx = Math.sin(a), dz = Math.cos(a);
    const px = tx + dx * (baseW / 2 - 0.02), pz = tz + dz * (baseW / 2 - 0.02);
    // recessed glazing
    put(b, box(1.1, 3.6, 0.1, 1), nightMode ? 'glassLit' : 'glassDark', [px, 5.0, pz], { yaw: a });
    // arch head
    const head = halfDisc(0.62, 12);
    put(b, head, nightMode ? 'glassLit' : 'glassDark', [px, 6.78, pz], { yaw: a });
    // cream surround
    put(b, box(1.5, 0.22, 0.22, 2), 'churchTrim', [px, 7.35, pz], { yaw: a });
    for (const q of [-1, 1]) {
      put(b, box(0.22, 4.0, 0.22, 2), 'churchTrim',
        [tx + dx * (baseW / 2 + 0.05) + dz * q * 0.7, 4.9,
         tz + dz * (baseW / 2 + 0.05) - dx * q * 0.7], { yaw: a });
    }
    // sill
    put(b, box(1.6, 0.16, 0.34, 2), 'churchTrim', [px, 3.1, pz], { yaw: a });
  }

  /* --------------------------------------------------- corbelled gallery  */
  const galY = 1.05 + shaftH;                     // 12.05
  b.add(box(baseW + 1.35, 0.34, baseW + 1.35, 2.4), 'churchTrim', { pos: [tx, galY + 0.17, tz] });
  b.add(box(baseW + 0.95, 0.3, baseW + 0.95, 2.4), 'churchTrim', { pos: [tx, galY + 0.49, tz] });
  // balustrade: posts + rail
  const rr = stageW / 2 + 0.55;
  for (const sx of [-1, 1]) {
    for (let i = -2; i <= 2; i++) {
      const o = i * (2 * rr) / 4;
      b.add(box(0.17, 0.78, 0.17, 1.2), 'churchTrim', { pos: [tx + sx * rr, galY + 1.05, tz + o] });
      b.add(box(0.17, 0.78, 0.17, 1.2), 'churchTrim', { pos: [tx + o, galY + 1.05, tz + sx * rr] });
    }
  }
  for (const sx of [-1, 1]) {
    b.add(box(0.3, 0.2, 2 * rr + 0.3, 2), 'churchTrim', { pos: [tx + sx * rr, galY + 1.52, tz] });
    b.add(box(2 * rr + 0.3, 0.2, 0.3, 2), 'churchTrim', { pos: [tx, galY + 1.52, tz + sx * rr] });
  }

  /* ------------------------------------------------------- open belfry stage */
  const belfryY = galY + 0.64;                    // 12.69
  const belfryH = 4.8;
  // Four corner piers
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.add(box(0.85, belfryH, 0.85, 2.4), 'brick',
      { pos: [tx + sx * (stageW / 2 - 0.42), belfryY + belfryH / 2, tz + sz * (stageW / 2 - 0.42)] });
    b.add(box(0.99, 0.26, 0.99, 2.4), 'churchTrim',
      { pos: [tx + sx * (stageW / 2 - 0.42), belfryY + belfryH - 0.5, tz + sz * (stageW / 2 - 0.42)] });
  }
  // Round-arched openings on all four faces — dark void + half-disc head
  const openW = stageW - 1.7;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const dx = Math.sin(a), dz = Math.cos(a);
    const px = tx + dx * (stageW / 2 - 0.45), pz = tz + dz * (stageW / 2 - 0.45);
    const archTopY = belfryY + 3.15;
    put(b, box(openW, 3.15, 0.14, 1), nightMode ? 'glassLit' : 'interior',
      [px, belfryY + 3.15 / 2 + 0.35, pz], { yaw: a });
    put(b, halfDisc(openW / 2, 14), nightMode ? 'glassLit' : 'interior',
      [px, archTopY + 0.35, pz], { yaw: a });
    // cream archivolt around the opening
    for (const q of [-1, 1]) {
      put(b, box(0.2, 3.4, 0.22, 1.6), 'churchTrim',
        [tx + dx * (stageW / 2 - 0.36) + dz * q * (openW / 2 + 0.1), belfryY + 1.95,
         tz + dz * (stageW / 2 - 0.36) - dx * q * (openW / 2 + 0.1)], { yaw: a });
    }
  }
  // The swinging bell, visible through the openings
  b.add(cylinder(0.42, 0.86, 1.3, 16), 'brass', { pos: [tx, belfryY + 2.55, tz] });
  b.add(cylinder(0.9, 0.9, 0.12, 16), 'brass', { pos: [tx, belfryY + 1.85, tz] });
  b.add(box(0.14, 0.62, 0.14, 1), 'woodDark', { pos: [tx, belfryY + 3.6, tz] });
  // timber bell frame
  for (const sz of [-1, 1]) {
    b.add(box(1.5, 0.2, 0.2, 1.4), 'woodDark', { pos: [tx, belfryY + 3.86, tz + sz * 0.55] });
  }

  /* ----------------------------------------------------- cornice + lantern */
  const cornY = belfryY + belfryH;                // 17.49
  b.add(box(stageW + 1.1, 0.38, stageW + 1.1, 2.4), 'churchTrim', { pos: [tx, cornY + 0.19, tz] });
  b.add(box(stageW + 0.6, 0.26, stageW + 0.6, 2.4), 'churchTrim', { pos: [tx, cornY + 0.51, tz] });
  // small dentil course
  for (let i = -3; i <= 3; i++) {
    for (const sz of [-1, 1]) {
      b.add(box(0.22, 0.2, 0.22, 1.4), 'churchTrim',
        { pos: [tx + i * (stageW - 0.4) / 3, cornY + 0.08, tz + sz * (stageW / 2 + 0.4)] });
      b.add(box(0.22, 0.2, 0.22, 1.4), 'churchTrim',
        { pos: [tx + sz * (stageW / 2 + 0.4), cornY + 0.08, tz + i * (stageW - 0.4) / 3] });
    }
  }

  const lantY = cornY + 0.7;                      // 18.19
  const lantH = 3.5;
  // Open lantern: 8 posts, glazing behind
  b.add(cylinder(upW * 0.52, upW * 0.55, lantH, 8), nightMode ? 'glassLit' : 'glassDark',
    { pos: [tx, lantY + lantH / 2, tz] });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    put(b, box(0.36, lantH, 0.36, 2.4), 'churchTrim',
      [tx + Math.sin(a) * upW * 0.56, lantY + lantH / 2, tz + Math.cos(a) * upW * 0.56], { yaw: a });
  }
  b.add(cylinder(upW * 0.62, upW * 0.72, 0.3, 8), 'churchTrim', { pos: [tx, lantY - 0.12, tz] });

  /* ------------------------------------------------------- dome + finial   */
  const domeY = lantY + lantH + 0.35;
  b.add(cylinder(upW * 0.72, upW * 0.78, 0.42, 8), 'churchTrim', { pos: [tx, domeY - 0.2, tz] });
  for (const p of dome(upW * 0.66, { key: 'churchDome', seg: 22, rings: 10, squash: 1.18 })) {
    b.addGeo(p.geo.clone().translate(tx, domeY, tz), p.key);
  }
  // lantern finial ball + cross
  b.add(cylinder(0.2, 0.3, 0.55, 8), 'churchTrim', { pos: [tx, domeY + upW * 0.66 * 1.18 + 0.2, tz] });
  b.add(sphere(0.22, 12), 'churchTrim', { pos: [tx, domeY + upW * 0.66 * 1.18 + 0.55, tz] });
  for (const p of cross(1.9, 0.12, 0.12, 'churchTrim')) {
    b.addGeo(p.geo.clone().translate(tx, domeY + upW * 0.66 * 1.18 + 0.55, tz), p.key);
  }

  b.addCollider([tx - baseW / 2 - 0.6, 0, tz - baseW / 2 - 0.6],
                [tx + baseW / 2 + 0.6, cornY, tz + baseW / 2 + 0.6]);
}
