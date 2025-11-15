#!/usr/bin/env bash

set -ex
set -o pipefail

TAG=${TAG:-latest}
REPO=${REPO:-kube-api-hub}
PUSH=${PUSH:-}

# support other container tools. e.g. podman
CONTAINER_CLI=${CONTAINER_CLI:-docker}
CONTAINER_BUILDER=${CONTAINER_BUILDER:-"buildx build"}

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

# copy file from dist to ./out/
rm -rf out && mkdir -p out/server
cp -r dist out
cp -r server/locales server/public server/views server/sample server/config.yaml out/server/
cp package.json out/

IMAGE="${REPO}"/ks-console:"${TAG}"
echo "building image: ${IMAGE}"

# shellcheck disable=SC2086 # inteneded splitting of CONTAINER_BUILDER
${CONTAINER_CLI} ${CONTAINER_BUILDER} \
  --platform ${PLATFORMS} \
  ${PUSH} \
  -f build/Dockerfile.dapper \
  -t "${IMAGE}" .

if [[ -z "${DRY_RUN:-}" ]]; then
  SHA256=$(${CONTAINER_CLI} pull "${IMAGE}" | grep Digest | sed -e "s/^Digest: //")
  echo "image pushed successfully: $IMAGE@$SHA256"
fi

# delete the folder in ./out
rm -rf ./out
