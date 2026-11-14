import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { LoginHistoryPanel } from '@/pages/platform/LoginHistoryPanel';
import { UserResetPasswordDialog } from '@/pages/platform/UserResetPasswordDialog';

afterEach(() => vi.unstubAllGlobals());

function mount(node: ReactNode) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider locale="zh">{node}</I18nProvider>
    </QueryClientProvider>,
  );
}

function record(name: string, spec: Record<string, unknown> = { success: true, sourceIP: '10.0.0.1', reason: 'ok' }) {
  return { metadata: { name, creationTimestamp: '2026-11-14T21:00:23Z' }, spec };
}

describe('login history panel', () => {
  it('renders success, failure and unknown without turning unknown into failed, and pages past TopN', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo) => {
        const url = new URL(String(input), 'http://localhost');
        urls.push(`${url.pathname}?${url.searchParams}`);
        const page = Number(url.searchParams.get('page') ?? '1');
        const all = [
          ...Array.from({ length: 10 }, (_, index) => record(`ok-${index}`)),
          record('fail-1', { success: false, sourceIP: '10.0.0.9', reason: 'invalid password' }),
          record('unknown-1', { reason: 'legacy' }),
        ];
        const items = page === 1 ? all.slice(0, 10) : all.slice(10);
        return Response.json({ totalItems: 12, items });
      }),
    );

    mount(<LoginHistoryPanel name="admin" />);
    await screen.findByText('共 12 条');
    expect(screen.getAllByText('成功')).toHaveLength(10);
    expect(screen.queryByText('失败')).not.toBeInTheDocument();
    expect(urls[0]).toContain('page=1');
    expect(urls[0]).toContain('limit=10');

    await userEvent.click(screen.getByRole('button', { name: '下一页' }));
    await waitFor(() => expect(screen.getByText('失败')).toBeVisible());
    expect(screen.getByText('invalid password')).toBeVisible();
    expect(screen.getByText('legacy')).toBeVisible();
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
    expect(urls.some((url) => url.includes('page=2'))).toBe(true);
  });
});

describe('reset password dialog', () => {
  it('refuses a weak or mismatched password and keeps the draft on a failed save', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ metadata: { name: 'alice' }, spec: { email: 'alice@example.com' } })),
    );
    const submit = vi.fn().mockRejectedValue(new Error('permission denied'));
    const cancel = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const tree = (error?: unknown) => (
      <QueryClientProvider client={client}>
        <I18nProvider locale="zh">
          <UserResetPasswordDialog name="alice" pending={false} {...(error ? { error } : {})} onCancel={cancel} onSubmit={submit} />
        </I18nProvider>
      </QueryClientProvider>
    );
    const { rerender } = render(tree());
    expect(await screen.findByDisplayValue('alice@example.com')).toBeDisabled();
    const password = document.getElementById('user-reset:password') as HTMLInputElement;
    const confirm = document.getElementById('user-reset:confirm') as HTMLInputElement;

    await userEvent.type(password, 'weak');
    await userEvent.type(confirm, 'weak');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByText(/密码至少 8 位|密码需包含/)).toBeVisible();

    await userEvent.clear(password);
    await userEvent.clear(confirm);
    await userEvent.type(password, 'TcE2e@2026B');
    await userEvent.type(confirm, 'TcE2e@2026C');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByText('两次输入的密码不一致。')).toBeVisible();

    await userEvent.clear(confirm);
    await userEvent.type(confirm, 'TcE2e@2026B');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith('TcE2e@2026B'));
    rerender(tree(new Error('permission denied')));
    expect(await screen.findByText('permission denied')).toBeVisible();
    expect(cancel).not.toHaveBeenCalled();
    expect((document.getElementById('user-reset:password') as HTMLInputElement).value).toBe('TcE2e@2026B');
  }, 15_000);
});
