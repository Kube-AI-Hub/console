import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { createQueryClient } from '@/query';
import { I18nProvider } from '@/i18n';
import { ClusterConfigMapsPage } from '@/pages/cluster/ClusterConfigMapsPage';

/**
 * 集群级配置字典的写入口（2026-11-19）。
 *
 * The cluster list used to be read-only. Two things must hold now: a normal row offers
 * the four actions, and a federated row offers none — editing the projection would be
 * undone by the federation controller, so the entries are withheld rather than failing
 * upstream.
 */

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function stub() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/namespaces')) return json({ items: [], totalItems: 0 });
      if (url.pathname.endsWith('/configmaps')) {
        return json({
          items: [
            {
              metadata: { name: 'plain', namespace: 'default', creationTimestamp: '2026-11-18T00:00:00Z' },
              data: { 'a.yaml': 'x' },
            },
            {
              metadata: {
                name: 'federated',
                namespace: 'default',
                creationTimestamp: '2026-11-18T00:00:00Z',
                annotations: { 'kubefed.io/managed': 'true' },
              },
              data: { 'b.yaml': 'y' },
            },
          ],
          totalItems: 2,
        });
      }
      return json({ items: [], totalItems: 0 });
    }),
  );
}

function mount() {
  const client = createQueryClient();
  const rootRoute = createRootRoute();
  const route = createRoute({
    getParentRoute: () => rootRoute,
    path: '/kube-frontend/clusters/$cluster/configmaps',
    component: () => <ClusterConfigMapsPage cluster="host" />,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([route]),
    history: createMemoryHistory({ initialEntries: ['/kube-frontend/clusters/host/configmaps'] }),
  });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="zh">
        <RouterProvider router={router} />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('集群级配置字典的行操作', () => {
  it('offers the four actions on a normal row and none on a federated one', async () => {
    stub();
    mount();
    await screen.findByText('plain');
    await screen.findByText('federated');

    const user = userEvent.setup();
    const plainRow = document.querySelector<HTMLElement>('[data-ai-row="default/plain"]')!;
    const federatedRow = document.querySelector<HTMLElement>('[data-ai-row="default/federated"]')!;
    // A federated row renders no actions at all, so its menu button does not exist.
    expect(federatedRow.querySelector('button[aria-label="更多操作"]')).toBeNull();
    const plainMenu = plainRow.querySelector<HTMLElement>('button[aria-label="更多操作"]');
    expect(plainMenu).not.toBeNull();

    await user.click(plainMenu!);
    await waitFor(() => expect(screen.getByText('编辑信息')).toBeInTheDocument());
    expect(screen.getByText('编辑 YAML')).toBeInTheDocument();
    expect(screen.getByText('删除')).toBeInTheDocument();
  });
});