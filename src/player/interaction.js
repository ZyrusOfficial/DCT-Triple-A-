/**
 * Interaction.
 *
 * The brief for this project is "no mechanics, but most objects should be
 * interactable" — meaning the world should answer back when you walk up to
 * something, without turning into a game. So an "interaction" here is always one
 * of two kinds:
 *
 *   LOOK   — you get a short, factual line about the thing. A plaque, a marker,
 *            a statue, a building. This is what makes the model feel surveyed
 *            and documented rather than just decorative.
 *   DO     — something in the world actually changes, but only in ways a real
 *            visitor could cause: sit on a bench, open a door, turn on a tap,
 *            light a candle.
 *
 * Design constraints that matter for the iGPU target:
 *   • Probes are CYLINDER zones tested against the player's XZ position, not
 *     per-frame raycasts against a merged 400k-triangle scene. Raycasting merged
 *     geometry every frame is a real cost and it also cannot tell you *which*
 *     bench you are looking at, because they are all welded into one mesh.
 *   • Zones are sorted nearest-first and only the closest one in front of the
 *     player is ever offered, so the prompt is never ambiguous.
 *   • Every action is idempotent or toggleable, so nothing can be left in a
 *     broken state.
 */
import * as THREE from 'three';

const D2R = Math.PI / 180;

/** Squared distance in XZ. */
function dist2(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return dx * dx + dz * dz;
}

export class Interaction {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.zones = [];
    this.active = null;
    this.onChange = null;      // (prompt|null) => void
    this.onMessage = null;     // (text) => void
  }

  /**
   * Register an interaction zone.
   * @param {object} z
   *   x, z          centre (world metres)
   *   r             radius in metres (default 2.2)
   *   label         prompt text, e.g. "Sit on the bench"
   *   message       what to say when used (LOOK-type)
   *   range         vertical tolerance, default 3
   *   run           optional () => string|void — DO-type action, returns a message
   */
  add(z) {
    this.zones.push({ r: 2.2, range: 3.0, ...z });
    return this;
  }

  /** Convenience: register along a line of identical objects (benches, lamps). */
  addRow(x0, z0, x1, z1, n, z) {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1);
      this.add({ ...z, x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t });
    }
    return this;
  }

  /**
   * Called once per frame. Finds the best zone: nearest to the player, within
   * radius, level with them, and in front of the camera (so you are not offered
   * a bench that is behind you).
   */
  update() {
    const p = this.player;
    if (!p) { this.setActive(null); return; }

    // Probe from whichever camera is actually rendering. In fly mode the body
    // is not where the view is, and the verification harness drives a separate
    // debug camera entirely (passed to post.render as an override) — both need
    // prompts to work.
    const cam = (typeof window !== 'undefined' && window.__debugCamOn && window.__app?.debugCam)
      ? window.__app.debugCam
      : p.camera;
    const px = cam.position.x, pz = cam.position.z, py = cam.position.y;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const fx = dir.x, fz = dir.z;
    const fl = Math.hypot(fx, fz) || 1;
    const ux = fx / fl, uz = fz / fl;

    let best = null;
    let bestD = Infinity;
    for (const z of this.zones) {
      const d2 = dist2(px, pz, z.x, z.z);
      const r = z.r;
      if (d2 > r * r) continue;
      if (Math.abs(py - (z.y ?? 0)) > z.range) continue;
      // in front? dot product of the offset and the view direction
      const ox = z.x - px, oz = z.z - pz;
      const len = Math.hypot(ox, oz) || 1e-4;
      const facing = (ox / len) * ux + (oz / len) * uz;
      if (facing < 0.15) continue;
      if (d2 < bestD) { bestD = d2; best = z; }
    }
    this.setActive(best);
  }

  setActive(z) {
    if (z === this.active) return;
    this.active = z;
    if (this.onChange) this.onChange(z ? z.label : null);
  }

  /** Fired on the interact key. Returns true if something happened. */
  use() {
    const z = this.active;
    if (!z) return false;
    let msg = z.message;
    if (z.run) {
      const r = z.run();
      if (typeof r === 'string') msg = r;
      else if (r === false) return false;
    }
    if (msg && this.onMessage) this.onMessage(msg);
    return true;
  }
}

/* ==========================================================================
 * Content: the interactions that exist in this world.
 * ========================================================================== */

/**
 * Register every interaction in the site. Kept in one place so it is obvious
 * what is and is not interactive, and so new props can be wired up as they are
 * modelled.
 */
export function registerInteractions(inter, scene, refs, L) {
  const P = L.plaza;

  /* ---------------------------------------------------------- the shrine */
  // The shrine's porch front edge is at world x ~ -48.2 and its steps end at
  // ~ -46.2, so the readable plaque sits at the head of the steps.
  inter.add({
    x: -50.5, z: L.church.z, r: 4.0, y: 1.2,
    label: 'Read the shrine dedication',
    message: 'San Nicolas de Tolentino Shrine. The parish dates from the Spanish '
      + 'colonial period; the present church was rebuilt in the 1950s and the '
      + 'detached campanile was added later. Feast day: 10 September.',
  });
  inter.add({
    x: -54.0, z: L.church.z, r: 2.4, y: 1.2,
    label: 'Try the main door',
    message: 'The doors are locked — the shrine is closed at this hour. You can '
      + 'see the nave through the fanlight above them.',
  });

  /* ------------------------------------------------- DCT classroom blocks */
  /**
   * Zones sit ON the corridor, not inside a wall.
   *
   * The blocks flank the gate with their corridors on the local +Z side. For
   * rotY = -pi/2, local +Z maps to world -X, so the walkway of a block centred
   * at x is the strip just west of x - depth/2. These are computed from the
   * block positions in index.js rather than guessed.
   */
  const blocks = [
    { x: 33.0, z: -16.0, depth: 13 },
    { x: 34.0, z: 20.0, depth: 13 },
  ];
  for (const bl of blocks) {
    // corridor centreline: 1.3 m in from the block's west face
    const cx = bl.x - bl.depth / 2 + 1.3;
    inter.add({
      x: cx, z: bl.z - 8.5, r: 2.4, y: 1.5,
      label: 'Look into a classroom',
      message: 'Desks in three ranks facing a green chalkboard, fluorescent '
        + 'fittings overhead and a wall clock. Thirty-odd to a section — the '
        + 'rooms have not changed much since the block went up.',
    });
    inter.add({
      x: cx, z: bl.z + 8.5, r: 2.2, y: 1.5,
      label: 'Read the room number',
      message: 'A pressed-steel plate beside the door, painted over so many '
        + 'times the digits are soft-edged. Room numbers count up from the '
        + 'stair head on each floor.',
    });
    inter.add({
      x: cx, z: bl.z, r: 2.6, y: 1.6,
      label: 'Lean on the corridor rail',
      message: 'The open corridor runs the full length of the block with a '
        + 'blue-painted parapet instead of glass. In the wet season the rain '
        + 'blows straight down it; in March it is the coolest place on campus.',
      run: () => 'You lean on the warm painted parapet and look out over the '
        + 'frontage. Tricycles idle at the gate.',
    });
  }

  /* --------------------------------------------------------- the fountain */
  inter.add({
    x: P.cx, z: P.cz, r: 4.6, y: 0.6,
    label: 'Look into the fountain basin',
    message: 'A shallow octagonal municipal fountain. The basin is drained in the '
      + 'dry season; the jets run on the town supply in the evenings.',
  });

  /* ------------------------------------------------------- plaza benches */
  const benches = refs.benches || [];
  for (const b of benches) {
    inter.add({
      x: b.x, z: b.z, r: 2.0, y: 0.4,
      label: 'Sit on the bench',
      run: () => {
        if (inter._sitting === b) { inter._sitting = null; return 'You stand up.'; }
        inter._sitting = b;
        return 'You sit for a while in the shade. The shrine bells are visible '
          + 'above the trees to the west.';
      },
    });
  }

  /* ------------------------------------------------------- plaza lamps */
  const lamps = refs.lamps || [];
  for (const l of lamps) {
    inter.add({
      x: l.x, z: l.z, r: 1.6, y: 0.4,
      label: 'Inspect the lamp post',
      run: () => 'Standard octagonal lamp post, painted black. These are switched '
        + 'on by the barangay at around 18:00 and stay on until dawn.',
    });
  }

  /* ------------------------------------------------ the CAPAS heart letters */
  inter.add({
    x: 4, z: -58, r: 3.0, y: 0.4,
    label: 'Read the CAPAS marker',
    message: 'The "I ♥ CAPAS" marker at the edge of the plaza. Capas, Tarlac — '
      + 'the town was the endpoint of the Bataan Death March in 1942, and the '
      + 'plaza remembers it with a memorial every April.',
  });

  /* ------------------------------------------------------------ the gate */
  inter.add({
    x: L.gate.x - 3.0, z: L.gate.z, r: 3.4, y: 0.6,
    label: 'Read the DCT gate marker',
    message: 'Dominican College of Tarlac. Founded 1946 by the Dominican Sisters '
      + 'and run with the Congregation of the Most Holy Rosary. The stone wall '
      + 'to your left holds the grotto of Our Lady of Lourdes.',
  });
  inter.add({
    x: L.gate.x + 2.0, z: L.gate.z - 5.0, r: 2.2, y: 0.6,
    label: 'Look inside the guard house',
    message: 'The guard house. Every student who ever got to school late has had '
      + 'a conversation through this window.',
  });

  /* -------------------------------------------------- the main building */
  inter.add({
    x: -76.0, z: L.mainBuilding.z, r: 5.0, y: 1.0,
    label: 'Read the main building plaque',
    message: 'The 4-storey main building of Dominican College of Tarlac. Cream '
      + 'façade with a mauve banding course, four floors of classrooms, and the '
      + 'school seal set in the pediment above the porte-cochère.',
  });
  inter.add({
    x: -77.0, z: L.mainBuilding.z, r: 2.6, y: 1.0,
    label: 'Try the entrance doors',
    message: 'The entrance is locked. Above the doors the seal of the college is '
      + 'set in a moulded surround.',
  });

  /* ------------------------------------------------ inside the shrine nave */
  /**
   * The interior is the most detailed thing on the site and had no zones at all,
   * so a visitor could walk the whole nave with nothing to press. These are
   * placed in world coordinates using the surveyed local->world mapping:
   *   world_x = cx + lz, world_z = cz - lx   (cx -73.8, cz -51.3, rotY +pi/2)
   * Altar centre is (-89.6, -51.3); the lamp hangs at (-87.0, -48.7).
   */
  const chX = L.church.x, chZ = L.church.z;
  const toWorld = (lx, lz) => ({ x: chX + lz, z: chZ - lx });

  {
    // -- the high altar
    const a = toWorld(0, -15.8);
    inter.add({
      x: a.x, z: a.z, r: 3.2, y: 1.8, range: 3.5,
      label: 'Approach the high altar',
      message: 'A cream marble mensa on a stepped foot, with a gilt crucifix and '
        + 'six candles. The antependium is embroidered gold on crimson. The '
        + 'sanctuary lamp burns to the left of it.',
    });
    // -- the retablo
    const r = toWorld(0, -17.4);
    inter.add({
      x: r.x, z: r.z, r: 3.0, y: 2.6, range: 4.0,
      label: 'Look at the retablo',
      message: 'Three bays under an arched pediment, the centre one carrying the '
        + 'crucifix and the two flanking ones a tier of niches with Dominican '
        + 'saints. Dark twisted columns with gilt Corinthian capitals — the '
        + 'whole reredos was restored in the 1990s.',
    });
    // -- San Nicolas in the centre niche
    const n = toWorld(0, -16.6);
    inter.add({
      x: n.x, z: n.z, r: 2.4, y: 2.2, range: 3.0,
      label: 'Look at the image of San Nicolas',
      message: 'San Nicolas de Tolentino in black habit, holding a book and a '
        + 'lily, with a gilt sunburst halo behind his head. He is shown holding '
        + 'a dish of bread rolls too — the sign by which he is recognised when '
        + 'he appears in the Augustinian legends.',
    });
    // -- the sanctuary lamp
    const l = toWorld(-2.6, -13.2);
    inter.add({
      x: l.x, z: l.z, r: 1.8, y: 1.5, range: 3.0,
      label: 'Look at the sanctuary lamp',
      message: 'A red glass cup in a gilt canopy, hung on three chains from the '
        + 'roof boss. It is kept burning whenever the Blessed Sacrament is '
        + 'reserved, which is why it is the one warm light in the nave.',
    });
    // -- the pews, alternating down the nave
    for (let i = 0; i < 5; i++) {
      for (const side of [-1, 1]) {
        const p = toWorld(side * 5.6, 6.0 - i * 4.2);
        inter.add({
          x: p.x, z: p.z, r: 1.5, y: 1.2, range: 3.0,
          label: 'Sit in the pew',
          run: () => {
            if (inter._pewSitting === p) { inter._pewSitting = null; return 'You stand and step out into the aisle.'; }
            inter._pewSitting = p;
            return 'Dark hardwood, worn smooth at the ends where hands rest. The '
              + 'nave is cool and smells of candle wax and old varnish.';
          },
        });
      }
    }
    /**
     * Stations of the Cross: seven piers up each wall.
     *
     * The pier line is derived, not copied by eye. In the interior's local frame
     * the apse is at lz = -naveL/2 = -19, the altar sits 3.2 m in front of it
     * (lz -15.8), and church-interior.js puts the first station pier at
     * apseZ + 5.0 and then every 4.4 m. L.church has no apseZ field, so writing
     * `L.church.apseZ ?? fallback` here silently took the fallback and put all
     * fourteen plaques in the wrong place. Derive it from naveL instead.
     */
    const apseZ = -L.church.naveL / 2;
    for (let i = 0; i < 7; i++) {
      for (const side of [-1, 1]) {
        const p = toWorld(side * 9.4, apseZ + 5.0 + i * 4.4);
        inter.add({
          x: p.x, z: p.z, r: 1.4, y: 1.95, range: 3.0,
          label: `Read Station ${side < 0 ? i + 1 : 14 - i}`,
          message: 'A carved gilt frame on the pier with a painted scene in '
            + 'relief. The stations run anticlockwise from the sanctuary, so the '
            + 'numbers climb up the gospel side and back down the epistle side.',
        });
      }
    }
    // -- the side doors
    for (const side of [-1, 1]) {
      const p = toWorld(side * 9.0, 2.0);
      inter.add({
        x: p.x, z: p.z, r: 2.0, y: 1.2, range: 3.0,
        label: 'Try the side door',
        message: 'A pair of panelled timber leaves under a glazed transom, in a '
          + 'moulded surround. Locked from the inside during services, but open '
          + 'through the week for the people who come in to pray.',
      });
    }
  }

  /* ------------------------------------------------------- the weather */
  inter.add({
    x: -20, z: -50, r: 3.0, y: 1.0,
    label: 'Look up at the sky',
    run: () => {
      const h = refs.sky ? refs.sky.hour : 12;
      const el = refs.sunElevation ? Math.round(refs.sunElevation) : null;
      if (h < 6 || h > 18.2) return 'It is night. Capas is quiet; the plaza lamps are on.';
      if (h < 8) return 'Early morning. The light is still low and long across the plaza.';
      if (h < 11) return 'Mid-morning, around ' + h.toFixed(0) + ':00. The sun is climbing '
        + (el !== null ? `and stands ${el}° above the horizon. ` : '') + 'The air is hazy.';
      if (h < 14) return 'Early afternoon. This is the hottest part of the day — the '
        + 'shadows are short and the concrete is bright.';
      if (h < 17) return 'Late afternoon. Shadows are lengthening across the plaza.';
      return 'Golden hour. The shrine façade is lit almost straight on from the west.';
    },
  });

  /* ------------------------------------------- campus furniture, walkway spine */
  /**
   * The yard furniture built in index.js had no interaction zones at all: the
   * benches, planters, bins, notice board, bike rack and flagpole were modelled
   * and collidable but silent, so walking the spine offered nothing to do. The
   * brief is that most objects should answer back, and on a school yard the
   * furniture is most of what you walk past.
   *
   * Positions are copied from the build code rather than guessed: the benches
   * run west from x -16 at GZ +/- 3.4, the planters sit in pairs 2.6 m off the
   * spine, the notice board is at (-26, GZ - 3.6), and the rack runs from x -44.
   */
  const GZ = L.gate.z;

  // -- the flagpole, on the ceremonial axis
  inter.add({
    // The plinth is 2.1 m across at its base with the mast at its centre, so the
    // zone has to clear the plinth itself: at r 2.6 you had to be standing
    // almost on it to get a prompt, and the plinth collider keeps you off.
    x: -14.0, z: GZ, r: 3.6, y: 0.6,
    label: 'Look up at the flagpole',
    message: 'A white steel mast on an octagonal concrete plinth, with a tiled '
      + 'bed of low planting at its foot. The flag is raised at assembly and '
      + 'struck at the end of the day; the halyard rings against the mast when '
      + 'the wind gets under it.',
  });

  // -- the yard benches, six on the north side and four on the south
  const yardBenches = [];
  for (let i = 0; i < 6; i++) yardBenches.push({ x: -16.0 - i * 5.4, z: GZ + 3.4 });
  for (let i = 0; i < 4; i++) yardBenches.push({ x: -18.0 - i * 5.4, z: GZ - 3.4 });
  for (const b of yardBenches) {
    inter.add({
      x: b.x, z: b.z, r: 1.7, y: 0.5,
      label: 'Sit on the bench',
      run: () => {
        if (inter._yardSitting === b) { inter._yardSitting = null; return 'You stand up again.'; }
        inter._yardSitting = b;
        return 'Hardwood slats on concrete standards, warm from the sun. From '
          + 'here the whole spine runs west to the shrine gate.';
      },
    });
  }

  // -- the walkway planters
  for (const [px, pz] of [
    [-12.0, GZ + 2.6], [-12.0, GZ - 2.6], [-30.0, GZ + 2.6], [-30.0, GZ - 2.6],
    [-48.0, GZ + 2.6], [-48.0, GZ - 2.6], [-12.0, -22.0 + 2.6], [-12.0, -22.0 - 2.6],
    [-40.0, -22.0 + 2.6],
  ]) {
    inter.add({
      x: px, z: pz, r: 1.3, y: 0.5,
      label: 'Look at the planter',
      message: 'A square tiled box with a clipped box hedge in it. Two of these '
        + 'stand at each junction of the walkway, which is how you can tell you '
        + 'have reached one.',
    });
  }

  // -- litter bins
  for (const [bx, bz] of [[-13.2, GZ + 3.9], [-33.0, GZ - 3.9], [-47.2, GZ + 3.9]]) {
    inter.add({
      x: bx, z: bz, r: 1.1, y: 0.4,
      label: 'Check the litter bin',
      message: 'A black steel drum with a domed lid and a small round mouth. '
        + 'Emptied by the utility staff in the afternoon.',
    });
  }

  // -- the notice board
  inter.add({
    x: -26.0, z: GZ - 3.6, r: 2.0, y: 1.6,
    label: 'Read the notice board',
    message: 'Two iron posts carrying a glazed timber case. This is where the '
      + 'term calendar goes: enrolment dates, the intramural schedule, the list '
      + 'of sections excused from afternoon classes for practice.',
  });

  // -- the bike rack
  inter.add({
    x: -42.3, z: GZ - 4.6, r: 2.2, y: 0.6,
    label: 'Look at the bike rack',
    message: 'Five inverted-U steel hoops set into the paving. Senior students '
      + 'ride in from the barangays either side of MacArthur Highway and lock '
      + 'up here.',
  });

  /* ---------------------------------------------------- the covered court */
  inter.add({
    x: L.coveredCourt.x, z: L.coveredCourt.z - 9, r: 4.0, y: 0.6,
    label: 'Step onto the covered court',
    message: 'The covered court. Galvanised sheet roof on steel posts, a green '
      + 'and terracotta painted floor, and a backboard at each end. This is where '
      + 'the intramurals are played.',
  });

  return inter;
}
