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

module.exports = function(app) {
  // compress middleware
  app.use(
    compress({
      threshold: 2048,
      flush: require('zlib').Z_SYNC_FLUSH,
    })
  )

  // serve static files
  const httpStatic = serverConfig.http.static[process.env.NODE_ENV]
  for (const [k, v] of Object.entries(httpStatic)) {
    app.use(mount(k, serve(root(v), { index: false, maxage: 604800000 })))
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
        res.end('Hugo dev server not available. Please run: cd ../website && yarn dev')
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
              ctx.body = 'Hugo dev server not available. Please run: cd ../website && yarn dev'
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
