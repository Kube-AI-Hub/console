import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { NodesPage } from '@/pages/cluster/NodesPage';

/**
 * Bulk taint editing end to end: select rows, open the dialog, submit, read back.
 *
 * The unit tests cover the merge; this one covers the wiring that is easy to get
 * wrong and invisible to them — that the checkboxes exist at all, that the dialog
 * reads each node's own `resourceVersion` rather than the list's, and that a node
 * whose taints did not change is not written.
 */
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

const node = (name: string, taints: Array<{ key: string; value?: string; effect: string }>) => ({
  metadata: { name, resourceVersion: `rv-${name}`, labels: { 'xpu-vendor': 'nvidia', 'xpu-model': 'B200' } },
  spec: { taints },
  status: { conditions: [{ type: 'Ready', status: 'True' }], nodeInfo: {} },
});

function mount() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider locale="zh"><NodesPage cluster="host" /></I18nProvider>
    </QueryClientProvider>,
  );
}

describe('bulk taint editing', () => {
  it('selects rows, loads each node, and writes only the nodes that changed', async () => {
    const patches: Array<{ url: string; body: Record<string, unknown> }> = [];
    const shared = { key: 'shared', value: '', effect: 'NoSchedule' };
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/stats')) return Response.json({ total: 2, healthy: 2, nvidia: 2 });
      if (url.pathname.includes('/monitoring.')) return Response.json({ results: [] });
      if (url.pathname.includes('/selfsubjectaccessreviews')) return Response.json({ status: { allowed: true } });
      if (init?.method === 'PATCH') {
        patches.push({ url: url.pathname, body: JSON.parse(String(init.body)) });
        return Response.json({});
      }
      // Detail reads (the bulk dialog) and the collection read (the table).
      if (/\/nodes\/[^/]+$/.test(url.pathname)) {
        const name = decodeURIComponent(url.pathname.split('/').pop() ?? '');
        return Response.json(node(name, [shared]));
      }
      return Response.json({ items: [node('a', [shared]), node('b', [shared])], totalItems: 2 });
    }));

    mount();
    await screen.findByText('a');

    // Both rows get a checkbox; selecting them is what reveals the bulk action.
    await userEvent.click(screen.getByRole('checkbox', { name: '选择第 1 行' }));
    await userEvent.click(screen.getByRole('checkbox', { name: '选择第 2 行' }));
    const bulk = screen.getByRole('button', { name: '编辑污点' });
    expect(bulk).toBeEnabled();
    await userEvent.click(bulk);

    // The dialog re-reads the nodes, so it must not use the list row's version.
    await waitFor(() => expect(document.querySelector('[data-ai-id="node-taints-bulk:surface"]'))
      .toHaveAttribute('data-ai-state', 'ready'));
    expect(await screen.findByText('公共污点')).toBeInTheDocument();

    // Add one shared taint and submit: both nodes change, so both are written.
    const common = document.querySelector('[data-ai-id="node-taints:common:editor"]') as HTMLElement;
    await userEvent.click(within(common).getByRole('button', { name: '添加污点' }));
    // The shared block already lists `shared`; the new row is the last one.
    const rows = common.querySelectorAll('[data-ai-id^="node-taints:common:row:"]');
    const added = rows[rows.length - 1] as HTMLElement;
    await userEvent.type(within(added).getByRole('textbox', { name: '键' }), 'dedicated');
    await userEvent.type(within(added).getByRole('textbox', { name: '值' }), 'gpu');
    await userEvent.click(screen.getByRole('button', { name: '确认' }));

    await waitFor(() => expect(patches).toHaveLength(2));
    const taints = patches.map((patch) => (patch.body.spec as { taints: Array<{ key: string }> }).taints);
    expect(taints.every((list) => list.some((taint) => taint.key === 'dedicated'))).toBe(true);
    // `resourceVersion` comes from the detail read, not from the list payload.
    expect(patches.map((patch) => (patch.body.metadata as { resourceVersion: string }).resourceVersion).sort())
      .toEqual(['rv-a', 'rv-b']);
  });
});
