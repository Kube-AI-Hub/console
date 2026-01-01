#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONSOLE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
WEBSITE_DIR="${CONSOLE_DIR}/kube-docs"
OUTPUT_DIR="${CONSOLE_DIR}/dist/kube-docs"

if ! command -v hugo >/dev/null 2>&1; then
  echo "hugo is required to build website docs; please install hugo." >&2
  exit 1
fi

echo "Building website docs with baseURL=/kube-docs/..."
pushd "${WEBSITE_DIR}" >/dev/null
HUGO_BASEURL="/kube-docs/" yarn build
popd >/dev/null

echo "Syncing website/public to ${OUTPUT_DIR}..."
rm -rf "${OUTPUT_DIR}"
mkdir -p "${OUTPUT_DIR}"
cp -a "${WEBSITE_DIR}/public/." "${OUTPUT_DIR}/"

echo "Docs synced to ${OUTPUT_DIR}"

