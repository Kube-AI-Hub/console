import { describe, expect, it } from 'vitest';
import { createClient } from '../src/client';
import { clusterMetricsApi, componentMetricsApi } from '../src/cluster';
import { nodeRankingApi } from '../src/node-ranking';
import { componentsApi } from '../src/storage';
import { kubectlApi } from '../src/kubectl';

const metric = (name: string, values: Array<{ node?: string; result?: string; value: string }>) => ({
  metric_name: name, data: { result: values.map(({ value, ...labels }) => ({ metric: labels, value: [1, value] })) },
});
function harness(body: unknown) {
  const urls: URL[] = [];
  const client = createClient({ fetchImpl: (async (input) => {
    urls.push(new URL(String(input))); return Response.json(body);
  }) as typeof fetch });
  return { client, urls };
}
describe('overview full parity contracts', () => {
  it('keeps GPU use and allocation separate and maps memory and disk without default zeros', async () => {
    const { client, urls } = harness({ results: [
      metric('cluster_gpu_usage', [{ value: '1.91' }]), metric('cluster_gpu_allocated', [{ value: '6' }]),
      metric('cluster_gpu_total', [{ value: '15' }]), metric('cluster_gpu_memory_usage', [{ value: '0' }]),
      metric('cluster_disk_size_capacity', [{ value: '1000' }]),
    ] });
    const data = await clusterMetricsApi(client).usage({ cluster: 'host' });
    expect(data).toMatchObject({ gpuUsed: 1.91, gpuAllocated: 6, gpuTotal: 15, gpuMemoryUsedBytes: 0, diskTotalBytes: 1000 });
    expect(data.diskUsedBytes).toBeUndefined();
    expect(urls[0]?.searchParams.get('metrics_filter')).toContain('cluster_gpu_memory_total$');
  });
  it('maps every scheduler result without confusing error and unschedulable', async () => {
    const { client } = harness({ results: [metric('scheduler_schedule_attempts', [
      { result: 'error', value: '1' }, { result: 'scheduled', value: '300' }, { result: 'unschedulable', value: '226' },
    ])] });
    expect(await componentMetricsApi(client).kubernetesStatus({ cluster: 'host' }))
      .toMatchObject({ error: 1, scheduled: 300, unschedulable: 226 });
  });
  it('joins rank series by node, preserves target order and sends server pagination and escaping', async () => {
    const { client, urls } = harness({ total_item: 12, results: [
      metric('node_gpu_total', [{ node: 'b', value: '8' }, { node: 'a', value: '7' }]),
      metric('node_gpu_allocated', [{ node: 'a', value: '6' }, { node: 'b', value: '0' }]),
      metric('node_load1', [{ node: 'b', value: 'NaN' }, { node: 'a', value: '1.2' }]),
      { metric_name: 'node_gpu_allocated', data: { result: [{ value: [1, '9'] }] } },
    ] });
    const data = await nodeRankingApi(client).list({ cluster: 'member', metric: 'node_gpu_allocated',
      order: 'desc', page: 2, pageSize: 5, keyword: 'gpu.1' });
    expect(data.total).toBe(12);
    expect(data.items.map((row) => row.name)).toEqual(['a', 'b']);
    expect(data.items[0]?.values).toMatchObject({ node_gpu_total: 7, node_gpu_allocated: 6, node_load1: 1.2 });
    expect(data.items[1]?.values.node_load1).toBeUndefined();
    expect(Object.fromEntries(urls[0]!.searchParams)).toMatchObject({
      cluster: 'member', type: 'rank', page: '2', limit: '5', resources_filter: 'gpu\\.1', sort_metric: 'node_gpu_allocated',
    });
  });
  it('scopes component reads and does not silently read host for a member', async () => {
    const { client, urls } = harness([]);
    await componentsApi(client).list({ cluster: 'member/a' });
    expect(urls[0]?.pathname).toBe('/kapis/clusters/member%2Fa/resources.kubesphere.io/v1alpha3/components');
  });
  it('reads plain-text kubeconfig with bearer auth and propagates permission failures', async () => {
    const calls: Array<{ url: URL; init?: RequestInit | undefined }> = [];
    const client = createClient({ getToken: () => 'test-token', fetchImpl: (async (input, init) => {
      calls.push({ url: new URL(String(input)), init });
      return new Response('apiVersion: v1\nclusters: []', { headers: { 'Content-Type': 'text/plain' } });
    }) as typeof fetch });
    expect(await kubectlApi(client).kubeconfig({ cluster: 'member', username: 'u/a' })).toContain('apiVersion: v1');
    // `clusters/<id>` goes before the group (see `clusterScoped`); the other placement 404s on a member.
    expect(calls[0]?.url.pathname).toBe('/kapis/clusters/member/resources.kubesphere.io/v1alpha2/users/u%2Fa/kubeconfig');
    expect(calls[0]?.init?.headers).toMatchObject({ Authorization: 'Bearer test-token' });
    const denied = createClient({ fetchImpl: (async () => new Response('denied', { status: 403 })) as typeof fetch });
    await expect(kubectlApi(denied).kubeconfig({ cluster: 'host', username: 'admin' })).rejects.toMatchObject({ status: 403 });
  });
});
