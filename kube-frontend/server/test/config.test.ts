import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createHandler, type HandlerDeps } from '../src/index';
import { DEFAULT_DOCS, loadDocs } from '../src/docs';
import type { UpstreamConfig } from '../src/config';

/**
 * `GET /api/config` and its env overrides.
 *
 * The docs links are deployment-specific (the old console read them from its server
 * config). They must be reachable without a token — the SPA's header knows nothing about
 * the deployment — and a blank env value must fall back to the old paths rather than
 * rendering an empty help link.
 */
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

const config: UpstreamConfig = {
  baseUrl: 'http://127.0.0.1:1',
  apiPrefix: '/kapis/resources.kubesphere.io/v1alpha3',
  mode: 'kapis',
};

async function startBff(docs?: HandlerDeps['docs']): Promise<string> {
  const deps: HandlerDeps = { config, manifest: async () => [], ...(docs === undefined ? {} : { docs }) };
  const server = createServer((request, response) => void createHandler(deps)(request, response));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  return `http://127.0.0.1:${address.port}`;
}

describe('loadDocs', () => {
  it('keeps the old console’s relative paths by default', () => {
    expect(loadDocs({})).toEqual(DEFAULT_DOCS);
  });

  it('reads deployment overrides and lets an explicit empty value disable an entry', () => {
    const docs = loadDocs({
      KS_DOCS_URL_ZH: 'https://docs.example.com/zh/',
      KS_DOCS_API_ZH: '',
      KS_DOCS_URL_EN: 'https://docs.example.com/',
      KS_DOCS_API_EN: 'https://docs.example.com/api/',
    });
    expect(docs.zh.url).toBe('https://docs.example.com/zh/');
    // Explicitly empty: no docs on this deployment, so the SPA hides it.
    expect(docs.zh.api).toBe('');
    expect(docs.en.api).toBe('https://docs.example.com/api/');
  });
});

describe('GET /api/config', () => {
  it('serves defaults without a token', async () => {
    const bff = await startBff();
    const response = await fetch(`${bff}/api/config`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { documents: unknown };
    expect(body.documents).toEqual(DEFAULT_DOCS);
  });

  it('serves the deployment overrides', async () => {
    const docs = loadDocs({ KS_DOCS_URL_EN: 'https://docs.example.com/' });
    const bff = await startBff(docs);
    const body = (await (await fetch(`${bff}/api/config`)).json()) as { documents: typeof docs };
    expect(body.documents.en.url).toBe('https://docs.example.com/');
    expect(body.documents.en.api).toBe(DEFAULT_DOCS.en.api);
  });

  it('rejects non-GET', async () => {
    const bff = await startBff();
    const response = await fetch(`${bff}/api/config`, { method: 'POST' });
    expect(response.status).toBe(405);
  });
});
