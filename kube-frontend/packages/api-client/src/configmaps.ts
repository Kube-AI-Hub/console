import type { Client } from './client';

/** A ConfigMap as the BFF presents it, not as kube-apiserver returns it. */
export interface ConfigMapSummary {
  name: string;
  namespace: string;
  description: string;
  /** Key names only; values are omitted from the list payload. */
  keys: string[];
  createdAt: string;
  federated: boolean;
}

export interface ConfigMapDetail extends ConfigMapSummary {
  data: Record<string, string>;
}

export interface ListParams {
  cluster: string;
  namespace: string;
  page: number;
  pageSize: number;
  /** Field the server sorts by; matches the column key. */
  sortBy?: 'name' | 'createdAt';
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

/**
 * ConfigMap endpoints.
 *
 * Every method takes the cluster and namespace explicitly. A client that reads
 * "the current namespace" from a global is the reason a stale request can land
 * on the wrong page after a fast project switch.
 */
export function configMapsApi(client: Client) {
  return {
    list(params: ListParams): Promise<ListResult<ConfigMapSummary>> {
      return client.request<ListResult<ConfigMapSummary>>('/configmaps', {
        query: {
          cluster: params.cluster,
          namespace: params.namespace,
          page: params.page,
          pageSize: params.pageSize,
          sortBy: params.sortBy,
          order: params.order,
          keyword: params.keyword,
        },
        ...(params.signal ? { signal: params.signal } : {}),
      });
    },

    get(params: { cluster: string; namespace: string; name: string; signal?: AbortSignal }): Promise<ConfigMapDetail> {
      return client.request<ConfigMapDetail>(`/configmaps/${encodeURIComponent(params.name)}`, {
        query: { cluster: params.cluster, namespace: params.namespace },
        ...(params.signal ? { signal: params.signal } : {}),
      });
    },

    async remove(params: { cluster: string; namespace: string; names: string[] }): Promise<void> {
      // Sequential rather than parallel: batch delete against ks-apiserver has no
      // transaction, and a partial failure is easier to report when the order is
      // deterministic.
      for (const name of params.names) {
        await client.request<void>(`/configmaps/${encodeURIComponent(name)}`, {
          method: 'DELETE',
          query: { cluster: params.cluster, namespace: params.namespace },
        });
      }
    },
  };
}

export type ConfigMapsApi = ReturnType<typeof configMapsApi>;
