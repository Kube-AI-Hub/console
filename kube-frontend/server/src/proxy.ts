import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { UpstreamConfig } from './config';

/**
 * Paths that are forwarded verbatim to ks-apiserver.
 *
 * The old console has one rule for the same job (`console/server/routes.js:153`:
 * `.all('/{k}api{s}{/*path}', ...)`), and the reason is the same here: every
 * resource, every HTTP method, and every query parameter already has an
 * authoritative definition upstream. Re-declaring them in the BFF means a second
 * place to keep in sync — and the second place is always the one that is wrong.
 *
 * ks-apiserver registers GET on `kapis/resources.kubesphere.io/...` and hands
 * POST/PUT/PATCH/DELETE of those same paths to its generic proxy
 * (`kube-server/pkg/kapis/generic/generic.go:84-101`), so writes work without any
 * extra route here.
 */
const PROXIED_PREFIXES = ['/kapis/', '/api/v1/', '/apis/'] as const;

/** Which upstream a path should go to. */
type Target = 'kapis' | 'kube';

export function isProxiedPath(pathname: string): boolean {
  return PROXIED_PREFIXES.some((prefix) => pathname.startsWith(prefix) || pathname === prefix.slice(0, -1));
}

/**
 * Pick the upstream for a path.
 *
 * In `kube` mode — the development harness that talks to `kubectl proxy` — the
 * kapis prefix is rewritten to the plain kube API, because `kubectl proxy` does
 * not serve kapis. In the product path the prefix is already correct.
 */
function resolveTarget(pathname: string): Target {
  if (pathname.startsWith('/api/v1/') || pathname.startsWith('/apis/')) return 'kube';
  return 'kapis';
}

/** Headers that must not reach the cluster. */
const DROPPED_HEADERS = new Set(['cookie', 'referer', 'host', 'connection', 'content-length', 'accept-encoding']);

/**
 * Forward a request to the upstream and stream the response back.
 *
 * The body is piped rather than buffered: a large ConfigMap or a chunked upload
 * should not be held in this process's memory, and the old console forwards the
 * stream for the same reason.
 */
export async function proxyRequest(
  config: UpstreamConfig,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  const target = resolveTarget(url.pathname);
  const upstreamPath = target === 'kapis' ? rewriteForMode(config, url) : url.pathname;
  const upstream = new URL(config.baseUrl);
  const isHttps = upstream.protocol === 'https:';
  const sendRequest = isHttps ? httpsRequest : httpRequest;

  /*
   * The harness cannot serve a cluster-wide collection: `kubectl proxy` returns
   * every object at once (thousands of ConfigMaps across every namespace), so the
   * request either times out or the emulation below has to buffer the lot. Say so
   * instead of hanging — a real kapis server answers this path fine.
   */
  if (config.mode === 'kube' && target === 'kapis' && !hasNamespaceSegment(url.pathname, config.apiPrefix)) {
    const body = JSON.stringify({
      kind: 'Status',
      apiVersion: 'v1',
      status: 'Failure',
      message:
        'cluster-wide list is not available through the kubectl-proxy harness; select a single project, or point the BFF at ks-apiserver (KS_API_MODE=kapis)',
      reason: 'BadRequest',
      code: 400,
    });
    response.writeHead(400, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(body);
    return;
  }

  /*
   * In the harness the plain kube API rejects kapis's list parameters with a 400,
   * and they are emulated locally anyway. Strip them from the forwarded URL so the
   * upstream sees a call it accepts.
   */
  const forwardedParams = new URLSearchParams(url.search);
  const emulating = config.mode === 'kube' && target === 'kapis';
  if (emulating) {
    for (const key of KAPIS_ONLY_PARAMS) forwardedParams.delete(key);
  }

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(request.headers)) {
    if (value === undefined || DROPPED_HEADERS.has(key.toLowerCase())) continue;
    headers[key] = Array.isArray(value) ? value.join(', ') : value;
  }

  return new Promise<void>((resolve, reject) => {
    const upstreamRequest = sendRequest(
      {
        protocol: upstream.protocol,
        hostname: upstream.hostname,
        port: upstream.port || (isHttps ? 443 : 80),
        method: request.method,
        path: `${upstreamPath}${forwardedParams.toString() ? `?${forwardedParams}` : ''}`,
        headers: {
          ...headers,
          // Ask for the identity encoding: the response is streamed straight
          // through, so a compressed body would need re-encoding to carry a
          // correct Content-Length.
          'accept-encoding': 'identity',
        },
        // Self-signed cluster certificates are normal in air-gapped installs;
        // the flag is opt-in so a real certificate is still verified by default.
        ...(config.insecure === true ? { rejectUnauthorized: false } : {}),
      },
      (upstreamResponse) => {
        const status = upstreamResponse.statusCode ?? 502;
        const responseHeaders: Record<string, string | string[]> = {};
        for (const [key, value] of Object.entries(upstreamResponse.headers)) {
          // `content-encoding` / `transfer-encoding` describe the upstream hop, not
          // the body this process forwards; re-announcing them corrupts the stream.
          if (value === undefined || ['content-encoding', 'transfer-encoding', 'connection'].includes(key)) continue;
          responseHeaders[key] = value;
        }
        // The API is user-scoped; a shared cache would serve one user's list to another.
        responseHeaders['cache-control'] = 'no-store';

        if (!emulating) {
          response.writeHead(status, responseHeaders);
          upstreamResponse.pipe(response);
          upstreamResponse.on('end', () => resolve());
          upstreamResponse.on('error', reject);
          return;
        }

        // The harness has to rewrite the body, so it buffers this one response.
        // Only list calls take this path, and only in development.
        const chunks: Buffer[] = [];
        upstreamResponse.on('data', (chunk: Buffer) => chunks.push(chunk));
        upstreamResponse.on('error', reject);
        upstreamResponse.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let payload = text;
          try {
            const rewritten = emulateKapisList(JSON.parse(text) as unknown, url.searchParams);
            payload = JSON.stringify(rewritten);
          } catch {
            // Not JSON (an error page, say): forward it unchanged.
          }
          const body = Buffer.from(payload, 'utf8');
          delete responseHeaders['content-length'];
          response.writeHead(status, { ...responseHeaders, 'content-length': String(body.length) });
          response.end(body);
          resolve();
        });
      },
    );

    upstreamRequest.on('error', reject);
    request.pipe(upstreamRequest);
    request.on('error', reject);
  });
}

/**
 * Rewrite a kapis path for the development harness.
 *
 * `kubectl proxy` speaks the plain kube API. The mapping is the same shape the
 * kapis resources endpoint itself uses: drop the `/kapis/<group>/<version>`
 * segment and keep the `clusters/<id>` / `namespaces/<ns>` tail.
 */
function rewriteForMode(config: UpstreamConfig, url: URL): string {
  if (config.mode !== 'kube') return url.pathname;
  const suffix = url.pathname.slice(config.apiPrefix.length);
  return `/api/v1${suffix}`;
}

/**
 * Whether a kapis path addresses a namespace.
 *
 * The harness keeps the `clusters/<id>` prefix for compatibility with this app's
 * paths, so the check looks for `namespaces/` anywhere after the API prefix.
 */
function hasNamespaceSegment(pathname: string, apiPrefix: string): boolean {
  const suffix = pathname.slice(apiPrefix.length);
  return /(^|\/)namespaces\//.test(suffix);
}

/** Query parameters kapis understands but the plain kube API does not. */
const KAPIS_ONLY_PARAMS = ['page', 'limit', 'sortBy', 'ascending', 'name'] as const;

/**
 * Emulate kapis list semantics on a plain kube API response.
 *
 * `kubectl proxy` returns every object in one body and ignores `page`/`limit`, so
 * against the harness a paged list looked broken: page 2 returned page 1, and the
 * pager had no total to work with. That is a limitation of the harness only — a
 * real kapis server does the slicing itself — but a local check that cannot
 * exercise paging is not worth much, and it is where the bug in this session was
 * first misread.
 *
 * Applied only in `kube` mode, and only to list responses (`kind` ending in
 * `List` with an `items` array); a single object or a `Status` passes through
 * untouched.
 */
export function emulateKapisList(body: unknown, search: URLSearchParams): unknown {
  if (!body || typeof body !== 'object') return body;
  const record = body as { kind?: unknown; items?: unknown };
  if (typeof record.kind !== 'string' || !record.kind.endsWith('List') || !Array.isArray(record.items)) return body;

  const items = record.items as Array<Record<string, unknown>>;
  const page = Number.parseInt(search.get('page') ?? '1', 10) || 1;
  const limit = Number.parseInt(search.get('limit') ?? '10', 10) || 10;
  const sortBy = search.get('sortBy');
  const ascending = search.get('ascending') !== 'false';
  const nameFilter = search.get('name');

  let filtered = items;
  if (nameFilter) {
    // kapis's `name` is a substring match on the resource name.
    filtered = filtered.filter((item) => {
      const metadata = (item['metadata'] ?? {}) as { name?: string };
      return (metadata.name ?? '').includes(nameFilter);
    });
  }

  if (sortBy) {
    const read = (item: Record<string, unknown>): string => {
      const metadata = (item['metadata'] ?? {}) as Record<string, unknown>;
      if (sortBy === 'createTime') return String(metadata['creationTimestamp'] ?? '');
      if (sortBy === 'name') return String(metadata['name'] ?? '');
      return '';
    };
    filtered = [...filtered].sort((a, b) => {
      const result = read(a).localeCompare(read(b));
      return ascending ? result : -result;
    });
  }

  const start = (page - 1) * limit;
  return {
    ...record,
    items: filtered.slice(start, start + limit),
    totalItems: filtered.length,
  };
}

export { KAPIS_ONLY_PARAMS };
