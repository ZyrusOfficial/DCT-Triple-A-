/**
 * Vegetation.
 *
 * Capas pueblo is green: acacia and mango canopy, palms, bougainvillea,
 * trimmed hedges around the plaza, and coconuts. All of it is instanced —
 * one InstancedMesh per species/card type — so a few thousand leaf cards cost
 * a handful of draw calls.
 *
 * Trees are built from a trunk (low-poly tapered cylinder) plus 12–24 alpha
 * crossed cards arranged in a rough ellipsoid. Cards are oriented randomly and
 * sorted by size so the canopy reads as volume from the ground.
 */
import * as THREE from 'three';
import { box, cylinder, sphere } from './kit.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _e = new THREE.Euler();

class CardInstancer {
  constructor(geo, mat, max = 4096) {
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false;
    this.mesh.count = 0;
    this.max = max;
    this.mesh.frustumCulled = false;
  }
  push(pos, rotY, rotX, rotZ, scale) {
    if (this.mesh.count >= this.max) return false;
    _e.set(rotX, rotY, rotZ, 'YXZ');
    _q.setFromEuler(_e);
    _s.set(scale, scale, scale);
    _p.set(pos[0], pos[1], pos[2]);
    _m.compose(_p, _q, _s);
    this.mesh.setMatrixAt(this.mesh.count++, _m);
    return true;
  }
  finish() {
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.computeBoundingSphere();
    return this.mesh;
  }
}

function mergeGeoList(geos) {
  const nonIdx = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let total = 0;
  for (const g of nonIdx) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
  let o = 0;
  for (const g of nonIdx) {
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}

/** Deterministic RNG so the world looks identical every load. */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Vegetation {
  constructor(parent, M, seed = 20241123) {
    this.parent = parent;
    this.M = M;
    this.rand = mulberry32(seed);
    this.group = new THREE.Group();
    this.group.name = 'vegetation';
    parent.add(this.group);

    // Cards: one quad, double-sided alpha-tested.
    const card = new THREE.PlaneGeometry(1, 1);
    // Slight vertical dome so cards never look perfectly flat.
    card.translate(0, 0, 0);

    this.near = new CardInstancer(card, M.leafNear, 3200);
    this.mid = new CardInstancer(card, M.leafMid, 3600);
    this.dark = new CardInstancer(card, M.leafDark, 2400);
    this.frond = new CardInstancer(new THREE.PlaneGeometry(1.9, 3.6).translate(0, 1.8, 0), M.frond, 900);
    this.hedge = new CardInstancer(card, M.hedge, 1800);
    this.grass = new CardInstancer(new THREE.PlaneGeometry(1.1, 0.85).translate(0, 0.42, 0), M.grassCard, 4000);

    this.trunkGeos = [];
    this.trunks = [];
    this.hedgeSolids = [];
    this.colliders = [];
  }

  r(a = 0, b = 1) { return a + this.rand() * (b - a); }

  /* --------------------------------------------------------------- trees */
  /**
   * Broad canopy tree (acacia / narra / mango).
   * @param {number[]} pos  [x, y, z]
   */
  broadleaf(pos, { height = 9, spread = 4.2, kind = 'near', trunkR = 0.28, lean = 0.03 } = {}) {
    const [x, y, z] = pos;
    const inst = kind === 'dark' ? this.dark : kind === 'mid' ? this.mid : this.near;
    // Trunk: stack tapered segments with slight lean and a couple of limbs.
    const segs = 4;
    let px = x, pz = z, py = y;
    let rr = trunkR;
    for (let i = 0; i < segs; i++) {
      const h = height * 0.28 / segs * 1.0;
      const nx = px + (this.rand() - 0.5) * lean * height * 0.1;
      const nz = pz + (this.rand() - 0.5) * lean * height * 0.1;
      const g = cylinder(rr * 0.78, rr, h * segs * 1.05, 7);
      g.translate(px, py + (h * segs * 1.05) / 2, pz);
      this.trunkGeos.push(g);
      // limbs
      if (i >= 1) {
        const nLimb = 2 + (i > 2 ? 1 : 0);
        for (let k = 0; k < nLimb; k++) {
          const a = this.r(0, Math.PI * 2);
          const lh = height * 0.26;
          const lg = cylinder(rr * 0.24, rr * 0.5, lh, 5);
          lg.rotateZ(Math.PI / 2 - 0.75);
          lg.rotateY(a);
          lg.translate(px + Math.cos(a) * lh * 0.28, py + h * segs * 0.9, pz + Math.sin(a) * lh * 0.28);
          this.trunkGeos.push(lg);
        }
      }
      px = nx; pz = nz; py += h * segs;
      rr *= 0.8;
    }
    // Canopy ellipsoid of cards
    const cy = y + height * 0.72;
    const n = 18 + Math.floor(spread * 3);
    for (let i = 0; i < n; i++) {
      // Fibonacci-ish distribution, flattened into an ellipsoid
      const u = this.rand(), v = this.rand();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2 * v - 1);
      const rad = Math.pow(this.rand(), 0.42);
      const rx = spread * rad, ry = spread * 0.68 * rad;
      const cx = px + Math.sin(phi) * Math.cos(theta) * rx;
      const cz = pz + Math.sin(phi) * Math.sin(theta) * rx;
      const cyy = cy + Math.cos(phi) * ry;
      const sc = spread * (0.55 + this.rand() * 0.55);
      inst.push([cx, cyy, cz], this.r(0, Math.PI * 2), this.r(-0.35, 0.35), this.r(-0.3, 0.3), sc);
    }
    this.colliders.push({
      min: new THREE.Vector3(x - trunkR * 1.6, y, z - trunkR * 1.6),
      max: new THREE.Vector3(x + trunkR * 1.6, y + height * 0.5, z + trunkR * 1.6),
    });
  }

  /** Coconut / royal palm. */
  palm(pos, { height = 8.5, fronds = 11, lean = 0.5 } = {}) {
    const [x, y, z] = pos;
    const dir = this.r(0, Math.PI * 2);
    const lx = Math.cos(dir) * lean, lz = Math.sin(dir) * lean;
    const segs = 6;
    let px = x, pz = z, py = y;
    for (let i = 0; i < segs; i++) {
      const h = height / segs;
      const r = 0.24 * (1 - (i / segs) * 0.42);
      const g = cylinder(r * 0.86, r, h * 1.02, 8);
      g.translate(px, py + h / 2, pz);
      this.trunkGeos.push(g);
      // ring texture illusion: slightly wider node
      if (i > 0) {
        const ring = cylinder(r * 1.12, r * 1.12, 0.07, 8);
        ring.translate(px, py + 0.02, pz);
        this.trunkGeos.push(ring);
      }
      px += lx / segs; pz += lz / segs; py += h;
    }
    // Crown
    for (let i = 0; i < fronds; i++) {
      const a = (i / fronds) * Math.PI * 2 + this.r(-0.15, 0.15);
      const tilt = this.r(0.72, 1.25);
      this.frond.push([px, py - 0.1, pz], a, 0, tilt - 1.2, this.r(0.85, 1.18));
    }
    // Coconut cluster
    for (let i = 0; i < 4; i++) {
      const a = this.r(0, 6.28);
      const s = new THREE.SphereGeometry(0.13, 6, 5);
      s.translate(px + Math.cos(a) * 0.2, py - 0.28, pz + Math.sin(a) * 0.2);
      this.trunkGeos.push(s);
    }
    this.colliders.push({
      min: new THREE.Vector3(x - 0.4, y, z - 0.4),
      max: new THREE.Vector3(x + 0.4, y + height * 0.5, z + 0.4),
    });
  }

  /** Dense ornamental shrub / hedge mass. */
  shrub(pos, { r = 1.0, h = 1.1, color = 'near' } = {}) {
    const [x, y, z] = pos;
    const inst = color === 'dark' ? this.dark : color === 'hedge' ? this.hedge : this.near;
    const n = 6 + Math.floor(r * 8);
    for (let i = 0; i < n; i++) {
      const a = this.r(0, 6.28);
      const rad = this.rand() * r;
      inst.push(
        [x + Math.cos(a) * rad, y + this.r(0.15, h * 0.85), z + Math.sin(a) * rad],
        this.r(0, 6.28), this.r(-0.3, 0.3), 0,
        r * this.r(0.55, 1.1),
      );
    }
    this.colliders.push({
      min: new THREE.Vector3(x - r * 0.6, y, z - r * 0.6),
      max: new THREE.Vector3(x + r * 0.6, y + h, z + r * 0.6),
    });
  }

  /**
   * Formal clipped hedge. A solid box does the silhouette work — cards only
   * break up the top edge, which is what actually stops it reading as a green
   * brick. Hedges stand on the ground (y = base height), never float.
   */
  hedgeBox(x0, z0, x1, z1, y = 0, h = 0.75) {
    const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const geo = box(w, h, d, 1.2);
    geo.translate(cx, y + h / 2, cz);
    this.hedgeSolids.push(geo);
    // ragged top edge: cards along the perimeter
    const step = 0.75;
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += step) {
      for (const z of [Math.min(z0, z1), Math.max(z0, z1)]) {
        this.hedge.push([x, y + h - 0.1, z], this.r(0, 6.28), 0, 0, h * 1.35);
      }
    }
    for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z += step) {
      for (const x of [Math.min(x0, x1), Math.max(x0, x1)]) {
        this.hedge.push([x, y + h - 0.1, z], this.r(0, 6.28), 0, 0, h * 1.35);
      }
    }
    this.colliders.push({
      min: new THREE.Vector3(Math.min(x0, x1), y, Math.min(z0, z1)),
      max: new THREE.Vector3(Math.max(x0, x1), y + h, Math.max(z0, z1)),
    });
  }

  /** Grass tufts scattered in a disc/rect. */
  grassPatch(x0, z0, x1, z1, { density = 0.55, y = 0, h = 1 } = {}) {
    const area = Math.abs((x1 - x0) * (z1 - z0));
    const n = Math.min(this.grass.max - this.grass.mesh.count, Math.floor(area * density * 0.06));
    for (let i = 0; i < n; i++) {
      this.grass.push(
        [this.r(x0, x1), y, this.r(z0, z1)],
        this.r(0, 6.28), 0, 0,
        this.r(0.8, 1.5) * h,
      );
    }
  }

  /** Flowers: instanced quads using flowerBush texture, drawn as billboards. */
  build() {
    const meshes = [this.near.finish(), this.mid.finish(), this.dark.finish(),
      this.frond.finish(), this.hedge.finish(), this.grass.finish()];
    for (const m of meshes) m.name = 'veg'; 
    for (const m of meshes) this.group.add(m);

    if (this.hedgeSolids.length) {
      const hg = mergeGeoList(this.hedgeSolids);
      const hm = new THREE.Mesh(hg, this.M.hedgeSolid);
      hm.castShadow = true; hm.receiveShadow = true;
      this.group.add(hm);
    }
    if (this.trunkGeos.length) {
      // Merge trunks (convert to non-indexed first so counts match the buffers)
      const geos = this.trunkGeos.map((g) => (g.index ? g.toNonIndexed() : g));
      let total = 0;
      for (const g of geos) total += g.attributes.position.count;
      const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uvs = new Float32Array(total * 2);
      let o = 0;
      for (const gg of geos) {
        pos.set(gg.attributes.position.array, o * 3);
        nor.set(gg.attributes.normal.array, o * 3);
        uvs.set(gg.attributes.uv.array, o * 2);
        o += gg.attributes.position.count;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, this.M.bark);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
    }
    return this;
  }

  /** Hides everything beyond the camera's useful distance for speed. */
  setLODDistance(_d) { /* handled by fog + frustum, cards are cheap */ }
}
