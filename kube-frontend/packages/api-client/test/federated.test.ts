import { describe, expect, it } from 'vitest';
import { createClient } from '../src/client';
import {
  clustersOf,
  federatedApi,
  FEDERATED_API,
  pluralOf,
  projectNameProblem,
  propagatedOf,
  segmentOf,
  toFederatedProject,
  WORKSPACE_LABEL,
  workspaceOf,
  type KubeFederatedObject,
} from '../src/federated';

/**
 * The federated project contract.
 *
 * The shapes below were captured from the live federation API, including the one
 * pre-existing object whose workspace label lives only on the template. The write
 * tests pin the order of the two requests behind create and the rollback that keeps a
 * failed create from leaving a namespace behind.
 */

const existing: KubeFederatedObject = {
  apiVersion: 'types.kubefed.io/v1beta1',
  kind: 'FederatedNamespace',
  metadata: {
    name: 'kubesphere-monitoring-federated',
    namespace: 'kubesphere-monitoring-federated',
    creationTimestamp: '2026-11-13T07:33:24Z',
    annotations: { 'kubesphere.io/creator': 'admin' },
  },
  spec: {
    placement: { clusterSelector: {} },
    template: { metadata: { labels: { [WORKSPACE_LABEL]: 'system-workspace' } } },
  },
  status: {
    clusters: [{ name: 'host' }],
    conditions: [{ type: 'Propagation', status: 'True' }],
  },
};

describe('federated project mapping', () => {
  it('reads the workspace from the template label, falling back to the object', () => {
    expect(workspaceOf(existing)).toBe('system-workspace');
    expect(workspaceOf({ metadata: { labels: { [WORKSPACE_LABEL]: 'ws-a' } } })).toBe('ws-a');
    expect(workspaceOf({})).toBe('');
  });

  it('prefers reported clusters and falls back to the requested placement', () => {
    expect(clustersOf(existing)).toEqual(['host']);
    expect(clustersOf({ spec: { placement: { clusters: [{ name: 'host' }, { name: 'member-1' }] } } })).toEqual([
      'host',
      'member-1',
    ]);
    // A reported empty list is still a report: it must not be replaced by placement.
    expect(clustersOf({ status: { clusters: [] }, spec: { placement: { clusters: [{ name: 'host' }] } } })).toEqual([]);
  });

  it('keeps "not reported" distinct from "reported failing"', () => {
    expect(propagatedOf(existing)).toBe(true);
    expect(propagatedOf({ status: { conditions: [{ type: 'Propagation', status: 'False', reason: 'CheckClusters' }] } })).toBe(false);
    expect(propagatedOf({ status: { conditions: [] } })).toBeUndefined();
    expect(propagatedOf({ status: { conditions: [{ type: 'Propagation', status: 'Unknown' }] } })).toBeUndefined();
  });

  it('maps annotations and the terminating state without inventing values', () => {
    const project = toFederatedProject(existing);
    expect(project).toMatchObject({
      name: 'kubesphere-monitoring-federated',
      namespace: 'kubesphere-monitoring-federated',
      workspace: 'system-workspace',
      alias: '',
      description: '',
      creator: 'admin',
      clusters: ['host'],
      propagated: true,
      createdAt: '2026-11-13T07:33:24Z',
      terminating: false,
    });
    expect(toFederatedProject({ metadata: { name: 'p', deletionTimestamp: '2026-11-15T00:00:00Z' } }).terminating).toBe(true);
    expect(toFederatedProject({}).clusters).toEqual([]);
  });

  it('validates the namespace name before any request is sent', () => {
    expect(projectNameProblem('')).toBe('empty');
    expect(projectNameProblem('  ')).toBe('empty');
    expect(projectNameProblem('a'.repeat(64))).toBe('length');
    expect(projectNameProblem('Demo')).toBe('format');
    expect(projectNameProblem('-demo')).toBe('format');
    expect(projectNameProblem('demo-')).toBe('format');
    expect(projectNameProblem('demo-1')).toBeNull();
    expect(projectNameProblem('a')).toBeNull();
  });

  it('round-trips console segments and Federated collection names', () => {
    expect(segmentOf('federateddeployments')).toBe('deployments');
    expect(pluralOf('deployments')).toBe('federateddeployments');
    expect(pluralOf('widgets')).toBeUndefined();
    // Unknown collection names stay readable instead of being dropped.
    expect(segmentOf('federatedwidgets')).toBe('federatedwidgets');
  });
});

describe('federated project requests', () => {
  it('lists the collection and filters by the template workspace label', async () => {
    const client = createClient({
      fetchImpl: (async (input) => {
        expect(String(input)).toContain(`${FEDERATED_API}/federatednamespaces`);
        return new Response(
          JSON.stringify({
            items: [
              existing,
              { metadata: { name: 'other', namespace: 'other' }, spec: { template: { metadata: { labels: { [WORKSPACE_LABEL]: 'ws-b' } } } } },
            ],
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      }) as typeof fetch,
    });
    const projects = await federatedApi(client).listProjects({ workspace: 'system-workspace' });
    expect(projects.map((project) => project.name)).toEqual(['kubesphere-monitoring-federated']);
  });

  it('creates the host namespace first, then the FederatedNamespace, and reads it back', async () => {
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];
    let created: KubeFederatedObject | null = null;
    const client = createClient({
      fetchImpl: (async (input, init) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({ url, method, body });
        if (method === 'POST' && url.includes('/workspaces/system-workspace/namespaces')) {
          return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        if (method === 'POST' && url.includes('/federatednamespaces')) {
          created = body as KubeFederatedObject;
          return new Response(JSON.stringify(body), { status: 201, headers: { 'content-type': 'application/json' } });
        }
        return new Response(JSON.stringify({ items: created ? [created] : [] }), {
          headers: { 'content-type': 'application/json' },
        });
      }) as typeof fetch,
    });

    const project = await federatedApi(client).createProject({
      workspace: 'ws-a',
      name: 'demo-project',
      alias: '演示',
      description: 'desc',
      clusters: ['host'],
      creator: 'admin',
    });

    expect(calls.map((call) => `${call.method} ${new URL(call.url).pathname}`)).toEqual([
      'POST /kapis/tenant.kubesphere.io/v1alpha2/workspaces/ws-a/namespaces',
      'POST /apis/types.kubefed.io/v1beta1/namespaces/demo-project/federatednamespaces',
      'GET /apis/types.kubefed.io/v1beta1/federatednamespaces',
    ]);

    const namespaceBody = calls[0]!.body as { metadata: { labels: Record<string, string> } };
    expect(namespaceBody.metadata.labels).toEqual({ [WORKSPACE_LABEL]: 'ws-a', 'kubefed.io/managed': 'true' });

    const federatedBody = calls[1]!.body as KubeFederatedObject;
    expect(federatedBody.metadata?.labels).toEqual({ [WORKSPACE_LABEL]: 'ws-a' });
    expect(federatedBody.metadata?.annotations).toEqual({
      'kubesphere.io/creator': 'admin',
      'kubesphere.io/alias-name': '演示',
      'kubesphere.io/description': 'desc',
    });
    // The template carries labels only: KubeFed rejects template annotations on a
    // FederatedNamespace ("AnnotationsNotSupported").
    expect(federatedBody.spec?.template?.metadata?.annotations).toBeUndefined();
    expect(federatedBody.spec?.placement?.clusters).toEqual([{ name: 'host' }]);
    expect(federatedBody.spec?.overrides).toEqual([
      { clusterName: 'host', clusterOverrides: [{ path: '/metadata/annotations', value: federatedBody.metadata?.annotations }] },
    ]);
    expect(project.name).toBe('demo-project');
  });

  it('deletes the namespace again when the FederatedNamespace write fails', async () => {
    const calls: string[] = [];
    const client = createClient({
      fetchImpl: (async (input, init) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        calls.push(`${method} ${new URL(url).pathname}`);
        if (method === 'POST' && url.includes('/workspaces/')) return new Response('{}', { status: 200 });
        if (method === 'POST') return new Response(JSON.stringify({ message: 'admission rejected' }), { status: 422 });
        return new Response('{}', { status: 200 });
      }) as typeof fetch,
    });

    await expect(
      federatedApi(client).createProject({ workspace: 'ws-a', name: 'broken', clusters: ['host'] }),
    ).rejects.toThrow('admission rejected');
    expect(calls).toEqual([
      'POST /kapis/tenant.kubesphere.io/v1alpha2/workspaces/ws-a/namespaces',
      'POST /apis/types.kubefed.io/v1beta1/namespaces/broken/federatednamespaces',
      'DELETE /api/v1/namespaces/broken',
    ]);
  });

  it('edits annotations without dropping placement or unknown annotations', async () => {
    let putBody: KubeFederatedObject | null = null;
    const stored: KubeFederatedObject = {
      metadata: {
        name: 'demo',
        namespace: 'demo',
        annotations: { 'kubesphere.io/creator': 'admin', 'kubesphere.io/alias-name': 'old', 'example.com/keep': 'yes' },
        resourceVersion: '42',
      },
      spec: {
        placement: { clusters: [{ name: 'host' }] },
        template: { metadata: { labels: { [WORKSPACE_LABEL]: 'ws-a' } } },
        overrides: [{ clusterName: 'host', clusterOverrides: [{ path: '/metadata/annotations', value: { 'kubesphere.io/alias-name': 'old' } }] }],
      },
    };
    const client = createClient({
      fetchImpl: (async (input, init) => {
        const url = String(input);
        if ((init?.method ?? 'GET') === 'PUT') {
          putBody = JSON.parse(String(init?.body)) as KubeFederatedObject;
          return new Response(JSON.stringify(putBody), { headers: { 'content-type': 'application/json' } });
        }
        expect(url).toContain('/federatednamespaces');
        return new Response(JSON.stringify({ items: [putBody ?? stored] }), { headers: { 'content-type': 'application/json' } });
      }) as typeof fetch,
    });

    await federatedApi(client).updateProjectInfo({ name: 'demo', alias: 'new', description: 'explained' });

    const body = putBody as unknown as KubeFederatedObject;
    expect(body.metadata?.annotations).toEqual({
      'kubesphere.io/creator': 'admin',
      'kubesphere.io/alias-name': 'new',
      'example.com/keep': 'yes',
      'kubesphere.io/description': 'explained',
    });
    expect(body.spec?.placement?.clusters).toEqual([{ name: 'host' }]);
    const override = body.spec?.overrides?.[0]?.clusterOverrides?.[0];
    expect(override?.path).toBe('/metadata/annotations');
    expect((override?.value as Record<string, string>)['kubesphere.io/alias-name']).toBe('new');
  });

  it('replaces placement and keeps the override list in step with it', async () => {
    let putBody: KubeFederatedObject | null = null;
    const stored: KubeFederatedObject = {
      metadata: { name: 'demo', namespace: 'demo', annotations: { 'kubesphere.io/creator': 'admin' } },
      spec: {
        placement: { clusters: [{ name: 'host' }] },
        template: { metadata: { labels: { [WORKSPACE_LABEL]: 'ws-a' } } },
        overrides: [{ clusterName: 'host', clusterOverrides: [{ path: '/metadata/annotations', value: {} }] }],
      },
    };
    const client = createClient({
      fetchImpl: (async (_input, init) => {
        if ((init?.method ?? 'GET') === 'PUT') {
          putBody = JSON.parse(String(init?.body)) as KubeFederatedObject;
          return new Response(JSON.stringify(putBody), { headers: { 'content-type': 'application/json' } });
        }
        return new Response(JSON.stringify({ items: [putBody ?? stored] }), { headers: { 'content-type': 'application/json' } });
      }) as typeof fetch,
    });

    await federatedApi(client).updateProjectPlacement({ name: 'demo', clusters: ['host', 'member-1', 'member-1'] });

    const body = putBody as unknown as KubeFederatedObject;
    expect(body.spec?.placement?.clusters).toEqual([{ name: 'host' }, { name: 'member-1' }]);
    expect(body.spec?.overrides?.map((override) => override.clusterName)).toEqual(['host', 'member-1']);
    // The placement change itself must not silently drop the project annotations.
    expect((body.spec?.overrides?.[1]?.clusterOverrides?.[0]?.value as Record<string, string>)['kubesphere.io/creator']).toBe('admin');
  });

  it('reports which names failed in a batch delete instead of stopping at the first', async () => {
    const deleted: string[] = [];
    const client = createClient({
      fetchImpl: (async (input, init) => {
        const name = String(input).split('/').pop() ?? '';
        if ((init?.method ?? 'GET') === 'DELETE') {
          deleted.push(name);
          return name === 'second' ? new Response(JSON.stringify({ message: 'forbidden' }), { status: 403 }) : new Response('{}', { status: 200 });
        }
        return new Response('{}', { status: 200 });
      }) as typeof fetch,
    });

    const result = await federatedApi(client).deleteProjects({ names: ['first', 'second', 'third'] });
    expect(deleted).toEqual(['first', 'second', 'third']);
    expect(result.failed.map((entry) => entry.name)).toEqual(['second']);
  });
});
