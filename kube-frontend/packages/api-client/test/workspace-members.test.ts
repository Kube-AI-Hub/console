import { describe, expect, it } from 'vitest';
import { createClient } from '../src/client';
import { workspaceMembersApi, workspaceRolesApi } from '../src/access';

describe('workspace membership contracts', () => {
  it('uses workspace IAM collection POST and member PUT/DELETE, not project bindings', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const client = createClient({ fetchImpl: (async (input, init) => {
      calls.push({ url: String(input), init });
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
      { name: 'team-viewer', alias: 'viewer', ruleCount: 1, createdAt: '' },
    ]);
    const denied = createClient({ fetchImpl: (async () => new Response('{"message":"forbidden"}', { status: 403 })) as typeof fetch });
    await expect(workspaceRolesApi(denied).list({ workspace: 'team' })).rejects.toThrow();
  });
});
