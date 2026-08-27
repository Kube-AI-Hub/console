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

const http = require('http')

const { getServerConfig } = require('./libs/utils')

const { server: serverConfig } = getServerConfig()

const NEED_OMIT_HEADERS = ['cookie', 'referer']
const CSGHUB_RPROXY_TARGET = 'http://csghub-rproxy.csghub:8083'

const k8sResourceProxy = {
  target: serverConfig.apiServer.url,
  changeOrigin: true,
  events: {
    proxyReq(proxyReq, req) {
      // Handle modified body for /oauth/token requests
      // If body was modified by middleware (stored as string in req.body),
      // we need to write it manually since the original stream was consumed
      if (req.body && typeof req.body === 'string' && req.method === 'POST') {
        const body = Buffer.from(req.body, 'utf8')
        proxyReq.setHeader('Content-Length', body.length)
        // Write the body and end the request
        proxyReq.write(body)
        proxyReq.end()
        return
      }

      NEED_OMIT_HEADERS.forEach(key => proxyReq.removeHeader(key))
    },
    proxyRes(proxyRes, req, client_res) {
      let maxBufferSize = req.headers['x-file-size-limit']
      if (maxBufferSize) {
        maxBufferSize = Number(maxBufferSize)
        let body = Buffer.alloc(maxBufferSize)
        let offset = 0
        let end = false
        proxyRes.on('data', chunk => {
          if (end) {
            return
          }
          if (offset >= maxBufferSize) {
            if (!client_res.getHeader('x-file-size-limit-out')) {
              client_res.setHeader('x-file-size-limit-out', 'true')
            }
            proxyRes.emit('end')
            end = true
            return
          }
          chunk.copy(body, offset)

          offset += chunk.length
        })
        proxyRes.pipe = function(res) {
          proxyRes.on('end', () => {
            end = true
            const offset1 = Math.min(offset, maxBufferSize)
            body = body.slice(0, offset1)
            res.writeHead(proxyRes.statusCode, {
              ...proxyRes.headers,
              'x-file-size': offset1,
            })
            res.end(body)
          })
        }
      }
      let addHeaders = req.headers['x-add-res-header']
      if (addHeaders) {
        addHeaders = JSON.parse(addHeaders)
        Object.keys(addHeaders).forEach(key => {
          proxyRes.headers[key] = addHeaders[key]
        })
      }
    },
  },
}

const devopsWebhookProxy = {
  target: `${serverConfig.apiServer.url}/kapis/devops.kubesphere.io/v1alpha2`,
  changeOrigin: true,
  ignorePath: true,
  optionsHandle(options, req) {
    options.target += `/${req.url.slice(8)}`
  },
}

const b2iFileProxy = {
  target: serverConfig.apiServer.url,
  changeOrigin: true,
  ignorePath: true,
  selfHandleResponse: true,
  optionsHandle(options, req) {
    options.target += `/${req.url.slice(14)}`
  },
  events: {
    proxyReq(proxyReq) {
      NEED_OMIT_HEADERS.forEach(key => proxyReq.removeHeader(key))
    },
    proxyRes(proxyRes, req, client_res) {
      let body = []
      proxyRes.on('data', chunk => {
        body.push(chunk)
      })
      proxyRes.on('end', () => {
        const redirectUrl = proxyRes.headers.location
        if (!redirectUrl) {
          body = Buffer.concat(body).toString()
          client_res.writeHead(500, proxyRes.headers)
          client_res.end(body)
          console.error(`get b2i file failed, message: ${body}`)
        }
        const proxy = http.get(proxyRes.headers.location, res => {
          client_res.writeHead(res.statusCode, res.headers)
          res.pipe(client_res, { end: true })
        })
        client_res.pipe(proxy, { end: true })
      })
    },
  },
}

const normalizeBaseUrl = url => (url || '').replace(/\/+$/, '')

const csgHubApiProxy = {
  target: normalizeBaseUrl(serverConfig.csghub?.apiServer?.url),
  changeOrigin: true,
  ignorePath: true,
  secure: false,
  optionsHandle(options, req) {
    const baseUrl = normalizeBaseUrl(serverConfig.csghub?.apiServer?.url)
    // apiBasePath: path on the upstream server that corresponds to /platform-model/api/v1
    //   - Direct csghub-server (http://csghub-server.csghub:8080): use /api/v1
    //   - Via remote portal   (https://ka.4paradigm.com):  use /platform-model/api/v1
    const apiBasePath = normalizeBaseUrl(
      serverConfig.csghub?.apiServer?.apiBasePath || '/api/v1'
    )
    const parsedUrl = new URL(req.url, 'http://localhost')
    const suffix = parsedUrl.pathname.replace(/^\/platform-model\/api\/v1/, '')
    options.target = `${baseUrl}${apiBasePath}${suffix}${parsedUrl.search}`
  },
}

const endpointProxy = {
  target: CSGHUB_RPROXY_TARGET,
  secure: false,
}

const LABEL_STUDIO_PREFIX = '/platform-model/-/label-studio'
const LABEL_STUDIO_TARGET = 'http://csghub-label-studio.csghub:8002'
const LABEL_STUDIO_PATH = '/-/label-studio'

const rewriteLabelStudioLocation = location => {
  if (!location) return location
  try {
    if (/^https?:\/\//i.test(location)) {
      const url = new URL(location)
      const idx = url.pathname.indexOf(LABEL_STUDIO_PATH)
      if (idx < 0) return location
      return `${LABEL_STUDIO_PREFIX}${url.pathname.slice(idx + LABEL_STUDIO_PATH.length)}${url.search}${url.hash}`
    }
    if (location.startsWith(LABEL_STUDIO_PATH)) {
      return `${LABEL_STUDIO_PREFIX}${location.slice(LABEL_STUDIO_PATH.length)}`
    }
    if (location.startsWith('/user/login')) {
      const url = new URL(location, 'http://localhost')
      const next = url.searchParams.get('next') || ''
      if (next.includes(LABEL_STUDIO_PATH) || next.includes(LABEL_STUDIO_PREFIX)) {
        return `${LABEL_STUDIO_PREFIX}${url.pathname}${url.search}${url.hash}`
      }
    }
    return location
  } catch (_) {
    return location
  }
}

const labelStudioProxy = {
  target: LABEL_STUDIO_TARGET,
  changeOrigin: true,
  ignorePath: true,
  secure: false,
  optionsHandle(options, req) {
    const parsedUrl = new URL(req.url, 'http://localhost')
    const suffix = parsedUrl.pathname.replace(
      /^\/platform-model\/-\/label-studio/,
      ''
    )
    const base = (options.target || LABEL_STUDIO_TARGET).replace(/\/+$/, '')
    options.target = `${base}${suffix || '/'}${parsedUrl.search}`
  },
  events: {
    proxyRes(proxyRes) {
      if (proxyRes.headers.location) {
        proxyRes.headers.location = rewriteLabelStudioLocation(
          proxyRes.headers.location
        )
      }
    },
  },
}

module.exports = {
  CSGHUB_RPROXY_TARGET,
  LABEL_STUDIO_PREFIX,
  rewriteLabelStudioLocation,
  k8sResourceProxy,
  devopsWebhookProxy,
  b2iFileProxy,
  csgHubApiProxy,
  endpointProxy,
  labelStudioProxy,
}
