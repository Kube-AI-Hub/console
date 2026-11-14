import { render, screen, within, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { toNodeDetail } from '@kube-ai-hub/api-client';
import { I18nProvider } from '@/i18n';
import { NodeHardwarePanel } from '@/pages/cluster/NodeHardwarePanel';
import { ClusterOverviewPage } from '@/pages/cluster/ClusterOverviewPage';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}));
vi.mock('@/shell/AuthProvider', () => ({ useAuth: () => ({ user: { name: 'admin' } }) }));
function mount(element: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <I18nProvider locale="zh">{element}</I18nProvider></QueryClientProvider>);
}
describe('hardware and overview panels', () => {
  it('renders device, index, model, port and firmware as well as counts', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      return Response.json(path.includes('/ports') ? { totalItems: 1, items: [
        { nodeName: 'gpu02', device: 'mlx5_0', port: 1, stateName: 'active', physState: 5,
          linkLayerName: 'InfiniBand', linkSpeed: 50e9, healthy: true, firmware: '1.2.3' },
      ] } : { totalItems: 1, items: [{ nodeName: 'gpu02', uuid: 'card-0', index: 0, type: 'B200', health: true }] });
    }));
    mount(<NodeHardwarePanel cluster="host" node={toNodeDetail({ metadata: { name: 'gpu02' } })} />);
    expect(await screen.findByText('mlx5_0')).toBeInTheDocument();
    expect(await screen.findByText('B200')).toBeInTheDocument();
    expect(screen.getByText('1.2.3')).toBeInTheDocument();
    expect(screen.getByText('400 Gb/s')).toBeInTheDocument();
    expect(screen.getByText('card-0').closest('tr')?.querySelector('td')).toHaveTextContent('0');
  });
  it('keeps partial cluster measurements unknown and preserves proxy agent instructions', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.includes('/components/')) return Response.json({ results: [] });
      if (path.includes('/monitoring.')) return Response.json({ results: [
        { metric_name: 'cluster_cpu_usage', data: { result: [{ metric: {}, value: [1, '0'] }] } },
        { metric_name: 'cluster_cpu_total', data: { result: [{ metric: {}, value: [1, '8'] }] } },
      ] });
      if (path.includes('/tower.')) return Response.json({ message: 'tower missing' }, { status: 404 });
      return Response.json({ metadata: { name: 'member' }, spec: { connection: { type: 'proxy' } }, status: {} });
    }));
    const view = mount(<ClusterOverviewPage cluster="member" />);
    await waitFor(() => expect(view.container.querySelector('[data-ai-id="overview:usage-cpu"] [data-ai-field="total"]')).toHaveTextContent('8'));
    const cpu = view.container.querySelector('[data-ai-id="overview:usage-cpu"]') as HTMLElement;
    const memory = view.container.querySelector('[data-ai-id="overview:usage-memory"]') as HTMLElement;
    expect(within(cpu).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    expect(memory.querySelector('[data-ai-field="used"]')).toHaveTextContent('-');
    expect(memory.querySelector('[data-ai-field="total"]')).toHaveTextContent('-');
    expect(within(memory).queryByRole('progressbar')).toBeNull();
    expect(view.container.querySelector('[data-ai-id="overview:agent-panel"]')).toBeInTheDocument();
    expect(view.container.querySelector('[data-ai-id="overview:shortcut:kubectl"]')).toBeInTheDocument();
  });
});
