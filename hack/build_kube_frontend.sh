#!/usr/bin/env bash
#
# Build and push the new console image (kube-frontend).
#
# Run from `console/`:
#   TAG=develop-20261117 PLATFORMS=linux/amd64 hack/build_kube_frontend.sh
#
# Serial by design: this host's disk has little headroom, and two concurrent
# buildx exports is how a build fails with an unrelated-looking error.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
CONSOLE_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)
FRONTEND_DIR="${CONSOLE_DIR}/kube-frontend"

REGISTRY=${REGISTRY:-watering-ai-registry.cn-shanghai.cr.aliyuncs.com/kube-ai-hub}
TAG=${TAG:-develop}
IMAGE="${REGISTRY}/kube-frontend:${TAG}"
PLATFORMS=${PLATFORMS:-linux/amd64}

if pgrep -f "buildx build" | grep -v "$$" >/dev/null 2>&1; then
  echo "ERROR: another buildx build is already running; builds are serial here." >&2
  pgrep -fl "buildx build" | grep -v "zsh -c" >&2 || true
  exit 1
fi

echo "==> building the SPA"
pnpm --dir "${FRONTEND_DIR}" --filter @kube-ai-hub/console-next build

echo "==> bundling the BFF"
pnpm --dir "${FRONTEND_DIR}" --filter @kube-ai-hub/bff build

if [[ ! -f "${FRONTEND_DIR}/apps/console-next/dist/index.html" ]]; then
  echo "ERROR: the SPA build produced no index.html" >&2
  exit 1
fi
if [[ ! -f "${FRONTEND_DIR}/server/dist/server.js" ]]; then
  echo "ERROR: the BFF bundle is missing" >&2
  exit 1
fi

echo "==> building ${IMAGE} for ${PLATFORMS}"
PUSH_FLAG=()
if [[ -z "${DRY_RUN:-}" ]]; then
  PUSH_FLAG=(--push)
fi

docker buildx build \
  --platform "${PLATFORMS}" \
  "${PUSH_FLAG[@]}" \
  -f "${FRONTEND_DIR}/Dockerfile" \
  -t "${IMAGE}" \
  "${FRONTEND_DIR}"

if [[ -z "${DRY_RUN:-}" ]]; then
  echo "==> pushed ${IMAGE}"
  docker buildx imagetools inspect "${IMAGE}" | sed -n '1,8p'
fi
