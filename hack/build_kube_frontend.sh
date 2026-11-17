#!/usr/bin/env bash
#
# Build the new console's SPA into the staging directory the console image picks up.
#
#   hack/build_kube_frontend.sh            # build into .build/kube-frontend/dist
#   SKIP_KUBE_FRONTEND_BUILD=1 hack/...    # reuse an existing build
#
# There is no image of its own any more. The build is copied into `ks-console`
# (`hack/docker_build_multiarch_from_dist.sh`) and served by that process, so the
# frontend and the console ship together — one web server, one deployment.
#
# Run from `console/`.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
CONSOLE_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)
FRONTEND_DIR="${CONSOLE_DIR}/kube-frontend"
STAGED_DIR="${CONSOLE_DIR}/.build/kube-frontend"

if [[ -z "${SKIP_KUBE_FRONTEND_BUILD:-}" ]]; then
  echo "==> building the SPA"
  pnpm --dir "${FRONTEND_DIR}" --filter @kube-ai-hub/console-next build
fi

if [[ ! -f "${FRONTEND_DIR}/apps/console-next/dist/index.html" ]]; then
  echo "ERROR: the SPA build produced no index.html" >&2
  exit 1
fi

echo "==> staging into ${STAGED_DIR}/dist"
rm -rf "${STAGED_DIR}"
mkdir -p "${STAGED_DIR}"
cp -r "${FRONTEND_DIR}/apps/console-next/dist" "${STAGED_DIR}/dist"

echo "==> done: ${STAGED_DIR}/dist"
