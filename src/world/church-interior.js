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
        b.add(cylinder(0.34, 0.52, 2.0, 10), 'statueRobed', { pos: [0, 4.05, cz + 0.1] });
        b.add(sphere(0.3, 10, 8), 'statue', { pos: [0, 5.15, cz + 0.1] });
        const halo = new THREE.TorusGeometry(0.42, 0.05, 6, 16);
        halo.translate(0, 5.55, cz + 0.02);
        b.addGeo(halo, gold);
      } else {
        for (const ty of [4.5, 6.6]) {
          b.add(cylinder(0.24, 0.34, 1.15, 8), 'statueRobed', { pos: [bay.x, ty, RZ + 0.44] });
          b.add(sphere(0.19, 8, 6), 'statue', { pos: [bay.x, ty + 0.7, RZ + 0.44] });
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
    b.add(box(3.3, 0.95, 0.12, 1), 'gold', { pos: [0, 0.55, AZ + 0.68] });
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
