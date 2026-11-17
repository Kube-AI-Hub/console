import { describe, expect, it } from 'vitest';
import { composedAppBodies, composedAppsApi, composedAppsWriteApi, validateComposedAppInput } from '../src/apps';
import { ApiError } from '../src/errors';

/**
 * Composed (CRD) apps.
 *
 * The server only returns Application objects; component counts and health are derived from
 * the selector, so the mapping is the feature. These tests pin the matching, readiness
 * aggregation and the "no components" case.
 */
function clientWith(responses: Record<string, unknown>) {
  const calls: string[] = [];
  return {
    calls,
    client: {
      request: async (url: string) => {
        calls.push(url);
        const key = Object.keys(responses).find((suffix) => url.endsWith(suffix));
        return key ? responses[key] : { items: [] };
      },
    } as never,
  };
}

const application = (name: string, selector: Record<string, string>) => ({
  metadata: { name, namespace: 'team', labels: { 'app.kubernetes.io/version': 'v2' }, creationTimestamp: '2026-01-01T00:00:00Z' },
  spec: { selector: { matchLabels: selector } },
});

const web = { name: 'web', image: 'nginx:1.27', replicas: 2, port: 8080 };
const createInput = {
  namespace: 'team',
  name: 'shop',
  description: '示例',
  version: 'v1',
  components: [web],
  cluster: 'host',
};

describe('composed app create', () => {
  it('validates names, image, replicas and port before calling the API', () => {
    expect(validateComposedAppInput(createInput)).toBeNull();
    expect(validateComposedAppInput({ ...createInput, name: 'Bad_Name' })).toBe('name');
    expect(validateComposedAppInput({ ...createInput, components: [] })).toBe('components');
    expect(validateComposedAppInput({ ...createInput, components: [{ ...web, image: ' ' }] })).toBe('image');
    expect(validateComposedAppInput({ ...createInput, components: [{ ...web, replicas: 0 }] })).toBe('replicas');
    expect(validateComposedAppInput({ ...createInput, components: [{ ...web, port: 70000 }] })).toBe('port');
    expect(
      validateComposedAppInput({ ...createInput, components: [web, { ...web }] }),
    ).toBe('componentName');
  });

  it('builds a matching Application and one Deployment/Service per component', () => {
    const { application, deployments, services } = composedAppBodies({
      ...createInput,
      components: [web, { name: 'api', image: 'api:1', replicas: 1, port: 9000 }],
    });
    expect((application.spec as Record<string, unknown>).selector).toEqual({ matchLabels: { app: 'shop' } });
    expect(deployments).toHaveLength(2);
    expect(services).toHaveLength(2);
    expect((deployments[0]?.metadata as Record<string, unknown>).name).toBe('shop-web');
    expect((services[1]?.spec as Record<string, unknown>).ports).toEqual([{ port: 9000, targetPort: 9000 }]);
    expect(((deployments[0]?.spec as Record<string, unknown>).template as { metadata: { labels: unknown } }).metadata.labels).toEqual({ app: 'shop' });
  });

  it('dry-runs all three objects, then creates them for real', async () => {
    const calls: Array<{ path: string; method: string; query?: unknown; body?: unknown }> = [];
    const client = {
      request: async (path: string, options?: { method?: string; query?: unknown; body?: unknown }) => {
        calls.push({ path, method: options?.method ?? 'GET', query: options?.query, body: options?.body });
        return { metadata: { name: String((options?.body as { metadata?: { name?: string } } | undefined)?.metadata?.name ?? 'x') } };
      },
    } as never;
    await composedAppsWriteApi(client).create(createInput);
    expect(calls).toHaveLength(6);
    expect(calls.slice(0, 3).every((call) => JSON.stringify(call.query) === JSON.stringify({ dryRun: 'All' }))).toBe(true);
    expect(calls[3]?.path).toContain('/applications');
    expect(calls[4]?.path).toContain('/deployments');
    expect(calls[5]?.path).toContain('/services');
  });

  it('rolls back created objects when a real write fails', async () => {
    const calls: string[] = [];
    let postCount = 0;
    const client = {
      request: async (path: string, options?: { method?: string; body?: unknown }) => {
        if ((options?.method ?? 'GET') === 'POST') {
          postCount += 1;
          // 3 dry-runs, then Application succeeds, Deployment fails.
          if (postCount >= 5) throw new Error('deployment exists');
          calls.push('POST ' + path);
          return { metadata: { name: (options?.body as { metadata: { name: string } }).metadata.name } };
        }
        calls.push('DELETE ' + path);
        return undefined;
      },
    } as never;
    await expect(composedAppsWriteApi(client).create(createInput)).rejects.toThrow('deployment exists');
    expect(calls.filter((call) => call.startsWith('DELETE'))).toHaveLength(1);
    expect(calls.find((call) => call.startsWith('DELETE'))).toContain('/applications/shop');
  });
});

describe('composedAppsWriteApi.updateInfo', () => {
  it('patches only changed/removed annotations', async () => {
    const calls: Array<{ method: string; body?: unknown }> = [];
    const client = {
      request: async (_path: string, options?: { method?: string; body?: unknown }) => {
        if ((options?.method ?? 'GET') === 'GET') {
          return { metadata: { annotations: { 'kubesphere.io/alias-name': '旧', 'kubesphere.io/description': '旧描述', 'kubesphere.io/creator': 'admin' } } };
        }
        calls.push({ method: options?.method ?? '', body: options?.body });
        return undefined;
      },
    } as never;
    await composedAppsWriteApi(client).updateInfo({
      namespace: 'team',
      name: 'shop',
      cluster: 'host',
      annotations: { 'kubesphere.io/alias-name': '新', 'kubesphere.io/creator': 'admin' },
    });
    expect(calls).toEqual([
      {
        method: 'PATCH',
        body: { metadata: { annotations: { 'kubesphere.io/description': null, 'kubesphere.io/alias-name': '新' } } },
      },
    ]);
  });
});

describe('composedAppsApi.remove', () => {
  it('deletes the Application by name and cluster prefix', async () => {
    const calls: string[] = [];
    const client = {
      request: async (path: string, options?: { method?: string }) => {
        calls.push((options?.method ?? 'GET') + ' ' + path);
        return undefined;
      },
    } as never;
    await composedAppsApi(client).remove({ namespace: 'team', name: 'shop', cluster: 'host' });
    await composedAppsApi(client).remove({ namespace: 'team', name: 'shop', cluster: 'member-a' });
    expect(calls).toEqual([
      'DELETE /apis/app.k8s.io/v1beta1/namespaces/team/applications/shop',
      'DELETE /apis/clusters/member-a/app.k8s.io/v1beta1/namespaces/team/applications/shop',
    ]);
  });
});

describe('composedAppsWriteApi.addRoute', () => {
  it('dry-runs, then creates an Ingress targeting the Service', async () => {
    const calls: Array<{ method?: string; query?: unknown; body?: unknown }> = [];
    const client = {
      request: async (_path: string, options?: { method?: string; query?: unknown; body?: unknown }) => {
        calls.push(options ?? {});
        return {};
      },
    } as never;
    await composedAppsWriteApi(client).addRoute({
      namespace: 'team',
      cluster: 'host',
      appName: 'shop',
      host: 'shop.example.test',
      path: '/',
      serviceName: 'shop-web',
      servicePort: 80,
    });
    expect(calls).toHaveLength(2);
    expect(calls[0]?.query).toEqual({ dryRun: 'All' });
    expect(calls[1]?.body).toMatchObject({
      kind: 'Ingress',
      metadata: { namespace: 'team', labels: { app: 'shop' } },
      spec: { rules: [{ host: 'shop.example.test', http: { paths: [{ path: '/', pathType: 'Prefix', backend: { service: { name: 'shop-web', port: { number: 80 } } } }] } }] },
    });
  });

  it('rejects an empty host before writing', async () => {
    const client = { request: async () => ({}) } as never;
    await expect(
      composedAppsWriteApi(client).addRoute({ namespace: 'team', cluster: 'host', appName: 'shop', host: ' ', path: '/', serviceName: 'shop-web', servicePort: 80 }),
    ).rejects.toThrow('invalid host');
  });
});

describe('composedAppsApi.traffic', () => {
  it('keeps the app subgraph and counts edges within it', async () => {
    const client = {
      request: async () => ({
        elements: {
          nodes: [
            { data: { id: 'a', nodeType: 'app', app: 'shop', workload: 'shop-web', namespace: 'team' } },
            { data: { id: 'b', nodeType: 'service', service: 'shop-web', namespace: 'team' } },
            { data: { id: 'c', nodeType: 'service', service: 'other', namespace: 'team' } },
          ],
          edges: [
            { data: { source: 'b', target: 'a' } },
            { data: { source: 'a', target: 'c' } },
          ],
        },
      }),
    } as never;
    const traffic = await composedAppsApi(client).traffic({ namespace: 'team', appName: 'shop', workloads: ['shop-web'], services: ['shop-web'], cluster: 'host' });
    expect(traffic.available).toBe(true);
    expect(traffic.nodes.map((node) => node.id)).toEqual(['a', 'b']);
    expect(traffic.edges).toBe(1);
  });

  it('reports the mesh module as unavailable instead of an empty graph on 404', async () => {
    const client = {
      request: async () => {
        throw new ApiError({ code: 'not_found', message: 'servicemesh not enabled' }, 404);
      },
    } as never;
    expect(await composedAppsApi(client).traffic({ namespace: 'team', appName: 'shop', workloads: [], services: [], cluster: 'host' })).toMatchObject({
      available: false,
      reason: 'servicemesh not enabled',
      nodes: [],
    });
  });
});

describe('composedAppsApi.strategies', () => {
  it('keeps strategies matching the app selector or hosts and infers the type', async () => {
    const client = {
      request: async () => ({
        items: [
          { metadata: { name: 'canary' }, spec: { selector: { matchLabels: { app: 'shop' } }, template: { spec: { hosts: ['shop-web'], http: [{ route: [{}] }] } } } },
          { metadata: { name: 'mirror' }, spec: { selector: { matchLabels: { app: 'other' } }, template: { spec: { hosts: ['shop-svc'], http: [{ mirror: {} }] } } } },
          { metadata: { name: 'unrelated' }, spec: { selector: { matchLabels: { app: 'x' } }, template: { spec: { hosts: ['x'], http: [{ match: [{}] }] } } } },
        ],
      }),
    } as never;
    const result = await composedAppsApi(client).strategies({ namespace: 'team', cluster: 'host', appName: 'shop', services: ['shop-web', 'shop-svc'] });
    expect(result.available).toBe(true);
    expect(result.strategies.map((item) => [item.name, item.type])).toEqual([
      ['canary', 'traffic'],
      ['mirror', 'mirror'],
    ]);
  });

  it('reports the mesh module as unavailable on 404', async () => {
    const client = { request: async () => { throw new ApiError({ code: 'not_found', message: 'servicemesh not enabled' }, 404); } } as never;
    expect(await composedAppsApi(client).strategies({ namespace: 'team', cluster: 'host', appName: 'shop', services: [] })).toMatchObject({
      available: false,
      reason: 'servicemesh not enabled',
      strategies: [],
    });
  });
});

describe('composedAppsApi.tracing', () => {
  it('lists traces per service with span counts and duration', async () => {
    const client = {
      request: async (url: string) => {
        if (url.includes('/services/')) {
          return {
            data: [
              {
                traceID: 'aa',
                spans: [
                  { spanID: 's1', operationName: 'GET /', processID: 'p1', startTime: 1000000, duration: 5000 },
                  { spanID: 's2', operationName: 'query', processID: 'p1', startTime: 1002000, duration: 1000 },
                ],
                processes: { p1: { serviceName: 'shop-web' } },
              },
            ],
          };
        }
        return { data: [] };
      },
    } as never;
    const result = await composedAppsApi(client).tracing({ namespace: 'team', cluster: 'host', services: ['shop-web'] });
    expect(result).toEqual({
      available: true,
      traces: [
        {
          traceId: 'aa',
          service: 'shop-web',
          spanCount: 2,
          durationMs: 5,
          spans: [
            { spanId: 's1', operationName: 'GET /', service: 'shop-web', startOffsetMs: 0, durationMs: 5 },
            { spanId: 's2', operationName: 'query', service: 'shop-web', startOffsetMs: 2, durationMs: 1 },
          ],
        },
      ],
    });
  });

  it('reports the module as unavailable on 404 and skips the call without services', async () => {
    const notFound = new ApiError({ code: 'not_found', message: 'tracing not enabled' }, 404);
    const failing = { request: async () => { throw notFound; } } as never;
    expect(await composedAppsApi(failing).tracing({ namespace: 'team', cluster: 'host', services: ['shop-web'] })).toEqual({
      available: false,
      reason: 'tracing not enabled',
      traces: [],
    });
    let called = 0;
    const idle = { request: async () => { called += 1; return { data: [] }; } } as never;
    expect(await composedAppsApi(idle).tracing({ namespace: 'team', cluster: 'host', services: [] })).toEqual({ available: true, traces: [] });
    expect(called).toBe(0);
  });
});

describe('composedAppsApi.events', () => {
  it('keeps events of the app and its components, newest first', async () => {
    const client = {
      request: async () => ({
        items: [
          { type: 'Normal', reason: 'ScalingReplicaSet', message: 'Scaled up', count: 1, lastTimestamp: '2026-01-01T00:00:01Z', involvedObject: { kind: 'Deployment', name: 'shop-web' } },
          { type: 'Warning', reason: 'Failed', message: 'pull failed', count: 3, lastTimestamp: '2026-01-01T00:00:05Z', involvedObject: { kind: 'Pod', name: 'shop-web-x' } },
          { type: 'Normal', reason: 'Other', message: 'unrelated', count: 1, lastTimestamp: '2026-01-01T00:00:09Z', involvedObject: { kind: 'Deployment', name: 'other' } },
        ],
      }),
    } as never;
    const events = await composedAppsApi(client).events({ namespace: 'team', names: ['shop', 'shop-web'] });
    expect(events.map((event) => event.reason)).toEqual(['Failed', 'ScalingReplicaSet']);
    expect(events[0]).toMatchObject({ type: 'Warning', objectKind: 'Pod', objectName: 'shop-web-x', count: 3 });
  });

  it('does not query when there are no names', async () => {
    let called = 0;
    const client = { request: async () => { called += 1; return { items: [] }; } } as never;
    expect(await composedAppsApi(client).events({ namespace: 'team', names: [] })).toEqual([]);
    expect(called).toBe(0);
  });
});

describe('composedAppsApi.list', () => {
  it('aggregates components by selector and reports readiness', async () => {
    const { client, calls } = clientWith({
      '/applications': { items: [application('shop', { app: 'shop' })] },
      '/deployments': {
        items: [
          { metadata: { labels: { app: 'shop' } }, spec: { replicas: 2 }, status: { readyReplicas: 1 } },
          { metadata: { labels: { app: 'other' } }, spec: { replicas: 1 }, status: { readyReplicas: 1 } },
        ],
      },
      '/statefulsets': { items: [] },
      '/services': { items: [{ metadata: { labels: { app: 'shop' } } }] },
      '/ingresses': { items: [] },
    });
    expect(await composedAppsApi(client).list({ namespace: 'team', cluster: 'host' })).toEqual([
      {
        name: 'shop',
        namespace: 'team',
        version: 'v2',
        health: 'progressing',
        components: { workloads: 1, services: 1, ingresses: 0 },
        createdAt: '2026-01-01T00:00:00Z',
        healthDetail: '1/2',
      },
    ]);
    expect(calls.some((url) => url.endsWith('/applications'))).toBe(true);
  });

  it('reports unknown when the selector matches no workload', async () => {
    const { client } = clientWith({
      '/applications': { items: [application('empty', { app: 'empty' })] },
    });
    const rows = await composedAppsApi(client).list({ namespace: 'team', cluster: 'host' });
    expect(rows[0]?.health).toBe('unknown');
    expect(rows[0]?.components).toEqual({ workloads: 0, services: 0, ingresses: 0 });
    expect(rows[0]?.version).toBe('v2');
  });

  it('returns matched components for the detail page', async () => {
    const { client } = clientWith({
      '/applications/shop': application('shop', { app: 'shop' }),
      '/deployments': {
        items: [
          { metadata: { name: 'shop-web', labels: { app: 'shop' } }, spec: { replicas: 2 }, status: { readyReplicas: 2 } },
          { metadata: { name: 'other', labels: { app: 'other' } }, spec: { replicas: 1 }, status: { readyReplicas: 1 } },
        ],
      },
      '/services': {
        items: [{ metadata: { name: 'shop-svc', labels: { app: 'shop' } }, spec: { type: 'NodePort', clusterIP: '10.0.0.8' } }],
      },
      '/ingresses': {
        items: [{ metadata: { name: 'shop-ing', labels: { app: 'shop' } }, spec: { rules: [{ host: 'shop.example.test' }] } }],
      },
    });
    const detail = await composedAppsApi(client).get({ namespace: 'team', name: 'shop', cluster: 'host' });
    expect(detail.health).toBe('healthy');
    expect(detail.workloads).toEqual([{ kind: 'Deployment', name: 'shop-web', ready: 2, desired: 2 }]);
    expect(detail.serviceItems).toEqual([{ name: 'shop-svc', type: 'NodePort', clusterIP: '10.0.0.8', ports: [] }]);
    expect(detail.ingressItems).toEqual([{ name: 'shop-ing', hosts: ['shop.example.test'] }]);
    expect(detail.labels['app.kubernetes.io/version']).toBe('v2');
  });

  it('reports degraded when no replica is ready', async () => {
    const { client } = clientWith({
      '/applications': { items: [application('down', { app: 'down' })] },
      '/deployments': { items: [{ metadata: { labels: { app: 'down' } }, spec: { replicas: 3 }, status: { readyReplicas: 0 } }] },
    });
    const rows = await composedAppsApi(client).list({ namespace: 'team', cluster: 'host' });
    expect(rows[0]?.health).toBe('degraded');
    expect(rows[0]?.healthDetail).toBe('0/3');
  });
});
