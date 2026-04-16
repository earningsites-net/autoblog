#!/usr/bin/env bash
set -euo pipefail

HOST=""
IDENTITY="${HOME}/.ssh/autoblog_ionos"
LOCAL_PORT="8788"
REMOTE_PORT="8787"
CONNECT_TIMEOUT="10"

usage() {
  cat <<'EOF'
Usage: scripts/ops-factory-tunnel.sh --host <user@tailscale-host-or-ip> [options]

Open a local SSH tunnel to the production engine so `/ops/factory` can be used
without exposing the route on the public nginx entrypoint.

Options:
  --host <user@host>           Required. Example: autoblog@100.101.102.103
  --identity <path>            Optional SSH identity file. Default: ~/.ssh/autoblog_ionos
  --local-port <port>          Local port to bind. Default: 8788
  --remote-port <port>         Remote engine port. Default: 8787
  --connect-timeout <seconds>  SSH connect timeout. Default: 10
  -h, --help                   Show this help

Example:
  scripts/ops-factory-tunnel.sh --host autoblog@100.101.102.103
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

echo "[info] Factory tunnel target: ${HOST}"
echo "[info] Open once connected: http://127.0.0.1:${LOCAL_PORT}/ops/factory"

exec ssh "${ssh_args[@]}" "$HOST"

