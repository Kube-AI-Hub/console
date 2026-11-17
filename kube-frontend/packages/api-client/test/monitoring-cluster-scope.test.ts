import { describe, expect, it } from 'vitest';
import { createClient } from '../src/client';
import { clusterMetricsApi, componentMetricsApi, nodeUsageApi, rangeMetricsApi } from '../src/cluster';
import { nodeRankingApi } from '../src/node-ranking';
import { nodeListApi } from '../src/node-list';
import { nodeInsightsApi } from '../src/node-insights';
import { workloadRankingApi } from '../src/workload-ranking';

/**
 * Every monitoring read names its cluster in the **path**.
 *
 * The monitoring handler reads `cluster` from `req.PathParameter` only
 * (`pkg/kapis/monitoring/v1alpha3/helper.go`), so `?cluster=<member>` is ignored and the
 * host cluster answers. Measured on mlu370 (2026-11-17): `?cluster=4paradigm` returned 128
 * cores (host) while the path form returned the member's own 384. A wrong cluster here is
 * silent — the panel looks populated and belongs to another cluster — so each read is
 * pinned rather than trusting the shared helper at each call site.
 */
function recordingClient(body: unknown) {
  const calls: string[] = [];
  const client = createClient({
    baseUrl: 'http://apiserver',
    fetchImpl: (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch,
  });
  return { client, calls };
}

const empty = { results: [], total_item: 0, items: [], totalItems: 0 };
const range = { cluster: 'member', metrics: ['node_cpu_usage'], start: 0, end: 60_000, step: '60s' };

describe('monitoring reads carry the cluster in the path', () => {
  it('scopes the cluster usage read', async () => {
    const { client, calls } = recordingClient(empty);
    await clusterMetricsApi(client).usage({ cluster: 'member' });
    expect(calls[0]).toContain('/kapis/clusters/member/monitoring.kubesphere.io/v1alpha3/cluster');
    expect(calls[0]).not.toContain('cluster=member');
  });

  it('scopes the control-plane component read', async () => {
    const { client, calls } = recordingClient(empty);
    await componentMetricsApi(client).kubernetesStatus({ cluster: 'member' });
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call).toContain('/kapis/clusters/member/monitoring.kubesphere.io/v1alpha3/components/');
      expect(call).not.toContain('cluster=member');
    }
  });

  it('scopes the range reads for cluster, node, pod and workload scopes', async () => {
    const { client, calls } = recordingClient(empty);
    const api = rangeMetricsApi(client);
    await api.cluster(range);
    await api.cluster({ ...range, scope: 'node', node: 'gpu01' });
    await api.pod({ ...range, namespace: 'demo', pod: 'web-abc' });
    await api.workload({ ...range, namespace: 'demo', kind: 'deployments', workload: 'web' });
    await api.component({ ...range, component: 'apiserver' });
    for (const call of calls) {
      expect(call).toContain('/kapis/clusters/member/monitoring.kubesphere.io/v1alpha3/');
      expect(call).not.toContain('cluster=member');
    }
  });

  it('scopes the node ranking and node list metric reads', async () => {
    const { client, calls } = recordingClient(empty);
    await nodeRankingApi(client).list({ cluster: 'member', metric: 'node_cpu_utilisation', order: 'desc', page: 1, pageSize: 5 });
    await nodeListApi(client).metrics({ cluster: 'member', names: ['gpu01'] });
    await nodeInsightsApi(client).instant({ cluster: 'member', node: 'gpu01' });
    await nodeUsageApi(client).list({ cluster: 'member' });
    for (const call of calls) {
      expect(call).toContain('/kapis/clusters/member/monitoring.kubesphere.io/v1alpha3/');
      expect(call).not.toContain('cluster=member');
    }
  });

  it('scopes the project workload ranking', async () => {
    const { client, calls } = recordingClient(empty);
    await workloadRankingApi(client).list({ cluster: 'member', namespace: 'demo', metric: 'workload_cpu_usage' });
    expect(calls[0]).toContain('/kapis/clusters/member/monitoring.kubesphere.io/v1alpha3/namespaces/demo/workloads');
    expect(calls[0]).not.toContain('cluster=member');
  });

  it('keeps the host cluster on its original unscoped path', async () => {
    const { client, calls } = recordingClient(empty);
    await nodeRankingApi(client).list({ cluster: 'host', metric: 'node_cpu_utilisation', order: 'desc', page: 1, pageSize: 5 });
    expect(calls[0]).toContain('/kapis/monitoring.kubesphere.io/v1alpha3/nodes');
    expect(calls[0]).not.toContain('/clusters/host/');
  });
});
