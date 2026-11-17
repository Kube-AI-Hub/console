#!/usr/bin/env bash
#
# Local full stack against the mlu370 lab cluster.
#
# mlu370 (`ssh cam`) is a single-node control plane whose `ks-apiserver` is a
# ClusterIP only, so a local checkout cannot reach it without a tunnel. This
# wraps the four hops the manual setup needed:
#
#   1. ssh -L        cam's cluster IP:80 -> 127.0.0.1:$TUNNEL_PORT
#   2. tunnel-proxy  keeps a listening socket alive across ssh reconnects, so a
#                    dropped tunnel becomes a slow request instead of a 502
#   3. BFF           kapis mode; injects the oauth client the apiserver expects
#   4. static server the built SPA, forwarding /kapis and /api to (3)
#
# The stack answers on the same URL as the B200 setup it replaces, so existing
# bookmarks and the notes in 环境/mlu370环境.md keep working.
#
# Usage:
#   scripts/dev-mlu370.sh start     # build the SPA if needed, then start all four
#   scripts/dev-mlu370.sh stop
#   scripts/dev-mlu370.sh status
#   scripts/dev-mlu370.sh restart
#
# Override with TUNNEL_PORT / PROXY_PORT / BFF_PORT / WEB_PORT / MLU_HOST.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/.." && pwd)"
STATE="$ROOT/.dev-mlu370"

MLU_HOST="${MLU_HOST:-cam}"
WEB_PORT="${WEB_PORT:-5178}"
BFF_PORT="${BFF_PORT:-8098}"
PROXY_PORT="${PROXY_PORT:-18098}"
TUNNEL_PORT="${TUNNEL_PORT:-18099}"
DIST="$ROOT/apps/console-next/dist"

log() { printf '\033[36m[mlu370]\033[0m %s\n' "$*"; }
fail() { printf '\033[31m[mlu370]\033[0m %s\n' "$*" >&2; exit 1; }

port_pid() { lsof -ti:"$1" 2>/dev/null | head -1 || true; }

wait_for() {
  local url="$1" label="$2" i
  for i in $(seq 1 40); do
    if curl -s -o /dev/null -m 2 "$url" 2>/dev/null; then return 0; fi
    sleep 1
  done
  fail "$label did not answer at $url"
}

# The apiserver is a ClusterIP. Ask the node for its address rather than
# hardcoding it: the service was recreated once already and the IP moved.
resolve_upstream() {
  ssh -o ConnectTimeout=10 -o BatchMode=yes "$MLU_HOST" \
    "kubectl -n kubesphere-system get svc ks-apiserver -o jsonpath='{.spec.clusterIP}'" 2>/dev/null
}

stop_one() {
  local name="$1" file="$STATE/$1.pid"
  [ -f "$file" ] || return 0
  local pid; pid="$(cat "$file")"
  if kill -0 "$pid" 2>/dev/null; then
    # `pnpm dev` spawns tsx which spawns node; killing the parent leaves the
    # child holding the port. Take the whole tree down.
    pkill -P "$pid" 2>/dev/null || true
    kill "$pid" 2>/dev/null || true
  fi
  rm -f "$file"
  log "stopped $name"
}

cmd_stop() {
  for name in web bff proxy tunnel; do stop_one "$name"; done
  sleep 1
  # Anything still holding one of our ports is a straggler from an earlier run
  # (a pnpm grandchild, or a stack started before the pid files existed).
  for port in "$WEB_PORT" "$BFF_PORT" "$PROXY_PORT" "$TUNNEL_PORT"; do
    local pid; pid="$(port_pid "$port")"
    if [ -n "$pid" ]; then
      pkill -P "$pid" 2>/dev/null || true
      kill "$pid" 2>/dev/null && log "released port $port"
    fi
  done
  return 0
}

cmd_start() {
  mkdir -p "$STATE"

  local upstream
  upstream="$(resolve_upstream)"
  [ -n "$upstream" ] || fail "cannot read ks-apiserver ClusterIP over ssh $MLU_HOST"
  log "upstream ks-apiserver $upstream"

  # 1. ssh tunnel. ExitOnForwardFailure makes a port clash fail loudly instead
  #    of silently leaving a dead forward behind.
  ssh -o ExitOnForwardFailure=yes -o ConnectTimeout=10 \
      -o ServerAliveInterval=5 -o ServerAliveCountMax=2 \
      -N -L "$TUNNEL_PORT:$upstream:80" "$MLU_HOST" </dev/null >"$STATE/tunnel.log" 2>&1 &
  echo $! >"$STATE/tunnel.pid"
  wait_for "http://127.0.0.1:$TUNNEL_PORT/version" "tunnel"
  log "tunnel 127.0.0.1:$TUNNEL_PORT -> $MLU_HOST:$upstream:80"

  # 2. retrying proxy: the lab link drops, and without this every drop surfaces
  #    as a 502 that looks like a product bug.
  node "$REPO_ROOT/tests/ui/tools/tunnel-proxy.mjs" \
    --listen "$PROXY_PORT" --upstream "$TUNNEL_PORT" </dev/null >"$STATE/proxy.log" 2>&1 &
  echo $! >"$STATE/proxy.pid"
  wait_for "http://127.0.0.1:$PROXY_PORT/version" "tunnel proxy"
  log "proxy 127.0.0.1:$PROXY_PORT"

  # 3. BFF in kapis mode. It needs a real KS_API_URL: the kube mode uses local
  #    kubectl credentials and cannot answer "is this request correct".
  ( cd "$ROOT/server" && \
    KS_API_MODE=kapis KS_API_URL="http://127.0.0.1:$PROXY_PORT" BFF_PORT="$BFF_PORT" \
    nohup pnpm dev </dev/null >"$STATE/bff.log" 2>&1 & echo $! >"$STATE/bff.pid" )
  wait_for "http://127.0.0.1:$BFF_PORT/api/ai/manifest" "BFF"
  log "bff 127.0.0.1:$BFF_PORT"

  # 4. static server. A stale dist silently serves the previous build, so the
  #    caller decides whether to rebuild; we only warn.
  if [ ! -f "$DIST/index.html" ]; then
    fail "no build at $DIST; run: pnpm --filter @kube-ai-hub/console-next build"
  fi
  node "$ROOT/scripts/dev-static-server.mjs" "$DIST" "$WEB_PORT" "http://127.0.0.1:$BFF_PORT" \
    </dev/null >"$STATE/web.log" 2>&1 &
  echo $! >"$STATE/web.pid"
  wait_for "http://127.0.0.1:$WEB_PORT/" "static server"
  log "web http://localhost:$WEB_PORT/kube-frontend/clusters"

  log "login: admin / Kah@2025 (see 环境/mlu370环境.md)"
}

cmd_status() {
  printf '%-10s %-6s %s\n' component port state
  for pair in "web:$WEB_PORT" "bff:$BFF_PORT" "proxy:$PROXY_PORT" "tunnel:$TUNNEL_PORT"; do
    local name="${pair%%:*}" port="${pair##*:}" pid
    pid="$(port_pid "$port")"
    printf '%-10s %-6s %s\n' "$name" "$port" "${pid:-DOWN}"
  done
  local upstream; upstream="$(resolve_upstream)"
  printf '%-10s %-6s %s\n' upstream "$TUNNEL_PORT" "${upstream:-UNREACHABLE}"
}

case "${1:-start}" in
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  restart) cmd_stop; sleep 1; cmd_start ;;
  status)  cmd_status ;;
  *)       fail "usage: $0 {start|stop|restart|status}" ;;
esac
