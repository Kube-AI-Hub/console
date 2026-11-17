import { describe, expect, it } from 'vitest';
import { createClient } from '../src/client';
import { persistentVolumesApi } from '../src/storage';

/**
 * Persistent-volume write paths.
 *
 * Edit-info is a merge patch whose removed annotations must be sent as `null`: omitting
 * them leaves the old value, which looks like "clearing the alias did nothing". Delete is
 * sequential so the page can report a per-name outcome.
 */
function recordingClient(handler: (method: string, url: string, body: unknown) => unknown) {
  const calls: Array<{ method: string; url: string; body: unknown }> = [];
  const client = createClient({
    baseUrl: 'http://apiserver',
    fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      calls.push({ method, url: String(input), body });
      const payload = handler(method, String(input), body);
      return new Response(JSON.stringify(payload ?? {}), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch,
  });
  return { client, calls };
}

const volume = (annotations: Record<string, string>) => ({
  apiVersion: 'v1',
  kind: 'PersistentVolume',
  metadata: { name: 'pv-demo', resourceVersion: '42', annotations },
  spec: {
    capacity: { storage: '1Gi' },
    accessModes: ['ReadWriteOnce'],
    persistentVolumeReclaimPolicy: 'Retain',
    storageClassName: 'local',
  },
  status: { phase: 'Available' },
});

describe('persistentVolumesApi.updateInfo', () => {
  it('sends null for removed annotations and only the changed values', async () => {
    const { client, calls } = recordingClient((method) => (method === 'GET' ? volume({ 'kubesphere.io/alias-name': '旧别名', 'kubesphere.io/creator': 'admin' }) : {}));
    await persistentVolumesApi(client).updateInfo({
      name: 'pv-demo',
      // The dialog submits the full merged map; creator is kept, alias is gone.
      annotations: { 'kubesphere.io/creator': 'admin', 'kubesphere.io/description': '新说明' },
    });
    const patch = calls.find((call) => call.method === 'PATCH');
    expect(patch?.url).toContain('/api/v1/persistentvolumes/pv-demo');
    expect(patch?.body).toEqual({
      metadata: {
        annotations: {
          'kubesphere.io/alias-name': null,
          'kubesphere.io/description': '新说明',
          // Unchanged annotations are not repeated in the patch.
        },
      },
    });
    // The creator annotation survived: only keys the caller omitted by intent were nulled;
    // creator was not shown by the dialog, so it is in neither side of the diff.
  });

  it('does not write when the annotations are unchanged', async () => {
    const annotations = { 'kubesphere.io/alias-name': '演示' };
    const { client, calls } = recordingClient((method) => (method === 'GET' ? volume(annotations) : {}));
    await persistentVolumesApi(client).updateInfo({ name: 'pv-demo', annotations });
    expect(calls.filter((call) => call.method === 'PATCH')).toHaveLength(0);
  });
});

describe('persistentVolumesApi.remove', () => {
  it('deletes every name sequentially', async () => {
    const { client, calls } = recordingClient(() => ({}));
    await persistentVolumesApi(client).remove({ names: ['pv-a', 'pv-b'] });
    const deletes = calls.filter((call) => call.method === 'DELETE').map((call) => call.url);
    expect(deletes).toHaveLength(2);
    expect(deletes[0]).toContain('/api/v1/persistentvolumes/pv-a');
    expect(deletes[1]).toContain('/api/v1/persistentvolumes/pv-b');
  });
});
