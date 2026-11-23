/**
 * Tree builder.
 *
 * The broadleaf canopy here is the biggest visual win available: Philippine
 * acacia, mango and narra form dense, wide, slightly flattened crowns. We get
 * that from three layers:
 *
 *   1. An opaque inner "core" blob (low-poly sphere, dark green) which gives
 *      the crown real silhouette and cheap self-shadowing.
 *   2. A ring of alpha-tested leaf cards on the surface, sorted largest-first,
 *      so the crown has a ragged edge.
 *   3. A few cards poking out of the bottom for the "hanging" look.
 *
 * Trunks get genuine taper, buttress flare, and 3–5 limbs that visibly enter
 * the crown rather than stopping short of it.
 */
import * as THREE from 'three';

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export class TreeKit {
  constructor(M, seed = 4242) {
    this.M = M;
    this.r = rng(seed);
    this.coreGeos = [];       // merged later
    this.trunkGeos = [];
    this.cards = { near: [], mid: [], dark: [], frond: [], palmTrunk: [] };
  }

  rr(a = 0, b = 1) { return a + this.r() * (b - a); }

  /* ------------------------------------------------------------- broadleaf */
  /**
   * @param {number[]} pos world [x, y, z]
   * @param {object} o   height, spread, kind (near|mid|dark), seed
   */
  broadleaf(pos, o = {}) {
    const [x, y, z] = pos;
    const H = o.height ?? 10;
    const R = o.spread ?? H * 0.46;
    const kind = o.kind ?? 'near';
    const r = rng(Math.floor((x * 733 + z * 977 + H * 31) | 0) || 1);

    // ---- trunk: taper + slight lean + buttress
    const trunkH = H * 0.62;
    const segs = 5;
    let px = x, pz = z, py = y, rad = H * 0.030;
    const leanX = (r() - 0.5) * H * 0.045;
    const leanZ = (r() - 0.5) * H * 0.045;
    const trunkPts = [];
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs, t1 = (i + 1) / segs;
      const h = trunkH / segs;
      const r0 = rad * (1 - t0 * 0.45);
      const r1 = rad * (1 - t1 * 0.5);
      const g = new THREE.CylinderGeometry(r1, r0 * 1.03, h * 1.02, i === 0 ? 10 : 7, 1, true);
      g.translate(px + leanX * t0, py + h / 2, pz + leanZ * t0);
      this.trunkGeos.push(g);
      trunkPts.push([px + leanX * t1, py + h, pz + leanZ * t1]);
      px += leanX / segs; pz += leanZ / segs; py += h;
    }
    // buttress roots
    const nBut = 4 + Math.floor(r() * 3);
    for (let i = 0; i < nBut; i++) {
      const a = (i / nBut) * Math.PI * 2 + r() * 0.5;
      const g = new THREE.CylinderGeometry(rad * 0.18, rad * 0.55, H * 0.12, 5);
      g.rotateZ(Math.cos(a) * 0.32);
      g.rotateX(-Math.sin(a) * 0.32);
      g.translate(x + Math.cos(a) * rad * 1.5, y + H * 0.055, z + Math.sin(a) * rad * 1.5);
      this.trunkGeos.push(g);
    }
    // ---- limbs reaching into the crown
    const nLimb = 4 + Math.floor(r() * 3);
    const crownY = y + trunkH + R * 0.35;
    for (let i = 0; i < nLimb; i++) {
      const a = (i / nLimb) * Math.PI * 2 + r() * 0.7;
      const len = R * (0.75 + r() * 0.5);
      const rise = H * (0.12 + r() * 0.14);
      const g = new THREE.CylinderGeometry(rad * 0.12, rad * 0.42, len, 5, 1, true);
      g.translate(0, len / 2, 0);
      g.rotateZ(-(Math.PI / 2 - 0.62) * (0.6 + r() * 0.5));
      g.rotateY(a);
      g.translate(px, crownY - R * 0.45, pz);
      // raise the far end so limbs arc up rather than droop
      g.translate(0, rise * 0.45, 0);
      this.trunkGeos.push(g);
    }

    // ---- opaque core blob(s): real volume, self-shadowing
    const blobs = 2 + Math.floor(r() * 2);
    for (let i = 0; i < blobs; i++) {
      const br = R * (0.62 + r() * 0.22);
      const g = new THREE.SphereGeometry(1, 12, 9);
      g.scale(br * 1.05, br * (0.62 + r() * 0.12), br);
      const ox = (r() - 0.5) * R * 0.5, oz = (r() - 0.5) * R * 0.5;
      g.translate(px + ox, crownY + (r() - 0.4) * R * 0.3, pz + oz);
      // Displace vertices a little so the blob isn't a perfect sphere.
      const p = g.attributes.position;
      for (let k = 0; k < p.count; k++) {
        const jx = (r() - 0.5) * br * 0.14;
        const jy = (r() - 0.5) * br * 0.14;
        const jz = (r() - 0.5) * br * 0.14;
        p.setXYZ(k, p.getX(k) + jx, p.getY(k) + jy, p.getZ(k) + jz);
      }
      this.coreGeos.push({ geo: g, kind });
    }

    // ---- alpha cards across the crown surface
    const nCards = Math.round(22 + R * 4.5);
    for (let i = 0; i < nCards; i++) {
      // distribute on an ellipsoid, biased to the outer shell
      const u = r(), v = r();
      const th = u * Math.PI * 2;
      const ph = Math.acos(2 * v - 1);
      const shell = 0.62 + Math.pow(r(), 0.5) * 0.42;
      const rx = R * shell, ry = R * 0.68 * shell;
      const cx = px + Math.sin(ph) * Math.cos(th) * rx;
      const cz = pz + Math.sin(ph) * Math.sin(th) * rx;
      const cy = crownY + Math.cos(ph) * ry;
      const sc = R * (0.42 + r() * 0.42);
      this.cards[kind].push({
        p: [cx, cy, cz],
        rot: [r() * 6.28, (r() - 0.5) * 0.9, (r() - 0.5) * 0.9],
        s: sc,
      });
    }
    // a couple of low hanging clusters
    for (let i = 0; i < 3; i++) {
      const a = r() * 6.28;
      this.cards[kind].push({
        p: [px + Math.cos(a) * R * 0.6, crownY - R * 0.55, pz + Math.sin(a) * R * 0.6],
        rot: [r() * 6.28, (r() - 0.5) * 0.5, 0],
        s: R * 0.42,
      });
    }

    return {
      collider: {
        min: new THREE.Vector3(x - rad * 2.2, y, z - rad * 2.2),
        max: new THREE.Vector3(x + rad * 2.2, y + trunkH, z + rad * 2.2),
      },
    };
  }

  /* ------------------------------------------------------------------ palm */
  palm(pos, o = {}) {
    const [x, y, z] = pos;
    const H = o.height ?? 9;
    const r = rng(Math.floor((x * 311 + z * 719) | 0) || 7);
    const dir = r() * 6.28;
    const lean = H * (0.05 + r() * 0.1);
    const lx = Math.cos(dir) * lean, lz = Math.sin(dir) * lean;
    const segs = 8;
    let px = x, pz = z, py = y;
    for (let i = 0; i < segs; i++) {
      const t = i / segs;
      const h = H / segs;
      const rad = H * 0.024 * (1 - t * 0.4);
      const g = new THREE.CylinderGeometry(rad * 0.88, rad, h * 1.03, 8, 1, true);
      g.translate(px, py + h / 2, pz);
      this.trunkGeos.push(g);
      // node ring
      const ring = new THREE.CylinderGeometry(rad * 1.18, rad * 1.18, h * 0.09, 8);
      ring.translate(px, py + h * 0.15, pz);
      this.trunkGeos.push(ring);
      px += lx / segs; pz += lz / segs; py += h;
    }
    // crown boots
    const boot = new THREE.SphereGeometry(H * 0.035, 8, 6);
    boot.translate(px, py, pz);
    this.trunkGeos.push(boot);

    const nF = 12 + Math.floor(r() * 5);
    for (let i = 0; i < nF; i++) {
      const a = (i / nF) * Math.PI * 2 + r() * 0.25;
      const tilt = 0.55 + r() * 0.8;
      this.cards.frond.push({
        p: [px, py - 0.15, pz],
        rot: [a, tilt - 1.1, (r() - 0.5) * 0.25],
        s: (H / 9) * (0.85 + r() * 0.35),
      });
    }
    // dead fronds hanging below
    for (let i = 0; i < 4; i++) {
      this.cards.frond.push({
        p: [px, py - 0.5, pz],
        rot: [r() * 6.28, 1.35, 0],
        s: (H / 9) * 0.7,
      });
    }
    return {
      collider: {
        min: new THREE.Vector3(x - H * 0.03, y, z - H * 0.03),
        max: new THREE.Vector3(x + H * 0.03, y + H * 0.6, z + H * 0.03),
      },
    };
  }

  /* --------------------------------------------------------------- output */
  /** Builds merged meshes and returns them (add to a group). */
  build(parent) {
    const out = [];
    const M = this.M;

    // trunks
    if (this.trunkGeos.length) {
      const geo = mergeList(this.trunkGeos);
      const m = new THREE.Mesh(geo, M.bark);
      m.castShadow = true; m.receiveShadow = true;
      parent.add(m); out.push(m);
    }

    // crown cores, split by kind so they can use different greens
    const byKind = groupBy(this.coreGeos, (c) => c.kind);
    const coreMats = { near: M.leafCoreNear, mid: M.leafCoreMid, dark: M.leafCoreDark };
    for (const [kind, list] of Object.entries(byKind)) {
      const geo = mergeList(list.map((c) => c.geo));
      const m = new THREE.Mesh(geo, coreMats[kind] || M.leafCoreNear);
      m.castShadow = true; m.receiveShadow = true;
      parent.add(m); out.push(m);
    }

    // cards → InstancedMesh per species
    const cardGeo = new THREE.PlaneGeometry(1, 1);
    const frondGeo = new THREE.PlaneGeometry(2.0, 3.2);
    frondGeo.translate(0, 1.55, 0);
    const mats = { near: M.leafNear, mid: M.leafMid, dark: M.leafDark, frond: M.frond };
    for (const [kind, list] of Object.entries(this.cards)) {
      if (!list.length) continue;
      const im = new THREE.InstancedMesh(kind === 'frond' ? frondGeo : cardGeo, mats[kind], list.length);
      im.castShadow = true;
      im.receiveShadow = false;
      const mtx = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      const v = new THREE.Vector3();
      const sc = new THREE.Vector3();
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        // fronds are authored as a 1.9 × 3.6 plane anchored at the base, so
        // they need to be scaled differently from square crown cards
        if (kind === 'frond') {
          e.set(c.rot[1], c.rot[0], c.rot[2], 'YXZ');
          q.setFromEuler(e);
          v.set(c.p[0], c.p[1], c.p[2]);
          sc.set(c.s, c.s, c.s);
        } else {
          e.set(c.rot[1], c.rot[0], c.rot[2], 'YXZ');
          q.setFromEuler(e);
          v.set(c.p[0], c.p[1], c.p[2]);
          sc.set(c.s, c.s, c.s);
        }
        mtx.compose(v, q, sc);
        im.setMatrixAt(i, mtx);
      }
      im.instanceMatrix.needsUpdate = true;
      im.frustumCulled = false;
      parent.add(im); out.push(im);
    }
    return out;
  }
}

function mergeList(geos) {
  const nonIdx = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let total = 0;
  for (const g of nonIdx) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
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

function groupBy(arr, key) {
  const m = {};
  for (const it of arr) {
    const k = key(it);
    (m[k] ||= []).push(it);
  }
  return m;
}
