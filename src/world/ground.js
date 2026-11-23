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
  // Gate apron on the highway, facing the campus entrance.
  b.addGeo(rect(hw1 - 0.5, L.gate.z - 8.0, L.gate.x + 6.0, L.gate.z + 8.0, 0.06, TEXSCALE.concrete), 'concrete');
  // Driveway running west from the gate into the campus yard.
  b.addGeo(rect(L.gate.x - 4.0, L.gate.z - 7.0, L.gate.x + 6.0, L.gate.z + 7.0, 0.062, TEXSCALE.concrete), 'concrete');
  for (const z of [L.gate.z - 7.2, L.gate.z + 7.2]) {
    b.add(box(11.0, 0.15, 0.24, 1.5), 'concreteTrim', { pos: [L.gate.x + 1.0, 0.075, z] });
  }

  /* ---------------------------------------------------------- CAMPUS YARD */
  const Y = L.yard;
  b.addGeo(rect(Y.xMin, Y.zMin, Y.xMax, Y.zMax, 0.075, TEXSCALE.paving), 'paving');
  // Lawn panels either side of the main axis
  b.addGeo(rect(-34, -20, -12, 6, 0.085, TEXSCALE.grass), 'grass');
  b.addGeo(rect(-34, 14, -12, 40, 0.085, TEXSCALE.grass), 'grass');
  b.addGeo(rect(-30, -24, 18, -12, 0.085, TEXSCALE.grass), 'grass');
  // Main axis from the gate straight to the building's porte-cochère
  b.addGeo(rect(-70, L.gate.z - 3.6, L.gate.x + 3.0, L.gate.z + 3.6, 0.095, 3.2), 'pavingRed');
  // Circular inlay at the crossing in front of the building
  b.addGeo(disc(-30, L.gate.z, 8.0, 0.1, 2.6), 'pavingRed');
  b.addGeo(ringGeo(-30, L.gate.z, 8.0, 9.1, 0.105, 2.0), 'concreteTrim');

  /* --------------------------------------------------- SHRINE FORECOURT */
  const F = L.forecourt;
  b.addGeo(rect(F.xMin, F.zMin, F.xMax, F.zMax, 0.08, TEXSCALE.paving), 'pavingRed');
  // granite apron immediately in front of the porch (church façade at X≈-48)
  b.addGeo(rect(-46, -66, -30, -36, 0.092, TEXSCALE.paving), 'granite');
  // garden strip between the shrine and the campus yard
  b.addGeo(rect(-70, -30, -30, -24, 0.085, TEXSCALE.grass), 'grass');

  /* ------------------------------------------------------------ TOWN PLAZA */
  const P = L.plaza;
  const px0 = P.cx - P.halfX, px1 = P.cx + P.halfX;
  const pz0 = P.cz - P.halfZ, pz1 = P.cz + P.halfZ;
  b.addGeo(rect(px0, pz0, px1, pz1, 0.055, TEXSCALE.grass), 'grass');
  // Cross paths meeting at the fountain
  b.addGeo(rect(P.cx - 2.6, pz0, P.cx + 2.6, pz1, 0.085, 3.2), 'paving');
  b.addGeo(rect(px0, P.cz - 2.6, px1, P.cz + 2.6, 0.085, 3.2), 'paving');
  // Central circular plaza
  b.addGeo(disc(P.cx, P.cz, 10.0, 0.09, 2.8), 'paving');
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
