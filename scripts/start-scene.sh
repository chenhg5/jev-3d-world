#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_dir"

if [[ -z "${TYPESAFE_API_KEY:-}" ]]; then
  key_file="${XDG_CONFIG_HOME:-${HOME}/.config}/typesafe-ai/api-key"
  if [[ -f "$key_file" ]]; then
    export TYPESAFE_API_KEY="$(<"$key_file")"
  fi
fi

if [[ -z "${TYPESAFE_API_KEY:-}" ]]; then
  echo "TYPESAFE_API_KEY is required (or store it at ~/.config/typesafe-ai/api-key)" >&2
  exit 1
fi

npm --prefix web run build
exec go run ./cmd/scene-web
