# Copyright 2026 Kube AI Hub.
#
# The new console: one container serving both the built SPA and its BFF.
#
# The build is deliberately **not** run here. The app's Vite config compiles
# ai-kit from source (see `apps/console-next/vite.config.ts`), which needs the
# sibling `packages/ai-kit` workspace and its own install — a multi-stage build
# inside `console/kube-frontend` would have to reproduce that whole layout. The
# image therefore ships the artifacts produced by:
#
#   pnpm --filter @kube-ai-hub/console-next build   # -> apps/console-next/dist
#   pnpm --filter @kube-ai-hub/bff build            # -> server/dist/server.js
#
# `hack/build_kube_frontend.sh` in the console repo runs both, then calls
# `docker buildx build` with this file.

FROM watering-ai-registry.cn-shanghai.cr.aliyuncs.com/kube-ai-hub/node:22-alpine

RUN adduser -D -g kubeaihub -u 1002 kubeaihub

WORKDIR /opt/kube-frontend

# The static build and the bundled BFF. Nothing else: no `node_modules`, no
# TypeScript toolchain — the server is one file with `node:` builtins only.
COPY --chown=kubeaihub:kubeaihub apps/console-next/dist/ /opt/kube-frontend/dist/
COPY --chown=kubeaihub:kubeaihub server/dist/server.js /opt/kube-frontend/server.js
COPY --chown=kubeaihub:kubeaihub server/dist/server.js.map /opt/kube-frontend/server.js.map

USER kubeaihub

ENV NODE_ENV=production \
    BFF_PORT=8080 \
    STATIC_DIR=/opt/kube-frontend/dist

EXPOSE 8080

# No HEALTHCHECK: the deployment probes `/api/ai/manifest`, which answers 200
# without touching the cluster, so a probe never depends on ks-apiserver being up.
CMD ["node", "/opt/kube-frontend/server.js"]
