/**
 * The DCT frontage on MacArthur Highway.
 *
 * This is the most recognisable view of the school, so it gets the most care:
 * the rock-faced grotto wall, the round steel crest, the giant pink "DCT"
 * letters planted on an island, the guard house, and the drive entrance with
 * its sliding gate. Behind it, the covered parking bays.
 *
 * Authored in a local frame whose +X runs INTO the campus (west) and whose
 * origin is the centre of the drive opening, then rotated into place.
 */
import * as THREE from 'three';
import { Builder, box, cylinder, sphere, TEXSCALE } from './kit.js';
import { L } from './layout.js';

export const GATE = {
  x: L.gate.x,
  z: L.gate.z,
  // The frontage runs N–S along the highway, so the wall's local X must map to
  // world Z. The drive opens east (toward the campus).
  rotY: -Math.PI / 2,
  opening: 11.0,
  wallH: 2.35,
};

export function buildGate(parent, M, opts = {}) {
  const { nightMode = false } = opts;
  const b = new Builder('gate');
  const g = new THREE.Group();
  g.position.set(GATE.x, 0, GATE.z);
  g.rotation.y = GATE.rotY;
  parent.add(g);

  const WZ = 0;   // local Z of the frontage line (local +Z = south)
  const OPEN = GATE.opening / 2;

  /* ------------------------------------------------------- rock-faced wall */
  const rockSeg = (x0, x1, h, z) => {
    const w = x1 - x0;
    b.add(box(w, h, 0.6, 1.6), 'rockFace', { pos: [(x0 + x1) / 2, h / 2, z], collide: true });
    // irregular capping stones
    let x = x0, s = 0;
    while (x < x1 - 0.3) {
      const sw = 0.45 + Math.abs(Math.sin(s * 2.7)) * 0.85;
      b.add(box(Math.min(sw, x1 - x), 0.24, 0.82, 1.2), 'rockCap', {
        pos: [x + Math.min(sw, x1 - x) / 2, h + 0.06, z + 0.02],
        rot: [0, Math.sin(s * 1.9) * 0.06, 0],
      });
      x += sw; s++;
    }
    // protruding boulders for silhouette (fewer, cheaper)
    const nB = Math.floor(w * 1.6);
    for (let i = 0; i < nB; i++) {
      const px = x0 + ((i * 7919) % 1000) / 1000 * w;
      const py = 0.25 + ((i * 104729) % 1000) / 1000 * (h - 0.5);
      const r = 0.13 + ((i * 37) % 100) / 100 * 0.2;
      b.add(sphere(r, 6), 'rockFace', { pos: [px, py, z - 0.3] });
    }
  };

  // West of the drive: the long grotto wall (this is the wall in the photos).
  rockSeg(OPEN + 0.9, OPEN + 20.0, GATE.wallH, WZ);
  // East of the drive
  rockSeg(-OPEN - 12.0, -OPEN - 0.9, GATE.wallH - 0.15, WZ);

  /* ------------------------------------------------------------ THE GROTTO */
  // A tall arched stone feature with a water basin and a statue — the focal
  // point the school built beside its gate.
  {
    const gx = OPEN + 11.5, gz = WZ - 0.5;
    b.add(box(9.5, 4.6, 0.8, 1.6), 'rockFace', { pos: [gx, 2.3, gz], collide: true });
    // arch recess
    b.add(box(4.8, 3.1, 0.55, 1.4), 'interior', { pos: [gx, 1.95, gz + 0.3] });
    const arc = cylinder(2.4, 2.4, 0.55, 18, 1);
    arc.rotateX(Math.PI / 2);
    arc.translate(gx, 3.5, gz + 0.3);
    b.addGeo(arc, 'interior');
    // basin + water
    b.add(box(5.0, 0.45, 1.6, 1.4), 'rockCap', { pos: [gx, 0.32, gz + 0.55], collide: true });
    b.add(box(4.6, 0.14, 1.25, 1.4), 'water', { pos: [gx, 0.52, gz + 0.55] });
    b.add(box(9.9, 0.28, 1.0, 1.2), 'rockCap', { pos: [gx, 4.72, gz + 0.02] });
    // statue (Our Lady, all white)
    b.add(cylinder(0.22, 0.38, 1.15, 10), 'statue', { pos: [gx - 0.5, 1.12, gz - 0.02] });
    b.add(sphere(0.15, 8), 'statue', { pos: [gx - 0.5, 1.78, gz - 0.02] });
  }

  /* ------------------------------------------------------------- THE CREST */
  {
    /**
     * The gate crest.
     *
     * The shield artwork was mounted on a thin torus with nothing behind it, so
     * from the road it read as a white blob floating in the air over the
     * railings. A real gate crest is a painted plate bolted to the bars: it needs
     * a solid dark backing so the pale shield has something to sit on, and the
     * mounting hardware needs to be visible or it looks pasted on.
     *
     * The plate must stay THIN and sit BEHIND the ring. At 0.08 thick and centred
     * on the torus its dark cap swallowed the shield entirely.
     */
    const cx = OPEN + 4.6, cy = 3.15, cz = WZ - 0.32;
    // addGeo(g, matKey, collide) takes geometry ALREADY in world space and no
    // options object, so the transform has to be baked in before the call.
    // b.add() also returns nothing, so it can never be chained.
    b.addGeo(
      cylinder(1.15, 1.15, 0.05, 40).rotateX(Math.PI / 2).translate(cx, cy, cz - 0.06),
      'ironDark');
    b.addGeo(new THREE.TorusGeometry(1.20, 0.09, 8, 36).translate(cx, cy, cz + 0.02), 'brass');
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.12, 40), M.crest);
    disc.position.set(cx, cy, cz + 0.07);
    b.addSign(disc);
    // two stays down to the railing, so it hangs rather than floats
    for (const sgn of [-1, 1]) {
      b.add(box(0.10, 1.30, 0.10, 1), 'ironDark',
        { pos: [cx + sgn * 0.85, cy - 1.32, cz + 0.06] });
    }
    b.add(box(2.0, 0.12, 0.12, 1), 'ironDark', { pos: [cx, cy - 1.98, cz + 0.06] });
  }

  /* --------------------------------------------------- GIANT PINK DCT LETTERS */
  // Authored as solid extruded letterforms in the planted island in front of
  // the wall. Letters are ~2.2 m tall so they read from the highway.
  {
    const islandX = OPEN + 4.2, islandZ = WZ + 1.9;
    const parts = [...letterD(-2.2), ...letterC(0.35), ...letterT(2.95)];
    for (const p of parts) {
      const geo = p.geo.clone();
      geo.translate(islandX + p.x, 1.6 + p.y, islandZ);
      b.addGeo(geo, 'dctPink');
    }
    // Planting island
    b.add(box(9.2, 0.62, 3.6, 1.6), 'concreteTrim', { pos: [islandX, 0.31, islandZ], collide: true });
    b.add(box(8.9, 0.14, 3.3, 1.6), 'soil', { pos: [islandX, 0.68, islandZ] });
  }

  /* ------------------------------------------------------------ GUARD HOUSE */
  {
    const gx = -OPEN - 6.4, gz = WZ - 1.4;
    b.add(box(3.2, 2.5, 2.8, 2), 'dctWall', { pos: [gx, 1.25, gz], collide: true });
    b.add(box(3.5, 0.24, 3.1, 2), 'paintWhite', { pos: [gx, 2.6, gz] });
    b.add(box(3.8, 0.5, 3.4, 1.6), 'roofRib', { pos: [gx, 2.95, gz] });
    b.add(box(1.35, 0.9, 0.1, 1), nightMode ? 'glassLit' : 'glassDark',
      { pos: [gx + 1.7, 1.75, gz - 0.02], rot: [0, Math.PI / 2, 0] });
    b.add(box(0.9, 1.9, 0.1, 1), 'woodDark', { pos: [gx, 0.95, gz + 1.42] });
    // boom barrier
    b.add(cylinder(0.09, 0.11, 0.95, 8), 'ironDark', { pos: [-OPEN - 0.3, 0.48, WZ + 2.2] });
    b.add(box(0.1, 0.1, 4.4, 1), 'paintRed', { pos: [-OPEN - 0.3, 0.9, WZ + 4.3] });
    b.add(box(0.11, 0.03, 4.4, 1), 'paintWhite', { pos: [-OPEN - 0.3, 0.96, WZ + 4.3] });
  }

  /* ---------------------------------------------------------- GATE POSTS */
  for (const px of [OPEN, -OPEN]) {
    b.add(box(0.78, 2.9, 0.78, 1.6), 'rockFace', { pos: [px, 1.45, WZ + 0.2], collide: true });
    b.add(box(0.98, 0.2, 0.98, 1.2), 'rockCap', { pos: [px, 2.99, WZ + 0.2] });
    b.add(cylinder(0.055, 0.055, 0.55, 6), 'ironDark', { pos: [px, 3.32, WZ + 0.2] });
    b.add(box(0.24, 0.32, 0.24, 1), nightMode ? 'lampGlow' : 'glassDark', { pos: [px, 3.66, WZ + 0.2] });
  }

  /* ------------------------------------------------------ SLIDING GATE LEAF */
  {
    const x0 = -OPEN + 0.35, x1 = OPEN - 0.35;
    for (let i = 0; i < 24; i++) {
      const x = x0 + (i / 23) * (x1 - x0);
      b.add(cylinder(0.024, 0.024, 2.1, 5), 'ironDark', { pos: [x, 1.12, WZ + 0.55] });
    }
    for (const y of [0.14, 1.12, 2.14]) {
      b.add(box(x1 - x0, 0.07, 0.07, 1), 'ironDark', { pos: [(x0 + x1) / 2, y, WZ + 0.55] });
    }
    b.add(box(x1 - x0, 0.4, 0.045, 1), 'ironDark', { pos: [(x0 + x1) / 2, 1.66, WZ + 0.55] });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.43), M.crest);
    plate.position.set((x0 + x1) / 2, 1.66, WZ + 0.6);
    b.addSign(plate);
  }

  /* ---------------------------------------------------- COVERED PARKING BAYS */
  {
    const pz = -9.0, px0 = -18.0, px1 = 2.0;
    for (let x = px0; x <= px1; x += 5.0) {
      for (const sz of [-4.0, 4.0]) {
        b.add(cylinder(0.11, 0.13, 4.15, 8), 'steel', { pos: [x, 2.07, pz + sz], collide: true });
      }
      b.add(box(0.1, 0.1, 8.4, 1), 'steel', { pos: [x, 4.18, pz] });
    }
    b.add(box(px1 - px0 + 1.6, 0.1, 9.3, 2), 'galv', { pos: [(px0 + px1) / 2, 4.4, pz], rot: [-0.045, 0, 0] });
    for (let z = -4.2; z <= 4.2; z += 1.4) {
      b.add(box(px1 - px0 + 1.3, 0.07, 0.07, 1), 'steel', { pos: [(px0 + px1) / 2, 4.31, pz + z] });
    }
    b.add(box(px1 - px0, 0.12, 9.0, TEXSCALE.concrete), 'concrete', { pos: [(px0 + px1) / 2, 0.06, pz] });
  }

  /* --------------------------------------------------------- FENCE + BANNER */
  {
    // Steel palisade continuing up the east side, with a printed banner.
    const bx = -OPEN - 14.5;
    // A plane keeps the printed artwork at 1:1 — a box would tile the map.
    const bannerGeo = new THREE.PlaneGeometry(6.0, 5.4);
    bannerGeo.translate(bx, 4.2, WZ - 0.36);
    b.addGeo(bannerGeo, 'bannerCloth');
    b.add(box(6.3, 0.12, 0.14, 1), 'steel', { pos: [bx, 7.0, WZ - 0.4] });
    b.add(box(6.3, 0.12, 0.14, 1), 'steel', { pos: [bx, 1.4, WZ - 0.4] });
    for (const s of [-1, 1]) b.add(cylinder(0.06, 0.06, 5.7, 6), 'steel', { pos: [bx + s * 3.05, 4.2, WZ - 0.4] });
  }

  const signs = b.signs || [];
  b.signs = undefined;
  b.buildInto(g, M);
  for (const s of signs) g.add(s);
  // Colliders were baked in the gate's local frame — transform them to world.
  const m = new THREE.Matrix4().compose(
    g.position.clone(),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, GATE.rotY, 0)),
    new THREE.Vector3(1, 1, 1),
  );
  const colliders = b.colliders.map((c) => {
    const pts = [];
    for (const x of [c.min.x, c.max.x]) for (const y of [c.min.y, c.max.y]) for (const z of [c.min.z, c.max.z]) {
      pts.push(new THREE.Vector3(x, y, z).applyMatrix4(m));
    }
    const min = new THREE.Vector3(Infinity, Infinity, Infinity);
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    for (const p of pts) { min.min(p); max.max(p); }
    return { min, max };
  });
  return { group: g, colliders };
}

/* ------------------------------------------------------------- letterforms */
const LH = 2.2, LT = 0.62, LD = 0.52;

/**
 * D.
 *
 * The bowl was a full 180 degree semicircle whose ends sat exactly on the stem,
 * so it closed into an O and the letter read as a ring beside the pink C. The
 * bowl should leave the stem at the top and bottom shoulders and return to it,
 * which is what gives the counter its D shape: sweep a little less than a half
 * turn and let the flat stem close it.
 */
function letterD(x) {
  const parts = [];
  const push = (geo, dx, dy) => parts.push({ geo, x: x + dx, y: dy });
  // stem
  push(box(LT, LH, LD), 0, LH / 2);
  // bowl: arc of short chords, leaving ~14 degrees at each shoulder
  const steps = 14, rx = 0.66, ry = 0.80;
  const a0 = -Math.PI / 2 + 0.24, a1 = Math.PI / 2 - 0.24;
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (i / steps) * (a1 - a0);
    const px = LT / 2 + Math.cos(a) * rx;
    const py = LH / 2 + Math.sin(a) * ry;
    const g = box(LT * 0.95, 0.46, LD);
    g.rotateZ(-a);                          // chord along the tangent
    push(g, px, py);
  }
  // shoulders, tying the open ends of the bowl back into the stem
  for (const sgn of [-1, 1]) {
    const g = box(0.72, LT * 0.92, LD);
    g.rotateZ(sgn * 0.30);
    push(g, LT / 2 + 0.30, LH / 2 + sgn * (ry * 0.94));
  }
  return parts;
}

/**
 * C.
 *
 * This swept 1.84 pi — 331 degrees — leaving a 29 degree gap directly facing the
 * road. A C is read from its opening, and at 29 degrees there is nothing to read:
 * from the highway the giant letter looked like a solid pink donut hung on the
 * wall. Real caps open about 100 degrees, and each chord has to be rotated
 * perpendicular to its radius, or the strokes fan across the counter instead of
 * following the arc.
 */
function letterC(x) {
  const parts = [];
  const R = 0.88;
  const OPEN = Math.PI * 0.56;              // ~101 degrees of gap
  const span = Math.PI * 2 - OPEN;
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const a = OPEN / 2 + (i / steps) * span; // start past the gap, sweep around
    const px = Math.cos(a) * R;
    const py = Math.sin(a) * R;
    const g = box(LT, 0.50, LD);
    g.rotateZ(a + Math.PI / 2);             // chord perpendicular to the radius
    parts.push({ geo: g, x: x + px, y: LH / 2 + py });
  }
  return parts;
}

function letterT(x) {
  return [
    { geo: box(2.5, LT, LD), x, y: LH - LT / 2 },
    { geo: box(LT, LH - 0.1, LD), x, y: (LH - 0.1) / 2 },
  ];
}
