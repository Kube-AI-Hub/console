import { describe, expect, it } from 'vitest';
import { createClient } from '../src/client';
import { nodeResourcesApi } from '../src/node-resources';
import { nodesWriteApi, toNodeDetail } from '../src/storage';
import { rangeMetricsApi } from '../src/cluster';

describe('node scoped resources and writes', () => {
  it('follows native Pod continuation and filters by spec.nodeName', async () => {
    const calls: URL[] = [];
    const client = createClient({ fetchImpl: (async (input) => {
      calls.push(new URL(String(input)));
      const index = calls.length;
      return Response.json({ items: [{ metadata: { name: `pod-${index}`, namespace: 'default' }, spec: { nodeName: 'gpu01' } }],
        metadata: index === 1 ? { continue: 'next' } : {} });
    }) as typeof fetch });
    const pods = await nodeResourcesApi(client).pods({ cluster: 'member', node: 'gpu01' });
    expect(pods).toHaveLength(2);
    // Measured on A100: `/api/v1/clusters/xc/pods` answers 404 (the core group has no member
    // form), while the kapis proxy accepts the same shape and field selector.
    expect(calls[0]?.pathname).toBe('/kapis/clusters/member/resources.kubesphere.io/v1alpha3/pods');
    expect(calls[0]?.searchParams.get('fieldSelector')).toBe('spec.nodeName=gpu01');
    expect(calls[1]?.searchParams.get('continue')).toBe('next');
  });
  it('filters events by Node kind and name', async () => {
    let url: URL | undefined;
    const client = createClient({ fetchImpl: (async (input) => {
      url = new URL(String(input));
      return Response.json({ items: [{ metadata: { name: 'e1' }, reason: 'Ready', count: 2 }] });
    }) as typeof fetch });
    expect(await nodeResourcesApi(client).events({ cluster: 'host', node: 'gpu01' })).toEqual([
      expect.objectContaining({ name: 'e1', reason: 'Ready', count: 2 }),
    ]);
    // `events.k8s.io/v1` names its selectors `regarding.*`; the core group's `involvedObject.*`
    // would be accepted but match nothing, which is worse than an error.
    expect(url?.pathname).toBe('/apis/events.k8s.io/v1/events');
    expect(url?.searchParams.get('fieldSelector')).toBe('regarding.kind=Node,regarding.name=gpu01');
  });
  it('patches only requested metadata and carries cluster and resourceVersion', async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const client = createClient({ fetchImpl: (async (input, init) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      return Response.json({});
    }) as typeof fetch });
    await nodesWriteApi(client).setUnschedulable({ cluster: 'member', name: 'gpu01', unschedulable: true });
    await nodesWriteApi(client).updateMetadata({ cluster: 'member', name: 'gpu01', resourceVersion: '42',
      labels: { 'test/remove': null, 'test/keep': 'yes' } });
    expect(calls.every((call) => call.url.endsWith('/api/v1/clusters/member/nodes/gpu01'))).toBe(true);
    expect(calls[1]?.body).toEqual({ metadata: { resourceVersion: '42', labels: { 'test/remove': null, 'test/keep': 'yes' } } });
  });
  it('preserves extended capacity and accelerator system fields', () => {
    const detail = toNodeDetail({ metadata: { name: 'gpu01', labels: { xpu: 'nvidia-B200' } },
      status: { capacity: { 'nvidia.com/gpu': '8' }, nodeInfo: { gpuDriverVersion: '595', gpuEngineVersion: 'CUDA 13', architecture: 'amd64' } } });
    expect(detail.xpu).toBe('nvidia-B200');
    expect(detail.capacity['nvidia.com/gpu']).toBe('8');
    expect(detail.nodeInfo.gpuEngineVersion).toBe('CUDA 13');
  });
  it('uses the documented per-node range endpoint', async () => {
    let path = '';
    const client = createClient({ fetchImpl: (async (input) => { path = new URL(String(input)).pathname; return Response.json({ results: [] }); }) as typeof fetch });
    await rangeMetricsApi(client).cluster({ cluster: 'host', scope: 'node', node: 'gpu01', metrics: ['node_cpu_usage'], start: 1000, end: 2000, step: '60s' });
    expect(path).toBe('/kapis/monitoring.kubesphere.io/v1alpha3/nodes/gpu01');
  });
});
