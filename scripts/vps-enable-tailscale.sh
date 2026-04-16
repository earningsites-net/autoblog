#!/usr/bin/env bash
set -euo pipefail

DEFAULT_HOST="root@87.106.29.31"
DEFAULT_IDENTITY="${HOME}/.ssh/autoblog_ionos"
DEFAULT_HOSTNAME="autoblog-ops-prod"
DEFAULT_TIMEOUT=10

HOST="$DEFAULT_HOST"
IDENTITY="$DEFAULT_IDENTITY"
TAILSCALE_HOSTNAME="$DEFAULT_HOSTNAME"
TAILSCALE_AUTH_KEY=""
TAILSCALE_LOGIN_SERVER=""
CONNECT_TIMEOUT="$DEFAULT_TIMEOUT"

usage() {
  cat <<'EOF'
Usage: scripts/vps-enable-tailscale.sh [options]

Install and bootstrap Tailscale on the production VPS over SSH.
If --auth-key is omitted, the script installs Tailscale and prints the
interactive `tailscale up ...` command to finish manually on the server.

Options:
  --host <user@host>           SSH target. Default: root@87.106.29.31
  --identity <path>            SSH identity file. Default: ~/.ssh/autoblog_ionos
  --hostname <name>            Tailscale hostname for the VPS. Default: autoblog-ops-prod
  --auth-key <tskey-...>       Optional Tailscale auth key for unattended login
  --login-server <url>         Optional custom control server URL
  --connect-timeout <seconds>  SSH connect timeout. Default: 10
  -h, --help                   Show this help

Examples:
  scripts/vps-enable-tailscale.sh
  scripts/vps-enable-tailscale.sh --auth-key tskey-abcdef123456
  scripts/vps-enable-tailscale.sh --host autoblog@100.64.0.10 --identity ~/.ssh/autoblog_ionos
EOF
}

quote_remote_arg() {
  printf "%q" "$1"
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
    --hostname)
      TAILSCALE_HOSTNAME="${2:?missing value for --hostname}"
      shift 2
      ;;
    --auth-key)
      TAILSCALE_AUTH_KEY="${2:?missing value for --auth-key}"
      shift 2
      ;;
    --login-server)
      TAILSCALE_LOGIN_SERVER="${2:?missing value for --login-server}"
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

ssh_args=(
  -o BatchMode=yes
  -o ConnectTimeout="${CONNECT_TIMEOUT}"
)

if [[ -n "$IDENTITY" ]]; then
  ssh_args+=(-i "$IDENTITY")
fi

remote_args=(
  "$TAILSCALE_HOSTNAME"
  "$TAILSCALE_AUTH_KEY"
  "$TAILSCALE_LOGIN_SERVER"
)

remote_arg_string=""
for arg in "${remote_args[@]}"; do
  if [[ -n "$remote_arg_string" ]]; then
    remote_arg_string+=" "
  fi
  remote_arg_string+="$(quote_remote_arg "$arg")"
done

echo "[info] Connecting to ${HOST}"
echo "[info] Target Tailscale hostname: ${TAILSCALE_HOSTNAME}"
if [[ -n "$TAILSCALE_AUTH_KEY" ]]; then
  echo "[info] Using auth key for unattended bootstrap"
else
  echo "[info] No auth key provided; install will be unattended but login remains interactive"
fi

ssh "${ssh_args[@]}" "$HOST" "bash -s -- ${remote_arg_string}" <<'REMOTE'
#!/usr/bin/env bash
set -euo pipefail

TAILSCALE_HOSTNAME="${1:-autoblog-ops-prod}"
TAILSCALE_AUTH_KEY="${2:-}"
TAILSCALE_LOGIN_SERVER="${3:-}"
export DEBIAN_FRONTEND=noninteractive

join_command() {
  local out=""
  local arg
  for arg in "$@"; do
    if [[ -n "$out" ]]; then
      out+=" "
    fi
    out+="$(printf "%q" "$arg")"
  done
  printf '%s\n' "$out"
}

ensure_binary() {
  local bin="$1"
  local package="$2"
  if command -v "$bin" >/dev/null 2>&1; then
    return 0
  fi
  apt-get update
  apt-get install -y "$package"
}

ensure_binary curl curl
ensure_binary systemctl systemd

if ! command -v tailscale >/dev/null 2>&1; then
  echo "[start] Installing Tailscale"
  curl -fsSL https://tailscale.com/install.sh | sh
else
  echo "[skip] Tailscale already installed"
fi

echo "[start] Enabling tailscaled"
systemctl enable --now tailscaled
systemctl is-active --quiet tailscaled
echo "[ok] tailscaled is running"

if tailscale ip -4 >/dev/null 2>&1; then
  echo "[skip] Tailscale already connected"
else
  up_args=(tailscale up --hostname "$TAILSCALE_HOSTNAME" --accept-dns=true --accept-routes=false)
  if [[ -n "$TAILSCALE_LOGIN_SERVER" ]]; then
    up_args+=(--login-server "$TAILSCALE_LOGIN_SERVER")
  fi

  if [[ -n "$TAILSCALE_AUTH_KEY" ]]; then
    echo "[start] Registering the VPS in the tailnet"
    "${up_args[@]}" --auth-key "$TAILSCALE_AUTH_KEY"
    echo "[ok] Tailscale login completed via auth key"
  else
    echo "[next] Finish the login manually from the VPS shell with:"
    join_command "${up_args[@]}"
  fi
fi

echo "[info] tailscale status"
tailscale status || true
echo "[info] tailscale IPv4"
tailscale ip -4 || true
REMOTE

