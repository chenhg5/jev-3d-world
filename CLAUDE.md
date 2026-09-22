# Claude Code instructions

Read and follow [`AGENTS.md`](./AGENTS.md) before changing or running this project. It contains the complete setup, API-key, test, build, and deployment instructions.

Quick start from this repository root:

```sh
npm --prefix web ci
./scripts/start-scene.sh
```

The start script expects `TYPESAFE_API_KEY` in the environment or at `~/.config/typesafe-ai/api-key`, builds `web/dist`, and starts the full application at <http://127.0.0.1:8788>.

Before committing:

```sh
go test ./...
npm --prefix web test
npm --prefix web run build
git diff --check
```

Keep secrets and generated files out of Git. This `chenhg5/jev-3d-world` repository and the internal `Tamar-Edge-AI/jev-explore/jev-3d-gen` example are maintained independently; never copy or push changes between them unless the user explicitly requests it.

