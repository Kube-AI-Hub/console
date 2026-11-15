import { describe, expect, it } from 'vitest';
import { createClient } from '../src/client';
import { nodeInsightsApi } from '../src/node-insights';
import { clusterMetricsApi } from '../src/cluster';
import { toNodeDetail } from '../src/storage';

function harness(body: unknown) {
  const calls: URL[] = [];
  const client = createClient({ fetchImpl: (async (input) => {
    calls.push(new URL(String(input)));
    return Response.json(body);
  }) as typeof fetch });
  return { client, calls };
}
describe('node insights and overview contracts', () => {
  it('preserves allocation and topology fields without rewriting raw YAML', () => {
    const raw = { metadata: { name: 'n' }, status: { allocated: { cpu: '500m' },
      allocatedLimits: { cpu: '12' }, conditions: [{ type: 'Ready', lastHeartbeatTime: 'now' }],
      nodeInfo: { cardCount: 7, gpuMemoryTotal: 1024, gpuTopology: [{ GPU0: 'X' }] } } };
    const node = toNodeDetail(raw);
    expect(node.allocated).toEqual({ cpu: '500m' });
    expect(node.allocatedLimits).toEqual({ cpu: '12' });
    expect(node.gpuTopology).toEqual([{ GPU0: 'X' }]);
    expect(node.nodeInfo).toMatchObject({ cardCount: 7, gpuMemoryTotalMiB: 1024 });
    expect(node.conditions[0]?.lastHeartbeatTime).toBe('now');
    expect(node.raw).toBe(raw);
  });
  it('reads node-scoped metrics, retaining zero but not another node or NaN', async () => {
    const { client, calls } = harness({ results: [{ metric_name: 'node_cpu_usage', data: { result: [
      { metric: { node: 'gpu02' }, value: [1, '0'] },
      { metric: { node: 'gpu020' }, value: [1, '10'] },
    ] } }, { metric_name: 'node_disk_size_usage', data: { result: [
      { metric: { node: 'gpu02' }, value: [1, 'NaN'] },
    ] } }] });
    expect(await nodeInsightsApi(client).instant({ cluster: 'host', node: 'gpu02' })).toEqual({ node_cpu_usage: 0 });
    expect(calls[0]?.pathname.endsWith('/nodes/gpu02')).toBe(true);
    expect(calls[0]?.searchParams.get('last')).toBe('true');
  });
  it('guards RDMA identity and keeps backend health separate from link speed', async () => {
    const { client, calls } = harness({ totalItems: 2, items: [
      { nodeName: 'gpu02', device: 'mlx5_0', port: 1, stateName: 'active', physState: 5,
        linkLayerName: 'InfiniBand', linkSpeed: 50_000_000_000, healthy: false, rdmaAllocated: true },
      { nodeName: 'gpu020', device: 'other' },
    ] });
    const api = nodeInsightsApi(client);
    expect(await api.ports({ cluster: 'host', node: 'gpu02' })).toMatchObject([
      { device: 'mlx5_0', speedBytes: 50_000_000_000, healthy: false, resourceReady: true },
    ]);
    expect(await api.ports({ cluster: 'member', node: 'gpu02' })).toMatchObject([
      { device: 'mlx5_0', speedBytes: 50_000_000_000, healthy: false, resourceReady: true },
    ]);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.searchParams.get('cluster')).toBe('member');
    expect(calls[1]?.pathname).toBe('/kapis/rdma.kubesphere.io/v1alpha1/ports');
  });
  it('does not turn missing cluster metrics into zeros', async () => {
    const { client } = harness({ results: [{ metric_name: 'cluster_cpu_usage', data: {
      result: [{ metric: {}, value: [1, '0'] }],
    } }] });
    const usage = await clusterMetricsApi(client).usage({ cluster: 'host' });
    expect(usage.cpuUsedCores).toBe(0);
    expect(usage.cpuTotalCores).toBeUndefined();
    expect(usage.memoryUsedBytes).toBeUndefined();
    expect(usage.gpuAllocated).toBeUndefined();
  });
});
