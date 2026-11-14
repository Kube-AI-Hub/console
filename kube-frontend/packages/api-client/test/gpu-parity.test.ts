import { describe, it, expect } from 'vitest';
import { createClient } from '../src/client';
import { gpusApi } from '../src/gpu';
import { rangeMetricsApi } from '../src/cluster';

function harness(body: unknown) {
  const calls: URL[] = [];
  const client = createClient({ fetchImpl: (async (input) => {
    calls.push(new URL(String(input)));
    return Response.json(body);
  }) as typeof fetch });
  return { gpu: gpusApi(client), metrics: rangeMetricsApi(client), calls };
}
describe('GPU parity contracts', () => {
  it('sends label, model, UUID and status filters before pagination', async () => {
    const { gpu, calls } = harness({ items: [], totalItems: 45 });
    await gpu.list({ cluster: 'host', page: 2, limit: 20, nodeName: 'gpu', uuid: 'GPU/a+',
      labelSelector: 'rack=one', deviceVendor: 'nvidia', type: 'B200', status: 'healthy', sortBy: 'index', ascending: false });
    expect(Object.fromEntries(calls[0]!.searchParams)).toMatchObject({
      page: '2', limit: '20', labelSelector: 'rack=one', uuid: 'GPU/a+', type: 'B200', status: 'healthy', ascending: 'false',
    });
  });
  it('does not silently read host GPU data for member clusters', async () => {
    const { gpu, calls } = harness({});
    await expect(gpu.list({ cluster: 'member' })).rejects.toThrow('host');
    await expect(gpu.stats({ cluster: 'member' })).rejects.toThrow('host');
    expect(calls).toHaveLength(0);
  });
  it('queries associated pods by node and GPU UUID and requires the real total', async () => {
    const { gpu, calls } = harness({ items: [], totalItems: 3 });
    expect(await gpu.pods({ cluster: 'host', node: 'gpu02', uuid: 'GPU-x', page: 2, pageSize: 10, keyword: 'train' })).toEqual({ items: [], total: 3 });
    expect(calls[0]!.pathname).toBe('/kapis/resources.kubesphere.io/v1alpha3/pods');
    expect(Object.fromEntries(calls[0]!.searchParams)).toMatchObject({ nodeName: 'gpu02', gpuUuid: 'GPU-x', page: '2', limit: '10', name: 'train' });
    await expect(harness({}).gpu.pods({ cluster: 'host', node: 'gpu02', uuid: 'GPU-x', page: 1, pageSize: 10 })).rejects.toThrow('total');
  });
  it('keeps per-card units raw and rejects foreign UUID samples and NaN', async () => {
    const sample = (uuid: string, values: Array<[number, string]>) => ({ metric: { node: 'gpu02', uuid }, values });
    const { metrics, calls } = harness({ results: [{ metric_name: 'gpu_card_memory_usage', data: { result: [
      sample('GPU-x', [[1, '0'], [2, '1073741824'], [3, 'NaN']]), sample('GPU-other', [[1, '99']]),
    ] } }] });
    expect(await metrics.gpuCard({ cluster: 'host', node: 'gpu02', uuid: 'GPU-x', metrics: ['gpu_card_memory_usage'], start: 1000, end: 3000, step: '60s' }))
      .toEqual([{ name: 'gpu_card_memory_usage', points: [{ at: 1000, value: 0 }, { at: 2000, value: 1073741824 }] }]);
    expect(calls[0]!.pathname).toBe('/kapis/monitoring.kubesphere.io/v1alpha3/nodes/gpu02');
    expect(calls[0]!.searchParams.get('gpu_uuid')).toBe('GPU-x');
  });
  it('does not turn missing statistics into zero healthy GPUs', async () => {
    await expect(harness({}).gpu.stats({ cluster: 'host' })).rejects.toThrow('statistics');
  });
  it('omits empty filters and never treats a malformed list as an empty cluster', async () => {
    const { gpu, calls } = harness({ items: [], totalItems: 0 });
    await gpu.list({ cluster: 'host', uuid: '', nodeName: '', labelSelector: '' });
    expect(calls[0]!.searchParams.has('uuid')).toBe(false);
    expect(calls[0]!.searchParams.has('nodeName')).toBe(false);
    await expect(harness({}).gpu.list({ cluster: 'host' })).rejects.toThrow('total');
  });
});
