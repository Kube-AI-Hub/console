import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/errors';
import { namespaceUsageApi } from '../src/metering';

/**
 * Metering parsing.
 *
 * The aggregate returns Prometheus-shaped results: per-metric samples per namespace. The
 * bill page needs one row per namespace, so the point of these tests is the flattening and
 * the "not installed" branch (an empty table would be a different statement).
 */
function clientWith(items: unknown[] | Error) {
  const calls: Array<{ url: string }> = [];
  return {
    calls,
    client: {
      request: async (url: string) => {
        calls.push({ url });
        if (items instanceof Error) throw items;
        return { results: items };
      },
    } as never,
  };
}

describe('namespaceUsageApi.query', () => {
  it('flattens per-metric samples into per-namespace rows', async () => {
    const { client, calls } = clientWith([
      { metric_name: 'meter_namespace_cpu_usage', data: { result: [{ metric: { namespace: 'team' }, values: [[1, '0.5'], [2, '1.5']] }] } },
      { metric_name: 'meter_namespace_memory_usage_wo_cache', data: { result: [{ metric: { namespace: 'team' }, values: [[1, '100'], [2, '300']] }] } },
      { metric_name: 'meter_namespace_pvc_bytes_total', data: { result: [{ metric: { namespace: 'team' }, values: [[1, '1000'], [2, '2000']] }] } },
      { metric_name: 'meter_namespace_gpu_usage', data: { result: [{ metric: { namespace: 'team' }, values: [[1, '2']] }] } },
    ]);
    const result = await namespaceUsageApi(client).query({ cluster: 'host', range: '1h' });
    expect(calls[0]?.url).toContain('/kapis/metering.kubesphere.io/v1alpha1/namespaces');
    expect(result).toEqual({
      available: true,
      rows: [{ namespace: 'team', cpuCores: 1, memoryBytes: 200, pvcBytes: 2000, gpuCards: 2 }],
    });
  });

  it('reports an uninstalled module as unavailable instead of empty', async () => {
    const { client } = clientWith(new ApiError({ code: 'not_found', message: 'metering not enabled' }, 404));
    expect(await namespaceUsageApi(client).query({ cluster: 'host', range: '1h' })).toEqual({
      available: false,
      reason: 'metering not enabled',
    });
  });

  it('keeps a permission error as a failure', async () => {
    const { client } = clientWith(new ApiError({ code: 'forbidden', message: 'forbidden' }, 403));
    await expect(namespaceUsageApi(client).query({ cluster: 'host', range: '1h' })).rejects.toThrow('forbidden');
  });
});
