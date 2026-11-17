import { describe, expect, it } from 'vitest';
import { createClient } from '../src/client';
import { devopsApi } from '../src/devops';

/**
 * Workspace-scoped DevOps project reads.
 *
 * The workspace aggregate (`/kapis/devops.../workspaces/<ws>/devops`) filters by workspace
 * server-side, so a workspace page must use it rather than filtering the raw cluster-wide
 * CRD list. On a member cluster the cluster segment goes right after `/kapis`; the old
 * console's workspace DevOps page selected a cluster for the same reason.
 */
function recordingClient(items: unknown[]) {
  const calls: string[] = [];
  const client = createClient({
    baseUrl: 'http://apiserver',
    fetchImpl: (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ items }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch,
  });
  return { client, calls };
}

const project = {
  apiVersion: 'devops.kubesphere.io/v1alpha3',
  kind: 'DevOpsProject',
  metadata: {
    name: 'demo',
    creationTimestamp: '2026-01-02T03:04:05Z',
    labels: { 'kubesphere.io/workspace': 'system-workspace' },
    annotations: { 'kubesphere.io/alias-name': '演示', 'kubesphere.io/description': '说明' },
  },
  status: { adminNamespace: 'demo' },
};

describe('devopsApi.projects', () => {
  it('reads the workspace aggregate on the host cluster', async () => {
    const { client, calls } = recordingClient([project]);
    const rows = await devopsApi(client).projects({ workspace: 'system-workspace' });
    expect(calls[0]).toContain('/kapis/devops.kubesphere.io/v1alpha3/workspaces/system-workspace/devops');
    expect(calls[0]).not.toContain('/clusters/host/');
    expect(calls[0]).toContain('limit=-1');
    expect(rows[0]?.name).toBe('demo');
    expect(rows[0]?.workspace).toBe('system-workspace');
    expect(rows[0]?.alias).toBe('演示');
  });

  it('reads a member cluster through the cluster-scoped kapis path', async () => {
    const { client, calls } = recordingClient([project]);
    await devopsApi(client).projects({ workspace: 'system-workspace', cluster: '4paradigm' });
    expect(calls[0]).toContain(
      '/kapis/clusters/4paradigm/devops.kubesphere.io/v1alpha3/workspaces/system-workspace/devops',
    );
  });
});
