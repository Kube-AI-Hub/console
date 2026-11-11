/**
 * A fake ks-apiserver for driving the console end to end without a live cluster.
 *
 * Why this exists: the BFF's login path talks to the real ks-apiserver
 * `/oauth/token`, so pointing the existing dev BFF at this fake would make login
 * fail. The browser-side resources this migration adds (secrets, service
 * accounts, the kubeconfig builder, the type-specific editors) need a *cluster to
 * read and write*, not a *password that works*, so the fake serves both the OAuth
 * endpoints and the resource endpoints, and every request is recorded.
 *
 * It is deliberately strict: unknown paths answer 404 with a kube `Status`, and
 * writes must use the documented verbs (`POST` `/api/v1/...`, `PUT`/`PATCH`
 * `/api/v1/.../<name>`, `DELETE`), so a client that writes through kapis — which
 * the real server answers 405 — fails here too.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

export interface FakeObject {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace: string;
    uid: string;
    resourceVersion: string;
    creationTimestamp: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  [key: string]: unknown;
}

export interface FakeKubeOptions {
  /** Initial objects keyed by `namespace/kind/name`. */
  seed?: { secrets?: Array<Record<string, unknown>>; serviceaccounts?: Array<Record<string, unknown>>; configmaps?: Array<Record<string, unknown>> };
  /** Projects the project picker offers. */
  projects?: string[];
}

export interface FakeKube {
  url: string;
  requests: Array<{ method: string; url: string }>;
  /** Objects currently stored, for assertions from the test. */
  store: Map<string, FakeObject>;
  close: () => Promise<void>;
}

const RESOURCES = new Set(['secrets', 'serviceaccounts', 'configmaps']);

function kubeStatus(status: number, reason: string, message: string): string {
  return JSON.stringify({ kind: 'Status', apiVersion: 'v1', status: 'Failure', reason, message, code: status });
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

function now(): string {
  return new Date().toISOString();
}

function toObject(namespace: string, kind: string, body: Record<string, unknown>, existing?: FakeObject): FakeObject {
  const metadata = (body['metadata'] ?? {}) as Record<string, unknown>;
  return {
    ...(existing ? { ...existing, ...body } : body),
    apiVersion: 'v1',
    kind,
    metadata: {
      ...(existing?.metadata ?? {}),
      ...metadata,
      name: String(metadata['name'] ?? existing?.metadata.name ?? ''),
      namespace,
      uid: existing?.metadata.uid ?? randomUUID(),
      resourceVersion: String(Number(existing?.metadata.resourceVersion ?? '0') + 1),
      creationTimestamp: existing?.metadata.creationTimestamp ?? now(),
    },
  } as FakeObject;
}

/**
 * Merge patch, shallow per top-level key and one level into `metadata`.
 *
 * Enough of RFC 7386 for what the console sends (annotation maps, single fields);
 * a full implementation would be a library and is not what these tests exercise.
 */
function mergePatch(target: FakeObject, patch: Record<string, unknown>): FakeObject {
  const next: Record<string, unknown> = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'metadata' && value && typeof value === 'object') {
      const meta = value as Record<string, unknown>;
      const merged: Record<string, unknown> = { ...(next['metadata'] as Record<string, unknown>) };
      for (const [metaKey, metaValue] of Object.entries(meta)) {
        if (metaValue && typeof metaValue === 'object' && !Array.isArray(metaValue)) {
          merged[metaKey] = { ...((merged[metaKey] as Record<string, unknown>) ?? {}), ...(metaValue as Record<string, unknown>) };
        } else {
          merged[metaKey] = metaValue;
        }
      }
      next['metadata'] = merged;
    } else {
      next[key] = value;
    }
  }
  return { ...(next as FakeObject), metadata: { ...(next['metadata'] as FakeObject['metadata']), resourceVersion: String(Number(target.metadata.resourceVersion) + 1) } };
}

export async function startFakeKube(options: FakeKubeOptions = {}): Promise<FakeKube> {
  const store = new Map<string, FakeObject>();
  const requests: Array<{ method: string; url: string }> = [];

  const put = (object: FakeObject): void => {
    store.set(`${object.metadata.namespace}/${object.kind}/${object.metadata.name}`, object);
  };

  for (const [kind, items] of Object.entries(options.seed ?? {})) {
    for (const item of items ?? []) {
      const namespace = String(((item['metadata'] ?? {}) as Record<string, unknown>)['namespace'] ?? 'default');
      put(toObject(namespace, kind === 'secrets' ? 'Secret' : kind === 'serviceaccounts' ? 'ServiceAccount' : 'ConfigMap', item));
    }
  }

  const projects = options.projects ?? ['default', 'dev'];

  const server: Server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://fake');
    requests.push({ method: request.method ?? 'GET', url: `${url.pathname}${url.search}` });
    const send = (status: number, body: unknown): void => {
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(typeof body === 'string' ? body : JSON.stringify(body));
    };

    const path = url.pathname;

    // ---- OAuth / session ----
    if (path === '/oauth/token' && request.method === 'POST') {
      const form = new URLSearchParams(await readBody(request));
      if (form.get('username') !== 'admin' || form.get('password') !== 'P@88w0rd') {
        return send(400, { error: 'invalid_grant', error_description: 'incorrect password' });
      }
      // Header-only, unsigned token: `isTokenExpired` reads `exp` from the payload.
      const encode = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64url');
      const nowSeconds = Math.floor(Date.now() / 1000);
      const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ iss: 'fake', sub: 'admin', exp: nowSeconds + 3600, iaf: nowSeconds, token_type: 'access_token', username: 'admin' })}.sig`;
      return send(200, { access_token: token, token_type: 'bearer', expires_in: 3600 });
    }
    if (path === '/oauth/logout' || path === '/kapis/iam.kubesphere.io/v1alpha2/users/admin') {
      return send(200, { kind: 'User', username: 'admin' });
    }

    // ---- project list ----
    if (path === '/kapis/tenant.kubesphere.io/v1alpha2/workspaces') {
      return send(200, { items: [{ metadata: { name: 'system-workspace' } }], totalItems: 1 });
    }
    if (/^\/kapis\/tenant\.kubesphere\.io\/v1alpha2\/workspaces\/[^/]+\/namespaces$/.test(path)) {
      const items = projects.map((name) => ({
        metadata: { name, annotations: { 'kubesphere.io/alias-name': name === 'default' ? '默认项目' : '' } },
      }));
      return send(200, { items, totalItems: items.length });
    }

    // ---- roles (KubeSphere iam) ----
    const rolesMatch = /^\/kapis\/iam\.kubesphere\.io\/v1alpha2\/(?:clusters\/[^/]+\/)?namespaces\/([^/]+)\/roles$/.exec(path);
    if (rolesMatch) {
      const roles = [
        { metadata: { name: 'project-viewer', namespace: rolesMatch[1] }, description: 'PROJECT_VIEWER_DESC' },
        { metadata: { name: 'project-editor', namespace: rolesMatch[1] }, description: 'PROJECT_EDITOR_DESC' },
      ];
      return send(200, { items: roles, totalItems: roles.length });
    }

    // ---- resources ----
    const collectionMatch = /^\/kapis\/resources\.kubesphere\.io\/v1alpha3\/(?:clusters\/[^/]+\/)?(?:namespaces\/([^/]+)\/)?(secrets|serviceaccounts|configmaps)$/.exec(path);
    if (collectionMatch) {
      if (request.method !== 'GET') {
        // kapis registers GET only; the real server answers 405 here.
        return send(405, kubeStatus(405, 'MethodNotAllowed', 'this endpoint does not allow the method'));
      }
      const namespace = collectionMatch[1] ?? '';
      const resource = collectionMatch[2] ?? '';
      const kind = resource === 'secrets' ? 'Secret' : resource === 'serviceaccounts' ? 'ServiceAccount' : 'ConfigMap';
      let items = [...store.values()].filter((item) => item.kind === kind && (!namespace || item.metadata.namespace === namespace));
      const keyword = url.searchParams.get('name');
      if (keyword) items = items.filter((item) => item.metadata.name.includes(keyword));
      const sortBy = url.searchParams.get('sortBy') ?? 'createTime';
      const ascending = url.searchParams.get('ascending') === 'true';
      items.sort((a, b) => {
        const key = sortBy === 'name' ? a.metadata.name.localeCompare(b.metadata.name) : a.metadata.creationTimestamp.localeCompare(b.metadata.creationTimestamp);
        return ascending ? key : -key;
      });
      const total = items.length;
      const page = Number(url.searchParams.get('page') ?? '1');
      const limit = Number(url.searchParams.get('limit') ?? '10');
      const start = limit > 0 ? (page - 1) * limit : 0;
      return send(200, { items: limit > 0 ? items.slice(start, start + limit) : items, totalItems: total });
    }

    const objectMatch = /^\/kapis\/resources\.kubesphere\.io\/v1alpha3\/(?:clusters\/[^/]+\/)?namespaces\/([^/]+)\/(secrets|serviceaccounts|configmaps)\/([^/]+)$/.exec(path);
    if (objectMatch && request.method === 'GET') {
      const [, namespace, resource, name] = objectMatch;
      const kind = resource === 'secrets' ? 'Secret' : resource === 'serviceaccounts' ? 'ServiceAccount' : 'ConfigMap';
      const object = store.get(`${namespace}/${kind}/${decodeURIComponent(name ?? '')}`);
      if (!object) return send(404, kubeStatus(404, 'NotFound', 'not found'));
      return send(200, object);
    }

    const writeCollection = /^\/api\/v1\/namespaces\/([^/]+)\/(secrets|serviceaccounts|configmaps)$/.exec(path);
    if (writeCollection && request.method === 'POST') {
      const [, namespace, resource] = writeCollection;
      const kind = resource === 'secrets' ? 'Secret' : resource === 'serviceaccounts' ? 'ServiceAccount' : 'ConfigMap';
      const body = JSON.parse(await readBody(request)) as Record<string, unknown>;
      const name = String(((body['metadata'] ?? {}) as Record<string, unknown>)['name'] ?? '');
      if (store.has(`${namespace}/${kind}/${name}`)) {
        return send(409, kubeStatus(409, 'AlreadyExists', `"${name}" already exists`));
      }
      const object = toObject(String(namespace), kind, body);
      put(object);
      return send(201, object);
    }

    const writeObject = /^\/api\/v1\/namespaces\/([^/]+)\/(secrets|serviceaccounts|configmaps)\/([^/]+)$/.exec(path);
    if (writeObject) {
      const [, namespace, resource, name] = writeObject;
      const kind = resource === 'secrets' ? 'Secret' : resource === 'serviceaccounts' ? 'ServiceAccount' : 'ConfigMap';
      const decoded = decodeURIComponent(name ?? '');
      const key = `${namespace}/${kind}/${decoded}`;
      const existing = store.get(key);
      if (request.method === 'GET') {
        if (!existing) return send(404, kubeStatus(404, 'NotFound', 'not found'));
        return send(200, existing);
      }
      if (request.method === 'DELETE') {
        if (!existing) return send(404, kubeStatus(404, 'NotFound', 'not found'));
        store.delete(key);
        return send(200, { kind: 'Status', status: 'Success' });
      }
      const body = JSON.parse(await readBody(request)) as Record<string, unknown>;
      if (request.method === 'PUT') {
        if (!existing) return send(404, kubeStatus(404, 'NotFound', 'not found'));
        const object = toObject(String(namespace), kind, body, existing);
        put(object);
        return send(200, object);
      }
      if (request.method === 'PATCH') {
        if (!existing) return send(404, kubeStatus(404, 'NotFound', 'not found'));
        if (request.headers['content-type'] !== 'application/merge-patch+json') {
          return send(415, kubeStatus(415, 'UnsupportedMediaType', 'patch needs a patch media type'));
        }
        const object = mergePatch(existing, body);
        put(object);
        return send(200, object);
      }
    }

    return send(404, kubeStatus(404, 'NotFound', `unknown path ${path}`));
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');

  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    store,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

export { RESOURCES };
