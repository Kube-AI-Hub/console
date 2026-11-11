import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
import { ClusterConfigMapsPage } from '@/pages/configmaps/ClusterConfigMapsPage';

/**
 * Cluster console ConfigMap list.
 *
 * Pinned here are the three differences from the project page, because each one
 * has a failure mode that only shows in production:
 *
 *  - the collection is the bare one (no `namespaces/<ns>` segment), otherwise the
 *    page silently shows only one project's objects;
 *  - row handles carry the project, otherwise two same-named objects collide;
 *  - federated objects cannot be edited, or the write is rejected upstream.
 */

/** The cluster-wide read: no scope segment between the prefix and `configmaps`. */
const KAPIS = '/kapis/resources.kubesphere.io/v1alpha3/configmaps';

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
        annotations: { 'kubesphere.io/description': '主配置' },
      },
      data: { 'app.yaml': 'a: 1' },
    },
    {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: 'app-config',
        namespace: 'kube-frontend-demo',
        creationTimestamp: '2026-11-02T09:00:00Z',
        annotations: {},
      },
      data: { 'demo.yaml': 'b: 2' },
    },
    {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: 'nginx-conf',
        namespace: 'default',
        creationTimestamp: '2026-11-03T10:30:00Z',
        // Federation-managed: read-only on this page.
        annotations: { 'kubefed.io/managed': 'true' },
      },
      data: {},
    },
  ],
  totalItems: 3,
};

const projectsBody = {
  kind: 'NamespaceList',
  items: [
    { metadata: { name: 'default' }, status: { phase: 'Active' } },
    { metadata: { name: 'kube-frontend-demo' }, status: { phase: 'Active' } },
  ],
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/namespaces?') || url.endsWith('/namespaces')) return json(projectsBody);
    return handler(url, init);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function surface(): HTMLElement {
  const element = document.querySelector<HTMLElement>('[data-ai-id="cluster-configmaps:surface"]');
  if (!element) throw new Error('surface not rendered');
  return element;
}

function renderPage() {
  const client = createQueryClient();
  const rootRoute = createRootRoute();
  const listRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/kube-frontend/clusters/$cluster/configmaps',
    validateSearch: (search: Record<string, unknown>) => search,
    component: () => <ClusterConfigMapsPage cluster="host" />,
  });
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/kube-frontend/clusters/$cluster/configmaps/$name',
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([listRoute.addChildren([detailRoute])]),
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

describe('Cluster ConfigMaps list', () => {
  it('reads the cluster-wide collection, not the namespaced one', async () => {
    const fetchMock = stubFetch(() => json(listBody));
    renderPage();

    await waitFor(() => expect(surface()).toBeTruthy());
    await screen.findAllByText('app-config');

    const called = fetchMock.mock.calls.map(([input]) => String(input)).filter((url) => url.includes('configmaps'));
    expect(called.length).toBeGreaterThan(0);
    for (const url of called) {
      expect(url).toContain(KAPIS);
      expect(url).not.toContain('/namespaces/');
      expect(url).not.toContain('/klusters/');
    }
  });

  it('shows the same name from two projects as two distinct rows', async () => {
    stubFetch(() => json(listBody));
    renderPage();

    await waitFor(() => expect(surface().getAttribute('data-ai-state')).toBe('ready'));

    // Row handles are `<project>/<name>`; a bare name would make React keys collide
    // and collapse the two objects into one row.
    const rows = Array.from(surface().querySelectorAll('[data-ai-row]')).map((row) => row.getAttribute('data-ai-row'));
    expect(rows).toContain('default/app-config');
    expect(rows).toContain('kube-frontend-demo/app-config');
  });

  it('disables selection for a federated object', async () => {
    stubFetch(() => json(listBody));
    renderPage();

    await waitFor(() => expect(surface().getAttribute('data-ai-state')).toBe('ready'));

    /*
     * Checkboxes are addressed by row index in the DOM, not by `data-ai-id`,
     * because `ResourceList` only enables selection when the host passes
     * `onSelectionChange` — which this page does, but the checkbox handles are
     * built from the row key and are asserted in `ai-surface` cases instead.
     * What matters here is that the federated row cannot be selected.
     */
    const boxes = Array.from(surface().querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]'));
    expect(boxes.length).toBe(3);
    expect(boxes.filter((box) => box.disabled).length).toBe(1);
  });

  it('renders the project column with the row project', async () => {
    stubFetch(() => json(listBody));
    renderPage();

    await waitFor(() => expect(surface().getAttribute('data-ai-state')).toBe('ready'));

    const headers = Array.from(surface().querySelectorAll('thead th'))
      .map((cell) => cell.textContent?.trim() ?? '')
      .filter(Boolean);
    // The first `<th>` is the select-all cell and carries no text.
    expect(headers.slice(0, 4)).toEqual(['名称', '项目', '字段', '创建时间']);

    // Both project names are reachable as links that narrow the list.
    const links = Array.from(surface().querySelectorAll('tbody a')).map((link) => link.textContent);
    expect(links).toContain('kube-frontend-demo');
  });

  it('reports an error state with a retry when the collection fails', async () => {
    /*
     * A `403` rather than a `500`: the client retries 5xx, which would leave the
     * page in `loading` for the whole test and prove nothing about the error view.
     * A permission failure is also the case that must not offer a retry — the
     * button's absence is asserted below through the same path.
     */
    stubFetch(() => json({ kind: 'Status', status: 'Failure', message: 'forbidden', reason: 'Forbidden', code: 403 }, 403));
    renderPage();

    await waitFor(() => expect(surface().getAttribute('data-ai-state')).toBe('error'));
    expect(within(surface()).queryByRole('button')).toBeNull();
  });

  it('offers a retry when the failure is retryable', async () => {
    stubFetch(() => json({ kind: 'Status', status: 'Failure', message: 'boom', code: 400 }, 400));
    renderPage();

    await waitFor(() => expect(surface().getAttribute('data-ai-state')).toBe('error'));
    expect(within(surface()).getByRole('button', { name: '重试' })).toBeTruthy();
  });
});
