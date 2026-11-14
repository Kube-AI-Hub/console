import { describe, expect, it } from 'vitest';
import { createClient } from '../src/client';
import {
  devopsCollectionsApi,
  devopsProjectNamespace,
  toCdApplicationSummary,
  toCodeRepositorySummary,
  toPipelineSummary,
} from '../src/devops';

/**
 * DevOps project sub-collections.
 *
 * Probed 2026-11-15: pipelines and gitrepositories live in the devops group, continuous
 * deployment lives in the gitops group as `Application` (`spec.argoApp`/`status.argoApp`).
 * The namespace comes from the project's `status.adminNamespace`; there is no live
 * project on the cluster, so the fallbacks are what these tests pin.
 */

function recordingClient(items: unknown[]) {
  const calls: string[] = [];
  const client = createClient({
    fetchImpl: (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ items }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch,
  });
  return { client, calls };
}

describe('devopsProjectNamespace', () => {
  it('uses status.adminNamespace and falls back to the project name', () => {
    expect(devopsProjectNamespace({ status: { adminNamespace: 'devops-alpha' } }, 'alpha')).toBe('devops-alpha');
    // The controller may not have written the field yet: the name is the old console's
    // assumption and keeps the tabs readable.
    expect(devopsProjectNamespace({}, 'alpha')).toBe('alpha');
    expect(devopsProjectNamespace(undefined, 'alpha')).toBe('alpha');
    expect(devopsProjectNamespace({ status: { adminNamespace: '  ' } }, 'alpha')).toBe('alpha');
  });
});

describe('summary mappings', () => {
  it('maps a pipeline type and Jenkins sync annotation', () => {
    const summary = toPipelineSummary({
      metadata: {
        name: 'build',
        creationTimestamp: '2026-11-15T00:00:00Z',
        annotations: { 'pipeline.devops.kubesphere.io/syncstatus': 'success' },
      },
      spec: { type: 'multi-branch-pipeline' },
    });
    expect(summary).toMatchObject({ name: 'build', type: 'multi-branch-pipeline', syncStatus: 'success' });
  });

  it('maps a code repository provider and clone URL', () => {
    const summary = toCodeRepositorySummary({
      metadata: { name: 'repo' },
      spec: { provider: 'github', url: 'https://github.com/example/repo.git' },
    });
    expect(summary).toMatchObject({ name: 'repo', provider: 'github', url: 'https://github.com/example/repo.git' });
  });

  it('reads the wrapped Argo status out of the JSON string', () => {
    const summary = toCdApplicationSummary({
      metadata: { name: 'release' },
      spec: { argoApp: { spec: { destination: { namespace: 'demo' } } } },
      status: { argoApp: JSON.stringify({ sync: { status: 'Synced' }, health: { status: 'Healthy' } }) },
    });
    expect(summary).toMatchObject({ syncStatus: 'Synced', healthStatus: 'Healthy', destination: 'demo' });
  });

  it('treats a non-JSON status string as the sync state instead of blanking the row', () => {
    const summary = toCdApplicationSummary({
      metadata: { name: 'release' },
      spec: { argoApp: { spec: { destination: { name: 'member' } } } },
      status: { argoApp: 'OutOfSync' },
    });
    expect(summary.syncStatus).toBe('OutOfSync');
    expect(summary.healthStatus).toBe('');
    expect(summary.destination).toBe('member');
  });
});

describe('devopsCollectionsApi', () => {
  it('reads each collection from its own group and namespace', async () => {
    const { client, calls } = recordingClient([]);
    const api = devopsCollectionsApi(client);
    await api.pipelines({ cluster: 'host', namespace: 'devops-alpha' });
    await api.codeRepositories({ cluster: 'host', namespace: 'devops-alpha' });
    await api.cdApplications({ cluster: 'host', namespace: 'devops-alpha' });

    const paths = calls.map((call) => new URL(call).pathname);
    expect(paths[0]).toBe('/apis/devops.kubesphere.io/v1alpha3/namespaces/devops-alpha/pipelines');
    expect(paths[1]).toBe('/apis/devops.kubesphere.io/v1alpha3/namespaces/devops-alpha/gitrepositories');
    // CD is not in the devops group; it is the gitops Application wrapper.
    expect(paths[2]).toBe('/apis/gitops.kubesphere.io/v1alpha1/namespaces/devops-alpha/applications');
  });

  it('addresses a member cluster through the clusters segment', async () => {
    const { client, calls } = recordingClient([]);
    await devopsCollectionsApi(client).pipelines({ cluster: 'member', namespace: 'devops-beta' });
    expect(new URL(calls[0] ?? '').pathname).toBe(
      '/apis/devops.kubesphere.io/v1alpha3/clusters/member/namespaces/devops-beta/pipelines',
    );
  });
});
