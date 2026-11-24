/**
 * Shrine interior.
 *
 * Authored from the Wikimedia Commons interior photographs of the San Nicolas
 * de Tolentino Shrine: a single-vessel nave under a pitched boarded ceiling on
 * exposed dark scissor trusses, pale blue-grey plaster walls over a dark dado,
 * dark stone piers, pale sanctuary floor, and a tall gilded retablo filling the
 * apse with a crucifix in the central niche.
 *
 * Authored in the CHURCH'S LOCAL FRAME (local +Z is the facade, so the apse is
 * at -Z). The caller parents the returned group to the church body group, which
 * already carries the survey position and the +pi/2 yaw, so nothing here does
 * world-space arithmetic.
 *
 * Two lessons from building this are baked in and must not be undone:
 *
 *   1. The boarded ceiling must sit UNDER the roof sheet. The body is wallH 11.8
 *      with gableRise 5.6, so the roof plane at the ridge is near 17.2. If the
 *      boarding rises above it you do not get an error, you get the roof's
 *      unlit underside as a dark band down the middle of the nave, which looks
 *      exactly like a lighting bug and is not one.
 *
 *   2. The boarding must not be drawn on the truss centreline and the trusses
 *      must hang below it. Coincident surfaces hide every truss, which is the
 *      "flat tent roof" failure.
 */
import * as THREE from 'three';
import { Builder, box, cylinder, sphere } from './kit.js';


/**
 * A robed saint, built from primitives.
 *
 * The niches used to hold a bare `cylinder` with a `sphere` balanced on top —
 * legible as "there is something in this niche" from 30 m down the nave and as
 * nothing at all from the altar rail. A statue is read almost entirely from its
 * silhouette: the flare of the robe, the shoulders, the head turned slightly,
 * and whatever the figure is holding.
 *
 * Built from a lathed robe profile rather than stacked cylinders, so the
 * silhouette flares and falls the way a carved robe does. Everything is returned
 * as geometry in local space for the caller to translate.
 *
 * @param o.robe  material key for the garment
 * @param o.skin  material key for face and hands
 * @param o.dark  material key for the inner garment / mantle
 * @param o.halo  true to add a gilded ring behind the head
 * @param o.staff true to add a pastoral staff in the right hand
 * @param o.book  true to add a book held against the chest
 * @param o.scale overall height multiplier (figures are ~1.75 m at 1.0)
 * @returns {THREE.BufferGeometry[]} geometry, untranslated, plus {parts:[...]}
 */
export function robedFigure(o = {}) {
  const out = [];
  const robe = o.robe || 'statueRobed';
  const skin = o.skin || 'statue';
  const dark = o.dark || 'statueRobed';
  const S = o.scale || 1.0;

  /**
   * Robe: a lathe profile from hem to collar. Points are [radius, height] pairs.
   * The bell of the hem and the pinch at the waist are what make it read as a
   * garment; a straight cone reads as a traffic bollard.
   */
  const prof = [
    [0.00, 0.00], [0.38, 0.00], [0.40, 0.06], [0.36, 0.16],
    [0.30, 0.42], [0.27, 0.70], [0.25, 0.95], [0.23, 1.15],
    [0.26, 1.28], [0.24, 1.38], [0.14, 1.46], [0.00, 1.48],
  ];
  const ropePts = prof.map(([r, y]) => new THREE.Vector2(r * S, y * S));
  const lathe = new THREE.LatheGeometry(ropePts, 14);
  out.push({ geo: lathe, key: robe });

  // Shoulders and the mantle over them: a flattened sphere does the shoulders,
  // a second partial lathe the cape.
  const shoulders = new THREE.SphereGeometry(0.24 * S, 12, 8);
  shoulders.scale(1.15, 0.72, 0.86);
  shoulders.translate(0, 1.44 * S, 0);
  out.push({ geo: shoulders, key: robe });

  const cape = new THREE.CylinderGeometry(0.17 * S, 0.34 * S, 0.46 * S, 12, 1, true);
  cape.translate(0, 1.30 * S, 0);
  out.push({ geo: cape, key: dark });

  // Neck and head, turned a little so the figure is not staring dead ahead.
  const neck = new THREE.CylinderGeometry(0.075 * S, 0.095 * S, 0.13 * S, 8);
  neck.translate(0, 1.53 * S, 0);
  out.push({ geo: neck, key: skin });

  const head = new THREE.SphereGeometry(0.135 * S, 14, 11);
  head.scale(0.92, 1.06, 0.96);
  head.rotateY(0.22);
  head.translate(0.012 * S, 1.68 * S, 0.01 * S);
  out.push({ geo: head, key: skin });

  // Arms. Upper arm hangs, forearm comes forward to hold whatever it holds.
  for (const sgn of [-1, 1]) {
    const upper = new THREE.CylinderGeometry(0.062 * S, 0.072 * S, 0.34 * S, 8);
    upper.rotateZ(sgn * 0.16);
    upper.translate(sgn * 0.245 * S, 1.24 * S, 0.01 * S);
    out.push({ geo: upper, key: robe });

    const fore = new THREE.CylinderGeometry(0.052 * S, 0.060 * S, 0.30 * S, 8);
    fore.rotateX(-0.75);
    fore.rotateZ(sgn * 0.10);
    fore.translate(sgn * 0.265 * S, 1.02 * S, 0.14 * S);
    out.push({ geo: fore, key: o.sleeves === false ? skin : robe });

    const hand = new THREE.SphereGeometry(0.055 * S, 8, 6);
    hand.translate(sgn * 0.275 * S, 0.90 * S, 0.27 * S);
    out.push({ geo: hand, key: skin });
  }

  // Feet peeking from under the hem.
  for (const sgn of [-1, 1]) {
    const foot = new THREE.SphereGeometry(0.075 * S, 8, 6);
    foot.scale(1.0, 0.55, 1.5);
    foot.translate(sgn * 0.11 * S, 0.035 * S, 0.10 * S);
    out.push({ geo: foot, key: dark });
  }

  if (o.halo) {
    const ring = new THREE.TorusGeometry(0.21 * S, 0.028 * S, 6, 20);
    ring.translate(0.012 * S, 1.76 * S, -0.10 * S);
    out.push({ geo: ring, key: 'gold' });
    // rays, as a crown of short spikes behind the ring
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const ray = new THREE.BoxGeometry(0.022 * S, 0.10 * S, 0.02 * S);
      ray.rotateZ(a);
      ray.translate(0.012 * S + Math.sin(a) * 0.27 * S, 1.76 * S + Math.cos(a) * 0.27 * S, -0.10 * S);
      out.push({ geo: ray, key: 'goldRay' });
    }
  }

  if (o.staff) {
    const staff = new THREE.CylinderGeometry(0.018 * S, 0.018 * S, 1.55 * S, 6);
    staff.translate(0.30 * S, 0.82 * S, 0.24 * S);
    out.push({ geo: staff, key: 'gold' });
    const crook = new THREE.TorusGeometry(0.10 * S, 0.018 * S, 5, 14, Math.PI * 1.35);
    crook.translate(0.30 * S, 1.60 * S, 0.24 * S);
    out.push({ geo: crook, key: 'gold' });
  }

  if (o.book) {
    const bk = new THREE.BoxGeometry(0.26 * S, 0.035 * S, 0.19 * S);
    bk.rotateX(-0.5);
    bk.translate(0, 1.02 * S, 0.28 * S);
    out.push({ geo: bk, key: o.bookKey || 'altarCloth' });
  }

  return out;
}

/**
 * Place a figure's parts at (x, y, z) and add them to the builder.
 * Parts come back keyed by material, so this loops and translates.
 */
export function placeFigure(b, parts, x, y, z, yaw = 0) {
  for (const { geo, key } of parts) {
    const gg = geo.clone();
    if (yaw) gg.rotateY(yaw);
    gg.translate(x, y, z);
    b.addGeo(gg, key);
  }
}

export function buildChurchInterior(parent, M, CH) {
  const b = new Builder('church-interior');
  const g = new THREE.Group();
  g.name = 'church-interior';

  const NL = CH.naveL;
  const NW = CH.naveW;
  const WH = CH.wallH;
  const facadeZ = NL / 2;
  const apseZ = -NL / 2;
  const inset = 0.30;

  /* ------------------------------------------------------------- FLOOR */
  b.add(box(NW - 0.5, 0.06, NL - 0.5, 3), 'sanctuaryFloor', { pos: [0, 0.03, 0] });
  // Runner: must clear BOTH the floor slab (top 0.06) and the sanctuary platform
  // (top 0.25), and must stop short of the platform or it is buried by it.
  b.add(box(2.2, 0.035, NL - 9.0, 4), 'carpetRed', { pos: [0, 0.09, 2.6] });
  b.add(box(NW - 3.0, 0.22, 6.0, 3), 'sanctuaryFloor', { pos: [0, 0.14, apseZ + 4.1] });
  b.add(box(NW - 2.4, 0.02, 5.6, 4), 'sanctuaryTile', { pos: [0, 0.26, apseZ + 4.1] });

  /* ------------------------------------------------------------- WALLS */
  for (const s of [-1, 1]) {
    b.add(box(0.08, WH - 0.5, NL - 1.0, 3), 'interiorPlaster',
      { pos: [s * (NW / 2 - inset), (WH - 0.5) / 2 + 0.2, 0] });
  }
  for (const s of [-1, 1]) {
    b.add(box(0.07, 1.5, NL - 0.8, 2), 'interiorDado',
      { pos: [s * (NW / 2 - inset + 0.01), 0.95, 0] });
  }
  b.add(box(NW - 0.6, WH - 0.4, 0.06, 3), 'interiorPlaster',
    { pos: [0, (WH - 0.4) / 2 + 0.5, facadeZ - 0.42] });
  b.add(box(NW - 0.6, WH - 0.4, 0.06, 3), 'interiorPlaster',
    { pos: [0, (WH - 0.4) / 2 + 0.5, apseZ + 0.42] });

  for (let z = apseZ + 5.0; z < facadeZ - 2.5; z += 4.4) {
    for (const s of [-1, 1]) {
      b.add(box(0.34, WH - 0.4, 0.72, 2), 'interiorPier',
        { pos: [s * (NW / 2 - inset - 0.03), (WH - 0.4) / 2 + 0.2, z] });
    }
  }

  /* ------------------------------------------- STATIONS OF THE CROSS */
  /**
   * Fourteen plaques, seven down each wall, hung on the piers at eye height.
   *
   * Stations run anticlockwise from the sanctuary: 1-7 up the left (gospel)
   * wall toward the door, 8-14 back down the right, which is how they are
   * actually hung and lets a visitor walk the nave without crossing over.
   *
   * The piers sit every 4.4 m from apseZ+5.0, so the plaques are hung ON the
   * piers rather than floating on the plaster between them: a plaque on a pier
   * reads as fixed to structure, the same plaque on a flat wall reads as a
   * sticker.
   */
  {
    const pierZs = [];
    for (let z = apseZ + 5.0; z < facadeZ - 2.5; z += 4.4) pierZs.push(z);
    const PW = 0.34;              // pier half-thickness, from the pier geometry
    /**
     * Plaque size and hang height.
     *
     * At 0.46 x 0.60 with a dark emissive they read as a smudge on the plaster
     * from the middle of the nave — you could see *something* was there but not
     * that it was a framed picture. Stations are large by design (they carry a
     * whole scene) and hang at eye height, so 0.62 x 0.80 at y 1.95 with the
     * frame standing clear of the pier is what actually reads.
     */
    const PL_W = 0.62, PL_H = 0.80;
    let station = 1;
    // Left wall, sanctuary toward the door.
    for (let i = 0; i < 7 && i < pierZs.length; i++, station++) {
      const z = pierZs[i];
      const x = -(NW / 2 - inset - 0.03) + PW / 2 + 0.03;
      // frame, standing proud of the pier face
      b.add(box(0.07, PL_H + 0.10, PL_W + 0.10, 1), 'stationFrame',
        { pos: [x + 0.015, 1.95, z] });
      /**
       * FACING. PlaneGeometry faces local +Z, so rotateY(+pi/2) turns that normal
       * to +X — toward the nave from the left wall. The first version used
       * -pi/2 here, which aimed both plaque sets INTO the masonry: the planes
       * were backface-culled, and what was left was the frame boxes reading as
       * dark smudges on the plaster. Nothing about it looked like a culling bug.
       */
      const pl = new THREE.PlaneGeometry(PL_W, PL_H);
      pl.rotateY(Math.PI / 2);
      pl.translate(x + 0.055, 1.95, z);
      b.addGeo(pl, 'stationPlaque');
      // a small shelf and a candle cup under each, which is what you actually
      // see below them in a Philippine church
      b.add(box(0.10, 0.03, 0.16, 1), 'stationFrame',
        { pos: [x + 0.05, 1.46, z] });
      b.add(cylinder(0.035, 0.045, 0.08, 8), 'gold',
        { pos: [x + 0.05, 1.51, z] });
    }
    // Right wall, door back toward the sanctuary.
    for (let i = pierZs.length - 1; i >= 0 && station <= 14; i--, station++) {
      const z = pierZs[i];
      const x = (NW / 2 - inset - 0.03) - PW / 2 - 0.03;
      b.add(box(0.07, PL_H + 0.10, PL_W + 0.10, 1), 'stationFrame',
        { pos: [x - 0.015, 1.95, z] });
      // Mirror of the left wall: normal must point -X from the right wall.
      const pl = new THREE.PlaneGeometry(PL_W, PL_H);
      pl.rotateY(-Math.PI / 2);
      pl.translate(x - 0.055, 1.95, z);
      b.addGeo(pl, 'stationPlaque');
      b.add(box(0.10, 0.03, 0.16, 1), 'stationFrame',
        { pos: [x - 0.05, 1.46, z] });
      b.add(cylinder(0.035, 0.045, 0.08, 8), 'gold',
        { pos: [x - 0.05, 1.51, z] });
    }
  }

  /* ------------------------------------------------------------- WINDOWS */
  // Emissive planes: the nave is a closed masonry box, so daylight is faked as
  // emissive surfaces. These are what make the interior legible at all.
  for (let z = apseZ + 5.0; z < facadeZ - 2.5; z += 4.4) {
    for (const s of [-1, 1]) {
      const gz = new THREE.PlaneGeometry(1.55, 3.4);
      gz.rotateY(s > 0 ? -Math.PI / 2 : Math.PI / 2);
      gz.translate(s * (NW / 2 - inset - 0.07), 6.5, z);
      b.addGeo(gz, 'windowGlow');
    }
  }

  /* ------------------------------------------------------------- RETABLO */
  // Three bays under an arched pediment, tall central niche with a crucifix,
  // two tiers of flanking niches, dark twisted columns with gilt capitals.
  {
    const RZ = apseZ + 1.05;
    const RW = NW - 2.6;
    const gold = 'gold';
    const dark = 'altarDark';

    b.add(box(RW, WH - 3.2, 0.5, 2), dark, { pos: [0, (WH - 3.2) / 2 + 2.0, RZ] });
    // Projecting plinth and cornice: without these the whole retablo reads as a
    // flat panel no matter how good the individual niches are.
    b.add(box(RW + 0.7, 0.42, 1.5, 2), gold, { pos: [0, 1.92, RZ + 0.45] });
    b.add(box(RW + 0.5, 0.26, 0.7, 2), gold, { pos: [0, 2.28, RZ + 0.5] });
    b.add(box(RW + 0.45, 0.3, 1.05, 2), gold, { pos: [0, WH - 1.35, RZ + 0.42] });
    b.add(box(RW + 0.2, 0.16, 0.55, 2), gold, { pos: [0, WH - 1.7, RZ + 0.62] });

    const bays = [
      { x: 0, w: 4.2, top: WH - 1.5, c: true },
      { x: -RW / 2 + 2.5, w: 2.9, top: WH - 3.4, c: false },
      { x: RW / 2 - 2.5, w: 2.9, top: WH - 3.4, c: false },
    ];

    for (const bay of bays) {
      b.add(box(bay.w, bay.top - 3.4, 0.16, 2), 'altarNiche',
        { pos: [bay.x, (bay.top + 3.4) / 2, RZ + 0.30] });
      const arch = new THREE.TorusGeometry(bay.w / 2, 0.11, 6, 14, Math.PI);
      arch.translate(bay.x, bay.top, RZ + 0.34);
      b.addGeo(arch, gold);
      for (const q of [-1, 1]) {
        b.add(box(0.16, bay.top - 3.3, 0.24, 1), gold,
          { pos: [bay.x + q * (bay.w / 2 + 0.08), (bay.top + 3.3) / 2, RZ + 0.32] });
      }
      b.add(box(bay.w + 0.5, 0.18, 0.28, 1), gold, { pos: [bay.x, 3.3, RZ + 0.33] });

      if (bay.c) {
        const cz = RZ + 0.55;
        b.add(box(0.22, 2.5, 0.16, 1), 'goldCross', { pos: [0, 6.35, cz] });
        b.add(box(1.25, 0.2, 0.16, 1), 'goldCross', { pos: [0, 7.05, cz] });
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          const rr = new THREE.BoxGeometry(0.09, 0.62, 0.07);
          rr.rotateZ(a);
          rr.translate(Math.sin(a) * 0.92, 6.5 + Math.cos(a) * 0.92, cz - 0.09);
          b.addGeo(rr, 'goldRay');
        }
        /**
         * San Nicolas de Tolentino in the central niche.
         *
         * The reference photographs show him black-robed with a gilt sunburst
         * halo, a book held across the chest and a staff. The old stand-in was a
         * cylinder with a sphere on top, which reads as "something is in this
         * niche" from the door and as nothing from the rail.
         */
        placeFigure(b, robedFigure({
          robe: 'statueRobed', dark: 'statueRobed', skin: 'statue',
          halo: true, staff: true, book: true, scale: 1.55,
        }), 0, 3.36, cz + 0.1);
      } else {
        /**
         * Two tiers of flanking saints.
         *
         * Each tier gets a different combination of halo / book / staff so the
         * six figures do not read as six copies of one object. Scale is smaller
         * than the central figure, as the niches are shallower.
         */
        const tiers = [
          { y: 3.62, halo: true, book: true, staff: false },
          { y: 5.72, halo: false, book: false, staff: true },
        ];
        const variant = bay.x < 0 ? 0 : 1;
        for (const t of tiers) {
          placeFigure(b, robedFigure({
            robe: 'statueRobed', dark: 'statueRobed', skin: 'statue',
            halo: t.halo, staff: t.staff, book: t.book,
            scale: 0.95 + variant * 0.05,
          }), bay.x, t.y, RZ + 0.44, variant ? -0.28 : 0.28);
        }
      }
    }

    // Twisted columns, built as offset drums to suggest the twist.
    for (const cx of [-RW / 2 + 0.9, -RW / 2 + 4.2, RW / 2 - 4.2, RW / 2 - 0.9]) {
      for (let i = 0; i < 20; i++) {
        const a = i * 0.62;
        b.add(cylinder(0.27, 0.27, 0.34, 8), dark,
          { pos: [cx + Math.sin(a) * 0.055, 2.2 + i * 0.35, RZ + 0.72 + Math.cos(a) * 0.055] });
      }
      b.add(cylinder(0.34, 0.26, 0.34, 8), gold, { pos: [cx, 9.15, RZ + 0.72] });
      b.add(box(0.7, 0.18, 0.7, 1), gold, { pos: [cx, 9.38, RZ + 0.72] });
      b.add(cylinder(0.34, 0.4, 0.3, 8), gold, { pos: [cx, 2.12, RZ + 0.72] });
    }

    // Arched pediment with cartouche and finials.
    const ped = new THREE.CylinderGeometry(3.0, 3.0, 0.34, 16, 1, false, 0, Math.PI);
    ped.rotateZ(Math.PI / 2);
    ped.rotateX(Math.PI / 2);
    ped.translate(0, WH - 2.5, RZ + 0.28);
    b.addGeo(ped, gold);
    b.add(box(1.7, 0.9, 0.22, 2), 'altarNiche', { pos: [0, WH - 1.55, RZ + 0.42] });
    for (const q of [-1, 1]) {
      b.add(sphere(0.2, 8, 6), gold, { pos: [q * 3.15, WH - 1.6, RZ + 0.35] });
    }
    b.add(sphere(0.26, 8, 6), gold, { pos: [0, WH - 0.55, RZ + 0.36] });
  }

  /* -------------------------------------------------------------- ALTAR */
  {
    const AZ = apseZ + 3.2;
    b.add(box(3.5, 0.18, 1.5, 2), 'altarMarble', { pos: [0, 1.02, AZ] });
    b.add(box(3.2, 0.16, 1.25, 2), 'altarMarble', { pos: [0, 1.17, AZ] });
    // Antependium — dim gold frontal, not the hot M.gold used for gilding.
    b.add(box(3.3, 0.95, 0.12, 1), 'altarFrontal', { pos: [0, 0.55, AZ + 0.68] });
    // Embroidered orphrey band across the frontal, and a stepped stone edge
    // along the mensa so the top slab reads as stone rather than a light panel.
    b.add(box(3.34, 0.20, 0.14, 1), 'goldCross', { pos: [0, 0.86, AZ + 0.68] });
    b.add(box(3.52, 0.06, 1.52, 1), 'altarMarble', { pos: [0, 1.09, AZ] });
    b.add(box(3.45, 0.05, 1.42, 2), 'altarCloth', { pos: [0, 1.27, AZ - 0.02] });
    for (const q of [-1, 1]) {
      for (const t of [0, 1]) {
        b.add(cylinder(0.055, 0.055, 0.62, 8), 'candleWax',
          { pos: [q * (1.15 + t * 0.32), 1.61, AZ - 0.4] });
      }
    }
    b.add(box(0.9, 0.95, 0.75, 2), 'altarMarble', { pos: [-2.9, 0.5, AZ + 1.6] });
    b.add(box(0.62, 0.5, 0.58, 2), 'woodDark', { pos: [2.7, 0.75, AZ + 1.4] });
    b.add(box(0.62, 0.62, 0.1, 2), 'woodDark', { pos: [2.7, 1.28, AZ + 1.66] });

    /**
     * ALTAR CRUCIFIX.
     *
     * Every Catholic altar has one standing on it, and its absence is one of the
     * things that makes a modelled sanctuary read as furniture rather than a
     * place of worship. Gilt cross on a stepped marble foot, with a corpus.
     */
    {
      const cz2 = AZ + 0.18;
      b.add(box(0.30, 0.10, 0.24, 1), 'altarMarble', { pos: [0, 1.30, cz2] });
      b.add(box(0.22, 0.07, 0.18, 1), 'altarMarble', { pos: [0, 1.38, cz2] });
      // upright and crossbar, gilt
      b.add(box(0.075, 1.15, 0.055, 1), 'goldCross', { pos: [0, 1.99, cz2] });
      b.add(box(0.52, 0.075, 0.055, 1), 'goldCross', { pos: [0, 2.30, cz2] });
      // corpus: a pale figure on the cross
      b.add(box(0.10, 0.46, 0.045, 1), 'statue', { pos: [0, 2.10, cz2 + 0.04] });
      b.add(sphere(0.052, 8, 6), 'statue', { pos: [0, 2.42, cz2 + 0.04] });
      for (const q of [-1, 1]) {
        b.add(box(0.24, 0.045, 0.04, 1), 'statue',
          { pos: [q * 0.12, 2.24, cz2 + 0.04], rot: [0, 0, q * 0.22] });
      }
      // foot of the cross
      b.add(box(0.16, 0.10, 0.10, 1), 'gold', { pos: [0, 1.44, cz2] });
    }

    /**
     * SANCTUARY LAMP.
     *
     * Hangs on the gospel side of the sanctuary and is never extinguished — the
     * one warm light in an otherwise dim apse. Modelled as a suspended gilt cup
     * on three chains with a red glass, because the red bead of light is what
     * draws the eye down the nave.
     */
    {
      const LX = -2.6, LZ = AZ + 2.6, LY = 4.6;
      // three chains up to a ceiling boss
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const top = [LX + Math.cos(a) * 0.30, LY + 0.78, LZ + Math.sin(a) * 0.30];
        const bot = [LX + Math.cos(a) * 0.07, LY + 0.06, LZ + Math.sin(a) * 0.07];
        const len = Math.hypot(top[1] - bot[1], 0.23) + 0.02;
        const g = box(0.018, len, 0.018, 1);
        const dx = top[0] - bot[0], dz = top[2] - bot[2];
        g.rotateX(Math.atan2(dz, top[1] - bot[1]));
        g.rotateZ(-Math.atan2(dx, top[1] - bot[1]));
        g.translate((top[0] + bot[0]) / 2, (top[1] + bot[1]) / 2, (top[2] + bot[2]) / 2);
        b.addGeo(g, 'gold');
      }
      // boss and canopy
      b.add(cylinder(0.10, 0.13, 0.06, 10), 'gold', { pos: [LX, LY + 0.82, LZ] });
      b.add(cylinder(0.30, 0.30, 0.05, 12), 'gold', { pos: [LX, LY + 0.10, LZ] });
      // lamp cup, then the red glass, which is the actual light source visually
      b.add(cylinder(0.16, 0.10, 0.20, 10), 'gold', { pos: [LX, LY - 0.02, LZ] });
      b.add(cylinder(0.085, 0.085, 0.22, 10), 'lampRed',
        { pos: [LX, LY - 0.20, LZ] });
      // a small strong glow so it reads from the door
      b.add(cylinder(0.055, 0.055, 0.26, 10), 'lampRedGlow',
        { pos: [LX, LY - 0.20, LZ] });
    }
  }

  /* --------------------------------------------------------------- PEWS */
  // Two blocks with a clear centre aisle. Five boxes per pew, one mesh per
  // material, so the whole seating costs almost nothing.
  {
    const pewZ0 = apseZ + 9.5;
    const pewZ1 = facadeZ - 4.5;
    const gap = 1.9;
    for (const s of [-1, 1]) {
      const x0 = s * (gap / 2);
      const x1 = s * (NW / 2 - 1.9);
      const w = Math.abs(x1 - x0);
      const cx = (x0 + x1) / 2;
      for (let z = pewZ0; z < pewZ1; z += 0.92) {
        b.add(box(w, 0.09, 0.42, 2), 'pewWood', { pos: [cx, 0.47, z] });
        b.add(box(w, 0.52, 0.07, 2), 'pewWood', { pos: [cx, 0.76, z + 0.30] });
        b.add(box(w, 0.08, 0.3, 2), 'pewWood', { pos: [cx, 0.16, z - 0.2] });
        for (const q of [-1, 1]) {
          b.add(box(0.07, 0.92, 0.62, 1), 'pewWood',
            { pos: [cx + q * (w / 2 - 0.04), 0.46, z + 0.03] });
        }
      }
    }
  }

  /* ------------------------------------------------ CEILING & TRUSSES */
  {
    /**
     * Pitched boarding BELOW the roof plane, trusses hanging below the boarding.
     *
     * ridgeY is deliberately kept under the shell's roof apex (wallH 11.8 plus
     * the gable rise) so the boarding can never poke through the roof sheet.
     */
    const ridgeY = WH + 3.15;
    const halfW = NW / 2 + 0.30;
    const slope = Math.hypot(halfW, ridgeY - WH);
    const ang = Math.atan2(ridgeY - WH, halfW);
    const CEIL_OFF = 0.10;

    // For the +X half the ridge is at x=0 and the eave at +halfW, so Y falls as
    // X rises: rotateZ(-ang). The opposite sign makes a valley meeting mid-nave,
    // which is invisible until you look up.
    for (const s of [-1, 1]) {
      const geo = new THREE.BoxGeometry(slope, 0.06, NL - 0.7);
      geo.rotateZ(-s * ang);
      geo.translate(s * halfW / 2, (WH + ridgeY) / 2 + CEIL_OFF, 0);
      b.addGeo(geo, 'ceilingBoard');
    }
    // Ridge closure: two finite-thickness slabs meeting at an angle leave a thin
    // open slot along the ridge. Without this board you see the dark underside
    // of the roof through it.
    b.add(box(0.85, 0.2, NL - 0.6, 2), 'ceilingBoard',
      { pos: [0, ridgeY + CEIL_OFF + 0.04, 0] });

    // Gable infill at both ends so the roof void is closed.
    for (const zz of [facadeZ - 0.5, apseZ + 0.5]) {
      for (const s of [-1, 1]) {
        const gg = new THREE.BoxGeometry(halfW, 0.1, 0.3);
        gg.rotateZ(-s * ang);
        gg.translate(s * halfW / 2, (WH + ridgeY) / 2 + 0.3, zz);
        b.addGeo(gg, 'interiorPlaster');
      }
    }

    // Scissor trusses. Members sized to read from the floor 11 m below.
    for (let z = apseZ + 3.2; z < facadeZ - 1.8; z += 4.2) {
      for (const s of [-1, 1]) {
        const raf = new THREE.BoxGeometry(slope, 0.30, 0.26);
        raf.rotateZ(-s * ang);
        raf.translate(s * halfW / 2, (WH + ridgeY) / 2 - 0.18, z);
        b.addGeo(raf, 'trussWood');

        const legLen = Math.hypot(halfW * 0.62, ridgeY - WH - 0.4);
        const legAng = Math.atan2(ridgeY - WH - 0.4, halfW * 0.62);
        const leg = new THREE.BoxGeometry(legLen, 0.24, 0.22);
        leg.rotateZ(s * legAng);
        leg.translate(s * halfW * 0.31, WH + 1.55, z);
        b.addGeo(leg, 'trussWood');
      }
      b.add(box(0.22, 1.5, 0.22, 1), 'trussWood', { pos: [0, ridgeY - 0.95, z] });
      for (const s of [-1, 1]) {
        b.add(box(0.42, 0.26, 0.5, 1), 'trussWood',
          { pos: [s * (NW / 2 - 0.15), WH - 0.1, z] });
      }
      for (const s of [-1, 1]) {
        b.add(cylinder(0.07, 0.085, WH - 0.4, 8), 'steel',
          { pos: [s * (NW / 2 - 1.35), (WH - 0.4) / 2 + 0.4, z] });
      }
    }

    // Ridge beam plus two purlins per slope. Without purlins only the ridge
    // spans the void and the roof reads as a plain tent.
    b.add(box(0.26, 0.3, NL - 1.4, 1), 'trussWood', { pos: [0, ridgeY - 0.12, 0] });
    for (const s of [-1, 1]) {
      for (const t of [0.36, 0.70]) {
        const py = WH + (ridgeY - WH) * t;
        b.add(box(0.16, 0.2, NL - 1.6, 1), 'trussWood',
          { pos: [s * halfW * (1 - t), py - 0.16, 0] });
      }
    }
  }

  /* ------------------------------------------------------ LIGHT FITTINGS */
  // Emissive material only. Every extra point light multiplies shader
  // permutations for every material in the scene, so the interior gets two.
  for (let z = apseZ + 6; z < facadeZ - 3; z += 4.2) {
    b.add(cylinder(0.02, 0.02, 1.5, 5), 'ironDark', { pos: [0, WH - 2.4, z] });
    b.add(sphere(0.17, 8, 6), 'lampGlow', { pos: [0, WH - 3.15, z] });
  }
  for (let z = apseZ + 5.0; z < facadeZ - 2.5; z += 8.8) {
    for (const s of [-1, 1]) {
      b.add(box(0.16, 0.34, 0.16, 1), 'lampGlow',
        { pos: [s * (NW / 2 - 0.55), 4.4, z] });
    }
  }

  /* --------------------------------------------------------- STATIONS */
  {
    let n = 0;
    for (let z = apseZ + 6.0; z < facadeZ - 4.0 && n < 14; z += 8.8) {
      for (const s of [-1, 1]) {
        if (n >= 14) break;
        b.add(box(0.06, 0.86, 0.64, 1), 'gold',
          { pos: [s * (NW / 2 - inset - 0.02), 4.5, z] });
        b.add(box(0.04, 0.7, 0.5, 1), 'altarNiche',
          { pos: [s * (NW / 2 - inset - 0.05), 4.5, z] });
        n++;
      }
    }
  }

  const signs = b.signs || [];
  b.signs = undefined;
  b.buildInto(g, M);
  for (const s of signs) g.add(s);
  parent.add(g);
  return g;
}
