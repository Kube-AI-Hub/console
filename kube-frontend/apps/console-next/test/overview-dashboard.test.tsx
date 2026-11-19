import * as React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { OverviewResourcePanel, NodeSummaryPanel } from '@/pages/cluster/OverviewResourcePanel';
import { useOverviewRefresh } from '@/pages/cluster/useOverviewRefresh';
import { formatOverviewValue, overviewRatioPoints, OVERVIEW_RESOURCES } from '@/pages/cluster/overviewResourceMetrics';
import { KubectlConsoleDialog } from '@/components/resource/KubectlConsoleDialog';

const identity = vi.hoisted(() => ({ name: 'admin' }));
vi.mock('@/shell/AuthProvider', () => ({ useAuth: () => ({ user: { name: identity.name } }) }));
// The node block links to the full node list; a real router is not mounted here.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, ...props }: { children: React.ReactNode; to: string; params?: Record<string, string> }) =>
    <a href={Object.entries(params ?? {}).reduce((url, [key, value]) => url.replace(`$${key}`, value), to)} {...props}>{children}</a>,
}));
vi.mock('@/components/resource/ExecConsoleDialog', () => ({
  ExecConsoleDialog: ({ onClose }: { onClose: () => void }) => <div data-ai-id="fake-exec"><button onClick={onClose}>Close session</button></div>,
}));
function mount(element: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return { client, ...render(<QueryClientProvider client={client}><I18nProvider locale="zh">{element}</I18nProvider></QueryClientProvider>) };
}
afterEach(() => { vi.useRealTimers(); identity.name = 'admin'; });

describe('overview dashboard', () => {
  it('joins ratios by timestamp, retaining zero and excluding missing or zero denominators', () => {
    expect(overviewRatioPoints([
      { name: 'used', points: [{ at: 1, value: 10 }, { at: 2, value: 0 }, { at: 3, value: 5 }, { at: 4, value: NaN }] },
      { name: 'total', points: [{ at: 3, value: 0 }, { at: 1, value: 20 }, { at: 2, value: 10 }, { at: 4, value: 10 }] },
    ], 'used', 'total')).toEqual([{ at: 1, value: 50 }, { at: 2, value: 0 }]);
    expect(formatOverviewValue(undefined, 'cards', 'cards')).toBe('-');
    expect(formatOverviewValue(1.91, 'cards', 'cards')).toBe('1.91 cards');
    expect(OVERVIEW_RESOURCES.find((entry) => entry.key === 'gpu')?.metric).toBe('cluster_gpu_usage');
  });
  it('changes only the selected resource pair and window, with CPU fallback for a GPU-free cluster', async () => {
    const calls: URL[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input)); calls.push(url);
      const names = url.searchParams.has('start') ?
        url.searchParams.get('metrics_filter')!.split('|').map((name) => name.slice(0, -1)) :
        ['cluster_gpu_total', 'cluster_cpu_usage', 'cluster_cpu_total'];
      return Response.json({ results: names.map((name) => ({
        metric_name: name, data: { result: [url.searchParams.has('start') ?
          { values: [[Number(url.searchParams.get('end')) - 60, name.includes('total') ? '100' : '10']] } :
          { metric: {}, value: [1, name === 'cluster_gpu_total' ? '0' : '100'] }] },
      })) });
    }));
    const view = mount(<OverviewResourcePanel cluster="host" refreshAt={1_700_000_000_000} />);
    await waitFor(() => expect(view.container.querySelector('[data-ai-id="overview:trend-panel"]')).toHaveAttribute('data-ai-state', 'ready'));
    expect(calls.find((url) => url.searchParams.has('start'))?.searchParams.get('metrics_filter')).toBe('cluster_cpu_usage$|cluster_cpu_total$');
    expect(view.container.querySelector('[data-ai-id="overview:usage-gpu"]')).toBeNull();
    await userEvent.click(view.container.querySelector('[data-ai-id="overview:usage-memory"] [data-ai-field="used"]')!);
    await waitFor(() => expect(calls.at(-1)?.searchParams.get('metrics_filter')).toBe('cluster_memory_usage_wo_cache$|cluster_memory_total$'));
    expect(screen.getByRole('button', { name: '内存' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(screen.getByRole('button', { name: 'CPU' }), { key: ' ' });
    await waitFor(() => expect(calls.at(-1)?.searchParams.get('metrics_filter')).toBe('cluster_cpu_usage$|cluster_cpu_total$'));
    /*
     * The window control is the shared `TimeRangePicker`: open it and pick the
     * preset, which is the gesture a reader makes. The three fixed buttons this used
     * to click are gone, and with them the second way to choose a period.
     *
     * Two hours rather than six: the preset ladder is 10m … 7d, and the assertion is
     * about "the span drives the step", which 2h shows as clearly as 6h did.
     */
    await userEvent.click(view.container.querySelector('[data-ai-id="overview:trend:range"]')!);
    await userEvent.click(screen.getByRole('option', { name: '最近 2 小时' }));
    await waitFor(() => expect(calls.at(-1)?.searchParams.get('step')).toBe('60s'));
    expect(Number(calls.at(-1)?.searchParams.get('end')) - Number(calls.at(-1)?.searchParams.get('start'))).toBe(7_200);
  });
  it('moves node statistics out of the resource grid without duplicating the current usage request', async () => {
    const calls: URL[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input)); calls.push(url);
      const values: Record<string, string> = { cluster_gpu_total: '0', cluster_cpu_usage: '1', cluster_cpu_total: '10',
        cluster_node_online: '2', cluster_node_total: '3' };
      const names = url.searchParams.has('start') ? url.searchParams.get('metrics_filter')!.split('|').map((name) => name.slice(0, -1)) : Object.keys(values);
      return Response.json({ results: names.map((name) => ({ metric_name: name, data: { result: [
        url.searchParams.has('start') ? { values: [[Number(url.searchParams.get('end')) - 60, values[name] ?? '1']] } :
          { metric: {}, value: [1, values[name]] },
      ] } })) });
    }));
    const view = mount(<><OverviewResourcePanel cluster="host" refreshAt={1_700_000_000_000} />
      <NodeSummaryPanel cluster="host" /></>);
    await waitFor(() => expect(view.container.querySelector('[data-ai-id="overview:node-summary"] [data-ai-field="total"]')).toHaveTextContent('3'));
    expect(view.container.querySelector('[data-ai-id="overview:usage"] [data-ai-id="overview:usage-nodes"]')).toBeNull();
    expect(view.container.querySelector('[data-ai-id="overview:node-summary"] [data-ai-field="used"]')).toHaveTextContent('2');
    expect(view.container.querySelector('[data-ai-id="overview:node-summary"] [data-ai-field="total"]')).toHaveTextContent('3');
    expect(view.container.querySelector('[data-ai-id="overview:node-summary"] [data-ai-field="ratio"]')).toHaveTextContent('67%');
    expect(view.container.querySelector('[data-ai-id="overview:node-summary"] [data-ai-id="overview:trend-panel"]')).toBeNull();
    expect(view.container.querySelector('[data-ai-id="overview:node-trend-panel"]')).toBeNull();
    // The block links to the full node list; it must not carry a resource selector.
    expect(screen.getByRole('link', { name: '查看全部节点' })).toHaveAttribute('href', '/kube-frontend/clusters/host/nodes');
    expect(view.container.querySelector('[data-ai-id="overview:node-summary"]')!.querySelectorAll('button')).toHaveLength(0);
    expect(calls.filter((url) => url.searchParams.has('start') && url.searchParams.get('metrics_filter')?.includes('cluster_node_'))).toHaveLength(0);
    expect(calls.filter((url) => !url.searchParams.has('start'))).toHaveLength(1);
    expect(screen.queryByRole('button', { name: '节点' })).toBeNull();
  });
  it('polls every 30 seconds, pauses, and does not poll while hidden or after unmount', async () => {
    vi.useFakeTimers();
    let visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility as DocumentVisibilityState);
    const read = vi.fn(async () => ({ value: 1 }));
    function Host() {
      const refresh = useOverviewRefresh('host');
      useQuery({ queryKey: ['cluster-usage', 'host'], queryFn: read });
      return <button onClick={() => refresh.setAuto(!refresh.auto)}>{refresh.auto ? 'Pause' : 'Resume'}</button>;
    }
    const view = mount(<Host />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(read).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(read).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByText('Pause'));
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(read).toHaveBeenCalledTimes(2);
    visibility = 'hidden';
    fireEvent(document, new Event('visibilitychange'));
    fireEvent.click(screen.getByText('Resume'));
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(read).toHaveBeenCalledTimes(2);
    visibility = 'visible';
    await act(async () => { fireEvent(document, new Event('visibilitychange')); await vi.advanceTimersByTimeAsync(1); });
    expect(read).toHaveBeenCalledTimes(3);
    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(read).toHaveBeenCalledTimes(3);
  });
  it('does not stack timer requests while a previous read is pending', async () => {
    vi.useFakeTimers();
    const read = vi.fn(() => new Promise(() => {}));
    function Host() {
      useOverviewRefresh('host');
      useQuery({ queryKey: ['cluster-usage', 'host'], queryFn: read });
      return null;
    }
    mount(<Host />);
    await act(async () => { await vi.advanceTimersByTimeAsync(90_000); });
    expect(read).toHaveBeenCalledTimes(1);
  });
});

function Launch() {
  const [open, setOpen] = React.useState(false);
  return <><button onClick={() => setOpen(true)}>Launch</button>
    {open ? <KubectlConsoleDialog cluster="host" onClose={() => setOpen(false)} /> : null}</>;
}
describe('one-click kubectl controller', () => {
  it('does not read before clicking, resolves once and clears target cache on close', async () => {
    const fetch = vi.fn(async () => Response.json({ namespace: 'tools', pod: 'admin-tool', container: 'kubectl' }));
    vi.stubGlobal('fetch', fetch);
    const view = mount(<Launch />);
    expect(fetch).not.toHaveBeenCalled();
    await userEvent.click(screen.getByText('Launch'));
    await screen.findByText('Close session');
    expect(fetch).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByText('Close session'));
    expect(view.client.getQueryCache().findAll({ queryKey: ['kubectl-target'] })).toHaveLength(0);
    await userEvent.click(screen.getByText('Launch'));
    await screen.findByText('Close session');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('cancels preparation and never opens the terminal on a late response', async () => {
    let finish!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; })));
    const view = mount(<Launch />);
    await userEvent.click(screen.getByText('Launch'));
    expect(document.querySelector('[data-ai-id="kubectl:preparing"]')).toBeInTheDocument();
    await userEvent.click(document.querySelector('[data-ai-id="kubectl:terminal-close"]')!);
    await act(async () => { finish(Response.json({ namespace: 'tools', pod: 'late', container: 'kubectl' })); });
    expect(document.querySelector('[data-ai-id="fake-exec"]')).toBeNull();
    expect(view.client.getQueryCache().findAll({ queryKey: ['kubectl-target'] })).toHaveLength(0);
  });
  it('reports forbidden without retry and closes on an identity change', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('forbidden', { status: 403 })));
    const view = mount(<Launch />);
    await userEvent.click(screen.getByText('Launch'));
    await waitFor(() => expect(document.querySelector('[data-ai-id="kubectl:retry"]')).toBeNull());
    await waitFor(() => expect(view.client.getQueryCache().findAll({ queryKey: ['kubectl-target'] })[0]?.state.status).toBe('error'));
    identity.name = 'other';
    view.rerender(<QueryClientProvider client={view.client}><I18nProvider locale="zh"><Launch /></I18nProvider></QueryClientProvider>);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
