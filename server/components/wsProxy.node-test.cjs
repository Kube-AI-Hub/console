const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')

global.APP_ROOT = path.resolve(__dirname, '../..')

const { CSGHUB_RPROXY_TARGET } = require('../proxy')
const { getWebSocketTarget } = require('./wsProxy')

test('routes endpoint upgrades to CSGHub rproxy', () => {
  assert.equal(
    getWebSocketTarget('/endpoint/inference-service/socket'),
    CSGHUB_RPROXY_TARGET
  )
})

test('routes same-origin studio upgrades to the workshop target', () => {
  // Without this branch the agent workshop terminal socket was proxied to
  // ks-apiserver, which answered 403 and forced a long-poll fallback.
  assert.equal(
    getWebSocketTarget(
      '/studio-api/twins/admin/demo/shell/socket?cols=90&rows=26'
    ),
    'http://agent-platform-web.agent-platform.svc:8080'
  )
  assert.equal(
    getWebSocketTarget('/studio-preview/'),
    'http://agent-platform-web.agent-platform.svc:8080'
  )
})

test('keeps other upgrades on ks-apiserver', () => {
  assert.equal(
    getWebSocketTarget('/kapis/terminal.kubesphere.io/socket'),
    'ws://ks-apiserver'
  )
})
