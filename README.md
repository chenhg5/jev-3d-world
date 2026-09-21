# Jev 3D World

Describe a scene in one sentence and explore it as an interactive 3D diorama.
Jev selects typed scene properties and objects; Three.js assembles the geometry
locally. No text-generating LLM is required.

## Features

- 112 procedural asset types: architecture, plants, terrain, people, animals,
  vehicles, boats, playground equipment and more.
- English and Chinese prompts, with quantities from 0 to 20 per asset type.
- Broad themes infer characteristic props; explicit inventories preserve named
  objects and counts. Model judgments can still make mistakes.
- Continuous terrain, distant hills, instanced grass and optional background
  woodland instead of a circular display base. Exact tree inventories suppress
  additional background trees.
- Activity-based layout: tents and chairs face a shared campfire, people gather
  near activity areas, tall vegetation frames the background, and furniture
  stays near buildings. Collision-aware paths connect accessible entrances.
- Separate urban road and railway corridors, sidewalks and shoreline constraints.
- Irregular stone-edged water features with animated ripples, larger lakes,
  layered pine foliage, gradient skies and ambient contact shadows.
- Daylight, sunset, night, weather effects and optional full or crescent moons.
  Daytime scenes do not infer a moon from a festival alone.
- Landscape/Overview camera controls, orbit, pan and zoom, searchable asset previews, example prompts and
  per-request timing and token usage.
- A fresh variation seed for each composition.

## Requirements

- Go 1.25 or newer
- Node.js 20.19+ or 22.12+ (Vite requirement)
- A TypeSafe/Jev API key

## Run locally

```sh
git clone git@github.com:chenhg5/jev-3d-world.git
cd jev-3d-world
npm --prefix web ci
export TYPESAFE_API_KEY="YOUR_TYPESAFE_API_KEY"
./scripts/start-scene.sh
```

Open <http://127.0.0.1:8788>.

Alternatively, the start script reads the key from
`~/.config/typesafe-ai/api-key` (or `$XDG_CONFIG_HOME/typesafe-ai/api-key`).
Keep this file outside the repository. The key is used only by the Go server
when calling TypeSafe; it is never sent to the browser.

Optional server configuration:

| Variable | Default | Purpose |
| --- | --- | --- |
| `TYPESAFE_API_KEY` | Local key file via start script | TypeSafe authentication |
| `SCENE_ADDR` | `127.0.0.1:8788` | HTTP listen address |
| `SCENE_WEB_DIR` | `web/dist` | Built frontend directory |

The start script builds the frontend and starts the server. After frontend
changes, rebuild with `npm --prefix web run build` and refresh the page. Restart
the server after Go changes.

## Example prompts

```text
A bright pastoral village with a windmill, a pond, outdoor tables and five trees under clear daylight.
An island with three palm trees, a lighthouse and two sailboats.
出去外面露营的场景
中秋节，但是是白天
```

## How it works

1. The Go server asks Jev to classify the request as a theme, an object inventory,
   or an empty landscape, and identify explicit moon instructions.
2. Independent Choice questions select environment, lighting, camera,
   composition, palette, terrain, atmosphere, moon phase, and asset quantities
   and placement preferences.
3. These questions are split into six bounded batches of at most 40 questions,
   with up to three requests in flight. Including intent classification, a
   composition uses seven API requests. The page reports their combined usage.
4. The server validates the offered choices and reconciles moon visibility with
   explicit instructions and time of day.
5. The browser builds the models, normalizes their scale, packs the activity
   areas, routes paths around obstacles and builds the surrounding terrain.
   The moon has a fixed position above the scene.

The world uses a finite terrain patch with distant fog, not infinite streaming
terrain. Camera controls explore the scene through orbit and pan rather than
first-person walking. Water uses stylized animated highlights, not physical
reflections. Paths may be omitted when no accessible route exists.

The catalog is finite: this demo combines prepared procedural models rather
than generating arbitrary geometry. More assets also mean more classification
questions and token usage. Request latency and interpretation quality vary.

## Adjusting a scene

Click and drag an individual generated asset to move it along the terrain.
A selection box and object name identify what you are moving. Drag empty space
(or Alt-drag) to orbit, right-drag to pan, and scroll to zoom. With the canvas
focused, arrow keys fine-tune the selection; Shift increases the step.
A floating toolbar follows the selected object. Use **− / +** to resize in
10-percentage-point steps and **↶ / ↷** to rotate in 15° steps; hold a button
for repeated adjustments. The toolbar stays put while you operate it and avoids
the viewport edges. **Fine tune** reveals the **Size** (25–400%) and
**Rotation** (0–359°) sliders.
Scaling keeps the object grounded and updates its collision footprint.
**Reset object** restores its generated position, size and orientation, and Escape cancels
an active drag or clears the selection. Walking paths are recalculated on drop.
These edits stay in the current scene only: refreshing or generating a new scene
clears them. Background terrain and decorative forest are not selectable.

## Adding to an existing scene

Choose **Add to scene**, then describe only the additions, for example:
“在池塘右边追加两棵樱花树，帐篷前面加一张长椅”. Jev receives the current inventory,
selects new counts, verifies additions and chooses references/directions. The
client packs those new objects around the current edited footprints; old models,
positions, scales, rotations, terrain and lighting are retained. The camera fits
both old and new objects. If there is no room, the scene stays unchanged.

**New scene** replaces the scene. Example presets also start a new scene.
Additions support 0–20 of each type per request, up to 400 total objects.
Natural-language deletion, transformations and lighting changes are not part of
append mode; use the object controls to transform an existing object. References
currently resolve to an existing asset type (the first instance if there are
several of that type), not arbitrary individual-object descriptions.

## Development and checks

```sh
go test -race ./...
go vet ./...
npm --prefix web test
npm --prefix web run build
```

Tests use local fixtures and mock HTTP servers; they do not require an API key.
Frontend tests cover model geometry, scale, activity layout, path obstruction,
terrain, marine placement, sky colors and moon position. Go tests cover the client, batching, counts and
scene constraints.

## Project layout

| Path | Purpose |
| --- | --- |
| `scene/` | Scene composition, shared asset catalog and tests |
| `cmd/scene-web/` | HTTP server and API |
| `web/src/` | Three.js models, layout, sky and interface |
| `scripts/start-scene.sh` | Local startup script |
| Root Go files | Shared Jev client and bounded action-loop primitives |

Built with [TypeSafe/Jev](https://typesafe.ai/),
[Three.js](https://threejs.org/) and [Vite](https://vite.dev/).
