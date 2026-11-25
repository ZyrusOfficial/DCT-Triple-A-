/**
 * Site layout — surveyed ground truth.
 *
 * Every number below is converted straight from OpenStreetMap WGS84 footprints
 * (ODbL) into a local metric frame, so the campus, the shrine, the highway and
 * the plaza sit where they really do, at true bearings and distances.
 *
 * Axes:  +X = east,  +Z = south,  Y = up.   Origin = DCT main gate on MacArthur.
 *
 * Verified extents (metres, relative to the origin):
 *   DCT campus      X −109.2 → +51.0    Z −26.8 → +45.6   (160.2 × 72.3)
 *   SNDT shrine     X  −98.8 → −48.7    Z −73.6 → −29.0   (50.1 × 44.6)
 *   shrine centre   X  −73.8            Z −51.3
 *   MacArthur Hwy   runs N–S at X ≈ 0 (the gate stands on it)
 */

/**
 * SCOPE — what this reconstruction is actually OF.
 *
 * The brief is three subjects and nothing else:
 *
 *   1. the DCT campus
 *   2. the San Nicolas de Tolentino Shrine beside it
 *   3. the church park in front of the shrine
 *
 * Everything else in this file — the municipal hall, the market, the LDS and
 * Methodist chapels, the north classroom block, the surrounding poblacion — is
 * surveyed context that was modelled early on. It is OUT OF SCOPE and is no
 * longer built (see the `scope` switch below). It stays in the layout because
 * the surveyed coordinates are still useful as reference, and because turning
 * it back on is then a one-line change rather than an archaeology exercise.
 *
 * The point of the cull is not tidiness. `town` alone was 65,000 triangles and
 * ~15 draw calls of houses, highway power poles, overhead cables and a
 * 320-sphere horizon ring. Dropping it buys back budget that goes straight into
 * detail on the three subjects that matter.
 */
export const SCOPE = {
  /** Surrounding poblacion: houses, chapels, market, highway poles, cables. */
  poblacion: false,
  /**
   * Distant horizon ring of tree blobs.
   *
   * Kept — it costs almost nothing on its own and without it the ground plane
   * ends in a hard seam against the sky. It is scenery *behind* the three
   * subjects, not a fourth subject.
   */
  horizon: true,
  /** Municipal hall across the highway: out of scope, and not visible from the
   *  shrine park without turning round. */
  municipal: false,
};

export const L = {
  /* --------------------------------------------------------------- roads */
  highway: {
    cx: 0,
    halfWidth: 11.0,     // N2: 2 lanes each way + paved shoulder
    zMin: -340, zMax: 340,
  },
  /** The street the campus frontage actually opens onto (crosses the highway). */
  frontageRoad: { z: 45.6, halfWidth: 4.5 },

  /* ----------------------------------------------------------- DCT campus */
  campus: {
    xMin: -109.2, xMax: 51.0,
    zMin: -26.8, zMax: 45.6,
  },
  /** Gate sits on the campus's east frontage, facing the highway. */
  gate: { x: 21.5, z: -6.0 },

  /**
   * Main building: the long 4-storey slab.
   * The reference photo is taken from the highway looking WEST, and the façade
   * is dead ahead — so the slab runs parallel to the highway (N–S), its long
   * axis along Z, with the façade facing +X.
   */
  mainBuilding: {
    x: -86.0,            // centre of the slab (deep inside the campus)
    z: 9.4,
    rotY: Math.PI / 2,   // local +Z (the façade) → world +X
    w: 96.0,             // long axis
    d: 15.5,
    floors: 4,
    floorH: 3.9,
  },

  /** Paved yard between the gate and the main building. */
  // The paved yard reaches from the main building's forecourt all the way east
  // to the highway frontage, and from the shrine's south edge to the frontage
  // road. A school campus of this size is almost entirely hard-paved; leaving
  // a bare grass strip along the road is what made the gate look marooned.
  yard: { xMin: -46, xMax: 46, zMin: -26, zMax: 45 },

  /* ------------------------------------------------------------- shrine */
  church: {
    x: -73.8,
    z: -51.3,
    // Local +Z (the façade) must point EAST at the plaza. A Y-rotation of +π/2
    // sends local +Z to world +X; −π/2 would send it to world −X (west, away
    // from the plaza), which is the trap here.
    rotY: Math.PI / 2,
    naveW: 19.0,
    naveL: 38.0,
    wallH: 11.8,
  },
  /** The shrine's own forecourt, east of its porch. */
  forecourt: { xMin: -52.0, xMax: -22.0, zMin: -76.0, zMax: -26.0 },

  /* -------------------------------------------------------------- plaza */
  /**
   * The park in front of the shrine. Sits between the highway and the shrine,
   * i.e. east of the shrine's forecourt and west of the highway.
   */
  plaza: { cx: -20.0, cz: -66.0, halfX: 20.0, halfZ: 24.0 },

  /* ------------------------------------------------------ municipal hall */
  /** East of the highway, facing west across the plaza. */
  municipal: {
    x: 52.0, z: -60.0, w: 44, d: 18, h: 11.5,
    rotY: -Math.PI / 2,
  },

  /* ---------------------------------------------------------- other blocks */
  // The covered court sits on the south half of the campus, clear of the main
  // gate axis so the approach to the 4-storey building stays open.
  coveredCourt: { x: 6.0, z: 30.0, w: 30, d: 22 },
  market: { x: 30.0, z: 74.0, w: 30, d: 36 },

  /* ---------------------------------------------------- secondary campus */
  /** The 4-storey classroom block recorded on OSM north of the shrine. */
  northBlock: { x: 4.0, z: -96.0, w: 52, d: 14, floors: 4 },
  /** LDS chapel across the street (OSM way 154142211). */
  lds: { x: 20.0, z: -128.0, w: 28, d: 14 },
  /** United Methodist chapel (OSM way 154144979). */
  methodist: { x: -4.0, z: -150.0, w: 14, d: 20 },
  /** Mercury Drug on the highway (OSM way 154079432). */
  mercury: { x: 18.0, z: -58.0, w: 11, d: 21 },
  /** Capas Public Market (OSM way 154079238). */
  publicMarket: { x: 33.0, z: -206.0, w: 54, d: 122 },
};

/** Local box corners → world, honouring a yaw about the box centre. */
export function boxToWorld(b, lx, lz) {
  const c = Math.cos(b.rotY || 0), s = Math.sin(b.rotY || 0);
  return [b.x + lx * c + lz * s, b.z - lx * s + lz * c];
}

/** Which cardinal direction a rotated building's façade faces. */
export function facadeFacing(rotY) {
  // local +Z rotated by rotY
  const x = Math.sin(rotY), z = Math.cos(rotY);
  if (Math.abs(x) > Math.abs(z)) return x > 0 ? 'east' : 'west';
  return z > 0 ? 'south' : 'north';
}
