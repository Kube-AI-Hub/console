import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { ClusterPodsPage } from '@/pages/cluster/ClusterPodsPage';
import { ClusterWorkloadsPage, CLUSTER_WORKLOAD_KINDS } from '@/pages/cluster/ClusterWorkloadsPage';
import type { WorkloadKind } from '@kube-ai-hub/api-client';

const kinds: WorkloadKind[] = ['pods', ...CLUSTER_WORKLOAD_KINDS];
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function body(name = 'sample') {
  return {
    items: [{ metadata: { name, namespace: 'default', creationTimestamp: '2026-11-01T00:00:00Z' }, spec: {}, status: {} }],
    totalItems: 135,
  };
}

function page(kind: WorkloadKind, cluster = 'host') {
  return kind === 'pods' ? <ClusterPodsPage cluster={cluster} /> : <ClusterWorkloadsPage cluster={cluster} kind={kind} />;
}

function mount(kind: WorkloadKind) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="zh">{page(kind)}</I18nProvider>
    </QueryClientProvider>,
  );
}

describe('cluster list controls', () => {
  it.each(kinds)('%s sends the selected size, resets page and refreshes current data', async (kind) => {
    const requests: URL[] = [];
    let revision = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/namespaces')) return json({ items: [], totalItems: 0 });
      requests.push(url);
      return json(body(`sample-${revision}`));
    }));
    mount(kind);
    await screen.findByText('sample-0');
    expect(requests[0]!.searchParams.get('limit')).toBe('20');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '下一页' }));
    await waitFor(() => expect(requests.at(-1)!.searchParams.get('page')).toBe('2'));
    await user.click(screen.getByRole('combobox', { name: '每页条数' }));
    await user.click(await screen.findByRole('option', { name: /^50$/ }));
    await waitFor(() => {
      expect(requests.at(-1)!.searchParams.get('limit')).toBe('50');
      expect(requests.at(-1)!.searchParams.get('page')).toBe('1');
    });
    await user.type(screen.getByRole('searchbox', { name: '按名称搜索' }), 'sample');
    expect(screen.getByRole('searchbox', { name: '按名称搜索' })).toHaveValue('sample');
    await waitFor(() => expect(requests.at(-1)!.searchParams.get('name')).toBe('sample'));
    revision = 1;
    const count = requests.length;
    await user.click(screen.getByRole('button', { name: '刷新' }));
    await screen.findByText('sample-1');
    expect(requests.length).toBeGreaterThan(count);
    expect(requests.at(-1)!.searchParams.get('limit')).toBe('50');
    expect(requests.at(-1)!.searchParams.get('name')).toBe('sample');
    expect(document.querySelector(`[data-ai-id="cluster-${kind}:page-size"]`)).toHaveTextContent('50');
  });

  it('keeps rows and marks busy during paging, but not after a resource or cluster switch', async () => {
    let release: ((response: Response) => void) | undefined;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/namespaces')) return json({ items: [] });
      if (url.searchParams.get('page') === '1' && url.pathname.endsWith('/deployments')) return json(body());
      return new Promise<Response>((resolve) => { release = resolve; });
    }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const tree = (kind: WorkloadKind, cluster: string) => (
      <QueryClientProvider client={client}><I18nProvider locale="zh">{page(kind, cluster)}</I18nProvider></QueryClientProvider>
    );
    const { rerender } = render(tree('deployments', 'host'));
    await screen.findByText('sample');
    await userEvent.click(screen.getByRole('button', { name: '下一页' }));
    expect(screen.getByText('sample')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: '刷新' })).toHaveAttribute('aria-busy', 'true'));
    expect(screen.getByRole('button', { name: '刷新' })).toBeDisabled();
    await act(async () => release!(json(body('page-two'))));
    await screen.findByText('page-two');
    rerender(tree('services', 'host'));
    expect(screen.queryByText('page-two')).toBeNull();
    await act(async () => release!(json(body('service-row'))));
    await screen.findByText('service-row');
    rerender(tree('services', 'other'));
    expect(screen.queryByText('service-row')).toBeNull();
    await act(async () => release!(json(body('other-row'))));
    await screen.findByText('other-row');
  });

  it('keeps same-named objects from different namespaces as distinct rows', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sample = body();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes('/namespaces')
        ? json({ items: [] })
        : json({ ...sample, items: [
          sample.items[0],
          { ...sample.items[0], metadata: { ...sample.items[0]!.metadata, namespace: 'other' } },
        ] }),
    ));
    mount('deployments');
    expect(await screen.findAllByRole('link', { name: 'sample' })).toHaveLength(2);
    expect(errors.mock.calls.flat().join(' ')).not.toContain('same key');
    errors.mockRestore();
  });

  it.each([403, 500])('shows an error after a failed refresh (%s)', async (status) => {
    let fail = false;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/namespaces')) return json({ items: [] });
      return fail ? json({ message: 'refresh failed' }, status) : json(body());
    }));
    mount('pods');
    await screen.findByText('sample');
    fail = true;
    await userEvent.click(screen.getByRole('button', { name: '刷新' }));
    await waitFor(() => expect(document.querySelector('[data-ai-id="cluster-pods:surface"]')).toHaveAttribute('data-ai-state', 'error'));
    if (status === 403) expect(screen.queryByRole('button', { name: '重试' })).toBeNull();
    else expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
  });
});
