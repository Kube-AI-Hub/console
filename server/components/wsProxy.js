/*
 * This file is part of KubeSphere Console.
 * Copyright (C) 2019 The KubeSphere Console Authors.
 *
 * KubeSphere Console is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * KubeSphere Console is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with KubeSphere Console.  If not, see <https://www.gnu.org/licenses/>.
 */

const httpProxy = require('http-proxy')

const { getServerConfig } = require('../libs/utils')
const {
  NEW_CONSOLE_PREFIX,
  isNewConsolePath,
  resolvePortalTarget,
  stripNewConsolePrefix,
} = require('../libs/portalMounts')
const { CSGHUB_RPROXY_TARGET, injectConsoleJwt } = require('../proxy')

const serverConfig = getServerConfig().server

// Same-origin portal shells (e.g. the agent workshop) are mounted on the HTTP
// side by proxy.js, but every upgrade request lands here first. Without a
// branch for them the terminal sockets were proxied to ks-apiserver, which
// answered 403 and forced the browser back to long polling.
const studioTarget = resolvePortalTarget(serverConfig.studio)

// The new console owns container/node terminal sockets under its own prefix. They
// are answered by that deployment's BFF, which is the process that speaks kube's
// exec protocol and holds the token-subprotocol translation.
const newConsoleTarget = resolvePortalTarget(serverConfig.newConsole)

const isStudioUpgrade = url =>
  typeof url === 'string' && url.startsWith('/studio') && Boolean(studioTarget)

const isNewConsoleUpgrade = url =>
  typeof url === 'string' && Boolean(newConsoleTarget) && isNewConsolePath(url.split('?')[0])

const getWebSocketTarget = url => {
  if (url.startsWith('/endpoint/')) {
    return CSGHUB_RPROXY_TARGET
  }
  if (isStudioUpgrade(url)) {
    return studioTarget
  }
  if (isNewConsoleUpgrade(url)) {
    return newConsoleTarget
  }
  return serverConfig.apiServer.wsUrl
}

/**
 * The path to forward for an upgrade.
 *
 * The new console's process does not know it is mounted on a prefix of this host,
 * so `/kube-frontend/api/v1/.../exec` has to arrive as `/api/v1/.../exec`. Every
 * other target keeps the path as the browser sent it.
 */
const getWebSocketPath = url => {
  if (!isNewConsoleUpgrade(url)) return url
  const [pathname, search] = splitQuery(url)
  return `${stripNewConsolePrefix(pathname)}${search}`
}

function splitQuery(url) {
  const index = url.indexOf('?')
  return index === -1 ? [url, ''] : [url.slice(0, index), url.slice(index)]
}

module.exports = function(app) {
  const wsProxy = httpProxy.createProxyServer({
    ws: true,
    changeOrigin: true,
  })

  app.server.on('upgrade', (req, socket, head) => {
    const isEndpointRequest = req.url.startsWith('/endpoint/')
    const target = getWebSocketTarget(req.url)
    const originalUrl = req.url
    if (isNewConsoleUpgrade(req.url)) {
      // `http-proxy` forwards `req.url` verbatim, so the prefix is removed here
      // rather than configured — the same request object is ours for the life of
      // this upgrade.
      req.url = getWebSocketPath(req.url)
    }
    wsProxy.ws(req, socket, head, {
      target,
      changeOrigin: !isEndpointRequest,
      // The workshop authenticates the shell socket from the caller's session.
      proxyReqWs(proxyReq, request) {
        if (isStudioUpgrade(request.url)) {
          injectConsoleJwt(proxyReq, request)
        }
      },
    })
    req.url = originalUrl
  })
}

module.exports.getWebSocketTarget = getWebSocketTarget
module.exports.getWebSocketPath = getWebSocketPath
module.exports.isNewConsoleUpgrade = isNewConsoleUpgrade
