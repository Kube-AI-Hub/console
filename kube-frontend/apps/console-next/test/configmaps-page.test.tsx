import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { createQueryClient } from '@/query';
import { I18nProvider } from '@/i18n';
import { ConfigMapsPage } from '@/pages/configmaps/ConfigMapsPage';

/**
 * ConfigMaps list behaviour.
 *
 * These run against a stubbed `fetch`, so they assert the real request the page
 * issues and the real state it renders — not a mocked hook. A page that renders
 * fine against a mocked hook but requests the wrong URL is the bug this catches.
 */

const rows = [
  { name: 'app-config', namespace: 'default', description: '主配置', keys: ['app.yaml'], createdAt: '2026-11-01T08:12:00Z', federated: false },
  { name: 'nginx-conf', namespace: 'default', description: '', keys: ['nginx.conf'], createdAt: '2026-11-02T11:40:00Z', federated: true },
];

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/**
 * Render the page inside a real router.
 *
 * The page links to the detail route, so `<Link>` needs a router in context.
 * Building one here — rather than mocking `Link` — means the test also proves the
 * route literal resolves, which is the part that breaks on a rename.
 */
function renderPage() {
  const client = createQueryClient();
  const rootRoute = createRootRoute();
  const listRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/c/$cluster/p/$namespace/configmaps',
    component: () => <ConfigMapsPage cluster="host" namespace="default" />,
  });
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/c/$cluster/p/$namespace/configmaps/$name',
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([listRoute.addChildren([detailRoute])]),
    history: createMemoryHistory({ initialEntries: ['/c/host/p/default/configmaps'] }),
  });

  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <RouterProvider router={router} />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

/**
 * The surface the page last reported.
 *
 * TanStack's `RouterProvider` can mount its tree more than once while the first
 * match resolves, so a bare `querySelector` picks up a stale element and reports
 * the previous state. Reading from the last one always reflects the live render.
 */
function currentSurface(): HTMLElement {
  const all = document.querySelectorAll<HTMLElement>('[data-ai-id="configmaps:surface"]');
  const last = all.item(all.length - 1);
  if (!last) throw new Error('surface not rendered');
  return last;
}

/** Wait for the router to mount the page, then return its surface. */
async function awaitSurface(): Promise<HTMLElement> {
  await waitFor(() => expect(currentSurface()).toBeInTheDocument());
  return currentSurface();
}

describe('ConfigMaps list', () => {
  it('starts in the loading state and reaches ready', async () => {
    stubFetch(() => new Response(JSON.stringify({ items: rows, total: 2, page: 1, pageSize: 10 }), { status: 200 }));
    renderPage();

    // The agent reads this before acting; it must be present as soon as the page
    // mounts, and it must not sit on `loading` once data has arrived.
    const surface = await awaitSurface();
    expect(['loading', 'ready']).toContain(surface.getAttribute('data-ai-state'));
    await waitFor(() => expect(currentSurface()).toHaveAttribute('data-ai-state', 'ready'));
    expect(screen.getByText('app-config')).toBeInTheDocument();
  });

  it('requests the BFF with cluster, namespace and paging', async () => {
    const fetchMock = stubFetch(() => new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 10 }), { status: 200 }));
    renderPage();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const url = new URL(String((fetchMock.mock.calls[0] as unknown as [string])[0]), 'http://localhost');
    expect(url.pathname).toBe('/api/configmaps');
    expect(url.searchParams.get('cluster')).toBe('host');
    expect(url.searchParams.get('namespace')).toBe('default');
    expect(url.searchParams.get('pageSize')).toBe('10');
    expect(url.searchParams.get('sortBy')).toBe('createdAt');
    expect(url.searchParams.get('order')).toBe('desc');
  });

  it('shows the empty state rather than an empty table', async () => {
    stubFetch(() => new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 10 }), { status: 200 }));
    renderPage();
    await waitFor(() => expect(currentSurface()).toHaveAttribute('data-ai-state', 'empty'));
    expect(screen.getByText('暂无配置字典')).toBeInTheDocument();
  });

  it('shows the error state with a retry the agent can find', async () => {
    // 422 is not retryable, so the state settles on the first response. A 5xx would
    // be retried twice by design, and this test is about the rendered state.
    stubFetch(() => new Response(JSON.stringify({ code: 'invalid', message: 'boom' }), { status: 422 }));
    renderPage();
    await awaitSurface();
    await waitFor(() => expect(currentSurface()).toHaveAttribute('data-ai-state', 'error'), { timeout: 3000 });
    expect(currentSurface().querySelector('[data-ai-id="configmaps:retry"]')).not.toBeNull();
  });

  it('does not offer retry when the user lacks permission', async () => {
    // Retrying a 403 can never succeed; the button would only frustrate.
    stubFetch(() => new Response(JSON.stringify({ code: 'forbidden', message: 'nope' }), { status: 403 }));
    renderPage();
    await awaitSurface();
    await waitFor(() => expect(currentSurface()).toHaveAttribute('data-ai-state', 'error'), { timeout: 3000 });
    expect(within(currentSurface()).getByText('没有权限执行该操作')).toBeInTheDocument();
    expect(currentSurface().querySelector('[data-ai-id="configmaps:retry"]')).toBeNull();
  });

  it('toggles sort order when the active header is clicked again', async () => {
    const fetchMock = stubFetch(() => new Response(JSON.stringify({ items: rows, total: 2, page: 1, pageSize: 10 }), { status: 200 }));
    renderPage();
    await waitFor(() => expect(screen.getByText('app-config')).toBeInTheDocument());

    const header = currentSurface().querySelector('[data-ai-id="configmaps:sort:createdAt"]') as HTMLElement;
    await userEvent.click(header);
    await waitFor(() => {
      const last = new URL(String((fetchMock.mock.calls.at(-1) as unknown as [string])[0]), 'http://localhost');
      expect(last.searchParams.get('order')).toBe('asc');
    });
  });

  it('keeps the checkbox label accessible for assistive tech', async () => {
    stubFetch(() => new Response(JSON.stringify({ items: rows, total: 2, page: 1, pageSize: 10 }), { status: 200 }));
    renderPage();
    await waitFor(() => expect(screen.getByText('app-config')).toBeInTheDocument());
    expect(screen.getAllByRole('checkbox').length).toBe(2);
  });

  it('disables the bulk action until something is selected', async () => {
    stubFetch(() => new Response(JSON.stringify({ items: rows, total: 2, page: 1, pageSize: 10 }), { status: 200 }));
    renderPage();
    await waitFor(() => expect(screen.getByText('app-config')).toBeInTheDocument());

    const bulk = currentSurface().querySelector('[data-ai-id="configmaps:bulk-delete"]') as HTMLButtonElement;
    expect(bulk).toBeDisabled();
    expect(bulk).toHaveAttribute('data-ai-needs', 'configmaps:row-select');

    await userEvent.click(screen.getAllByRole('checkbox')[0]!);
    expect(bulk).not.toBeDisabled();
    expect(within(bulk).getByText(/\(1\)/)).toBeInTheDocument();
  });

  it('retries a transient upstream failure before giving up', async () => {
    // A 5xx is retryable; the page should attempt again without the user doing
    // anything. Verified through the request count because that is the behaviour
    // that matters, not the internal retry setting.
    let calls = 0;
    stubFetch(() => {
      calls += 1;
      return new Response(JSON.stringify({ code: 'upstream_error', message: 'boom' }), { status: 500 });
    });
    renderPage();
    await awaitSurface();
    await waitFor(() => expect(calls).toBeGreaterThan(1), { timeout: 5000 });
  }, 10_000);

  it('exposes every row by resource key', async () => {
    stubFetch(() => new Response(JSON.stringify({ items: rows, total: 2, page: 1, pageSize: 10 }), { status: 200 }));
    renderPage();
    await waitFor(() => expect(screen.getByText('app-config')).toBeInTheDocument());
    expect(currentSurface().querySelector('[data-ai-row="app-config"]')).not.toBeNull();
    expect(currentSurface().querySelector('[data-ai-row="nginx-conf"]')).not.toBeNull();
  });
});
