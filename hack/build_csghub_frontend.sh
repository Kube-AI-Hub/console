#!/usr/bin/env bash

set -ex
set -o pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
CONSOLE_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)
REPO_ROOT=$(cd "${CONSOLE_DIR}/.." && pwd)
CSGHUB_FRONTEND_DIR="${REPO_ROOT}/csghub/frontend"
STAGED_DIR="${CONSOLE_DIR}/.build/csghub/frontend"

if [[ ! -d "${CSGHUB_FRONTEND_DIR}" ]]; then
  echo "ERROR: CSGHub frontend directory not found: ${CSGHUB_FRONTEND_DIR}"
  exit 1
fi

if [[ -z "${SKIP_CSGHUB_FRONTEND_BUILD:-}" ]]; then
  pushd "${CSGHUB_FRONTEND_DIR}"
  if [[ ! -d node_modules ]]; then
    yarn install --ignore-scripts
  fi
  yarn build
  popd
fi

if [[ ! -d "${CSGHUB_FRONTEND_DIR}/dist" ]]; then
  echo "ERROR: CSGHub frontend dist not found: ${CSGHUB_FRONTEND_DIR}/dist"
  exit 1
fi

rm -rf "${STAGED_DIR}"
mkdir -p "${STAGED_DIR}"
cp -R "${CSGHUB_FRONTEND_DIR}/dist" "${STAGED_DIR}/dist"
