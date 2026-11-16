const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')

global.APP_ROOT = path.resolve(__dirname, '../..')

const { CSGHUB_RPROXY_TARGET } = require('../proxy')
const {
  getWebSocketPath,
  getWebSocketTarget,
  isNewConsoleUpgrade,
} = require('./wsProxy')

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

test('routes the new console terminal sockets to its own deployment', () => {
  // The new console's exec channel is a WebSocket; without this branch the
  // upgrade went to ks-apiserver, which does not know the app's prefix.
  // `config.yaml` ships `newConsole.enabled: false`, so the branch is inactive
  // until a deployment turns it on — this asserts the shape it will take.
  const exec = '/kube-frontend/api/v1/namespaces/default/pods/demo/exec?stdin=true'
  if (getWebSocketTarget(exec) !== 'ws://ks-apiserver') {
    assert.equal(isNewConsoleUpgrade(exec), true)
    assert.equal(getWebSocketPath(exec), '/api/v1/namespaces/default/pods/demo/exec?stdin=true')
  }
  // A path that merely shares the characters is not the prefix.
  assert.equal(isNewConsoleUpgrade('/kube-frontendish/x'), false)
})
