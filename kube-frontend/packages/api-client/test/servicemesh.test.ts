import { describe, expect, it } from 'vitest';
import { createClient } from '../src/client';
import type { KubeStrategy } from '../src/servicemesh';
import {
  pausedStrategy,
  resumedStrategy,
  strategiesApi,
  strategyStatusOf,
  targetServiceOf,
  toStrategyDetail,
  toStrategySummary,
  withBluegreenVersion,
  withTrafficWeight,
} from '../src/servicemesh';

/**
 * Strategy → row mapping.
 *
 * The controller reports progress as conditions (`Complete` / `Failed`), not a phase;
 * the target service is the Istio host. Both derivations are pinned here because a
 * wrong mapping turns "failed" into "unknown" or shows the strategy name as its target.
 */

function strategy(overrides: Record<string, unknown> = {}) {
  return {
    apiVersion: 'servicemesh.kubesphere.io/v1alpha2',
    kind: 'Strategy',
    metadata: { name: 'release', namespace: 'default', creationTimestamp: '2026-11-14T00:00:00Z' },
    spec: {
      type: 'Canary',
      selector: { matchLabels: { app: 'reviews' } },
      template: { spec: { hosts: ['reviews-v2'] } },
      ...(overrides['spec'] as Record<string, unknown> | undefined),
    },
    ...(overrides['status'] === undefined ? {} : { status: overrides['status'] }),
  };
}

describe('strategyStatusOf', () => {
  it('reads Complete=True as completed and keeps its message', () => {
    const result = strategyStatusOf({
      ...strategy(),
      status: { conditions: [{ type: 'Complete', status: 'True', message: 'all traffic shifted' }] },
    } as never);
    expect(result.status).toBe('completed');
    expect(result.detail).toBe('all traffic shifted');
  });

  it('reads Failed=True as failed even if a Complete condition is absent', () => {
    const result = strategyStatusOf({
      ...strategy(),
      status: { conditions: [{ type: 'Failed', status: 'True', reason: 'NoSuitableWorkload' }] },
    } as never);
    expect(result.status).toBe('failed');
    expect(result.detail).toBe('NoSuitableWorkload');
  });

  it('treats other conditions as progressing and an empty status as unknown', () => {
    expect(
      strategyStatusOf({ ...strategy(), status: { conditions: [{ type: 'Progressing', status: 'True' }] } } as never).status,
    ).toBe('progressing');
    // A fresh Strategy has no conditions yet: unknown, never failed.
    expect(strategyStatusOf(strategy() as never).status).toBe('unknown');
  });

  it('uses completionTime as completion when no condition was written', () => {
    expect(
      strategyStatusOf({ ...strategy(), status: { completionTime: '2026-11-14T01:00:00Z' } } as never).status,
    ).toBe('completed');
  });
});

describe('targetServiceOf', () => {
  it('prefers the Istio host, then the selector app label, then the template name', () => {
    expect(targetServiceOf(strategy() as never)).toBe('reviews-v2');
    expect(
      targetServiceOf({ ...strategy(), spec: { selector: { matchLabels: { app: 'reviews' } } } } as never),
    ).toBe('reviews');
    expect(
      targetServiceOf({ ...strategy(), spec: { template: { metadata: { name: 'reviews-vs' } } } } as never),
    ).toBe('reviews-vs');
  });
});

describe('strategiesApi', () => {
  it('lists one project from the native servicemesh endpoint and maps rows', async () => {
    const calls: string[] = [];
    const client = createClient({
      fetchImpl: (async (input: RequestInfo | URL) => {
        calls.push(String(input));
        return new Response(JSON.stringify({ items: [strategy()] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }) as typeof fetch,
    });
    const result = await strategiesApi(client).list({ cluster: 'host', namespace: 'default' });
    const url = new URL(calls[0] ?? '');
    expect(url.pathname).toBe('/apis/servicemesh.kubesphere.io/v1alpha2/namespaces/default/strategies');
    expect(result.items[0]).toMatchObject({
      name: 'release',
      type: 'Canary',
      targetService: 'reviews-v2',
      status: 'unknown',
    });
  });

  it('maps a summary without inventing a status', () => {
    const summary = toStrategySummary(strategy() as never);
    expect(summary.status).toBe('unknown');
    expect(summary.targetService).toBe('reviews-v2');
    // A strategy without routes has no versions and no weights — not zeros.
    expect(summary.versionOrder).toEqual([]);
    expect(summary.weights).toEqual({});
  });

  it('lists versions new-first with the weights the object sets', () => {
    const summary = toStrategySummary(weighted(80, 20) as never);
    expect(summary.versionOrder).toEqual(['v2', 'v1']);
    expect(summary.weights).toEqual({ v2: 20, v1: 80 });
  });
});

/**
 * Detail model: versions/weights, match rules, conditions, and the writes that keep
 * governor consistent with the route weights.
 */

const HOST = 'reviews';

function routeObject(spec: Record<string, unknown>): KubeStrategy {
  return {
    apiVersion: 'servicemesh.kubesphere.io/v1alpha2',
    kind: 'Strategy',
    metadata: { name: 'release', namespace: 'default', resourceVersion: '42', labels: { app: HOST } },
    spec: { type: 'Canary', strategyPolicy: 'WaitForWorkloadReady', principal: 'v1', ...spec },
  };
}

function weighted(principalWeight: number, canaryWeight: number): KubeStrategy {
  return routeObject({
    governor: '',
    selector: { matchLabels: { app: HOST } },
    template: {
      spec: {
        hosts: [HOST],
        http: [
          {
            route: [
              { destination: { host: HOST, subset: 'v1' }, weight: principalWeight },
              { destination: { host: HOST, subset: 'v2' }, weight: canaryWeight },
            ],
          },
        ],
      },
    },
  });
}

describe('toStrategyDetail', () => {
  it('derives a traffic split with both versions and their weights', () => {
    const detail = toStrategyDetail({
      ...weighted(80, 20),
      status: { conditions: [{ type: 'Complete', status: 'True', reason: 'Done', message: 'shifted', lastTransitionTime: '2026-11-15T00:00:00Z' }] },
    } as never);
    expect(detail.mode).toBe('traffic');
    expect(detail.protocol).toBe('http');
    expect(detail.principal).toBe('v1');
    expect(detail.governor).toBe('');
    expect(detail.strategyPolicy).toBe('WaitForWorkloadReady');
    // New version first, principal last: the order the detail cards are read in.
    expect(detail.versions.map((version) => [version.version, version.role, version.weight])).toEqual([
      ['v2', 'canary', 20],
      ['v1', 'principal', 80],
    ]);
    expect(detail.conditions).toEqual([
      { type: 'Complete', status: 'True', reason: 'Done', message: 'shifted', lastTransitionTime: '2026-11-15T00:00:00Z' },
    ]);
  });

  it('turns each request-content match into a row with its target version', () => {
    const detail = toStrategyDetail({
      ...routeObject({
        template: {
          spec: {
            hosts: [HOST],
            http: [
              {
                match: [
                  { headers: { cookie: { regex: 'user=canary' }, 'User-Agent': { regex: '.*(Chrome).*' } }, uri: { prefix: '/v2' } },
                ],
                route: [{ destination: { host: HOST, subset: 'v2' } }],
              },
              { match: [{ headers: { 'x-tenant': { exact: 'acme' } } }], route: [{ destination: { host: HOST, subset: 'v2' } }] },
              { route: [{ destination: { host: HOST, subset: 'v1' }, weight: 100 }] },
            ],
          },
        },
      }),
    } as never);
    expect(detail.mode).toBe('content');
    expect(detail.matchRules.map((rule) => [rule.index, rule.kind, rule.key, rule.matchType, rule.value, rule.targets])).toEqual([
      [1, 'uri', '', 'prefix', '/v2', ['v2']],
      [1, 'cookie', '', 'regex', 'user=canary', ['v2']],
      [1, 'userAgent', '', 'regex', '.*(Chrome).*', ['v2']],
      [2, 'header', 'x-tenant', 'exact', 'acme', ['v2']],
    ]);
  });

  it('keeps an unmodelled match kind visible instead of claiming there is none', () => {
    const detail = toStrategyDetail({
      ...routeObject({
        template: { spec: { hosts: [HOST], http: [{ match: [{ method: { exact: 'GET' } }], route: [{ destination: { host: HOST, subset: 'v2' } }] }] } },
      }),
    } as never);
    expect(detail.mode).toBe('content');
    expect(detail.matchRules).toEqual([
      { index: 1, kind: 'other', key: 'method', matchType: 'unknown', value: JSON.stringify({ exact: 'GET' }), targets: ['v2'] },
    ]);
  });

  it('reads blue-green and mirror releases apart', () => {
    const bluegreen = toStrategyDetail({
      ...weighted(100, 0),
      spec: { ...weighted(100, 0).spec, type: 'Bluegreen', governor: 'v1' },
    } as never);
    expect(bluegreen.mode).toBe('bluegreen');
    expect(bluegreen.versions.find((version) => version.version === 'v1')?.governing).toBe(true);

    const mirror = toStrategyDetail({
      ...routeObject({
        type: 'Mirror',
        template: {
          spec: {
            hosts: [HOST],
            http: [{ route: [{ destination: { host: HOST, subset: 'v1' }, weight: 100 }], mirror: { host: HOST, subset: 'v2' } }],
          },
        },
      }),
    } as never);
    expect(mirror.mode).toBe('mirror');
    expect(mirror.mirror).toEqual({ host: HOST, subset: 'v2' });
    expect(mirror.versions.map((version) => [version.version, version.role])).toEqual([
      ['v2', 'mirror'],
      ['v1', 'principal'],
    ]);
  });

  it('reports no condition instead of inventing one', () => {
    const detail = toStrategyDetail(weighted(100, 0) as never);
    expect(detail.conditions).toEqual([]);
    expect(detail.status).toBe('unknown');
  });
});

describe('traffic writes', () => {
  it('writes both weights and keeps governor consistent with the extremes', () => {
    const source = weighted(80, 20);
    const middle = withTrafficWeight(source as never, 35);
    const routes = middle.spec?.template as never as { spec: { http: Array<{ route: Array<{ weight: number; destination: { subset: string } }> }> } };
    const pairs = routes.spec.http[0]!.route.map((route) => [route.destination.subset, route.weight]);
    expect(pairs).toEqual([
      ['v1', 65],
      ['v2', 35],
    ]);
    expect(middle.spec?.governor).toBe('');

    expect(withTrafficWeight(source as never, 100).spec?.governor).toBe('v2');
    expect(withTrafficWeight(source as never, 0).spec?.governor).toBe('v1');
    // The source object is not mutated: the page keeps rendering what the server sent
    // until the PUT answers.
    const sourceRoutes = (source.spec as never as { template: { spec: { http: Array<{ route: Array<{ weight: number }> }> } } }).template.spec.http[0]!.route;
    expect(sourceRoutes.map((route) => route.weight)).toEqual([80, 20]);
    expect(source.spec?.governor).toBe('');
  });

  it('clamps out-of-range input and keeps the match rule of the content rule', () => {
    const source = routeObject({
      template: {
        spec: {
          hosts: [HOST],
          http: [
            { route: [{ destination: { host: HOST, subset: 'v1' }, weight: 50 }, { destination: { host: HOST, subset: 'v2' }, weight: 50 }] },
            { match: [{ uri: { prefix: '/x' } }], route: [{ destination: { host: HOST, subset: 'v2' } }] },
          ],
        },
      },
    });
    const next = withTrafficWeight(source as never, 250);
    expect(next.spec?.governor).toBe('v2');
    const http = (next.spec as never as { template: { spec: { http: Array<Record<string, unknown>> } } }).template.spec.http;
    expect(http[0]!.route).toEqual([
      { destination: { host: HOST, subset: 'v1' }, weight: 0 },
      { destination: { host: HOST, subset: 'v2' }, weight: 100 },
    ]);
    // The second rule (the content match) is not dropped by a traffic edit.
    expect(http[1]!.match).toEqual([{ uri: { prefix: '/x' } }]);
  });

  it('refuses to guess a split when the strategy has no two-version route', () => {
    const single = routeObject({ template: { spec: { hosts: [HOST], http: [{ route: [{ destination: { host: HOST, subset: 'v2' } }] }] } } });
    expect(() => withTrafficWeight(single as never, 30)).toThrow('two versions');
  });

  it('pauses by handing traffic to the principal and resumes by clearing governor', () => {
    const source = weighted(65, 35);
    const paused = pausedStrategy(source as never);
    expect(paused.spec?.governor).toBe('v1');
    // Resume restores the configured split because the weights were never touched.
    const routes = (paused.spec as never as { template: { spec: { http: Array<{ route: Array<{ weight: number }> }> } } }).template.spec.http[0]!.route;
    expect(routes.map((route) => route.weight)).toEqual([65, 35]);
    expect(resumedStrategy(paused as never).spec?.governor).toBe('');
  });

  it('switches a blue-green release to the chosen version', () => {
    const source = routeObject({
      type: 'Bluegreen',
      principal: 'v1',
      governor: 'v1',
      template: { spec: { hosts: [HOST], http: [{ route: [{ destination: { host: HOST, subset: 'v1' }, weight: 100 }, { destination: { host: HOST, subset: 'v2' }, weight: 0 }] }] } },
    });
    const switched = withBluegreenVersion(source as never, 'v2');
    expect(switched.spec?.governor).toBe('v2');
    const routes = (switched.spec as never as { template: { spec: { http: Array<{ route: Array<{ weight: number }> }> } } }).template.spec.http[0]!.route;
    expect(routes.map((route) => route.weight)).toEqual([0, 100]);
    expect(withBluegreenVersion(source as never, 'v1').spec?.governor).toBe('v1');
  });
});
