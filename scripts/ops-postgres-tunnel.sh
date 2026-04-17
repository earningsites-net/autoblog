#!/usr/bin/env bash
set -euo pipefail

HOST=""
IDENTITY="${HOME}/.ssh/autoblog_ionos"
LOCAL_PORT="15432"
REMOTE_PORT="5432"
CONNECT_TIMEOUT="10"

usage() {
  cat <<'EOF'
Usage: scripts/ops-postgres-tunnel.sh --host <user@tailscale-host-or-ip> [options]

Open a local SSH tunnel to the production Postgres bound on the VPS loopback so
admin tools like DBeaver can connect without exposing the database publicly.

Options:
  --host <user@host>           Required. Example: autoblog@autoblog-ops-prod.tail2bbeab.ts.net
  --identity <path>            Optional SSH identity file. Default: ~/.ssh/autoblog_ionos
  --local-port <port>          Local port to bind. Default: 15432
  --remote-port <port>         Remote Postgres port. Default: 5432
  --connect-timeout <seconds>  SSH connect timeout. Default: 10
  -h, --help                   Show this help

Example:
  scripts/ops-postgres-tunnel.sh --host autoblog@autoblog-ops-prod.tail2bbeab.ts.net
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      HOST="${2:?missing value for --host}"
      shift 2
      ;;
    --identity)
      IDENTITY="${2:?missing value for --identity}"
      shift 2
      ;;
    --local-port)
      LOCAL_PORT="${2:?missing value for --local-port}"
      shift 2
      ;;
    --remote-port)
      REMOTE_PORT="${2:?missing value for --remote-port}"
      shift 2
      ;;
    --connect-timeout)
      CONNECT_TIMEOUT="${2:?missing value for --connect-timeout}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$HOST" ]]; then
  echo "--host is required" >&2
  usage >&2
  exit 1
fi

ssh_args=(
  -o ExitOnForwardFailure=yes
  -o ConnectTimeout="${CONNECT_TIMEOUT}"
  -N
  -L "127.0.0.1:${LOCAL_PORT}:127.0.0.1:${REMOTE_PORT}"
)

if [[ -n "$IDENTITY" && -f "$IDENTITY" ]]; then
  ssh_args+=(-i "$IDENTITY")
fi

echo "[info] Postgres tunnel target: ${HOST}"
echo "[info] Open once connected: 127.0.0.1:${LOCAL_PORT}"

exec ssh "${ssh_args[@]}" "$HOST"
