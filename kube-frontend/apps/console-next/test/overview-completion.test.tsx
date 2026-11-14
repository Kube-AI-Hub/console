import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { ClusterOverviewPage } from '@/pages/cluster/ClusterOverviewPage';
import { NodeRankingPanel, rankValue } from '@/pages/cluster/NodeRankingPanel';
import { ComponentsPage } from '@/pages/cluster/ComponentsPage';
import { UserKubeconfigDialog } from '@/pages/cluster/UserKubeconfigDialog';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, search }: { children: React.ReactNode; to: string; params: Record<string, string>; search?: Record<string, string> }) =>
    <a href={Object.entries(params).reduce((url, [key, value]) => url.replace(`$${key}`, value), to) +
      (search ? `?${new URLSearchParams(search)}` : '')}>{children}</a>,
}));
vi.mock('@/shell/AuthProvider', () => ({ useAuth: () => ({ user: { name: 'admin' } }) }));
function mount(element: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { client, ...render(<QueryClientProvider client={client}><I18nProvider locale="zh">{element}</I18nProvider></QueryClientProvider>) };
}
function series(name: string, value: string) {
  return { metric_name: name, data: { result: [{ metric: {}, value: [1, value] }] } };
}
describe('overview completion', () => {
  it('renders GPU use versus allocation, memory, disk and all scheduler outcomes', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.includes('/monitoring.')) return Response.json({ total_item: 0, results: [
        series('cluster_gpu_total', '15'), series('cluster_gpu_usage', '1.91'), series('cluster_gpu_allocated', '6'),
        series('cluster_gpu_memory_usage', '0'), series('cluster_gpu_memory_total', String(2 ** 40)),
        series('cluster_disk_size_usage', String(2 ** 30)), series('cluster_disk_size_capacity', String(2 ** 40)),
        { metric_name: 'scheduler_schedule_attempts', data: { result: [
          { metric: { result: 'error' }, value: [1, '1'] }, { metric: { result: 'unschedulable' }, value: [1, '226'] },
        ] } },
      ] });
      if (url.pathname.endsWith('/components')) return Response.json([]);
      if (url.pathname.endsWith('/nodes')) return Response.json({ items: [], totalItems: 0 });
      return Response.json({ metadata: { name: 'host' }, status: {} });
    }));
    const view = mount(<ClusterOverviewPage cluster="host" />);
    await waitFor(() => expect(view.container.querySelector('[data-ai-id="overview:usage-gpu"] [data-ai-field="used"]')).toHaveTextContent('1.91 卡'));
    expect(view.container.querySelector('[data-ai-id="overview:usage-gpu"] [data-ai-field="total"]')).toHaveTextContent('15 卡');
    expect(view.container.querySelector('[data-ai-id="overview:usage-gpu"]')).toHaveTextContent('已分配 6 卡');
    expect(view.container.querySelector('[data-ai-id="overview:usage-gpu"]')).toHaveTextContent('13%');
    expect(view.container.querySelector('[data-ai-id="overview:usage-gpu-memory"]')).toHaveTextContent('0%');
    expect(view.container.querySelector('[data-ai-id="overview:usage-disk"]')).toHaveTextContent('1.0GiB');
    await waitFor(() => expect(view.container.querySelector('[data-ai-id="overview:schedule-error"]')).toHaveTextContent('1'));
    expect(view.container.querySelector('[data-ai-id="overview:unschedulable"]')).toHaveTextContent('226');
    expect(view.container.querySelector('[data-ai-id="overview:visibility"]')).toHaveTextContent('只有被授权');
    const sidebar = view.container.querySelector('[data-ai-id="overview:identity-column"]')!;
    expect(sidebar.querySelector('[data-ai-id="overview:basic"]')?.nextElementSibling).toHaveAttribute('data-ai-id', 'overview:kubernetes-status');
    expect(view.container.querySelector('[data-ai-id="overview:usage-gpu"]')).not.toHaveTextContent('GPU 利用率');
    expect(view.container.querySelector('[data-ai-id="overview:usage-disk"] [data-ai-field="allocated"]')).toBeEmptyDOMElement();
    for (const row of view.container.querySelectorAll('[data-ai-id^="overview:usage-"]')) {
      expect(row.querySelectorAll('[data-ai-field]')).toHaveLength(5);
    }
  });
  it('requests Top5 globally and keeps the selected ranking when opening the full page', async () => {
    const calls: URL[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input)); calls.push(url);
      if (url.searchParams.get('type') !== 'rank') return Response.json({ items: [], totalItems: 0 });
      const name = url.searchParams.get('sort_metric')!;
      return Response.json({ total_item: 12, results: [{ metric_name: name, data: { result:
        Array.from({ length: Number(url.searchParams.get('limit')) }, (_, i) => ({
          metric: { node: `n${12 - i}` }, value: [1, String(.9 - i * .1)],
        })) } }] });
    }));
    const view = mount(<NodeRankingPanel cluster="host" preview />);
    await screen.findByText('n12');
    expect(view.container.querySelectorAll('tbody tr')).toHaveLength(5);
    expect(calls.find((url) => url.searchParams.get('type') === 'rank')?.searchParams.get('limit')).toBe('5');
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: '1 分钟 CPU 平均负载' }));
    await waitFor(() => expect(calls.at(-1)?.searchParams.get('sort_metric')).toBe('node_load1'));
    expect(screen.getByRole('link', { name: '查看更多' })).toHaveAttribute('href', '/kube-frontend/clusters/host/node-usage?metric=node_load1');
  });
  it('filters component groups without changing the cluster', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([
      { name: 'api', namespace: 'kube-system', healthyBackends: 1, totalBackends: 1 },
      { name: 'prometheus', namespace: 'kubesphere-monitoring-system', healthyBackends: 1, totalBackends: 1 },
    ])));
    mount(<ComponentsPage cluster="host" initialType="monitoring" />);
    await screen.findByText('prometheus');
    expect(screen.queryByText('api')).toBeNull();
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: '全部组件' }));
    expect(await screen.findByText('api')).toBeInTheDocument();
  });
  it('does not store kubeconfig after closing and shows no retry for a forbidden response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('apiVersion: v1\nclusters: []')));
    const view = mount(<UserKubeconfigDialog cluster="host" username="admin" onClose={vi.fn()} />);
    const content = await screen.findByRole('textbox', { name: 'kubeconfig' });
    await waitFor(() => expect(content).toHaveValue('apiVersion: v1\nclusters: []'));
    expect(content).toHaveAttribute('readonly');
    expect(view.client.getQueryData(['user-kubeconfig', 'host', 'admin'])).toBeTruthy();
    view.unmount();
    expect(view.client.getQueryData(['user-kubeconfig', 'host', 'admin'])).toBeUndefined();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('forbidden', { status: 403 })));
    const denied = mount(<UserKubeconfigDialog cluster="host" username="denied" onClose={vi.fn()} />);
    await waitFor(() => expect(denied.client.getQueryState(['user-kubeconfig', 'host', 'denied'])?.status).toBe('error'));
    expect(screen.queryByRole('button', { name: '下载 kubeconfig' })).toBeNull();
    expect(denied.container.querySelector('[data-ai-id="overview:kubeconfig-retry"]')).toBeNull();
    expect(within(screen.getByRole('dialog')).queryByDisplayValue('apiVersion: v1\nclusters: []')).toBeNull();
  });
  it('keeps real zero, load units and allocation ratios distinct', () => {
    expect(rankValue({ name: 'n', values: { node_load1: 2 } }, 'node_load1')).toBe('2');
    expect(rankValue({ name: 'n', values: { node_gpu_allocated: 6, node_gpu_total: 7 } }, 'node_gpu_allocated')).toBe('86%');
    expect(rankValue({ name: 'n', values: { node_cpu_utilisation: 0 } }, 'node_cpu_utilisation')).toBe('0%');
    expect(rankValue({ name: 'n', values: {} }, 'node_cpu_utilisation')).toBe('-');
  });
});
