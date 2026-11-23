/**
 * DCT classroom blocks.
 *
 * The campus photographs show what the frontage actually looks like from the
 * road: blocks painted a cool blue-white with a deep blue band, and — the
 * defining feature — OPEN CORRIDORS. Each floor has a covered walkway on the
 * road side with a blue parapet instead of a wall, so you see the depth of the
 * building through it and the classrooms sit behind.
 *
 * That open-corridor arrangement is what makes these read as Philippine school
 * buildings rather than generic office blocks, so it is worth the geometry.
 *
 * THREE BUGS ARE BAKED INTO THE STRUCTURE HERE, each of which earlier produced
 * geometry that looked plausible in a screenshot but was wrong:
 *
 *   1. Builder.add() BAKES geometry into world space. Authoring in a local frame
 *      and relying on a parent group's yaw silently discards the rotation — a
 *      36 m block then measures 36 m ACROSS X instead of along Z. Every position
 *      goes through L() and every geometry through A.add(), which applies the
 *      block's yaw about the geometry's own origin.
 *
 *   2. The corridor must start where the classroom body ENDS. Placing it at
 *      bodyD/2 while the body ran to -D/2 left a 1.3 m air gap between the
 *      walkway and the rooms it served.
 *
 *   3. The roof must be ONE sheet over the full depth including the corridor.
 *      Roofing only the enclosed body leaves the walkway's white top slab
 *      exposed and the block reads as a stack of white decks.
 */
import * as THREE from 'three';
import { box, cylinder } from './kit.js';

export function classroomBlock(b, M, o) {
  const {
    x, z, rotY = 0, len = 40, depth = 12, floors = 3, floorH = 3.6,
    corridor = 1,
  } = o;

  const CORR_W = 2.6;
  const H = floors * floorH;

  // World transform for a point in the block's local frame.
  const cy = Math.cos(rotY), sy = Math.sin(rotY);
  const W = (lx, ly, lz) => [x + lx * cy + lz * sy, ly, z - lx * sy + lz * cy];

  /**
   * add() wrapper: positions are authored in the local frame and converted by
   * L(), so the geometry must carry the block's yaw too. Builder.add() rotates
   * about the geometry's own origin before translating, which composes exactly
   * right with an already-world-space position.
   */
  const A = {
    add: (geo, key, opts = {}) => b.add(geo, key, { ...opts, rot: [0, rotY, 0] }),
    addGeo: (geo, key, c) => b.addGeo(geo, key, c),
  };
  const L = (lx, ly, lz) => W(lx, ly, lz);

  // Corridor occupies the front CORR_W metres; enclosed rooms behind it. Local
  // +Z is the corridor (public) side.
  const corrZ0 = (depth / 2) - CORR_W;
  const corrZ1 = (depth / 2);
  const frontZ = corrZ1;
  const roomZ0 = -depth / 2;
  const roomZ1 = corrZ0;
  const roomC = (roomZ0 + roomZ1) / 2;
  const roomD = roomZ1 - roomZ0;
  const bays = Math.max(2, Math.round(len / 4.0));
  const bayW = len / bays;

  /* --------------------------------------------------------- corridor slabs */
  for (let f = 0; f < floors; f++) {
    const y = f * floorH;
    // full-depth slab, one per storey
    A.add(box(len + 0.5, 0.28, depth + 0.3, 2), 'dctBlueTrim',
      { pos: L(0, y + floorH - 0.14, 0) });
    // walkway floor, terrazzo, on the corridor side only
    A.add(box(len + 0.2, 0.05, CORR_W, 2.4), 'dctTerrazzo',
      { pos: L(0, y + 0.03, corrZ0 + CORR_W / 2) });
    // lit ceiling under the slab (the roof underside above is unlit masonry)
    A.add(box(len + 0.2, 0.05, CORR_W + 0.1, 2.2), 'dctSoffit',
      { pos: L(0, y + floorH - 0.30, corrZ0 + CORR_W / 2) });

    // parapet: blue band + white capping, the signature of these buildings
    A.add(box(len + 0.5, 0.95, 0.18, 2), 'dctBlueBand',
      { pos: L(0, y + 0.48, frontZ) });
    A.add(box(len + 0.7, 0.10, 0.28, 2), 'dctBlueTrim',
      { pos: L(0, y + 1.00, frontZ) });
    A.add(box(len + 0.5, 0.16, 0.14, 1), 'dctBlueTrim',
      { pos: L(0, y + 0.06, frontZ) });
  }
  // ground plinth
  A.add(box(len + 0.7, 0.35, depth + 0.5, 2), 'concreteTrim', { pos: L(0, 0.17, 0) });

  /* ------------------------------------------------------------- columns */
  for (let i = 0; i <= bays; i++) {
    const px = -len / 2 + (i * len) / bays;
    for (let f = 0; f < floors; f++) {
      A.add(box(0.34, floorH - 0.28, 0.34, 1.6), 'dctBlueBand',
        { pos: L(px, f * floorH + (floorH - 0.28) / 2 + 0.14, frontZ - 0.02) });
    }
    // world-space AABB collider: half-extents rotate with the yaw
    const c = L(px, 0, frontZ);
    const hx = Math.abs(cy) * 0.2 + Math.abs(sy) * 0.2;
    const hz = Math.abs(sy) * 0.2 + Math.abs(cy) * 0.2;
    b.addCollider([c[0] - hx, 0, c[2] - hz], [c[0] + hx, H, c[2] + hz]);
  }

  /* ------------------------------------------------------- classroom shell */
  // A SHELL, not one solid box: the rooms have to be real volumes you can see
  // into from the corridor.
  const rearZ = roomZ0;
  A.add(box(len, H, 0.24, 2), 'dctBlueWall', { pos: L(0, H / 2, rearZ), collide: true });
  for (const sgn of [-1, 1]) {
    A.add(box(0.24, H, depth, 2), 'dctBlueWall',
      { pos: L(sgn * (len / 2 - 0.12), H / 2, 0), collide: true });
  }
  // corridor-side face: piers between rooms, spandrel above each doorway
  for (let i = 0; i <= bays; i++) {
    A.add(box(0.34, H, 0.2, 1.6), 'dctBlueWall',
      { pos: L(-len / 2 + i * bayW, H / 2, roomZ1) });
  }
  for (let f = 0; f < floors; f++) {
    const lh = floorH - 2.7;
    if (lh > 0.05) {
      A.add(box(len, lh, 0.2, 1.6), 'dctBlueWall',
        { pos: L(0, f * floorH + 2.7 + lh / 2, roomZ1) });
    }
  }

  /* ------------------------------------------------------ floor line bands */
  for (let f = 1; f <= floors; f++) {
    A.add(box(len + 0.16, 0.42, 0.2, 2), 'dctBlueBand',
      { pos: L(0, f * floorH - 0.5, rearZ - 0.08) });
  }
  // top parapet
  A.add(box(len + 0.4, 0.7, 0.24, 2), 'dctBlueBand', { pos: L(0, H + 0.35, rearZ) });
  A.add(box(len + 0.6, 0.12, 0.34, 2), 'dctBlueTrim', { pos: L(0, H + 0.76, rearZ) });

  /* ---------------------------------------------------------- classroom doors */
  // Leaves stand OPEN against the corridor wall: a shut leaf hides the furnished
  // room, and the photographs show a corridor lined with open doorways.
  for (let i = 0; i < bays; i++) {
    const px = -len / 2 + (i + 0.5) * bayW;
    for (let f = 0; f < floors; f++) {
      const y = f * floorH;
      for (const q of [-1, 1]) {
        A.add(box(0.10, 2.6, 0.14, 1), 'dctBlueTrim', { pos: L(px + q * 0.56, y + 1.3, roomZ1) });
      }
      A.add(box(1.26, 0.10, 0.14, 1), 'dctBlueTrim', { pos: L(px, y + 2.63, roomZ1) });
      A.add(box(1.02, 0.42, 0.06, 1), 'glassDark', { pos: L(px, y + 2.40, roomZ1) });
      // leaf swung ~100 deg into the room, hinged at the left jamb
      b.add(box(0.95, 2.04, 0.06, 1), 'wood', {
        pos: L(px - 0.42, y + 1.02, roomZ1 - 0.42),
        rot: [0, rotY + Math.PI * 0.56, 0],
      });
      A.add(cylinder(0.022, 0.022, 0.12, 6), 'brass',
        { pos: L(px + 0.44, y + 1.00, roomZ1 - 0.06), rot: [Math.PI / 2, 0, 0] });
    }
  }

  /* -------------------------------------------------------- classroom interiors */
  // Furnished, because the corridors are open and you see straight in.
  for (let i = 0; i < bays; i++) {
    const bx = -len / 2 + (i + 0.5) * bayW;
    const bw = bayW;
    for (let f = 0; f < floors; f++) {
      const y0 = f * floorH;
      A.add(box(bw - 0.2, 0.05, roomD - 0.2, 2.4), 'classroomFloor',
        { pos: L(bx, y0 + 0.03, roomC) });
      A.add(box(bw - 0.2, 0.05, roomD - 0.2, 2.4), 'classroomCeil',
        { pos: L(bx, y0 + floorH - 0.35, roomC) });
      // rear wall and side partitions
      A.add(box(bw - 0.2, floorH - 0.4, 0.08, 2), 'classroomWall',
        { pos: L(bx, y0 + floorH / 2 - 0.2, roomZ0 + 0.06) });
      for (const sgn of [-1, 1]) {
        A.add(box(0.08, floorH - 0.4, roomD - 0.2, 2), 'classroomWall',
          { pos: L(bx + sgn * (bw / 2 - 0.1), y0 + floorH / 2 - 0.2, roomC) });
      }
      // chalkboard with timber rails
      A.add(box(bw * 0.62, 1.15, 0.06, 1), 'chalkboard',
        { pos: L(bx, y0 + 1.72, roomZ0 + 0.14) });
      A.add(box(bw * 0.66, 0.07, 0.10, 1), 'wood', { pos: L(bx, y0 + 0.34, roomZ0 + 0.16) });
      A.add(box(bw * 0.66, 0.06, 0.10, 1), 'wood', { pos: L(bx, y0 + 2.33, roomZ0 + 0.16) });

      // desks: 3 columns x 3 rows, each a top plus four legs, plus a chair
      const cols = 3, rows = 3;
      for (let c = 0; c < cols; c++) {
        for (let r2 = 0; r2 < rows; r2++) {
          const dx = bx + (c - (cols - 1) / 2) * (bw / (cols + 0.6));
          const dz = roomZ0 + 1.15 + r2 * ((roomD - 1.6) / rows);
          const dy = y0 + 0.04;
          A.add(box(0.62, 0.05, 0.44, 2), 'deskTop', { pos: L(dx, dy + 0.72, dz) });
          for (const qx of [-1, 1]) for (const qz of [-1, 1]) {
            A.add(box(0.045, 0.70, 0.045, 1), 'deskFrame',
              { pos: L(dx + qx * 0.26, dy + 0.35, dz + qz * 0.17) });
          }
          A.add(box(0.40, 0.045, 0.38, 1.6), 'deskTop', { pos: L(dx, dy + 0.44, dz + 0.52) });
          A.add(box(0.40, 0.34, 0.04, 1.6), 'deskTop', { pos: L(dx, dy + 0.64, dz + 0.70) });
          for (const qx of [-1, 1]) for (const qz of [-1, 1]) {
            A.add(box(0.035, 0.44, 0.035, 1), 'deskFrame',
              { pos: L(dx + qx * 0.16, dy + 0.22, dz + 0.52 + qz * 0.15) });
          }
        }
      }
      // teacher's desk, fluorescent fitting, wall clock
      A.add(box(1.35, 0.06, 0.62, 2), 'deskTop', { pos: L(bx, y0 + 0.78, roomZ1 - 0.85) });
      for (const qx of [-1, 1]) {
        A.add(box(0.06, 0.75, 0.56, 1), 'deskFrame',
          { pos: L(bx + qx * 0.6, y0 + 0.39, roomZ1 - 0.85) });
      }
      A.add(box(1.1, 0.06, 0.22, 1), 'fluorescent', { pos: L(bx, y0 + floorH - 0.40, roomC) });
      b.add(cylinder(0.19, 0.19, 0.04, 16), 'clockFace', {
        pos: L(bx + bw * 0.30, y0 + 2.72, roomZ0 + 0.14), rot: [Math.PI / 2, rotY, 0],
      });
    }
  }
  if (typeof window !== 'undefined') {
    window.__classrooms = (window.__classrooms || 0) + bays * floors;
  }

  /* ------------------------------------------------------- rear-wall windows */
  // Cross-ventilation through the rear wall; that window grid is the strongest
  // rhythm on the outside of these blocks. Glazing must sit on the OUTER face of
  // the 0.24 m wall or it is buried in masonry and renders as a blank wall.
  const winZ = rearZ - 0.13;
  for (let i = 0; i < bays; i++) {
    const px = -len / 2 + (i + 0.5) * bayW;
    for (let f = 0; f < floors; f++) {
      const y = f * floorH;
      A.add(box(1.9, 1.5, 0.08, 1), 'windowGlassN', { pos: L(px, y + 1.85, winZ) });
      for (const q of [-1, 1]) {
        A.add(box(0.10, 1.72, 0.16, 1), 'dctBlueTrim',
          { pos: L(px + q * 1.0, y + 1.85, winZ - 0.05) });
      }
      A.add(box(2.12, 0.11, 0.16, 1), 'dctBlueTrim', { pos: L(px, y + 2.76, winZ - 0.05) });
      A.add(box(2.12, 0.14, 0.26, 1), 'dctBlueTrim', { pos: L(px, y + 0.98, winZ - 0.05) });
      A.add(box(0.07, 1.5, 0.10, 1), 'dctBlueTrim', { pos: L(px, y + 1.85, winZ - 0.04) });
      A.add(box(1.9, 0.07, 0.10, 1), 'dctBlueTrim', { pos: L(px, y + 2.28, winZ - 0.04) });
      // louvre blades, the standard detail on these buildings
      for (let l = 0; l < 5; l++) {
        A.add(box(1.82, 0.03, 0.06, 1), 'windowGlassN',
          { pos: L(px, y + 1.22 + l * 0.20, winZ + 0.03), rot: [-0.5, 0, 0] });
      }
    }
  }
  // end-wall windows
  for (const sgn of [-1, 1]) {
    for (let f = 0; f < floors; f++) {
      for (const t of [-0.22, 0.22]) {
        A.add(box(0.08, 1.4, 1.5, 1), 'windowGlassN',
          { pos: L(sgn * (len / 2 + 0.01), f * floorH + 1.8, t * depth) });
      }
    }
  }

  /* ------------------------------------------------------------------- roof */
  {
    // ONE sheet over the FULL depth including the corridor.
    //
    // Pitch sign, which is the same trap as the shrine ceiling mirrored onto X:
    // for the +Z panel the eave is at +halfD and the ridge at 0, so Y must FALL
    // as Z rises => rotateX(+ang). rotateX(-ang) tilts both panels upward into a
    // shallow V-valley, which looks like a hip roof from a distance and is wrong.
    const rise = 1.55;
    const halfD = (depth + 1.1) / 2;
    const slope = Math.hypot(halfD, rise);
    const ang = Math.atan2(rise, halfD);
    const eaveY = H + 0.82;

    for (const s2 of [-1, 1]) {
      const geo = new THREE.BoxGeometry(len + 2.2, 0.13, slope);
      geo.rotateX(s2 * ang);
      geo.translate(0, eaveY + rise / 2, s2 * (halfD / 2));
      geo.rotateY(rotY);
      geo.translate(x, 0, z);
      b.addGeo(geo, 'dctRoofBlue');
    }
    A.add(box(len + 2.3, 0.16, 0.26, 2), 'dctRoofBlue', { pos: L(0, eaveY + rise, 0) });
    // fascia hides the panel edges along both eaves
    for (const s2 of [-1, 1]) {
      A.add(box(len + 2.3, 0.34, 0.14, 2), 'dctBlueBand',
        { pos: L(0, eaveY + 0.02, s2 * halfD) });
    }
    // vent stacks / water tanks
    for (let i = 0; i < 3; i++) {
      const px = -len / 3 + i * (len / 3);
      A.add(box(0.85, 0.50, 0.85, 1.6), 'galv', { pos: L(px, eaveY + 1.0, -depth * 0.18) });
    }
  }

  return { colliders: b.colliders };
}
