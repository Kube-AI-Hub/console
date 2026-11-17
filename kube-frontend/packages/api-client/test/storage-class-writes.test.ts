import { describe, expect, it } from 'vitest';
import { createClient } from '../src/client';
import { storageClassesApi } from '../src/storage';

/**
 * Storage-class writes.
 *
 * The class is referenced by every future claim, so the operations are pinned:
 *  - create writes capabilities as the annotations/spec the reader displays;
 *  - edit-info sends null for removed annotations (omitting leaves the old value);
 *  - set-default clears the previous defaults first, otherwise two badges appear;
 *  - features-off removes the fields instead of writing "false" into spec.
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

const klass = (name: string, annotations: Record<string, string>) => ({
  apiVersion: 'storage.k8s.io/v1',
  kind: 'StorageClass',
  metadata: { name, resourceVersion: '7', annotations },
  provisioner: 'example.com/csi',
  reclaimPolicy: 'Delete',
  volumeBindingMode: 'Immediate',
});

describe('storageClassesApi.create', () => {
  it('writes the native group and only the enabled capabilities', async () => {
    const { client, calls } = recordingClient(() => klass('fast', {}));
    await storageClassesApi(client).create({
      cluster: 'host',
      name: 'fast',
      provisioner: 'example.com/csi',
      reclaimPolicy: 'Retain',
      volumeBindingMode: 'WaitForFirstConsumer',
      allowVolumeExpansion: true,
      allowCloning: false,
      allowSnapshot: true,
    });
    const post = calls.find((call) => call.method === 'POST');
    expect(post?.url).toContain('/apis/storage.k8s.io/v1/storageclasses');
    expect(post?.body).toMatchObject({
      metadata: { name: 'fast', annotations: { 'storageclass.kubesphere.io/allow-snapshot': 'true' } },
      provisioner: 'example.com/csi',
      reclaimPolicy: 'Retain',
      volumeBindingMode: 'WaitForFirstConsumer',
      allowVolumeExpansion: true,
    });
    // Disabled clone capability is absent, not "false".
    const annotations = ((post?.body as { metadata?: { annotations?: Record<string, string> } }).metadata?.annotations ?? {});
    expect(annotations['storageclass.kubesphere.io/allow-clone']).toBeUndefined();
  });

  it('uses the member-cluster segment when a cluster is given', async () => {
    const { client, calls } = recordingClient(() => klass('fast', {}));
    await storageClassesApi(client).create({
      cluster: 'xc',
      name: 'fast',
      provisioner: 'p',
      reclaimPolicy: 'Delete',
      volumeBindingMode: 'Immediate',
      allowVolumeExpansion: false,
      allowCloning: false,
      allowSnapshot: false,
    });
    expect(calls.find((call) => call.method === 'POST')?.url).toContain('/apis/clusters/xc/storage.k8s.io/v1/storageclasses');
  });
});

describe('storageClassesApi.updateInfo', () => {
  it('sends null for the annotations the dialog removed', async () => {
    const { client, calls } = recordingClient((method) =>
      method === 'GET' ? klass('fast', { 'kubesphere.io/alias-name': '旧', 'kubesphere.io/creator': 'admin' }) : {},
    );
    await storageClassesApi(client).updateInfo({
      cluster: 'host',
      name: 'fast',
      annotations: { 'kubesphere.io/creator': 'admin', 'kubesphere.io/description': '新' },
    });
    expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({
      metadata: {
        annotations: { 'kubesphere.io/alias-name': null, 'kubesphere.io/description': '新' },
      },
    });
  });
});

describe('storageClassesApi.setDefault', () => {
  it('clears the previous default before setting the new one', async () => {
    const { client, calls } = recordingClient((method, _url) => {
      if (method === 'GET') {
        return {
          items: [
            klass('old', { 'storageclass.kubernetes.io/is-default-class': 'true' }),
            klass('other', {}),
            klass('new', {}),
          ],
        };
      }
      return {};
    });
    await storageClassesApi(client).setDefault({ cluster: 'host', name: 'new' });
    const patches = calls.filter((call) => call.method === 'PATCH');
    expect(patches).toHaveLength(2);
    expect(patches[0]?.url).toContain('/storageclasses/old');
    expect((patches[0]?.body as { metadata?: { annotations?: Record<string, string | null> } }).metadata?.annotations?.['storageclass.kubernetes.io/is-default-class']).toBeNull();
    expect(patches[1]?.url).toContain('/storageclasses/new');
    expect((patches[1]?.body as { metadata?: { annotations?: Record<string, string> } }).metadata?.annotations?.['storageclass.kubernetes.io/is-default-class']).toBe('true');
  });
});

describe('storageClassesApi.setFeatures', () => {
  it('removes disabled fields instead of writing false into spec', async () => {
    const { client, calls } = recordingClient(() => ({}));
    await storageClassesApi(client).setFeatures({
      cluster: 'host',
      name: 'fast',
      allowExpansion: false,
      allowCloning: true,
      allowSnapshot: false,
    });
    expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({
      metadata: {
        annotations: {
          'storageclass.kubesphere.io/allow-clone': 'true',
          'storageclass.kubesphere.io/allow-snapshot': null,
        },
      },
      allowVolumeExpansion: null,
    });
  });
});

describe('storageClassesApi.remove', () => {
  it('deletes every name sequentially', async () => {
    const { client, calls } = recordingClient(() => ({}));
    await storageClassesApi(client).remove({ cluster: 'host', names: ['a', 'b'] });
    expect(calls.filter((call) => call.method === 'DELETE').map((call) => call.url)).toEqual([
      expect.stringContaining('/storageclasses/a'),
      expect.stringContaining('/storageclasses/b'),
    ]);
  });
});
