#!/usr/bin/env bash
# Every verification the new console has, in the order that fails fastest.
#
# The four modes answer different questions (can a keyboard user drive it, is the copy translated,
# do the pages read real data, does a write land where it was sent), and running them by hand meant
# remembering four command lines and four sets of arguments. One command, one summary, one exit code.
#
# Usage: tools/verify-all.sh <env-file> [app] [bff] [clusters] [workspace] [project]
set -u

ENV_FILE=${1:?usage: verify-all.sh <env-file> [app] [bff] [clusters] [workspace] [project]}
# Absolute before the cd below: a relative path would resolve against tools/ and quietly vanish.
case "$ENV_FILE" in
  /*) ;;
  *) ENV_FILE=$(cd "$(dirname "$ENV_FILE")" 2>/dev/null && pwd)/$(basename "$ENV_FILE") ;;
esac
[ -f "$ENV_FILE" ] || { echo "env file not found: $ENV_FILE" >&2; exit 2; }
APP=${2:-http://localhost:5182}
# The BFF is retired (2026-11-18): pass `-` (or omit) to use the app origin for both.
BFF=${3:-http://127.0.0.1:8093}
if [ "$BFF" = "-" ] || [ -z "$BFF" ]; then BFF=$APP; fi
CLUSTERS=${4:-host,xc}
WORKSPACE=${5:-system-workspace}
PROJECT=${6:-spaces}
# Known gaps of this deployment (a member cluster has no alerting component). Documented in the
# playbook; passing them here keeps the wrapper honest about what a failure means.
ALLOW=${7:-xc:alerting-messages,xc:alerting-policies}
FIRST_CLUSTER=${CLUSTERS%%,*}

here=$(cd "$(dirname "$0")" && pwd)
failures=0
declare -a summary=()

run() {
  local name=$1; shift
  echo
  echo "=== $name ==="
  if "$@"; then
    summary+=("OK   $name")
  else
    local code=$?
    # 2 = environment unusable: say so instead of blaming the product.
    if [ "$code" -eq 2 ]; then
      summary+=("SKIP $name (environment unusable)")
    else
      summary+=("FAIL $name (exit $code)")
      failures=$((failures + 1))
    fi
  fi
}

cd "$here"

# One login for the whole run. Each mode used to log in on its own, and five logins in a row trip
# the console's rate limit (429) -- the run then reported "environment unusable" while the
# environment was fine.
TOKEN=$(curl -s --max-time 20 -X POST "$BFF/api/session/login" -H 'content-type: application/json' \
  -d "{\"username\":\"$(grep '^KA_USERNAME=' "$ENV_FILE" | cut -d= -f2-)\",\"password\":\"$(grep '^KA_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)\"}" \
  | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
if [ -z "$TOKEN" ]; then
  echo 'login failed: the console did not return a token (rate limit? credentials?)' >&2
  exit 2
fi
TOKEN_ARGS=(--token "$TOKEN")

run 'capability probes (fingerprint)' python3 -u multicluster_sweep.py \
  --env-file "$ENV_FILE" --app "$APP" --bff "$BFF" --probes --clusters "$FIRST_CLUSTER" "${TOKEN_ARGS[@]}"

run 'login page a11y + keyboard (no cluster)' python3 -u multicluster_sweep.py \
  --env-file "$ENV_FILE" --app "$APP" --bff "$BFF" --keyboard-local

run 'untranslated identifiers (en)' python3 -u multicluster_sweep.py \
  --env-file "$ENV_FILE" --app "$APP" --bff "$BFF" --locale-scan --locale en \
  --clusters "$FIRST_CLUSTER" --workspace "$WORKSPACE" --project "$PROJECT" "${TOKEN_ARGS[@]}"

run 'keyboard walk (both themes x accents)' python3 -u multicluster_sweep.py \
  --env-file "$ENV_FILE" --app "$APP" --bff "$BFF" --keyboard \
  --clusters "$CLUSTERS" --workspace "$WORKSPACE" --project "$PROJECT" "${TOKEN_ARGS[@]}"

run 'eight-phase baseline' python3 -u multicluster_sweep.py \
  --env-file "$ENV_FILE" --app "$APP" --bff "$BFF" --baseline \
  --clusters "$CLUSTERS" --workspace "$WORKSPACE" --project "$PROJECT" --budget 1800 --allow "$ALLOW" "${TOKEN_ARGS[@]}"

echo
echo '=== summary ==='
printf '%s\n' "${summary[@]}"
skipped=0
for line in "${summary[@]}"; do
  case "$line" in SKIP*) skipped=$((skipped + 1)) ;; esac
done
if [ "$failures" -gt 0 ]; then
  echo "VERDICT: FAIL ($failures mode(s))"
  exit 1
fi
if [ "$skipped" -gt 0 ]; then
  # Not PASS: part of the verification never ran, and calling that PASS would overstate the evidence.
  echo "VERDICT: INCOMPLETE ($skipped mode(s) skipped)"
  exit 4
fi
echo 'VERDICT: PASS'
exit 0
