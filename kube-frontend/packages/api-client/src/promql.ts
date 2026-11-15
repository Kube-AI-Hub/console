import type { Client } from './client';

/**
 * Raw PromQL, through the apiserver's service proxy.
 *
 * The monitoring API (`/kapis/monitoring.kubesphere.io/v1alpha3`) only answers for
 * **named** recording rules: `metrics_filter` takes metric names, not expressions. Custom
 * dashboards store Grafana-shaped panels whose `targets[].expr` is arbitrary PromQL, so
 * rendering them needs an evaluator. There is no kapis route for that (probed: 404), while
 * the apiserver proxy to Prometheus answers normally:
 *
 *   GET /api/v1/namespaces/kubesphere-monitoring-system/services/
 *       http:prometheus-k8s:9090/proxy/api/v1/query?query=sum(up)
 *
 * That is the endpoint this client uses. It is the host cluster's Prometheus, which is also
 * where the migrated custom monitoring pages live; a member cluster's dashboards would need
 * that cluster's Thanos, and this client does not pretend otherwise.
 */
const PROMETHEUS_PROXY =
  '/api/v1/namespaces/kubesphere-monitoring-system/services/http:prometheus-k8s:9090/proxy';

/** One Prometheus series: the label set plus `[timestamp, value]` samples. */
export interface PromqlSeries {
  labels: Record<string, string>;
  points: Array<{ at: number; value: number }>;
}

interface PrometheusMatrix {
  status?: string;
  data?: {
    resultType?: string;
    result?: Array<{ metric?: Record<string, string>; value?: [number, string]; values?: Array<[number, string]> }>;
  };
  error?: string;
}

function toSeries(body: PrometheusMatrix | undefined): PromqlSeries[] {
  const result = body?.data?.result ?? [];
  const out: PromqlSeries[] = [];
  for (const entry of result) {
    const labels = entry.metric ?? {};
    const samples = entry.values ?? (entry.value ? [entry.value] : []);
    const points: Array<{ at: number; value: number }> = [];
    for (const [at, raw] of samples) {
      const parsed = Number.parseFloat(raw);
      // A series can legitimately be `NaN` (a ratio with no denominator); plotting it as a
      // point would draw a gap that looks like missing data, so it is dropped instead.
      if (!Number.isFinite(parsed)) continue;
      points.push({ at: at * 1000, value: parsed });
    }
    if (points.length === 0) continue;
    points.sort((a, b) => a.at - b.at);
    out.push({ labels, points });
  }
  return out;
}

export function promqlApi(client: Client) {
  return {
    /** `query`: one value per series at the current instant. */
    async instant(params: { query: string; signal?: AbortSignal }): Promise<PromqlSeries[]> {
      const body = await client.request<PrometheusMatrix>(`${PROMETHEUS_PROXY}/api/v1/query`, {
        query: { query: params.query },
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return toSeries(body);
    },

    /** `query_range`: samples over `[start, end)` in epoch milliseconds. */
    async range(params: {
      query: string;
      start: number;
      end: number;
      step: string;
      signal?: AbortSignal;
    }): Promise<PromqlSeries[]> {
      const body = await client.request<PrometheusMatrix>(`${PROMETHEUS_PROXY}/api/v1/query_range`, {
        query: {
          query: params.query,
          start: Math.round(params.start / 1000),
          end: Math.round(params.end / 1000),
          step: params.step,
        },
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return toSeries(body);
    },
  };
}
