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
284 colliders   91 interaction zones
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
- Main building: hollow shell (four perimeter walls + slab) with a walk-through
  entrance, ten furnished classrooms a floor either side of a spine corridor
  across four storeys — chalkboard, twelve desks and chairs per room, teacher's
  desk, fluorescent batten, clock, pin board, partitions, stairs at each end, and
  a lobby with reception counter, timber screen, crest and honour boards.
- Covered court: the lawn panel that was burying the entire basketball court has
  been cut back to north and south of the structure.

## Open work

- ~~The shrine's main-door sign lettering is occluded by the porch columns.~~
  Wrong: the sign plane is at PZ + PD/2 + 0.18 and the column line at
  PZ + PD/2 - 0.75, so the sign is IN FRONT of the columns and always has been.
  The real occluder is tree canopy on the approach, which is deliberate.
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

- **A Builder that rebases and yaws its geometry does not author world coordinates.**
  `dct-main.js` puts the shell and everything else in one `Builder`, then at build
  time translates every piece by `(-MAIN.x, 0, -MAIN.z)` and parents it to a group
  with `rotY = +pi/2`. An authored `(ax, az)` therefore becomes world
  `(MAIN.x + az - MAIN.z, MAIN.z - ax + MAIN.x)` — a swap and a mirror. Authored X
  carries the building's LENGTH, authored Z its DEPTH. Writing the interior in
  plain world coordinates produced desks spanning 92 m of X and a 15 m band of Z.
  The fix that stuck was to stop using world coordinates inside the block at all
  and convert once through two local helpers (`axOf`, `azOf`); there is now no raw
  `MAIN.x` in the interior. **If a building has a yaw, derive its interior in a
  named local frame, never in world numbers.**
- **A ceiling that is present, correctly sized, and not above you.** After the
  first axis fix the ceiling spanned the right numbers but sat 95 m along X
  instead of Z, so looking straight up the corridor returned the sky dome at
  2394 m from every probe point. Rendering "up" is the cheap tell: a hole to the
  sky where there should be a soffit. Ray-casting up from several points along
  the space is faster than reasoning about the transform.
- **Furniture placed relative to a wall needs the inward sign, not the wall's
  sign.** Desks march from the chalkboard, which sits on the OUTER wall, so
  inward is `-sx`. With `+sx` every desk column went through the outer face and
  the rooms rendered empty while the geometry all "existed". Check the extremes
  numerically (`dxl` against the room bounds) before rendering; it is one line.

## Two more traps paid for in blood

- **A `PlaneGeometry` faces local +Z.** Both sets of station plaques were built
  with the two walls' `rotateY` swapped, so they aimed INTO the masonry and were
  backface-culled — the frames then read as dark smudges on the plaster. Nothing
  about the symptom suggests culling. If a flat thing is invisible but its frame
  is not, suspect the facing before the material.
- **`npm install --silent` under `set -e` can fail without a word**, and the next
  symptom is the build dying on `Cannot find package 'three'` with no hint that
  dependencies were missing. `setup.sh` now verifies `node_modules/three` exists.

## The entrance, and four faults that each hid the next

The main building's door is in the middle of one LONG side while the spine
corridor runs the building's LENGTH. That is the whole story; everything below
is fallout from it.

- **A façade plane documented as "the front" is only front if the group is not
  rotated.** `frontZ = MAIN.z - d/2` read as the front in three comments and was
  the BACK wall in world. Flipping it to `MAIN.z + d/2` moved the bay, canopy,
  statue and pediment off an empty lawn — and then every signed offset hung off
  it had to be flipped in the same commit. There were 21. The tell was a render
  with no entrance at all: a missing element, not a misplaced one.
- **Flipping the plane does not flip the details.** `EZ = frontZ - entryProj`
  still pointed INTO the block after the flip, so doors, crest and niche were
  buried. Worse, `EZ` was computed as `frontZ + entryProj` while the piers are
  `entryProj + 0.6` deep, so the true outer face was 0.3 m further out again and
  every window sat 30 cm inside the masonry. Probe the actual face, do not
  derive it: a sideways ray from outside names the first hit and its x.
- **`windowUnit` faces local -Z.** On the reversed face every unit needed a
  half-turn or it was backface-culled into invisibility. Same for the crest's
  own `rotation.y = Math.PI`, which became wrong the moment the wall turned.
- **Circulation has to meet the door.** The rooms were furnished, the corridor
  was right, and you still walked into a classroom, because the spine runs one
  way and the door is on the other. A cross-corridor through the full depth now
  joins them.
- **`zMid` is a bay BOUNDARY, not a bay centre.** 10 bays over 95.1 m from 0.45
  puts bay breaks at 48.0 — exactly the door. Suppressing "the entry bay" left
  the neighbouring bay sealed and furnished, walling the passage off one metre
  from its own threshold. The corridor wall is now drawn as solid spans between
  a list of openings, with whole-bay mouths for the passage.
- **A stair centred on the door climbs through the entrance.** It was at zMid
  because zMid looked like "the middle of the building", and its bottom treads
  landed at y 1.95 over the doorway. The give-away was a hard-edged brown
  diagonal across the ceiling in the walk-in render: not a ceiling finish, an
  outside roof seen from inside.
- **Outside elements kept turning up inside.** The ground-floor arcade was at
  `frontZ - 2.6` and so stood 2.6 m INTO the building — 95 m of columns and a
  timber lean-to roof through the lobby. The canopy cantilevered inward for the
  same reason. Anything with a signed offset from `frontZ` was suspect.
- **Coplanar floors lose silently.** The passage tile and the classroom vinyl
  are both 6 cm and the vinyl runs the whole building, so at equal heights the
  terracotta z-fought and lost: blue-grey lobby. Lift the detail 1 cm.
- **A reception counter "clear of the spine" at xl 0.75 is inside a 2.2 m
  corridor.** It was, and its 5.4 m screen spanned the mouth of the cross
  corridor — a dark wall dead ahead of anyone walking in. Its honour boards had
  the mirror bug, at −cW/2 − 0.02, i.e. 2 cm behind the wall, invisible from
  everywhere. Fit out in world coordinates and convert once.

## Windows: the elevation was a mural

The main building's long walls were four solid boxes with decorative window
planes applied to the OUTSIDE. The elevation looked right from the lawn and was
a lie from inside: a ray cast from any classroom at eye *or* sill height hit
`dctWall` at 3.30 m, and the "windows" were painted on sealed masonry. Every
interior photograph came out a grey box, and the corridor read as a dark tube.

- **An elevation is not a window.** If the wall has no hole in it, the grid of
  `windowUnit` planes is decoration. The test is a ray from inside at the
  window's own height: `OPEN` means glazing, `dctWall` means paint.
- **`windowUnit` has a `backing` option for this reason.** Its opaque recess
  slab exists to hide the absence of a hole. Put it inside a real hole and it
  becomes an opaque panel across the view — the glazing rendered as solid slabs.
  Pierced walls pass `backing: false`.
- **Glazing goes at the wall's mid-thickness, not on its face.** A unit at
  `frontZ + 0.01` sat proud of a sealed wall, which was correct. On a pierced
  wall the same offset leaves a panel stuck to the outside of the hole.
- **`bayW/window` geometry has a knock-on for furniture.** The chalkboard had
  been mounted on the outer wall for the good reason that the outer wall was
  solid. With real windows it would hang across the glass. Board to the party
  wall, windows outside, students facing away from the light — which is how a
  classroom is laid out anyway.
- **A display board 4 m long and 0.05 m thick, positioned on the depth axis, is
  a free-standing sheet.** It read as a huge tan panel floating across the
  windows at eye height. A board on a partition is thin in the LENGTH axis and
  long in DEPTH, because the partition separates one bay from the next.
- **Sampling a wall 7 cm below the window band returns solid masonry.** Two
  probes disagreed about whether the piercings existed; the openings are at
  `f*FH + FH*0.56 ± 0.925` and the failing sample was at 5.09 m against a band
  starting at 5.16 m. Compute the opening's exact extent before concluding the
  geometry is wrong.
- **Camera inside a wall renders black.** `[-84.5, 5.62, -10]` is the corridor
  wall itself. Derive interior camera positions from the room's world bounds
  (`rear room x -93.30..-87.10`), not from an authored-coordinate guess.
- **A blank corridor view is usually framing.** Shot dead down a 2.2 m tube, all
  twenty doorways are edge-on and invisible. Angled 2 m off axis they read
  clearly. Check the angle before concluding the doors are missing.
