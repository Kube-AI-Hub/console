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

const compress = require('koa-compress')
const mount = require('koa-mount')
const render = require('koa-ejs')
const serve = require('koa-static')
const HttpProxy = require('http-proxy')

const { getServerConfig, root } = require('../libs/utils')

const serverConfig = getServerConfig().server

// Latest version for kube-docs redirect
const KUBE_DOCS_LATEST_VERSION = 'v3.4'

module.exports = function(app) {
  // compress middleware
  app.use(
    compress({
      threshold: 2048,
      flush: require('zlib').Z_SYNC_FLUSH,
    })
  )

  // Redirect version-less /kube-docs/*/docs/* paths to latest version (v3.4)
  // e.g., /kube-docs/docs/ -> /kube-docs/docs/v3.4/
  // e.g., /kube-docs/zh/docs/foo/ -> /kube-docs/zh/docs/v3.4/foo/
  app.use(async (ctx, next) => {
    const url = ctx.url
    // Match /kube-docs/docs/[path] (en, no lang segment) where path doesn't start with v[0-9]
    const enMatch = url.match(/^\/kube-docs\/docs\/(?!v\d)(.*)$/)
    if (enMatch) {
      const pathAfterDocs = enMatch[1] || ''
      const redirectUrl = `/kube-docs/docs/${KUBE_DOCS_LATEST_VERSION}/${pathAfterDocs}`
      ctx.redirect(redirectUrl)
      return
    }
    // Match /kube-docs/(zh|en)/docs/[path] where path doesn't start with v[0-9]
    const langMatch = url.match(/^\/kube-docs\/(zh|en)\/docs\/(?!v\d)(.*)$/)
    if (langMatch) {
      const lang = langMatch[1]
      const pathAfterDocs = langMatch[2] || ''
      const redirectUrl = `/kube-docs/${lang}/docs/${KUBE_DOCS_LATEST_VERSION}/${pathAfterDocs}`
      ctx.redirect(redirectUrl)
      return
    }
    await next()
  })

  // serve static files
  const httpStatic = serverConfig.http.static[process.env.NODE_ENV]
  for (const [k, v] of Object.entries(httpStatic)) {
    // Enable index.html serving for kube-docs (Hugo site)
    const staticOptions = k === '/kube-docs' 
      ? { index: 'index.html', maxage: 604800000 }
      : { index: false, maxage: 604800000 }
    app.use(mount(k, serve(root(v), staticOptions)))
  }

  if (global.MODE_DEV) {
    // Proxy /kube-docs requests to Hugo dev server
    const hugoProxy = HttpProxy.createProxyServer({
      target: 'http://localhost:1313',
      changeOrigin: true,
    })

    hugoProxy.on('error', (err, req, res) => {
      console.error('Hugo proxy error:', err.message)
      if (res.writeHead) {
        res.writeHead(502, { 'Content-Type': 'text/plain' })
        res.end('Hugo dev server not available. Please run: cd kube-docs && yarn dev')
      }
    })

    app.use(async (ctx, next) => {
      if (ctx.url.startsWith('/kube-docs')) {
        return new Promise((resolve, reject) => {
          ctx.res.on('close', resolve)
          ctx.res.on('finish', resolve)
          hugoProxy.web(ctx.req, ctx.res, {}, e => {
            if (e) {
              console.error('Hugo proxy error:', e.message)
              ctx.status = 502
              ctx.body = 'Hugo dev server not available. Please run: cd kube-docs && yarn dev'
            }
            resolve()
          })
        })
      }
      await next()
    })

    app.use(async (ctx, next) => {
      if (
        /(\.hot-update\.)|(\.(ttf|otf|eot|woff2?)(\?.+)?$)|(\.js$)|(\/dist\/)/.test(
          ctx.url
        )
      ) {
        ctx.redirect(`http://${ctx.hostname}:8001${ctx.url}`)
      } else {
        await next()
      }
    })
  }

  render(app, {
    root: root('server/views'),
    cache: !global.MODE_DEV,
    layout: false,
  })
}
