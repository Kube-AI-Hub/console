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
APP=${2:-http://localhost:5182}
BFF=${3:-http://127.0.0.1:8093}
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

run 'login page a11y + keyboard (no cluster)' python3 -u multicluster_sweep.py \
  --env-file "$ENV_FILE" --app "$APP" --bff "$BFF" --keyboard-local

run 'untranslated identifiers (en)' python3 -u multicluster_sweep.py \
  --env-file "$ENV_FILE" --app "$APP" --bff "$BFF" --locale-scan --locale en \
  --clusters "$FIRST_CLUSTER" --workspace "$WORKSPACE" --project "$PROJECT"

run 'keyboard walk (both themes x accents)' python3 -u multicluster_sweep.py \
  --env-file "$ENV_FILE" --app "$APP" --bff "$BFF" --keyboard \
  --clusters "$CLUSTERS" --workspace "$WORKSPACE" --project "$PROJECT"

run 'eight-phase baseline' python3 -u multicluster_sweep.py \
  --env-file "$ENV_FILE" --app "$APP" --bff "$BFF" --baseline \
  --clusters "$CLUSTERS" --workspace "$WORKSPACE" --project "$PROJECT" --budget 1800 --allow "$ALLOW"

echo
echo '=== summary ==='
printf '%s\n' "${summary[@]}"
if [ "$failures" -eq 0 ]; then
  echo 'VERDICT: PASS'
  exit 0
fi
echo "VERDICT: FAIL ($failures mode(s))"
exit 1
