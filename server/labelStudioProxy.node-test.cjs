const assert = require('node:assert/strict')
const http = require('http')
const path = require('path')
const test = require('node:test')

global.APP_ROOT = path.resolve(__dirname, '..')

const Koa = require('koa')
const proxy = require('./middlewares/proxy')
const {
  labelStudioProxy,
  rewriteLabelStudioLocation,
} = require('./proxy')

const listen = server =>
  new Promise(resolve => server.listen(0, '127.0.0.1', resolve))

const close = server => new Promise(resolve => server.close(resolve))

const request = (port, requestPath, { method = 'GET', redirect = false } = {}) =>
  new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: requestPath,
        method,
      },
      res => {
        const chunks = []
        res.on('data', chunk => chunks.push(chunk))
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString(),
          })
        })
      }
    )
    req.on('error', reject)
    req.end()
  })

test('rewrites Label Studio locations onto the console path', () => {
  assert.equal(
    rewriteLabelStudioLocation('/-/label-studio/user/login/'),
    '/platform-model/-/label-studio/user/login/'
  )
  assert.equal(
    rewriteLabelStudioLocation(
      'http://csghub.192.168.200.27.nip.io:30080/-/label-studio/static/css/main.css'
    ),
    '/platform-model/-/label-studio/static/css/main.css'
  )
  assert.equal(
    rewriteLabelStudioLocation('/platform-model/-/label-studio/user/login/'),
    '/platform-model/-/label-studio/user/login/'
  )
  assert.equal(
    rewriteLabelStudioLocation(
      '/user/login/?next=/platform-model/-/label-studio/projects/'
    ),
    '/platform-model/-/label-studio/user/login/?next=/platform-model/-/label-studio/projects/'
  )
})

test('proxies Label Studio under /platform-model and rewrites redirects', async t => {
  const upstream = http.createServer((req, res) => {
    if (req.url === '/' || req.url.startsWith('/user/login')) {
      res.writeHead(302, { Location: '/-/label-studio/user/login/' })
      res.end()
      return
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(`upstream:${req.url}`)
  })
  await listen(upstream)
  t.after(() => close(upstream))

  const originalTarget = labelStudioProxy.target
  labelStudioProxy.target = `http://127.0.0.1:${upstream.address().port}`
  t.after(() => {
    labelStudioProxy.target = originalTarget
  })

  const app = new Koa()
  app.use(proxy('/platform-model/-/label-studio{/*path}', labelStudioProxy))
  const consoleServer = http.createServer(app.callback())
  await listen(consoleServer)
  t.after(() => close(consoleServer))

  const consolePort = consoleServer.address().port
  const redirected = await request(
    consolePort,
    '/platform-model/-/label-studio/'
  )
  assert.equal(redirected.status, 302)
  assert.equal(
    redirected.headers.location,
    '/platform-model/-/label-studio/user/login/'
  )

  const proxied = await request(
    consolePort,
    '/platform-model/-/label-studio/projects?tab=1'
  )
  assert.equal(proxied.status, 200)
  assert.equal(proxied.body, 'upstream:/projects?tab=1')
})
