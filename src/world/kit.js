/**
 * The building kit.
 *
 * Everything static is authored as small parametric parts, then welded into a
 * handful of merged buffers per material so the whole campus draws in a few
 * dozen calls instead of tens of thousands. This is the single biggest lever
 * for running well on a Vega 7 iGPU.
 */
import * as THREE from 'three';

/* --------------------------------------------------------------- batching */
export class Builder {
  constructor(name = 'batch') {
    this.name = name;
    this.bins = new Map(); // materialKey -> geometry[]
    this.colliders = [];   // {min,max} world-space AABBs for walking
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
  }

  /**
   * Adds a geometry with an object-style transform: rotate about the geometry's
   * own origin FIRST, then translate to `pos`. This is what every author means
   * by `{pos, rot}` and keeps the call sites readable.
   *
   * If the geometry has already been baked into world space (the `geo()`
   * helpers below do that), pass the result straight to `addGeo` instead.
   */
  add(geo, matKey, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], collide = false, pivot = null } = {}) {
    const g = geo.clone();
    if (rot[0] || rot[1] || rot[2]) {
      this._e.set(rot[0], rot[1], rot[2], 'YXZ');
      this._q.setFromEuler(this._e);
      this._m.makeRotationFromQuaternion(this._q);
      if (pivot) {
        g.translate(-pivot[0], -pivot[1], -pivot[2]);
        g.applyMatrix4(this._m);
        g.translate(pivot[0], pivot[1], pivot[2]);
      } else {
        g.applyMatrix4(this._m);
      }
    }
    if (scale[0] !== 1 || scale[1] !== 1 || scale[2] !== 1) g.scale(scale[0], scale[1], scale[2]);
    g.translate(pos[0], pos[1], pos[2]);
    if (!this.bins.has(matKey)) this.bins.set(matKey, []);
    this.bins.get(matKey).push(g);
    if (collide) this.addColliderFromGeo(g);
    return this;
  }

  addGeo(g, matKey, collide = false) {
    if (!this.bins.has(matKey)) this.bins.set(matKey, []);
    this.bins.get(matKey).push(g);
    if (collide) this.addColliderFromGeo(g);
    return this;
  }

  /** Meshes that can't be merged (unique materials) go straight in here. */
  addSign(mesh) {
    if (!this.signs) this.signs = [];
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    this.signs.push(mesh);
    return this;
  }

  addColliderFromGeo(g) {
    g.computeBoundingBox();
    const b = g.boundingBox;
    this.colliders.push({ min: b.min.clone(), max: b.max.clone() });
  }

  addCollider(min, max) {
    this.colliders.push({ min: new THREE.Vector3(...min), max: new THREE.Vector3(...max) });
  }

  /** Welds every bin into a single BufferGeometry and returns meshes. */
  buildInto(parent, materials, { castShadow = true, receiveShadow = true } = {}) {
    const meshes = [];
    for (const [key, geos] of this.bins) {
      const mat = materials[key];
      if (!mat) { console.warn('[kit] missing material', key); continue; }
      const merged = mergeGeos(geos);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.name = `${this.name}:${key}`;
      mesh.castShadow = castShadow && !mat.userData?.noShadow;
      mesh.receiveShadow = receiveShadow;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      parent.add(mesh);
      meshes.push(mesh);
      // free intermediate geometries
      for (const g of geos) g.dispose?.();
    }
    this.bins.clear();
    return meshes;
  }
}

/** Fast merge of non-indexed geometries with identical attributes. */
export function mergeGeos(geos) {
  if (!geos.length) return null;
  const use = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let total = 0;
  for (const g of use) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  let o = 0;
  for (const g of use) {
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    pos.set(p.array, o * 3);
    if (n) nor.set(n.array, o * 3);
    if (u) uv.set(u.array, o * 2);
    o += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}

/* ------------------------------------------------------------- primitives */
const memoGeo = new Map();
function memoBox(w, h, d) {
  const k = `b${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}`;
  if (!memoGeo.has(k)) memoGeo.set(k, new THREE.BoxGeometry(w, h, d));
  return memoGeo.get(k);
}

/** Bakes UVs so a box uses world-scale texel density instead of 0..1. */
export function boxUV(w, h, d, texScale = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const pos = g.attributes.position;
  const norms = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(norms.getX(i)), ny = Math.abs(norms.getY(i)), nz = Math.abs(norms.getZ(i));
    if (nx > 0.5) uv.setXY(i, pos.getZ(i) / texScale, pos.getY(i) / texScale);
    else if (ny > 0.5) uv.setXY(i, pos.getX(i) / texScale, pos.getZ(i) / texScale);
    else uv.setXY(i, pos.getX(i) / texScale, pos.getY(i) / texScale);
  }
  return g;
}

export function box(w, h, d, texScale = 1) { return boxUV(w, h, d, texScale); }

export function plane(w, h, texScale = 1) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / texScale, uv.getY(i) * h / texScale);
  return g;
}

export function cylinder(rTop, rBot, h, seg = 16, texScale = 1) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, false);
  const uv = g.attributes.uv;
  const circ = Math.PI * 2 * Math.max(rTop, rBot);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ / texScale, uv.getY(i) * h / texScale);
  return g;
}

export function sphere(r, seg = 16, texScale = 1) {
  const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1));
  const uv = g.attributes.uv;
  const circ = Math.PI * 2 * r;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ / texScale, uv.getY(i) * circ / texScale);
  return g;
}

/* -------------------------------------------------------- wall with holes */
/**
 * Builds a wall panel in the XY plane (thickness along Z) with rectangular or
 * arched openings. Openings are given in panel-local metres from the centre.
 */
export function wallWithOpenings(width, height, thickness, openings = [], unit = 0.01) {
  const geos = [];
  const W = width, H = height, T = thickness;
  const x0 = -W / 2, x1 = W / 2, y0 = 0, y1 = H;

  const sorted = [...openings].sort((a, b) => a.x - b.x);
  // Vertical strips between openings (full height), then header/sill fills.
  let cursor = x0;
  const strips = [];
  for (const op of sorted) {
    const ox0 = op.x - op.w / 2, ox1 = op.x + op.w / 2;
    if (ox0 > cursor) strips.push([cursor, ox0]);
    cursor = Math.max(cursor, ox1);
  }
  if (cursor < x1) strips.push([cursor, x1]);

  for (const [sx0, sx1] of strips) {
    const w = sx1 - sx0;
    if (w <= 1e-4) continue;
    geos.push(box(w, H, T, unit).translate((sx0 + sx1) / 2, H / 2, 0));
  }
  // Openings: fill below sill and above head.
  for (const op of sorted) {
    const bottom = op.y - op.h / 2;
    const top = op.y + op.h / 2;
    if (bottom > 0.001) {
      geos.push(box(op.w, bottom, T, unit).translate(op.x, bottom / 2, 0));
    }
    if (top < H - 0.001) {
      geos.push(box(op.w, H - top, T, unit).translate(op.x, (H + top) / 2, 0));
    }
  }
  return geos;
}

/* --------------------------------------------------------------- openings */
/** A window unit: recess, glass, frame, sill, optional grille. */
export function windowUnit(w, h, {
  depth = 0.14, frame = 0.06, glassKey = 'glass', frameKey = 'paintWhite',
  grille = false, sill = true, arch = false, mullions = 1, transom = false,
  /**
   * `backing` is the opaque recess slab that stops you seeing through the wall.
   *
   * It exists for windows applied to a SOLID wall, where without it you would
   * see a dark void or the sky through a wall that has no hole in it. On a wall
   * that has been genuinely pierced — the main building's long walls now are —
   * the backing is exactly wrong: it is an opaque panel hung in the middle of a
   * real opening, and it renders as a solid slab where the view should be.
   * Pass false on pierced walls.
   */
  backing = true,
} = {}) {
  const parts = [];
  const g = [];
  if (backing) {
    // Recess box (dark interior backing) so we never see through a solid wall.
    g.push({ geo: box(w, h, 0.02), key: 'interior', pos: [0, 0, -depth * 0.5] });
  }
  // Glazing
  g.push({ geo: box(w - frame * 2, h - frame * 2, 0.012), key: glassKey, pos: [0, 0, 0] });
  // Frame: 4 sides
  const fk = frameKey;
  g.push({ geo: box(w, frame, depth), key: fk, pos: [0, h / 2 - frame / 2, 0] });
  g.push({ geo: box(w, frame, depth), key: fk, pos: [0, -h / 2 + frame / 2, 0] });
  g.push({ geo: box(frame, h, depth), key: fk, pos: [-w / 2 + frame / 2, 0, 0] });
  g.push({ geo: box(frame, h, depth), key: fk, pos: [w / 2 - frame / 2, 0, 0] });
  // Mullions
  for (let i = 1; i <= mullions; i++) {
    const x = -w / 2 + (w / (mullions + 1)) * i;
    g.push({ geo: box(0.035, h - frame, depth * 0.75), key: fk, pos: [x, 0, 0] });
  }
  if (transom) g.push({ geo: box(w - frame, 0.035, depth * 0.75), key: fk, pos: [0, h * 0.22, 0] });
  if (grille) {
    const bars = Math.max(2, Math.round(w / 0.22));
    for (let i = 0; i < bars; i++) {
      const x = -w / 2 + 0.08 + (i * (w - 0.16)) / (bars - 1);
      g.push({ geo: cylinder(0.008, 0.008, h - 0.04, 5), key: 'ironDark', pos: [x, 0, depth * 0.45] });
    }
    for (let j = 0; j < 3; j++) {
      g.push({ geo: box(w - 0.06, 0.014, 0.014), key: 'ironDark', pos: [0, -h / 2 + 0.1 + j * (h - 0.2) / 2, depth * 0.45] });
    }
  }
  if (sill) {
    g.push({ geo: box(w + 0.12, 0.07, depth + 0.09), key: 'concreteTrim', pos: [0, -h / 2 - 0.035, 0.02] });
  }
  return g;
}

/** Round column with base + capital; returns parts list. */
export function column(radius, height, {
  key = 'paintCream', baseH = 0.18, capH = 0.16, segments = 14, flutes = 0,
} = {}) {
  const g = [];
  const shaftH = height - baseH - capH;
  g.push({ geo: cylinder(radius * 0.94, radius, shaftH, segments), key, pos: [0, baseH + shaftH / 2, 0] });
  g.push({ geo: box(radius * 2.5, baseH, radius * 2.5), key, pos: [0, baseH / 2, 0] });
  g.push({ geo: box(radius * 2.35, capH * 0.45, radius * 2.35), key, pos: [0, baseH + shaftH + capH * 0.225, 0] });
  g.push({ geo: cylinder(radius * 1.22, radius * 1.06, capH * 0.55, segments), key, pos: [0, baseH + shaftH + capH * 0.72, 0] });
  return g;
}

/** Simple metal railing between two points in XZ at height y. */
export function railingLine(x0, z0, x1, z1, y, h = 1.0, { spacing = 0.22, key = 'ironDark', posts = true } = {}) {
  const g = [];
  const dx = x1 - x0, dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  const ang = Math.atan2(dz, dx);
  const n = Math.max(1, Math.floor(len / spacing));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const px = x0 + dx * t, pz = z0 + dz * t;
    g.push({ geo: cylinder(0.009, 0.009, h, 5), key, pos: [px, y + h / 2, pz] });
  }
  const mid = [x0 + dx / 2, z0 + dz / 2];
  // rails (top and bottom) as thin boxes rotated along the line
  for (const ry of [y + h - 0.03, y + h * 0.42]) {
    const geo = box(len, 0.028, 0.028);
    geo.rotateY(-ang);
    geo.translate(mid[0], ry, mid[1]);
    g.push({ geo, key, pos: [0, 0, 0] });
  }
  if (posts && len > 1.4) {
    const np = Math.max(2, Math.round(len / 2.2));
    for (let i = 0; i <= np; i++) {
      const t = i / np;
      g.push({ geo: box(0.055, h + 0.1, 0.055), key, pos: [x0 + dx * t, y + (h + 0.1) / 2, z0 + dz * t] });
    }
  }
  return g;
}

/** Straight run of stairs. Returns parts; rises along +Z. */
export function stairs(width, steps, rise, run, { key = 'concrete' } = {}) {
  const g = [];
  for (let i = 0; i < steps; i++) {
    const y = rise * (i + 1);
    const z = run * i + run / 2;
    g.push({ geo: box(width, rise, run), key, pos: [0, y - rise / 2, z] });
    // nosing
    g.push({ geo: box(width, 0.018, 0.03), key: 'concreteTrim', pos: [0, y + 0.009, z - run / 2 + 0.015] });
  }
  return g;
}

/** Gable roof: two pitched planes + gable ends. Ridge runs along X. */
export function gableRoof(w, d, rise, { key = 'roofRib', overhang = 0.6, fasciaKey = 'paintWhite', thickness = 0.09 } = {}) {
  const g = [];
  const D = d + overhang * 2;
  const W = w + overhang * 2;
  const slope = Math.hypot(D / 2, rise);
  const ang = Math.atan2(rise, D / 2);
  for (const s of [-1, 1]) {
    const geo = box(W, thickness, slope);
    geo.rotateX(s * ang);
    geo.translate(0, rise / 2, s * (D / 4));
    g.push({ geo, key, pos: [0, 0, 0] });
  }
  // Ridge cap
  g.push({ geo: box(W, 0.10, 0.16), key: fasciaKey, pos: [0, rise + 0.04, 0] });
  // Fascia boards
  for (const s of [-1, 1]) {
    g.push({ geo: box(W, 0.16, 0.06), key: fasciaKey, pos: [0, 0.06, s * D / 2] });
  }
  return g;
}

/** Hip roof (all four sides pitched) as a low-poly shell. */
export function hipRoof(w, d, rise, { key = 'roofRib', overhang = 0.7 } = {}) {
  const W = w + overhang * 2, D = d + overhang * 2;
  const g = [];
  const ridge = Math.max(0.001, (W - D) / 2);
  const pos = [];
  const A = [-W / 2, 0, -D / 2], B = [W / 2, 0, -D / 2], C = [W / 2, 0, D / 2], Dd = [-W / 2, 0, D / 2];
  const R1 = [-ridge, rise, 0], R2 = [ridge, rise, 0];
  // Wind counter-clockwise when seen from outside so front faces point out.
  const push = (a, b, c) => pos.push(...a, ...b, ...c);
  push(B, A, R1); push(B, R1, R2);      // north slope
  push(Dd, C, R2); push(Dd, R2, R1);    // south slope
  push(A, Dd, R1);                      // west hip
  push(C, B, R2);                       // east hip
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  const uv = new Float32Array((pos.length / 3) * 2);
  for (let i = 0; i < pos.length / 3; i++) { uv[i * 2] = pos[i * 3] * 0.25; uv[i * 2 + 1] = pos[i * 3 + 2] * 0.25; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.push({ geo, key, pos: [0, 0, 0] });
  return g;
}

/** Half-dome (apse / bell-tower cap). */
export function dome(r, { key = 'roofRib', seg = 20, rings = 10, squash = 1 } = {}) {
  const geo = new THREE.SphereGeometry(r, seg, rings, 0, Math.PI * 2, 0, Math.PI / 2);
  geo.scale(1, squash, 1);
  const uvA = geo.attributes.uv;
  for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) * 6, uvA.getY(i) * 4);
  return [{ geo, key, pos: [0, 0, 0] }];
}

/** Latin cross made of two boxes. */
export function cross(h, w, t, key = 'paintWhite') {
  return [
    { geo: box(w, h, t), key, pos: [0, h / 2, 0] },
    { geo: box(h * 0.52, w * 0.92, t), key, pos: [0, h * 0.74, 0] },
  ];
}

/** Recessed statue niche with canopy — the DCT façade centrepiece. */
export function statueNiche(w, h, d, { key = 'paintCream' } = {}) {
  const g = [];
  g.push({ geo: box(0.12, h, d), key, pos: [-w / 2, h / 2, d / 2] });
  g.push({ geo: box(0.12, h, d), key, pos: [w / 2, h / 2, d / 2] });
  g.push({ geo: box(w + 0.3, 0.22, d + 0.2), key: key, pos: [0, h, d / 2] });
  g.push({ geo: box(w, 0.16, d), key: 'concreteTrim', pos: [0, 0.08, d / 2] });
  return g;
}

/** Awning / canopy supported by posts, used all over the campus walkways. */
export function walkwayCanopy(length, width, height, {
  roofKey = 'roofRib', postKey = 'paintCream', bays = 4, ridge = 0.35,
} = {}) {
  const g = [];
  const step = length / bays;
  for (let i = 0; i <= bays; i++) {
    const x = -length / 2 + i * step;
    g.push({ geo: box(0.11, height, 0.11), key: postKey, pos: [x, height / 2, -width / 2 + 0.12] });
    g.push({ geo: box(0.11, height, 0.11), key: postKey, pos: [x, height / 2, width / 2 - 0.12] });
    g.push({ geo: box(0.1, 0.12, width), key: postKey, pos: [x, height - 0.06, 0] });
  }
  // Slight gable roof
  const runLen = Math.hypot(width / 2, ridge);
  const ang = Math.atan2(ridge, width / 2);
  for (const s of [-1, 1]) {
    const geo = box(length + 0.5, 0.06, runLen + 0.3);
    geo.rotateX(s * ang);
    geo.translate(0, height + ridge / 2, s * width / 4);
    g.push({ geo, key: roofKey, pos: [0, 0, 0] });
  }
  g.push({ geo: box(length + 0.5, 0.10, 0.16), key: 'paintWhite', pos: [0, height + ridge + 0.04, 0] });
  return g;
}

/* ------------------------------------------------------------ scene utils */
/** Flattens a parts list into a Builder. */
export function placeParts(builder, parts, { pos = [0, 0, 0], rotY = 0, scale = 1 } = {}) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0));
  m.compose(new THREE.Vector3(...pos), q, new THREE.Vector3(scale, scale, scale));
  for (const p of parts) {
    const geo = p.geo.clone().applyMatrix4(m);
    builder.addGeo(geo, p.key);
  }
}

/** Local→world helper for parts defined inside a rotated group. */
export function transformParts(parts, { pos = [0, 0, 0], rotY = 0 }) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0));
  m.compose(new THREE.Vector3(...pos), q, new THREE.Vector3(1, 1, 1));
  return parts.map((p) => ({ ...p, geo: p.geo.clone().applyMatrix4(m) }));
}

export const TEXSCALE = {
  concrete: 2.0,
  churchWall: 2.6,
  paint: 2.2,
  brick: 1.8,
  paving: 2.4,
  roof: 1.4,
  wood: 1.6,
  metal: 1.2,
  grass: 8,
  asphalt: 9,
};
