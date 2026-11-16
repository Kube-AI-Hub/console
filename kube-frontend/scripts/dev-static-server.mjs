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
 * Usage: dev-static-server.mjs <distDir> <port> <bffUrl> [basePrefix]
 *
 * `basePrefix` is the path the build was made with (vite `base`). Without it the server
 * assumes the build is rooted at `/`; a build made with `base: '/kube-frontend/'` asks for
 * `/kube-frontend/assets/…`, which would otherwise miss the file and fall back to
 * `index.html` -- the browser then refuses the module ("Expected a JavaScript module script")
 * and the page renders blank.
 */
import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { connect as netConnect } from 'node:net';
import { connect as tlsConnect } from 'node:tls';

/** Per-request ceiling for proxied API calls. */
const UPSTREAM_TIMEOUT_MS = 60_000;


import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const [distDir, portArg, bffUrl, prefixArg] = process.argv.slice(2);
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

/** The prefix the app is mounted on; the build's asset URLs carry it. */
const APP_PREFIX = '/kube-frontend';

/**
 * Drop the mount prefix, keeping the two shapes the app can be addressed with.
 *
 * The dev stack serves the build at the root (so `http://127.0.0.1:5178/` works for
 * a quick look) while every asset URL in the build says `/kube-frontend/assets/...`
 * — matching production, where the app sits under the prefix. Both have to resolve
 * to the same file, or the dev page renders unstyled with 404s.
 */
function stripAppPrefix(pathname) {
  if (pathname === APP_PREFIX) return '/';
  if (pathname.startsWith(`${APP_PREFIX}/`)) return pathname.slice(APP_PREFIX.length);
  return pathname;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const pathname = stripAppPrefix(url.pathname);

  if (API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    try {
      /*
       * Proxy with node:http, not fetch.
       *
       * Node's built-in fetch uses its own bundled undici: a `dispatcher` passed from a
       * separately installed copy is silently ignored, so the long-lived watch/log responses kept
       * occupying the shared 32-connection pool and every later call queued behind them. Using
       * http.request gives us the socket, the back-pressure and the cancellation directly.
       */
      const upstreamUrl = new URL(`${bffUrl}${pathname}${url.search}`);
      const isHttps = upstreamUrl.protocol === 'https:';
      const headers = { accept: request.headers['accept'] ?? 'application/json' };
      for (const key of ['content-type', 'authorization']) {
        const value = request.headers[key];
        if (value) headers[key] = value;
      }
      const upstreamRequest = (isHttps ? httpsRequest : httpRequest)({
        protocol: upstreamUrl.protocol,
        hostname: upstreamUrl.hostname,
        port: upstreamUrl.port || (isHttps ? 443 : 80),
        path: upstreamUrl.pathname + upstreamUrl.search,
        method: request.method,
        headers,
      });
      /*
       * A dead deadline, not a per-call one. A watch or a log tail legitimately holds its response
       * open; the timer only fires when the upstream accepted the request but never answered.
       */
      const timer = setTimeout(() => upstreamRequest.destroy(new Error('upstream timeout')), UPSTREAM_TIMEOUT_MS);
      timer.unref();
      response.on('close', () => {
        if (!response.writableEnded) {
          clearTimeout(timer);
          upstreamRequest.destroy();
        }
      });
      upstreamRequest.on('response', (upstream) => {
        clearTimeout(timer);
        const responseHeaders = {
          'content-type': upstream.headers['content-type'] ?? 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        };
        if (upstream.headers['content-length']) responseHeaders['content-length'] = upstream.headers['content-length'];
        response.writeHead(upstream.statusCode ?? 502, responseHeaders);
        upstream.pipe(response);
        upstream.on('error', () => response.destroy());
      });
      upstreamRequest.on('error', (cause) => {
        clearTimeout(timer);
        if (!response.headersSent) {
          response
            .writeHead(502, { 'content-type': 'application/json; charset=utf-8' })
            .end(JSON.stringify({ code: 'bff_unreachable', message: String(cause) }));
        } else {
          response.destroy();
        }
      });
      if (request.method === 'GET' || request.method === 'HEAD') {
        upstreamRequest.end();
      } else {
        request.pipe(upstreamRequest);
        request.on('error', () => upstreamRequest.destroy());
      }
    } catch (cause) {
      response
        .writeHead(502, { 'content-type': 'application/json; charset=utf-8' })
        .end(JSON.stringify({ code: 'bff_unreachable', message: String(cause) }));
    }
    return;
  }

  // `pathname` already had the app's mount prefix removed above; `prefixArg` (if
  // given) is a second, caller-supplied prefix some dev setups use.
  const basePrefix = prefixArg ? `/${prefixArg.replace(/^\/+|\/+$/g, '')}` : '';
  const filePathname = basePrefix && (pathname === basePrefix || pathname.startsWith(`${basePrefix}/`))
    ? pathname.slice(basePrefix.length) || '/'
    : pathname;
  const filePath = normalize(join(distDir, filePathname === '/' ? 'index.html' : filePathname));
  try {
    const file = await readFile(filePath);
    response.writeHead(200, { 'content-type': contentTypes[extname(filePath)] ?? 'application/octet-stream' }).end(file);
  } catch {
    /*
     * Client-side routes have no file on disk; hand back the SPA shell.
     *
     * The shell read needs its own guard. During `vite build` the output directory is
     * emptied and rewritten, so there is a window where even `index.html` does not
     * exist. Letting that rejection escape killed this process — the port went away
     * mid-run and every browser case in flight failed with a connection error, which
     * looks exactly like a product outage. A 503 with Retry-After is the accurate
     * answer: the server is fine, the artifact is being replaced.
     */
    try {
      const shell = await readFile(join(distDir, 'index.html'));
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(shell);
    } catch {
      response
        .writeHead(503, { 'content-type': 'text/plain; charset=utf-8', 'retry-after': '1' })
        .end('build in progress: dist/index.html is not available yet');
    }
  }
});

/**
 * WebSocket upgrades — the container terminal.
 *
 * An HTTP proxy cannot carry the exec channel: the request starts with
 * `Upgrade: websocket` and becomes a raw duplex socket after the 101. This dev
 * server is the browser's origin, so it has to relay that handshake to the BFF
 * byte for byte; the BFF adds the Authorization header and forwards to
 * ks-apiserver. Raw TCP is deliberate — no WebSocket library, and the token
 * subprotocol, key and accept headers pass through untouched.
 */
server.on('upgrade', (request, clientSocket, head) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const upgradePath = stripAppPrefix(url.pathname);
  if (!API_PREFIXES.some((prefix) => upgradePath === prefix || upgradePath.startsWith(`${prefix}/`))) {
    clientSocket.destroy();
    return;
  }

  const target = new URL(bffUrl);
  const targetPort = target.port ? Number(target.port) : target.protocol === 'https:' ? 443 : 80;
  const upstream =
    target.protocol === 'https:'
      ? tlsConnect({ host: target.hostname, port: targetPort, servername: target.hostname })
      : netConnect({ host: target.hostname, port: targetPort });

  upstream.on('connect', () => {
    // Rebuild the request line and headers; only `host` changes (the BFF is this
    // hop's origin). Key, version and subprotocols stay exactly as the browser
    // sent them, because the handshake has to be accepted end to end.
    // The request line carries the prefix-stripped path, so the BFF sees the same
    // shape it would behind the production reverse proxy.
    const lines = [`${request.method} ${upgradePath}${url.search} HTTP/1.1`];
    for (let index = 0; index < request.rawHeaders.length; index += 2) {
      const name = request.rawHeaders[index];
      if (name.toLowerCase() === 'host') continue;
      lines.push(`${name}: ${request.rawHeaders[index + 1]}`);
    }
    lines.push(`host: ${target.host}`, '', '');
    upstream.write(lines.join('\r\n'));
    if (head.length > 0) upstream.write(head);
  });

  const destroy = () => {
    upstream.destroy();
    clientSocket.destroy();
  };
  upstream.on('error', destroy);
  clientSocket.on('error', destroy);
  upstream.on('close', () => clientSocket.destroy());
  clientSocket.on('close', () => upstream.destroy());
  upstream.pipe(clientSocket);
  clientSocket.pipe(upstream);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[dev-static] ${distDir} on http://127.0.0.1:${port} -> ${bffUrl}`);
});
