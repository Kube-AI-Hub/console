import { describe, expect, it } from 'vitest';
import { cronJobJobLabels, cronJobRunsApi, toCronJobRun } from '../src/cronjobs';
import type { Client } from '../src/client';

/**
 * CronJob run history.
 *
 * The cases use Jobs that differ in every field the table shows — a completed run with a
 * duration, a failed run whose end time comes from the condition, a running one with no end —
 * so a mapper that drops one of them fails here instead of passing on a single sample.
 */

function job(overrides: Record<string, unknown> = {}) {
  return {
    metadata: {
      name: 'nightly-29000000',
      namespace: 'default',
      creationTimestamp: '2026-11-18T01:00:00Z',
      ...(overrides['metadata'] as Record<string, unknown> | undefined),
    },
    spec: {
      template: {
        spec: {
          containers: [{ name: 'main', resources: { requests: { cpu: '100m', memory: '128Mi' }, limits: { cpu: '1' } } }],
        },
      },
    },
    // A status override replaces the whole block: spreading it over the default would keep
    // `completionTime` and quietly make a "failed" run look completed.
    status: (overrides['status'] as Record<string, unknown> | undefined) ?? {
      startTime: '2026-11-18T01:00:01Z',
      completionTime: '2026-11-18T01:02:01Z',
      succeeded: 1,
      conditions: [{ type: 'Complete', status: 'True' }],
    },
  };
}

describe('toCronJobRun', () => {
  it('reads a completed run: outcome, duration, counts and template resources', () => {
    const run = toCronJobRun(job() as never);
    expect(run.outcome).toBe('completed');
    expect(run.durationSeconds).toBe(120);
    expect(run.succeeded).toBe(1);
    expect(run.requests).toEqual([
      { resource: 'cpu', value: '0.1' },
      { resource: 'memory', value: '128Mi' },
    ]);
    expect(run.limits).toEqual([{ resource: 'cpu', value: '1' }]);
  });

  it('takes the end time from the failed condition when there is no completionTime', () => {
    const run = toCronJobRun(
      job({
        status: {
          startTime: '2026-11-18T01:00:01Z',
          succeeded: 0,
          failed: 1,
          conditions: [{ type: 'Failed', status: 'True', lastProbeTime: '2026-11-18T01:00:31Z' }],
        },
      }) as never,
    );
    expect(run.outcome).toBe('failed');
    expect(run.endTime).toBe('2026-11-18T01:00:31Z');
    expect(run.durationSeconds).toBe(30);
  });

  it('reports a Job without a terminal condition as running, with no duration', () => {
    const run = toCronJobRun(
      job({ status: { startTime: '2026-11-18T01:00:01Z', active: 1, succeeded: 0, conditions: [] } }) as never,
    );
    expect(run.outcome).toBe('running');
    expect(run.endTime).toBe('');
    expect(run.durationSeconds).toBeUndefined();
    expect(run.active).toBe(1);
  });

  it('reads the jobTemplate labels a CronJob stamps on its Jobs', () => {
    expect(
      cronJobJobLabels({
        spec: { jobTemplate: { metadata: { labels: { 'cronjob-name': 'nightly', app: 'nightly' } } } },
      } as never),
    ).toEqual({ 'cronjob-name': 'nightly', app: 'nightly' });
    expect(cronJobJobLabels({ spec: {} } as never)).toEqual({});
  });
});

describe('cronJobRunsApi.list', () => {
  it('filters by the template labels server-side and keeps only Jobs owned by this CronJob', async () => {
    const requests: Array<{ path: string; query?: Record<string, unknown> }> = [];
    const client = {
      request: async (path: string, init?: { query?: Record<string, unknown> }) => {
        requests.push({ path, ...(init?.query ? { query: init.query } : {}) });
        return {
          items: [
            {
              metadata: {
                name: 'owned-by-us',
                creationTimestamp: '2026-11-18T02:00:00Z',
                ownerReferences: [{ kind: 'CronJob', name: 'nightly' }],
              },
              spec: { template: { spec: { containers: [{ name: 'main' }] } } },
              status: { startTime: '2026-11-18T02:00:00Z', succeeded: 1, conditions: [{ type: 'Complete', status: 'True' }] },
            },
            {
              // Same template labels, different owner: must not appear in this history.
              metadata: {
                name: 'owned-by-other',
                creationTimestamp: '2026-11-18T03:00:00Z',
                ownerReferences: [{ kind: 'CronJob', name: 'other' }],
              },
              spec: { template: { spec: { containers: [{ name: 'main' }] } } },
              status: { startTime: '2026-11-18T03:00:00Z', succeeded: 1, conditions: [{ type: 'Complete', status: 'True' }] },
            },
            {
              // No ownerReferences at all: kept, because the label filter is all we have.
              metadata: { name: 'unowned', creationTimestamp: '2026-11-18T04:00:00Z' },
              spec: { template: { spec: { containers: [{ name: 'main' }] } } },
              status: { startTime: '2026-11-18T04:00:00Z', succeeded: 1, conditions: [{ type: 'Complete', status: 'True' }] },
            },
          ],
          totalItems: 3,
        };
      },
    } as unknown as Client;

    const runs = await cronJobRunsApi(client).list({
      cluster: 'host',
      namespace: 'default',
      cronJob: 'nightly',
      labels: { 'cronjob-name': 'nightly', app: 'nightly' },
    });

    expect(runs.map((run) => run.name)).toEqual(['unowned', 'owned-by-us']);
    expect(requests[0]?.path).toContain('/namespaces/default/jobs');
    expect(requests[0]?.query?.['labelSelector']).toBe('cronjob-name=nightly,app=nightly');
    // -1 asks for the whole collection; the history limits keep that small.
    expect(requests[0]?.query?.['limit']).toBe(-1);
  });

  it('creates one Job from the template when asked to run now', async () => {
    const calls: Array<{ path: string; method?: string; body?: unknown }> = [];
    const client = {
      request: async (path: string, init?: { method?: string; body?: unknown }) => {
        calls.push({ path, method: init?.method, body: init?.body });
        if (init?.method === 'POST') {
          return { metadata: { name: 'nightly-manual-abc', namespace: 'default' }, spec: {}, status: {} };
        }
        return { items: [], totalItems: 0 };
      },
    } as unknown as Client;

    const name = await cronJobRunsApi(client).runNow({
      cluster: 'host',
      namespace: 'default',
      cronJob: 'nightly',
      labels: { 'cronjob-name': 'nightly' },
      template: { spec: { template: { spec: { containers: [{ name: 'main', image: 'nginx:1.27' }] } }, backoffLimit: 1 } },
    });

    expect(name).toBe('nightly-manual-abc');
    const post = calls.find((call) => call.method === 'POST');
    expect(post?.path).toContain('/namespaces/default/jobs');
    const body = post?.body as { kind: string; metadata: { labels: Record<string, string>; annotations: Record<string, string> } };
    expect(body.kind).toBe('Job');
    expect(body.metadata.labels).toEqual({ 'cronjob-name': 'nightly' });
    expect(body.metadata.annotations['cronjob.kubernetes.io/instantiate']).toBe('manual');
  });
});
