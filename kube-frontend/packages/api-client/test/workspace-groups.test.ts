import { describe, expect, it } from 'vitest';
import { createClient } from '../src/client';
import { rolesForUser, toWorkspaceGroupSummary, workspaceGroupForest, workspaceGroupsApi } from '../src/access';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

describe('workspace group contracts', () => {
  it('joins member counts from bindings and nests by parent label', () => {
    const parent = toWorkspaceGroupSummary({
      metadata: {
        name: 'eng-1',
        annotations: { 'kubesphere.io/alias-name': '研发' },
        labels: {},
      },
    }, 0);
    parent.generateName = 'eng';
    const child = toWorkspaceGroupSummary({
      metadata: {
        name: 'qa-1',
        annotations: {},
        labels: { 'iam.kubesphere.io/group-parent': 'eng-1' },
      },
    }, 0);
    const forest = workspaceGroupForest([
      { ...parent, memberCount: 2, generateName: 'eng' },
      { ...child, memberCount: 0, generateName: 'qa' },
    ]);
    expect(forest).toHaveLength(1);
    expect(forest[0]!.group.displayName).toBe('研发');
    expect(forest[0]!.children[0]!.group.name).toBe('qa-1');
  });

  it('lists groups with member counts from every binding that names them', async () => {
    const client = createClient({
      fetchImpl: (async (input) => {
        const url = String(input);
        if (url.includes('/groupbindings')) {
          return json({
            items: [
              { groupRef: { name: 'eng-1' }, users: ['a', 'b'] },
              { groupRef: { name: 'eng-1' }, users: ['c'] },
            ],
          });
        }
        return json({
          items: [{
            metadata: {
              name: 'eng-1',
              generateName: 'eng',
              annotations: { 'kubesphere.io/description': 'n/a' },
            },
          }],
        });
      }) as typeof fetch,
    });
    expect(await workspaceGroupsApi(client).list({ workspace: 'team' })).toEqual([
      {
        name: 'eng-1',
        generateName: 'eng',
        displayName: 'eng',
        alias: '',
        description: 'n/a',
        parent: '',
        workspaceRole: '',
        memberCount: 3,
        createdAt: '',
      },
    ]);
  });

  it('creates a group with generateName then posts a workspace role binding array', async () => {
    const calls: { url: string; method?: string | undefined; body?: string | undefined }[] = [];
    const client = createClient({
      fetchImpl: (async (input, init) => {
        const url = String(input);
        calls.push({ url, method: init?.method, body: init?.body ? String(init.body) : undefined });
        if (url.includes('/groups') && init?.method === 'POST') {
          return json({ metadata: { name: 'eng-abc', generateName: 'eng' } });
        }
        return json({});
      }) as typeof fetch,
    });
    const created = await workspaceGroupsApi(client).create({
      workspace: 'team',
      generateName: 'eng',
      alias: '研发',
      parent: '',
      workspaceRole: 'team-viewer',
    });
    expect(created.name).toBe('eng-abc');
    expect(calls[0]!.method).toBe('POST');
    expect(calls[0]!.url).toContain('/workspaces/team/groups');
    expect(JSON.parse(calls[0]!.body ?? '{}').metadata.generateName).toBe('eng');
    expect(calls[1]!.url).toContain('/workspacerolebindings');
    const roleBody = JSON.parse(calls[1]!.body ?? '[]') as Array<Record<string, unknown>>;
    expect(Array.isArray(roleBody)).toBe(true);
    expect((roleBody[0]!.subjects as Array<Record<string, string>>)[0]!.name).toBe('eng-abc');
  });

  it('adds members as a userName/groupName array after the account exists', async () => {
    const calls: { url: string; method?: string | undefined; body?: string | undefined }[] = [];
    const client = createClient({
      fetchImpl: (async (input, init) => {
        calls.push({ url: String(input), method: init?.method, body: init?.body ? String(init.body) : undefined });
        if (String(input).includes('/users/alice')) return json({ metadata: { name: 'alice' } });
        return json({});
      }) as typeof fetch,
    });
    await workspaceGroupsApi(client).addMembers({ workspace: 'team', group: 'eng-abc', usernames: ['alice'] });
    expect(calls[0]!.url).toContain('/users/alice');
    expect(calls[1]!.method).toBe('POST');
    expect(JSON.parse(calls[1]!.body ?? '[]')).toEqual([{ userName: 'alice', groupName: 'eng-abc' }]);
  });

  it('does not bind a missing account', async () => {
    const client = createClient({
      fetchImpl: (async () => json({})) as typeof fetch,
    });
    await expect(workspaceGroupsApi(client).addMembers({ workspace: 'team', group: 'eng', usernames: ['missing'] }))
      .rejects.toThrow('User account does not exist');
  });

  it('removes a member by deleting the labelled groupbinding', async () => {
    const methods: Array<string | undefined> = [];
    const urls: string[] = [];
    const client = createClient({
      fetchImpl: (async (input, init) => {
        urls.push(String(input));
        methods.push(init?.method);
        if (String(input).includes('/groupbindings') && (init?.method ?? 'GET') !== 'DELETE') {
          return json({ items: [{ metadata: { name: 'bind-1' }, groupRef: { name: 'eng' }, users: ['alice'] }] });
        }
        return json({});
      }) as typeof fetch,
    });
    await workspaceGroupsApi(client).removeMember({ workspace: 'team', group: 'eng', username: 'alice' });
    expect(urls[0]).toContain('labelSelector=iam.kubesphere.io%2Fgroup-ref%3Deng');
    expect(urls[0]).toContain('iam.kubesphere.io%2Fuser-ref%3Dalice');
    expect(methods[1]).toBe('DELETE');
    expect(urls[1]).toContain('/groupbindings/bind-1');
  });
});

describe('project roles of a member', () => {
  /*
   * KubeSphere binds project roles as ordinary namespaced RoleBindings whose subjects carry the user
   * name, so this is the only thing standing between a role binding and the column the detail page
   * shows. Two things must hold: only bindings that actually name this user count, and a user bound
   * to two roles in one project sees both.
   */
  it('collects the roles a user holds and ignores everyone else', () => {
    const bindings = [
      { roleRef: { name: 'viewer' }, subjects: [{ kind: 'User', name: 'alice' }] },
      { roleRef: { name: 'editor' }, subjects: [{ kind: 'User', name: 'alice' }, { kind: 'User', name: 'bob' }] },
      { roleRef: { name: 'admin' }, subjects: [{ kind: 'User', name: 'bob' }] },
      { roleRef: { name: 'viewer' }, subjects: [] },
    ];
    expect(rolesForUser(bindings, 'alice')).toEqual(['editor', 'viewer']);
  });

  it('returns nothing for a user with no binding', () => {
    const bindings = [{ roleRef: { name: 'admin' }, subjects: [{ kind: 'User', name: 'bob' }] }];
    expect(rolesForUser(bindings, 'carol')).toEqual([]);
  });
});
