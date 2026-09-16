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

const normalizeBaseUrl = url => (url || '').replace(/\/+$/, '')

const NEED_OMIT_HEADERS = ['cookie', 'referer']
const CSGHUB_RPROXY_TARGET = 'http://csghub-rproxy.csghub:8083'
const CSGHUB_AIGATEWAY_TARGET =
  normalizeBaseUrl(serverConfig.csghub?.aiGateway?.url) ||
  'http://csghub-gateway.csghub:8094'

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

const parseCookieValue = (cookieHeader, name) => {
  if (!cookieHeader) {
    return ''
  }
  const match = String(cookieHeader).match(
    new RegExp(`(?:^|;\\s*)${name}=([^;]*)`)
  )
  if (!match) {
    return ''
  }
  try {
    return decodeURIComponent(match[1])
  } catch (err) {
    return match[1]
  }
}

const injectConsoleJwt = (proxyReq, req) => {
  const existing = req.headers.authorization || req.headers.Authorization
  if (existing) {
    return
  }
  const token = parseCookieValue(req.headers.cookie, 'kah_token')
  if (token) {
    proxyReq.setHeader('Authorization', `Bearer ${token}`)
  }
}

const STREAM_PROXY_TIMEOUT_MS = 30 * 60 * 1000

const dongbaApiProxy = {
  target: normalizeBaseUrl(serverConfig.dongba?.apiServer?.url),
  changeOrigin: true,
  ignorePath: true,
  secure: false,
  timeout: STREAM_PROXY_TIMEOUT_MS,
  proxyTimeout: STREAM_PROXY_TIMEOUT_MS,
  optionsHandle(options, req) {
    const baseUrl = normalizeBaseUrl(serverConfig.dongba?.apiServer?.url)
    const apiBasePath = normalizeBaseUrl(
      serverConfig.dongba?.apiServer?.apiBasePath ||
        '/kapis/dongba.kubesphere.io/api/v1'
    )
    const parsedUrl = new URL(req.url, 'http://localhost')
    const suffix = parsedUrl.pathname.replace(/^\/dongba\/api\/v1/, '')
    options.target = `${baseUrl}${apiBasePath}${suffix}${parsedUrl.search}`
  },
  events: {
    proxyReq(proxyReq, req) {
      injectConsoleJwt(proxyReq, req)
    },
    proxyRes(proxyRes, _req, res) {
      const contentType = String(proxyRes.headers['content-type'] || '')
      if (!/event-stream/i.test(contentType)) {
        return
      }
      res.setHeader('X-Accel-Buffering', 'no')
      res.setHeader('Cache-Control', 'no-cache, no-transform')
    },
  },
}

const dongbaFrontendProxy = {
  target:
    normalizeBaseUrl(serverConfig.dongba?.frontend?.url) ||
    'http://dongbaf.dongba-system:3000',
  changeOrigin: true,
  ignorePath: true,
  secure: false,
  timeout: STREAM_PROXY_TIMEOUT_MS,
  proxyTimeout: STREAM_PROXY_TIMEOUT_MS,
  ws: true,
  optionsHandle(options, req) {
    const frontendBase =
      normalizeBaseUrl(serverConfig.dongba?.frontend?.url) ||
      'http://dongbaf.dongba-system:3000'
    const parsedUrl = new URL(req.url, 'http://localhost')
    let pathname = parsedUrl.pathname
    // Vite `base=/dongba/` prefixes hashed assets in HTML; Nitro still serves
    // `.output/public/{assets,brand}` at the site root. Strip the console
    // prefix for those static trees if the upstream has not mirrored them.
    if (
      /^\/dongba\/(assets|brand)(\/|$)/.test(pathname) ||
      /^\/dongba\/(favicon\.ico|apple-touch-icon\.png|manifest\.json|robots\.txt)$/.test(
        pathname
      )
    ) {
      pathname = pathname.replace(/^\/dongba/, '') || '/'
    }
    options.target = `${frontendBase}${pathname}${parsedUrl.search}`
  },
  events: {
    proxyReq(proxyReq, req) {
      injectConsoleJwt(proxyReq, req)
    },
    proxyRes(proxyRes, _req, res) {
      const contentType = String(proxyRes.headers['content-type'] || '')
      if (!/event-stream/i.test(contentType)) {
        return
      }
      res.setHeader('X-Accel-Buffering', 'no')
      res.setHeader('Cache-Control', 'no-cache, no-transform')
    },
  },
}

const endpointProxy = {
  target: CSGHUB_RPROXY_TARGET,
  secure: false,
  timeout: STREAM_PROXY_TIMEOUT_MS,
  proxyTimeout: STREAM_PROXY_TIMEOUT_MS,
  events: {
    proxyRes(proxyRes, _req, res) {
      const contentType = String(proxyRes.headers['content-type'] || '')
      if (!/event-stream/i.test(contentType)) {
        return
      }
      res.setHeader('X-Accel-Buffering', 'no')
      res.setHeader('Cache-Control', 'no-cache, no-transform')
    },
  },
}

const AIGATEWAY_PREFIXES = ['/platform-model/aigateway', '/aigateway']

const rewriteAigatewayPath = pathname => {
  let suffix = pathname || '/'
  for (const prefix of AIGATEWAY_PREFIXES) {
    if (suffix === prefix || suffix.startsWith(`${prefix}/`)) {
      suffix = suffix.slice(prefix.length) || '/'
      break
    }
  }
  return suffix
}

const aigatewayProxy = {
  target: CSGHUB_AIGATEWAY_TARGET,
  changeOrigin: true,
  ignorePath: true,
  secure: false,
  optionsHandle(options, req) {
    const parsedUrl = new URL(req.url, 'http://localhost')
    const suffix = rewriteAigatewayPath(parsedUrl.pathname)
    const base =
      normalizeBaseUrl(options.target) || CSGHUB_AIGATEWAY_TARGET
    options.target = `${base}${suffix}${parsedUrl.search}`
  },
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
  STREAM_PROXY_TIMEOUT_MS,
  CSGHUB_RPROXY_TARGET,
  CSGHUB_AIGATEWAY_TARGET,
  rewriteAigatewayPath,
  LABEL_STUDIO_PREFIX,
  rewriteLabelStudioLocation,
  k8sResourceProxy,
  devopsWebhookProxy,
  b2iFileProxy,
  csgHubApiProxy,
  dongbaApiProxy,
  dongbaFrontendProxy,
  endpointProxy,
  aigatewayProxy,
  labelStudioProxy,
}
