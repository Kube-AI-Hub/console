#!/usr/bin/env bash
# Multi-platform build requires a buildx builder with docker-container driver.
# If you see "Multi-platform build is not supported for the docker driver", run once:
#   docker buildx create --use --name multiarch --driver docker-container --platform linux/amd64,linux/arm64
#   docker buildx inspect --bootstrap

set -ex
set -o pipefail

TAG=${TAG:-latest}
REPO=${REPO:-kubespheredev}
PUSH=${PUSH:-}

# support other container tools. e.g. podman
CONTAINER_CLI=${CONTAINER_CLI:-docker}
CONTAINER_BUILDER=${CONTAINER_BUILDER:-"buildx build"}

# If set, just building, no pushing
if [[ -z "${DRY_RUN:-}" ]]; then
  PUSH="--push"
fi

# supported platforms
PLATFORMS=linux/amd64,linux/arm64

# Local-directory buildx cache. Override BUILD_CACHE_DIR to relocate or
# set BUILD_CACHE='' to disable.
BUILD_CACHE_DIR=${BUILD_CACHE_DIR:-${HOME}/.cache/buildx/console}
BUILD_CACHE=${BUILD_CACHE-"--cache-to type=local,dest=${BUILD_CACHE_DIR},mode=max,compression=zstd,compression-level=3 --cache-from type=local,src=${BUILD_CACHE_DIR}"}
mkdir -p "${BUILD_CACHE_DIR}"

# Fail early if current builder does not support multi-platform
CURRENT_DRIVER=$(docker buildx ls 2>/dev/null | grep '\*' | awk '{print $2}')
if [[ "${CURRENT_DRIVER}" == "docker" ]]; then
  echo "ERROR: Multi-platform build requires a builder with docker-container driver."
  echo "Run once: docker buildx create --use --name multiarch --driver docker-container --platform linux/amd64,linux/arm64"
  echo "Then:     docker buildx inspect --bootstrap"
  exit 1
fi

# build the preimage
# shellcheck disable=SC2086 # intended splitting of BUILD_CACHE
docker buildx build ${BUILD_CACHE} -f build/Dockerfile --target builder --load -t ks-console-pre:"${TAG}" .

# create preimage container
${CONTAINER_CLI} create \
  --name predbuild ks-console-pre:"${TAG}"

# copy file from preimage container:./out/ ./out/
${CONTAINER_CLI} cp \
  predbuild:/out/ ./out/

# shellcheck disable=SC2086 # intended splitting of CONTAINER_BUILDER / BUILD_CACHE
${CONTAINER_CLI} ${CONTAINER_BUILDER} \
  --platform ${PLATFORMS} \
  ${BUILD_CACHE} \
  ${PUSH} \
  -f build/Dockerfile.dapper \
  -t "${REPO}"/ks-console:"${TAG}" .

# delete preimage
docker rmi ks-console-pre:"${TAG}" -f

# delete prebuild container
docker rm predbuild

# delete the folder in ./out
rm -rf ./out
