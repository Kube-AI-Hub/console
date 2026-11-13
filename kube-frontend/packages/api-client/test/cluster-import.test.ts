import { describe, expect, it } from 'vitest';
import {
  clusterAgentApi,
  clusterImportApi,
  clusterImportBody,
  clusterWriteApi,
  clustersApi,
  platformConfigApi,
  toClusterSummary,
} from '../src/cluster';

/**
 * Adding and editing clusters.
 *
 * The two connection modes differ in exactly one way that matters: a direct cluster
 * carries a base64 kubeconfig, a proxy cluster carries none — and "none" has to mean the
 * key is absent, because a stale kubeconfig in the spec is read as a direct connection.
 */

interface Call {
  path: string;
  method?: string;
  body?: unknown;
  contentType?: string;
}

function recordingClient(response: unknown = {}): { client: { request: <T>(path: string, init?: Record<string, unknown>) => Promise<T> }; calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    client: {
      async request<T>(path: string, init?: Record<string, unknown>): Promise<T> {
        calls.push({
          path,
          ...(init?.['method'] ? { method: String(init['method']) } : {}),
          ...(init?.['body'] ? { body: init['body'] } : {}),
          ...(init?.['contentType'] ? { contentType: String(init['contentType']) } : {}),
        });
        return response as T;
      },
    },
  };
}

describe('clusterImportBody', () => {
  it('encodes a direct kubeconfig instead of sending YAML', () => {
    const body = clusterImportBody({ name: 'member', mode: 'direct', kubeconfig: 'apiVersion: v1\n' }) as {
      spec: { connection: Record<string, unknown>; joinFederation: boolean };
    };
    expect(body.spec.connection['type']).toBe('direct');
    // YAML sent verbatim produces a cluster that never connects; the field is base64.
    expect(String(body.spec.connection['kubeconfig'])).not.toContain('apiVersion');
    expect(atob(String(body.spec.connection['kubeconfig']))).toBe('apiVersion: v1');
    expect(body.spec.joinFederation).toBe(true);
  });

  it('carries no kubeconfig key at all for a proxy connection', () => {
    const body = clusterImportBody({ name: 'member', mode: 'proxy' }) as {
      spec: { connection: Record<string, unknown> };
    };
    expect(body.spec.connection['type']).toBe('proxy');
    expect('kubeconfig' in body.spec.connection).toBe(false);
  });

  it('refuses a direct connection without a kubeconfig', () => {
    expect(() => clusterImportBody({ name: 'member', mode: 'direct', kubeconfig: '   ' })).toThrow();
  });
});

describe('clusterImportApi', () => {
  it('creates through the native API group', async () => {
    const { client, calls } = recordingClient();
    await clusterImportApi(client).import({ name: 'member', mode: 'proxy' });
    // kapis rejects writes for this group with 400 wrong GroupVersionKind.
    expect(calls[0].path).toBe('/apis/cluster.kubesphere.io/v1alpha1/clusters');
    expect(calls[0].method).toBe('POST');
  });

  it('validates through the kapis validation endpoint before creating', async () => {
    const { client, calls } = recordingClient();
    await clusterImportApi(client).validate({ name: 'member', mode: 'direct', kubeconfig: 'apiVersion: v1\n' });
    expect(calls[0].path).toBe('/kapis/cluster.kubesphere.io/v1alpha1/clusters/validation');
    expect(calls[0].method).toBe('POST');
  });
});

describe('clusterWriteApi.updateBasicInfo', () => {
  it('patches the alias, tag and description annotations, and the provider', async () => {
    const { client, calls } = recordingClient();
    await clusterWriteApi(client).updateBasicInfo({
      cluster: 'host',
      alias: '生产集群',
      group: 'production',
      provider: 'Kube AI Hub',
      description: 'primary',
    });
    const body = calls[0].body as {
      metadata: { annotations: Record<string, unknown>; labels: Record<string, unknown> };
      spec: { provider: string };
    };
    expect(calls[0].method).toBe('PATCH');
    expect(calls[0].contentType).toBe('application/merge-patch+json');
    expect(body.metadata.annotations['kubesphere.io/alias-name']).toBe('生产集群');
    expect(body.metadata.annotations['kubesphere.io/description']).toBe('primary');
    expect(body.metadata.labels['cluster.kubesphere.io/group']).toBe('production');
    expect(body.spec.provider).toBe('Kube AI Hub');
  });

  it('sends null to clear a field, because an absent key leaves the old value alone', async () => {
    const { client, calls } = recordingClient();
    await clusterWriteApi(client).updateBasicInfo({ cluster: 'host', alias: '', group: '', provider: '', description: '' });
    const body = calls[0].body as {
      metadata: { annotations: Record<string, unknown>; labels: Record<string, unknown> };
      spec: { provider: string };
    };
    expect(body.metadata.annotations['kubesphere.io/alias-name']).toBeNull();
    expect(body.metadata.annotations['kubesphere.io/description']).toBeNull();
    expect(body.metadata.labels['cluster.kubesphere.io/group']).toBeNull();
    // A plain string field cannot be null: an empty string is how it is cleared.
    expect(body.spec.provider).toBe('');
  });
});

describe('toClusterSummary', () => {
  it('carries the alias, tag and connection type the list and switcher show', () => {
    const summary = toClusterSummary({
      metadata: {
        name: 'host',
        creationTimestamp: '2026-01-01T00:00:00Z',
        annotations: { 'kubesphere.io/alias-name': '宿主集群', 'kubesphere.io/description': 'primary' },
        labels: { 'cluster.kubesphere.io/group': 'production' },
      },
      spec: { enable: true, provider: 'Kube AI Hub', connection: { type: 'proxy' } },
      status: { conditions: [{ type: 'Ready', status: 'True' }], nodeCount: 2 },
    });
    expect(summary.alias).toBe('宿主集群');
    expect(summary.group).toBe('production');
    expect(summary.connectionType).toBe('proxy');
    expect(summary.nodeCount).toBe(2);
  });

  it('reports empty strings when the annotations are absent', () => {
    const summary = toClusterSummary({ metadata: { name: 'host' }, spec: {}, status: {} });
    expect(summary.alias).toBe('');
    expect(summary.group).toBe('');
  });
});

describe('platformConfigApi', () => {
  it('reads the multicluster flag from configz', async () => {
    const { client } = recordingClient({ multicluster: true });
    await expect(platformConfigApi(client).configz()).resolves.toEqual({ multicluster: true });
  });

  it('treats a missing flag as a single-cluster installation', async () => {
    const { client } = recordingClient({});
    await expect(platformConfigApi(client).configz()).resolves.toEqual({ multicluster: false });
  });
});

describe('clusterAgentApi', () => {
  it('returns the YAML document as text', async () => {
    const { client } = recordingClient('apiVersion: apps/v1\nkind: Deployment\n');
    await expect(clusterAgentApi(client).deployment({ cluster: 'member' })).resolves.toContain('kind: Deployment');
  });

  it('stringifies an object response instead of rendering [object Object]', async () => {
    const { client } = recordingClient({ kind: 'Deployment' });
    await expect(clusterAgentApi(client).deployment({ cluster: 'member' })).resolves.toContain('"kind": "Deployment"');
  });
});

describe('clustersApi', () => {
  it('maps the list through the summary', async () => {
    const { client } = recordingClient({ items: [{ metadata: { name: 'host' }, spec: {}, status: {} }] });
    const { items } = await clustersApi(client).list();
    expect(items.map((item) => item.name)).toEqual(['host']);
  });
});
