import { describe, expect, it } from 'vitest';
import { createClient } from '../src/client';
import { nodeListApi, toNodeMetrics } from '../src/node-list';
import { gpusApi } from '../src/gpu';
import { toNodeSummary } from '../src/storage';

function harness(body: unknown) {
  const calls: Array<{ url: URL; init: RequestInit | undefined }> = [];
  const client = createClient({ fetchImpl: (async (input, init) => {
    calls.push({ url: new URL(String(input)), init });
    return Response.json(body);
  }) as typeof fetch });
  return { api: nodeListApi(client), gpu: gpusApi(client), calls };
}
describe('node list API contracts', () => {
  it('sends all filters upstream before pagination and scopes member clusters', async () => {
    const { api, calls } = harness({ items: [], totalItems: 31 });
    expect(await api.list({ cluster: 'member/a', page: 3, pageSize: 20, sortBy: 'name', order: 'asc',
      keyword: '172.16', status: 'running', role: 'master', deviceVendors: ['nvidia', 'CPU'], xpuModel: 'B200' })).toEqual({ items: [], total: 31 });
    expect(calls[0]?.url.pathname).toBe('/kapis/resources.kubesphere.io/v1alpha3/clusters/member%2Fa/nodes');
    expect(Object.fromEntries(calls[0]!.url.searchParams)).toMatchObject({
      page: '3', limit: '20', name: '172.16', role: 'master', status: 'running', deviceVendor: 'nvidia,CPU', xpuModel: 'B200', ascending: 'true',
    });
  });
  it('does not require an explicit worker label', async () => {
    const { api, calls } = harness({ items: [], totalItems: 0 });
    await api.list({ cluster: 'host', page: 1, pageSize: 10, sortBy: 'name', order: 'desc', role: 'worker' });
    expect(calls[0]?.url.searchParams.get('labelSelector')).toBe(
      '!node-role.kubernetes.io/edge,!node-role.kubernetes.io/control-plane,!node-role.kubernetes.io/master');
    expect(calls[0]?.url.searchParams.has('role')).toBe(false);
  });
  it('reads global counts without forwarding list conditions', async () => {
    const { api, calls } = harness({ total: 20, healthy: 19, nvidia: 17, CPU: 3, totalItems: 2 });
    expect(await api.stats({ cluster: 'host' })).toMatchObject({ total: 20, healthy: 19 });
    expect(await api.controlPlaneCount({ cluster: 'host' })).toBe(2);
    expect(calls[0]?.url.pathname.endsWith('/nodes/stats')).toBe(true);
    expect(calls[0]?.url.searchParams.has('name')).toBe(false);
    expect(calls[0]?.url.searchParams.has('deviceVendor')).toBe(false);
    expect(calls[1]?.url.searchParams.get('role')).toBe('master');
  });
  it('anchors and escapes metric node names', async () => {
    const { api, calls } = harness({ results: [] });
    await api.metrics({ cluster: 'host', names: ['gpu.1', 'gpu+2'] });
    expect(calls[0]?.url.searchParams.get('resources_filter')).toBe('^(?:gpu\\.1|gpu\\+2)$');
    expect(calls[0]?.url.searchParams.get('last')).toBe('true');
    expect(calls[0]?.url.pathname).toBe('/kapis/monitoring.kubesphere.io/v1alpha3/nodes');
  });
  it('keeps genuine zero values and omits invalid samples', () => {
    const values = toNodeMetrics({ results: [{ metric_name: 'node_gpu_usage', data: { result: [
      { metric: { node: 'zero' }, value: [1, '0'] }, { metric: { node: 'invalid' }, value: [1, 'NaN'] },
      { metric: { node: 'missing' } },
    ] } }] });
    expect(values).toEqual({ zero: { node_gpu_usage: 0 } });
  });
  it('preserves enhanced GPU fields and unknown modes without inventing defaults', () => {
    const summary = toNodeSummary({ metadata: { name: 'gpu01', labels: { 'xpu-vendor': 'nvidia', 'xpu-model': 'B200' },
      annotations: { 'node.kubesphere.io/cpu-requests': '1500m' } },
      status: { nodeInfo: { virtualCardMode: 'hami-core', gpuModeParams: { devicesplitcount: '12' },
        gpuModeStatus: { mode: 'hami-core', status: 'in_progress', timestamp: '2026-11-14T00:00:00Z' } } } });
    expect(summary).toMatchObject({ gpuVendor: 'nvidia', gpuModel: 'B200', gpuMode: 'hami-core', cpuRequested: '1500m' });
    expect(toNodeSummary({ metadata: { name: 'unknown' } }).gpuMode).toBe('');
  });
  it('writes a mode signal with string parameters and encoded node name', async () => {
    const { gpu, calls } = harness({ success: true, prevMode: 'default', newMode: 'hami-core', message: 'submitted' });
    await gpu.setMode({ cluster: 'host', node: 'gpu/a', mode: 'hami-core', params: { devicesplitcount: '10' } });
    expect(calls[0]?.url.searchParams.get('nodeName')).toBe('gpu/a');
    expect(calls[0]?.init?.method).toBe('PUT');
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ mode: 'hami-core', params: { devicesplitcount: '10' } });
  });
  it('sends member cluster as a query param and surfaces application-level refusal', async () => {
    const { gpu, calls } = harness({ success: false, message: 'mode denied' });
    await gpu.setMode({ cluster: 'xc', node: 'gpu01', mode: 'default', params: {} }).catch(() => undefined);
    expect(calls[0]?.url.searchParams.get('cluster')).toBe('xc');
    expect(calls[0]?.url.pathname).toBe('/kapis/gpu.kubesphere.io/v1alpha1/device-plugins/gpu/mode');
    await expect(gpu.setMode({ cluster: 'host', node: 'gpu01', mode: 'default', params: {} })).rejects.toThrow('mode denied');
  });
});
