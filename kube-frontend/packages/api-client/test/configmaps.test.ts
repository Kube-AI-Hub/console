import { describe, expect, it } from 'vitest';
import { createClient } from '../src/client';
import { configMapsApi } from '../src/configmaps';

/**
 * Which door each operation uses.
 *
 * Reads go through kapis (`/kapis/resources.kubesphere.io/v1alpha3`), writes
 * through the plain kube API (`/api/v1`). This is not a preference: the kapis
 * resources endpoint registers GET only and answers 405 to POST/PUT/PATCH/DELETE,
 * so a write sent to kapis fails outright. Confirmed against the live cluster, and
 * it is easy to "tidy up" into a single builder — hence this test.
 */

function recordingClient() {
  const calls: Array<{ url: string; method: string }> = [];
  const client = createClient({
    fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      calls.push({ url, method });
      // Enough of an object for the mappers to run.
      const body =
        method === 'GET' && !url.match(/\/configmaps\/[^/]+$/)
          ? { items: [], totalItems: 0 }
          : { metadata: { name: 'x', namespace: 'ns', resourceVersion: '1' }, data: {} };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch,
  });
  return { api: configMapsApi(client), calls };
}

describe('ConfigMaps transport', () => {
  it('reads through kapis', async () => {
    const { api, calls } = recordingClient();
    await api.list({ cluster: 'host', namespace: 'ns', page: 1, pageSize: 10 });
    await api.get({ cluster: 'host', namespace: 'ns', name: 'x' });

    expect(calls[0]?.url).toContain('/kapis/resources.kubesphere.io/v1alpha3/namespaces/ns/configmaps');
    expect(calls[0]?.method).toBe('GET');
    expect(calls[1]?.url).toContain('/kapis/resources.kubesphere.io/v1alpha3/namespaces/ns/configmaps/x');
  });

  it('writes through /api/v1', async () => {
    const { api, calls } = recordingClient();

    await api.create({ name: 'x', namespace: 'ns', data: {} }, 'host');
    expect(calls[0]?.url).toContain('/api/v1/namespaces/ns/configmaps');
    expect(calls[0]?.method).toBe('POST');

    calls.length = 0;
    await api.remove({ cluster: 'host', namespace: 'ns', names: ['x'] });
    expect(calls[0]?.url).toContain('/api/v1/namespaces/ns/configmaps/x');
    expect(calls[0]?.method).toBe('DELETE');
  });

  it('re-reads the resourceVersion from kapis before writing', async () => {
    const { api, calls } = recordingClient();
    await api.update({ cluster: 'host', namespace: 'ns', body: { metadata: { name: 'x', namespace: 'ns' } } });

    // Read first (kapis), then write (api/v1), carrying the fresh version.
    expect(calls[0]?.method).toBe('GET');
    expect(calls[0]?.url).toContain('/kapis/');
    expect(calls[1]?.method).toBe('PUT');
    expect(calls[1]?.url).toContain('/api/v1/');
  });

  it('lists across every project when no namespace is given', async () => {
    const { api, calls } = recordingClient();
    await api.list({ cluster: 'host', namespace: '', page: 1, pageSize: 10 });

    expect(calls[0]?.url).toContain('/kapis/resources.kubesphere.io/v1alpha3/configmaps');
    expect(calls[0]?.url).not.toContain('/namespaces/');
  });
});
