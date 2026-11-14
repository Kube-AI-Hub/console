import { describe, expect, it } from 'vitest';
import { rangeMetricsApi } from '../src/cluster';

/**
 * The range API grew workload and pod scopes for the detail monitor tab. The
 * details that are easy to get wrong: the path wants the *singular* kind, the
 * workload name goes into a regex-ish `resources_filter` (so it must be escaped),
 * and both scopes share the matrix→points parsing.
 */

interface Call {
  path: string;
  query: Record<string, unknown> | undefined;
}

function clientReturning(results: unknown, calls: Call[]) {
  return {
    request: async (path: string, init?: { query?: Record<string, unknown> }) => {
      calls.push({ path, query: init?.query });
      return { results } as never;
    },
  };
}

function matrix(name: string, values: Array<[number, string]>) {
  return {
    metric_name: name,
    data: { resultType: 'matrix', result: [{ metric: { __name__: name }, values }] },
  };
}

describe('rangeMetricsApi.workload', () => {
  it('addresses the singular kind and filters by the workload name', async () => {
    const calls: Call[] = [];
    const api = rangeMetricsApi(
      clientReturning([matrix('workload_cpu_usage', [[1700000000, '0.5']])], calls) as never,
    );

    const series = await api.workload({
      cluster: 'host',
      namespace: 'demo',
      kind: 'deployments',
      workload: 'web',
      metrics: ['workload_cpu_usage'],
      start: 1_700_000_000_000,
      end: 1_700_000_060_000,
      step: '60s',
    });

    expect(calls[0]!.path).toBe('/kapis/monitoring.kubesphere.io/v1alpha3/namespaces/demo/workloads/deployment');
    expect(calls[0]!.query).toMatchObject({
      metrics_filter: 'workload_cpu_usage$',
      resources_filter: 'web',
      start: 1700000000,
      end: 1700000060,
      step: '60s',
      cluster: 'host',
    });
    expect(series).toEqual([
      { name: 'workload_cpu_usage', points: [{ at: 1_700_000_000_000, value: 0.5 }] },
    ]);
  });

  it('maps each plural kind to the path segment the API documents', async () => {
    const expected: Record<string, string> = {
      deployments: 'deployment',
      statefulsets: 'statefulset',
      daemonsets: 'daemonset',
    };
    for (const [kind, segment] of Object.entries(expected)) {
      const calls: Call[] = [];
      const api = rangeMetricsApi(clientReturning([], calls) as never);
      await api.workload({
        cluster: 'host',
        namespace: 'demo',
        kind: kind as 'deployments' | 'statefulsets' | 'daemonsets',
        workload: 'web',
        metrics: ['workload_cpu_usage'],
        start: 0,
        end: 1,
        step: '60s',
      });
      expect(calls[0]!.path).toContain(`/workloads/${segment}`);
    }
  });

  it('escapes regex metacharacters so a dotted name cannot match another workload', async () => {
    const calls: Call[] = [];
    const api = rangeMetricsApi(clientReturning([], calls) as never);

    await api.workload({
      cluster: 'host',
      namespace: 'demo',
      kind: 'statefulsets',
      workload: 'db.primary',
      metrics: ['workload_cpu_usage'],
      start: 0,
      end: 1,
      step: '60s',
    });

    expect(calls[0]!.query!['resources_filter']).toBe('db\\.primary');
  });
});

describe('rangeMetricsApi.pod', () => {
  it('reads one pod by namespace and name, with no resource filter', async () => {
    const calls: Call[] = [];
    const api = rangeMetricsApi(clientReturning([], calls) as never);

    await api.pod({
      cluster: 'host',
      namespace: 'demo',
      pod: 'web-abc',
      metrics: ['pod_cpu_usage', 'pod_memory_usage_wo_cache'],
      start: 0,
      end: 60_000,
      step: '60s',
    });

    expect(calls[0]!.path).toBe('/kapis/monitoring.kubesphere.io/v1alpha3/namespaces/demo/pods/web-abc');
    expect(calls[0]!.query).toMatchObject({
      metrics_filter: 'pod_cpu_usage$|pod_memory_usage_wo_cache$',
    });
    expect(calls[0]!.query).not.toHaveProperty('resources_filter');
  });
});

describe('rangeMetricsApi.cluster', () => {
  it('uses the registered node endpoint while preserving node/namespace parameters', async () => {
    const calls: Call[] = [];
    const api = rangeMetricsApi(clientReturning([], calls) as never);

    await api.cluster({
      cluster: 'host',
      metrics: ['node_cpu_utilisation'],
      start: 0,
      end: 60_000,
      step: '60s',
      scope: 'node',
      node: 'gpu01',
      namespace: 'demo',
    });

    expect(calls[0]!.path).toBe('/kapis/monitoring.kubesphere.io/v1alpha3/nodes/gpu01');
    expect(calls[0]!.query).toMatchObject({ node: 'gpu01', namespace: 'demo' });
  });
});

describe('rangeMetricsApi date parsing', () => {
  it('sorts samples by time and drops non-finite values and empty series', async () => {
    const calls: Call[] = [];
    const api = rangeMetricsApi(
      clientReturning(
        [
          matrix('workload_cpu_usage', [
            [1700000060, '2'],
            [1700000000, 'not-a-number'],
            [1700000120, '1'],
          ]),
          matrix('workload_memory_usage_wo_cache', []),
        ],
        calls,
      ) as never,
    );

    const series = await api.workload({
      cluster: 'host',
      namespace: 'demo',
      kind: 'deployments',
      workload: 'web',
      metrics: ['workload_cpu_usage'],
      start: 0,
      end: 1,
      step: '60s',
    });

    expect(series).toHaveLength(1);
    expect(series[0]!.points.map((point) => point.at)).toEqual([1_700_000_060_000, 1_700_000_120_000]);
  });
});
