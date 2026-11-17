import { describe, expect, it } from 'vitest';
import { createClient } from '../src/client';
import { workspaceRolesApi, workspaceRolesWriteApi } from '../src/access';

/**
 * Workspace-role writes.
 *
 * A custom workspace role is defined by **template names in an annotation**, not by
 * hand-written rules: ks-apiserver aggregates them. These tests pin that shape, the
 * template filter, and the merge-patch null rule.
 */
function recordingClient(handler: (method: string, url: string, body: unknown) => unknown) {
  const calls: Array<{ method: string; url: string; body: unknown }> = [];
  const client = createClient({
    baseUrl: 'http://apiserver',
    fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      calls.push({ method, url: String(input), body });
      return new Response(JSON.stringify(handler(method, String(input), body) ?? {}), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch,
  });
  return { client, calls };
}

const role = (name: string, annotations: Record<string, string>) => ({
  apiVersion: 'iam.kubesphere.io/v1alpha2',
  kind: 'WorkspaceRole',
  metadata: { name, creationTimestamp: '2026-01-01T00:00:00Z', annotations },
  rules: [{ verbs: ['get'] }],
});

describe('workspaceRolesApi.templates', () => {
  it('reads the template-marked subset of the workspace collection', async () => {
    const { client, calls } = recordingClient(() => ({
      items: [role('role-template-view-members', { 'kubesphere.io/alias-name': '查看成员' })],
    }));
    const templates = await workspaceRolesApi(client).templates({ workspace: 'ws' });
    expect(calls[0]?.url).toContain('/kapis/iam.kubesphere.io/v1alpha2/workspaces/ws/workspaceroles');
    expect(calls[0]?.url).toContain('labelSelector=iam.kubesphere.io%2Frole-template');
    expect(templates[0]).toEqual({
      name: 'role-template-view-members',
      alias: '查看成员',
      description: '',
      ruleCount: 1,
    });
  });
});

describe('workspaceRolesApi.get', () => {
  it('parses the aggregation annotation into template names', async () => {
    const { client } = recordingClient(() =>
      role('custom', {
        'iam.kubesphere.io/aggregation-roles': JSON.stringify(['role-template-view-members']),
        'kubesphere.io/alias-name': '自定义',
      }),
    );
    const detail = await workspaceRolesApi(client).get({ workspace: 'ws', name: 'custom' });
    expect(detail.aggregationRoles).toEqual(['role-template-view-members']);
    expect(detail.alias).toBe('自定义');
    expect(detail.ruleCount).toBe(1);
  });
});

describe('workspaceRolesWriteApi.create', () => {
  it('posts a WorkspaceRole with template aggregation and no hand-written rules', async () => {
    const { client, calls } = recordingClient(() => role('custom', {}));
    await workspaceRolesWriteApi(client).create({
      workspace: 'ws',
      name: 'custom',
      alias: ' 自定义 ',
      description: '',
      templates: ['role-template-view-members', 'role-template-view-roles'],
    });
    const post = calls.find((call) => call.method === 'POST');
    expect(post?.url).toContain('/workspaces/ws/workspaceroles');
    expect(post?.body).toMatchObject({
      apiVersion: 'iam.kubesphere.io/v1alpha2',
      kind: 'WorkspaceRole',
      metadata: {
        name: 'custom',
        annotations: {
          'iam.kubesphere.io/aggregation-roles': JSON.stringify([
            'role-template-view-members',
            'role-template-view-roles',
          ]),
          'kubesphere.io/alias-name': '自定义',
        },
      },
      rules: [],
    });
  });
});

describe('workspaceRolesWriteApi.updateInfo', () => {
  it('sends null for removed annotations', async () => {
    const { client, calls } = recordingClient((method) =>
      method === 'GET' ? role('custom', { 'kubesphere.io/alias-name': '旧', 'kubesphere.io/creator': 'admin' }) : {},
    );
    await workspaceRolesWriteApi(client).updateInfo({
      workspace: 'ws',
      name: 'custom',
      annotations: { 'kubesphere.io/creator': 'admin', 'kubesphere.io/description': '新' },
    });
    expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({
      metadata: { annotations: { 'kubesphere.io/alias-name': null, 'kubesphere.io/description': '新' } },
    });
  });
});

describe('workspaceRolesWriteApi.setTemplates / remove', () => {
  it('replaces the aggregation annotation and deletes by name', async () => {
    const { client, calls } = recordingClient(() => ({}));
    await workspaceRolesWriteApi(client).setTemplates({ workspace: 'ws', name: 'custom', templates: ['t1'] });
    await workspaceRolesWriteApi(client).remove({ workspace: 'ws', name: 'custom' });
    expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({
      metadata: { annotations: { 'iam.kubesphere.io/aggregation-roles': JSON.stringify(['t1']) } },
    });
    expect(calls.find((call) => call.method === 'DELETE')?.url).toContain('/workspaces/ws/workspaceroles/custom');
  });
});
