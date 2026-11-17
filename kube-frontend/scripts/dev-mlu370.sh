#!/usr/bin/env bash
#
# Local development against a deployed console.
#
# The new console is now served by ks-console, so a local checkout does not need a
# BFF, an SSH tunnel, or a retrying proxy: it needs a static server for the build
# and a backend to talk to. Every request goes straight to that backend.
#
#   1. static server   serves the build and forwards `/kube-frontend/*` to (2)
#   2. backend         the deployed console (ks-console), which forwards the API
#                      prefixes to ks-apiserver and answers the build itself
#
# Two processes instead of four, and the backend is the same binary and config as
# production — so a local check exercises the real routing rather than a copy of it.
#
# Usage:
#   scripts/dev-mlu370.sh start     # build the SPA if needed, then start
#   scripts/dev-mlu370.sh stop
#   scripts/dev-mlu370.sh status
#   scripts/dev-mlu370.sh restart
#
# Override with KA_BACKEND / WEB_PORT.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE="$ROOT/.dev-mlu370"

# The deployed console. `ka.watering.ai` is reachable directly (measured 2026-11-18:
# `/kapis/version` answers 200 in ~0.24s), so no tunnel is involved.
KA_BACKEND="${KA_BACKEND:-https://ka.watering.ai}"
WEB_PORT="${WEB_PORT:-5178}"
DIST="$ROOT/apps/console-next/dist"

log() { printf '\033[36m[dev]\033[0m %s\n' "$*"; }
fail() { printf '\033[31m[dev]\033[0m %s\n' "$*" >&2; exit 1; }

port_pid() { lsof -ti:"$1" 2>/dev/null | head -1 || true; }

wait_for() {
  local url="$1" label="$2" i
  for i in $(seq 1 40); do
    if curl -s -o /dev/null -m 2 "$url" 2>/dev/null; then return 0; fi
    sleep 1
  done
  fail "$label did not answer at $url"
}

# Fail with the address named: "the list is empty" is the symptom of an
# unreachable backend, and that reads as a product bug rather than a network one.
probe_backend() {
  local url="$KA_BACKEND/kube-frontend/kapis/version"
  local code
  code="$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$url" 2>/dev/null || echo 000)"
  if [[ "$code" == "000" ]]; then
    fail "backend unreachable: $url (check KA_BACKEND=$KA_BACKEND)"
  fi
  log "backend $KA_BACKEND (kapis/version -> HTTP $code)"
}

cmd_stop() {
  local file="$STATE/web.pid"
  if [ -f "$file" ]; then
    local pid
    pid="$(cat "$file")"
    if kill -0 "$pid" 2>/dev/null; then
      pkill -P "$pid" 2>/dev/null || true
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$file"
    log "stopped static server"
  fi
  local stray
  stray="$(port_pid "$WEB_PORT")"
  if [ -n "$stray" ]; then
    kill "$stray" 2>/dev/null && log "released port $WEB_PORT"
  fi
}

cmd_start() {
  mkdir -p "$STATE"

  probe_backend

  if [ ! -f "$DIST/index.html" ]; then
    fail "no build at $DIST; run: pnpm --filter @kube-ai-hub/console-next build"
  fi

  node "$ROOT/scripts/dev-static-server.mjs" "$DIST" "$WEB_PORT" "$KA_BACKEND" \
    </dev/null >"$STATE/web.log" 2>&1 &
  echo $! >"$STATE/web.pid"
  wait_for "http://127.0.0.1:$WEB_PORT/" "static server"

  log "web http://localhost:$WEB_PORT/kube-frontend/clusters"
  log "login: admin / Kah@2025 (see 环境/mlu370环境.md)"
}

cmd_status() {
  printf '%-8s %-6s %s\n' component port state
  local pid
  pid="$(port_pid "$WEB_PORT")"
  printf '%-8s %-6s %s\n' web "$WEB_PORT" "${pid:-DOWN}"
  printf '%-8s %-6s %s\n' backend - "$KA_BACKEND"
}

case "${1:-start}" in
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  restart) cmd_stop; sleep 1; cmd_start ;;
  status)  cmd_status ;;
  *)       fail "usage: $0 {start|stop|restart|status}" ;;
esac
