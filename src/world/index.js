/**
 * World assembler.
 *
 * Builds every static structure once, collects colliders, places vegetation,
 * and returns a handle the game loop can query.
 */
import * as THREE from 'three';
import { buildMaterials } from '../materials/library.js';
import { buildGround, rect, disc } from './ground.js';
import { buildChurch, CHURCH } from './church.js';
import { buildMainBuilding, MAIN } from './dct-main.js';
import { buildGate, GATE } from './gate.js';
import { Vegetation } from './vegetation.js';
import { TreeKit } from './trees.js';
import { Builder, box, cylinder, sphere, TEXSCALE } from './kit.js';
import { buildTown } from './town.js';
import { buildTerrain } from './terrain.js';
import { L } from './layout.js';

function kitColliders(list) {
  return list.map((c) => ({ min: c.min, max: c.max }));
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = 'world';
    scene.add(this.root);
    this.colliders = [];
    this.interactables = [];
    this.places = [];
    this.M = null;
    this.stats = {};
  }

  async build(onProgress = () => {}) {
    const t0 = performance.now();
    const scene = this.scene;

    onProgress(0.04, 'mixing materials');
    this.M = buildMaterials();
    const M = this.M;

    onProgress(0.12, 'shaping the plain');
    buildTerrain(this.root, M);

    onProgress(0.20, 'laying ground');
    const ground = buildGround(this.root, M);

    onProgress(0.30, 'raising the shrine');
    const church = buildChurch(this.root, M, { nightMode: false });
    this.colliders.push(...church.colliders);

    onProgress(0.48, 'framing the main building');
    const main = buildMainBuilding(this.root, M);
    this.colliders.push(...main.colliders);

    onProgress(0.62, 'setting the gate');
    const gate = buildGate(this.root, M);
    this.colliders.push(...gate.colliders);

    onProgress(0.70, 'modelling the plaza');
    this.buildPlazaExtras(M);

    onProgress(0.74, 'building the poblacion');
    buildTown(this.root, M);

    onProgress(0.80, 'planting');
    this.plantVegetation(M);

    onProgress(0.94, 'finishing');
    this.registerPlaces();
    this.stats.buildMs = Math.round(performance.now() - t0);
    onProgress(1.0, 'ready');
    return this;
  }

  /* ---------------------------------------------------------------- plaza */
  buildPlazaExtras(M) {
    const b = new Builder('plaza');
    const PZ = L.plaza.cz, PX = L.plaza.cx;

    /* ---------------------------------------------------- central fountain */
    const R = 4.2;
    b.add(cylinder(R + 0.5, R + 0.7, 0.55, 28), 'concreteTrim', { pos: [PX, 0.27, PZ], collide: true });
    b.add(cylinder(R, R, 0.42, 28), 'concreteDark', { pos: [PX, 0.55, PZ] });
    b.add(cylinder(R - 0.35, R - 0.35, 0.06, 28), 'water', { pos: [PX, 0.62, PZ] });
    // tiered centre
    b.add(cylinder(0.8, 1.1, 1.1, 14), 'concreteTrim', { pos: [PX, 1.15, PZ] });
    b.add(cylinder(1.5, 1.6, 0.16, 20), 'concreteTrim', { pos: [PX, 1.75, PZ] });
    b.add(cylinder(0.42, 0.55, 1.0, 12), 'concreteTrim', { pos: [PX, 2.3, PZ] });
    b.add(sphere(0.42, 12), 'statue', { pos: [PX, 3.15, PZ] });
    // water jets (thin cones, cheap)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.add(cylinder(0.02, 0.05, 1.2, 5), 'water', {
        pos: [PX + Math.cos(a) * 1.1, 2.4, PZ + Math.sin(a) * 1.1],
        rot: [Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3],
      });
    }

    /* -------------------------------------------------- plaza lamp posts */
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const lx = PX + Math.cos(a) * 12.5;
      const lz = PZ + Math.sin(a) * 12.5;
      b.add(cylinder(0.07, 0.12, 3.6, 8), 'ironDark', { pos: [lx, 1.8, lz], collide: true });
      b.add(box(0.34, 0.1, 0.34, 1), 'ironDark', { pos: [lx, 3.7, lz] });
      b.add(box(0.3, 0.42, 0.3, 1), 'glassLit', { pos: [lx, 3.95, lz] });
      b.add(cylinder(0.06, 0.2, 0.22, 8), 'ironDark', { pos: [lx, 4.24, lz] });
    }

    /* -------------------------------------------- benches around the plaza */
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.4;
      const bx = PX + Math.cos(a) * 17.5;
      const bz = PZ + Math.sin(a) * 17.5;
      const rot = -a;
      // seat + back + legs
      b.add(box(2.0, 0.09, 0.5, 1), 'wood', { pos: [bx, 0.46, bz], rot: [0, rot, 0] });
      b.add(box(2.0, 0.42, 0.07, 1), 'wood', { pos: [bx, 0.7, bz], rot: [0, rot, 0] });
      for (const s of [-0.78, 0.78]) {
        b.add(box(0.08, 0.46, 0.46, 1), 'concreteDark', {
          pos: [bx + Math.cos(rot) * s, 0.23, bz - Math.sin(rot) * s], rot: [0, rot, 0],
        });
      }
      b.addCollider([bx - 1.1, 0, bz - 0.6], [bx + 1.1, 0.9, bz + 0.6]);
    }

    /* --------------------------------------------- Jose Rizal monument */
    {
      const rx = PX + 15.0, rz = PZ + 10.0;
      b.add(box(2.6, 0.5, 2.6, 1.4), 'concreteTrim', { pos: [rx, 0.25, rz], collide: true });
      b.add(box(2.0, 2.2, 2.0, 1.4), 'rockFace', { pos: [rx, 1.6, rz] });
      b.add(box(1.2, 0.35, 1.2, 1.2), 'concreteTrim', { pos: [rx, 2.85, rz] });
      // Stylised standing figure
      b.add(cylinder(0.26, 0.34, 1.5, 10), 'statueRobed', { pos: [rx, 3.75, rz] });
      b.add(cylinder(0.24, 0.26, 0.62, 10), 'statueRobed', { pos: [rx, 4.8, rz] });
      b.add(sphere(0.17, 10), 'statue', { pos: [rx, 5.2, rz] });
      b.add(box(0.6, 0.9, 0.12, 1), 'woodDark', { pos: [rx + 0.32, 3.4, rz + 0.1], rot: [0, 0, 0.3] });
      b.addCollider([rx - 1.4, 0, rz - 1.4], [rx + 1.4, 5.3, rz + 1.4]);
    }

    /* ------------------------------------------- plaza perimeter balustrade */
    // Low concrete wall + hedge around the park.
    const half = L.plaza.halfX;
    const segs = [
      [PX - half, PZ - half, PX + half, PZ - half],
      [PX - half, PZ + half, PX + half, PZ + half],
    ];
    for (const [x0, z0, x1, z1] of segs) {
      b.add(box(x1 - x0, 0.45, 0.4, 1.6), 'concreteTrim', {
        pos: [(x0 + x1) / 2, 0.22, z0], collide: true,
      });
    }

    /* ------------------------------------------------------- town hall */
    // Capas Municipal Hall: 2 storeys, white with a colonnade and a pediment.
    {
      const hx = L.municipal.x, hz = L.municipal.z - 8, W = 40, D = 16, H = 11.5;
      b.add(box(W, H, D, TEXSCALE.concrete), 'paintWhite', { pos: [hx, H / 2, hz], collide: true });
      // portico columns
      for (let i = 0; i < 8; i++) {
        const x = hx - W / 2 + 3 + i * (W - 6) / 7;
        const cp = cylinder(0.42, 0.46, 6.4, 14);
        b.addGeo(cp.clone().translate(x, 3.2, hz + D / 2 + 2.4), 'paintWhite');
        b.add(box(1.1, 0.3, 1.1, 1), 'paintWhite', { pos: [x, 0.15, hz + D / 2 + 2.4] });
      }
      b.add(box(W + 1.2, 0.7, 5.4, 2), 'paintWhite', { pos: [hx, 6.9, hz + D / 2 + 2.0] });
      // pediment
      const shape = new THREE.Shape();
      shape.moveTo(-W / 2, 0); shape.lineTo(W / 2, 0); shape.lineTo(0, 3.4); shape.closePath();
      const ped = new THREE.ExtrudeGeometry(shape, { depth: 1.0, bevelEnabled: false });
      ped.translate(hx, 7.2, hz + D / 2 + 1.2);
      b.addGeo(ped, 'paintWhite');
      // roof
      b.add(box(W + 1.6, 0.5, D + 1.6, 2), 'roofGray', { pos: [hx, H + 0.2, hz] });
      // windows
      for (let f = 0; f < 2; f++) {
        for (let i = 0; i < 9; i++) {
          const x = hx - W / 2 + 2.4 + i * (W - 4.8) / 8;
          b.add(box(1.1, 1.6, 0.1, 1), 'glassDark', { pos: [x, 2.6 + f * 3.3, hz + D / 2 + 0.06] });
        }
      }
      // steps
      for (let i = 0; i < 4; i++) {
        b.add(box(12, 0.16, 0.5, 2), 'concreteTrim', { pos: [hx, 0.08 + i * 0.16, hz + D / 2 + 4.2 - i * 0.5] });
      }
    }

    /* --------------------------------------- covered court (behind DCT) */
    {
      const cx = L.coveredCourt.x, cz = L.coveredCourt.z, W = 34, D = 26, H = 8.5;
      for (let i = 0; i <= 6; i++) {
        const x = cx - W / 2 + (i * W) / 6;
        for (const sz of [-D / 2, D / 2]) {
          b.add(cylinder(0.14, 0.16, H, 8), 'steel', { pos: [x, H / 2, cz + sz], collide: true });
        }
      }
      for (let i = 0; i <= 4; i++) {
        const z = cz - D / 2 + (i * D) / 4;
        b.add(box(W + 1.0, 0.12, 0.14, 1), 'steel', { pos: [cx, H - 0.05, z] });
      }
      const roofParts = new THREE.Group();
      b.add(box(W + 2.0, 0.14, D + 2.0, 2), 'galv', { pos: [cx, H + 0.2, cz] });
      // low parapet
      for (const [dx, dz, w2, d2] of [[0, -D / 2 - 0.9, W + 2, 0.15], [0, D / 2 + 0.9, W + 2, 0.15],
                                      [-W / 2 - 0.9, 0, 0.15, D + 2], [W / 2 + 0.9, 0, 0.15, D + 2]]) {
        b.add(box(w2, 0.45, d2, 2), 'galv', { pos: [cx + dx, H + 0.45, cz + dz] });
      }
      // court floor (green/terracotta)
      b.addGeo(rect(cx - W / 2 + 0.4, cz - D / 2 + 0.4, cx + W / 2 - 0.4, cz + D / 2 - 0.4, 0.06, 4), 'courtFloor');
    }

    /* --------------------------------------------------- covered walkways */
    // A spine of covered walkway from the gate to the main building, then
    // branches to the church and around the yard. Classic Philippine campus.
    const walk = (x0, z0, x1, z1, h = 3.2) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const ang = Math.atan2(z1 - z0, x1 - x0);
      const n = Math.max(2, Math.round(len / 4.0));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
        for (const s of [-1.3, 1.3]) {
          const ox = Math.cos(ang + Math.PI / 2) * s;
          const oz = Math.sin(ang + Math.PI / 2) * s;
          b.add(box(0.14, h, 0.14, 1), 'paintCream', { pos: [x + ox, h / 2, z + oz] });
        }
      }
      // roof
      const g = box(len + 0.6, 0.1, 3.2, 1.4);
      g.rotateY(-ang);
      g.translate((x0 + x1) / 2, h + 0.06, (z0 + z1) / 2);
      b.addGeo(g, 'roofRib');
      // beams
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
        const beam = box(0.12, 0.14, 2.9, 1);
        beam.rotateY(-ang);
        beam.translate(x, h - 0.12, z);
        b.addGeo(beam, 'paintCream');
      }
    };
    walk(-18.0, 23.0, -52.0, 23.0);
    walk(-52.0, 23.0, -96.0, 23.0);
    walk(-52.0, 23.0, -52.0, 4.0);
    walk(-52.0, 23.0, -60.0, 46.0);
    walk(-88.0, 6.0, -88.0, -34.0);

    const signs = b.signs || [];
    b.buildInto(this.root, M);
  }

  /* ---------------------------------------------------------- vegetation */
  plantVegetation(M) {
    const kit = new TreeKit(M, 20241123);
    const trees = new THREE.Group();
    trees.name = 'trees';
    this.root.add(trees);
    const addTree = (spec) => {
      const res = spec.palm
        ? kit.palm([spec.x, 0, spec.z], spec)
        : kit.broadleaf([spec.x, 0, spec.z], spec);
      if (res?.collider) this.treeColliders.push(res.collider);
    };
    this.treeColliders = [];
    const veg = new Vegetation(this.root, M, 20241123);

    // ---- campus trees along the frontage and yard
    const campusTrees = [
      // Along the highway frontage, framing the gate
      [14, -22, 9.0], [14, -8, 8.5], [14, 8, 9.5], [14, 24, 8.0],
      // Inside the yard, either side of the main axis
      [-4, -20, 9.5], [-18, -18, 8.5], [-4, 30, 9.0], [-18, 32, 8.5],
      [-36, -20, 10.0], [-36, 32, 9.0],
      // Behind the main building
      [-104, -20, 10.0], [-104, 34, 9.5],
      // Campus north edge, toward the shrine
      [-52, -22, 9.0], [-70, -20, 8.5],
    ];
    for (const [x, z, h] of campusTrees) addTree({ x, z, height: h, spread: h * 0.52 });

    // ---- palms flanking the main building entrance & church
    for (const [x, z] of [
      [-74, -20], [-58, -20], [-40, -22], [-22, -24],   // shrine approach
      [-44, -40], [-44, -60], [-44, -78],               // shrine forecourt
      [-2, 16], [-2, 30], [-14, 16], [-14, 30],         // yard
      [10, 44], [-8, 44],                               // frontage road
    ]) {
      addTree({ x, z, palm: true, height: 8.5 + (Math.abs(x) % 3) });
    }

    // ---- plaza trees: ring inside the park
    const PX = L.plaza.cx, PZ = L.plaza.cz;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + 0.2;
      const rr = 22 + (i % 3) * 1.4;
      addTree({
        x: PX + Math.cos(a) * rr, z: PZ + Math.sin(a) * rr,
        height: 11 + (i % 4) * 1.3, spread: 5.4, kind: i % 3 === 0 ? 'dark' : 'near',
      });
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.6;
      addTree({ x: PX + Math.cos(a) * 16.5, z: PZ + Math.sin(a) * 16.5, palm: true, height: 9.4 });
    }

    // ---- hedges: plaza border + church forecourt + campus
    const ph = L.plaza.halfX;
    const hz = L.plaza.halfZ;
    veg.hedgeBox(PX - ph + 1.2, PZ + hz - 1.6, PX + ph - 1.2, PZ + hz - 0.4, 0, 0.75);
    veg.hedgeBox(PX - ph + 1.2, PZ - hz + 0.4, PX + ph - 1.2, PZ - hz + 1.6, 0, 0.75);
    veg.hedgeBox(PX - ph + 0.4, PZ - hz + 1.6, PX - ph + 1.6, PZ + hz - 1.6, 0, 0.75);
    veg.hedgeBox(PX + ph - 1.6, PZ - hz + 1.6, PX + ph - 0.4, PZ + hz - 1.6, 0, 0.75);
    veg.hedgeBox(-46, -66, -30, -64.6, 0, 0.7);

    // ---- shrubs / flower beds at the church portico & the gate island
    for (const [x, z, r] of [[-50, -36, 1.3], [-50, -66, 1.2], [-40, -30, 1.4], [-40, -74, 1.2],
                             [L.gate.x + 5.5, L.gate.z + 3.0, 0.8],
                             [L.gate.x + 8.0, L.gate.z - 3.0, 0.8],
                             [L.gate.x + 6.6, L.gate.z, 0.9]]) {
      veg.shrub([x, 0, z], { r, h: 1.0 });
    }

    // ---- grass tufts on lawns
    veg.grassPatch(-34, -20, -12, 6, { density: 1.0 });
    veg.grassPatch(-34, 14, -12, 40, { density: 1.0 });
    veg.grassPatch(-30, -24, 18, -12, { density: 0.9 });
    veg.grassPatch(-70, -30, -30, -24, { density: 0.8 });
    veg.grassPatch(PX - ph, PZ - hz, PX + ph, PZ + hz, { density: 0.4 });

    // Street trees along the highway + the market square
    for (let z = -260; z < 260; z += 26) {
      if (Math.abs(z - L.frontageRoad.z) < 10) continue;
      addTree({ x: -13.5, z, height: 8.5 + (Math.abs(z) % 5) * 0.6, spread: 3.6, kind: 'mid' });
      addTree({ x: 13.5, z: z + 13, height: 8.0 + (Math.abs(z) % 4) * 0.7, spread: 3.4, kind: 'mid' });
    }
    for (let i = 0; i < 8; i++) {
      addTree({ x: 22 + i * 3.2, z: 96, palm: true, height: 9.0 });
    }

    kit.build(trees);
    veg.build();
    this.vegetation = veg;
    this.colliders.push(...kitColliders(this.treeColliders));
    this.colliders.push(...veg.colliders.filter((c) => (c.max.x - c.min.x) > 0.5));
  }

  /* ------------------------------------------------------------- places */
  registerPlaces() {
    this.places = [
      { id: 'gate', name: 'DCT Main Gate', sub: 'MacArthur Highway', pos: [0, 0, -1], view: [0, 1.7, 18] },
      { id: 'campus', name: 'DCT Campus Yard', pos: [-10, 0, 14], view: [-40, 2.0, 8] },
      { id: 'church', name: 'San Nicolas de Tolentino', sub: 'Diocesan Shrine', pos: [-74, 0, 22], view: [-74, 3.0, 8] },
      { id: 'plaza', name: 'Capas Town Plaza', pos: [-46, 0, -40], view: [-46, 2.0, -60] },
      { id: 'hall', name: 'Capas Municipal Hall', pos: [10, 0, -80], view: [10, 2.0, -88] },
    ];
  }

  /** Simple capsule-vs-AABB collision resolve in XZ. */
  resolveCollisions(pos, radius = 0.34) {
    for (const c of this.colliders) {
      if (pos.y > c.max.y + 0.1 || pos.y + 1.7 < c.min.y) continue;
      const cx = Math.max(c.min.x, Math.min(pos.x, c.max.x));
      const cz = Math.max(c.min.z, Math.min(pos.z, c.max.z));
      const dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        const d = Math.sqrt(d2) || 1e-4;
        const push = (radius - d) / d;
        if (d2 > 1e-8) { pos.x += dx * push; pos.z += dz * push; }
        else {
          // inside the box: push out along the shortest axis
          const dl = pos.x - c.min.x, dr = c.max.x - pos.x;
          const db = pos.z - c.min.z, df = c.max.z - pos.z;
          const m = Math.min(dl, dr, db, df);
          if (m === dl) pos.x = c.min.x - radius;
          else if (m === dr) pos.x = c.max.x + radius;
          else if (m === db) pos.z = c.min.z - radius;
          else pos.z = c.max.z + radius;
        }
      }
    }
  }

  /** Ground height at a point (flat site → mostly 0, with kerb offsets). */
  groundAt(x, z) {
    return 0.0;
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
  }
}
