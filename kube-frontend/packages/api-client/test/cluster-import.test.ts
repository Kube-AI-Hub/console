import { describe, expect, it } from 'vitest';
import type { RequestOptions } from '../src/client';
import {
  CLUSTER_GROUPS,
  CLUSTER_PROVIDERS,
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
  responseType?: string;
}

function recordingClient(response: unknown = {}): {
  client: { request: <T>(path: string, init?: RequestOptions) => Promise<T> };
  calls: Call[];
} {
  const calls: Call[] = [];
  return {
    calls,
    client: {
      async request<T>(path: string, init?: RequestOptions): Promise<T> {
        calls.push({
          path,
          ...(init?.method ? { method: init.method } : {}),
          ...(init?.body ? { body: init.body } : {}),
          ...(init?.contentType ? { contentType: init.contentType } : {}),
          ...(init?.responseType ? { responseType: init.responseType } : {}),
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

  it('writes the environment tag as the same label 编辑信息 patches', () => {
    // Two entry points writing the same label; a mismatch would make a cluster look
    // untagged right after it was created with a tag.
    const body = clusterImportBody({ name: 'member', mode: 'proxy', group: 'production' }) as {
      metadata: { labels?: Record<string, string> };
    };
    expect(body.metadata.labels?.['cluster.kubesphere.io/group']).toBe('production');
  });

  it('omits the labels block when no tag was chosen', () => {
    // An empty string would be a tag named ""; the platform reads the key's presence.
    const body = clusterImportBody({ name: 'member', mode: 'proxy', group: '  ' }) as {
      metadata: { labels?: Record<string, string> };
    };
    expect(body.metadata.labels).toBeUndefined();
  });
});

describe('clusterImportApi', () => {
  it('creates through the native API group', async () => {
    const { client, calls } = recordingClient();
    await clusterImportApi(client).import({ name: 'member', mode: 'proxy' });
    expect(calls).toHaveLength(1);
    // kapis rejects writes for this group with 400 wrong GroupVersionKind.
    expect(calls[0]?.path).toBe('/apis/cluster.kubesphere.io/v1alpha1/clusters');
    expect(calls[0]?.method).toBe('POST');
  });

  it('validates through the kapis validation endpoint before creating', async () => {
    const { client, calls } = recordingClient();
    await clusterImportApi(client).validate({ name: 'member', mode: 'direct', kubeconfig: 'apiVersion: v1\n' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.path).toBe('/kapis/cluster.kubesphere.io/v1alpha1/clusters/validation');
    expect(calls[0]?.method).toBe('POST');
  });

  it('asks for name existence through kapis with the check-exist header', async () => {
    // A 404 is not the answer to this question: the header changes the handler, so a
    // free name comes back 200 `{ exist: false }`.
    const calls: Array<{ path: string; headers?: Record<string, string> }> = [];
    const client = {
      async request<T>(path: string, init?: RequestOptions): Promise<T> {
        calls.push({ path, ...(init?.headers ? { headers: init.headers } : {}) });
        return { exist: true } as T;
      },
    };
    await expect(clusterImportApi(client).exists({ name: 'member' })).resolves.toBe(true);
    expect(calls[0]?.path).toBe('/kapis/cluster.kubesphere.io/v1alpha1/clusters/member');
    expect(calls[0]?.headers?.['x-check-exist']).toBe('true');
  });

  it('reports a free name as not existing, and an empty name without a request', async () => {
    const calls: string[] = [];
    const client = {
      async request<T>(path: string): Promise<T> {
        calls.push(path);
        return { exist: false } as T;
      },
    };
    await expect(clusterImportApi(client).exists({ name: 'free-name' })).resolves.toBe(false);
    await expect(clusterImportApi(client).exists({ name: '   ' })).resolves.toBe(false);
    expect(calls).toHaveLength(1);
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
    expect(calls).toHaveLength(1);
    const body = calls[0]?.body as {
      metadata: { annotations: Record<string, unknown>; labels: Record<string, unknown> };
      spec: { provider: string };
    };
    expect(calls[0]?.method).toBe('PATCH');
    expect(calls[0]?.contentType).toBe('application/merge-patch+json');
    expect(body.metadata.annotations['kubesphere.io/alias-name']).toBe('生产集群');
    expect(body.metadata.annotations['kubesphere.io/description']).toBe('primary');
    expect(body.metadata.labels['cluster.kubesphere.io/group']).toBe('production');
    expect(body.spec.provider).toBe('Kube AI Hub');
  });

  it('sends null to clear a field, because an absent key leaves the old value alone', async () => {
    const { client, calls } = recordingClient();
    await clusterWriteApi(client).updateBasicInfo({ cluster: 'host', alias: '', group: '', provider: '', description: '' });
    expect(calls).toHaveLength(1);
    const body = calls[0]?.body as {
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

describe('cluster options', () => {
  it('offers the four environment tags the old console had', () => {
    // `demo` was missing, so a cluster tagged demo could not be re-tagged as demo.
    expect([...CLUSTER_GROUPS]).toEqual(['production', 'development', 'testing', 'demo']);
  });

  it('offers the seven providers with the corrected Azure spelling', () => {
    expect(CLUSTER_PROVIDERS).toContain('Azure Kubernetes Service');
    // The old constant stored `Aure Kubernetes Service`; new data must not repeat it.
    expect(CLUSTER_PROVIDERS).not.toContain('Aure Kubernetes Service');
    expect(CLUSTER_PROVIDERS).toHaveLength(8);
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

  /*
   * The endpoint answers with YAML, and the client parses anything that is not marked
   * `responseType: 'text'` as JSON. That made `JSON.parse` throw a SyntaxError on the
   * leading `---`, so the request returned 200 while the page showed "unknown error"
   * and no manifest at all.
   */
  it('asks for the manifest as text so the client does not JSON.parse it', async () => {
    const { client, calls } = recordingClient('---\nkind: Deployment\n');
    await clusterAgentApi(client).deployment({ cluster: 'member' });
    expect(calls[0].responseType).toBe('text');
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
