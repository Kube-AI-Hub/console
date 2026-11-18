import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { GpuModeDialog } from '@/pages/cluster/GpuModeDialog';
import { buildModeParams, modeResult, type ModeRequest } from '@/pages/cluster/gpuModeConfig';
import { timeOffsets } from '@/pages/cluster/nodeListQueries';
import { NodesPage } from '@/pages/cluster/NodesPage';
import { toNodeSummary } from '@kube-ai-hub/api-client';

vi.mock('@tanstack/react-router', () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
const raw = { metadata: { name: 'gpu01', labels: { 'xpu-vendor': 'nvidia', 'xpu-model': 'B200' } },
  spec: {}, status: { conditions: [{ type: 'Ready', status: 'True' }], nodeInfo: { virtualCardMode: 'default', gpuModeParams: {} } } };
function mount(element: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <I18nProvider locale="zh">{element}</I18nProvider></QueryClientProvider>);
}
describe('node list and mode behavior', () => {
  it('keeps global statistics when keyword/model/vendor filters narrow the server list', async () => {
    const calls: URL[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      calls.push(url);
      if (url.pathname.endsWith('/stats')) return Response.json({ total: 120, healthy: 119, nvidia: 120 });
      if (url.pathname.includes('/monitoring.')) return Response.json({ results: [] });
      if (url.searchParams.get('role') === 'master') return Response.json({ items: [], totalItems: 2 });
      return Response.json({ items: [raw], totalItems: url.searchParams.has('name') ? 1 : 120 });
    }));
    mount(<NodesPage cluster="host" />);
    await screen.findByText('gpu01');
    expect(document.querySelector('[data-stat-key="total"]')).toHaveTextContent('120');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '下一页' }));
    await waitFor(() => expect(calls.some((url) => url.searchParams.get('page') === '2')).toBe(true));
    await user.type(screen.getByRole('searchbox', { name: '按名称或 IP 搜索' }), '172.16');
    /*
     * The model filter lives in the model column's header, not the toolbar: a field's
     * own filter belongs where the field is, and the toolbar keeps the row search.
     */
    await user.click(screen.getByRole('button', { name: '型号' }));
    await user.type(await screen.findByRole('textbox', { name: '型号' }), 'B200');
    await waitFor(() => expect(calls.some((url) => url.searchParams.get('name') === '172.16' && url.searchParams.get('xpuModel') === 'B200' && url.searchParams.get('page') === '1')).toBe(true));
    expect(document.querySelector('[data-stat-key="total"]')).toHaveTextContent('120');
    expect(calls.filter((url) => url.pathname.endsWith('/stats')).every((url) => !url.searchParams.has('name'))).toBe(true);
    await user.click(screen.getByRole('button', { name: '清除全部条件' }));
    // The popover is closed by then, so reopen it to read the cleared value.
    await user.click(screen.getByRole('button', { name: '型号' }));
    expect(await screen.findByRole('textbox', { name: '型号' })).toHaveValue('');
  });
  it('isolates full-cluster NTP offsets and marks unknown synchronization', () => {
    expect(timeOffsets({
      a: { node_time_seconds: 1000, node_timex_sync_status: 1 },
      b: { node_time_seconds: 1016, node_timex_sync_status: 0 },
      unknown: {},
    })).toEqual({ a: { offset: -8, synced: true }, b: { offset: 8, synced: false }, unknown: { offset: undefined, synced: undefined } });
  });
  it('validates parameters and does not transmit inactive mode parameters', () => {
    expect(buildModeParams('kunlunxin', 'default', {})).toEqual({});
    expect(buildModeParams('kunlunxin', 'hami-core', { devicesplitcount: 10 })).toEqual({});
    expect(buildModeParams('nvidia', 'default', { devicesplitcount: 20 })).toEqual({});
    expect(buildModeParams('nvidia', 'hami-core', { devicesplitcount: 10, devicememoryscaling: 1, devicecorescaling: 2, 'virtualization-num': 5 }))
      .toEqual({ devicesplitcount: '10', devicememoryscaling: '1', devicecorescaling: '2' });
    expect(() => buildModeParams('nvidia', 'mig', { devicesplitcount: 1.5 })).toThrow();
  });
  it('ignores stale results, detects competing requests, and bounds pending results', () => {
    const request: ModeRequest = { mode: 'hami-core', params: { devicesplitcount: '10' }, baselineTimestamp: '2026-11-14T00:00:00Z', startedAt: 0 };
    const node = toNodeSummary(raw);
    expect(modeResult(node, request, 100)).toBe('waiting');
    node.gpuModeDesired = { mode: request.mode, params: request.params, timestamp: '2026-11-14T00:00:10Z' };
    node.gpuModeStatus = { mode: request.mode, status: 'completed', timestamp: '2026-11-14T00:00:01Z' };
    expect(modeResult(node, request, 100)).toBe('waiting');
    node.gpuModeStatus.timestamp = '2026-11-14T00:00:11Z';
    expect(modeResult(node, request, 100)).toBe('completed');
    expect(modeResult(node, request, 400_000)).toBe('completed');
    node.gpuModeStatus.status = 'failed';
    expect(modeResult(node, request, 100)).toBe('failed');
    node.gpuModeDesired.params = { devicesplitcount: '20' };
    expect(modeResult(node, request, 100)).toBe('external');
    expect(modeResult(undefined, request, 300_000)).toBe('timeout');
  });
  it('shows current values, confirms risk and sends only the chosen mode payload', async () => {
    const sent: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') { sent.push(JSON.parse(String(init.body))); return Response.json({ success: true, message: 'submitted' }); }
      return Response.json(raw);
    }));
    mount(<GpuModeDialog cluster="host" name="gpu01" onClose={vi.fn()} onUpdated={vi.fn()} />);
    const user = userEvent.setup();
    await screen.findByRole('combobox', { name: 'GPU 模式' });
    await user.click(screen.getByRole('combobox', { name: 'GPU 模式' }));
    await user.click(screen.getByRole('option', { name: 'HAMi-core' }));
    expect(screen.getByRole('textbox', { name: '设备切分数量' })).toHaveValue('10');
    await user.click(screen.getByRole('button', { name: '确认提交模式变更' }));
    expect(sent).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: /^确认$/ }));
    await screen.findByText('已提交，等待 agent 处理');
    expect(sent).toEqual([{ mode: 'hami-core', params: { devicesplitcount: '10', devicememoryscaling: '1', devicecorescaling: '1' } }]);
    expect(screen.queryByText('模式切换完成')).toBeNull();
  });
  it('reads existing string parameters as numbers and prevents unchanged submission', async () => {
    const fetcher = vi.fn(async () => Response.json({
      ...raw,
      status: { ...raw.status, nodeInfo: { virtualCardMode: 'hami-core',
        gpuModeParams: { devicesplitcount: '12', devicememoryscaling: '1.5', devicecorescaling: '2' } } },
    }));
    vi.stubGlobal('fetch', fetcher);
    mount(<GpuModeDialog cluster="host" name="gpu01" onClose={vi.fn()} onUpdated={vi.fn()} />);
    expect(await screen.findByRole('textbox', { name: '设备切分数量' })).toHaveValue('12');
    expect(screen.getByRole('textbox', { name: '显存缩放系数' })).toHaveValue('1.5');
    const count = fetcher.mock.calls.length;
    await userEvent.click(screen.getByRole('button', { name: '确认提交模式变更' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('当前模式和参数没有变化');
    expect(fetcher).toHaveBeenCalledTimes(count);
  });
});
