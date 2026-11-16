import { describe, expect, it } from 'vitest';
import { createClient } from '../src/client';
import {
  devopsCollectionsApi,
  devopsProjectNamespace,
  isRunOfPipeline,
  pipelineRunStatusOf,
  toCdApplicationSummary,
  toCodeRepositorySummary,
  toPipelineDetail,
  toPipelineRunSummary,
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
    // `clusters/<id>` goes before the group, not after the version: the other placement 404s on a
    // real member cluster (measured on A100's `xc`). See `clusterScoped`.
    expect(new URL(calls[0] ?? '').pathname).toBe(
      '/apis/clusters/member/devops.kubesphere.io/v1alpha3/namespaces/devops-beta/pipelines',
    );
  });
});


describe('pipeline detail and runs', () => {
  it('maps a pipeline detail from the same object the list reads', () => {
    const detail = toPipelineDetail({
      metadata: {
        name: 'build',
        creationTimestamp: '2026-11-15T00:00:00Z',
        annotations: { 'pipeline.devops.kubesphere.io/syncstatus': 'successful', 'kubesphere.io/description': 'build the app' },
      },
      spec: { type: 'pipeline' },
    });
    expect(detail).toMatchObject({ name: 'build', type: 'pipeline', syncStatus: 'successful', description: 'build the app' });
  });

  it('derives run status from the Jenkins annotation and falls back to the object name', () => {
    const run = toPipelineRunSummary({
      metadata: {
        name: 'build-run-1',
        annotations: {
          'devops.kubesphere.io/jenkins-pipelinerun-status': JSON.stringify({
            id: '42',
            state: 'FINISHED',
            result: 'SUCCESS',
            startTime: '2026-11-15T01:00:00Z',
            durationInMillis: 125000,
            commitId: 'abcdef1234',
          }),
        },
      },
      spec: { pipelineRef: { name: 'build' }, scm: { refName: 'main' } },
    });
    expect(run).toMatchObject({
      runId: '42',
      state: 'FINISHED',
      result: 'SUCCESS',
      status: 'success',
      startTime: '2026-11-15T01:00:00Z',
      durationMillis: 125000,
      commitId: 'abcdef1234',
      branch: 'main',
    });
    const bare = toPipelineRunSummary({ metadata: { name: 'build-run-2' } });
    expect(bare.runId).toBe('build-run-2');
    expect(bare.status).toBe('notRunning');
  });

  it('maps every Jenkins state/result pair to one badge state', () => {
    expect(pipelineRunStatusOf('QUEUED', '')).toBe('queued');
    expect(pipelineRunStatusOf('RUNNING', '')).toBe('running');
    expect(pipelineRunStatusOf('FINISHED', 'FAILURE')).toBe('failure');
    expect(pipelineRunStatusOf('FINISHED', 'ABORTED')).toBe('aborted');
    expect(pipelineRunStatusOf('FINISHED', 'UNSTABLE')).toBe('unstable');
    expect(pipelineRunStatusOf('PAUSED', '')).toBe('paused');
    expect(pipelineRunStatusOf('', '')).toBe('notRunning');
  });

  it('matches a run by its label or by spec.pipelineRef', () => {
    expect(isRunOfPipeline({ metadata: { labels: { 'devops.kubesphere.io/pipeline': 'build' } } } as never, 'build')).toBe(true);
    expect(isRunOfPipeline({ metadata: { name: 'r' }, spec: { pipelineRef: { name: 'build' } } } as never, 'build')).toBe(true);
    expect(isRunOfPipeline({ metadata: { name: 'r' }, spec: { pipelineRef: { name: 'other' } } } as never, 'build')).toBe(false);
  });

  it('reads one pipeline and filters runs, falling back when the label query is empty', async () => {
    const responses: unknown[] = [
      { metadata: { name: 'build' }, spec: { type: 'pipeline' } },
      { items: [] },
      {
        items: [
          { metadata: { name: 'run-a', labels: { 'devops.kubesphere.io/pipeline': 'build' } } },
          { metadata: { name: 'run-b' }, spec: { pipelineRef: { name: 'build' } } },
          { metadata: { name: 'run-c' }, spec: { pipelineRef: { name: 'other' } } },
        ],
      },
    ];
    const calls: string[] = [];
    const client = createClient({
      fetchImpl: (async (input: RequestInfo | URL) => {
        calls.push(String(input));
        return new Response(JSON.stringify(responses.shift() ?? {}), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }) as typeof fetch,
    });
    const api = devopsCollectionsApi(client);
    const detail = await api.pipeline({ cluster: 'host', namespace: 'devops-alpha', name: 'build' });
    expect(detail.name).toBe('build');
    expect(new URL(calls[0] ?? '').pathname).toBe(
      '/apis/devops.kubesphere.io/v1alpha3/namespaces/devops-alpha/pipelines/build',
    );

    const runs = await api.pipelineRuns({ cluster: 'host', namespace: 'devops-alpha', pipeline: 'build' });
    const firstRunUrl = new URL(calls[1] ?? '');
    expect(firstRunUrl.searchParams.get('labelSelector')).toBe('devops.kubesphere.io/pipeline=build');
    const fallbackUrl = new URL(calls[2] ?? '');
    expect(fallbackUrl.searchParams.get('labelSelector')).toBeNull();
    expect(runs.map((run) => run.name)).toEqual(['run-a', 'run-b']);
  });
});
