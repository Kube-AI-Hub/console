import type { Client } from './client';

/**
 * Workload usage ranking for one project.
 *
 * The old console's project overview ends with a Top-5 ranking (CPU / memory) of the
 * workloads in the project; this is the same aggregate read at namespace scope.
 *
 * Two things about the payload matter:
 *
 * - the ranking is one request per metric *set*: `metrics_filter` selects which series come
 *   back, and the ordering metric is named by `sort_metric`;
 * - a sample's identity is `metric.workload`, shaped `Kind:name` (e.g. `StatefulSet:web`).
 *   A sample without it is a workload the aggregate could not name — skipped, never invented.
 */
export const WORKLOAD_RANK_METRICS = ['workload_cpu_usage', 'workload_memory_usage_wo_cache'] as const;
export type WorkloadRankMetric = (typeof WORKLOAD_RANK_METRICS)[number];

export interface WorkloadRankRow {
  /** `Kind:name`, as the aggregate reports it. */
  workload: string;
  /** The kind part of `workload` (`Deployment`, `StatefulSet`, …), or empty when unnamed. */
  kind: string;
  /** The name part of `workload`. */
  name: string;
  /** CPU cores or bytes, depending on the requested metric. */
  value: number;
}

export function workloadRankingApi(client: Client) {
  return {
    /** Top `limit` workloads of `namespace` by `metric`, descending. */
    async list(params: {
      cluster: string;
      namespace: string;
      metric: WorkloadRankMetric;
      limit?: number;
      signal?: AbortSignal;
    }): Promise<{ items: WorkloadRankRow[] }> {
      if (!WORKLOAD_RANK_METRICS.includes(params.metric)) throw new Error('Unsupported workload ranking metric');
      const body = await client.request<{
        results?: Array<{
          metric_name?: string;
          data?: { result?: Array<{ metric?: { workload?: string; owner_kind?: string }; value?: [number, string] }> };
        }>;
      }>(`/kapis/monitoring.kubesphere.io/v1alpha3/namespaces/${encodeURIComponent(params.namespace)}/workloads`, {
        query: {
          ...(params.cluster ? { cluster: params.cluster } : {}),
          sort_metric: params.metric,
          sort_type: 'desc',
          page: 1,
          limit: params.limit ?? 5,
          metrics_filter: WORKLOAD_RANK_METRICS.join('|'),
        },
        ...(params.signal ? { signal: params.signal } : {}),
      });

      // The ordering metric decides the order; the other series only enrich rows that already
      // qualified. Reading the ordering series first keeps a workload without a memory sample
      // from appearing in a CPU ranking.
      const ordered = body.results?.find((result) => result.metric_name === params.metric)?.data?.result ?? [];
      const items: WorkloadRankRow[] = [];
      for (const sample of ordered) {
        const workload = sample.metric?.workload?.trim();
        const raw = sample.value?.[1];
        if (!workload || raw === undefined || raw.trim() === '') continue;
        const value = Number(raw);
        if (!Number.isFinite(value)) continue;
        const separator = workload.indexOf(':');
        const kind = separator > 0 ? workload.slice(0, separator) : (sample.metric?.owner_kind ?? '');
        const name = separator > 0 ? workload.slice(separator + 1) : workload;
        items.push({ workload, kind, name, value });
      }
      return { items };
    },
  };
}
