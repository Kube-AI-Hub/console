import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
 * Runs against a stubbed `fetch` so the assertions cover the request the page
 * really issues and the state it really renders. The BFF is a transparent proxy
 * now, so the stub answers with kube-api shapes — a page that reads a made-up
 * `{items, total}` envelope would pass against a mock and fail in production.
 */

/**
 * The page opens on the project in the route, so the collection is
 * namespace-scoped. "All projects" is a cluster-wide read the reader must ask for.
 */
const KAPIS = '/kapis/resources.kubesphere.io/v1alpha3/namespaces/default/configmaps';

/** A kube `ConfigMapList`, the shape ks-apiserver returns. */
const listBody = {
  kind: 'ConfigMapList',
  apiVersion: 'v1',
  items: [
    {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: 'app-config',
        namespace: 'default',
        creationTimestamp: '2026-11-01T08:12:00Z',
        annotations: { 'kubesphere.io/description': '主配置', 'kubesphere.io/creator': 'admin' },
      },
      data: { 'app.yaml': 'a: 1' },
    },
    {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: 'nginx-conf',
        namespace: 'default',
        creationTimestamp: '2026-11-02T11:40:00Z',
        annotations: { 'kubefed.io/managed': 'true' },
      },
      data: { 'nginx.conf': 'server {}' },
    },
  ],
  totalItems: 2,
};

/**
 * Projects response, so the shared picker settles.
 *
 * The page fetches projects alongside the list; a stub that only answers the list
 * leaves that query pending forever and the test hangs on cleanup.
 */
const projectsBody = {
  kind: 'NamespaceList',
  items: [
    { metadata: { name: 'default' }, status: { phase: 'Active' } },
    { metadata: { name: 'kube-frontend-demo' }, status: { phase: 'Active' } },
  ],
};

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/namespaces?') || url.endsWith('/namespaces')) return json(projectsBody);
    return handler(url, init);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** The page's state root; `AiSurface` publishes `data-ai-state` here. */
function surface(): HTMLElement {
  const element = document.querySelector<HTMLElement>('[data-ai-id="configmaps:surface"]');
  if (!element) throw new Error('surface not rendered');
  return element;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** Render the page inside a real router so `<Link>` resolves. */
function renderPage() {
  const client = createQueryClient();
  const rootRoute = createRootRoute();
  const listRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/configmaps',
    component: () => <ConfigMapsPage workspace="system-workspace" cluster="host" namespace="default" />,
  });
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/configmaps/$name',
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([listRoute.addChildren([detailRoute])]),
    history: createMemoryHistory({ initialEntries: ['/kube-frontend/system-workspace/clusters/host/projects/default/configmaps'] }),
  });

  return render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="zh">
        <RouterProvider router={router} />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('ConfigMaps list', () => {
  it('starts in the loading state and reaches ready', async () => {
    stubFetch(() => json(listBody));
    renderPage();

    // The router renders on a microtask, so wait for the region before reading state.
    await waitFor(() => expect(surface()).toBeTruthy());
    expect(await screen.findByText('app-config')).toBeTruthy();
    expect(surface().getAttribute('data-ai-state')).toBe('ready');
  });

  it('requests the kapis collection with paging and sort', async () => {
    const fetchMock = stubFetch(() => json(listBody));
    renderPage();
    await screen.findByText('app-config');

    // The projects query runs in parallel, so pick the ConfigMap request by path.
    const call = fetchMock.mock.calls.map((entry) => new URL(String(entry[0]))).find((u) => u.pathname === KAPIS);
    expect(call).toBeTruthy();
    const url = call!;
    // The old console's shape: `page` and `limit` go to the server, which slices.
    expect(url.searchParams.get('limit')).toBe('10');
    expect(url.searchParams.get('page')).toBe('1');
    // ks-apiserver spells the sort field `sortBy` and the direction `ascending`.
    expect(url.searchParams.get('sortBy')).toBe('createTime');
    expect(url.searchParams.get('ascending')).toBe('false');
  });

  it('renders the alias, description and key list from annotations and data', async () => {
    stubFetch(() => json(listBody));
    renderPage();

    expect(await screen.findByText('app-config')).toBeTruthy();
    expect(screen.getByText('主配置')).toBeTruthy();
    expect(screen.getByText('app.yaml')).toBeTruthy();
    // Only the federated object gets the badge.
    expect(screen.getByText('联邦')).toBeTruthy();
  });

  it('clips the key list to 50 characters and keeps the whole list as the tooltip', async () => {
    /*
     * A generated ConfigMap can carry dozens of keys. Wrapped, that one row would
     * set the height of the whole table; clipped, the row stays uniform and the
     * full list is still reachable through the tooltip and the detail page.
     */
    const longKeys = Array.from({ length: 20 }, (_, index) => `some.fairly.long.key.number.${index}`);
    const longList = {
      ...listBody,
      items: [
        {
          ...listBody.items[0],
          data: Object.fromEntries(longKeys.map((key) => [key, 'v'])),
        },
      ],
      totalItems: 1,
    };
    stubFetch(() => json(longList));
    renderPage();

    // The mapper sorts keys, so the tooltip keeps that order rather than the
    // order the object literal happened to list them in.
    const cell = await screen.findByTitle([...longKeys].sort().join(','));
    const shown = cell.textContent ?? '';
    expect(Array.from(shown).length).toBe(53); // 50 characters plus the ellipsis
    expect(shown.endsWith('...')).toBe(true);

    // Short lists are untouched, and carry no tooltip to explain a cut that did
    // not happen.
    stubFetch(() => json(listBody));
    renderPage();
    expect(await screen.findByText('app.yaml')).toBeTruthy();
    expect(screen.queryByTitle('app.yaml')).toBeNull();
  });

  it('shows the empty state when nothing matches', async () => {
    stubFetch(() => json({ kind: 'ConfigMapList', items: [], totalItems: 0 }));
    renderPage();

    expect(await screen.findByText('暂无配置字典')).toBeTruthy();
    expect(surface().getAttribute('data-ai-state')).toBe('empty');
  });

  it('offers a retry on a retryable failure and none on a permission error', async () => {
    stubFetch(() => json({ kind: 'Status', code: 500, reason: 'InternalError', message: 'boom' }, 500));
    const { unmount } = renderPage();

    // Retries are suppressed by the query client for 5xx (it retries twice), so
    // wait for the error state rather than the button's first paint.
    await waitFor(() => expect(surface().getAttribute('data-ai-state')).toBe('error'), { timeout: 4000 });
    expect(await screen.findByText('重试')).toBeTruthy();
    unmount();

    stubFetch(() => json({ kind: 'Status', code: 403, reason: 'Forbidden', message: 'no' }, 403));
    renderPage();

    await screen.findByText('没有权限执行该操作');
    expect(screen.queryByText('重试')).toBeNull();
  });

  it('requests the new server-side sort when another header is clicked', async () => {
    const fetchMock = stubFetch(() => json(listBody));
    renderPage();
    await screen.findByText('app-config');

    // The name header is the first sortable column rendered.
    const nameHeader = screen.getByRole('button', { name: '名称' });
    await userEvent.click(nameHeader);

    await waitFor(() => {
      const last = new URL(String(fetchMock.mock.calls[fetchMock.mock.calls.length - 1]![0]));
      expect(last.searchParams.get('sortBy')).toBe('name');
    });
  });

  it('keeps the bulk delete disabled until a row is selected', async () => {
    stubFetch(() => json(listBody));
    renderPage();
    await screen.findByText('app-config');

    // The requirement is "visible but disabled", not "absent": a control that
    // disappears reads as a missing feature, and an automation cannot tell it
    // apart from one the page forgot to render.
    const bulk = await screen.findByText(/批量删除/);
    const bulkButton = bulk.closest('button');
    expect(bulkButton?.disabled).toBe(true);
    expect(bulkButton?.getAttribute('data-ai-needs')).toBe('configmaps:row-select');

    const rowCheckboxes = screen.getAllByRole('checkbox').filter((box) => box.getAttribute('aria-label')?.startsWith('选择第'));
    await userEvent.click(rowCheckboxes[0]!);

    await waitFor(() => expect(bulk.closest('button')?.disabled).toBe(false));
  });

  it('opens the create dialog from the primary action', async () => {
    stubFetch(() => json(listBody));
    renderPage();
    await screen.findByText('app-config');

    await userEvent.click(screen.getByRole('button', { name: '创建' }));

    // The dialog, not just the button: the primary action arrives without a row,
    // so a "row required" guard in the handler is what silently breaks this.
    expect(await screen.findByText('基本信息')).toBeTruthy();
  });

  it('offers a project filter built from the shared project query', async () => {
    const fetchMock = stubFetch(() => json(listBody));
    renderPage();
    await screen.findByText('app-config');

    // The picker is present and named; Radix renders its options in a portal that
    // jsdom cannot drive reliably, so the meaningful assertion here is that the
    // page asked the shared projects endpoint at all.
    expect(screen.getByRole('combobox', { name: '项目' })).toBeTruthy();
    await waitFor(() => {
      const asked = fetchMock.mock.calls.some((entry) => String(entry[0]).includes('/namespaces?'));
      expect(asked).toBe(true);
    });
  });

  it('marks each row with a stable automation handle', async () => {
    stubFetch(() => json(listBody));
    renderPage();
    await screen.findByText('app-config');

    expect(document.querySelector('[data-ai-row="app-config"]')).toBeTruthy();
    expect(document.querySelector('[data-ai-row="nginx-conf"]')).toBeTruthy();
  });
});
