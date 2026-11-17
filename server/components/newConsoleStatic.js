/*
Copyright 2026 Kube AI Hub.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const fs = require('fs')
const path = require('path')
const serve = require('koa-static')
const mount = require('koa-mount')

const { NEW_CONSOLE_PREFIX, isNewConsolePath } = require('../libs/portalMounts')

/**
 * Serving the new console's build from this server.
 *
 * The new console used to run its own Node process, which served its own assets.
 * That process is gone: the build is copied into this image and served here, so a
 * deployment has one web server instead of two.
 *
 * Two rules, because the app is a client-side router:
 *
 * 1. Anything that names a real file under the build root is served as a file.
 *    Fingerprinted assets get a long cache; everything else revalidates.
 * 2. Anything else under the prefix that looks like a navigation is answered with
 *    `index.html`, so a deep link such as `/kube-frontend/clusters/host/overview`
 *    reaches the router instead of 404ing.
 *
 * A request for a missing `.js` chunk must **not** get `index.html`: the browser
 * would try to parse HTML as a module and fail with a syntax error that says
 * nothing about the real problem.
 */

/** Where the build is copied in the image. */
const DEFAULT_DIST = path.resolve(
  global.APP_ROOT || __dirname,
  'dist/kube-frontend'
)

function resolveDistRoot() {
  const configured = process.env.KUBE_FRONTEND_DIST
  const candidates = [configured, DEFAULT_DIST].filter(Boolean)
  return candidates.find(candidate => fs.existsSync(candidate)) || ''
}

/** Only a navigation gets the shell; a file request gets a 404. */
function wantsShell(pathname, accept) {
  if (path.extname(pathname) !== '') return false
  const accepts = String(accept || '').trim()
  // `*/*` is what curl and most probes send. Refusing it turns a working
  // deployment into a 404 for every command-line check.
  return (
    accepts === '' || accepts.includes('*/*') || accepts.includes('text/html')
  )
}

/**
 * Mount the new console's static build.
 *
 * Returns the middleware, or `null` when no build is present — an installation
 * that does not ship the new console must behave exactly as before, including
 * answering 404 for its paths.
 */
function mountNewConsole(app) {
  const distRoot = resolveDistRoot()
  if (!distRoot) {
    return false
  }

  // Fingerprinted assets: safe to cache for a year, and a deploy is then cheap.
  app.use(
    mount(
      `${NEW_CONSOLE_PREFIX}/assets`,
      serve(path.join(distRoot, 'assets'), {
        index: false,
        maxage: 31536000000,
        immutable: true,
      })
    )
  )

  // Everything else that is a real file (favicon, manifest, …).
  app.use(
    mount(
      NEW_CONSOLE_PREFIX,
      serve(distRoot, {
        index: false,
        maxage: 0,
        setHeaders(res, filePath) {
          // The shell must revalidate: a reader who kept the previous build would
          // otherwise request assets that no longer exist.
          if (/\.html?$/i.test(filePath))
            res.setHeader('Cache-Control', 'no-cache')
        },
      })
    )
  )

  // The router's entry point for every client-side route.
  app.use(async (ctx, next) => {
    if (ctx.method !== 'GET' && ctx.method !== 'HEAD') return next()
    if (!isNewConsolePath(ctx.path)) return next()
    if (!wantsShell(ctx.path, ctx.headers.accept)) return next()

    ctx.set('Cache-Control', 'no-cache')
    ctx.type = 'html'
    ctx.body = fs.createReadStream(path.join(distRoot, 'index.html'))
  })

  return true
}

module.exports = { mountNewConsole, resolveDistRoot, wantsShell, DEFAULT_DIST }
