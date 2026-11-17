import type { Client } from './client';
import { ApiError } from './errors';

/**
 * 资源消费（计量）.
 *
 * ks-apiserver exposes a metering aggregate under /kapis/metering.kubesphere.io/v1alpha1.
 * Each query returns Prometheus-style results: one entry per metric, each with one sample
 * per object (here: namespace). With `start`/`end` the sample carries a `values` series;
 * without them it carries a single `value`.
 *
 * The deployment either has metering enabled (200) or not (404/400/502). "Not enabled" is
 * a first-class result, not an empty list: an empty table would read as "no projects used
 * anything", which is a different statement. [N-03]
 */
export interface ProjectUsage {
  namespace: string;
  cpuCores: number;
  memoryBytes: number;
  pvcBytes: number;
  gpuCards: number;
}

export type NamespaceUsageResult =
  | { available: true; rows: ProjectUsage[] }
  | { available: false; reason: string };

export type UsageRange = '1h' | '6h' | '24h';

const RANGE_SECONDS: Record<UsageRange, number> = { '1h': 3600, '6h': 21600, '24h': 86400 };

/** Metrics that make up the project row; storage is a total, the rest are averages. */
const METRICS = {
  cpu: 'meter_namespace_cpu_usage',
  memory: 'meter_namespace_memory_usage_wo_cache',
  pvc: 'meter_namespace_pvc_bytes_total',
  gpu: 'meter_namespace_gpu_usage',
} as const;

interface MeterSample {
  metric?: { namespace?: string };
  value?: [number, string];
  values?: Array<[number, string]>;
}

interface MeterResponse {
  results?: Array<{ metric_name?: string; data?: { result?: MeterSample[] } }>;
}

/** Numeric series of one sample, in order. */
function series(sample: MeterSample): number[] {
  const raw = sample.values ?? (sample.value ? [sample.value] : []);
  return raw.map((entry) => Number(entry[1])).filter((value) => Number.isFinite(value));
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function latest(values: number[]): number {
  return values.length === 0 ? 0 : values[values.length - 1]!;
}

/**
 * Metering path.
 *
 * Host uses the plain kapis proxy; a member cluster inserts the cluster segment after
 * `/kapis` (the same convention as the monitoring reads).
 */
export function meteringBase(cluster: string): string {
  return cluster === 'host'
    ? '/kapis/metering.kubesphere.io/v1alpha1'
    : '/kapis/clusters/' + encodeURIComponent(cluster) + '/metering.kubesphere.io/v1alpha1';
}

export function namespaceUsageApi(client: Client) {
  return {
    async query(params: { cluster: string; range: UsageRange; signal?: AbortSignal }): Promise<NamespaceUsageResult> {
      const end = Math.floor(Date.now() / 1000);
      let body: MeterResponse;
      try {
        body = await client.request<MeterResponse>(meteringBase(params.cluster) + '/namespaces', {
          query: { start: end - RANGE_SECONDS[params.range], end, step: '5m' },
          ...(params.signal ? { signal: params.signal } : {}),
        });
      } catch (error) {
        // Not installed is an answer, not a failure: 404 for the route, 400/501 for an
        // unmounted module, 5xx for the aggregate's backend. Everything else (403, …)
        // must stay an error so the page does not explain a permission problem as "no
        // metering".
        const status = error instanceof ApiError ? error.status : 0;
        if (status === 404 || status === 400 || status === 501 || status >= 500) {
          return { available: false, reason: error instanceof Error ? error.message : String(error) };
        }
        throw error;
      }
      const byNamespace = new Map<string, ProjectUsage>();
      for (const result of body?.results ?? []) {
        const name = result.metric_name;
        if (!name || !(Object.values(METRICS) as string[]).includes(name)) continue;
        for (const sample of result.data?.result ?? []) {
          const namespace = sample.metric?.namespace;
          if (!namespace) continue;
          const row = byNamespace.get(namespace) ?? { namespace, cpuCores: 0, memoryBytes: 0, pvcBytes: 0, gpuCards: 0 };
          const values = series(sample);
          if (name === METRICS.cpu) row.cpuCores = average(values);
          if (name === METRICS.memory) row.memoryBytes = average(values);
          if (name === METRICS.pvc) row.pvcBytes = latest(values);
          if (name === METRICS.gpu) row.gpuCards = average(values);
          byNamespace.set(namespace, row);
        }
      }
      return { available: true, rows: [...byNamespace.values()] };
    },
  };
}
