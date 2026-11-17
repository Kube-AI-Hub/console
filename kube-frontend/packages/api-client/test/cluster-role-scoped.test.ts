import { describe, expect, it } from 'vitest';
import { clusterRolesForClusterApi } from '../src/access';

/**
 * Cluster-scoped roles.
 *
 * The platform page always reads the host cluster; the cluster console must read the
 * cluster in its URL. These tests pin the path (member prefix) and the two mappings the
 * detail page relies on (rules kept raw, users from the IAM filter).
 */
function clientWith(handler: (url: string) => unknown) {
  const calls: string[] = [];
  return {
    calls,
    client: {
      request: async (url: string, options?: { query?: Record<string, unknown> }) => {
        calls.push(options?.query ? url + '?' + JSON.stringify(options.query) : url);
        return handler(url);
      },
    } as never,
  };
}

describe('clusterRolesForClusterApi', () => {
  it('lists the host cluster roles from the plain kapis prefix', async () => {
    const { client, calls } = clientWith(() => ({
      items: [{ metadata: { name: 'view' }, rules: [{}, {}] }],
    }));
    const rows = await clusterRolesForClusterApi(client).list({ cluster: 'host' });
    expect(calls[0]).toBe('/kapis/iam.kubesphere.io/v1alpha2/clusterroles?{"limit":-1}');
    expect(rows).toEqual([expect.objectContaining({ name: 'view', ruleCount: 2, system: false })]);
  });

  it('addresses a member cluster through /kapis/clusters/<c>/iam…', async () => {
    const { client, calls } = clientWith(() => ({ metadata: { name: 'view' }, rules: [] }));
    await clusterRolesForClusterApi(client).get({ cluster: 'member-a', name: 'view' });
    expect(calls[0]).toBe('/kapis/clusters/member-a/iam.kubesphere.io/v1alpha2/clusterroles/view');
  });

  it('maps users filtered by the clusterrole parameter', async () => {
    const { client, calls } = clientWith(() => ({
      items: [{ metadata: { name: 'alice' }, status: { state: 'Active', lastLoginTime: '2026-01-02T03:04:05Z' } }],
    }));
    const users = await clusterRolesForClusterApi(client).users({ cluster: 'host', name: 'view' });
    expect(calls[0]).toBe('/kapis/iam.kubesphere.io/v1alpha2/users?{"clusterrole":"view","limit":-1}');
    expect(users).toEqual([{ username: 'alice', status: 'Active', lastLogin: '2026-01-02T03:04:05Z' }]);
  });
});
