#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="${ROOT_DIR}/.dev/runtime"
N8N_DIR="${ROOT_DIR}/infra/n8n"

KEEP_DOCKER=0

usage() {
  cat <<'EOF'
Usage: scripts/dev-down.sh [--keep-docker]

Options:
  --keep-docker Keep n8n/postgres docker services running
  -h, --help    Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep-docker)
      KEEP_DOCKER=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

stop_pid() {
  local name="$1"
  local pid_file="${RUNTIME_DIR}/${name}.pid"
  if [[ ! -f "$pid_file" ]]; then
    echo "[skip] ${name} not managed by pid file"
    return
  fi

  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [[ -z "$pid" ]]; then
    rm -f "$pid_file"
    echo "[skip] ${name} pid file empty"
    return
  fi

  if ! kill -0 "$pid" 2>/dev/null; then
    rm -f "$pid_file"
    echo "[skip] ${name} already stopped"
    return
  fi

  echo "[stop] ${name} (pid ${pid})"
  kill "$pid" 2>/dev/null || true

  for _ in {1..20}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      rm -f "$pid_file"
      echo "[ok] ${name} stopped"
      return
    fi
    sleep 0.25
  done

  echo "[warn] ${name} did not stop gracefully, sending SIGKILL"
  kill -9 "$pid" 2>/dev/null || true
  rm -f "$pid_file"
}

pid_cwd() {
  local pid="$1"
  lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1
}

is_workspace_pid() {
  local pid="$1"
  local cwd
  cwd="$(pid_cwd "$pid")"
  [[ -n "$cwd" && "$cwd" == "$ROOT_DIR"* ]]
}

stop_orphan_port() {
  local name="$1"
  local port="$2"
  local found=0
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    found=1
    if is_workspace_pid "$pid"; then
      echo "[stop] ${name} orphan on port ${port} (pid ${pid})"
      kill "$pid" 2>/dev/null || true
      sleep 0.2
      if kill -0 "$pid" 2>/dev/null; then
        echo "[warn] ${name} orphan still alive, sending SIGKILL (pid ${pid})"
        kill -9 "$pid" 2>/dev/null || true
      fi
    else
      echo "[warn] port ${port} in use by external pid ${pid} (not this workspace), skipping"
    fi
  done < <(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | sort -u || true)

  if [[ "$found" -eq 0 ]]; then
    echo "[skip] no listener on port ${port}"
  fi
}

stop_pid "web"
stop_pid "studio"
stop_pid "engine"

# Also clean up orphan listeners that are not tracked in runtime pid files.
stop_orphan_port "web" 3000
stop_orphan_port "studio" 3333
stop_orphan_port "engine" 8787

if [[ $KEEP_DOCKER -eq 0 ]]; then
  echo "[stop] docker compose (n8n + postgres)"
  (
    cd "$N8N_DIR"
    docker compose down
  )
  echo "[ok] docker services stopped"
else
  echo "[skip] docker stop disabled (--keep-docker)"
fi

echo "Done."
