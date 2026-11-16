import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createHandler, type HandlerDeps } from '../src/index';
import { looksLikeAsset, resolveStaticPath, stripAppPrefix } from '../src/static';

/**
 * Static serving.
 *
 * The app and its API share one container, so the BFF has to answer both an
 * `index.html` for client routes and the hashed asset tree — and must not answer
 * either for a path that is not a file, because a script tag receiving HTML fails
 * with a syntax error that says nothing about the real problem.
 *
 * These tests use a real temp directory and a real HTTP server: what matters is
 * the bytes on the wire and the cache headers, not that a mock was called.
 */

const servers: Server[] = [];
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

/** A build-shaped directory: an index.html plus one hashed asset. */
async function fakeDist(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'bff-static-'));
  roots.push(root);
  await writeFile(join(root, 'index.html'), '<!doctype html><div id="root"></div>', 'utf8');
  await mkdir(join(root, 'assets'), { recursive: true });
  await writeFile(join(root, 'assets', 'index-abc123.js'), 'console.log(1)', 'utf8');
  return root;
}

async function startBff(staticDir: string): Promise<string> {
  const deps: HandlerDeps = {
    config: { baseUrl: 'http://127.0.0.1:1', apiPrefix: '/kapis/resources.kubesphere.io/v1alpha3', mode: 'kapis' },
    manifest: async () => [],
    staticDir,
  };
  const server = createServer((request, response) => void createHandler(deps)(request, response));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  return `http://127.0.0.1:${address.port}`;
}

describe('stripAppPrefix', () => {
  it.each([
    ['/kube-frontend/', '/'],
    ['/kube-frontend', '/'],
    ['/kube-frontend/login', '/login'],
    ['/kube-frontend/assets/a.js', '/assets/a.js'],
    // Already-stripped paths pass through: the reverse proxy removes the prefix.
    ['/login', '/login'],
    ['/assets/a.js', '/assets/a.js'],
    // A path that merely starts with the same characters is not the prefix.
    ['/kube-frontendish/x', '/kube-frontendish/x'],
  ])('%s → %s', (input, expected) => {
    expect(stripAppPrefix(input)).toBe(expected);
  });
});

describe('resolveStaticPath', () => {
  it('keeps paths inside the root', () => {
    expect(resolveStaticPath('/srv/dist', '/assets/a.js')).toBe('/srv/dist/assets/a.js');
  });

  it('refuses traversal, encoded or not', () => {
    // `normalize` clamps `..` at the root, so a traversal attempt lands inside the
    // build rather than on `/etc/passwd`; the containment check is the second line
    // of defence for any path shape that would not.
    for (const attempt of ['/../../etc/passwd', '/..%2f..%2fetc/passwd']) {
      const resolved = resolveStaticPath('/srv/dist', attempt);
      expect(resolved === null || resolved.startsWith('/srv/dist/')).toBe(true);
      expect(resolved).not.toBe('/etc/passwd');
    }
  });

  it('treats a malformed escape as a miss rather than throwing', () => {
    expect(resolveStaticPath('/srv/dist', '/%E0%A4%A')).toBeNull();
  });
});

describe('looksLikeAsset', () => {
  it('separates file requests from client routes', () => {
    expect(looksLikeAsset('/assets/index-abc.js')).toBe(true);
    expect(looksLikeAsset('/favicon.ico')).toBe(true);
    expect(looksLikeAsset('/system-workspace/clusters/host/projects/default/configmaps')).toBe(false);
  });
});

describe('static serving', () => {
  it('serves a hashed asset with an immutable cache', async () => {
    const bff = await startBff(await fakeDist());

    const response = await fetch(`${bff}/assets/index-abc123.js`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('javascript');
    expect(response.headers.get('cache-control')).toContain('immutable');
    expect(await response.text()).toBe('console.log(1)');
  });

  it('serves the shell for a client route, without a long cache', async () => {
    const bff = await startBff(await fakeDist());

    const response = await fetch(`${bff}/system-workspace/clusters/host/projects/default/configmaps`, {
      headers: { accept: 'text/html,application/xhtml+xml' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(response.headers.get('cache-control')).toBe('no-cache');
    expect(await response.text()).toContain('id="root"');
  });

  it('answers the prefixed form of the same route', async () => {
    // A direct call (health probe, curl against the pod) keeps the prefix; the
    // reverse proxy strips it. Both must land on the shell.
    const bff = await startBff(await fakeDist());

    const response = await fetch(`${bff}/kube-frontend/clusters/host`, { headers: { accept: 'text/html' } });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('id="root"');
  });

  it('404s a missing asset instead of returning the shell', async () => {
    const bff = await startBff(await fakeDist());

    const response = await fetch(`${bff}/assets/missing-def456.js`, { headers: { accept: 'text/html' } });

    // Handing HTML to a script tag is the failure this rule exists to prevent.
    expect(response.status).toBe(404);
  });

  it('404s a route request that explicitly wants JSON', async () => {
    const bff = await startBff(await fakeDist());

    const response = await fetch(`${bff}/some/client/route`, { headers: { accept: 'application/json' } });

    expect(response.status).toBe(404);
  });

  it('answers a bare `*/*` navigation with the shell', async () => {
    // curl and most probes send `*/*`; refusing it makes a working deployment look
    // like a 404 to every command-line check.
    const bff = await startBff(await fakeDist());

    const response = await fetch(`${bff}/clusters/host`, { headers: { accept: '*/*' } });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('id="root"');
  });

  it('keeps the API above the static tree', async () => {
    // A manifest call must never be answered by `index.html`, or an agent gets
    // HTML where it expected its page list.
    const bff = await startBff(await fakeDist());

    const response = await fetch(`${bff}/api/ai/manifest`, { headers: { accept: 'text/html' } });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
  });
});
