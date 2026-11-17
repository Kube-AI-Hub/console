/*
Copyright 2026 Kube AI Hub.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const fs = require('fs')
const path = require('path')

const { getServerConfig } = require('../libs/utils')

// `getServerConfig(key)` reads one top-level section of config.yaml (merged with
// local_config.yaml). Reading it per call rather than at require time keeps a
// test that sets `NODE_ENV` or a local override from seeing a stale snapshot.
function clientConfig() {
  return getServerConfig('client') || {}
}

/**
 * Deployment configuration for the new console.
 *
 * These two endpoints used to live in the new console's own Node process. That
 * process is gone, so this server answers them: they are properties of the
 * *deployment* (which docs this install hosts, which pages it declares), not of
 * the cluster API, so they do not belong in ks-apiserver.
 *
 * Both are unauthenticated on purpose. Neither contains a credential, and the
 * login page itself needs the docs links.
 */

/** Documentation links, from `client.documents` in config.yaml. */
const DEFAULT_DOCUMENTS = {
  zh: {
    url: '/kube-docs/zh/docs/',
    api: '/kube-docs/zh/docs/reference/api-docs/',
  },
  en: { url: '/kube-docs/docs/', api: '/kube-docs/docs/reference/api-docs/' },
}

function documents() {
  const configured = clientConfig().documents
  if (!configured) {
    return DEFAULT_DOCUMENTS
  }
  return {
    zh: configured.zh || DEFAULT_DOCUMENTS.zh,
    en: configured.en || DEFAULT_DOCUMENTS.en,
  }
}

async function handlePublicConfig(ctx) {
  if (ctx.method !== 'GET') {
    ctx.status = 405
    ctx.body = { code: 'method_not_allowed', status: 405 }
    return
  }
  ctx.set('Cache-Control', 'no-store')
  ctx.body = { documents: documents() }
}

/**
 * The AI surface manifest: the pages this build declares to an agent.
 *
 * Read from a file rather than generated here, because it is produced by the
 * frontend build. A missing file answers an empty list: an agent that sees "no
 * declared pages" can still browse, whereas a 500 gives it nothing.
 */
async function handleAiManifest(ctx) {
  if (ctx.method !== 'GET') {
    ctx.status = 405
    ctx.body = { code: 'method_not_allowed', status: 405 }
    return
  }
  const manifestPath =
    process.env.AI_MANIFEST_PATH ||
    path.resolve(
      global.APP_ROOT || __dirname,
      'dist/kube-frontend/ai-manifest.json'
    )

  let manifest = []
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  } catch (err) {
    // Absent or malformed: an empty declaration, not an error.
    manifest = []
  }
  ctx.set('Cache-Control', 'no-store')
  ctx.body = manifest
}

module.exports = {
  handlePublicConfig,
  handleAiManifest,
  documents,
  DEFAULT_DOCUMENTS,
}
