#!/usr/bin/env node
/**
 * One-origin front door for the evaluation harness.
 *
 * The app calls `/api/*`, `/kapis/*` and `/api/v1/*` on its own origin. Vite's dev
 * proxy only forwards `/api`, so pointing Vite at the fake cluster's BFF made the
 * kapis reads hit the SPA fallback and answer HTML — which the pages correctly
 * rendered as an error. Rather than change the app's dev proxy (a product
 * setting), this small proxy serves the Vite dev server *and* forwards every API
 * prefix to the BFF, which is exactly what the production static server
 * (`dev-static-server.mjs`) does.
 *
 * Usage: eval-proxy.mjs <listenPort> <viteOrigin> <bffOrigin>
 */
import { createServer } from 'node:http';

const [portArg, viteOrigin, bffOrigin] = process.argv.slice(2);
if (!portArg || !viteOrigin || !bffOrigin) {
  console.error('usage: eval-proxy.mjs <listenPort> <viteOrigin> <bffOrigin>');
  process.exit(1);
}
const PREFIXES = ['/api/', '/kapis/', '/apis/'];

function forward(target, request, response, body) {
  const url = new URL(request.url ?? '/', target);
  const upstream = new URL(url);
  return new Promise((resolve, reject) => {
    const requestModule = upstream.protocol === 'https:' ? import('node:https') : import('node:http');
    requestModule
      .then(({ request: send }) => {
        const headers = { ...request.headers, host: upstream.host };
        const upstreamRequest = send(
          {
            protocol: upstream.protocol,
            hostname: upstream.hostname,
            port: upstream.port || 80,
            path: `${upstream.pathname}${upstream.search}`,
            method: request.method,
            headers,
          },
          (upstreamResponse) => {
            response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
            upstreamResponse.pipe(response);
            upstreamResponse.on('end', resolve);
          },
        );
        upstreamRequest.on('error', reject);
        upstreamRequest.end(body);
      })
      .catch(reject);
  });
}

const server = createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  const path = new URL(request.url ?? '/', 'http://x').pathname;
  const target = PREFIXES.some((prefix) => path.startsWith(prefix)) ? bffOrigin : viteOrigin;
  try {
    await forward(target, request, response, body.length ? body : undefined);
  } catch (cause) {
    response.writeHead(502, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ code: 'upstream_unreachable', message: String(cause) }));
  }
});

server.listen(Number(portArg), '127.0.0.1', () => {
  console.log(`[eval-proxy] http://127.0.0.1:${portArg} -> app ${viteOrigin}, api ${bffOrigin}`);
});
