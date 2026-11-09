import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { loadConfig, type UpstreamConfig } from './config';
import { badRequest, type BffError } from './errors';
import {
  createConfigMapService,
  isBffError,
  parseListQuery,
  type ConfigMapDetail,
  type ConfigMapSummary,
} from './configmaps';

export interface HandlerDeps {
  config: UpstreamConfig;
  fetchImpl?: typeof fetch;
  /** Page manifest for `/api/ai/manifest`; served verbatim. */
  manifest?: () => Promise<unknown>;
}

export interface ListResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

type Service = ReturnType<typeof createConfigMapService>;

/**
 * Route table.
 *
 * Kept as data so the set of endpoints is readable in one place — the app's
 * client and the BFF's routes have to agree, and a table is easy to diff
 * against `packages/api-client`.
 */
export function createHandler(deps: HandlerDeps) {
  const service: Service = createConfigMapService({
    config: deps.config,
    fetchImpl: deps.fetchImpl ?? fetch,
  });

  return async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    const token = bearerToken(request);

    try {
      const route = matchRoute(url.pathname);
      if (!route) return send(response, 404, { code: 'not_found', message: 'no such endpoint', status: 404 });

      switch (route.kind) {
        case 'manifest': {
          const manifest = await deps.manifest?.();
          return send(response, 200, manifest ?? []);
        }
        case 'configmaps': {
          switch (request.method) {
            case 'GET': {
              const query = parseListQuery(url.searchParams);
              if (isBffError(query)) return send(response, query.status, query);
              const result: ListResult<ConfigMapSummary> = await service.list(query, token);
              return send(response, 200, result);
            }
            case 'DELETE': {
              const names = url.searchParams.getAll('name');
              if (!names.length) return send(response, 400, badRequest('name is required'));
              for (const name of names) {
                await service.remove(
                  {
                    cluster: requireParam(url, 'cluster'),
                    namespace: requireParam(url, 'namespace'),
                    name,
                  },
                  token,
                );
              }
              return send(response, 204, undefined);
            }
            default:
              return send(response, 405, { code: 'method_not_allowed', message: 'method not allowed', status: 405 });
          }
        }
        case 'configmap': {
          const params = {
            cluster: requireParam(url, 'cluster'),
            namespace: requireParam(url, 'namespace'),
            name: route.name,
          };
          if (request.method === 'GET') {
            const detail: ConfigMapDetail = await service.get(params, token);
            return send(response, 200, detail);
          }
          return send(response, 405, { code: 'method_not_allowed', message: 'method not allowed', status: 405 });
        }
      }
    } catch (cause) {
      if (isBffError(cause)) return send(response, cause.status, cause);
      return send(response, 500, {
        code: 'internal_error',
        message: cause instanceof Error ? cause.message : 'internal error',
        status: 500,
      } satisfies BffError);
    }
  };
}

type Route = { kind: 'manifest' } | { kind: 'configmaps' } | { kind: 'configmap'; name: string };

/**
 * `/api/configmaps` and `/api/configmaps/:name`.
 *
 * The name is the last path segment; anything deeper is not a supported
 * endpoint. A prefix match would make `/api/configmaps/x/y` silently act on
 * `x`, which is worse than a 404.
 */
export function matchRoute(pathname: string): Route | null {
  if (pathname === '/api/ai/manifest') return { kind: 'manifest' };
  if (pathname === '/api/configmaps' || pathname === '/api/configmaps/') return { kind: 'configmaps' };
  const match = /^\/api\/configmaps\/([^/]+)\/?$/.exec(pathname);
  if (match?.[1]) return { kind: 'configmap', name: decodeURIComponent(match[1]) };
  return null;
}

export function bearerToken(request: IncomingMessage): string | undefined {
  const header = request.headers.authorization;
  if (typeof header !== 'string') return undefined;
  const [scheme, value] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && value ? value : undefined;
}

function requireParam(url: URL, key: string): string {
  const value = url.searchParams.get(key);
  if (!value) throw badRequest(`${key} is required`);
  return value;
}

export function send(response: ServerResponse, status: number, body: unknown): void {
  if (body === undefined) {
    response.writeHead(status).end();
    return;
  }
  const payload = JSON.stringify(body);
  response
    .writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
      // The API is user-scoped; a shared cache would serve one user's list to another.
      'Cache-Control': 'no-store',
    })
    .end(payload);
}

export async function startServer(port: number, deps: HandlerDeps): Promise<ReturnType<typeof createServer>> {
  const handler = createHandler(deps);
  const server = createServer((request, response) => {
    void handler(request, response);
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
