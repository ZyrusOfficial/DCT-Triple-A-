# Where this build is — current state

Handover notes. Update this file when the state changes; it is the thing to read
first in a fresh session.

## Scope — three subjects, nothing else

The brief is:

1. **Dominican College of Tarlac** campus
2. **San Nicolas de Tolentino Shrine** beside it
3. **The church park** in front of the shrine

Everything else is cut. `SCOPE` in `src/world/layout.js` controls it:

| Flag | Value | Builds |
|---|---|---|
| `poblacion` | `false` | houses, chapel row, commercial strip, highway poles, cables |
| `municipal` | `false` | Capas municipal hall + portico |
| `horizon` | `true` | distant tree ring (scenery behind the subjects, hides the ground seam) |

The culled coordinates stay in `layout.js`. Flipping a flag brings a subject back.

## Getting a fresh sandbox running

```bash
bash tools/setup.sh
```

That does `npm install`, rebuilds the Chromium rig, proves the world builds,
and starts the dev server plus headless Chromium. Individual pieces:

| Script | What it does |
|---|---|
| `tools/setup.sh` | all of the above, one command |
| `tools/rebuild-rig.sh` | rebuilds the `/tmp` Chromium+SwiftShader rig from scratch (~3 s) |
| `tools/chrome.sh` | starts headless Chromium on CDP :9333 |
| `tools/buildtest.mjs` | runs the real `World.build()` in Node, ~10 s, no browser |
| `tools/shots.mjs` | captures views from a shot set |

`/tmp` does not persist between sessions, and neither does `node_modules`. Only
Git-tracked files survive.

## Verifying a change

```bash
node tools/buildtest.mjs                     # logic: imports, geometry args, colliders
node tools/shots.mjs tools/shotsets/verify.json \
     --size 1280x720 --quality low --hideui   # appearance
```

`buildtest.mjs` proves the build runs and reports collider count and stage
timings. It proves **nothing** about appearance — colours, lighting and materials
need a real screenshot.

Shot sets:

| Set | Views |
|---|---|
| `verify.json` | fountain, gate letters, municipal hall, covered court |
| `survey.json` | six-way campus survey (plaza, municipal, main building, spawn, court, aerial) |
| `int.json` | shrine interior — nave, roof, altar, side |
| `front.json`, `doors.json`, `rb.json` | shrine façade, open doors, rear |

## Baseline numbers

Measured on the Ryzen-class SwiftShader rig at 1280×720, `--quality low`:

```
~330 draws  ~500k triangles  ~210 geometries  ~140 textures
build ~9-14 s  (materials is ~85% of it)
227 colliders
20-30 fps
```

Stage timings print once as `[build] timings {...}` and are also on
`world.stats.timings`.

## Traps already hit — do not rediscover these

These are all documented in code comments at the point of failure. Summarised:

- **`canvas()` must use `willReadFrequently: true`.** At `false`, one
  `getImageData` on a 512² canvas costs 8,855 ms under SwiftShader instead of
  1 ms. This was 120 of 121 build seconds.
- **`b.add()` returns nothing** — it cannot be chained.
- **`addGeo(g, matKey, collide)`** takes geometry already baked into world space
  and no options object. `.rotateX().translate()` must happen before the call.
- **`put()` rotates about the origin before translating**, so a rotated part
  swings bodily out of place. This is what made fountain jets spear across the
  plaza.
- **The `Builder` bakes world space**, and it applies the target group's `rotY`
  at add time. An extra `rotateY` on a glyph composes with that and swings it
  edge-on.
- **A shell element can out-rank the interior.** The shrine's exterior module
  once owned a full-nave floor above the interior's own floor. When an interior
  surface looks wrong, ray-cast and check *which module* owns the first hit.
- **Never diagnose from material values.** A near-black basin wall was an absence
  of light, not a wrong albedo. Ray-cast, then reason about light.
- **Emissive tweaks with no visible change mean you are editing the wrong
  surface.** Confirm ownership first.
- **`rotY = +π/2` maps local +X to world +Z**, so a 96 m long axis runs along Z.
  Writing building footprints with the axes swapped silently culls far more than
  intended — this rejected eleven good palms.
- **Cylinders are capped by default**, and a cap across a basin is a lid that
  hides the water. `RingGeometry` or `CylinderGeometry(..., true)` where a hole
  is wanted.

## Done

- Shrine interior: `robedFigure()` builds saints from a lathed robe profile with
  shoulders, turned head, halo/staff/book options. San Nicolas in the central
  niche, six flanking saints in two tiers.
- Fourteen Stations of the Cross on the nave piers, seven per wall, running
  anticlockwise from the sanctuary, each with a frame, painted plaque and candle
  cup.

## Open work

- Main building has a blank band through the middle of its window grid.
- Shrine interior could take: pew end-caps, a proper sanctuary lamp, marble
  inlay on the sanctuary platform, and a confessional.

## Two more traps paid for in blood

- **A `PlaneGeometry` faces local +Z.** Both sets of station plaques were built
  with the two walls' `rotateY` swapped, so they aimed INTO the masonry and were
  backface-culled — the frames then read as dark smudges on the plaster. Nothing
  about the symptom suggests culling. If a flat thing is invisible but its frame
  is not, suspect the facing before the material.
- **`npm install --silent` under `set -e` can fail without a word**, and the next
  symptom is the build dying on `Cannot find package 'three'` with no hint that
  dependencies were missing. `setup.sh` now verifies `node_modules/three` exists.
