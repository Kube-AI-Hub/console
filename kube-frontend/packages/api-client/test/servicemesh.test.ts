import { describe, expect, it } from 'vitest';
import { createClient } from '../src/client';
import { strategiesApi, strategyStatusOf, targetServiceOf, toStrategySummary } from '../src/servicemesh';

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
  });
});
