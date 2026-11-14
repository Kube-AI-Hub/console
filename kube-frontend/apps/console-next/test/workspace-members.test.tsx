import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { I18nProvider } from '@/i18n';
import { createQueryClient } from '@/query';
import { WorkspaceMemberDialog } from '@/pages/workspace/WorkspaceMemberDialog';
import { WorkspaceMembersPage } from '@/pages/workspace/WorkspaceMembersPage';
import { DeleteDialog } from '@/components/resource/DeleteDialog';

vi.mock('@/shell/AuthProvider', () => ({ useAuth: () => ({ user: { name: 'admin', initialized: true } }) }));

afterEach(() => vi.unstubAllGlobals());

function mountDialog(member?: { username: string; role: string; status: string; lastLogin: string; email: string }) {
  const submit = vi.fn().mockRejectedValue(new Error('permission denied'));
  const close = vi.fn();
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <I18nProvider locale="zh"><WorkspaceMemberDialog workspace="team" pending={false}
      {...(member ? { member } : {})} onOpenChange={close} onSubmit={submit} /></I18nProvider>
  </QueryClientProvider>);
  return { submit, close };
}

describe('workspace member interactions', () => {
  it('offers the workspace roles, locks the identity while editing, and retains a failed draft', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      items: [{ metadata: { name: 'team-viewer', annotations: { 'kubesphere.io/alias-name': '空间观察员' } } }],
    }), { headers: { 'content-type': 'application/json' } })));
    const { submit, close } = mountDialog({ username: 'alice', role: 'team-viewer', status: 'Active', lastLogin: '', email: '' });
    const username = await screen.findByRole('textbox', { name: /^用户名/ });
    expect(username).toBeDisabled();
    expect(username).toHaveValue('alice');
    expect(screen.getByRole('combobox')).toHaveTextContent('空间观察员');
    await userEvent.click(screen.getByRole('button', { name: '确认' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('permission denied'));
    expect(submit).toHaveBeenCalledWith({ username: 'alice', roleRef: 'team-viewer' });
    expect(username).toHaveValue('alice');
    expect(close).not.toHaveBeenCalled();
  });
  it('blocks assigning a role that is no longer in this workspace', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"items":[{"metadata":{"name":"team-viewer"}}]}',
      { headers: { 'content-type': 'application/json' } })));
    const { submit } = mountDialog({ username: 'alice', role: 'other-admin', status: 'Active', lastLogin: '', email: '' });
    await screen.findByRole('combobox');
    await userEvent.click(screen.getByRole('button', { name: '确认' }));
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByText('请选择当前租户(企业空间)的有效角色。')).toBeVisible();
  });
  it('shows role-read denial without rendering an actionable form', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"message":"forbidden"}', { status: 403 })));
    mountDialog();
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '确认' })).not.toBeInTheDocument();
  });
  it('keeps removal failure inside the shared typed-name confirmation', async () => {
    const confirm = vi.fn();
    render(<I18nProvider locale="zh"><DeleteDialog open names={['alice']} noun="成员"
      resource="workspace-members" error="remove denied" onOpenChange={vi.fn()} onConfirm={confirm} /></I18nProvider>);
    const button = screen.getByRole('button', { name: '删除' });
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox'), 'alice');
    expect(button).toBeEnabled();
    expect(screen.getByRole('alert')).toHaveTextContent('remove denied');
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const membersBody = {
  items: [
    {
      metadata: { name: 'admin', annotations: { 'iam.kubesphere.io/workspacerole': 'team-admin' } },
      spec: { email: 'admin@example.test' },
      status: { state: 'Active', lastLoginTime: '2026-01-01T00:00:00Z' },
    },
    {
      metadata: { name: 'alice', annotations: { 'iam.kubesphere.io/workspacerole': 'team-viewer' } },
      spec: { email: 'alice@example.test' },
      status: {},
    },
  ],
};

function renderMembersPage() {
  const client = createQueryClient();
  const rootRoute = createRootRoute();
  const listRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/kube-frontend/workspaces/$workspace/members',
    component: () => <WorkspaceMembersPage workspace="team" />,
  });
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/kube-frontend/workspaces/$workspace/members/$name',
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([listRoute, detailRoute]),
    history: createMemoryHistory({ initialEntries: ['/kube-frontend/workspaces/team/members'] }),
  });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="zh">
        <RouterProvider router={router} />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('workspace members list', () => {
  it('shows email, i18n status, never-logged-in, and hides write actions on the signed-in user', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(membersBody)));
    renderMembersPage();
    const alice = await screen.findByText('alice');
    expect(alice).toBeVisible();
    expect(screen.getByText('alice@example.test')).toBeVisible();
    expect(screen.getByText('尚未登录')).toBeVisible();
    expect(screen.getAllByText('活跃').length).toBeGreaterThan(0);
    const selfRow = document.querySelector('[data-ai-row="admin"]');
    expect(selfRow?.querySelector('input[type="checkbox"]')).toBeNull();
    expect(selfRow?.querySelector('button[aria-label="更多操作"]')).toBeNull();
    const other = document.querySelector('[data-ai-row="alice"]');
    expect(other?.querySelector('button[aria-label="更多操作"]')).not.toBeNull();
  });
  it('filters the loaded collection by username without a second request', async () => {
    const fetchMock = vi.fn(async () => json(membersBody));
    vi.stubGlobal('fetch', fetchMock);
    renderMembersPage();
    await screen.findByText('alice');
    const calls = fetchMock.mock.calls.length;
    await userEvent.type(screen.getByPlaceholderText('按名称搜索'), 'ali');
    expect(screen.getByText('alice')).toBeVisible();
    expect(screen.queryByText('admin@example.test')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.length).toBe(calls);
  });
});
