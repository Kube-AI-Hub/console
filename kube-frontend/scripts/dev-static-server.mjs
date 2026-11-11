#!/usr/bin/env node
/**
 * Static file server for the built SPA, with the cluster API proxied to the BFF.
 *
 * `vite preview` serves the build but knows nothing about the BFF, and the app
 * calls `/kapis/...` on its own origin — so without this proxy those requests fall
 * through to the SPA fallback and a page receives `index.html` where it expected
 * JSON. That failure looks like "the list is empty" rather than a routing mistake,
 * which is why the prefixes are handled explicitly here.
 *
 * Usage: dev-static-server.mjs <distDir> <port> <bffUrl>
 */
import { createServer } from 'node:http';
import { Agent, setGlobalDispatcher } from 'undici';

/** Per-request ceiling for proxied API calls. */
const UPSTREAM_TIMEOUT_MS = 60_000;

/*
 * One kept-alive connection pool for upstream calls.
 *
 * The default dispatcher opens a connection per request; under a test run that is
 * thousands of connections to one process, and the resulting queueing looked like
 * upstream failure.
 */
setGlobalDispatcher(new Agent({ keepAliveTimeout: 10_000, connections: 32 }));
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const [distDir, portArg, bffUrl] = process.argv.slice(2);
if (!distDir || !portArg || !bffUrl) {
  console.error('usage: dev-static-server.mjs <distDir> <port> <bffUrl>');
  process.exit(1);
}

const port = Number(portArg);
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

/** Every prefix the BFF owns; anything else is an asset or an SPA route. */
const API_PREFIXES = ['/api', '/kapis', '/apis'];

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');

  if (API_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`))) {
    try {
      const headers = { accept: request.headers['accept'] ?? 'application/json' };
      // Forward only what the BFF needs; a blanket copy leaks hop-by-hop headers.
      for (const key of ['content-type', 'authorization']) {
        const value = request.headers[key];
        if (value) headers[key] = value;
      }

      let body;
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        body = Buffer.concat(chunks);
      }

      /*
       * A deadline and a kept-alive agent. Without them a handful of slow upstream
       * calls (a cluster-wide list, a cold login) queued behind each other and
       * later requests saw their own login time out — the suite then reported
       * "502 Bad Gateway" for a stack that was healthy when probed by hand.
       */
      const upstream = await fetch(`${bffUrl}${request.url}`, {
        method: request.method,
        headers,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        ...(body && body.length ? { body } : {}),
      });
      const payload = Buffer.from(await upstream.arrayBuffer());
      response.writeHead(upstream.status, {
        'content-type': upstream.headers.get('content-type') ?? 'application/json; charset=utf-8',
        'content-length': String(payload.length),
        'cache-control': 'no-store',
      });
      response.end(payload);
    } catch (cause) {
      response
        .writeHead(502, { 'content-type': 'application/json; charset=utf-8' })
        .end(JSON.stringify({ code: 'bff_unreachable', message: String(cause) }));
    }
    return;
  }

  const filePath = normalize(join(distDir, url.pathname === '/' ? 'index.html' : url.pathname));
  try {
    const file = await readFile(filePath);
    response.writeHead(200, { 'content-type': contentTypes[extname(filePath)] ?? 'application/octet-stream' }).end(file);
  } catch {
    // Client-side routes have no file on disk; hand back the SPA shell.
    const shell = await readFile(join(distDir, 'index.html'));
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(shell);
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`[dev-static] ${distDir} on http://127.0.0.1:${port} -> ${bffUrl}`);
});
