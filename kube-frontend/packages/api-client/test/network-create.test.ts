import { describe, expect, it } from 'vitest';
import { createClient } from '../src/client';
import { workloadsApi } from '../src/workloads';

describe('network resource creation', () => {
  it.each(['services', 'ingresses'] as const)('POSTs %s to its native collection and preserves extra fields', async (kind) => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const client = createClient({ fetchImpl: (async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(String(init?.body), { headers: { 'content-type': 'application/json' } });
    }) as typeof fetch });
    const body = { apiVersion: kind === 'services' ? 'v1' : 'networking.k8s.io/v1',
      kind: kind === 'services' ? 'Service' : 'Ingress', metadata: { name: 'test', namespace: 'default', annotations: { owner: 'user' } },
      spec: { ports: [{ port: 80 }, { port: 443 }] } };
    await workloadsApi(client, kind).createManifest({ cluster: 'host', namespace: 'default', body });
    expect(calls[0]!.init?.method).toBe('POST');
    expect(calls[0]!.url).toContain(kind === 'services' ? '/api/v1/namespaces/default/services' : '/apis/networking.k8s.io/v1/namespaces/default/ingresses');
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual(body);
  });
  it('rejects mismatched types or namespaces before issuing a request', async () => {
    let calls = 0;
    const client = createClient({ fetchImpl: (async () => { calls++; return new Response('{}'); }) as typeof fetch });
    await expect(workloadsApi(client, 'services').createManifest({
      cluster: 'host', namespace: 'default', body: { apiVersion: 'apps/v1', kind: 'Deployment', metadata: { name: 'bad', namespace: 'default' } },
    })).rejects.toThrow('Manifest kind');
    await expect(workloadsApi(client, 'ingresses').createManifest({
      cluster: 'host', namespace: 'default', body: { apiVersion: 'networking.k8s.io/v1', kind: 'Ingress', metadata: { name: 'bad', namespace: 'other' } },
    })).rejects.toThrow('target namespace');
    expect(calls).toBe(0);
  });
});
