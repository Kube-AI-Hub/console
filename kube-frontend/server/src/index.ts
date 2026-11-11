import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { loadConfig, type UpstreamConfig } from './config';
import type { BffError } from './errors';
import { isProxiedPath, proxyRequest } from './proxy';
import { bearerToken, login, logout, resolveCurrentUser, type OAuthClientConfig } from './auth/session';
import { badRequest } from './errors';

export interface HandlerDeps {
  config: UpstreamConfig;
  fetchImpl?: typeof fetch;
  /** Page manifest for `/api/ai/manifest`; served verbatim. */
  manifest?: () => Promise<unknown>;
  /** OAuth client used for the password grant; defaults to the old console's. */
  oauthClient?: OAuthClientConfig;
}

/** Largest login body accepted, in bytes. A password grant is a few hundred. */
const MAX_LOGIN_BODY = 8 * 1024;

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    // Refuse rather than buffer without bound: this endpoint is unauthenticated.
    if (size > MAX_LOGIN_BODY) throw badRequest('request body too large');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Request handler.
 *
 * Two jobs only: serve the AI manifest, and forward everything addressed to the
 * cluster. There is deliberately no per-resource route table. The old console
 * forwards `/{k}api{s}/{*path}` in one rule (`console/server/routes.js:153`) and
 * the same choice applies here — the API surface is defined by ks-apiserver, and
 * mirroring it would create a second definition that drifts.
 */
export function createHandler(deps: HandlerDeps) {
  const oauthClient = deps.oauthClient ?? { clientId: 'kubesphere', clientSecret: 'kubesphere' };

  return async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

    try {
      if (url.pathname === '/api/ai/manifest') {
        // A failure here must not take the page down: an agent that sees "no
        // declared pages" can still browse, whereas a 500 gives it nothing.
        const manifest = await deps.manifest?.().catch(() => []);
        return send(response, 200, manifest ?? []);
      }

      if (url.pathname.startsWith('/api/session')) {
        return await handleSession(deps, oauthClient, request, response, url.pathname);
      }

      if (isProxiedPath(url.pathname)) {
        return await proxyRequest(deps.config, request, response);
      }

      return send(response, 404, { code: 'not_found', message: 'no such endpoint', status: 404 });
    } catch (cause) {
      /*
       * The response may already be under way — a streamed proxy body aborts
       * mid-transfer, or `writeHead` has run and `end` then throws. Writing a
       * second status line is `ERR_HTTP_HEADERS_SENT`, which used to take the
       * whole process down (an unhandled rejection in `handle`), killing every
       * other session with it. Once the head is sent there is nothing left to
       * report, so the request is simply abandoned.
       */
      if (response.headersSent) {
        if (!response.writableEnded) response.destroy();
        return;
      }
      const status = (cause as { status?: number }).status;
      if (typeof status === 'number') return send(response, status, cause as BffError);
      // A failed upstream connection surfaces as a socket error; report it as a
      // gateway problem rather than blaming this process.
      return send(response, 502, {
        code: 'upstream_unreachable',
        message: cause instanceof Error ? cause.message : 'upstream unreachable',
        status: 502,
      } satisfies BffError);
    }
  };
}

export function send(response: ServerResponse, status: number, body: unknown): void {
  // Defensive: every caller is expected to have checked, but a duplicate send is
  // a process-killing error and the cost of checking here is one comparison.
  if (response.headersSent) return;
  if (body === undefined) {
    response.writeHead(status).end();
    return;
  }
  const payload = JSON.stringify(body);
  response
    .writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
      'Cache-Control': 'no-store',
    })
    .end(payload);
}

/**
 * `/api/session/*` — the three calls that involve a credential.
 *
 * Only these three, not a general auth service: the token is otherwise just a
 * bearer header that the proxy forwards. Keeping the surface this small is what
 * lets the proxy stay a transparent forwarder.
 */
async function handleSession(
  deps: HandlerDeps,
  oauthClient: OAuthClientConfig,
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): Promise<void> {
  const fetchImpl = deps.fetchImpl ?? fetch;

  if (pathname === '/api/session/login') {
    if (request.method !== 'POST') return send(response, 405, { code: 'method_not_allowed', status: 405 });
    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(await readBody(request)) as unknown;
      body = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch (cause) {
      return send(response, 400, badRequest(cause instanceof Error ? cause.message : 'body must be JSON'));
    }

    const username = typeof body['username'] === 'string' ? body['username'].trim() : '';
    const password = typeof body['password'] === 'string' ? body['password'] : '';
    if (!username || !password) {
      return send(response, 400, badRequest('username and password are required'));
    }

    const result = await login(deps.config, oauthClient, { username, password }, fetchImpl);
    return result.ok ? send(response, 200, result.session) : send(response, result.error.status, result.error);
  }

  if (pathname === '/api/session/me') {
    const token = bearerToken(request.headers.authorization);
    // Asking ks-apiserver, not just decoding: a revoked token still parses.
    const user = await resolveCurrentUser(deps.config, token, fetchImpl);
    // 401 rather than 200-with-null: the client's interceptor already treats 401
    // as "log in again", so reusing it avoids a second branch that only the
    // login screen would know about.
    if (!user) return send(response, 401, { code: 'unauthorized', message: 'not signed in', status: 401 });
    return send(response, 200, { user });
  }

  if (pathname === '/api/session/logout') {
    if (request.method !== 'POST') return send(response, 405, { code: 'method_not_allowed', status: 405 });
    await logout(deps.config, bearerToken(request.headers.authorization), fetchImpl);
    // Always 204: the browser has already discarded the token, and reporting an
    // upstream failure here would leave the reader stuck on a page they left.
    response.writeHead(204, { 'Cache-Control': 'no-store' }).end();
    return;
  }

  return send(response, 404, { code: 'not_found', message: 'no such endpoint', status: 404 });
}

export async function startServer(port: number, deps: HandlerDeps): Promise<ReturnType<typeof createServer>> {
  const handler = createHandler(deps);
  const server = createServer((request, response) => {
    /*
     * Never let one request take the process down. `handle` already answers every
     * error path it knows about; this is the last resort for the ones it does not
     * (a bug in a handler, a stream error after the head went out), and it keeps
     * every other session alive.
     */
    void handler(request, response).catch(() => {
      if (!response.headersSent) {
        response.writeHead(502, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ code: 'upstream_unreachable', message: 'request failed', status: 502 }));
      } else if (!response.writableEnded) {
        response.destroy();
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(port, '0.0.0.0', resolve));
  return server;
}

export { loadConfig };

/**
 * The AI surface manifest.
 *
 * Served from a JSON file the app writes at build time rather than imported:
 * the BFF runs as its own process and must not depend on the app's module graph.
 * A missing file yields an empty list — an agent then sees "no declared pages"
 * instead of a 500 it would have to interpret.
 */
export async function loadManifest(): Promise<unknown> {
  const path = process.env['AI_MANIFEST_PATH'];
  if (!path) return [];
  try {
    const { readFile } = await import('node:fs/promises');
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
  } catch {
    return [];
  }
}
