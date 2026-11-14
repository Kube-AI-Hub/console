import { describe, expect, it } from 'vitest';
import { createClient } from '../src/client';
import { clusterGatewaysApi, toClusterGateway } from '../src/gateways';

describe('cluster gateway reads', () => {
  it('uses controller readiness and distinguishes the cluster gateway', () => {
    const row = toClusterGateway({
      metadata: { name: 'kubesphere-router-kubesphere-system', namespace: 'kubesphere-system' },
      spec: { type: 'NodePort', replicas: 1 },
      status: { conditions: [{ type: 'Deployed', status: 'False', message: 'missing chart' }] },
    });
    expect(row.scope).toBe('cluster');
    expect(row.ready).toBe(false);
    expect(row.message).toBe('missing chart');
    expect(toClusterGateway({ metadata: { name: 'project-router', namespace: 'default' } }).scope).toBe('project');
    expect(toClusterGateway({ status: { conditions: [{ type: 'Deployed', status: 'True' }] } }).ready).toBe(true);
  });
  it('returns a bare list without making up pagination', async () => {
    const client = createClient({ fetchImpl: (async () =>
      new Response(JSON.stringify({ items: [] }), { headers: { 'content-type': 'application/json' } })) as typeof fetch });
    expect(await clusterGatewaysApi(client).list({ cluster: 'host' })).toEqual([]);
  });
  it('does not swallow permission failures', async () => {
    const client = createClient({ fetchImpl: (async () =>
      new Response(JSON.stringify({ message: 'forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } })) as typeof fetch });
    await expect(clusterGatewaysApi(client).list({ cluster: 'host' })).rejects.toThrow();
  });
});
