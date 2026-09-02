const assert = require('node:assert/strict')
const http = require('node:http')
const path = require('node:path')
const test = require('node:test')

global.APP_ROOT = path.resolve(__dirname, '..')

const Koa = require('koa')
const proxy = require('./middlewares/proxy')
const { aigatewayProxy, rewriteAigatewayPath } = require('./proxy')

const listen = server =>
  new Promise(resolve => server.listen(0, '127.0.0.1', resolve))

const close = server => new Promise(resolve => server.close(resolve))

const request = (port, requestPath, headers = {}, method = 'GET', body) =>
  new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: requestPath,
        method,
        headers,
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
    if (body) req.write(body)
    req.end()
  })

test('strips both /platform-model/aigateway and /aigateway prefixes', () => {
  assert.equal(rewriteAigatewayPath('/platform-model/aigateway'), '/')
  assert.equal(
    rewriteAigatewayPath('/platform-model/aigateway/v1/chat/completions'),
    '/v1/chat/completions'
  )
  assert.equal(rewriteAigatewayPath('/aigateway'), '/')
  assert.equal(
    rewriteAigatewayPath('/aigateway/v1/models'),
    '/v1/models'
  )
})

test('rewrites /aigateway to aigateway /v1 and preserves SSE', async t => {
  const upstream = http.createServer((req, res) => {
    if (req.url.endsWith('/stream')) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' })
      res.write('data: first\n\n')
      res.end('data: [DONE]\n\n')
      return
    }

    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        url: req.url,
        authorization: req.headers.authorization,
        method: req.method,
      })
    )
  })
  await listen(upstream)
  t.after(() => close(upstream))

  const upstreamPort = upstream.address().port
  aigatewayProxy.target = `http://127.0.0.1:${upstreamPort}`

  const app = new Koa()
  app.use(proxy('/platform-model/aigateway{/*path}', aigatewayProxy))
  app.use(proxy('/aigateway{/*path}', aigatewayProxy))
  const consoleServer = http.createServer(app.callback())
  await listen(consoleServer)
  t.after(() => close(consoleServer))

  const consolePort = consoleServer.address().port
  const response = await request(
    consolePort,
    '/aigateway/v1/chat/completions?stream=true',
    { Authorization: 'Bearer user-token' },
    'POST',
    '{}'
  )
  assert.equal(response.status, 200)
  assert.deepEqual(JSON.parse(response.body), {
    url: '/v1/chat/completions?stream=true',
    authorization: 'Bearer user-token',
    method: 'POST',
  })

  const prefixed = await request(
    consolePort,
    '/platform-model/aigateway/v1/chat/completions?stream=true',
    { Authorization: 'Bearer user-token' },
    'POST',
    '{}'
  )
  assert.equal(prefixed.status, 200)
  assert.deepEqual(JSON.parse(prefixed.body), {
    url: '/v1/chat/completions?stream=true',
    authorization: 'Bearer user-token',
    method: 'POST',
  })

  const stream = await request(
    consolePort,
    '/platform-model/aigateway/v1/chat/completions/stream'
  )
  assert.equal(stream.status, 200)
  assert.match(stream.headers['content-type'], /^text\/event-stream/)
  assert.equal(stream.body, 'data: first\n\ndata: [DONE]\n\n')
})
