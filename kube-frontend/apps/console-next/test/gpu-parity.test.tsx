import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { GpusPage } from '@/pages/cluster/GpusPage';
import { GpuMonitorPanel } from '@/pages/cluster/GpuMonitorPanel';
import { GpuDetailPage } from '@/pages/cluster/GpuDetailPage';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useParams: () => ({ name: 'GPU-x' }),
}));
const raw = { uuid: 'GPU-x', nodeName: 'gpu02', deviceVendor: 'nvidia', type: 'B200', health: true,
  gpuMemoryUsed: 1024, gpuMemoryTotal: 2048, gpuCoreUsed: 0, gpuCoreTotal: 100, vgpuUsed: 0, vgpuTotal: 0, numa: 0, mode: 'default' };
function mount(element: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <I18nProvider locale="zh">{element}</I18nProvider></QueryClientProvider>);
}
describe('GPU pages', () => {
  it('keeps global statistics while filtering and paginates via shared controls', async () => {
    const calls: URL[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input)); calls.push(url);
      return url.pathname.endsWith('/stats') ? Response.json({ total: 45, healthy: 40, 'nvidia-B200': 45 }) :
        Response.json({ items: [raw], totalItems: 45 });
    }));
    mount(<GpusPage cluster="host" />);
    await screen.findByText('GPU-x');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '下一页' }));
    await waitFor(() => expect(calls.some((url) => url.searchParams.get('page') === '2')).toBe(true));
    await user.type(screen.getByRole('textbox', { name: '型号' }), 'B200');
    await user.type(screen.getByRole('searchbox', { name: '按完整 GPU UUID 搜索' }), 'GPU-x');
    await waitFor(() => expect(calls.some((url) => url.searchParams.get('uuid') === 'GPU-x' && url.searchParams.get('type') === 'B200' && url.searchParams.get('page') === '1')).toBe(true));
    expect(document.querySelector('[data-ai-id="cluster-gpus:health"]')).toHaveAttribute('data-ai-total', '45');
    expect(calls.filter((url) => url.pathname.endsWith('/stats')).every((url) => url.search === '')).toBe(true);
    expect(screen.getByText('英伟达')).toBeInTheDocument();
    expect(screen.getByText('独占')).toBeInTheDocument();
  });
  it('shows real zero utilization and converts monitoring bytes to GiB, not MiB', async () => {
    const at = Math.floor(Date.now() / 1000) - 30;
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ results: [
      { metric_name: 'gpu_card_utilisation', data: { result: [{ metric: { node: 'gpu02', uuid: 'GPU-x' }, values: [[at, '0']] }] } },
      { metric_name: 'gpu_card_memory_usage', data: { result: [{ metric: { node: 'gpu02', uuid: 'GPU-x' }, values: [[at, '1073741824']] }] } },
    ] })));
    mount(<GpuMonitorPanel cluster="host" node="gpu02" uuid="GPU-x" />);
    expect(await screen.findByText('1.00 GiB')).toBeInTheDocument();
    expect(screen.getByText('0.00 %')).toBeInTheDocument();
    expect(document.querySelector('[data-ai-id="gpu-detail:metric:power:latest"]')).toHaveTextContent('-');
  });
  it('loads associated resources only after their tab is selected', async () => {
    const calls: URL[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input)); calls.push(url);
      return Response.json(url.pathname.endsWith('/gpus') ? { items: [raw], totalItems: 1 } : { items: [], totalItems: 0 });
    }));
    mount(<GpuDetailPage cluster="host" />);
    await screen.findByText('独占');
    expect(calls.some((url) => url.pathname.endsWith('/pods'))).toBe(false);
    await userEvent.click(screen.getByRole('tab', { name: '容器组' }));
    await waitFor(() => expect(calls.some((url) => url.searchParams.get('gpuUuid') === 'GPU-x' && url.searchParams.get('nodeName') === 'gpu02')).toBe(true));
  });
});
