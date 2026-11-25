# Screenshots

Rendered from the running app with `tools/shots.mjs` at 1920x1080 using the
**high** quality preset (SSAO, full shadow level, bloom, FXAA), then downscaled
to 1600x900 JPEG for the repository. Originals stay in `captures/`, which is
gitignored.

> Note on quality: `ultra` and 4K both hang in this environment because
> SwiftShader exhausts GPU memory. 1080p/high is the reliable ceiling here; on
> real hardware the app runs `ultra` fine.

## Exteriors

| File | What it shows |
|---|---|
| `hi-01-aerial.jpg` | Whole campus from above — main building, church, covered court, gate |
| `hi-02-main-front.jpg` | Main building elevation, straight on |
| `hi-03-main-door.jpg` | Entrance close-up: canopy, projection, doors, statue balcony |
| `hi-04-main-side.jpg` | Oblique from the south, arcade columns in the foreground |
| `hi-05-main-oblique.jpg` | Four storeys of glazed window grid receding in perspective |
| `hi-13-arcade.jpg` | Ground-floor arcade along the façade |

## Main building interior

| File | What it shows |
|---|---|
| `hi-06-lobby.jpg` | Entrance lobby: terracotta floor, honour boards, counter |
| `hi-07-lobby-wide.jpg` | Lobby looking through to the spine corridor |
| `hi-12-stair.jpg` | Stair hall flanking the lobby |
| `hi-10-classroom.jpg` | Classroom with five real windows onto the campus |
| `hi-11-classroom2.jpg` | Second classroom, board wall and windows |
| `hi-08-corridor.jpg` | Spine corridor, angled so the doorways read |
| `hi-09-corridor-n.jpg` | Corridor looking north |
| `hi-12b-corr.jpg` | Corridor on an upper floor |

## Church

| File | What it shows |
|---|---|
| `hi-14-chfront.jpg` | Front elevation, portico and lettering |
| `hi-15-choblique.jpg` | Oblique, dome and bell tower |
| `hi-16-statue.jpg` | Forecourt statue of San Nicolas |
| `hi-17-nave.jpg` | Nave looking toward the sanctuary |
| `hi-18-altar.jpg` | Altar and reredos |
| `hi-19-nave-up.jpg` | Looking up into the nave, ceiling and clerestory |

## Campus

| File | What it shows |
|---|---|
| `hi-20-court.jpg` | Covered court |
| `hi-21-gate.jpg` | Campus gate |
| `hi-22-yard.jpg` | Yard and walkway pergola |
| `hi-23-walkway.jpg` | Walkway from the yard toward the building |
| `hi-24-golden.jpg` | Golden-hour view of the façade |

## Regenerating

```bash
# render (chunked, restarts Chrome between batches)
bash tools/hq-shots.sh tools/shotsets/hq-a.json 1920x1080 high 4
bash tools/hq-shots.sh tools/shotsets/hq-b.json 1920x1080 high 4
bash tools/hq-shots.sh tools/shotsets/floor1.json 1920x1080 high 4
bash tools/hq-shots.sh tools/shotsets/corrgood.json 1920x1080 high 3

# downscale into the repo
mkdir -p docs/screenshots
for f in captures/hi-*.png; do
  convert "$f" -resize 1600x900 -quality 92 "docs/screenshots/$(basename "$f" .png).jpg"
done
```
