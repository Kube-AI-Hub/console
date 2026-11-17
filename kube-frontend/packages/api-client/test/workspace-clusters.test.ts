import { describe, expect, it } from 'vitest';
import { createClient } from '../src/client';
import { toWorkspaceClusterSummary, workspaceDetailApi } from '../src/access';

/**
 * Workspace → clusters mapping.
 *
 * The workspace overview's cluster cards answer "where can projects run, and is it healthy".
 * That makes two distinctions load-bearing:
 *
 * 1. **Ready means the Ready condition is `True`.** A cluster that never reported a
 *    condition must read "not ready", not "ready" by absence.
 * 2. **Missing nodeCount is unknown, not zero.** A cluster the platform could not read
 *    must show `-`; a zero would claim it has no nodes.
 */

const cluster = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  apiVersion: 'cluster.kubesphere.io/v1alpha1',
  kind: 'Cluster',
  metadata: {
    name: 'host',
    labels: { 'cluster.kubesphere.io/visibility': 'private' },
    annotations: { 'kubesphere.io/alias-name': '寒武纪主集群', 'kubesphere.io/description': '主集群' },
  },
  spec: { provider: 'kube-ai-hub' },
  status: {
    kubernetesVersion: 'v1.28.15',
    nodeCount: 1,
    conditions: [{ type: 'Ready', status: 'True' }],
  },
  ...overrides,
});

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

describe('toWorkspaceClusterSummary', () => {
  it('maps identity, provider, version, node count, readiness and visibility', () => {
    expect(toWorkspaceClusterSummary(cluster() as never)).toEqual({
      name: 'host',
      alias: '寒武纪主集群',
      description: '主集群',
      provider: 'kube-ai-hub',
      kubernetesVersion: 'v1.28.15',
      nodeCount: 1,
      ready: true,
      visibility: 'private',
      devopsEnabled: false,
    });
  });

  it('is not ready when the Ready condition is absent or false', () => {
    expect(toWorkspaceClusterSummary(cluster({ status: {} }) as never).ready).toBe(false);
    expect(
      toWorkspaceClusterSummary(cluster({ status: { conditions: [{ type: 'Ready', status: 'False' }] } }) as never).ready,
    ).toBe(false);
    // A different condition must not be mistaken for Ready.
    expect(
      toWorkspaceClusterSummary(cluster({ status: { conditions: [{ type: 'Federated', status: 'True' }] } }) as never).ready,
    ).toBe(false);
  });

  it('keeps a missing node count unknown instead of zero', () => {
    const summary = toWorkspaceClusterSummary(cluster({ status: { kubernetesVersion: 'v1.28.15' } }) as never);
    expect(summary.nodeCount).toBeUndefined();
    expect(summary.kubernetesVersion).toBe('v1.28.15');
  });

  it('reports the DevOps module from status.configz', () => {
    expect(toWorkspaceClusterSummary(cluster({ status: { configz: { devops: true } } }) as never).devopsEnabled).toBe(true);
    expect(toWorkspaceClusterSummary(cluster({ status: { configz: { devops: false } } }) as never).devopsEnabled).toBe(false);
    // A cluster that never reported configz has no claim either way: false, not "unknown".
    expect(toWorkspaceClusterSummary(cluster({ status: {} }) as never).devopsEnabled).toBe(false);
  });

  it('returns empty strings for absent metadata fields', () => {
    const summary = toWorkspaceClusterSummary({ metadata: { name: 'n1' } } as never);
    expect(summary.alias).toBe('');
    expect(summary.provider).toBe('');
    expect(summary.kubernetesVersion).toBe('');
    expect(summary.visibility).toBe('');
  });
});

describe('workspaceDetailApi.clusters', () => {
  it('reads the tenant aggregate with limit=-1 and maps every item', async () => {
    const { client, calls } = recordingClient({ items: [cluster()] });
    const rows = await workspaceDetailApi(client).clusters({ name: 'system workspace' });
    expect(calls[0]?.method).toBe('GET');
    expect(calls[0]?.url).toContain('/kapis/tenant.kubesphere.io/v1alpha2/workspaces/system%20workspace/clusters');
    expect(calls[0]?.url).toContain('limit=-1');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('host');
  });

  it('treats an empty response as an empty list', async () => {
    const { client } = recordingClient({});
    expect(await workspaceDetailApi(client).clusters({ name: 'ws' })).toEqual([]);
  });
});
