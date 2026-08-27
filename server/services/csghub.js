const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { pipeline } = require('stream/promises')

const fetch = require('node-fetch').default
const { Client } = require('minio')
const { formidable } = require('formidable')

const { getServerConfig } = require('../libs/utils')

const IMAGE_CONTENT_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  avif: 'image/avif',
  tiff: 'image/tiff',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  heic: 'image/heic',
  heif: 'image/heif',
}

const DEFAULT_CONTENT_TYPE = 'application/octet-stream'

const getCsgHubConfig = () => getServerConfig().server.csghub || {}

const normalizeBaseUrl = url => (url || '').replace(/\/+$/, '')

const getCsgHubDistPath = () =>
  [
    path.resolve(global.APP_ROOT, '../csghub/frontend/dist'),
    path.resolve(global.APP_ROOT, 'csghub/frontend/dist'),
  ].find(fs.existsSync)

const getApiBaseUrl = () => {
  const apiServer = getCsgHubConfig().apiServer || {}
  const baseUrl = normalizeBaseUrl(apiServer.url)
  const apiBasePath = normalizeBaseUrl(apiServer.apiBasePath || '/api/v1')
  return `${baseUrl}${apiBasePath}`
}

const getAuthorization = ctx => {
  const authorization = ctx.get('Authorization') || ctx.get('authorization')
  return authorization || ''
}

const getBearerToken = ctx => {
  const authorization = getAuthorization(ctx)
  if (!authorization.startsWith('Bearer ')) {
    return ''
  }
  return authorization.slice('Bearer '.length)
}

const decodeJwtPayload = token => {
  try {
    const [, payload] = token.split('.')
    if (!payload) {
      return {}
    }
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'))
  } catch (err) {
    return {}
  }
}

const getCurrentUsername = ctx => {
  const payload = decodeJwtPayload(getBearerToken(ctx))
  return payload.username || payload.preferred_username || payload.sub || ''
}

const buildAuthHeaders = ctx => {
  const authorization = getAuthorization(ctx)
  return authorization ? { Authorization: authorization } : {}
}

const getObjectKeyByType = type => {
  const name = crypto.randomUUID()
  switch (type) {
    case 'user-avatar':
      return `avatar/${name}`
    case 'org-logo':
      return `org_logo/${name}`
    case 'comment':
      return `comment/${name}`
    case 'application-space-cover-image':
      return `space/${name}`
    case 'admin-photo':
      return `admin-photo/${name}`
    default:
      return name
  }
}

const parseEndpoint = (endpoint, enableSSL) => {
  const protocol = enableSSL ? 'https' : 'http'
  const parsed = new URL(endpoint.includes('://') ? endpoint : `${protocol}://${endpoint}`)
  return {
    endPoint: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : undefined,
    useSSL: parsed.protocol === 'https:',
  }
}

const createMinioClient = storageConfig => {
  if (!storageConfig?.endpoint) {
    throw new Error('S3 endpoint is not configured')
  }

  return new Client({
    ...parseEndpoint(storageConfig.endpoint, storageConfig.enableSSL),
    accessKey: storageConfig.accessKeyID || '',
    secretKey: storageConfig.accessKeySecret || '',
    region: storageConfig.region || undefined,
  })
}

const getStorageConfig = isPrivate => {
  const config = getCsgHubConfig()
  return isPrivate ? config.privateS3 : config.s3
}

const parseUpload = ctx =>
  new Promise((resolve, reject) => {
    const form = formidable({ multiples: false })
    form.parse(ctx.req, (err, fields, files) => {
      if (err) {
        reject(err)
        return
      }
      resolve({ fields, files })
    })
  })

const firstValue = value => (Array.isArray(value) ? value[0] : value)

const getUploadedFile = files => firstValue(files.file) || firstValue(files.upload)

const uploadObject = async (ctx, { isPrivate = false } = {}) => {
  const { fields, files } = await parseUpload(ctx)
  const file = getUploadedFile(files)
  if (!file) {
    const err = new Error('file is required')
    err.status = 400
    throw err
  }

  if (isPrivate && file.size > 2 * 1024 * 1024) {
    const err = new Error('File size too large')
    err.status = 400
    throw err
  }

  if (isPrivate && ctx.query.check_image === 'true') {
    const fileType = file.mimetype || ''
    if (!['image/jpeg', 'image/png'].includes(fileType)) {
      const err = new Error('Invalid file type')
      err.status = 400
      throw err
    }
  }

  const storageConfig = getStorageConfig(isPrivate)
  const client = createMinioClient(storageConfig)
  const namespace = firstValue(fields.namespace) || 'comment'
  const objectKey = getObjectKeyByType(namespace)
  const stream = fs.createReadStream(file.filepath)
  await client.putObject(storageConfig.bucket, objectKey, stream, file.size)

  if (isPrivate) {
    const url = await client.presignedGetObject(
      storageConfig.bucket,
      objectKey,
      24 * 60 * 60
    )
    return { url, code: objectKey }
  }

  const protocol = storageConfig.enableSSL ? 'https' : 'http'
  const endpoint = storageConfig.endpoint?.replace(/^https?:\/\//, '')
  return {
    url: `${protocol}://${endpoint}/${storageConfig.bucket}/${objectKey}`,
    code: objectKey,
  }
}

const getTempUrl = async objectKey => {
  if (!objectKey) {
    const err = new Error('object_key is required')
    err.status = 400
    throw err
  }

  const storageConfig = getStorageConfig(true)
  const client = createMinioClient(storageConfig)
  const url = await client.presignedGetObject(
    storageConfig.bucket,
    objectKey,
    24 * 60 * 60
  )
  return { url, code: 'some_key' }
}

const extensionOf = filename =>
  path.extname(filename || '').replace(/^\./, '').toLowerCase()

const isImagePath = filename => Boolean(IMAGE_CONTENT_TYPES[extensionOf(filename)])

const normalizeWildcardPath = value => {
  if (Array.isArray(value)) {
    return value.join('/')
  }
  return String(value || '').replace(/^\/+/, '')
}

const resolveRepoFile = async ctx => {
  const filePath = normalizeWildcardPath(ctx.params.path)
  if (!filePath) {
    const err = new Error('File path is required')
    err.status = 400
    throw err
  }

  const username = getCurrentUsername(ctx)
  const params = new URLSearchParams({
    ref: ctx.params.branch,
  })
  if (username) {
    params.set('current_user', username)
  }

  const endpointType = isImagePath(filePath) ? 'resolve' : 'raw'
  const target = `${getApiBaseUrl()}/${ctx.params.repo_type}/${ctx.params.namespace}/${ctx.params.name}/${endpointType}/${filePath}?${params.toString()}`
  const response = await fetch(target, {
    headers: buildAuthHeaders(ctx),
    redirect: 'manual',
  })

  if (!response.ok) {
    const err = new Error(`failed to resolve file: ${response.statusText}`)
    err.status = response.status
    throw err
  }

  if (isImagePath(filePath)) {
    return {
      body: response.body,
      contentType: IMAGE_CONTENT_TYPES[extensionOf(filePath)] || DEFAULT_CONTENT_TYPE,
      inline: true,
    }
  }

  const text = await response.text()
  let payload = { data: text }
  try {
    payload = JSON.parse(text)
  } catch (err) {}
  return {
    body: payload.data || '',
    contentType: 'text/plain; charset=utf-8',
    inline: false,
  }
}

const streamResponse = async (ctx, stream) => {
  await pipeline(stream, ctx.res)
}

const getCsgHubAssetTags = () => {
  const distPath = getCsgHubDistPath()
  const layoutPath = distPath
    ? path.resolve(distPath, 'src/views/layouts/base.html')
    : ''
  const sameOriginOpenScript = `<script data-label-studio-same-origin>
      (function () {
        var open = window.open;
        if (typeof open !== 'function') return;
        window.open = function (url, name, features) {
          try {
            var parsed = new URL(String(url), window.location.origin);
            var idx = parsed.pathname.indexOf('/-/label-studio');
            if (idx >= 0) {
              if (parsed.pathname.indexOf('/platform-model/-/label-studio') !== 0) {
                parsed.pathname = '/platform-model' + parsed.pathname.slice(idx);
              }
              url = parsed.pathname + parsed.search + parsed.hash;
            }
          } catch (e) {}
          return open.call(window, url, name, features);
        };
      })();
    </script>`
  try {
    const html = fs.readFileSync(layoutPath, 'utf8')
    const assetTags = html
      .split('\n')
      .filter(line => line.includes('/platform-model/assets/'))
      .join('\n')
    return `${sameOriginOpenScript}\n${assetTags}`
  } catch (err) {
    return `${sameOriginOpenScript}\n<script type="module" src="/platform-model/src/main.js" defer></script>`
  }
}

module.exports = {
  getCsgHubConfig,
  getCsgHubAssetTags,
  getAuthorization,
  uploadObject,
  getTempUrl,
  resolveRepoFile,
  streamResponse,
}
