/**
 * Placement helpers.
 *
 * Almost every bug in this project has come from applying a rotation to a
 * geometry that was already translated into world space. These helpers make the
 * correct order the only easy one:
 *
 *   put(b, geo, mat, x, y, z, { yaw, pitch, roll })
 *
 * builds the geometry at the origin, rotates it, then moves it into place.
 */
import * as THREE from 'three';

const M4 = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const E = new THREE.Euler();
const V = new THREE.Vector3();
const S = new THREE.Vector3(1, 1, 1);

/**
 * Classic transform: scale → rotate → translate.
 * @param {object} b      Builder
 * @param {THREE.BufferGeometry} geo
 * @param {string} matKey
 * @param {number[]} pos  [x, y, z]
 * @param {object} o      { yaw, pitch, roll, rot:[x,y,z], scale, collide }
 */
export function put(b, geo, matKey, pos, o = {}) {
  const g = geo.clone();
  const rot = o.rot || [o.pitch || 0, o.yaw || 0, o.roll || 0];
  if (rot[0] || rot[1] || rot[2]) {
    E.set(rot[0], rot[1], rot[2], 'YXZ');
    Q.setFromEuler(E);
    M4.makeRotationFromQuaternion(Q);
    g.applyMatrix4(M4);
  }
  const s = o.scale ?? 1;
  if (typeof s === 'number') { if (s !== 1) g.scale(s, s, s); }
  else g.scale(s[0], s[1], s[2]);
  g.translate(pos[0], pos[1], pos[2]);
  b.addGeo(g, matKey, o.collide || false);
  return g;
}

/** Bake a geometry with an explicit matrix (world-space output). */
export function bake(geo, m4) {
  const g = geo.clone();
  g.applyMatrix4(m4);
  return g;
}

/**
 * Radially place N copies of a part around a centre. Callback receives the angle
 * and the computed world position; it returns a geometry already positioned.
 */
export function radial(count, cx, cz, radius, fn, phase = 0) {
  return Array.from({ length: count }, (_, i) => {
    const a = phase + (i / count) * Math.PI * 2;
    return fn(a, cx + Math.sin(a) * radius, cz + Math.cos(a) * radius, i);
  }).filter(Boolean);
}

export { M4, Q, E, V };
