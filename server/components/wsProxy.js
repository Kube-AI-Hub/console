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
const { resolvePortalTarget } = require('../libs/portalMounts')
const { CSGHUB_RPROXY_TARGET, injectConsoleJwt } = require('../proxy')

const serverConfig = getServerConfig().server

// Same-origin portal shells (e.g. the agent workshop) are mounted on the HTTP
// side by proxy.js, but every upgrade request lands here first. Without a
// branch for them the terminal sockets were proxied to ks-apiserver, which
// answered 403 and forced the browser back to long polling.
const studioTarget = resolvePortalTarget(serverConfig.studio)

const isStudioUpgrade = url =>
  typeof url === 'string' && url.startsWith('/studio') && Boolean(studioTarget)

const getWebSocketTarget = url => {
  if (url.startsWith('/endpoint/')) {
    return CSGHUB_RPROXY_TARGET
  }
  if (isStudioUpgrade(url)) {
    return studioTarget
  }
  return serverConfig.apiServer.wsUrl
}

module.exports = function(app) {
  const wsProxy = httpProxy.createProxyServer({
    ws: true,
    changeOrigin: true,
  })

  app.server.on('upgrade', (req, socket, head) => {
    const isEndpointRequest = req.url.startsWith('/endpoint/')
    const target = getWebSocketTarget(req.url)
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
  })
}

module.exports.getWebSocketTarget = getWebSocketTarget
