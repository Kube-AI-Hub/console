# Copyright 2021 The KubeSphere Authors. All rights reserved.
# Use of this source code is governed by an Apache license
# that can be found in the LICENSE file.

# Prepare the build environment
FROM watering-ai-registry.cn-shanghai.cr.aliyuncs.com/kube-ai-hub/node:22-alpine AS builder

# APK acceleration for China. Tsinghua rather than aliyun: mirrors.aliyun.com
# answers 403 for the alpine v3.23 repositories this base image pins, which
# aborts the build at the first `apk add`.
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apk/repositories

RUN apk add --no-cache --virtual python2
RUN apk add --no-cache --virtual .build-deps ca-certificates python3 py3-pip make openssl g++ bash hugo asciidoctor

WORKDIR /kubesphere

# npm registry mirror for fast install in China
RUN yarn config set registry https://registry.npmmirror.com

# Cypress is a devDependency used only by `yarn test:e2e`; its postinstall
# downloads a browser from download.cypress.io, which is unreachable from
# several build networks (and hangs the install instead of failing). Nothing in
# the console image needs it, so skip the binary download by default. Override
# with --build-arg CYPRESS_INSTALL_BINARY= when an image must ship Cypress.
ARG CYPRESS_INSTALL_BINARY=0
ENV CYPRESS_INSTALL_BINARY=${CYPRESS_INSTALL_BINARY}

# Install dependencies to reduce build time
ADD package.json /kubesphere/package.json
ADD yarn.lock /kubesphere/yarn.lock
ADD packages/ /kubesphere/packages/
RUN yarn install --frozen-lockfile

ADD . /kubesphere/

# If you have trouble downloading the yarn binary, try the following:
# RUN yarn config set registry https://registry.npmmirror.com or https://r.cnpmjs.org/

# ADD . 后需 yarn install 以安装 workspaces；只跑 yarn build，避免重复 install 和重复 storybook:build
RUN yarn install --frozen-lockfile && yarn build

# Copy compiled files
RUN mkdir -p /out/server
RUN mv /kubesphere/dist/ /out/
RUN mv /kubesphere/server/locales \
       /kubesphere/server/public \
       /kubesphere/server/views \
       /kubesphere/server/sample \
       /kubesphere/server/config.yaml /out/server/
RUN if [ -d /kubesphere/.build/csghub/frontend/dist ]; then \
      mkdir -p /out/csghub/frontend && \
      cp -R /kubesphere/.build/csghub/frontend/dist /out/csghub/frontend/dist; \
    fi
#RUN ["/bin/bash", "-c", "mv /kubesphere/server/{locales,public,sample,views,config.yaml} /out/server/"]
RUN mv /kubesphere/package.json /out/

##############
# Final Image
##############
FROM watering-ai-registry.cn-shanghai.cr.aliyuncs.com/kube-ai-hub/node:22-alpine AS base_os_context

RUN adduser -D -g kubesphere -u 1002 kubesphere && \
    mkdir -p /opt/kubesphere/console && \
    chown -R kubesphere:kubesphere /opt/kubesphere/console

WORKDIR /opt/kubesphere/console
COPY --from=builder /out/ /opt/kubesphere/console/

RUN mv dist/server.js server/server.js
USER kubesphere

EXPOSE 8080

CMD ["npm", "run", "serve"]

