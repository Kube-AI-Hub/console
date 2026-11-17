import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/i18n';
import { WorkspaceRoleDialog } from '@/pages/workspace/WorkspaceRoleDialog';
import { isReadOnlyWorkspaceRole } from '@/pages/workspace/WorkspaceRolesPage';
import type { WorkspaceRoleSummary } from '@kube-ai-hub/api-client';

/**
 * Workspace-role writes, UI side.
 *
 * The role dialog must not submit without a template (a role with no rules would look
 * broken), and platform-maintained roles must not expose row actions. Both are pure rules
 * worth pinning outside the E2E.
 */
const templates = [
  { name: 'role-template-view-members', alias: '查看成员', description: '', ruleCount: 1 },
  { name: 'role-template-view-roles', alias: '查看角色', description: '', ruleCount: 1 },
];

function stubFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(
        JSON.stringify({
          items: templates.map((template) => ({
            metadata: { name: template.name, annotations: { 'kubesphere.io/alias-name': template.alias } },
            rules: [{}],
          })),
        }),
        {
        status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    ),
  );
}

function renderDialog(onSubmit = vi.fn(), mode: 'create' | 'permissions' = 'create') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="zh">
        <WorkspaceRoleDialog
          open
          onOpenChange={() => undefined}
          mode={mode}
          workspace="ws"
          {...(mode === 'permissions'
            ? {
                role: {
                  name: 'custom',
                  alias: '自定义',
                  description: '',
                  ruleCount: 2,
                  aggregationRoles: ['role-template-view-members'],
                  createdAt: '',
                  creator: 'admin',
                  annotations: {},
                },
              }
            : {})}
          onSubmit={onSubmit}
        />
      </I18nProvider>
    </QueryClientProvider>,
  );
  return onSubmit;
}

describe('isReadOnlyWorkspaceRole', () => {
  const row = (name: string, creator: string): WorkspaceRoleSummary => ({ name, alias: '', ruleCount: 0, createdAt: '', creator });
  it('keeps platform roles and templates read-only', () => {
    expect(isReadOnlyWorkspaceRole(row('system-workspace-admin', 'system'))).toBe(true);
    expect(isReadOnlyWorkspaceRole(row('role-template-view-members', 'admin'))).toBe(true);
    expect(isReadOnlyWorkspaceRole(row('custom', 'admin'))).toBe(false);
  });
});

describe('WorkspaceRoleDialog', () => {
  beforeEach(() => stubFetch());
  afterEach(() => vi.unstubAllGlobals());

  it('rejects a missing name and missing templates', async () => {
    const onSubmit = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: '确认' }));
    expect(screen.getByText('请填写合法名称（小写字母、数字、连字符）。')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('developer'), { target: { value: 'custom' } });
    fireEvent.click(screen.getByRole('button', { name: '确认' }));
    expect(screen.getByText('请至少选择一个权限模板。')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the checked template names', async () => {
    const onSubmit = renderDialog();
    fireEvent.change(screen.getByPlaceholderText('developer'), { target: { value: 'custom' } });
    await waitFor(() => expect(screen.getByText('查看成员')).toBeTruthy());
    fireEvent.click(document.querySelector('[data-ai-id="workspace-roles:template:role-template-view-members"]') as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: '确认' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'custom', templates: ['role-template-view-members'] }),
    );
  });

  it('prefills an existing role templates in permissions mode', async () => {
    const onSubmit = renderDialog(vi.fn(), 'permissions');
    await waitFor(() => expect(screen.getByText('查看成员')).toBeTruthy());
    expect(screen.getByRole('button', { name: '确认' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '确认' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ templates: ['role-template-view-members'] }));
  });
});
