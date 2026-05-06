const {
  getCsgHubAssetTags,
  getCsgHubConfig,
  getAuthorization,
  uploadObject,
  getTempUrl,
  resolveRepoFile,
  streamResponse,
} = require('../services/csghub')

const requireConsoleJWT = ctx => {
  if (!getAuthorization(ctx)) {
    ctx.status = 401
    ctx.body = {
      status: 401,
      reason: 'Unauthorized',
      message: 'Console JWT is required',
    }
    return false
  }
  return true
}

const handleCsgHubPing = async ctx => {
  ctx.body = { message: 'pong' }
}

const handleCsgHubUpload = async ctx => {
  if (!requireConsoleJWT(ctx)) {
    return
  }

  try {
    ctx.body = await uploadObject(ctx)
  } catch (err) {
    ctx.status = err.status || 500
    ctx.body = { error: err.message }
  }
}

const handleCsgHubPrivateUpload = async ctx => {
  if (!requireConsoleJWT(ctx)) {
    return
  }

  try {
    ctx.body = await uploadObject(ctx, { isPrivate: true })
  } catch (err) {
    ctx.status = err.status || 500
    ctx.body = { error: err.message }
  }
}

const handleCsgHubTempUrl = async ctx => {
  if (!requireConsoleJWT(ctx)) {
    return
  }

  try {
    ctx.body = await getTempUrl(ctx.query.object_key)
  } catch (err) {
    ctx.status = err.status || 500
    ctx.body = { error: err.message }
  }
}

const handleCsgHubResolve = async ctx => {
  try {
    const result = await resolveRepoFile(ctx)
    ctx.type = result.contentType
    if (result.inline) {
      ctx.set('Content-Disposition', 'inline')
      ctx.respond = false
      await streamResponse(ctx, result.body)
      return
    }
    ctx.body = result.body
  } catch (err) {
    ctx.status = err.status || 500
    ctx.body = { error: err.message || 'An internal error occurred' }
  }
}

const setLocaleCookie = locale => async ctx => {
  ctx.cookies.set('locale', locale, {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: false,
  })
  ctx.redirect(ctx.get('referer') || '/platform-model')
}

const renderCsgHub = async ctx => {
  const config = getCsgHubConfig()
  await ctx.render('csghub', {
    title: '行业大模型平台',
    assetsHtml: getCsgHubAssetTags(),
    onPremise: config.onPremise !== false,
    enableHttps: Boolean(config.enableHttps),
  })
}

module.exports = {
  handleCsgHubPing,
  handleCsgHubUpload,
  handleCsgHubPrivateUpload,
  handleCsgHubTempUrl,
  handleCsgHubResolve,
  renderCsgHub,
  setCsgHubZhLocale: setLocaleCookie('zh'),
  setCsgHubEnLocale: setLocaleCookie('en'),
  setCsgHubZhHantLocale: setLocaleCookie('zhHant'),
}
