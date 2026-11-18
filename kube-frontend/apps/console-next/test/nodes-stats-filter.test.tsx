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
