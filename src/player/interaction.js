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
