import { describe, expect, it } from 'vitest';
import { createClient } from '../src/client';
import { clusterMetricsApi } from '../src/cluster';

/**
 * Cluster metrics path scoping.
 *
 * Pinned because a wrong cluster here is silent: the KubeSphere monitoring API accepts a
 * `cluster=` query parameter, ignores it for member clusters, and answers 200 with the
 * **host** cluster's numbers. Measured on mlu370 (2026-11-17): `?cluster=4paradigm`
 * returned 128 cores (host) while the path form returned 384 (the member's own).
 */
function recordingClient(body: unknown) {
  const calls: Array<{ url: string; method: string }> = [];
  const client = createClient({
    baseUrl: 'http://apiserver',
    fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), method: (init?.method ?? 'GET').toUpperCase() });
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch,
  });
  return { client, calls };
}

const sample = {
  results: [
    { metric_name: 'cluster_cpu_usage', data: { result: [{ value: [1794880000, '24.848'] }] } },
    { metric_name: 'cluster_cpu_total', data: { result: [{ value: [1794880000, '384'] }] } },
  ],
};

describe('clusterMetricsApi.usage', () => {
  it('reads the host cluster from the unscoped path without a cluster query parameter', async () => {
    const { client, calls } = recordingClient(sample);
    const usage = await clusterMetricsApi(client).usage({ cluster: 'host' });
    expect(calls[0]?.url).toContain('/kapis/monitoring.kubesphere.io/v1alpha3/cluster');
    expect(calls[0]?.url).not.toContain('/clusters/host/');
    // The query parameter is the trap: it returns another cluster's numbers.
    expect(calls[0]?.url).not.toContain('cluster=host');
    expect(usage.cpuUsedCores).toBeCloseTo(24.848);
    expect(usage.cpuTotalCores).toBe(384);
  });

  it('reads a member cluster from the cluster-scoped path', async () => {
    const { client, calls } = recordingClient(sample);
    await clusterMetricsApi(client).usage({ cluster: '4paradigm' });
    expect(calls[0]?.url).toContain('/kapis/clusters/4paradigm/monitoring.kubesphere.io/v1alpha3/cluster');
    expect(calls[0]?.url).not.toContain('cluster=4paradigm');
  });
});
