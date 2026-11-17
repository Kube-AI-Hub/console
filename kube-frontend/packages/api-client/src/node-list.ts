import type { Client } from './client';
import { clusterScoped } from './paths';
import { toNodeSummary } from './storage';
import type { KubeObject } from './resources';

const NODE_SELECTOR = '!node-role.kubernetes.io/edge';
// The member-cluster segment goes before the group: see `clusterScoped` in ./paths.
const base = (cluster: string) => clusterScoped('/kapis/resources.kubesphere.io/v1alpha3', cluster, 'nodes');

export interface NodeListParams {
  cluster: string;
  page: number;
  pageSize: number;
  sortBy: 'name' | 'createTime';
  order: 'asc' | 'desc';
  keyword?: string;
  status?: string;
  role?: string;
  deviceVendors?: string[];
  xpuModel?: string;
  signal?: AbortSignal;
}

export interface NodeListStats {
  total: number;
  healthy: number;
  vendors: Array<{ vendor: string; count: number }>;
}

export const NODE_LIST_METRICS = [
  'node_gpu_utilisation', 'node_gpu_usage', 'node_gpu_total', 'node_gpu_allocated',
  'node_gpu_memory_utilisation', 'node_gpu_memory_usage', 'node_gpu_memory_total',
  'node_cpu_utilisation', 'node_cpu_usage', 'node_cpu_total',
  'node_memory_utilisation', 'node_memory_usage_wo_cache', 'node_memory_total',
  'node_pod_running_count', 'node_pod_quota',
] as const;

export type NodeMetricValues = Partial<Record<(typeof NODE_LIST_METRICS)[number] | 'node_time_seconds' | 'node_timex_sync_status', number>>;

/** Keep zero samples, discard missing/invalid samples, and never merge different nodes. */
export function toNodeMetrics(body: { results?: Array<{
  metric_name?: string; data?: { result?: Array<{ metric?: Record<string, string>; value?: [number, string] }> };
}> }): Record<string, NodeMetricValues> {
  const out: Record<string, NodeMetricValues> = {};
  for (const result of body.results ?? []) {
    if (!result.metric_name) continue;
    for (const sample of result.data?.result ?? []) {
      const node = sample.metric?.['node'];
      const raw = sample.value?.[1];
      if (!node || raw === undefined || raw.trim() === '') continue;
      const value = Number(raw);
      if (!Number.isFinite(value)) continue;
      (out[node] ??= {})[result.metric_name as keyof NodeMetricValues] = value;
    }
  }
  return out;
}

export function nodeListApi(client: Client) {
  async function metrics(cluster: string, names: string[], time: boolean, signal?: AbortSignal) {
    if (names.length === 0) return {};
    const escaped = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const body = await client.request<Parameters<typeof toNodeMetrics>[0]>(
      // Cluster in the path: a query parameter is ignored by the monitoring handler, which
      // would return the host cluster's nodes for a member cluster's page.
      clusterScoped('/kapis/monitoring.kubesphere.io/v1alpha3', cluster, 'nodes'),
      {
        query: {
          limit: -1, last: true,
          metrics_filter: (time ? ['node_time_seconds', 'node_timex_sync_status'] : NODE_LIST_METRICS).map((metric) => `${metric}$`).join('|'),
          resources_filter: `^(?:${escaped.join('|')})$`,
        },
        ...(signal ? { signal } : {}),
      });
    return toNodeMetrics(body ?? {});
  }
  return {
    async list(params: NodeListParams) {
      const selectors = [NODE_SELECTOR];
      if (params.role === 'worker') selectors.push('!node-role.kubernetes.io/control-plane', '!node-role.kubernetes.io/master');
      const body = await client.request<{ items?: KubeObject[]; totalItems?: number; total_count?: number }>(base(params.cluster), {
        query: {
          page: params.page, limit: params.pageSize, sortBy: params.sortBy, ascending: params.order === 'asc',
          labelSelector: selectors.join(','),
          ...(params.keyword ? { name: params.keyword } : {}),
          ...(params.status ? { status: params.status } : {}),
          ...(params.role === 'master' ? { role: 'master' } : {}),
          ...(params.deviceVendors?.length ? { deviceVendor: params.deviceVendors.join(',') } : {}),
          ...(params.xpuModel ? { xpuModel: params.xpuModel } : {}),
        },
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return { items: (body.items ?? []).map(toNodeSummary), total: Number(body.totalItems ?? body.total_count ?? 0) };
    },
    async get(params: { cluster: string; name: string; signal?: AbortSignal }) {
      const body = await client.request<KubeObject>(`${base(params.cluster)}/${encodeURIComponent(params.name)}`, {
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return toNodeSummary(body);
    },
    async stats(params: { cluster: string; signal?: AbortSignal }): Promise<NodeListStats> {
      const body = await client.request<Record<string, number>>(`${base(params.cluster)}/stats`, {
        query: { labelSelector: NODE_SELECTOR }, ...(params.signal ? { signal: params.signal } : {}),
      });
      if (!Number.isFinite(body.total) || !Number.isFinite(body.healthy)) throw new Error('Invalid node statistics');
      return { total: body.total!, healthy: body.healthy!,
        vendors: Object.entries(body).filter(([key, value]) => !['total', 'healthy'].includes(key) && Number.isFinite(value))
          .map(([vendor, count]) => ({ vendor, count })).sort((a, b) => a.vendor.localeCompare(b.vendor)) };
    },
    async controlPlaneCount(params: { cluster: string; signal?: AbortSignal }): Promise<number> {
      const body = await client.request<{ totalItems?: number }>(base(params.cluster), {
        query: { role: 'master', labelSelector: NODE_SELECTOR, limit: 1, page: 1 },
        ...(params.signal ? { signal: params.signal } : {}),
      });
      if (!Number.isFinite(body.totalItems)) throw new Error('Invalid control-plane count');
      return body.totalItems!;
    },
    metrics: (params: { cluster: string; names: string[]; signal?: AbortSignal }) => metrics(params.cluster, params.names, false, params.signal),
    async timeMetrics(params: { cluster: string; signal?: AbortSignal }) {
      const body = await client.request<{ items?: KubeObject[] }>(base(params.cluster), {
        query: { limit: -1, labelSelector: NODE_SELECTOR }, ...(params.signal ? { signal: params.signal } : {}),
      });
      const names = (body.items ?? []).map((item) => String(item.metadata?.name ?? '')).filter(Boolean);
      return metrics(params.cluster, names, true, params.signal);
    },
  };
}
