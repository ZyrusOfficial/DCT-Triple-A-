/**
 * Site ground: roads, plaza, forecourts, yards and the surrounding poblacion.
 *
 * Capas poblacion is dead flat (lahar plain). Surfaces sit at slightly different
 * heights (2–9 cm) so there is no z-fighting, kerbs read correctly, and SSAO has
 * something to bite into.
 */
import * as THREE from 'three';
import { Builder, box, TEXSCALE } from './kit.js';
import { L } from './layout.js';

/** Flat quad from 4 XZ corners at a constant height, UV'd in world metres. */
function quad(a, b, c, d, y, texScale) {
  // Wind counter-clockwise seen from above so the face normal points +Y.
  const g = new THREE.BufferGeometry();
  const v = [
    a[0], y, a[1], c[0], y, c[1], b[0], y, b[1],
    a[0], y, a[1], d[0], y, d[1], c[0], y, c[1],
  ];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  const uv = new Float32Array(12);
  for (let i = 0; i < 6; i++) {
    uv[i * 2] = v[i * 3] / texScale;
    uv[i * 2 + 1] = v[i * 3 + 2] / texScale;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeVertexNormals();
  // Safety: flip if the computed normal points down (catches bad corner order).
  const n = g.attributes.normal;
  if (n.getY(0) < 0) {
    for (let i = 0; i < n.count; i++) n.setXYZ(i, n.getX(i), -n.getY(i), n.getZ(i));
  }
  return g;
}

export function rect(x0, z0, x1, z1, y, texScale) {
  return quad([x0, z0], [x1, z0], [x1, z1], [x0, z1], y, texScale);
}

export function disc(cx, cz, r, y, texScale, seg = 48) {
  const g = new THREE.CircleGeometry(r, seg);
  g.rotateX(-Math.PI / 2);
  g.translate(cx, y, cz);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (2 * r) / texScale, uv.getY(i) * (2 * r) / texScale);
  return g;
}

export function ringGeo(cx, cz, r0, r1, y, texScale, seg = 48) {
  const g = new THREE.RingGeometry(r0, r1, seg);
  g.rotateX(-Math.PI / 2);
  g.translate(cx, y, cz);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (2 * r1) / texScale, uv.getY(i) * (2 * r1) / texScale);
  return g;
}

export function buildGround(parent, M) {
  const b = new Builder('ground');
  const G = new THREE.Group();
  G.name = 'ground';
  parent.add(G);

  const HW = L.highway;
  const hw0 = HW.cx - HW.halfWidth, hw1 = HW.cx + HW.halfWidth;

  /* --------------------------------------------------------- MACARTHUR HWY */
  // 4 lanes (2 each way) + painted shoulders, running N–S through town.
  b.addGeo(rect(hw0, HW.zMin, hw1, HW.zMax, 0.00, TEXSCALE.asphalt), 'asphalt');
  // Shoulder / gutter strips
  b.addGeo(rect(hw0 - 1.6, HW.zMin, hw0, HW.zMax, 0.045, TEXSCALE.concrete), 'concreteDark');
  b.addGeo(rect(hw1, HW.zMin, hw1 + 1.6, HW.zMax, 0.045, TEXSCALE.concrete), 'concreteDark');
  // Double centre line
  b.addGeo(rect(HW.cx - 0.24, HW.zMin, HW.cx - 0.10, HW.zMax, 0.05, 3), 'roadPaintYellow');
  b.addGeo(rect(HW.cx + 0.10, HW.zMin, HW.cx + 0.24, HW.zMax, 0.05, 3), 'roadPaintYellow');
  // Lane dashes
  for (let z = HW.zMin; z < HW.zMax; z += 12) {
    b.addGeo(rect(HW.cx - 6.0, z, HW.cx - 5.82, z + 4.6, 0.05, 3), 'roadPaintWhite');
    b.addGeo(rect(HW.cx + 5.82, z, HW.cx + 6.0, z + 4.6, 0.05, 3), 'roadPaintWhite');
  }
  // Kerbs
  for (const x of [hw0 - 1.6, hw1 + 1.6]) {
    b.add(box(0.28, 0.18, HW.zMax - HW.zMin, 1.5), 'concreteTrim',
      { pos: [x, 0.09, (HW.zMin + HW.zMax) / 2] });
  }

  /* ------------------------------------------------- SANTO ROSARIO STREET */
  // The side street along the DCT frontage, running east–west from the highway.
  const FR = L.frontageRoad;
  b.addGeo(rect(hw1, FR.z - FR.halfWidth, -190, FR.z + FR.halfWidth, 0.00, 8), 'asphalt');
  b.addGeo(rect(hw1, FR.z - FR.halfWidth - 1.4, -190, FR.z - FR.halfWidth, 0.04, 3), 'concreteDark');
  b.addGeo(rect(hw1, FR.z + FR.halfWidth, -190, FR.z + FR.halfWidth + 1.4, 0.04, 3), 'concreteDark');
  for (let x = hw1 - 2; x > -190; x -= 11) {
    b.addGeo(rect(x - 4.4, FR.z - 0.09, x, FR.z + 0.09, 0.05, 3), 'roadPaintWhite');
  }

  /* ------------------------------------------------------- DCT FRONTAGE */
  // Paved apron outside the gate, and the driveway climbing into the yard.
  // Gate apron reaching from the highway carriageway to the campus yard.
  b.addGeo(rect(hw1 - 0.5, L.gate.z - 9.0, L.gate.x + 8.0, L.gate.z + 9.0, 0.062, TEXSCALE.concrete), 'concrete');
  // Driveway from the highway, through the gate, into the campus yard.
  b.addGeo(rect(L.gate.x - 6.0, L.gate.z - 7.5, hw1 + 0.6, L.gate.z + 7.5, 0.066, TEXSCALE.concrete), 'concrete');
  for (const z of [L.gate.z - 7.7, L.gate.z + 7.7]) {
    b.add(box(14.0, 0.16, 0.26, 1.5), 'concreteTrim', { pos: [L.gate.x + 1.0, 0.08, z] });
  }

  /* ---------------------------------------------------------- CAMPUS YARD */
  /**
   * DCT campus yard.
   *
   * Laid out as a Philippine schoolyard actually is: a broad hard-paved
   * forecourt in front of the main building, a lawn panel either side of the
   * central axis with trees on it, and a driveway running in from the gate.
   *
   * Height rule (this is what keeps the ground from flickering or floating):
   *     base paving 0.070  <  grass panels 0.078  <  axis / paths 0.090
   * Every lawn must sit just ABOVE the paving it interrupts and just BELOW the
   * paths that cross it.
   */
  const Y = L.yard;
  b.addGeo(rect(Y.xMin, Y.zMin, Y.xMax, Y.zMax, 0.070, TEXSCALE.paving), 'paving');

  // Lawn panels — kept clear of the gate axis (z = gate.z ± 4) and of the
  // building's forecourt, so the axis reads as an open, walkable corridor.
  const LAWN = 0.078;
  // north-west quadrangle (between the building and the shrine approach)
  b.addGeo(rect(-66, -24.0, -50, -10.0, LAWN, TEXSCALE.grass), 'grass');
  // the two big panels flanking the axis, in front of the building
  b.addGeo(rect(-44, -22.0, -14, -10.5, LAWN, TEXSCALE.grass), 'grass');
  b.addGeo(rect(-44, -1.5, -14, 12.0, LAWN, TEXSCALE.grass), 'grass');
  // south panels, toward the covered court and the frontage road
  b.addGeo(rect(-44, 16.0, -16, 34.0, LAWN, TEXSCALE.grass), 'grass');
  /**
   * The panel that used to run (-8,16) -> (10,40) as ONE piece is split around
   * the covered court, because the court sits at x -9..21, z 19..41 and its own
   * floor slab is at y 0.06 — BELOW this lawn's 0.078. So the lawn was drawn
   * straight over the top of it and the basketball court, its painted markings
   * and its key were all buried: walking in you got a green field with a white
   * line down it and no court at all. Ray-casting down at the court centre
   * returned ground:grass at 0.08 ahead of plaza:courtFloor at 0.06.
   *
   * Nothing under a court roof should be grass anyway. Leave the two strips
   * that are genuinely outside the structure.
   */
  b.addGeo(rect(-8, 16.0, 10, 19.0, LAWN, TEXSCALE.grass), 'grass');   // north of the court
  b.addGeo(rect(-8, 41.0, 10, 44.0, LAWN, TEXSCALE.grass), 'grass');   // south of the court

  // Central axis: gate -> porte-cochère. This is the ceremonial approach.
  b.addGeo(rect(-74, L.gate.z - 3.6, L.gate.x + 6.0, L.gate.z + 3.6, 0.090, 3.2), 'pavingRed');

  // Forecourt apron directly in front of the main building entrance.
  b.addGeo(rect(-72, -8.5, -52, 26.0, 0.084, TEXSCALE.paving), 'paving');
  // Circular inlay where the axis meets the forecourt.
  b.addGeo(disc(-52, L.gate.z, 7.0, 0.094, 2.6), 'pavingRed');
  b.addGeo(ringGeo(-52, L.gate.z, 7.0, 8.0, 0.098, 2.0), 'concreteTrim');

  /* --------------------------------------------------- SHRINE FORECOURT */
  const F = L.forecourt;
  b.addGeo(rect(F.xMin, F.zMin, F.xMax, F.zMax, 0.08, TEXSCALE.paving), 'pavingRed');
  // granite apron in front of the porch (church façade at X≈-48), reaching out
  // to meet the plaza promenade
  b.addGeo(rect(-46, -70, -34, -32, 0.092, TEXSCALE.paving), 'granite');
  // garden strip between the shrine and the campus yard
  b.addGeo(rect(-70, -30, -30, -24, 0.085, TEXSCALE.grass), 'grass');

  /* ------------------------------------------------------------ TOWN PLAZA */
  const P = L.plaza;
  const px0 = P.cx - P.halfX, px1 = P.cx + P.halfX;
  const pz0 = P.cz - P.halfZ, pz1 = P.cz + P.halfZ;
  b.addGeo(rect(px0, pz0, px1, pz1, 0.055, TEXSCALE.grass), 'grass');
  // Cross paths meeting at the fountain. The E–W promenade is deliberately
  // wide: it is the sightline from MacArthur Highway to the shrine façade.
  b.addGeo(rect(P.cx - 2.6, pz0, P.cx + 2.6, pz1, 0.085, 3.2), 'pavingWarm');
  b.addGeo(rect(px0, P.cz - 3.4, px1, P.cz + 3.4, 0.085, 3.2), 'pavingWarm');
  // paved link from the park across to the shrine forecourt
  b.addGeo(rect(px0 - 26, P.cz - 3.4, px0, P.cz + 3.4, 0.086, 3.2), 'pavingWarm');
  // Central circular plaza
  b.addGeo(disc(P.cx, P.cz, 10.0, 0.09, 2.8), 'pavingWarm');
  b.addGeo(ringGeo(P.cx, P.cz, 10.0, 11.3, 0.095, 2.0), 'concreteTrim');
  // Perimeter walkway (a ring inset from the boundary)
  b.addGeo(rect(px0 + 2.0, pz0 + 2.0, px1 - 2.0, pz0 + 4.4, 0.08, 3.0), 'paving');
  b.addGeo(rect(px0 + 2.0, pz1 - 4.4, px1 - 2.0, pz1 - 2.0, 0.08, 3.0), 'paving');
  b.addGeo(rect(px0 + 2.0, pz0 + 4.4, px0 + 4.4, pz1 - 4.4, 0.08, 3.0), 'paving');
  b.addGeo(rect(px1 - 4.4, pz0 + 4.4, px1 - 2.0, pz1 - 4.4, 0.08, 3.0), 'paving');

  // Forecourt of the municipal hall (east of the highway, facing the park)
  b.addGeo(rect(hw1 + 1.6, -92, 110, -36, 0.055, TEXSCALE.grass), 'grass');
  b.addGeo(rect(hw1 + 1.6, -70, 74, -58, 0.075, 3.2), 'asphalt');   // access drive
  b.addGeo(disc(52, -50, 10.0, 0.07, 3.0), 'paving');

  /* ------------------------------------------------------- public market */
  b.addGeo(rect(16, 56, 44, 92, 0.05, TEXSCALE.concrete), 'concreteDark');

  // NOTE: the outer terrain (fields, hills, horizon) lives in terrain.js.

  b.buildInto(G, M);
  return { group: G };
}
