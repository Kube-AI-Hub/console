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

const {
  k8sResourceProxy,
  devopsWebhookProxy,
  b2iFileProxy,
} = require('./proxy')

const {
  handleDockerhubProxy,
  handleHarborProxy,
} = require('./controllers/api')

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

const parseBody = convert(
  bodyParser({
    formLimit: '200kb',
    jsonLimit: '200kb',
    bufferLimit: '4mb',
  })
)

const router = new Router()

router
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
  .all('{/*path}', renderView)

module.exports = router
