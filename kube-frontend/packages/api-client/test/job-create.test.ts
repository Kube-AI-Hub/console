import { describe, expect, it } from 'vitest';
import { createClient } from '../src/client';
import { workloadsApi } from '../src/workloads';

describe('batch creation', () => {
  it.each(['jobs', 'cronjobs'] as const)('creates %s at the batch collection', async (kind) => {
    let url = '';
    let method = '';
    const client = createClient({ fetchImpl: (async (input, init) => {
      url = String(input); method = init?.method ?? '';
      return new Response(String(init?.body), { headers: { 'content-type': 'application/json' } });
    }) as typeof fetch });
    await workloadsApi(client, kind).createManifest({ cluster: 'host', namespace: 'default',
      body: { apiVersion: 'batch/v1', kind: kind === 'jobs' ? 'Job' : 'CronJob', metadata: { name: 'batch-test', namespace: 'default' }, spec: {} } });
    expect(method).toBe('POST');
    expect(url).toContain(`/apis/batch/v1/namespaces/default/${kind}`);
    expect(url).not.toContain('/batch-test');
  });
});
