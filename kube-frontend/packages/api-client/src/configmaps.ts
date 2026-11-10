import { ApiError } from './errors';
import type { Client } from './client';

/**
 * ConfigMap resources.
 *
 * Paths and methods mirror the old console one to one
 * (`console/src/stores/base.js:66-92,252-302`), because the old pages are the
 * specification for the new ones: `list` / `get` / `create` / `update` / `patch`
 * / `remove` / `checkName`. The BFF forwards `/kapis/*` and `/api/v1/*` verbatim,
 * so these are the cluster's own endpoints rather than an invention of this app.
 */

/** Annotation keys the console reads and writes. */
const DESCRIPTION_ANNOTATION = 'kubesphere.io/description';
const ALIAS_ANNOTATION = 'kubesphere.io/alias-name';
const CREATOR_ANNOTATION = 'kubesphere.io/creator';

/** A ConfigMap as the list and detail views need it. */
export interface ConfigMapSummary {
  name: string;
  namespace: string;
  /** `kubesphere.io/description`. */
  description: string;
  /** `kubesphere.io/alias-name`; empty when the user never set one. */
  alias: string;
  /** Key names only; the list payload has no need for values. */
  keys: string[];
  createdAt: string;
  /** `kubesphere.io/creator`. */
  creator: string;
  federated: boolean;
}

export interface ConfigMapDetail extends ConfigMapSummary {
  data: Record<string, string>;
  binaryData: Record<string, string>;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  /** Raw object, for YAML editing and for `patch` round trips. */
  raw: KubeConfigMap;
}

/** The object kube-apiserver stores. Only the fields this app touches. */
export interface KubeConfigMap {
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
  data?: Record<string, string>;
  binaryData?: Record<string, string>;
}

export interface ListParams {
  cluster: string;
  /** Empty string lists across every project in the cluster. */
  namespace: string;
  page: number;
  pageSize: number;
  /** Matches the column key; `createTime` is the API's spelling. */
  sortBy?: 'name' | 'createTime';
  order?: 'asc' | 'desc';
  keyword?: string;
  signal?: AbortSignal;
}

export interface ListResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ResourceRef {
  cluster: string;
  namespace: string;
  name: string;
}

/**
 * kapis prefix. Host cluster has no prefix; a member cluster is addressed as
 * `clusters/<id>`, which is ks-apiserver's own convention
 * (`kube-server/pkg/kapis/resources/v1alpha3/register.go`).
 */
/**
 * Collection URL for reading.
 *
 * An empty `namespace` means the cluster-wide collection, which kapis serves as
 * `.../configmaps` without the `namespaces/<ns>` segment. That view is how "all
 * projects" is expressed — there is no query parameter for it — and it is much
 * slower than a per-project query because the server walks every namespace.
 */
function collectionPath(cluster: string, namespace: string): string {
  return `${resourcePath('kapis', cluster, namespace)}`;
}

/**
 * Collection URL for writing.
 *
 * Writes go to the plain kube API, not to kapis: the kapis resources endpoint
 * registers GET only, and a POST there answers 405. ks-apiserver forwards
 * `/api/v1` to kube-apiserver through its generic proxy
 * (`kube-server/pkg/kapis/generic/generic.go:84-101`), so this is the same server
 * by a different door.
 *
 * Verified against the live cluster: `POST /kapis/.../configmaps` → 405,
 * `POST /api/v1/.../configmaps` → 201.
 */
function writePath(cluster: string, namespace: string): string {
  return resourcePath('kube', cluster, namespace);
}

/** Shared shape of the two collections above. */
function resourcePath(kind: 'kapis' | 'kube', cluster: string, namespace: string): string {
  const clusterSegment = cluster && cluster !== 'host' ? `clusters/${encodeURIComponent(cluster)}/` : '';
  const namespaceSegment = namespace ? `namespaces/${encodeURIComponent(namespace)}/` : '';
  const prefix = kind === 'kapis' ? '/kapis/resources.kubesphere.io/v1alpha3' : '/api/v1';
  return `${prefix}/${clusterSegment}${namespaceSegment}configmaps`;
}

/* ---------------- Mapping (pure, so it can be tested without a network) ---------------- */

export function toSummary(item: KubeConfigMap): ConfigMapSummary {
  const annotations = item.metadata?.annotations ?? {};
  return {
    name: item.metadata?.name ?? '',
    namespace: item.metadata?.namespace ?? '',
    description: annotations[DESCRIPTION_ANNOTATION] ?? '',
    alias: annotations[ALIAS_ANNOTATION] ?? '',
    keys: Object.keys(item.data ?? {}).sort(),
    createdAt: item.metadata?.creationTimestamp ?? '',
    creator: annotations[CREATOR_ANNOTATION] ?? '',
    // KubeSphere marks multi-cluster propagated objects with this annotation.
    federated: annotations['kubefed.io/managed'] === 'true',
  };
}

export function toDetail(item: KubeConfigMap): ConfigMapDetail {
  return {
    ...toSummary(item),
    data: item.data ?? {},
    binaryData: item.binaryData ?? {},
    labels: item.metadata?.labels ?? {},
    annotations: item.metadata?.annotations ?? {},
    raw: item,
  };
}

/**
 * Values the create and edit dialogs submit.
 *
 * Kept separate from `KubeConfigMap` so a form can never accidentally send a
 * field the user cannot edit (uid, resourceVersion from a stale read, status).
 */
export interface ConfigMapInput {
  name: string;
  namespace: string;
  alias?: string;
  description?: string;
  data: Record<string, string>;
}

/** Build the object to POST. Matches `console/src/utils/form.templates.js:261-268`. */
export function toKubeObject(input: ConfigMapInput): KubeConfigMap {
  const annotations: Record<string, string> = {};
  if (input.alias?.trim()) annotations[ALIAS_ANNOTATION] = input.alias.trim();
  if (input.description?.trim()) annotations[DESCRIPTION_ANNOTATION] = input.description.trim();

  return {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: {
      name: input.name,
      namespace: input.namespace,
      ...(Object.keys(annotations).length ? { annotations } : {}),
    },
    data: input.data,
  };
}

/* ---------------- API ---------------- */

export function configMapsApi(client: Client) {
  return {
    /**
     * One page of ConfigMaps.
     *
     * Mirrors the old console's call exactly
     * (`console/src/stores/base.js:123-167`): `page` and `limit` go to the
     * server, and the total comes from `totalItems`. kapis does the slicing, so a
     * page can be reached directly — the reader can jump to any page.
     *
     * `total_count` is read as a fallback because some server versions spell it
     * that way; the old store checks both.
     */
    async list(params: ListParams): Promise<ListResult<ConfigMapSummary>> {
      const body = await client.request<{
        items?: KubeConfigMap[];
        totalItems?: number;
        total_count?: number;
      }>(collectionPath(params.cluster, params.namespace), {
        query: {
          page: params.page,
          limit: params.pageSize,
          ...(params.sortBy ? { sortBy: params.sortBy } : {}),
          ...(params.order ? { ascending: params.order === 'asc' } : {}),
          ...(params.keyword?.trim() ? { name: params.keyword.trim() } : {}),
        },
        ...(params.signal ? { signal: params.signal } : {}),
      });

      const items = (body.items ?? []).map(toSummary);
      return {
        items,
        // Same precedence as the old store: totalItems, then total_count, then
        // the page length (which at least keeps the pager usable when a server
        // omits both).
        total: body.totalItems ?? body.total_count ?? items.length,
        page: params.page,
        pageSize: params.pageSize,
      };
    },

    async get(params: ResourceRef & { signal?: AbortSignal }): Promise<ConfigMapDetail> {
      const item = await client.request<KubeConfigMap>(
        `${collectionPath(params.cluster, params.namespace)}/${encodeURIComponent(params.name)}`,
        { ...(params.signal ? { signal: params.signal } : {}) },
      );
      return toDetail(item);
    },

    async create(input: ConfigMapInput, cluster: string): Promise<ConfigMapDetail> {
      const item = await client.request<KubeConfigMap>(writePath(cluster, input.namespace), {
        method: 'POST',
        body: toKubeObject(input),
      });
      return toDetail(item);
    },

    /**
     * Replace an object.
     *
     * Reads first to pick up the current `resourceVersion`: a PUT carrying a stale
     * one is rejected with 409, and the old console does the same two-step
     * (`console/src/stores/base.js:263-276`).
     */
    async update(params: { cluster: string; namespace: string; body: KubeConfigMap }): Promise<ConfigMapDetail> {
      const name = params.body.metadata?.name ?? '';
      const current = await client.request<KubeConfigMap>(
        `${collectionPath(params.cluster, params.namespace)}/${encodeURIComponent(name)}`,
      );
      const resourceVersion = current.metadata?.resourceVersion;
      const body: KubeConfigMap = {
        ...params.body,
        metadata: {
          ...params.body.metadata,
          ...(resourceVersion ? { resourceVersion } : {}),
        },
      };
      const item = await client.request<KubeConfigMap>(writePath(params.cluster, params.namespace) + `/${encodeURIComponent(name)}`, {
        method: 'PUT',
        body,
      });
      return toDetail(item);
    },

    /** Partial update; used by the delete dialog and by anything that edits one field. */
    async patch(params: ResourceRef & { body: unknown }): Promise<ConfigMapDetail> {
      const item = await client.request<KubeConfigMap>(`${writePath(params.cluster, params.namespace)}/${encodeURIComponent(params.name)}`, {
        method: 'PATCH',
        body: params.body,
      });
      return toDetail(item);
    },

    /**
     * Whether the name is already taken.
     *
     * Read through `/api/v1` rather than kapis: kapis answers a missing object in
     * its own envelope, while the plain kube API returns a `Status` with
     * `reason: NotFound`, which is what the `isNotFound` check below keys on.
     */
    async checkName(params: { cluster: string; namespace: string; name: string }): Promise<boolean> {
      try {
        await client.request<KubeConfigMap>(
          `${writePath(params.cluster, params.namespace)}/${encodeURIComponent(params.name)}`,
        );
        return true;
      } catch (cause) {
        // Absence is the normal answer for a free name, not a failure.
        if (cause instanceof ApiError && cause.isNotFound) return false;
        throw cause;
      }
    },

    async remove(params: { cluster: string; namespace: string; names: string[] }): Promise<void> {
      // Sequential rather than parallel: batch delete has no transaction upstream,
      // and a partial failure is easier to report when the order is deterministic.
      for (const name of params.names) {
        await client.request<void>(`${writePath(params.cluster, params.namespace)}/${encodeURIComponent(name)}`, {
          method: 'DELETE',
        });
      }
    }
  };
}

export type ConfigMapsApi = ReturnType<typeof configMapsApi>;

export const annotationKeys = {
  description: DESCRIPTION_ANNOTATION,
  alias: ALIAS_ANNOTATION,
  creator: CREATOR_ANNOTATION,
} as const;
