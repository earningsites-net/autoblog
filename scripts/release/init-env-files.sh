#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FORCE="${FORCE:-false}"

copy_file() {
  local src="$1"
  local dest="$2"
  if [[ ! -f "$src" ]]; then
    echo "[skip] missing source: $src"
    return
  fi
  if [[ -f "$dest" && "$FORCE" != "true" ]]; then
    echo "[keep] $dest (already exists)"
    return
  fi
  cp "$src" "$dest"
  echo "[write] $dest"
}

copy_file "$ROOT_DIR/.env.example" "$ROOT_DIR/.env.staging"
copy_file "$ROOT_DIR/.env.example" "$ROOT_DIR/.env.production"
copy_file "$ROOT_DIR/infra/n8n/.env.example" "$ROOT_DIR/infra/n8n/.env.staging"
copy_file "$ROOT_DIR/infra/n8n/.env.example" "$ROOT_DIR/infra/n8n/.env.production"

echo "Done. Fill staging/production env values before running release checks."
