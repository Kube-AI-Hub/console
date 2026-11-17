import { describe, expect, it } from 'vitest';
import { createClient } from '../src/client';
import {
  ruleGroupsApi,
  ruleGroupsWriteApi,
  toRuleGroupDetail,
  toRuleGroupStatus,
  toRuleGroupSummary,
} from '../src/alerting';

/**
 * Rule groups (alerting policies): read models and the write contract.
 *
 * Two things are pinned here because both are silent when wrong:
 *
 * 1. **Status only exists on the aggregated kapis path.** A raw CRD read has no
 *    `status`, so a page that renders 0 firing for a missing status claims something the
 *    API never said. The mapper keeps "missing" and "zero" distinct.
 * 2. **Cluster groups are not namespaced.** Writing a cluster policy through the
 *    project-shaped path would create a namespaced object (or 404), not the policy the
 *    operator asked for.
 */

function recordingClient(body: unknown, status = 200) {
  const calls: Array<{ url: string; method: string; body: string | undefined }> = [];
  const client = createClient({
    baseUrl: 'http://apiserver',
    fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        method: (init?.method ?? 'GET').toUpperCase(),
        body: typeof init?.body === 'string' ? init.body : undefined,
      });
      return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch,
  });
  return { client, calls };
}

const group = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  apiVersion: 'alerting.kubesphere.io/v2beta1',
  kind: 'ClusterRuleGroup',
  metadata: {
    name: 'p1',
    creationTimestamp: '2026-01-02T03:04:05Z',
    labels: { 'alerting.kubesphere.io/enable': 'true' },
    annotations: {
      'kubesphere.io/description': 'desc',
      'kubesphere.io/alias-name': 'Alias',
    },
  },
  spec: {
    interval: '2m',
    rules: [{ alert: 'a1', expr: 'up == 0', for: '5m', severity: 'warning' }],
  },
  status: {
    evaluationTime: 0.002,
    lastEvaluation: '2026-01-02T03:05:00Z',
    rulesStatus: [{ state: 'inactive', health: 'ok', evaluationTime: 0.001, lastEvaluation: '2026-01-02T03:05:00Z' }],
    rulesStats: { inactive: 1, pending: 0, firing: 0, disabled: 0 },
  },
  ...overrides,
});

describe('toRuleGroupStatus', () => {
  it('maps the aggregated status, including per-rule states', () => {
    const status = toRuleGroupStatus(group() as never);
    expect(status?.evaluationTime).toBe(0.002);
    expect(status?.lastEvaluation).toBe('2026-01-02T03:05:00Z');
    expect(status?.stats).toEqual({ inactive: 1, pending: 0, firing: 0, disabled: 0 });
    expect(status?.rules[0]?.state).toBe('inactive');
  });

  it('returns undefined when the read path carried no status', () => {
    // The raw CRD read is exactly this shape. Undefined must not become a zero count.
    expect(toRuleGroupStatus(group({ status: undefined }) as never)).toBeUndefined();
  });

  it('drops non-numeric counts and non-finite values', () => {
    const status = toRuleGroupStatus(
      group({ status: { rulesStats: { firing: '2', pending: Number.NaN, inactive: 0 } } }) as never,
    );
    expect(status?.stats).toEqual({ inactive: 0 });
  });
});

describe('rule group read models', () => {
  it('carries alias, description, interval and status', () => {
    const summary = toRuleGroupSummary(group() as never, 'cluster');
    expect(summary.alias).toBe('Alias');
    expect(summary.description).toBe('desc');
    expect(summary.interval).toBe('2m');
    expect(summary.enabled).toBe(true);
    expect(summary.status?.stats.firing).toBe(0);
  });

  it('aligned rule status is attached by index in the detail', () => {
    const detail = toRuleGroupDetail(group() as never, 'cluster');
    expect(detail.rules[0]?.status?.state).toBe('inactive');
    expect(detail.rules[0]?.name).toBe('a1');
  });
});

describe('ruleGroupsApi reads', () => {
  it('listScope with status reads the aggregated kapis path whole', async () => {
    const { client, calls } = recordingClient({ items: [group()], totalItems: 1 });
    const result = await ruleGroupsApi(client).listScope({ scope: 'cluster', withStatus: true, cluster: 'host' });
    expect(calls[0]?.url).toContain('/kapis/alerting.kubesphere.io/v2beta1/clusterrulegroups');
    expect(calls[0]?.url).toContain('limit=-1');
    expect(result.total).toBe(1);
    expect(result.items[0]?.status?.stats.inactive).toBe(1);
  });

  it('listScope without status keeps the raw CRD path', async () => {
    const { client, calls } = recordingClient({ items: [group({ status: undefined })] });
    const result = await ruleGroupsApi(client).listScope({ scope: 'global' });
    expect(calls[0]?.url).toContain('/apis/alerting.kubesphere.io/v2beta1/globalrulegroups');
    expect(result.items[0]?.status).toBeUndefined();
    // No totalItems on the raw list: the array length is the count, not zero.
    expect(result.total).toBe(1);
  });

  it('get withStatus reads the aggregated item path', async () => {
    const { client, calls } = recordingClient(group());
    const detail = await ruleGroupsApi(client).get({ name: 'p1', scope: 'cluster', withStatus: true });
    expect(calls[0]?.url).toContain('/kapis/alerting.kubesphere.io/v2beta1/clusterrulegroups/p1');
    expect(detail.status?.evaluationTime).toBe(0.002);
  });
});

describe('ruleGroupsWriteApi', () => {
  it('creates a cluster policy on the cluster collection without a namespace', async () => {
    const { client, calls } = recordingClient({}, 201);
    await ruleGroupsWriteApi(client).create({
      scope: 'cluster',
      name: 'p2',
      description: 'd',
      alias: 'A',
      interval: '1m',
      rules: [{ alert: 'r', expression: 'up == 0', duration: '1m', severity: 'warning', summary: '', message: '' }],
    });
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url).toContain('/apis/alerting.kubesphere.io/v2beta1/clusterrulegroups');
    const body = JSON.parse(calls[0]?.body ?? '{}');
    expect(body.kind).toBe('ClusterRuleGroup');
    expect(body.metadata.namespace).toBeUndefined();
    expect(body.metadata.annotations['kubesphere.io/description']).toBe('d');
    expect(body.metadata.annotations['kubesphere.io/alias-name']).toBe('A');
    expect(body.metadata.labels['alerting.kubesphere.io/enable']).toBe('true');
    expect(body.spec.interval).toBe('1m');
    expect(body.spec.rules[0]).toMatchObject({ alert: 'r', expr: 'up == 0', for: '1m', severity: 'warning' });
  });

  it('creates a project policy on the namespaced collection', async () => {
    const { client, calls } = recordingClient({}, 201);
    await ruleGroupsWriteApi(client).create({
      scope: 'project',
      namespace: 'demo',
      name: 'p3',
      rules: [{ alert: 'r', expression: 'up == 0', duration: '1m', severity: 'warning', summary: '', message: '' }],
    });
    expect(calls[0]?.url).toContain('/apis/alerting.kubesphere.io/v2beta1/namespaces/demo/rulegroups');
    const body = JSON.parse(calls[0]?.body ?? '{}');
    expect(body.kind).toBe('RuleGroup');
    expect(body.metadata.namespace).toBe('demo');
  });

  it('updates a cluster policy by reading it first and preserving foreign annotations', async () => {
    const current = group({ metadata: { ...(group() as { metadata: object }).metadata, resourceVersion: '42' } });
    const { client, calls } = recordingClient(current);
    await ruleGroupsWriteApi(client).update({
      scope: 'cluster',
      name: 'p1',
      description: '',
      alias: '',
      interval: '5m',
      rules: [{ alert: 'b', expression: 'up == 1', duration: '2m', severity: 'info', summary: '', message: '' }],
    });
    expect(calls[0]?.method).toBe('GET');
    expect(calls[1]?.method).toBe('PUT');
    expect(calls[1]?.url).toContain('/clusterrulegroups/p1');
    const body = JSON.parse(calls[1]?.body ?? '{}');
    expect(body.metadata.resourceVersion).toBe('42');
    // Empty form fields clear the console-owned annotations but leave others intact.
    expect(body.metadata.annotations['kubesphere.io/creator']).toBeUndefined();
    expect(body.metadata.annotations['kubesphere.io/description']).toBeUndefined();
    expect(body.metadata.annotations['kubesphere.io/alias-name']).toBeUndefined();
    expect(body.spec.rules[0].alert).toBe('b');
    expect(body.spec.interval).toBe('5m');
  });

  it('deletes a cluster policy from the cluster collection', async () => {
    const { client, calls } = recordingClient({});
    await ruleGroupsWriteApi(client).remove({ scope: 'cluster', name: 'p1' });
    expect(calls[0]?.method).toBe('DELETE');
    expect(calls[0]?.url).toContain('/apis/alerting.kubesphere.io/v2beta1/clusterrulegroups/p1');
  });

  it('replaces a whole object from the YAML editor', async () => {
    const { client, calls } = recordingClient({});
    await ruleGroupsWriteApi(client).replace({
      scope: 'cluster',
      name: 'p1',
      object: { apiVersion: 'alerting.kubesphere.io/v2beta1', kind: 'ClusterRuleGroup', metadata: { name: 'p1' } },
    });
    expect(calls[0]?.method).toBe('PUT');
    expect(calls[0]?.url).toContain('/clusterrulegroups/p1');
  });
});
