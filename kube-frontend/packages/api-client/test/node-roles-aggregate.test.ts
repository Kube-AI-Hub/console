import { describe, expect, it } from 'vitest';
import { createClient } from '../src/client';
import { nodeListApi } from '../src/node-list';

/**
 * The role filter discovers roles from the cluster.
 *
 * A cluster administrator can label nodes with any `node-role.kubernetes.io/<value>`
 * and the server filters on it, so a hard-coded list would leave their nodes
 * unreachable from the dropdown. `roles()` is the one read that finds them.
 *
 * Two exclusions are deliberate and are what these pin: `worker` is the default role
 * and is already an explicit filter value, and `control-plane` is covered by the
 * `master` filter (the server accepts both names) — listing it again would put
 * 「控制平面节点」and「控制平面」side by side, filtering identically.
 */
function node(name: string, roles: string[]) {
  const labels: Record<string, string> = {};
  for (const role of roles) labels[`node-role.kubernetes.io/${role}`] = '';
  return { metadata: { name, labels }, spec: {}, status: {} };
}

function harness(body: unknown) {
  const calls: Array<{ url: URL }> = [];
  const client = createClient({ fetchImpl: (async (input: RequestInfo | URL) => {
    calls.push({ url: new URL(String(input)) });
    return Response.json(body);
  }) as typeof fetch });
  return { api: nodeListApi(client), calls };
}

describe('node roles aggregate', () => {
  it('counts every role in use, skipping the default and the control-plane alias', async () => {
    const { api, calls } = harness({ items: [
      node('a100-04', ['storage', 'worker']),
      node('a100-64', ['storage', 'worker']),
      node('sagesuite-demo', ['control-plane', 'storage', 'worker']),
      node('gpu-01', ['gpu-admin', 'worker']),
    ], totalItems: 4 });

    expect(await api.roles({ cluster: 'agent' })).toEqual([
      // Sorted by role name so the dropdown order is stable between refreshes.
      { role: 'gpu-admin', count: 1 },
      { role: 'storage', count: 3 },
    ]);
    // One unfiltered read: the API has no role aggregate, and the alternative is a
    // request per candidate role.
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url.searchParams.get('limit')).toBe('-1');
  });

  it('returns nothing when no node carries an extra role', async () => {
    const { api } = harness({ items: [node('plain-1', ['worker']), node('plain-2', ['worker'])], totalItems: 2 });
    expect(await api.roles({ cluster: 'agent' })).toEqual([]);
  });

  it('ignores labels that are not roles', async () => {
    const { api } = harness({ items: [
      { metadata: { name: 'n1', labels: { 'kubernetes.io/hostname': 'n1', 'node-role.kubernetes.io/storage': '' } }, spec: {}, status: {} },
    ], totalItems: 1 });
    expect(await api.roles({ cluster: 'host' })).toEqual([{ role: 'storage', count: 1 }]);
  });
});
