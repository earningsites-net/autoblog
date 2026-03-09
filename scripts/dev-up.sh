#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="${ROOT_DIR}/.dev/runtime"
LOG_DIR="${ROOT_DIR}/.dev/logs"
N8N_DIR="${ROOT_DIR}/infra/n8n"
N8N_ENV_FILE="${N8N_DIR}/.env"

NO_DOCKER=0
FRESH=0
N8N_PORT_VALUE="5678"

usage() {
  cat <<'EOF'
Usage: scripts/dev-up.sh [--no-docker] [--fresh]

Options:
  --no-docker   Do not run docker compose up for n8n/postgres
  --fresh       Stop existing local dev processes before starting
  -h, --help    Show this help
EOF
}

ensure_node_version() {
  local nvm_sh
  if [[ -n "${NVM_DIR:-}" && -f "${NVM_DIR}/nvm.sh" ]]; then
    # shellcheck source=/dev/null
    source "${NVM_DIR}/nvm.sh" >/dev/null 2>&1 || true
  else
    for nvm_sh in "$HOME/.nvm/nvm.sh" "/opt/homebrew/opt/nvm/nvm.sh" "/usr/local/opt/nvm/nvm.sh"; do
      if [[ -f "$nvm_sh" ]]; then
        # shellcheck source=/dev/null
        source "$nvm_sh" >/dev/null 2>&1 || true
        break
      fi
    done
  fi

  if command -v nvm >/dev/null 2>&1; then
    nvm use --silent >/dev/null 2>&1 || true
  fi

  local node_version_raw
  local node_major
  node_version_raw="$(node -v 2>/dev/null || true)"
  if [[ -z "$node_version_raw" ]]; then
    echo "[error] Node.js is not available in PATH." >&2
    echo "        Install Node.js 22+ and retry." >&2
    exit 1
  fi

  node_major="$(echo "$node_version_raw" | sed -E 's/^v([0-9]+).*/\1/')"
  if [[ -z "$node_major" || "$node_major" -lt 22 ]]; then
    echo "[error] Node.js ${node_version_raw} detected. This project requires Node.js 22+." >&2
    echo "        Run your version manager (for example: nvm use 22) and retry." >&2
    exit 1
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-docker)
      NO_DOCKER=1
      shift
      ;;
    --fresh)
      FRESH=1
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

mkdir -p "$RUNTIME_DIR" "$LOG_DIR"
ensure_node_version

if [[ -f "$N8N_ENV_FILE" ]]; then
  parsed_port="$(grep -E '^N8N_PORT=' "$N8N_ENV_FILE" | tail -n 1 | cut -d '=' -f 2- | tr -d '"' | tr -d "'" | tr -d '[:space:]' || true)"
  if [[ -n "${parsed_port}" ]]; then
    N8N_PORT_VALUE="$parsed_port"
  fi
fi

cleanup_stale_pid() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    rm -f "$pid_file"
  fi
  return 1
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

ensure_port_available() {
  local name="$1"
  local port="$2"
  local pid
  pid="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -n 1 || true)"
  if [[ -z "$pid" ]]; then
    return 0
  fi

  if is_workspace_pid "$pid"; then
    echo "[warn] ${name} port ${port} already used by orphan workspace process (pid ${pid}), stopping it"
    kill "$pid" 2>/dev/null || true
    sleep 0.2
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
    return 0
  fi

  echo "[error] ${name} cannot start: port ${port} is used by external pid ${pid}" >&2
  echo "        stop that process or run your service on a different port." >&2
  exit 1
}

start_service() {
  local name="$1"
  local command="$2"
  local pid_file="${RUNTIME_DIR}/${name}.pid"
  local log_file="${LOG_DIR}/${name}.log"
  local node_bin
  local node_dir
  local wrapped_command

  node_bin="$(command -v node 2>/dev/null || true)"
  node_dir="$(dirname "$node_bin")"
  wrapped_command="export PATH=\"${node_dir}:\$PATH\"; hash -r; ${command}"

  if cleanup_stale_pid "$pid_file"; then
    echo "[skip] ${name} already running (pid $(cat "$pid_file"))"
    return 0
  fi

  echo "[start] ${name}"
  (
    cd "$ROOT_DIR"
    nohup /bin/zsh -lc "$wrapped_command" >"$log_file" 2>&1 &
    echo "$!" >"$pid_file"
  )

  sleep 1
  local pid
  pid="$(cat "$pid_file")"
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "[error] ${name} failed to start. Check ${log_file}" >&2
    tail -n 40 "$log_file" >&2 || true
    exit 1
  fi
  echo "[ok] ${name} running (pid ${pid})"
}

if [[ $FRESH -eq 1 ]]; then
  echo "[info] fresh mode enabled, stopping current local processes first"
  "${ROOT_DIR}/scripts/dev-down.sh" --keep-docker || true
fi

if [[ $NO_DOCKER -eq 0 ]]; then
  echo "[start] n8n + postgres (docker compose)"
  (
    cd "$N8N_DIR"
    docker compose up -d
  )
  echo "[ok] docker services started"
else
  echo "[skip] docker start disabled (--no-docker)"
fi

ensure_port_available "web" 3000
ensure_port_available "studio" 3333
ensure_port_available "engine" 8787

start_service "web" "npm --workspace @autoblog/web run dev -- --hostname 0.0.0.0 --port 3000"
start_service "studio" "npm run dev:studio"
start_service "engine" "npm run dev:engine"

cat <<EOF

All local services are up.

URLs:
- Web:          http://localhost:3000
- Studio:       http://localhost:3333
- Engine API:   http://localhost:8787
- Factory UI:   http://localhost:8787/ops/factory
- n8n:          http://localhost:${N8N_PORT_VALUE}

Logs:
- ${LOG_DIR}/web.log
- ${LOG_DIR}/studio.log
- ${LOG_DIR}/engine.log

Stop everything:
- ${ROOT_DIR}/scripts/dev-down.sh
EOF
