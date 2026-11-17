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

const Router = require('@koa/router')
const convert = require('koa-convert')
const bodyParser = require('koa-bodyparser')

const proxy = require('./middlewares/proxy')
const injectOAuthCredentials = require('./middlewares/injectOAuthCredentials')
const extractTokenFromQuery = require('./middlewares/extractTokenFromQuery')
const checkIfExist = require('./middlewares/checkIfExist')

const { isStudioGatewayPath } = require('./libs/portalMounts')

const {
  k8sResourceProxy,
  devopsWebhookProxy,
  b2iFileProxy,
  csgHubApiProxy,
  dongbaApiProxy,
  dongbaFrontendProxy,
  endpointProxy,
  aigatewayProxy,
  labelStudioProxy,
  studioProxy,
  operationsProxy,
  kubeFrontendProxy,
  newConsoleApiProxy,
  newConsoleSelfHosted,
} = require('./proxy')

const { handleDockerhubProxy, handleHarborProxy } = require('./controllers/api')
const {
  handlePublicConfig,
  handleAiManifest,
} = require('./controllers/newConsole')
const { newConsoleShell } = require('./components/newConsoleStatic')

const {
  handleThirdLogin,
  handleLogout,
  handleSessionContext,
  handleOAuthCallback,
  handleLoginConfirm,
} = require('./controllers/session')

const {
  renderView,
  renderTerminal,
  renderLogin,
  renderLoginConfirm,
  renderMarkdown,
  renderOAuthRedirect,
} = require('./controllers/view')

const {
  handleCsgHubPing,
  handleCsgHubUpload,
  handleCsgHubPrivateUpload,
  handleCsgHubTempUrl,
  handleCsgHubResolve,
  handleCsgHubPublicFile,
  renderCsgHub,
  setCsgHubZhLocale,
  setCsgHubEnLocale,
  setCsgHubZhHantLocale,
  setCsgHubJaLocale,
} = require('./controllers/csghub')

const parseBody = convert(
  bodyParser({
    formLimit: '200kb',
    jsonLimit: '200kb',
    bufferLimit: '4mb',
  })
)

const router = new Router()

router
  .use(proxy('/platform-model/-/label-studio{/*path}', labelStudioProxy))
  .use(proxy('/platform-model/aigateway{/*path}', aigatewayProxy))
  .use(proxy('/platform-model/api/v1{/*path}', csgHubApiProxy))
  .get('/platform-model/internal_api/ping', handleCsgHubPing)
  .post('/platform-model/internal_api/upload', handleCsgHubUpload)
  .post(
    '/platform-model/internal_api/private_upload',
    handleCsgHubPrivateUpload
  )
  .get('/platform-model/internal_api/oss_temp_url', handleCsgHubTempUrl)
  .get('/platform-model/internal_api/files{/*path}', handleCsgHubPublicFile)
  .get(
    '/platform-model/:repo_type/:namespace/:name/resolve/:branch{/*path}',
    handleCsgHubResolve
  )
  .get('/platform-model/zh/settings/locale', setCsgHubZhLocale)
  .get('/platform-model/en/settings/locale', setCsgHubEnLocale)
  .get('/platform-model/zhHant/settings/locale', setCsgHubZhHantLocale)
  .get('/platform-model/ja/settings/locale', setCsgHubJaLocale)
  .get('/platform-model{/*path}', renderCsgHub)
  .use(proxy('/dongba/api/v1{/*path}', dongbaApiProxy))
  .use(proxy('/dongba{/*path}', dongbaFrontendProxy))

function refuseUnmountedPortal(ctx) {
  ctx.status = 404
  ctx.body = { status: 404, reason: 'NotFound' }
}

function mountPortal(prefix, portalProxy) {
  if (portalProxy) {
    router.use(proxy(`${prefix}{/*path}`, portalProxy))
    return
  }
  router.all(`${prefix}{/*path}`, refuseUnmountedPortal)
}
const studioProxyAll = studioProxy ? proxy('/{*path}', studioProxy) : null

function studioGateway(ctx, next) {
  if (!isStudioGatewayPath(ctx.path)) {
    return next()
  }
  if (!studioProxyAll) {
    refuseUnmountedPortal(ctx)
    return undefined
  }
  return studioProxyAll(ctx, next)
}

router.use(studioGateway)
mountPortal('/operations', operationsProxy)
/*
 * Deployment configuration for the new console.
 *
 * These were endpoints of the new console's own Node process, which no longer
 * exists. They describe the *deployment* — which docs this install hosts, which
 * pages its build declares — so they are answered here rather than by the cluster
 * API. Both are unauthenticated: neither holds a credential, and the login page
 * needs the docs links.
 */
router
  .get('/kube-frontend/api/config', handlePublicConfig)
  .get('/kube-frontend/api/ai/manifest', handleAiManifest)
/*
 * The new console on this host's `/kube-frontend` prefix.
 *
 * Its API requests go straight to ks-apiserver; everything else is its own build,
 * served by this process (see `components/newConsoleStatic.js`) or, when a
 * deployment still runs the separate frontend process, proxied to it. The API
 * rules come first: they must win over the general mount, which would otherwise
 * send `/kube-frontend/kapis/...` to the frontend process — where nothing answers
 * it any more.
 */
router.use(proxy('/kube-frontend/kapis{/*path}', newConsoleApiProxy))
router.use(proxy('/kube-frontend/apis{/*path}', newConsoleApiProxy))
router.use(proxy('/kube-frontend/api/v1{/*path}', newConsoleApiProxy))
/*
 * The new console's build and client routes.
 *
 * The static mount in `components/boot.js` answers these, so no proxy is needed
 * when this process serves the build (`selfHosted`). A deployment that still runs
 * the separate frontend process keeps working through `kubeFrontendProxy`.
 */
if (kubeFrontendProxy) {
  mountPortal('/kube-frontend', kubeFrontendProxy)
} else if (!newConsoleSelfHosted) {
  router.all('/kube-frontend{/*path}', refuseUnmountedPortal)
}

router
  .use(proxy('/endpoint{/*path}', endpointProxy))
  .use(proxy('/aigateway{/*path}', aigatewayProxy))
  .use(proxy('/devops_webhook{/*path}', devopsWebhookProxy))
  .use(proxy('/b2i_download{/*path}', b2iFileProxy))
  .post('/dockerhub{/*path}', parseBody, handleDockerhubProxy)
  .post('/harbor{/*path}', parseBody, handleHarborProxy)
  .get('/blank_md', renderMarkdown)

  // oauth - frontend handles redirect/callback first
  .get('/oauth/redirect/:name', renderOAuthRedirect)
  .get('/oauth/callback/:name', handleOAuthCallback)

  .all('/{k}api{s}{/*path}', checkIfExist)
  .use(proxy('/{k}api{s}{/*path}', k8sResourceProxy))
  // session
  .post('/oauth/login/:title', parseBody, handleThirdLogin)
  .get('/login', renderLogin)
  .post('/login/confirm', parseBody, handleLoginConfirm)
  .get('/login/confirm', renderLoginConfirm)
  .post('/logout', handleLogout)
  .get('/session/context', handleSessionContext)

  // proxy oauth requests to backend (after frontend routes have chance)
  // Inject credentials for /oauth/token POST requests
  .post('/oauth/token', parseBody, injectOAuthCredentials)
  // Extract token from query parameter for /oauth/authorize requests
  .get('/oauth/authorize', extractTokenFromQuery)
  .use(proxy('/oauth{/*path}', k8sResourceProxy))

  // terminal
  .get('/terminal{/*path}', renderTerminal)
  // page entry
  // The new console's client routes. Registered before the old console's page
  // renderer so a deep link reaches the router rather than the old shell.
  .get('/kube-frontend{/*path}', newConsoleShell)
  .all('{/*path}', renderView)

module.exports = router
