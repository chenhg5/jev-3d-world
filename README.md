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
- Layout based on object dimensions, collision avoidance, semantic grouping,
  road clearance and shoreline constraints.
- Daylight, sunset, night, weather effects and optional full or crescent moons.
  Daytime scenes do not infer a moon from a festival alone.
- Orbit and zoom controls, searchable asset previews, example prompts and
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
5. The browser builds the models, normalizes their scale, packs the scene, and
   frames the camera. The moon has a fixed position above the scene.

The catalog is finite: this demo combines prepared procedural models rather
than generating arbitrary geometry. More assets also mean more classification
questions and token usage. Request latency and interpretation quality vary.

## Development and checks

```sh
go test -race ./...
go vet ./...
npm --prefix web test
npm --prefix web run build
```

Tests use local fixtures and mock HTTP servers; they do not require an API key.
Frontend tests cover model geometry, scale, layout collisions, marine placement,
sky colors and moon position. Go tests cover the client, batching, counts and
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
