import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { NodeDetailPage } from '@/pages/cluster/NodeDetailPage';
import { ClusterListPage } from '@/pages/cluster/ClusterListPage';
import { NodeMetadataDialog, parseNodeTaints } from '@/pages/cluster/NodeMetadataDialog';
import { toNodeDetail } from '@kube-ai-hub/api-client';
import { formatQuantity } from '@/lib/quantity';

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ name: 'gpu01' }),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock('@/components/resource/ExecConsoleDialog', () => ({
  ExecConsoleDialog: ({ target, onClose }: { target: { node: string }; onClose: () => void }) =>
    <div role="dialog">{target.node}<button onClick={onClose}>关闭测试终端</button></div>,
}));
const raw = {
  metadata: { name: 'gpu01', resourceVersion: '42', labels: { xpu: 'nvidia-B200' } },
  spec: {},
  status: { conditions: [{ type: 'Ready', status: 'True' }], capacity: { 'nvidia.com/gpu': '8' },
    allocatable: { 'nvidia.com/gpu': '8' }, nodeInfo: { architecture: 'amd64', operatingSystem: 'linux' } },
};
function mount(element: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <I18nProvider locale="zh">{element}</I18nProvider></QueryClientProvider>);
}
describe('node page controls', () => {
  it('opens a node terminal from detail only after clicking', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(raw)));
    const view = mount(<NodeDetailPage cluster="host" />);
    await screen.findByText('amd64');
    expect(screen.queryByRole('dialog')).toBeNull();
    /*
     * Scope to the allocation table: `data-ai-resource` now also appears in the
     * "资源总量" block above it, where the same key is a `<dd>` rather than a table
     * row. Without the scope this read the totals cell and found no `<td>`.
     */
    const table = view.container.querySelector('[data-ai-id="node-detail:capacity"]')!;
    const resource = table.querySelector('[data-ai-resource="nvidia.com/gpu"]')!;
    expect(resource.querySelectorAll('td')[1]).toHaveTextContent('8');
    expect(resource.querySelectorAll('td')[2]).toHaveTextContent('8');
    await userEvent.click(screen.getByRole('button', { name: '打开终端' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('gpu01');
    await userEvent.click(screen.getByRole('button', { name: '关闭测试终端' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('provides a terminal row action and retains node readiness checks', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ items: [raw], totalItems: 1 })));
    mount(<ClusterListPage cluster="host" kind="nodes" />);
    await screen.findByText('gpu01');
    await userEvent.click(screen.getByRole('button', { name: '更多操作' }));
    await userEvent.click(screen.getByText('打开终端'));
    expect(screen.getByRole('dialog')).toHaveTextContent('gpu01');
  });
  it('disables terminal access when the node is not Ready', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      ...raw, status: { ...raw.status, conditions: [{ type: 'Ready', status: 'False' }] },
    })));
    mount(<NodeDetailPage cluster="host" />);
    await screen.findByText('amd64');
    expect(screen.getByRole('button', { name: '打开终端' })).toBeDisabled();
  });
  it('changes node page size and refreshes the current list', async () => {
    const calls: URL[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.includes('metrics.k8s.io')) return Response.json({ items: [] });
      calls.push(url);
      return Response.json({ items: [raw], totalItems: 40 });
    }));
    mount(<ClusterListPage cluster="host" kind="nodes" />);
    await screen.findByText('gpu01');
    await userEvent.click(screen.getByRole('combobox', { name: '每页条数' }));
    await userEvent.click(screen.getByRole('option', { name: /^20$/ }));
    await waitFor(() => expect(calls.at(-1)?.searchParams.get('limit')).toBe('20'));
    const before = calls.length;
    await userEvent.click(screen.getByRole('button', { name: '刷新' }));
    await waitFor(() => expect(calls.length).toBeGreaterThan(before));
  });
  it('rejects invalid and duplicate taints, but supports clearing', () => {
    expect(parseNodeTaints('[]')).toEqual([]);
    expect(parseNodeTaints('- key: test\n  value: yes\n  effect: NoSchedule')).toEqual([{ key: 'test', value: 'yes', effect: 'NoSchedule' }]);
    expect(() => parseNodeTaints('- key: x\n  effect: Nope')).toThrow();
    expect(() => parseNodeTaints('- key: x\n  effect: NoExecute\n- key: x\n  effect: NoExecute')).toThrow();
    expect(parseNodeTaints('- key: x\n  effect: NoExecute\n  timeAdded: "2026-11-14T00:00:00Z"')[0]?.timeAdded).toBe('2026-11-14T00:00:00Z');
  });
  it('retains the form snapshot version across background refetch and a conflict', async () => {
    let body: Record<string, unknown> | undefined;
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      return Response.json({ message: 'conflict' }, { status: 409 });
    }));
    const close = vi.fn();
    const original = toNodeDetail(raw);
    const tree = (node: typeof original) => <I18nProvider locale="zh"><NodeMetadataDialog cluster="host" node={node}
      kind="labels" onClose={close} onSaved={vi.fn()} /></I18nProvider>;
    const client = new QueryClient();
    const view = render(<QueryClientProvider client={client}>{tree(original)}</QueryClientProvider>);
    view.rerender(<QueryClientProvider client={client}>{tree(toNodeDetail({
      ...raw, metadata: { ...raw.metadata, resourceVersion: '43', labels: { ...raw.metadata.labels, 'other/admin': 'new' } },
    }))}</QueryClientProvider>);
    await userEvent.click(screen.getByRole('button', { name: '确认' }));
    await screen.findByText(/conflict/);
    expect(body).toEqual({ metadata: { resourceVersion: '42', labels: original.labels } });
    expect(close).not.toHaveBeenCalled();
  });
  it('formats accelerators and RDMA as counts, not bytes', () => {
    expect(formatQuantity('nvidia.com/gpu', '8')).toBe('8');
    expect(formatQuantity('rdma/rdma_shared_device_a', '1000')).toBe('1000');
    expect(formatQuantity('memory', '64Gi')).toBe('64.0 GiB');
  });
});
