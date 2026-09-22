# Jev 3D World contributor guide

## Repository scope

This repository is the independently maintained `chenhg5/jev-3d-world` copy. Do not assume changes from `Tamar-Edge-AI/jev-explore/jev-3d-gen` are present, and do not synchronize either repository automatically. Apply, test, commit, and push changes in this repository explicitly.

Run every command below from the repository root.

## Requirements

- Go 1.25 or newer
- Node.js 20.19+ or 22.12+
- npm
- A TypeSafe/Jev API key

## Configure the Jev API key

The Go server reads `TYPESAFE_API_KEY`. Never put a real key in this repository, frontend code, logs, screenshots, commits, or issue text.

For one terminal session:

```sh
export TYPESAFE_API_KEY="YOUR_TYPESAFE_API_KEY"
```

For the project start script, the preferred persistent local location is:

```text
~/.config/typesafe-ai/api-key
```

Create it with owner-only permissions:

```sh
install -d -m 700 ~/.config/typesafe-ai
read -s TYPESAFE_API_KEY
printf '%s' "$TYPESAFE_API_KEY" > ~/.config/typesafe-ai/api-key
chmod 600 ~/.config/typesafe-ai/api-key
unset TYPESAFE_API_KEY
```

If `XDG_CONFIG_HOME` is set, the script reads `$XDG_CONFIG_HOME/typesafe-ai/api-key` instead.

## Install and start locally

Install frontend dependencies once:

```sh
npm --prefix web ci
```

The normal full-stack startup builds the frontend and starts the Go server:

```sh
./scripts/start-scene.sh
```

Open <http://127.0.0.1:8788>. The script loads the local key file when `TYPESAFE_API_KEY` is not already set.

To run the steps manually:

```sh
npm --prefix web run build
export TYPESAFE_API_KEY="YOUR_TYPESAFE_API_KEY"
go run ./cmd/scene-web
```

The Go process serves both `/api/*` and the built files in `web/dist`. After frontend changes, rebuild and refresh. After Go changes, restart the Go process.

For frontend-only visual work, `npm --prefix web run dev` starts Vite on port 5173. The production API is same-origin, so use the full-stack server on port 8788 when testing Jev composition calls.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `TYPESAFE_API_KEY` | Loaded by the start script from the local key file | Jev authentication |
| `SCENE_ADDR` | `127.0.0.1:8788` | Go HTTP listen address |
| `SCENE_WEB_DIR` | `web/dist` | Built frontend directory served by Go |

## Tests and production build

```sh
go test ./...
npm --prefix web test
npm --prefix web run build
```

Run all three before committing changes that affect the corresponding code. `web/dist`, `node_modules`, `.local`, `.env*`, logs, and key files are local artifacts and must remain untracked.

## Local production-style deployment

```sh
npm --prefix web ci
npm --prefix web run build
go build -o bin/scene-web ./cmd/scene-web
TYPESAFE_API_KEY="YOUR_TYPESAFE_API_KEY" ./bin/scene-web
```

Run the binary from the repository root, or set `SCENE_WEB_DIR` to an absolute path to `web/dist`. Bind beyond localhost only when intentionally exposing the service, for example `SCENE_ADDR=0.0.0.0:8788`.

## Code layout

- `cmd/scene-web`: HTTP server and `/api/compose`
- `scene`: finite Jev scene decisions, catalog, additions, and tests
- root Go files: shared Jev client and typed finite-choice runtime
- `web/src`: Three.js renderer, editor, explorer, assets, layout, and tests
- `scripts/start-scene.sh`: frontend build plus Go startup

