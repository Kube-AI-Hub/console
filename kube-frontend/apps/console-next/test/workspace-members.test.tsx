import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { WorkspaceMemberDialog } from '@/pages/workspace/WorkspaceMemberDialog';
import { DeleteDialog } from '@/components/resource/DeleteDialog';

afterEach(() => vi.unstubAllGlobals());

function mountDialog(member?: { username: string; role: string; status: string; lastLogin: string }) {
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
    const { submit, close } = mountDialog({ username: 'alice', role: 'team-viewer', status: 'Active', lastLogin: '' });
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
    const { submit } = mountDialog({ username: 'alice', role: 'other-admin', status: 'Active', lastLogin: '' });
    await screen.findByRole('combobox');
    await userEvent.click(screen.getByRole('button', { name: '确认' }));
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByText('请选择当前企业空间的有效角色。')).toBeVisible();
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
