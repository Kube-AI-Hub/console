import { resourcePath, type UpstreamConfig } from './config';
import { badRequest, normaliseUpstreamError, upstreamUnreachable, type BffError } from './errors';

/**
 * ks-apiserver's ConfigMap payload.
 *
 * Only the fields this UI reads are declared; the rest of a kube object is
 * large and version-dependent, and typing it fully would mean tracking upstream
 * schema changes for no benefit.
 */
interface UpstreamConfigMap {
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
    annotations?: Record<string, string>;
  };
  data?: Record<string, string>;
}

interface UpstreamList {
  items?: UpstreamConfigMap[];
  totalItems?: number;
}

export interface ConfigMapSummary {
  name: string;
  namespace: string;
  description: string;
  keys: string[];
  createdAt: string;
  federated: boolean;
}

export interface ConfigMapDetail extends ConfigMapSummary {
  data: Record<string, string>;
}

export interface ListQuery {
  cluster: string;
  namespace: string;
  page: number;
  pageSize: number;
  sortBy: 'name' | 'createdAt';
  order: 'asc' | 'desc';
  keyword: string;
}

/**
 * Parse the list query.
 *
 * Sorting and pagination are forwarded to upstream rather than redone here:
 * ks-apiserver already supports `sortBy`/`limit`/`page`, and re-sorting a
 * single page in the BFF would produce the wrong order across pages.
 */
export function parseListQuery(searchParams: URLSearchParams): ListQuery | BffError {
  const cluster = searchParams.get('cluster');
  const namespace = searchParams.get('namespace');
  if (!cluster || !namespace) return badRequest('cluster and namespace are required');

  const page = Number(searchParams.get('page') ?? '1');
  const pageSize = Number(searchParams.get('pageSize') ?? '10');
  if (!Number.isInteger(page) || page < 1) return badRequest('page must be a positive integer');
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return badRequest('pageSize must be between 1 and 100');
  }

  const sortByRaw = searchParams.get('sortBy') ?? 'createdAt';
  if (sortByRaw !== 'name' && sortByRaw !== 'createdAt') return badRequest('unsupported sortBy');

  const orderRaw = searchParams.get('order') ?? 'desc';
  if (orderRaw !== 'asc' && orderRaw !== 'desc') return badRequest('unsupported order');

  return {
    cluster,
    namespace,
    page,
    pageSize,
    sortBy: sortByRaw,
    order: orderRaw,
    keyword: (searchParams.get('keyword') ?? '').trim(),
  };
}

/** kube objects carry the description in an annotation, not a field. */
const DESCRIPTION_ANNOTATION = 'kubesphere.io/description';

export function toSummary(item: UpstreamConfigMap): ConfigMapSummary {
  return {
    name: item.metadata?.name ?? '',
    namespace: item.metadata?.namespace ?? '',
    description: item.metadata?.annotations?.[DESCRIPTION_ANNOTATION] ?? '',
    keys: Object.keys(item.data ?? {}).sort(),
    createdAt: item.metadata?.creationTimestamp ?? '',
    // KubeSphere marks multi-cluster propagated objects with this annotation.
    federated: item.metadata?.annotations?.['kubesphere.io/creator'] !== undefined &&
      item.metadata?.annotations?.['kubefed.io/managed'] === 'true',
  };
}

export function toDetail(item: UpstreamConfigMap): ConfigMapDetail {
  return { ...toSummary(item), data: item.data ?? {} };
}

/** Headers for an upstream call. The user's token is forwarded, never stored. */
export function authHeaders(token: string | undefined, accept = 'application/json'): Record<string, string> {
  const headers: Record<string, string> = { Accept: accept };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export interface ConfigMapClientDeps {
  config: UpstreamConfig;
  fetchImpl: typeof fetch;
}

export function createConfigMapService({ config, fetchImpl }: ConfigMapClientDeps) {
  async function list(query: ListQuery, token: string | undefined) {
    const params = new URLSearchParams({
      sortBy: query.sortBy,
      ascending: String(query.order === 'asc'),
      page: String(query.page),
      limit: String(query.pageSize),
    });
    if (query.keyword) params.set('fieldSelector', `metadata.name=~${query.keyword}`);

    const url = `${config.baseUrl}${resourcePath(config, query.cluster, query.namespace, 'configmaps')}?${params}`;
    let response: Response;
    try {
      response = await fetchImpl(url, { headers: authHeaders(token) });
    } catch (cause) {
      throw upstreamUnreachable(cause);
    }
    if (!response.ok) throw await normaliseUpstreamError(response);

    const body = (await response.json()) as UpstreamList;
    const items = (body.items ?? []).map(toSummary);
    return {
      items,
      total: body.totalItems ?? items.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async function get(query: { cluster: string; namespace: string; name: string }, token: string | undefined) {
    const url = `${config.baseUrl}${resourcePath(config, query.cluster, query.namespace, `configmaps/${encodeURIComponent(query.name)}`)}`;
    let response: Response;
    try {
      response = await fetchImpl(url, { headers: authHeaders(token) });
    } catch (cause) {
      throw upstreamUnreachable(cause);
    }
    if (!response.ok) throw await normaliseUpstreamError(response);
    return toDetail((await response.json()) as UpstreamConfigMap);
  }

  async function remove(query: { cluster: string; namespace: string; name: string }, token: string | undefined) {
    const url = `${config.baseUrl}${resourcePath(config, query.cluster, query.namespace, `configmaps/${encodeURIComponent(query.name)}`)}`;
    let response: Response;
    try {
      // Kube deletes are async; `deleteOptions` without a propagation policy keeps
      // the default, which is what the old console used.
      response = await fetchImpl(url, { method: 'DELETE', headers: authHeaders(token) });
    } catch (cause) {
      throw upstreamUnreachable(cause);
    }
    if (!response.ok) throw await normaliseUpstreamError(response);
    return undefined;
  }

  return { list, get, remove };
}

export function isBffError(value: unknown): value is BffError {
  return typeof value === 'object' && value !== null && 'code' in value && 'status' in value;
}
