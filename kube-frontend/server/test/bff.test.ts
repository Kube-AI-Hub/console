import { createServer, type IncomingMessage, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createHandler, type HandlerDeps } from '../src/index';
import { isProxiedPath } from '../src/proxy';
import type { UpstreamConfig } from '../src/config';

/**
 * These tests run against a real HTTP server standing in for ks-apiserver.
 *
 * The BFF is now a proxy: what matters is that the method, path, query, body and
 * Authorization header arrive unchanged, and that the response comes back as it
 * was sent. Mocking `http.request` would test the mock, not the contract.
 */

interface Recorded {
  method: string | undefined;
  url: string | undefined;
  headers: IncomingMessage['headers'];
  body: string;
}

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

/** Start a fake upstream that records what it received. */
async function fakeUpstream(
  respond: (recorded: Recorded) => { status: number; body: string; headers?: Record<string, string> },
): Promise<{ baseUrl: string; recorded: Recorded[] }> {
  const recorded: Recorded[] = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const entry: Recorded = {
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      };
      recorded.push(entry);
      const result = respond(entry);
      response.writeHead(result.status, { 'content-type': 'application/json', ...result.headers });
      response.end(result.body);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  return { baseUrl: `http://127.0.0.1:${address.port}`, recorded };
}

/** Start the BFF on an ephemeral port, pointed at `upstream`. */
async function startBff(upstream: string, overrides: Partial<UpstreamConfig> = {}): Promise<string> {
  const config: UpstreamConfig = {
    baseUrl: upstream,
    apiPrefix: '/kapis/resources.kubesphere.io/v1alpha3',
    mode: 'kapis',
    ...overrides,
  };
  const deps: HandlerDeps = { config, manifest: async () => [] };
  const server = createServer((request, response) => void createHandler(deps)(request, response));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  return `http://127.0.0.1:${address.port}`;
}

const KAPIS = '/kapis/resources.kubesphere.io/v1alpha3/namespaces/demo/configmaps';

describe('isProxiedPath', () => {
  it.each(['/kapis/x', '/kapis/', '/api/v1/namespaces/x', '/apis/apps/v1/deployments'])(
    'forwards %s',
    (path) => {
      expect(isProxiedPath(path)).toBe(true);
    },
  );

  it('does not forward app routes', () => {
    expect(isProxiedPath('/')).toBe(false);
    expect(isProxiedPath('/api/ai/manifest')).toBe(false);
  });
});

describe('proxy', () => {
  it('forwards GET with query and Authorization unchanged', async () => {
    const upstream = await fakeUpstream(() => ({ status: 200, body: '{"items":[]}' }));
    const bff = await startBff(upstream.baseUrl);

    const response = await fetch(`${bff}${KAPIS}?page=2&limit=10`, {
      headers: { authorization: 'Bearer token-abc' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [] });
    expect(upstream.recorded).toHaveLength(1);
    const call = upstream.recorded[0]!;
    expect(call.method).toBe('GET');
    expect(call.url).toBe(`${KAPIS}?page=2&limit=10`);
    expect(call.headers.authorization).toBe('Bearer token-abc');
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('forwards %s with the body intact', async (method) => {
    const upstream = await fakeUpstream(() => ({ status: 201, body: '{"ok":true}' }));
    const bff = await startBff(upstream.baseUrl);
    const payload = JSON.stringify({ kind: 'ConfigMap', data: { key: 'value' } });

    const response = await fetch(`${bff}${KAPIS}/app-config`, {
      method,
      headers: { 'content-type': 'application/json' },
      ...(method === 'DELETE' ? {} : { body: payload }),
    });

    expect(response.status).toBe(201);
    const call = upstream.recorded[0]!;
    expect(call.method).toBe(method);
    expect(call.url).toBe(`${KAPIS}/app-config`);
    if (method !== 'DELETE') expect(call.body).toBe(payload);
  });

  it('passes the upstream status and body through, including errors', async () => {
    const upstream = await fakeUpstream(() => ({
      status: 409,
      body: '{"kind":"Status","message":"already exists"}',
    }));
    const bff = await startBff(upstream.baseUrl);

    const response = await fetch(`${bff}${KAPIS}`, { method: 'POST', body: '{}' });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ kind: 'Status', message: 'already exists' });
  });

  it('forwards the plain kube API paths without rewriting them in kapis mode', async () => {
    const upstream = await fakeUpstream(() => ({ status: 200, body: '{}' }));
    const bff = await startBff(upstream.baseUrl);

    await fetch(`${bff}/api/v1/namespaces/demo/configmaps/app-config`);

    expect(upstream.recorded[0]?.url).toBe('/api/v1/namespaces/demo/configmaps/app-config');
  });

  it('rewrites a kapis path for kubectl proxy and drops kapis-only parameters', async () => {
    const upstream = await fakeUpstream(() => ({ status: 200, body: '{"kind":"ConfigMapList","items":[]}' }));
    const bff = await startBff(upstream.baseUrl, { mode: 'kube' });

    await fetch(`${bff}${KAPIS}?page=2&limit=10&sortBy=name&ascending=false`);

    // The plain kube API rejects these with a 400; the harness emulates them
    // locally instead (see `emulateKapisList`).
    expect(upstream.recorded[0]?.url).toBe('/api/v1/namespaces/demo/configmaps');
  });

  it('emulates kapis paging on the harness so a paged list can be checked locally', async () => {
    const items = Array.from({ length: 5 }, (_, index) => ({
      metadata: { name: `cm-${index}`, creationTimestamp: `2026-01-0${index + 1}T00:00:00Z` },
    }));
    const upstream = await fakeUpstream(() => ({
      status: 200,
      body: JSON.stringify({ kind: 'ConfigMapList', apiVersion: 'v1', items }),
    }));
    const bff = await startBff(upstream.baseUrl, { mode: 'kube' });

    const response = await fetch(`${bff}${KAPIS}?page=2&limit=2&sortBy=name&ascending=true`);
    const body = (await response.json()) as { items: Array<{ metadata: { name: string } }>; totalItems: number };

    // Sorted by name then sliced: page 2 of 2 is `cm-2`, `cm-3`.
    expect(body.totalItems).toBe(5);
    expect(body.items.map((item) => item.metadata.name)).toEqual(['cm-2', 'cm-3']);
  });

  it('drops cookie so a browser session never reaches the cluster', async () => {
    const upstream = await fakeUpstream(() => ({ status: 200, body: '{}' }));
    const bff = await startBff(upstream.baseUrl);

    await fetch(`${bff}${KAPIS}`, { headers: { cookie: 'session=secret', referer: 'http://x/' } });

    const call = upstream.recorded[0]!;
    expect(call.headers.cookie).toBeUndefined();
    expect(call.headers.referer).toBeUndefined();
  });
});

describe('routes', () => {
  it('serves the manifest', async () => {
    const upstream = await fakeUpstream(() => ({ status: 200, body: '{}' }));
    const bff = await startBff(upstream.baseUrl);

    const response = await fetch(`${bff}/api/ai/manifest`);

    expect(response.status).toBe(200);
    expect(upstream.recorded).toHaveLength(0);
  });

  it('returns 404 for an unknown app path', async () => {
    const upstream = await fakeUpstream(() => ({ status: 200, body: '{}' }));
    const bff = await startBff(upstream.baseUrl);

    const response = await fetch(`${bff}/api/configmaps`);

    expect(response.status).toBe(404);
  });

  it('reports an unreachable upstream as 502 rather than a crash', async () => {
    // Port 1 is reserved and refuses connections, which is what a wrong
    // KS_API_URL looks like in practice.
    const bff = await startBff('http://127.0.0.1:1');

    const response = await fetch(`${bff}${KAPIS}`);

    expect(response.status).toBe(502);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('upstream_unreachable');
  });
});
