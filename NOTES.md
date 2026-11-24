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
| `verify.json` | the standing pass — gate, yard, main building x2, covered court, shrine front, forecourt statue, nave, altar, aerial |
| `survey.json` | six-way campus survey (plaza, municipal, main building, spawn, court, aerial) |
| `int.json` | shrine interior — nave, roof, altar, side |
| `front.json`, `doors.json`, `rb.json` | shrine façade, open doors, rear |

## Baseline numbers

Measured on the Ryzen-class SwiftShader rig at 1280×720, `--quality low`:

```
~270-420 draws  ~500k triangles  ~210 geometries  ~140 textures
build ~9-14 s  (materials is ~85% of it)
281 colliders   91 interaction zones
20-27 fps
```

Interior views run 256-290 draws, campus exterior 300-336. The covered court is
the heaviest single view at ~418 because the basketball court, bleachers and the
shrine all fall inside its frustum at once.

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
- Altar crucifix (stepped marble foot, gilt upright and crossbar, pale corpus)
  and a hanging sanctuary lamp on three chains, red glass over a brighter core.
- Shrine side doors rebuilt: two leaves each, centre stiles, raised panels,
  glazed transoms, moulded surrounds with archivolts, brass handles.
- Forecourt statue of San Nicolas: `robedFigure` at 1.35 scale in a pale outdoor
  robe stone on the brick plinth, rotated to face the approach.
- Campus furniture along the walkway spine: flagpole on the ceremonial axis,
  nine planters at the junctions, ten benches, three bins, a notice board, a
  five-hoop bike rack.
- Main building window band through the middle of the grid.
- 91 interaction zones: 36 original plus 55 for the walkway furniture and the
  whole shrine nave (altar, retablo, San Nicolas, lamp, pews, 14 Stations, side
  doors).

## Open work

- The shrine's main-door sign lettering is occluded by the porch columns from
  most approach angles. Either raise the sign or space the columns.
- Shrine interior could still take: pew end-caps, marble inlay on the sanctuary
  platform, a confessional, and a proper reredos shadow so the centre bay does
  not read flat.
- The niche haloes are a 12-ray sunburst at 0.27 x the figure scale. They read
  correctly from the nave but are heavy at 2 m; consider 8 shorter rays.

## More traps paid for in blood

- **A missing counter is not a missing feature.** `stats.interactables` read 0
  on every build for several sessions and looked like an unimplemented
  requirement. All 36 zones existed and worked the whole time; the number came
  from a `World#interactables` array that was initialised and never written.
  Before believing a zero in a stat, print the thing the stat is supposed to
  summarise.
- **`??` on a property that does not exist is silent.** Writing
  `L.church.apseZ ?? fallback` where `L.church` has no `apseZ` takes the fallback
  without a murmur, so fourteen Stations of the Cross were about to be placed in
  the wrong part of the nave. Derive geometry from fields you have verified
  exist (`naveL / 2`) rather than nullish-coalescing ones you have not.
- **A "lighting" problem can be a specular problem on a material you never
  changed.** The sanctuary read as a glowing yellow slab through three separate
  changes to the sanctuary light, because the cause was `floorFill` — a
  14-intensity fill light standing 13.8 m in front of the altar at head height
  with decay 1.0, dumping a third of its power into the antependium from
  straight on. Bloom off did nothing, emissive off did nothing, lights x0.25
  left the pool intact. Only darkening the altar materials removed it. Isolate
  the SURFACE first, then reason about what is lighting it.
- **An embroidered frontal is cloth.** `M.altarFrontal` at metalness 0.62 filled
  the lower half of the frame with a mirror when you stood 1.5 m away. Metalness
  belongs on the orphrey threads, not the frontal.
- **Interaction zones must clear the collider of the thing they describe.** The
  flagpole zone was r 2.6 on a plinth 2.1 m across, so the plinth collider held
  the player outside their own prompt. Zone radius has to be plinth radius plus
  standoff.
- **Commit messages with backticks in a double-quoted heredoc get shell-expanded.**
  `git commit -m "...`L.church.apseZ`..."` silently ate the backticked text and
  left a sentence with a hole in it. Use `git commit -F file` for anything
  containing backticks or `$(...)`.

- **Ground height stacking must not cross anything with its own floor.** The
  lawn height rule (base paving 0.070 < grass 0.078 < paths 0.090) is correct
  between ground surfaces, but a lawn panel ran straight over the covered court,
  whose floor slab is at 0.06. The grass won, and the entire basketball court —
  markings, arcs, keys, backboard posts — was buried and invisible for several
  sessions. Third instance of this exact class after the shrine's `tileCream`
  nave floor and its `concreteDark` plinth slab. **Whenever a surface is missing,
  ray-cast down and look at the FIRST hit and its owner, not the second.**

## Two more traps paid for in blood

- **A `PlaneGeometry` faces local +Z.** Both sets of station plaques were built
  with the two walls' `rotateY` swapped, so they aimed INTO the masonry and were
  backface-culled — the frames then read as dark smudges on the plaster. Nothing
  about the symptom suggests culling. If a flat thing is invisible but its frame
  is not, suspect the facing before the material.
- **`npm install --silent` under `set -e` can fail without a word**, and the next
  symptom is the build dying on `Cannot find package 'three'` with no hint that
  dependencies were missing. `setup.sh` now verifies `node_modules/three` exists.
