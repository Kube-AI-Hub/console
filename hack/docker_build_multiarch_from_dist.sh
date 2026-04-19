#!/usr/bin/env bash
# Multi-platform build requires a buildx builder with docker-container driver.
# If you see "Multi-platform build is not supported for the docker driver", run once:
#   docker buildx create --use --name multiarch --driver docker-container --platform linux/amd64,linux/arm64
#   docker buildx inspect --bootstrap

set -ex
set -o pipefail

TAG=${TAG:-latest}
REPO=${REPO:-kube-api-hub}
PUSH=${PUSH:-}

# support other container tools. e.g. podman
CONTAINER_CLI=${CONTAINER_CLI:-docker}
CONTAINER_BUILDER=${CONTAINER_BUILDER:-"buildx build"}

# Fail early if current builder does not support multi-platform
CURRENT_DRIVER=$(${CONTAINER_CLI} buildx ls 2>/dev/null | grep '\*' | awk '{print $2}')
if [[ "${CURRENT_DRIVER}" == "docker" ]]; then
  echo "ERROR: Multi-platform build requires a builder with docker-container driver."
  echo "Run once: docker buildx create --use --name multiarch --driver docker-container --platform linux/amd64,linux/arm64"
  echo "Then:     docker buildx inspect --bootstrap"
  exit 1
fi

# check if the os is ubuntu, if yes, use sudo to run docker
if [[ $(uname -s) == "Linux" ]]; then
  if ! command -v docker &> /dev/null; then
    echo "docker is not installed, please install it first"
    exit 1
  fi
  if [[ $(lsb_release -is) == "Ubuntu" ]]; then
    CONTAINER_CLI="sudo docker"
  fi
  if ! $CONTAINER_CLI info &> /dev/null; then
    echo "docker is not running, please start it first"
    exit 1
  fi
fi

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

# copy file from dist to ./out/
rm -rf out && mkdir -p out/server
cp -r dist out
cp -r server/locales server/public server/views server/sample server/config.yaml out/server/
cp package.json out/

IMAGE="${REPO}"/ks-console:"${TAG}"
echo "building image: ${IMAGE}"

# shellcheck disable=SC2086 # intended splitting of CONTAINER_BUILDER / BUILD_CACHE
${CONTAINER_CLI} ${CONTAINER_BUILDER} \
  --platform ${PLATFORMS} \
  ${BUILD_CACHE} \
  ${PUSH} \
  -f build/Dockerfile.dapper \
  -t "${IMAGE}" .

if [[ -z "${DRY_RUN:-}" ]]; then
  SHA256=$(${CONTAINER_CLI} pull "${IMAGE}" | grep Digest | sed -e "s/^Digest: //")
  echo "image pushed successfully: $IMAGE@$SHA256"
fi

# delete the folder in ./out
rm -rf ./out
