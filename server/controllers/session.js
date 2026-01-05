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

const isEmpty = require('lodash/isEmpty')
const omit = require('lodash/omit')
const base64_url_decode = require('jwt-decode/lib/base64_url_decode')
const { getServerConfig } = require('../libs/utils')

const { client: clientConfig } = getServerConfig()

// Normalize login response payload
const formatLoginResponse = (user, ctx, additionalData = {}) => {
  if (!user || !user.token) {
    return null
  }

  const response = {
    token: user.token,
    username: user.username,
    email: user.email,
    groups: user.groups,
    extraname: user.extraname,
    initialized: user.initialized,
    ...additionalData,
  }

  // Handle pre-registration scenario
  if (user.username === 'system:pre-registration') {
    response.needConfirm = true
    response.confirmUrl = '/login/confirm'
    response.defaultUser = user.extraname
    response.defaultEmail = user.email
  }

  // Handle password confirmation scenario
  if (!user.initialized) {
    response.needPasswordChange = true
    response.passwordChangeUrl = '/password/confirm'
  }

  return response
}

// Normalize error payload
const formatErrorResponse = (status, reason, message) => {
  return {
    status,
    reason,
    message,
  }
}

const mapLoginError = (err, { includeErrorDescription } = {}) => {
  switch (err.code) {
    case 400:
    case 401: {
      const errorDesc = (err.error_description || '').toLowerCase()
      let message = 'INCORRECT_USERNAME_OR_PASSWORD' // 默认值

      if (err.error === 'invalid_grant') {
        // 根据 error_description 映射到更具体的错误消息
        if (errorDesc.includes('incorrect password') || errorDesc.includes('password')) {
          message = 'INCORRECT_PASSWORD'
        } else if (errorDesc.includes('user not found') || errorDesc.includes('user does not exist')) {
          message = 'USER_NOT_FOUND'
        } else {
          message = 'INCORRECT_USERNAME_OR_PASSWORD'
        }
      } else if (includeErrorDescription && err.error_description) {
        message = err.error_description
      }

      return formatErrorResponse(err.code, 'Unauthorized', message)
    }
    case 429:
      return formatErrorResponse(err.code, 'Too Many Failures', 'TOO_MANY_FAILURES')
    case 502:
      return formatErrorResponse(err.code, 'Bad Gateway', 'FAILED_TO_ACCESS_BACKEND')
    case 'ETIMEDOUT':
      return formatErrorResponse(500, 'Internal Server Error', 'FAILED_TO_ACCESS_API_SERVER')
    default:
      return formatErrorResponse(500, err.statusText, err.message)
  }
}

const {
  loginThird,
  oAuthLogin,
  createUser,
  getCurrentUser,
  getKSConfig,
  getK8sRuntime,
  getClusterRole,
  getSupportGpuList,
  getGitOpsEngine,
} = require('../services/session')
const {
  safeParseJSON,
} = require('../libs/utils')

const { send_gateway_request } = require('../libs/request')

const handleThirdLogin = async ctx => {
  const params = ctx.request.body

  if (!params.username || !params.password) {
    ctx.status = 400
    ctx.body = formatErrorResponse(400, 'Invalid Login Params', 'invalid login params')
    return
  }

  try {
    const user = await loginThird(params, { 'x-client-ip': ctx.request.ip })

    if (!user) {
      ctx.status = 401
      ctx.body = formatErrorResponse(401, 'Unauthorized', 'INCORRECT_USERNAME_OR_PASSWORD')
      return
    }

    ctx.body = formatLoginResponse(user, ctx)
  } catch (err) {
    ctx.app.emit('error', err)
    const errorResponse = mapLoginError(err)
    ctx.status = errorResponse.status
    ctx.body = errorResponse
  }
}

const handleLogout = async ctx => {
  const oAuthLoginInfo = safeParseJSON(
    decodeURIComponent(ctx.cookies.get('oAuthLoginInfo'))
  )

  const authHeader = ctx.headers.authorization
  const token = authHeader ? authHeader.replace('Bearer ', '') : null

  ctx.cookies.set('oAuthLoginInfo', null)

  if (
    !isEmpty(oAuthLoginInfo) &&
    oAuthLoginInfo.type &&
    oAuthLoginInfo.type === 'OIDCIdentityProvider' &&
    oAuthLoginInfo.endSessionURL
  ) {
    const url = `${oAuthLoginInfo.endSessionURL}`
    ctx.body = { data: { url }, success: true }
  } else {
    if (token) {
      await send_gateway_request({
        method: 'GET',
        url: '/oauth/logout',
        token,
      })
    }

    ctx.body = { success: true }
  }
}

const handleLoginConfirm = async ctx => {
  const authHeader = ctx.headers.authorization
  const token = authHeader ? authHeader.replace('Bearer ', '') : null
  const params = ctx.request.body

  if (!token) {
    ctx.status = 401
    ctx.body = {
      status: 401,
      reason: 'Unauthorized',
      message: 'No token provided',
    }
    return
  }

  await createUser(params, token)

  // Since we removed refresh token logic, just return success
  ctx.body = { success: true }
}

const handleSessionContext = async ctx => {
  try {
    const clusterRole = await getClusterRole(ctx)
    const ksConfig = await getKSConfig()

    const [user, runtime, supportGpuType, gitopsEngine] = await Promise.all([
      getCurrentUser(ctx, clusterRole, ksConfig.multicluster),
      getK8sRuntime(ctx),
      getSupportGpuList(ctx),
      getGitOpsEngine(ctx),
    ])

    ctx.body = {
      user,
      ksConfig,
      runtime,
      clusterRole,
      config: { ...clientConfig, supportGpuType, gitopsEngine },
    }
  } catch (err) {
    ctx.app.emit('error', err)
    const status = err.code || err.status || 500
    ctx.status = status
    ctx.body = formatErrorResponse(
      status,
      err.reason || err.message || 'Failed to load session context',
      err.message || 'FAILED_TO_LOAD_SESSION_CONTEXT'
    )
  }
}

// OAuth API endpoint that returns token payload for AJAX usage
const handleOAuthCallback = async ctx => {
  const oauthParams = omit(ctx.query, ['redirect_url', 'state'])

  try {
    const user = await oAuthLogin({ ...oauthParams, oauthName: ctx.params.name })

    if (!user) {
      ctx.status = 401
      ctx.body = formatErrorResponse(401, 'Unauthorized', 'INCORRECT_USERNAME_OR_PASSWORD')
      return
    }

    // Parse redirect URL from state or query parameter
    let redirectUrl = null
    const state = ctx.query.state
    const redirect_url = ctx.query.redirect_url

    if (state) {
      try {
        const state_object = JSON.parse(base64_url_decode(state))
        if (state_object.redirect_url) {
          redirectUrl = state_object.redirect_url
        }
      } catch (err) {
        /* eslint-disable no-console */
        console.log(err)
      }
    }

    if (redirect_url) {
      try {
        const redirectHost = new URL(redirect_url).host
        if (redirectHost === ctx.headers.host) {
          redirectUrl = redirect_url
        }
      } catch (err) {
        console.log(err)
      }
    }

    const response = formatLoginResponse(user, ctx, { redirectUrl })
    ctx.body = response
  } catch (err) {
    /* eslint-disable no-console */
    console.log(err)

    ctx.app.emit('error', err)
    const errorResponse = mapLoginError(err)
    ctx.status = errorResponse.status
    ctx.body = errorResponse
  }
}

module.exports = {
  handleThirdLogin,
  handleLogout,
  handleSessionContext,
  handleOAuthCallback,
  handleLoginConfirm,
}
