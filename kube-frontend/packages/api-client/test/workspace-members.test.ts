import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/errors';
import { createClient } from '../src/client';
import { workspaceMembersApi, workspaceRolesApi } from '../src/access';

describe('workspace membership contracts', () => {
  it('uses workspace IAM collection POST and member PUT/DELETE, not project bindings', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const client = createClient({ fetchImpl: (async (input, init) => {
      calls.push({ url: String(input), ...(init ? { init } : {}) });
      return new Response(JSON.stringify({ metadata: { name: 'alice' } }), { headers: { 'content-type': 'application/json' } });
    }) as typeof fetch });
    const api = workspaceMembersApi(client);
    await api.invite({ workspace: 'team/a', username: 'alice', roleRef: 'team-viewer' });
    await api.updateRole({ workspace: 'team/a', username: 'alice', roleRef: 'team-admin' });
    await api.remove({ workspace: 'team/a', username: 'alice' });
    expect(calls[0]!.url).toContain('/users/alice');
    expect(calls.slice(1).map((call) => call.init?.method)).toEqual(['POST', 'PUT', 'DELETE']);
    expect(calls[1]!.url).toContain('/workspaces/team%2Fa/workspacemembers');
    expect(calls[2]!.url).toContain('/workspaces/team%2Fa/workspacemembers/alice');
    expect(JSON.parse(String(calls[1]!.init?.body))).toEqual([{ username: 'alice', roleRef: 'team-viewer' }]);
    expect(JSON.parse(String(calls[2]!.init?.body))).toEqual({ username: 'alice', roleRef: 'team-admin' });
  });
  it('does not create a binding for a missing account', async () => {
    const client = createClient({ fetchImpl: (async () => new Response('{}', { headers: { 'content-type': 'application/json' } })) as typeof fetch });
    await expect(workspaceMembersApi(client).invite({ workspace: 'team', username: 'missing', roleRef: 'viewer' }))
      .rejects.toThrow('User account does not exist');
  });
  it('maps scoped roles including aliases and retains read errors', async () => {
    const client = createClient({ fetchImpl: (async () => new Response(JSON.stringify({
      items: [{ metadata: { name: 'team-viewer', annotations: { 'kubesphere.io/alias-name': 'viewer' } }, rules: [{}] }],
    }), { headers: { 'content-type': 'application/json' } })) as typeof fetch });
    expect(await workspaceRolesApi(client).list({ workspace: 'team' })).toEqual([
      {
        name: 'team-viewer',
        alias: 'viewer',
        ruleCount: 1,
        createdAt: '',
        creator: '',
        description: '',
        aggregationRoles: [],
        annotations: { 'kubesphere.io/alias-name': 'viewer' },
      },
    ]);
    const denied = createClient({ fetchImpl: (async () => new Response('{"message":"forbidden"}', { status: 403 })) as typeof fetch });
    await expect(workspaceRolesApi(denied).list({ workspace: 'team' })).rejects.toThrow();
  });
  it('maps email and lastLogin from spec/status, not the password-change annotation first', async () => {
    const client = createClient({ fetchImpl: (async () => new Response(JSON.stringify({
      items: [{
        metadata: { name: 'alice', annotations: { 'iam.kubesphere.io/workspacerole': 'viewer', 'iam.kubesphere.io/last-login-time': '2020-01-01T00:00:00Z', email: 'old@x' } },
        spec: { email: 'alice@example.test' },
        status: { state: 'Active', lastLoginTime: '2026-01-02T03:04:05Z' },
      }],
    }), { headers: { 'content-type': 'application/json' } })) as typeof fetch });
    expect(await workspaceMembersApi(client).list({ workspace: 'team' })).toEqual([
      { username: 'alice', role: 'viewer', status: 'Active', lastLogin: '2026-01-02T03:04:05Z', email: 'alice@example.test' },
    ]);
  });
  it('reads member projects from the tenant collection and treats missing DevOps as empty', async () => {
    const calls: string[] = [];
    const client = createClient({ fetchImpl: (async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('/devops')) return new Response('{"reason":"NotFound"}', { status: 404, headers: { 'content-type': 'application/json' } });
      return new Response(JSON.stringify({
        items: [{ metadata: { name: 'ns-a', creationTimestamp: '2026-01-01T00:00:00Z', annotations: { 'kubesphere.io/alias-name': 'A' } } }],
      }), { headers: { 'content-type': 'application/json' } });
    }) as typeof fetch });
    const api = workspaceMembersApi(client);
    expect(await api.memberProjects({ workspace: 'team', username: 'alice', cluster: 'host' })).toEqual([
      { name: 'ns-a', alias: 'A', createdAt: '2026-01-01T00:00:00Z', cluster: 'host' },
    ]);
    expect(await api.memberDevops({ workspace: 'team', username: 'alice', cluster: 'host' })).toEqual([]);
    expect(calls[0]).toContain('/kapis/tenant.kubesphere.io/v1alpha2/workspaces/team/klusters/host/workspacemembers/alice/namespaces');
    expect(calls[1]).toContain('/workspacemembers/alice/devops');
  });
  it('removes a batch by sequential DELETE on each member object', async () => {
    const methods: Array<string | undefined> = [];
    const urls: string[] = [];
    const client = createClient({ fetchImpl: (async (input, init) => {
      urls.push(String(input));
      methods.push(init?.method);
      return new Response('{}', { headers: { 'content-type': 'application/json' } });
    }) as typeof fetch });
    await workspaceMembersApi(client).removeMany({ workspace: 'team', usernames: ['a', 'b'] });
    expect(methods).toEqual(['DELETE', 'DELETE']);
    expect(urls[0]).toContain('/workspacemembers/a');
    expect(urls[1]).toContain('/workspacemembers/b');
  });
  it('propagates a non-404 DevOps failure instead of hiding it as empty', async () => {
    const client = createClient({ fetchImpl: (async () => new Response('{"message":"forbidden"}', { status: 403 })) as typeof fetch });
    await expect(workspaceMembersApi(client).memberDevops({ workspace: 'team', username: 'alice' })).rejects.toBeInstanceOf(ApiError);
  });
});
