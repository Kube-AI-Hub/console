/**
 * Evaluation harness for the secrets / service-accounts migration.
 *
 * Starts a fake ks-apiserver and a BFF in front of it, on ports 18091 (BFF) and
 * 18092 (fake). Point a second Vite dev server at it with
 * `BFF_URL=http://127.0.0.1:18091 vite --port 5175` and the whole console is
 * drivable without touching the live cluster.
 *
 * Print the recorded upstream requests on exit so a run can be audited:
 *
 *   node --import tsx scripts/dev-eval.ts
 */

import { startFakeKube } from './fake-kube';
import { startServer } from '../server/src/index';
import { loadConfig } from '../server/src/config';
import { loadManifest } from '../server/src/index';

const FAKE_PORT = 18092;
const BFF_PORT = 18091;

async function main(): Promise<void> {
  const fake = await startFakeKube({
    projects: ['default', 'dev'],
    seed: {
      // One account with a token Secret, and one without: the detail page has a
      // different empty state for the second.
      serviceaccounts: [
        {
          metadata: {
            name: 'build-bot',
            namespace: 'default',
            annotations: { 'kubesphere.io/creator': 'admin', 'iam.kubesphere.io/role': 'project-viewer', 'kubesphere.io/description': 'CI 构建使用' },
          },
          secrets: [{ name: 'build-bot-token-abcde' }],
        },
        { metadata: { name: 'no-token', namespace: 'default' } },
      ],
      secrets: [
        {
          metadata: { name: 'build-bot-token-abcde', namespace: 'default', annotations: { 'kubernetes.io/service-account.name': 'build-bot' } },
          type: 'kubernetes.io/service-account-token',
          data: {
            token: Buffer.from('eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJidWlsZC1ib3QifQ.sig').toString('base64'),
            'ca.crt': Buffer.from('-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n').toString('base64'),
            namespace: Buffer.from('default').toString('base64'),
          },
        },
        {
          metadata: { name: 'web-tls', namespace: 'default', annotations: { 'kubesphere.io/creator': 'admin' } },
          type: 'kubernetes.io/tls',
          data: { 'tls.crt': Buffer.from('-----BEGIN CERTIFICATE-----\nCRT\n-----END CERTIFICATE-----').toString('base64'), 'tls.key': Buffer.from('-----BEGIN PRIVATE KEY-----\nKEY\n-----END PRIVATE KEY-----').toString('base64') },
        },
        {
          metadata: { name: 'registry', namespace: 'default' },
          type: 'kubernetes.io/dockerconfigjson',
          data: { '.dockerconfigjson': Buffer.from(JSON.stringify({ auths: { 'https://harbor.example.com': { username: 'robot', password: 's3cret', email: 'ci@example.com', auth: Buffer.from('robot:s3cret').toString('base64') } } })).toString('base64') },
        },
      ],
    },
  });

  // The fake listens on an ephemeral port; proxy config must point at it.
  process.env['KS_API_URL'] = fake.url;
  process.env['KS_API_MODE'] = 'kapis';
  const config = { ...loadConfig(process.env), baseUrl: fake.url };
  const server = await startServer(BFF_PORT, { config, manifest: loadManifest });
  console.log(`[eval] fake kube ${fake.url}`);
  console.log(`[eval] bff       http://127.0.0.1:${BFF_PORT}`);
  console.log(`[eval] fake port ${FAKE_PORT} (unused; kept for compatibility)`);

  const shutdown = async (): Promise<void> => {
    const writes = fake.requests.filter((entry) => entry.method !== 'GET');
    console.log(`[eval] upstream requests: ${fake.requests.length}, writes: ${writes.length}`);
    for (const entry of writes) console.log(`[eval]   ${entry.method} ${entry.url}`);
    server.close();
    await fake.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

void main();
