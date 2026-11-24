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
import { classroomBlock } from './dct-blocks.js';
import { Vegetation } from './vegetation.js';
import { TreeKit } from './trees.js';
import { put } from './place.js';
import { Builder, box, cylinder, sphere, TEXSCALE } from './kit.js';
import { buildTown } from './town.js';
import { buildTerrain } from './terrain.js';
import { L, SCOPE } from './layout.js';

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

    /**
     * Per-stage timings. Without these, a build that has doubled in cost is
     * indistinguishable from one that has not: the only symptom is a slower
     * boot, and guessing which stage is responsible wastes more time than the
     * timer costs. Recorded on world.stats.timings and logged once.
     */
    const timings = {};
    let tPrev = t0;
    const stage = (name) => {
      const now = performance.now();
      timings[name] = Math.round(now - tPrev);
      tPrev = now;
    };

    onProgress(0.04, 'mixing materials');
    this.M = buildMaterials();
    const M = this.M;
    stage('materials');

    onProgress(0.12, 'shaping the plain');
    buildTerrain(this.root, M);

    stage('terrain');

    onProgress(0.20, 'laying ground');
    const ground = buildGround(this.root, M);

    stage('ground');

    onProgress(0.30, 'raising the shrine');
    const church = buildChurch(this.root, M, { nightMode: false });
    this.colliders.push(...church.colliders);

    stage('shrine');

    onProgress(0.48, 'framing the main building');
    const main = buildMainBuilding(this.root, M);
    this.colliders.push(...main.colliders);

    /**
     * Classroom blocks flanking the gate.
     *
     * The campus photographs show these as the dominant frontage element:
     * blue-and-white buildings with OPEN CORRIDORS facing the road, a deep blue
     * band at each floor line and blue sheet roofs. They stand either side of
     * the entrance drive, set back enough to leave the gate forecourt open.
     *
     * Corridors face WEST, toward the gate and the highway, so the open walkways
     * are the first thing you see coming through the gate — which is the view in
     * the reference photographs.
     */
    {
      const blocks = [
        // North of the gate, running N-S along the frontage.
        { x: 33.0, z: -16.0, rotY: -Math.PI / 2, len: 36, depth: 13, floors: 3, floorH: 3.6 },
        // South of the gate, shorter — the covered court takes the ground further south.
        { x: 34.0, z: 20.0, rotY: -Math.PI / 2, len: 22, depth: 13, floors: 2, floorH: 3.7 },
        // A laboratory wing set back behind the north block.
        { x: 44.0, z: -34.0, rotY: Math.PI, len: 18, depth: 11, floors: 2, floorH: 3.6 },
      ];
      for (const o of blocks) {
        // A fresh builder per block: Builder merges everything in its bins into
        // one mesh per material, so sharing one across blocks would fuse them.
        const bl = new Builder(`block-${o.x}`);
        classroomBlock(bl, M, { ...o, corridor: 1 });
        const bg = new THREE.Group();
        bg.name = `dct-block-${o.x}`;
        this.root.add(bg);
        bl.buildInto(bg, M);
        // Colliders come back in world space, like every other structure's.
        this.colliders.push(...bl.colliders);
      }
    }

    stage('mainBuilding');

    onProgress(0.62, 'setting the gate');
    const gate = buildGate(this.root, M);
    this.colliders.push(...gate.colliders);

    stage('gate');

    onProgress(0.70, 'modelling the plaza');
    this.buildPlazaExtras(M);

    stage('plaza');

    onProgress(0.74, 'building the poblacion');
    buildTown(this.root, M);

    stage('town');

    onProgress(0.80, 'planting');
    this.plantVegetation(M);

    onProgress(0.94, 'finishing');
    this.registerPlaces();
    this.stats.buildMs = Math.round(performance.now() - t0);
    stage('vegetation');
    this.stats.timings = timings;
    this.stats.buildMs = Math.round(performance.now() - t0);
    console.log('[build] timings', JSON.stringify(timings), 'total', this.stats.buildMs);
    onProgress(1.0, 'ready');
    return this;
  }

  /* ---------------------------------------------------------------- plaza */
  buildPlazaExtras(M) {
    const b = new Builder('plaza');
    const PZ = L.plaza.cz, PX = L.plaza.cx;

    /* ---------------------------------------------------- central fountain */
    // A modest municipal fountain: low octagonal basin, one raised bowl, and a
    // slim finial. The reference plaza has nothing monumental here — keeping it
    // small is what makes the shrine behind it read tall.
    const RB = 3.1;
    b.add(cylinder(RB + 0.42, RB + 0.55, 0.42, 8), 'concreteTrim', { pos: [PX, 0.21, PZ], collide: true });
    // Lined with pale tile: a bare concreteDark cylinder faces away from the sun
    // all day and renders as a black well. See M.basinLiner.
    b.add(cylinder(RB, RB, 0.30, 8), 'basinLiner', { pos: [PX, 0.55, PZ] });
    /**
     * Coping, as an ANNULUS and not a disc.
     *
     * A solid cylinder here is a lid: it caps the basin and the water goes
     * invisible. RingGeometry is flat in XY, so rotateX(-pi/2) lays it down as a
     * horizontal ring.
     */
    {
      const coping = new THREE.RingGeometry(RB - 0.20, RB + 0.02, 8, 1);
      coping.rotateX(-Math.PI / 2);
      coping.translate(PX, 0.755, PZ);
      b.addGeo(coping, 'concreteTrim');
      /**
       * Outer fascia, open at both ends.
       *
       * The kit's `cylinder()` has no openEnded flag, and a capped cylinder here
       * is a LID: a solid disc across the whole basin at y 0.70, which hid the
       * water a second time (the first being the liner's own top cap). A raw
       * CylinderGeometry with openEnded = true is the only way to get a rim that
       * does not close over the bowl.
       */
      const fascia = new THREE.CylinderGeometry(RB + 0.04, RB + 0.06, 0.16, 8, 1, true);
      fascia.translate(PX, 0.70, PZ);
      b.addGeo(fascia, 'concreteTrim');
    }
    /**
     * Water surface ABOVE the liner's top cap.
     *
     * The liner is a capped cylinder, so its top face at y 0.70 is a solid
     * concrete lid across the whole basin — water placed under it is invisible
     * and the fountain reads as an empty pale bowl. The surface belongs a few
     * centimetres above the liner rim, just under the coping.
     */
    b.add(cylinder(RB - 0.22, RB - 0.22, 0.04, 8), 'water', { pos: [PX, 0.735, PZ] });
    // central pedestal + one shallow bowl
    b.add(cylinder(0.44, 0.62, 0.95, 12), 'concreteTrim', { pos: [PX, 1.12, PZ] });
    b.add(cylinder(1.15, 1.22, 0.11, 20), 'concreteTrim', { pos: [PX, 1.62, PZ] });
    b.add(cylinder(0.9, 0.9, 0.04, 20), 'water', { pos: [PX, 1.70, PZ] });
    b.add(cylinder(0.2, 0.28, 0.85, 10), 'concreteTrim', { pos: [PX, 2.05, PZ] });
    // small bronze finial — a saint's silhouette, not a giant ball
    b.add(cylinder(0.16, 0.22, 0.5, 10), 'statueRobed', { pos: [PX, 2.68, PZ] });
    b.add(sphere(0.11, 10), 'statue', { pos: [PX, 3.0, PZ] });
    /**
     * Water: a thin curtain sheet, not tilted cylinders.
     *
     * The jets used to be six `put()` cylinders rotated about their own origins,
     * which swings them bodily out of the basin — at 0.7 m long and 3 cm across
     * they read as a giant pale tube spearing out across the plaza. A short
     * falling sheet from the upper bowl to the lower basin is both cheaper and
     * what a fountain of this size actually looks like.
     */
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rr = 0.88;
      b.add(cylinder(0.012, 0.012, 0.9, 4), 'water',
        { pos: [PX + Math.cos(a) * rr, 1.22, PZ + Math.sin(a) * rr] });
    }
    // still water in the upper bowl, slightly domed
    b.add(cylinder(0.86, 0.46, 0.08, 20), 'water', { pos: [PX, 1.75, PZ] });

    /* -------------------------------------------------- plaza lamp posts */
    const lampPositions = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const lx = PX + Math.cos(a) * 12.5;
      const lz = PZ + Math.sin(a) * 12.5;
      b.add(cylinder(0.07, 0.12, 3.6, 8), 'ironDark', { pos: [lx, 1.8, lz], collide: true });
      b.add(box(0.34, 0.1, 0.34, 1), 'ironDark', { pos: [lx, 3.7, lz] });
      b.add(box(0.3, 0.42, 0.3, 1), 'glassLit', { pos: [lx, 3.95, lz] });
      b.add(cylinder(0.06, 0.2, 0.22, 8), 'ironDark', { pos: [lx, 4.24, lz] });
      lampPositions.push({ x: lx, z: lz });
    }

    /* -------------------------------------------- benches around the plaza */
    const benchPositions = [];
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
      benchPositions.push({ x: bx, z: bz, rot });
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
    /**
     * Capas Municipal Hall: 2 storeys, white with a colonnade and a pediment.
     *
     * OUT OF SCOPE. The brief is the DCT campus, the shrine and the church park;
     * the town hall stands across the highway on the far side of the park and is
     * never part of any view of the three subjects. Kept behind SCOPE.municipal
     * so the portico/pediment work is not thrown away — flip it to true to bring
     * the building back.
     */
    if (SCOPE.municipal) {
      const hx = L.municipal.x, hz = L.municipal.z - 8, W = 40, D = 16, H = 11.5;
      b.add(box(W, H, D, TEXSCALE.concrete), 'paintWhite', { pos: [hx, H / 2, hz], collide: true });
      /**
       * Portico: a free-standing colonnade standing clear of the wall.
       *
       * The columns used to sit at D/2 + 2.4 while the wall face is at D/2, so
       * they were half-buried and the portico read as pilasters painted on a
       * flat box. Pushed to +3.6 and given bases and capitals.
       */
      const PORCH_Z = hz + D / 2 + 3.6;
      for (let i = 0; i < 8; i++) {
        const x = hx - W / 2 + 3 + i * (W - 6) / 7;
        // shaft
        const cp = cylinder(0.40, 0.46, 6.3, 14);
        b.addGeo(cp.clone().translate(x, 3.6, PORCH_Z), 'paintWhite');
        // base and capital
        b.add(box(1.16, 0.34, 1.16, 1), 'paintWhite', { pos: [x, 0.20, PORCH_Z] });
        b.add(box(1.02, 0.26, 1.02, 1), 'paintWhite', { pos: [x, 6.55, PORCH_Z] });
        // flute shadow: two thin dark strips per shaft read as fluting at distance
        for (const q of [-1, 1]) {
          b.add(box(0.05, 6.0, 0.05, 1), 'concreteDark',
            { pos: [x + q * 0.30, 3.6, PORCH_Z + 0.34] });
        }
      }
      // porch roof beams spanning the colonnade
      for (let i = 0; i < 8; i++) {
        const x = hx - W / 2 + 3 + i * (W - 6) / 7;
        b.add(box(0.28, 0.3, 4.2, 1), 'paintWhite', { pos: [x, 6.85, PORCH_Z - 1.3] });
      }
      b.add(box(W - 4.0, 0.26, 4.4, 2), 'paintWhite', { pos: [hx, 7.02, PORCH_Z - 1.4] });
      /**
       * Entablature and pediment.
       *
       * The colonnade stood 2.4 m proud of the wall but the columns were plain
       * cylinders and the pediment was extruded in the wrong plane, so from the
       * front the hall read as a blank white box with slots cut in it — no
       * colonnade, no pediment, nothing civic.
       *
       * ExtrudeGeometry extrudes along +Z, so a Shape drawn in XY already faces
       * the right way for a facade looking down +Z; the depth must be small and
       * the whole thing placed at the front face.
       */
      b.add(box(W + 1.6, 0.8, 6.2, 2), 'paintWhite', { pos: [hx, 7.0, hz + D / 2 + 1.9] });
      const shape = new THREE.Shape();
      shape.moveTo(-W / 2 - 0.8, 0);
      shape.lineTo(W / 2 + 0.8, 0);
      shape.lineTo(0, 3.6);
      shape.closePath();
      const ped = new THREE.ExtrudeGeometry(shape, { depth: 1.4, bevelEnabled: false });
      ped.translate(hx, 7.4, hz + D / 2 + 1.4);
      b.addGeo(ped, 'paintWhite');
      // raking cornice, so the pediment reads as a layered mass
      for (const sgn of [-1, 1]) {
        // Half-width and rise of ONE raking edge, so the cornice lies along the
        // gable slope exactly and stops at the apex and the eave.
        const halfW = W / 2 + 0.8;
        const rise = 3.6;
        const rake = new THREE.BoxGeometry(Math.hypot(halfW, rise) - 0.3, 0.36, 1.7);
        rake.rotateZ(-sgn * Math.atan2(rise, halfW));
        rake.translate(hx + sgn * halfW / 2, 7.4 + rise / 2 + 0.1, hz + D / 2 + 1.55);
        b.addGeo(rake, 'paintWhite');
      }
      // tympanum relief: a small crest disc on the pediment face
      {
        // A cylinder's axis is +Y; rotateX(+pi/2) turns it to face +Z, which is
        // the facade direction. rotateX(-pi/2) faces it backwards and it reads
        // as a dark hole in the pediment.
        const disc = new THREE.CylinderGeometry(0.8, 0.8, 0.18, 24);
        disc.rotateX(Math.PI / 2);
        disc.translate(hx, 8.55, hz + D / 2 + 2.9);
        b.addGeo(disc, 'brass');
        // raised rim so the disc reads as a medallion, not a painted spot
        const rim = new THREE.TorusGeometry(0.82, 0.07, 6, 22);
        rim.translate(hx, 8.55, hz + D / 2 + 3.0);
        b.addGeo(rim, 'brass');
      }
      // roof
      // Flat roof BEHIND the pediment only, so it cannot cut across the gable
      // face. Sized to the body depth and pushed back.
      b.add(box(W + 0.4, 0.5, D + 0.4, 2), 'roofGray', { pos: [hx, H + 0.2, hz - 0.9] });
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
      const cx = L.coveredCourt.x, cz = L.coveredCourt.z;
      const W = L.coveredCourt.w, D = L.coveredCourt.d, H = 8.5;
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
      /**
       * Pitched sheet roof on purlins.
       *
       * A single flat slab of galvanised sheet is the least convincing surface on
       * the whole campus — covered courts in the Philippines are shallow-pitched
       * long-run roofs on exposed steel, and that shallow pitch is exactly what
       * makes them read correctly from a distance.
       */
      {
        const RISE = 1.9;
        const halfD = (D + 2.0) / 2;
        const slope = Math.hypot(halfD, RISE);
        const ang = Math.atan2(RISE, halfD);
        for (const sz of [-1, 1]) {
          // For the +Z panel the eave is at +halfD and the ridge at 0, so Y falls
          // as Z rises: rotateX(+ang).
          const g = new THREE.BoxGeometry(W + 2.0, 0.12, slope);
          g.rotateX(sz * ang);
          g.translate(cx, H + 0.2 + RISE / 2, cz + sz * (halfD / 2));
          b.addGeo(g, 'galv');
        }
        // ridge cap and eave fascias
        b.add(box(W + 2.2, 0.16, 0.3, 2), 'galv', { pos: [cx, H + 0.2 + RISE, cz] });
        for (const sz of [-1, 1]) {
          b.add(box(W + 2.2, 0.28, 0.14, 1), 'steel',
            { pos: [cx, H + 0.16, cz + sz * halfD] });
        }
        // purlins visible from underneath
        for (let i = 0; i <= 8; i++) {
          const z = cz - D / 2 + (i * D) / 8;
          b.add(box(W + 1.2, 0.12, 0.1, 1), 'steel', { pos: [cx, H - 0.02, z] });
        }
      }
      // low parapet
      for (const [dx, dz, w2, d2] of [[0, -D / 2 - 0.9, W + 2, 0.15], [0, D / 2 + 0.9, W + 2, 0.15],
                                      [-W / 2 - 0.9, 0, 0.15, D + 2], [W / 2 + 0.9, 0, 0.15, D + 2]]) {
        b.add(box(w2, 0.45, d2, 2), 'galv', { pos: [cx + dx, H + 0.45, cz + dz] });
      }
      // court floor (green/terracotta)
      b.addGeo(rect(cx - W / 2 + 0.4, cz - D / 2 + 0.4, cx + W / 2 - 0.4, cz + D / 2 - 0.4, 0.06, 4), 'courtFloor');

      /**
       * Basketball court: markings, hoops, backboards, bleachers.
       *
       * The court was a bare green rectangle under a roof — which, from inside,
       * is what an empty warehouse looks like. A covered court in a Philippine
       * school is the busiest structure on campus, and it reads as one almost
       * entirely through its painted lines and its two hoops.
       *
       * FIBA-ish proportions, scaled to the 29.2 x 20.6 m slab: the painted
       * court is 28 x 15 with a 2 m apron, which is what these sheds actually
       * fit. Lines are thin boxes 1 cm above the floor so they cannot z-fight it.
       */
      {
        const LY = 0.075;                       // just above the 0.06 slab
        const CW = 28.0, CD = 15.0;             // painted court
        const lx0 = cx - CW / 2, lx1 = cx + CW / 2;
        const lz0 = cz - CD / 2, lz1 = cz + CD / 2;
        const white = 'courtLine';
        // touchlines and sidelines
        for (const z of [lz0, lz1]) {
          b.add(box(CW + 0.1, 0.012, 0.08, 1), white, { pos: [cx, LY, z] });
        }
        for (const x of [lx0, lx1]) {
          b.add(box(0.08, 0.012, CD + 0.1, 1), white, { pos: [x, LY, cz] });
        }
        // centre line and centre circle
        b.add(box(0.08, 0.012, CD, 1), white, { pos: [cx, LY, cz] });
        {
          const ring = new THREE.RingGeometry(1.78, 1.86, 36, 1);
          ring.rotateX(-Math.PI / 2);
          ring.translate(cx, LY, cz);
          b.addGeo(ring, white);
        }
        // key, free-throw circle and three-point arc at each end
        for (const sgn of [-1, 1]) {
          const bx = cx + sgn * (CW / 2);
          // key: 4.9 m wide x 5.8 m deep
          const kx = bx - sgn * 5.8;
          for (const q of [-1, 1]) {
            b.add(box(5.8, 0.012, 0.08, 1), white,
              { pos: [(bx + kx) / 2, LY, cz + q * 2.45] });
          }
          b.add(box(0.08, 0.012, 4.9, 1), white, { pos: [kx, LY, cz] });
          // free-throw circle
          const ft = new THREE.RingGeometry(1.78, 1.86, 30, 1);
          ft.rotateX(-Math.PI / 2);
          ft.translate(kx, LY, cz);
          b.addGeo(ft, white);
          // three-point arc: a chain of short chords, since there is no arc primitive
          const R3 = 6.75, N3 = 26;
          for (let i = 0; i < N3; i++) {
            const a0 = -Math.PI * 0.36 + (i / N3) * Math.PI * 0.72;
            const a1 = -Math.PI * 0.36 + ((i + 1) / N3) * Math.PI * 0.72;
            const p0 = [bx + sgn * Math.cos(a0) * R3 * 0.78, cz + Math.sin(a0) * R3];
            const p1 = [bx + sgn * Math.cos(a1) * R3 * 0.78, cz + Math.sin(a1) * R3];
            const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
            const g = box(len, 0.012, 0.07, 1);
            g.rotateY(-Math.atan2(p1[1] - p0[1], p1[0] - p0[0]));
            g.translate((p0[0] + p1[0]) / 2, LY, (p0[1] + p1[1]) / 2);
            b.addGeo(g, white);
          }

          /**
           * Hoop assembly: post, boom, backboard, ring, net.
           *
           * The ring is at the regulation 3.05 m, the backboard 1.05 x 1.80, and
           * the post stands just outside the baseline. These are the objects that
           * make the shed read as a court from across the yard, so they are
           * modelled rather than painted.
           */
          const postX = bx + sgn * 1.5;
          b.add(cylinder(0.13, 0.16, 3.4, 10), 'steel',
            { pos: [postX, 1.70, cz], collide: true });
          // boom reaching back over the baseline to the ring
          b.add(box(0.14, 0.14, 1.5, 1), 'steel',
            { pos: [postX - sgn * 0.55, 3.35, cz] });
          b.add(box(0.9, 0.10, 0.10, 1), 'steel',
            { pos: [postX - sgn * 1.22, 3.30, cz] });
          // backboard, facing the court
          const band = new THREE.BoxGeometry(0.06, 1.05, 1.80);
          band.translate(postX - sgn * 1.68, 3.35, cz);
          b.addGeo(band, 'paintWhite');
          // painted inner square
          const bs = new THREE.PlaneGeometry(0.45, 0.59);
          bs.rotateY(sgn > 0 ? -Math.PI / 2 : Math.PI / 2);
          bs.translate(postX - sgn * 1.72, 3.22, cz);
          b.addGeo(bs, 'courtLine');
          // ring
          const ringGeo = new THREE.TorusGeometry(0.225, 0.022, 6, 18);
          ringGeo.rotateX(Math.PI / 2);
          ringGeo.translate(postX - sgn * 1.90, 3.05, cz);
          b.addGeo(ringGeo, 'paintRed');
          // net: a ring of sloping strands
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            const nx = Math.cos(a) * 0.20, nz = Math.sin(a) * 0.20;
            const strand = box(0.012, 0.40, 0.012, 1);
            strand.rotateX(Math.cos(a) * 0.22);
            strand.rotateZ(Math.sin(a) * 0.22);
            strand.translate(postX - sgn * 1.90 + nx, 2.84, cz + nz);
            b.addGeo(strand, 'paintWhite');
          }
        }

        /**
         * Bleachers down one side.
         *
         * Three stepped benches on a steel frame along the +Z touchline, which is
         * where a school shed keeps them. Cheap, and they give the space a scale
         * reference that a flat floor cannot.
         */
        {
          const bz0 = lz1 + 1.5;
          for (let i = 0; i < 3; i++) {
            const y = 0.42 + i * 0.40;
            const dz = bz0 + i * 0.85;
            b.add(box(CW * 0.7, 0.09, 0.80, 2), 'bleacherSeat', { pos: [cx, y, dz] });
            // riser
            b.add(box(CW * 0.7, 0.34, 0.06, 1), 'bleacherSeat', { pos: [cx, y - 0.19, dz - 0.40] });
            // frame legs every 3.5 m
            for (let k = 0; k <= 6; k++) {
              const x = cx - CW * 0.35 + (k / 6) * CW * 0.7;
              b.add(box(0.07, y, 0.07, 1), 'steel', { pos: [x, y / 2, dz] });
            }
          }
        }
      }
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
      b.addGeo(g, 'walkwayRoof');
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
    /**
     * Walkway routing, on the surveyed plan.
     *
     * The main spine runs from the gate drive west along the ceremonial axis to
     * the covered court, then north to the main building's forecourt. A second
     * run links the north side of the campus to the shrine's forecourt, which is
     * how you actually walk from one to the other on site.
     *
     * These used to be hard-coded to the old (pre-survey) campus coordinates and
     * cut straight through the 4-storey building.
     */
    const GZ = L.gate.z;
    walk(L.gate.x - 6.0, GZ, -12.0, GZ);            // gate -> centre of the yard
    walk(-12.0, GZ, -48.0, GZ);                     // centre -> building forecourt
    walk(-48.0, GZ, -48.0, 24.0);                   // branch south past the court
    walk(-12.0, GZ, -12.0, -22.0);                  // branch north to the shrine road
    walk(-12.0, -22.0, -40.0, -22.0);               // across to the shrine approach
    walk(-40.0, -22.0, -40.0, -30.0);               // down to the forecourt

    const signs = b.signs || [];
    b.buildInto(this.root, M);
    // Handed to the interaction layer so props can be offered by proximity
    // without raycasting merged geometry every frame.
    this.refs = { benches: benchPositions, lamps: lampPositions };
  }

  /* ---------------------------------------------------------- vegetation */
  plantVegetation(M) {
    const kit = new TreeKit(M, 20241123);
    const trees = new THREE.Group();
    trees.name = 'trees';
    this.root.add(trees);
    /**
     * Trees must not grow through a roof.
     *
     * Three did — at (-4,30), (12.5,34) and a palm at (-2,30) — all standing
     * inside the covered court's footprint (x -9..21, z 19..41) and pushing up
     * through its canopy. The court's steel posts and roof are built before the
     * vegetation pass, so nothing was keeping the two apart.
     *
     * Rather than hand-moving each offender (and having the next one reappear),
     * every candidate position is tested against a list of roofed footprints.
     * Anything inside one is skipped with a console warning, so a misplaced tree
     * shows up in the log instead of in a screenshot.
     *
     * The footprints are written from the surveyed layout, which is itself a trap:
     * the main building carries rotY = +pi/2, so its 96 m long axis runs along
     * world Z and not X. Writing it as 98 m wide in X swept up the whole shrine
     * approach and rejected eleven perfectly good palms.
     */
    const roofed = [
      { name: 'covered court', xMin: -9.6, xMax: 21.6, zMin: 18.4, zMax: 41.6 },
      { name: 'north classroom block', xMin: 25.4, xMax: 40.6, zMin: -35.7, zMax: 3.6 },
      { name: 'south classroom block', xMin: 26.4, xMax: 41.6, zMin: 7.4, zMax: 32.7 },
      { name: 'lab wing', xMin: 33.3, xMax: 54.7, zMin: -40.6, zMax: -27.4 },
      { name: 'shrine', xMin: -113, xMax: -47, zMin: -71, zMax: -32 },
      // rotY = +pi/2: the 96 m long axis runs along world Z, not X.
      { name: 'main building', xMin: -94.3, xMax: -77.7, zMin: -39.1, zMax: 57.9 },
    ];
    const blocked = [];
    const addTree = (spec) => {
      const hit = roofed.find((r) =>
        spec.x > r.xMin && spec.x < r.xMax && spec.z > r.zMin && spec.z < r.zMax);
      if (hit) {
        blocked.push([spec.x, spec.z, hit.name]);
        return;
      }
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

    // ---- plaza trees: perimeter only, leaving the central axis and the
    // sightline from the highway to the shrine completely open. This matches
    // the real park, which is lawn + paths with shade trees at its edges.
    const PX = L.plaza.cx, PZ = L.plaza.cz;
    const ph0 = L.plaza.halfX, hz0 = L.plaza.halfZ;
    for (let i = 0; i < 10; i++) {
      const t = i / 9;
      // along the north edge
      addTree({ x: PX - ph0 + 2 + t * (2 * ph0 - 4), z: PZ - hz0 + 1.8, height: 10 + (i % 4) * 1.2, spread: 4.6, kind: 'near' });
      // along the south edge
      addTree({ x: PX - ph0 + 2 + t * (2 * ph0 - 4), z: PZ + hz0 - 1.8, height: 9.6 + (i % 3) * 1.4, spread: 4.4, kind: i % 2 ? 'mid' : 'near' });
    }
    for (const s2 of [-1, 1]) {
      for (const t of [0.28, 0.52, 0.76]) {
        addTree({ x: PX + s2 * (ph0 - 1.8), z: PZ - hz0 + 2 + t * (2 * hz0 - 4), height: 10 + t * 2, spread: 4.4, kind: 'mid' });
      }
    }
    // four palms marking the corners of the circular centre
    for (const [dx, dz] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) {
      addTree({ x: PX + dx, z: PZ + dz, palm: true, height: 10.5 });
    }

    // ---- hedges: plaza border + church forecourt + campus
    const ph = L.plaza.halfX;
    const hzz = L.plaza.halfZ;
    // Low hedges only along the far edges, broken where the paths leave the park.
    veg.hedgeBox(PX - ph + 1.2, PZ + hzz - 1.4, PX - 4.0, PZ + hzz - 0.5, 0, 0.62);
    veg.hedgeBox(PX + 4.0, PZ + hzz - 1.4, PX + ph - 1.2, PZ + hzz - 0.5, 0, 0.62);
    veg.hedgeBox(PX - ph + 1.2, PZ - hzz + 0.5, PX - 4.0, PZ - hzz + 1.4, 0, 0.62);
    veg.hedgeBox(PX + 4.0, PZ - hzz + 0.5, PX + ph - 1.2, PZ - hzz + 1.4, 0, 0.62);
    veg.hedgeBox(PX - ph + 0.5, PZ - hzz + 3.0, PX - ph + 1.4, PZ + hzz - 3.0, 0, 0.62);
    veg.hedgeBox(PX + ph - 1.4, PZ - hzz + 3.0, PX + ph - 0.5, PZ + hzz - 3.0, 0, 0.62);

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
    veg.grassPatch(PX - ph, PZ - hz0, PX + ph, PZ + hz0, { density: 0.4 });

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
    if (blocked.length) {
      console.warn('[vegetation] skipped trees inside roofed areas:',
        JSON.stringify(blocked));
    }
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
