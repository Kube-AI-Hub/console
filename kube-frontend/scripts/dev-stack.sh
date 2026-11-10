#!/usr/bin/env bash
#
# Local development stack for kube-frontend.
#
# Starts the three processes a manual check needs, in the order they depend on
# each other:
#
#   1. kubectl proxy   – forwards to the cluster with the operator's credentials
#   2. BFF             – /kapis and /api/v1 pass through to (1)
#   3. static server   – serves the built SPA and forwards those prefixes to (2)
#
# The BFF runs in `kube` mode by default because a local shell has no KubeSphere
# JWT: kapis requires one, while `kubectl proxy` speaks the plain kube API. That
# mode is a harness, not the product path — it ignores `page`/`limit` and has no
# `totalItems`, which the BFF emulates locally so paging can be exercised.
#
# Usage:
#   scripts/dev-stack.sh start    # build and start everything
#   scripts/dev-stack.sh stop     # stop the three processes
#   scripts/dev-stack.sh status   # show what is running and whether it answers
#   scripts/dev-stack.sh smoke    # run a create/read/update/delete cycle
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROXY_PORT="${PROXY_PORT:-8011}"
BFF_PORT="${BFF_PORT:-8091}"
WEB_PORT="${WEB_PORT:-5174}"
CLUSTER_MODE="${KS_API_MODE:-kube}"
NAMESPACE="${NAMESPACE:-kube-frontend-demo}"

KAPIS="/kapis/resources.kubesphere.io/v1alpha3"
PROXY_PID="$ROOT/.dev-stack-proxy.pid"
BFF_PID="$ROOT/.dev-stack-bff.pid"
WEB_PID="$ROOT/.dev-stack-web.pid"

log() { printf '\033[36m[dev-stack]\033[0m %s\n' "$*"; }
fail() { printf '\033[31m[dev-stack]\033[0m %s\n' "$*" >&2; exit 1; }

port_pid() { lsof -ti:"$1" 2>/dev/null | head -1 || true; }

stop_pidfile() {
  local file="$1" label="$2"
  [[ -f "$file" ]] || return 0
  local pid
  pid="$(cat "$file" 2>/dev/null || true)"
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    log "stopped $label (pid $pid)"
  fi
  rm -f "$file"
}

wait_for_http() {
  local url="$1" label="$2" attempts="${3:-60}"
  # Each attempt allows 10s: the first call through `kubectl proxy` pays for the
  # client's discovery, which on a large cluster takes seconds. A 2s timeout made
  # a healthy proxy look dead.
  for ((i = 0; i < attempts; i++)); do
    local code
    code="$(curl -s -o /dev/null -m 10 --max-time 12 -w '%{http_code}' "$url" 2>/dev/null || true)"
    if [[ "$code" != "000" && -n "$code" ]]; then
      log "$label ready (HTTP $code)"
      return 0
    fi
    sleep 0.5
  done
  return 1
}

build() {
  log "building ai-kit"
  (cd "$ROOT/../packages/ai-kit" && ./node_modules/.bin/vite build >/dev/null && ./node_modules/.bin/tsc -p tsconfig.build.json >/dev/null)
  log "building console-next"
  pnpm --filter @kube-ai-hub/console-next build >/dev/null
}

start() {
  stop >/dev/null 2>&1 || true
  build

  local upstream="${KS_API_URL:-}"
  if [[ "$CLUSTER_MODE" == "kapis" ]]; then
    # Product path: kapis needs a KubeSphere JWT and answers only through the
    # ingress. `kubectl proxy` is irrelevant here — it speaks the plain kube API
    # and would return 404 for `/kapis/...`.
    [[ -n "$upstream" ]] || fail "KS_API_MODE=kapis needs KS_API_URL (e.g. https://agentplatform.phanthy.com)"
    log "upstream $upstream (mode kapis; no kubectl proxy)"
  else
    log "starting kubectl proxy on 127.0.0.1:$PROXY_PORT"
    kubectl proxy --port="$PROXY_PORT" --address=127.0.0.1 >"$ROOT/.dev-stack-proxy.log" 2>&1 &
    echo $! >"$PROXY_PID"
    wait_for_http "http://127.0.0.1:$PROXY_PORT/api/v1/namespaces" "kubectl proxy" || fail "kubectl proxy did not answer; see .dev-stack-proxy.log"
    upstream="http://127.0.0.1:$PROXY_PORT"
  fi

  log "starting BFF on 127.0.0.1:$BFF_PORT (mode $CLUSTER_MODE)"
  (
    cd "$ROOT"
    KS_API_URL="$upstream" KS_API_MODE="$CLUSTER_MODE" BFF_PORT="$BFF_PORT" \
      nohup pnpm bff >"$ROOT/.dev-stack-bff.log" 2>&1 &
    echo $! >"$BFF_PID"
  )
  # In kapis mode an unauthenticated probe legitimately gets 403/404; any HTTP
  # status proves the process is listening, which is all this check should assert.
  wait_for_http "http://127.0.0.1:$BFF_PORT/kapis/version" "BFF" || fail "BFF did not answer; see .dev-stack-bff.log"

  log "starting static server on 127.0.0.1:$WEB_PORT"
  node "$ROOT/scripts/dev-static-server.mjs" "$ROOT/apps/console-next/dist" "$WEB_PORT" "http://127.0.0.1:$BFF_PORT" \
    >"$ROOT/.dev-stack-web.log" 2>&1 &
  echo $! >"$WEB_PID"
  wait_for_http "http://127.0.0.1:$WEB_PORT/" "static server" || fail "static server did not answer; see .dev-stack-web.log"

  cat <<EOF

  UI      http://127.0.0.1:$WEB_PORT/kube-frontend/system-workspace/clusters/host/projects/$NAMESPACE/configmaps
  BFF     http://127.0.0.1:$BFF_PORT
  mode    $CLUSTER_MODE
$([[ "$CLUSTER_MODE" == "kapis" ]] && echo "  upstream $upstream" || echo "  upstream $upstream (kubectl proxy)")

  In kapis mode the page needs a JWT in localStorage under \`kubesphere-token\`:
  copy it from the logged-in console (localStorage[\"kah_token\"]), for example

    localStorage.setItem('kubesphere-token', localStorage.getItem('kah_token'))

  logs    .dev-stack-{proxy,bff,web}.log

EOF
}

stop() {
  stop_pidfile "$WEB_PID" "static server"
  stop_pidfile "$BFF_PID" "BFF"
  stop_pidfile "$PROXY_PID" "kubectl proxy"
  # Ports outlive the pid files when a process was started by hand. The proxy
  # port is only touched in harness mode: in kapis mode something else may own it.
  local ports=("$WEB_PORT" "$BFF_PORT")
  [[ "$CLUSTER_MODE" == "kapis" ]] || ports+=("$PROXY_PORT")
  for port in "${ports[@]}"; do
    local pid
    pid="$(port_pid "$port")"
    [[ -n "$pid" ]] && kill "$pid" 2>/dev/null && log "freed port $port (pid $pid)"
  done
  return 0
}

# JWT for authenticated probes. Optional: in harness mode kapis is anonymous-free,
# in kapis mode every call needs it.
auth_header() {
  if [[ -n "${KAPIS_TOKEN:-}" ]]; then
    printf 'Authorization: Bearer %s' "$KAPIS_TOKEN"
  elif [[ -f /tmp/kf-jwt ]]; then
    printf 'Authorization: Bearer %s' "$(cat /tmp/kf-jwt)"
  fi
}

status() {
  for entry in "kubectl proxy:$PROXY_PORT" "BFF:$BFF_PORT" "web:$WEB_PORT"; do
    local label="${entry%%:*}" port="${entry##*:}" pid
    pid="$(port_pid "$port")"
    if [[ -n "$pid" ]]; then
      printf '  %-14s port %-5s pid %s\n' "$label" "$port" "$pid"
    else
      printf '  %-14s port %-5s %s\n' "$label" "$port" "not running"
    fi
  done
  printf '  BFF list probe: '
  curl -s -o /dev/null -w '%{http_code}\n' -m 20 --max-time 25 \
    ${KAPIS_TOKEN:+-H "Authorization: Bearer $KAPIS_TOKEN"} ${KAPIS_TOKEN:--H "Authorization: Bearer $(cat /tmp/kf-jwt 2>/dev/null)"} \
    "http://127.0.0.1:$BFF_PORT$KAPIS/namespaces/$NAMESPACE/configmaps?limit=1" 2>/dev/null || echo "no answer"
}

smoke() {
  # Reads go through kapis, writes through the plain kube API: the kapis resources
  # endpoint registers GET only and answers 405 to POST/PUT/PATCH/DELETE.
  local base="http://127.0.0.1:$BFF_PORT$KAPIS/namespaces/$NAMESPACE/configmaps"
  local write="http://127.0.0.1:$BFF_PORT/api/v1/namespaces/$NAMESPACE/configmaps"
  local name="dev-stack-smoke-$$"
  local rv

  local auth
  auth="$(auth_header)"
  local extra=()
  [[ -n "$auth" ]] && extra=(-H "$auth")

  printf '  list      '; curl -s -m 15 -o /dev/null -w '%{http_code}\n' "${extra[@]}" "$base?page=1&limit=5"
  printf '  create    '; curl -s -m 15 -o /dev/null -w '%{http_code}\n' "${extra[@]}" -X POST -H 'Content-Type: application/json' \
    -d "{\"apiVersion\":\"v1\",\"kind\":\"ConfigMap\",\"metadata\":{\"name\":\"$name\",\"namespace\":\"$NAMESPACE\",\"annotations\":{\"kubesphere.io/description\":\"smoke\"}},\"data\":{\"k\":\"v\"}}" "$write"
  printf '  read      '; rv="$(curl -s -m 15 "${extra[@]}" "$base/$name" | python3 -c 'import json,sys; print(json.load(sys.stdin)["metadata"]["resourceVersion"])')" && echo "resourceVersion $rv"
  printf '  patch     '; curl -s -m 15 -o /dev/null -w '%{http_code}\n' "${extra[@]}" -X PATCH -H 'Content-Type: application/merge-patch+json' \
    -d '{"metadata":{"annotations":{"kubesphere.io/alias-name":"smoke"}}}' "$write/$name"
  # Re-read: PATCH bumped resourceVersion, and a PUT carrying the old one is
  # rejected with 409. This is exactly the case the update helper handles inside
  # the app, so the smoke test must do it too or it tests nothing real.
  rv="$(curl -s -m 15 "${extra[@]}" "$base/$name" | python3 -c 'import json,sys; print(json.load(sys.stdin)["metadata"]["resourceVersion"])')"
  printf '  put       '; curl -s -m 15 -o /dev/null -w '%{http_code}\n' "${extra[@]}" -X PUT -H 'Content-Type: application/json' \
    -d "{\"apiVersion\":\"v1\",\"kind\":\"ConfigMap\",\"metadata\":{\"name\":\"$name\",\"namespace\":\"$NAMESPACE\",\"resourceVersion\":\"$rv\"},\"data\":{\"k\":\"v2\"}}" "$write/$name"
  printf '  delete    '; curl -s -m 15 -o /dev/null -w '%{http_code}\n' "${extra[@]}" -X DELETE "$write/$name"
}

case "${1:-start}" in
  start) start ;;
  stop) stop ;;
  status) status ;;
  smoke) smoke ;;
  *) fail "usage: $0 {start|stop|status|smoke}" ;;
esac
