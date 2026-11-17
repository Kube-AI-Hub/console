#!/usr/bin/env node
/**
 * Static file server for the built SPA, with everything under the app prefix
 * forwarded to a deployed console.
 *
 * There is no local API process any more: the deployed ks-console serves the API
 * prefixes straight from ks-apiserver and answers the app's own build. This server
 * exists only so a local build can be opened without deploying it — it serves the
 * files and relays everything else.
 *
 * Usage: dev-static-server.mjs <distDir> <port> <backendUrl> [basePrefix]
 *
 * `basePrefix` is the path the build was made with (vite `base`). Without it the
 * server assumes the build is rooted at `/`; a build made with
 * `base: '/kube-frontend/'` asks for `/kube-frontend/assets/…`, which would
 * otherwise miss the file and fall back to `index.html` — the browser then refuses
 * the module ("Expected a JavaScript module script") and the page renders blank.
 */
import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { connect as netConnect } from 'node:net';
import { connect as tlsConnect } from 'node:tls';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

/** Per-request ceiling for proxied calls. */
const UPSTREAM_TIMEOUT_MS = 60_000;

const [distDir, portArg, backendUrl, prefixArg] = process.argv.slice(2);
if (!distDir || !portArg || !backendUrl) {
  console.error('usage: dev-static-server.mjs <distDir> <port> <backendUrl> [basePrefix]');
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

/** The prefix the app is mounted on; the build's asset URLs carry it. */
const APP_PREFIX = '/kube-frontend';

/**
 * Paths that are not files: the API prefixes, plus the app's own config endpoints.
 * Everything else is an asset or a client route.
 */
const PROXY_PREFIXES = ['/kapis', '/apis', '/api'];

/**
 * Drop the mount prefix, keeping the two shapes the app can be addressed with.
 *
 * The dev server serves the build at the root (so `http://127.0.0.1:5178/` works
 * for a quick look) while every asset URL in the build says
 * `/kube-frontend/assets/...` — matching production, where the app sits under the
 * prefix. Both have to resolve to the same file, or the dev page renders unstyled
 * with 404s.
 */
function stripAppPrefix(pathname) {
  if (pathname === APP_PREFIX) return '/';
  if (pathname.startsWith(`${APP_PREFIX}/`)) return pathname.slice(APP_PREFIX.length);
  return pathname;
}

/** Whether a path belongs to the backend rather than to the build. */
function isProxyPath(pathname) {
  return PROXY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Forward one request to the backend, preserving the path it arrived with.
 *
 * The prefix is kept: the deployed console routes `/kube-frontend/kapis/...` to
 * ks-apiserver itself, and that is exactly the routing this server is here to
 * exercise. Rewriting it here would hide a mistake in the deployed configuration.
 */
function proxyToBackend(request, response) {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const target = new URL(`${backendUrl}${url.pathname}${url.search}`);
  const isHttps = target.protocol === 'https:';

  /*
   * Forward the caller's own headers, minus the hop-by-hop ones.
   *
   * Features depend on this: the add-cluster dialog asks `x-check-exist`, and the
   * exec handshake carries its token in `sec-websocket-protocol`. An allow-list of
   * two headers silently dropped both.
   */
  const headers = {};
  const DROP = new Set([
    'host',
    'connection',
    'content-length',
    'accept-encoding',
    'transfer-encoding',
    'upgrade',
    'keep-alive',
  ]);
  for (const [key, value] of Object.entries(request.headers)) {
    if (value === undefined || DROP.has(key.toLowerCase())) continue;
    headers[key] = Array.isArray(value) ? value.join(', ') : value;
  }

  const upstreamRequest = (isHttps ? httpsRequest : httpRequest)({
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || (isHttps ? 443 : 80),
    path: `${target.pathname}${target.search}`,
    method: request.method,
    headers,
  });

  /*
   * A dead deadline, not a per-call one. A watch or a log tail legitimately holds
   * its response open; the timer only fires when the upstream accepted the request
   * but never answered.
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
    response.writeHead(upstream.statusCode ?? 502, upstream.headers);
    upstream.pipe(response);
    upstream.on('error', () => response.destroy());
  });

  upstreamRequest.on('error', (cause) => {
    clearTimeout(timer);
    if (!response.headersSent) {
      response
        .writeHead(502, { 'content-type': 'application/json; charset=utf-8' })
        .end(JSON.stringify({ code: 'backend_unreachable', message: String(cause) }));
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
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const pathname = stripAppPrefix(url.pathname);

  if (isProxyPath(pathname)) {
    proxyToBackend(request, response);
    return;
  }

  // `pathname` already had the app's mount prefix removed above; `prefixArg` (if
  // given) is a second, caller-supplied prefix some dev setups use.
  const basePrefix = prefixArg ? `/${prefixArg.replace(/^\/+|\/+$/g, '')}` : '';
  const filePathname =
    basePrefix && (pathname === basePrefix || pathname.startsWith(`${basePrefix}/`))
      ? pathname.slice(basePrefix.length) || '/'
      : pathname;
  const filePath = normalize(join(distDir, filePathname === '/' ? 'index.html' : filePathname));

  try {
    const file = await readFile(filePath);
    response
      .writeHead(200, { 'content-type': contentTypes[extname(filePath)] ?? 'application/octet-stream' })
      .end(file);
  } catch {
    /*
     * Client-side routes have no file on disk; hand back the SPA shell.
     *
     * The shell read needs its own guard. During `vite build` the output directory
     * is emptied and rewritten, so there is a window where even `index.html` does
     * not exist. Letting that rejection escape killed this process — the port went
     * away mid-run and every browser case in flight failed with a connection error,
     * which looks exactly like a product outage. A 503 with Retry-After is the
     * accurate answer: the server is fine, the artifact is being replaced.
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
 * server is the browser's origin, so it has to relay that handshake to the
 * backend byte for byte; the backend authenticates it and forwards to
 * ks-apiserver. Raw TCP is deliberate — no WebSocket library, and the token
 * subprotocol, key and accept headers pass through untouched.
 */
server.on('upgrade', (request, clientSocket, head) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const upgradePath = url.pathname;
  const pathname = stripAppPrefix(upgradePath);
  if (!isProxyPath(pathname)) {
    clientSocket.destroy();
    return;
  }

  const target = new URL(backendUrl);
  const targetPort = target.port ? Number(target.port) : target.protocol === 'https:' ? 443 : 80;
  const upstream =
    target.protocol === 'https:'
      ? tlsConnect({ host: target.hostname, port: targetPort, servername: target.hostname })
      : netConnect({ host: target.hostname, port: targetPort });

  upstream.on('connect', () => {
    // Rebuild the request line and headers; only `host` changes (the backend is
    // this hop's origin). Key, version and subprotocols stay exactly as the
    // browser sent them, because the handshake has to be accepted end to end.
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
  console.log(`[dev-static] ${distDir} on http://127.0.0.1:${port} -> ${backendUrl}`);
});
