import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { createQueryClient } from '@/query';
import { I18nProvider } from '@/i18n';
import { ComponentsPage } from '@/pages/cluster/ComponentsPage';

/**
 * 每页档位在「一次读全、客户端分页」的列表上真的生效（2026-11-19）。
 *
 * Seven lists rendered every row on a single page until this batch; the picker existed
 * elsewhere and the contract only checked wiring, so nothing proved the rows were actually
 * sliced. This case uses 25 components — more than one page at every size below 50 — and
 * asserts the window moves, which a "declare the options and forget the slice" change fails.
 */

function component(index: number) {
  return {
    name: `node-${String(index).padStart(2, '0')}`,
    namespace: 'kube-system',
    healthyBackends: 1,
    totalBackends: 1,
    createdAt: '2026-11-01T00:00:00Z',
  };
}

function stub(items: unknown[]) {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(items)));
}

/** The page renders router links, so it needs a router around it. */
function mount() {
  const client = createQueryClient();
  const rootRoute = createRootRoute();
  const route = createRoute({
    getParentRoute: () => rootRoute,
    path: '/kube-frontend/clusters/$cluster/components',
    component: () => <ComponentsPage cluster="host" />,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([route]),
    history: createMemoryHistory({ initialEntries: ['/kube-frontend/clusters/host/components'] }),
  });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="zh">
        <RouterProvider router={router} />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

function rowNames(): string[] {
  return Array.from(document.querySelectorAll('[data-ai-id="components:surface"] tbody tr')).map(
    (row) => row.querySelector('td')?.textContent ?? '',
  );
}

describe('客户端分页列表的每页档位', () => {
  it('slices the rows to the chosen size and moves the window', async () => {
    stub(Array.from({ length: 25 }, (_, index) => component(index)));
    mount();

    await screen.findByText('node-00');
    // The list defaults to 20 rows per page: page one is node-00 … node-19.
    await waitFor(() => expect(rowNames()).toHaveLength(20), { timeout: 15_000 });
    expect(rowNames()[0]).toContain('node-00');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '下一页' }));
    await waitFor(() => expect(rowNames()[0]).toContain('node-20'), { timeout: 15_000 });
    expect(rowNames()).toHaveLength(5);

    // 50 per page: every row fits again, and the pager returns to page one.
    await user.click(document.querySelector<HTMLElement>('[data-ai-id="components:page-size"]')!);
    await user.click(await screen.findByRole('option', { name: /^50$/ }));
    await waitFor(() => expect(rowNames()).toHaveLength(25), { timeout: 15_000 });
    expect(rowNames()[0]).toContain('node-00');
  });
});