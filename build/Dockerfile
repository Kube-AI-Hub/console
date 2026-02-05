# Copyright 2021 The KubeSphere Authors. All rights reserved.
# Use of this source code is governed by an Apache license
# that can be found in the LICENSE file.

# Prepare the build environment
FROM node:22-alpine AS builder

# APK acceleration for China
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

RUN apk add --no-cache --virtual python2
RUN apk add --no-cache --virtual .build-deps ca-certificates python3 py3-pip make openssl g++ bash hugo asciidoctor

WORKDIR /kubesphere

# Install dependencies to reduce build time
ADD package.json /kubesphere/package.json
RUN yarn install

ADD . /kubesphere/

# If you have trouble downloading the yarn binary, try the following:
# RUN yarn config set registry https://registry.npmmirror.com or https://r.cnpmjs.org/

RUN yarn install && yarn build

# Copy compiled files
RUN mkdir -p /out/server
RUN mv /kubesphere/dist/ /out/
RUN mv /kubesphere/server/locales \
       /kubesphere/server/public \
       /kubesphere/server/views \
       /kubesphere/server/sample \
       /kubesphere/server/config.yaml /out/server/
#RUN ["/bin/bash", "-c", "mv /kubesphere/server/{locales,public,sample,views,config.yaml} /out/server/"]
RUN mv /kubesphere/package.json /out/

##############
# Final Image
##############
FROM node:22-alpine AS base_os_context

RUN adduser -D -g kubesphere -u 1002 kubesphere && \
    mkdir -p /opt/kubesphere/console && \
    chown -R kubesphere:kubesphere /opt/kubesphere/console

WORKDIR /opt/kubesphere/console
COPY --from=builder /out/ /opt/kubesphere/console/

RUN mv dist/server.js server/server.js
USER kubesphere

EXPOSE 8080

CMD ["npm", "run", "serve"]

