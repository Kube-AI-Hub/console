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

test('keeps other upgrades on ks-apiserver', () => {
  assert.equal(
    getWebSocketTarget('/kapis/terminal.kubesphere.io/socket'),
    'ws://ks-apiserver'
  )
})
