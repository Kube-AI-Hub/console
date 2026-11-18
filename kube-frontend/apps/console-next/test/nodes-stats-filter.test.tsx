import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { NodesPage } from '@/pages/cluster/NodesPage';

/**
 * Clicking a statistics tile filters the list.
 *
 * The tiles are shortcuts for the toolbar's controls, so the thing worth pinning is
 * that they drive the *same* server query — a tile that only narrows the rendered
 * rows would look right on page one and be wrong on page two.
 *
 * Three behaviours are easy to get wrong and are asserted explicitly:
 *  - a second click removes the filter (the reader must be able to get back);
 *  - vendor tiles accumulate, because `deviceVendor` is a multi-select on the wire;
 *  - the health tile is a readout, not a control.
 */
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

const node = (name: string, vendor: string) => ({
  metadata: { name, labels: { 'xpu-vendor': vendor, 'xpu-model': 'X' } },
  spec: {},
  status: { conditions: [{ type: 'Ready', status: 'True' }], nodeInfo: {} },
});

function mount() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider locale="zh"><NodesPage cluster="host" /></I18nProvider>
    </QueryClientProvider>,
  );
}

function stubServer() {
  const calls: URL[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    calls.push(url);
    if (url.pathname.endsWith('/stats')) {
      return Response.json({ total: 6, healthy: 5, nvidia: 2, cambricon: 1, CPU: 3 });
    }
    if (url.pathname.endsWith('/nodes/join-command')) return Response.json({});
    if (url.pathname.includes('/selfsubjectaccessreviews')) return Response.json({ status: { allowed: true } });
    if (url.pathname.includes('/monitoring.')) return Response.json({ results: [] });
    return Response.json({ items: [node('gpu01', 'nvidia'), node('mlu01', 'cambricon')], totalItems: 6 });
  }));
  return calls;
}

/** The last list read, which is what the toolbar and the tiles both drive. */
const lastListCall = (calls: URL[]) => [...calls].reverse().find((url) => url.pathname.endsWith('/nodes'));

describe('statistics tiles filter the node list', () => {
  it('applies and then removes the control-plane filter on a second click', async () => {
    const calls = stubServer();
    mount();
    await screen.findByText('gpu01');

    const tile = screen.getByRole('button', { name: /控制平面节点/ });
    expect(tile).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(tile);
    await waitFor(() => expect(lastListCall(calls)?.searchParams.get('role')).toBe('master'));
    expect(tile).toHaveAttribute('aria-pressed', 'true');

    // A second click is the way back: the reader should not have to find the
    // dropdown they never opened.
    await userEvent.click(tile);
    await waitFor(() => expect(lastListCall(calls)?.searchParams.has('role')).toBe(false));
    expect(tile).toHaveAttribute('aria-pressed', 'false');
  });

  it('accumulates vendor filters instead of replacing them', async () => {
    const calls = stubServer();
    mount();
    await screen.findByText('gpu01');

    await userEvent.click(screen.getByRole('button', { name: /英伟达/ }));
    await waitFor(() => expect(lastListCall(calls)?.searchParams.get('deviceVendor')).toBe('nvidia'));

    await userEvent.click(screen.getByRole('button', { name: /寒武纪/ }));
    // Both, in click order: `deviceVendor` is an OR list upstream.
    await waitFor(() => expect(lastListCall(calls)?.searchParams.get('deviceVendor')).toBe('nvidia,cambricon'));

    // Clicking one again removes only that one.
    await userEvent.click(screen.getByRole('button', { name: /英伟达/ }));
    await waitFor(() => expect(lastListCall(calls)?.searchParams.get('deviceVendor')).toBe('cambricon'));
  });

  it('clears every filter when the cluster total is clicked', async () => {
    const calls = stubServer();
    mount();
    await screen.findByText('gpu01');

    await userEvent.click(screen.getByRole('button', { name: /控制平面节点/ }));
    await waitFor(() => expect(lastListCall(calls)?.searchParams.get('role')).toBe('master'));

    await userEvent.click(screen.getByRole('button', { name: /集群节点/ }));
    await waitFor(() => {
      const last = lastListCall(calls);
      expect(last?.searchParams.has('role')).toBe(false);
      expect(last?.searchParams.has('deviceVendor')).toBe(false);
    });
  });

  it('keeps the health tile a readout, not a control', async () => {
    stubServer();
    mount();
    await screen.findByText('gpu01');

    // The ring is a progressbar, and there is no button carrying its name: a
    // control here would have to invent a filter the API does not offer.
    expect(screen.queryByRole('button', { name: /节点健康率/ })).toBeNull();
    expect(screen.getAllByRole('progressbar').length).toBeGreaterThan(0);
  });
});

/**
 * The status column speaks the reader's language and matches `kube-server`.
 *
 * `kube-server`'s `getNodeStatus` answers `unschedulable` / `warning` / `running` —
 * it is used to *filter* the list, not to fill a response field, so the row has to
 * reproduce it. `Ready` alone cannot express "cordoned but healthy" or "a pressure
 * condition is set", which is why the column is not derived from the Ready condition.
 */
describe('node status matches kube-server and is localized', () => {
  const mountWithNode = async (spec: Record<string, unknown>, conditions: Array<Record<string, string>>) => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/stats')) return Response.json({ total: 1, healthy: 1, nvidia: 1 });
      if (url.pathname.endsWith('/nodes/join-command')) return Response.json({});
      if (url.pathname.includes('/selfsubjectaccessreviews')) return Response.json({ status: { allowed: true } });
      if (url.pathname.includes('/monitoring.')) return Response.json({ results: [] });
      return Response.json({
        items: [{ metadata: { name: 'gpu01', labels: { 'xpu-vendor': 'nvidia' } }, spec, status: { conditions } }],
        totalItems: 1,
      });
    }));
    mount();
    await screen.findByText('gpu01');
    const th = screen.getAllByRole('columnheader').find((cell) => (cell.textContent ?? '').trim() === '状态')!;
    const index = [...th.parentElement!.children].indexOf(th);
    return document.querySelectorAll('tbody tr')[0]!.children[index] as HTMLElement;
  };

  it('reads 运行中 when every expected condition holds', async () => {
    const cell = await mountWithNode({}, [
      { type: 'Ready', status: 'True' },
      { type: 'MemoryPressure', status: 'False' },
    ]);
    expect(cell).toHaveTextContent('运行中');
    expect(cell.textContent).not.toContain('Running');
  });

  it('reads 告警 when any expected condition is out of range', async () => {
    // The old console's JS version assigned inside `forEach`, so only the *last*
    // condition decided; a real pressure condition could read as healthy. This is
    // the case that separates the two implementations: Ready is True, but the node
    // is under memory pressure.
    const cell = await mountWithNode({}, [
      { type: 'MemoryPressure', status: 'True' },
      { type: 'Ready', status: 'True' },
    ]);
    expect(cell).toHaveTextContent('告警');
  });

  it('reads 无法调度 when cordoned, and lists the taints in a tooltip', async () => {
    const cell = await mountWithNode({
      unschedulable: true,
      taints: [
        { key: 'node.kubernetes.io/unschedulable', effect: 'NoSchedule' },
        { key: 'dedicated', value: 'gpu-a100', effect: 'NoExecute' },
      ],
    }, [{ type: 'Ready', status: 'True' }]);

    expect(cell).toHaveTextContent('无法调度');
    // The badge is the tooltip's anchor; the taints themselves are in the content,
    // which Radix renders on hover. The anchor carries the node name so the state is
    // reachable from a test and from the page's own action handles.
    expect(cell.querySelector('[data-ai-id="nodes:taints:gpu01"]')).not.toBeNull();
  });
});

/**
 * vGPU mode is available on member clusters.
 *
 * The action used to carry `cluster !== 'host'`, which greyed it out everywhere but
 * the host cluster. The endpoint takes the cluster as a query parameter and the GPU
 * read path already works on members, so that guard removed a working action.
 */
describe('vGPU mode on a member cluster', () => {
  it('offers the action enabled, not greyed out', async () => {
    stubServer();
    mount();
    await screen.findByText('gpu01');

    const buttons = screen.getAllByRole('button', { name: '更多操作' });
    await userEvent.click(buttons[0]!);
    const item = await screen.findByRole('menuitem', { name: /设置 vGPU 模式/ });

    expect(item).not.toHaveAttribute('aria-disabled', 'true');
    expect(getComputedStyle(item).pointerEvents).not.toBe('none');
  });
});

/**
 * Control plane and vendor are mutually exclusive.
 *
 * Control-plane nodes are nearly always CPU machines, so `role=master` plus a
 * vendor asks for an empty set — the reader sees no rows and no explanation. These
 * pin the rule in both directions and from both entry points, because a rule that
 * only holds on one of them would leave the tiles disagreeing with the chips.
 */
describe('control plane and vendor filters exclude each other', () => {
  it('drops the vendor filter when the control-plane tile is turned on', async () => {
    const calls = stubServer();
    mount();
    await screen.findByText('gpu01');

    await userEvent.click(screen.getByRole('button', { name: /英伟达/ }));
    await waitFor(() => expect(lastListCall(calls)?.searchParams.get('deviceVendor')).toBe('nvidia'));

    await userEvent.click(screen.getByRole('button', { name: /控制平面节点/ }));
    await waitFor(() => {
      const last = lastListCall(calls);
      expect(last?.searchParams.get('role')).toBe('master');
      expect(last?.searchParams.has('deviceVendor')).toBe(false);
    });
    // The vendor tile drops its pressed state in the same update, otherwise the
    // band would claim two filters that are not both in effect.
    expect(screen.getByRole('button', { name: /英伟达/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /控制平面节点/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('drops the control-plane filter when a vendor tile is turned on', async () => {
    const calls = stubServer();
    mount();
    await screen.findByText('gpu01');

    await userEvent.click(screen.getByRole('button', { name: /控制平面节点/ }));
    await waitFor(() => expect(lastListCall(calls)?.searchParams.get('role')).toBe('master'));

    await userEvent.click(screen.getByRole('button', { name: /英伟达/ }));
    await waitFor(() => {
      const last = lastListCall(calls);
      expect(last?.searchParams.get('deviceVendor')).toBe('nvidia');
      expect(last?.searchParams.has('role')).toBe(false);
    });
    expect(screen.getByRole('button', { name: /控制平面节点/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('leaves the vendor filter alone when the control-plane tile is turned off', async () => {
    // Turning a tile off must remove that tile's own filter and nothing else; a
    // reader who picked a vendor in the dropdown keeps it.
    const calls = stubServer();
    mount();
    await screen.findByText('gpu01');

    await userEvent.click(screen.getByRole('button', { name: /控制平面节点/ }));
    await waitFor(() => expect(lastListCall(calls)?.searchParams.get('role')).toBe('master'));

    await userEvent.click(screen.getByRole('button', { name: /控制平面节点/ }));
    await waitFor(() => expect(lastListCall(calls)?.searchParams.has('role')).toBe(false));

    // Now pick a vendor and toggle the role back off; the vendor must survive.
    await userEvent.click(screen.getByRole('button', { name: /英伟达/ }));
    await waitFor(() => expect(lastListCall(calls)?.searchParams.get('deviceVendor')).toBe('nvidia'));
    expect(lastListCall(calls)?.searchParams.has('role')).toBe(false);
  });
});
