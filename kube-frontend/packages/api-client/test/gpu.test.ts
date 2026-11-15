import { describe, expect, it } from 'vitest';
import { gpusApi, gpuPath, toGpuDevice, toGpuStats } from '../src/gpu';

/**
 * The GPU API's shape is easy to get subtly wrong: `type` means model,
 * `deviceVendor` means vendor, memory is MiB, and health must be read as
 * false when the field is absent (the annotation omits false with omitempty).
 */

const raw = {
  index: 3,
  uuid: 'GPU-abc',
  type: 'B200',
  health: true,
  gpuMemoryTotal: 183359,
  gpuMemoryUsed: 1024,
  gpuCoreTotal: 100,
  gpuCoreUsed: 25,
  vgpuTotal: 0,
  vgpuUsed: 0,
  numa: 1,
  deviceVendor: 'nvidia',
  mode: 'default',
  nodeName: 'gpu01',
  nodeIP: '172.16.10.20',
};

interface Call {
  path: string;
  query: Record<string, unknown> | undefined;
}

function recordingClient(body: unknown, calls: Call[]) {
  return {
    request: async (path: string, init?: { query?: Record<string, unknown> }) => {
      calls.push({ path, query: init?.query });
      return body as never;
    },
  };
}

describe('toGpuDevice', () => {
  it('maps the API vocabulary onto the view type', () => {
    expect(toGpuDevice(raw)).toEqual({
      index: 3,
      uuid: 'GPU-abc',
      model: 'B200',
      vendor: 'nvidia',
      health: true,
      memoryTotalMiB: 183359,
      memoryUsedMiB: 1024,
      coreTotal: 100,
      coreUsed: 25,
      vgpuTotal: 0,
      vgpuUsed: 0,
      numa: 1,
      mode: 'default',
      node: 'gpu01',
      nodeIP: '172.16.10.20',
    });
  });

  it('treats a missing health field as unhealthy, never as healthy', () => {
    const device = toGpuDevice({ uuid: 'GPU-def' });
    expect(device.health).toBe(false);
    expect(device.numa).toBeUndefined();
  });
});

describe('toGpuStats', () => {
  it('splits the vendor-model map and keeps the totals', () => {
    expect(
      toGpuStats({
        total: 15,
        healthy: 14,
        'nvidia-B200': 12,
        'nvidia-A100': 3,
        'cambricon-': 1,
      }),
    ).toEqual({
      total: 15,
      healthy: 14,
      byModel: [
        { vendor: 'cambricon', model: '-', count: 1 },
        { vendor: 'nvidia', model: 'A100', count: 3 },
        { vendor: 'nvidia', model: 'B200', count: 12 },
      ],
    });
  });

  it('tolerates a missing body', () => {
    expect(toGpuStats(undefined)).toEqual({ total: 0, healthy: 0, byModel: [] });
  });
});

describe('gpusApi', () => {
  it('lists from the gpu group with the given filters and no cluster segment', async () => {
    const calls: Call[] = [];
    const api = gpusApi(recordingClient({ items: [raw], totalItems: 1 }, calls) as never);

    const result = await api.list({ cluster: 'host', limit: -1, nodeName: 'gpu01', status: 'healthy' });

    expect(calls[0]!.path).toBe('/kapis/gpu.kubesphere.io/v1alpha1/gpus');
    expect(calls[0]!.query).toMatchObject({ cluster: 'host', limit: -1, nodeName: 'gpu01', status: 'healthy' });
    expect(result.total).toBe(1);
    expect(result.items[0]!.uuid).toBe('GPU-abc');
  });

  it('reads one card through the uuid filter, since there is no per-card route', async () => {
    const calls: Call[] = [];
    const api = gpusApi(recordingClient({ items: [raw], totalItems: 1 }, calls) as never);

    const device = await api.get({ cluster: 'host', uuid: 'GPU-abc' });

    expect(calls[0]!.path).toBe(gpuPath());
    expect(calls[0]!.query).toMatchObject({ uuid: 'GPU-abc', limit: -1 });
    expect(device?.uuid).toBe('GPU-abc');
  });

  it('returns null when the card is no longer reported', async () => {
    // null rather than undefined: React Query rejects an undefined query result as
    // an error, which would render the removed-card case as "failed to load".
    const api = gpusApi(recordingClient({ items: [], totalItems: 0 }, [] as Call[]) as never);
    expect(await api.get({ cluster: 'host', uuid: 'GPU-gone' })).toBeNull();
  });

  it('reads the overview stats', async () => {
    const calls: Call[] = [];
    const api = gpusApi(recordingClient({ total: 15, healthy: 15 }, calls) as never);

    const stats = await api.stats({ cluster: 'host' });

    expect(calls[0]!.path).toBe('/kapis/gpu.kubesphere.io/v1alpha1/gpus/stats');
    expect(calls[0]!.query).toMatchObject({ cluster: 'host' });
    expect(stats.healthy).toBe(15);
  });

  it('lists member cluster GPUs with cluster as a query param, not a path segment', async () => {
    const calls: Call[] = [];
    const api = gpusApi(recordingClient({ items: [raw], totalItems: 1 }, calls) as never);

    await api.list({ cluster: 'xc', nodeName: 'node201-xpu', limit: -1 });

    expect(calls[0]!.path).toBe('/kapis/gpu.kubesphere.io/v1alpha1/gpus');
    expect(calls[0]!.query).toMatchObject({ cluster: 'xc', nodeName: 'node201-xpu' });
  });

  it('writes mode with cluster as a query param, not a path segment', async () => {
    const calls: Call[] = [];
    const api = gpusApi(
      recordingClient(
        { success: true, prevMode: 'default', newMode: 'hami-core', message: 'ok' },
        calls,
      ) as never,
    );

    const body = await api.setMode({
      cluster: 'xc',
      node: 'node201-xpu',
      mode: 'hami-core',
      params: {},
    });

    expect(calls[0]!.path).toBe('/kapis/gpu.kubesphere.io/v1alpha1/device-plugins/gpu/mode');
    expect(calls[0]!.query).toMatchObject({ nodeName: 'node201-xpu', cluster: 'xc' });
    expect(body.newMode).toBe('hami-core');
  });
});
