import { ApiError } from './errors';
import type { Client } from './client';

/**
 * One Kubernetes resource collection, addressed the way the old console does.
 *
 * ConfigMaps grew their own copy of this (writes to `/api/v1`, reads to kapis,
 * a read-then-PUT to carry `resourceVersion`). Secrets and ServiceAccounts need
 * exactly the same mechanics and nothing else, so the mechanics live here once
 * and each resource supplies only its path and its mapping. ConfigMaps keeps its
 * own module unchanged: it is released and covered by tests, and rewriting it
 * for symmetry would trade a real regression risk for tidiness.
 */

/** The bits every namespaced collection in this app has. */
export interface ResourceRef {
  cluster: string;
  namespace: string;
  name: string;
}

export interface ResourceListParams {
  cluster: string;
  /** Empty string lists across every project in the cluster. */
  namespace: string;
  page: number;
  pageSize: number;
  /** Matches the API's own sort names, e.g. `name` / `createTime`. */
  sortBy?: string;
  order?: 'asc' | 'desc';
  keyword?: string;
  signal?: AbortSignal;
}

export interface ResourceListResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** The object kube-apiserver stores; only the fields this app reads. */
export interface KubeObject {
  apiVersion?: string;
  kind?: string;
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
    resourceVersion?: string;
    uid?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  [key: string]: unknown;
}

/**
 * Collection URL for reading.
 *
 * An empty `namespace` means the cluster-wide collection, which kapis serves as
 * `.../<resource>` without the `namespaces/<ns>` segment. That is how "all
 * projects" is expressed — there is no query parameter for it.
 */
function collectionPath(cluster: string, namespace: string, resource: string): string {
  return `${resourcePath('kapis', cluster, namespace, resource)}`;
}

/**
 * Collection URL for writing.
 *
 * Writes go to the plain kube API, not kapis: the kapis resources endpoint
 * registers GET only and answers 405 to POST/PUT/PATCH/DELETE. ks-apiserver
 * forwards `/api/v1` to kube-apiserver through its generic proxy.
 */
function writePath(cluster: string, namespace: string, resource: string): string {
  return resourcePath('kube', cluster, namespace, resource);
}

function resourcePath(kind: 'kapis' | 'kube', cluster: string, namespace: string, resource: string): string {
  const clusterSegment = cluster && cluster !== 'host' ? `clusters/${encodeURIComponent(cluster)}/` : '';
  const namespaceSegment = namespace ? `namespaces/${encodeURIComponent(namespace)}/` : '';
  const prefix = kind === 'kapis' ? '/kapis/resources.kubesphere.io/v1alpha3' : '/api/v1';
  return `${prefix}/${clusterSegment}${namespaceSegment}${resource}`;
}

export interface ResourceApiOptions<TItem, TSummary, TDetail> {
  /** kapis resource segment, e.g. `secrets`. */
  resource: string;
  toSummary(item: TItem): TSummary;
  toDetail(item: TItem): TDetail;
}

export function resourceApi<TItem extends KubeObject, TSummary, TDetail>(client: Client, options: ResourceApiOptions<TItem, TSummary, TDetail>) {
  const { resource } = options;

  return {
    /**
     * One page, sliced upstream.
     *
     * `page` and `limit` go to the server and the total comes from
     * `totalItems`; `total_count` is read as a fallback because some server
     * versions spell it that way.
     */
    async list(params: ResourceListParams): Promise<ResourceListResult<TSummary>> {
      const body = await client.request<{
        items?: TItem[];
        totalItems?: number;
        total_count?: number;
      }>(collectionPath(params.cluster, params.namespace, resource), {
        query: {
          page: params.page,
          limit: params.pageSize,
          ...(params.sortBy ? { sortBy: params.sortBy } : {}),
          ...(params.order ? { ascending: params.order === 'asc' } : {}),
          ...(params.keyword?.trim() ? { name: params.keyword.trim() } : {}),
        },
        ...(params.signal ? { signal: params.signal } : {}),
      });

      const items = (body.items ?? []).map(options.toSummary);
      return {
        items,
        total: body.totalItems ?? body.total_count ?? items.length,
        page: params.page,
        pageSize: params.pageSize,
      };
    },

    async get(params: ResourceRef & { signal?: AbortSignal }): Promise<TDetail> {
      const item = await client.request<TItem>(
        `${collectionPath(params.cluster, params.namespace, resource)}/${encodeURIComponent(params.name)}`,
        { ...(params.signal ? { signal: params.signal } : {}) },
      );
      return options.toDetail(item);
    },

    async create(body: KubeObject, params: { cluster: string; namespace: string }): Promise<TDetail> {
      const item = await client.request<TItem>(writePath(params.cluster, params.namespace, resource), {
        method: 'POST',
        body,
      });
      return options.toDetail(item);
    },

    /**
     * Replace an object.
     *
     * Reads first to pick up the current `resourceVersion`: a PUT carrying a
     * stale one is rejected with 409. The body's own metadata wins for every
     * other field, so the YAML editor can still change annotations.
     */
    async update(params: { cluster: string; namespace: string; body: KubeObject }): Promise<TDetail> {
      const name = params.body.metadata?.name ?? '';
      const current = await client.request<TItem>(
        `${collectionPath(params.cluster, params.namespace, resource)}/${encodeURIComponent(name)}`,
      );
      const resourceVersion = current.metadata?.resourceVersion;
      const body: KubeObject = {
        ...params.body,
        metadata: {
          ...params.body.metadata,
          ...(resourceVersion ? { resourceVersion } : {}),
        },
      };
      const item = await client.request<TItem>(
        `${writePath(params.cluster, params.namespace, resource)}/${encodeURIComponent(name)}`,
        { method: 'PUT', body },
      );
      return options.toDetail(item);
    },

    /**
     * Partial update (merge patch).
     *
     * Without the patch media type kube-apiserver answers 415, which in the old
     * console surfaced as a dialog that stayed open after a successful-looking
     * click.
     */
    async patch(params: ResourceRef & { body: unknown }): Promise<TDetail> {
      const item = await client.request<TItem>(
        `${writePath(params.cluster, params.namespace, resource)}/${encodeURIComponent(params.name)}`,
        {
          method: 'PATCH',
          contentType: 'application/merge-patch+json',
          body: params.body,
        },
      );
      return options.toDetail(item);
    },

    /**
     * Whether the name is already taken.
     *
     * Read through `/api/v1` rather than kapis: kapis answers a missing object in
     * its own envelope, while the plain kube API returns a `Status` with
     * `reason: NotFound`, which is what `isNotFound` keys on.
     */
    async checkName(params: ResourceRef): Promise<boolean> {
      try {
        await client.request<KubeObject>(
          `${writePath(params.cluster, params.namespace, resource)}/${encodeURIComponent(params.name)}`,
        );
        return true;
      } catch (cause) {
        // Absence is the normal answer for a free name, not a failure.
        if (cause instanceof ApiError && cause.isNotFound) return false;
        throw cause;
      }
    },

    async remove(params: { cluster: string; namespace: string; names: string[] }): Promise<void> {
      // Sequential rather than parallel: batch delete has no transaction
      // upstream, and a partial failure is easier to report deterministically.
      for (const name of params.names) {
        await client.request<void>(
          `${writePath(params.cluster, params.namespace, resource)}/${encodeURIComponent(name)}`,
          { method: 'DELETE' },
        );
      }
    },
  };
}

/**
 * The shape of one collection's API.
 *
 * Derived from the factory's return value (rather than written out again) so the
 * two cannot drift; the parameters are instantiated with their constraints.
 */
export type ResourceApi = ReturnType<typeof resourceApi<KubeObject, unknown, unknown>>;

/** Annotation keys the console reads and writes on every resource. */
export const annotationKeys = {
  description: 'kubesphere.io/description',
  alias: 'kubesphere.io/alias-name',
  creator: 'kubesphere.io/creator',
} as const;

/** Fields every summary carries. */
export interface ResourceBase {
  name: string;
  namespace: string;
  /** `kubesphere.io/description`. */
  description: string;
  /** `kubesphere.io/alias-name`; empty when the user never set one. */
  alias: string;
  createdAt: string;
  /** `kubesphere.io/creator`. */
  creator: string;
  /** KubeSphere marks multi-cluster propagated objects with this annotation. */
  federated: boolean;
}

export function baseOf(item: KubeObject): ResourceBase {
  const annotations = item.metadata?.annotations ?? {};
  return {
    name: item.metadata?.name ?? '',
    namespace: item.metadata?.namespace ?? '',
    description: annotations[annotationKeys.description] ?? '',
    alias: annotations[annotationKeys.alias] ?? '',
    createdAt: item.metadata?.creationTimestamp ?? '',
    creator: annotations[annotationKeys.creator] ?? '',
    federated: annotations['kubefed.io/managed'] === 'true',
  };
}

/** Alias and description written the way the old console's forms did. */
export function metadataAnnotations(input: { alias?: string; description?: string }): Record<string, string> {
  const annotations: Record<string, string> = {};
  if (input.alias?.trim()) annotations[annotationKeys.alias] = input.alias.trim();
  if (input.description?.trim()) annotations[annotationKeys.description] = input.description.trim();
  return annotations;
}
