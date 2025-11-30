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

const {
  getCurrentUser,
  getKSConfig,
  getK8sRuntime,
  getOAuthInfo,
  getClusterRole,
  getSupportGpuList,
  getGitOpsEngine,
} = require('../services/session')

const { oAuthLogin } = require('../services/session')

const {
  getServerConfig,
  getManifest,
  getLocaleManifest,
  isValidReferer,
  safeBase64,
} = require('../libs/utils')

const { client: clientConfig } = getServerConfig()

const renderView = async ctx => {
  const baseGlobals = {
    user: null,
    ksConfig: {},
    runtime: null,
    clusterRole: 'host',
    config: { ...clientConfig },
  }

  const hasAuthHeader = Boolean(
    ctx.headers.authorization || ctx.headers.Authorization
  )

  if (!hasAuthHeader) {
    await renderIndex(ctx, baseGlobals)
    return
  }

  try {
    const clusterRole = await getClusterRole(ctx)
    const ksConfig = await getKSConfig()

    const [user, runtime, supportGpuType, gitopsEngine] = await Promise.all([
      getCurrentUser(ctx, clusterRole, ksConfig.multicluster),
      getK8sRuntime(ctx),
      getSupportGpuList(ctx),
      getGitOpsEngine(ctx),
    ])

    await renderIndex(ctx, {
      ksConfig,
      user,
      runtime,
      clusterRole,
      config: { ...clientConfig, supportGpuType, gitopsEngine },
    })
  } catch (err) {
    if (err.code === 401 || err.status === 401) {
      await renderIndex(ctx, baseGlobals)
      return
    }
    await renderViewErr(ctx, err)
  }
}

const renderLogin = async ctx => {
  const oauthServers = await getOAuthInfo(ctx)

  await renderIndex(ctx, {
    oauthServers: oauthServers || [],
  })
}

const renderLoginConfirm = async ctx => {
  await renderIndex(ctx, {})
}

const renderIndex = async (ctx, params) => {
  const manifest = getManifest('main')
  const localeManifest = getLocaleManifest()

  await ctx.render('index', {
    manifest,
    isDev: global.MODE_DEV,
    title: clientConfig.title,
    hostname: ctx.hostname,
    globals: JSON.stringify({
      config: clientConfig,
      localeManifest,
      ...params,
    }),
  })
}

const renderTerminal = async ctx => {
  const manifest = getManifest('terminalEntry')
  const localeManifest = getLocaleManifest()

  const baseGlobals = {
    localeManifest,
    user: null,
    ksConfig: {},
    runtime: null,
  }

  const hasAuthHeader = Boolean(
    ctx.headers.authorization || ctx.headers.Authorization
  )

  if (!hasAuthHeader) {
    await ctx.render('terminal', {
      manifest,
      isDev: global.MODE_DEV,
      title: clientConfig.title,
      hostname: ctx.hostname,
      globals: JSON.stringify(baseGlobals),
    })
    return
  }

  try {
    const [user, ksConfig, runtime] = await Promise.all([
      getCurrentUser(ctx),
      getKSConfig(),
      getK8sRuntime(ctx),
    ])

    await ctx.render('terminal', {
      manifest,
      isDev: global.MODE_DEV,
      title: clientConfig.title,
      hostname: ctx.hostname,
      globals: JSON.stringify({
        localeManifest,
        user,
        ksConfig,
        runtime,
      }),
    })
  } catch (err) {
    if (err.code === 401 || err.status === 401) {
      await ctx.render('terminal', {
        manifest,
        isDev: global.MODE_DEV,
        title: clientConfig.title,
        hostname: ctx.hostname,
        globals: JSON.stringify(baseGlobals),
      })
      return
    }
    await renderViewErr(ctx, err)
  }
}

const renderMarkdown = async ctx => {
  await ctx.render('blank_markdown')
}

const renderOAuthRedirect = async ctx => {
  const oauthName = ctx.params.name

  await ctx.render('oauth_redirect', {
    title: clientConfig.title,
    oauthProvider: oauthName,
    loginUrl: '/login',
  })
}

const renderViewErr = async (ctx, err) => {
  ctx.app.emit('error', err)
  if (err) {
    if (err.code === 401 || err.code === 403 || err.status === 401) {
      let referer = ctx.path
      if (ctx.path === '/authorize') {
        referer = encodeURIComponent(ctx.originalUrl)
      }

      const loginUrl = isValidReferer(referer)
        ? `/login?referer=${referer}`
        : '/login'

      const wantsJSON =
        ctx.accepts('json', 'html') === 'json' ||
        ctx.get('x-requested-with') === 'XMLHttpRequest' ||
        ctx.path.startsWith('/api/')

      if (wantsJSON) {
        ctx.status = 401
        ctx.body = {
          status: 401,
          reason: 'Unauthorized',
          message: 'Not authenticated',
          redirect: loginUrl,
        }
      } else {
        ctx.redirect(loginUrl)
      }
    } else if (err.code === 502) {
      await ctx.render('error', {
        title: clientConfig.title,
        t: ctx.t.bind(ctx),
        message: 'Unable to access the backend services',
      })
    } else if (err.code === 'ETIMEDOUT') {
      await ctx.render('error', {
        title: clientConfig.title,
        t: ctx.t.bind(ctx),
        message: 'Unable to access the api server',
      })
    } else {
      ctx.app.emit('error', err)
    }
  } else {
    await ctx.render('error', {
      title: clientConfig.title,
      t: ctx.t.bind(ctx),
    })
  }
}

module.exports = {
  renderView,
  renderTerminal,
  renderLogin,
  renderMarkdown,
  renderLoginConfirm,
  renderOAuthRedirect,
}
