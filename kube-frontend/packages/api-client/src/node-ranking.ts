import type { Client } from './client';
import { clusterScoped } from './paths';

export const NODE_RANK_METRICS = [
  'node_gpu_memory_utilisation', 'node_gpu_utilisation', 'node_gpu_allocated',
  'node_cpu_utilisation', 'node_load1', 'node_memory_utilisation',
  'node_disk_size_utilisation', 'node_disk_inode_utilisation', 'node_pod_utilisation',
] as const;
export type NodeRankMetric = (typeof NODE_RANK_METRICS)[number];
const METRICS = [...NODE_RANK_METRICS, 'node_gpu_total', 'node_pod_running_count'];
export interface NodeRankRow {
  name: string;
  values: Partial<Record<NodeRankMetric | 'node_gpu_total' | 'node_pod_running_count', number>>;
}

export function nodeRankingApi(client: Client) {
  return {
    async list(params: {
      cluster: string; metric: NodeRankMetric; order: 'asc' | 'desc';
      page: number; pageSize: number; keyword?: string; signal?: AbortSignal;
    }): Promise<{ items: NodeRankRow[]; total: number }> {
      if (!NODE_RANK_METRICS.includes(params.metric)) throw new Error('Unsupported node ranking metric');
      const body = await client.request<{
        total_item?: number;
        results?: Array<{ metric_name?: string; data?: { result?: Array<{
          metric?: { node?: string }; value?: [number, string];
        }> } }>;
      }>(
        // Cluster in the path: the monitoring handler ignores `?cluster=` and would rank the
        // host cluster's nodes under the member cluster's title (see `clusterScoped`).
        clusterScoped('/kapis/monitoring.kubesphere.io/v1alpha3', params.cluster, 'nodes'),
        {
          query: { type: 'rank', sort_metric: params.metric,
            sort_type: params.order, page: params.page, limit: params.pageSize,
            metrics_filter: METRICS.map((metric) => `${metric}$`).join('|'),
            ...(params.keyword ? { resources_filter: params.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } : {}),
          }, ...(params.signal ? { signal: params.signal } : {}),
        });
      const rows = new Map<string, NodeRankRow>();
      for (const result of body.results ?? []) {
        if (!METRICS.includes(result.metric_name as NodeRankMetric)) continue;
        for (const sample of result.data?.result ?? []) {
          const name = sample.metric?.node;
          if (!name) continue;
          const row = rows.get(name) ?? { name, values: {} };
          rows.set(name, row);
          const raw = sample.value?.[1];
          if (raw === undefined || raw.trim() === '') continue;
          const value = Number(raw);
          if (Number.isFinite(value)) row.values[result.metric_name as keyof NodeRankRow['values']] = value;
        }
      }
      // The backend omits total_item for an empty ranking (omitempty), not for a populated page.
      const total = body.total_item ?? (rows.size === 0 ? 0 : undefined);
      if (total === undefined || !Number.isFinite(total)) throw new Error('Invalid node ranking total');
      const ordered = body.results?.find((result) => result.metric_name === params.metric)?.data?.result ?? [];
      const names = new Set(ordered.map((sample) => sample.metric?.node).filter((name): name is string => Boolean(name)));
      return { items: [...names].map((name) => rows.get(name)!).filter(Boolean)
        .concat([...rows.values()].filter((row) => !names.has(row.name))), total };
    },
  };
}
