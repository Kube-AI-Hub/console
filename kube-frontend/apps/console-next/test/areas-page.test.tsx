import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { createQueryClient } from '@/query';
import { I18nProvider } from '@/i18n';
import { StorageClassesPage } from '@/pages/cluster/StorageClassesPage';
import { ComponentsPage } from '@/pages/cluster/ComponentsPage';
import { ProjectInfoPage } from '@/pages/settings/ProjectInfoPage';
import { NetworkIsolationPage } from '@/pages/settings/NetworkIsolationPage';

/**
 * Pages of the six areas migrated after the first three.
 *
 * Those three have page tests; the rest were covered by E2E alone. These cases pin the
 * decisions that are cheapest to break and most annoying to debug in a browser: an
 * empty list hiding its header, a component with no backends not reading as healthy, a
 * missing quota saying so, and a class's capabilities appearing only when declared.
 */

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function stubFetch(handler: (url: string) => Response | undefined) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => handler(String(input)) ?? json({ items: [], totalItems: 0 }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function surface(aiId: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-ai-id="${aiId}"]`);
  if (!element) throw new Error(`${aiId} not rendered`);
  return element;
}

/**
 * Render one page at `path`.
 *
 * The root route is created once and the page route attached to it: creating a second
 * root leaves the tree without the page, which renders an empty document.
 */
function renderPage(path: string, Page: () => React.ReactElement) {
  const rootRoute = createRootRoute();
  const pageRoute = createRoute({ getParentRoute: () => rootRoute, path, component: Page });
  const router = createRouter({
    routeTree: rootRoute.addChildren([pageRoute]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <I18nProvider locale="zh">
        <RouterProvider router={router} />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('storage classes', () => {
  it('renders only the capabilities a class declares', async () => {
    stubFetch((url) =>
      url.includes('/storageclasses')
        ? json({
            items: [
              { metadata: { name: 'plain' }, provisioner: 'example.io/x', allowVolumeExpansion: false },
              { metadata: { name: 'growable' }, provisioner: 'example.io/y', allowVolumeExpansion: true },
            ],
            totalItems: 2,
          })
        : undefined,
    );
    renderPage('/kube-frontend/clusters/$cluster/storageclasses', () => <StorageClassesPage cluster="host" />);

    await waitFor(() => expect(document.querySelector('[data-ai-row="plain"]')).toBeTruthy());
    // Rendering all three badges and colouring them by support made every class look
    // fully featured; only the declared ones may appear.
    expect(document.querySelector('[data-ai-row="plain"]')?.textContent).not.toContain('扩容');
    expect(document.querySelector('[data-ai-row="growable"]')?.textContent).toContain('扩容');
  });
});

describe('components', () => {
  it('does not call a component with no backends healthy', async () => {
    stubFetch((url) =>
      url.includes('/components')
        ? // A bare array: this endpoint does not use the { items } envelope.
          json([
            { name: 'never-started', namespace: 'kube-system', healthyBackends: 0, totalBackends: 0 },
            { name: 'fine', namespace: 'kube-system', healthyBackends: 1, totalBackends: 1 },
          ])
        : undefined,
    );
    renderPage('/kube-frontend/clusters/$cluster/components', () => <ComponentsPage cluster="host" />);

    await waitFor(() => expect(document.querySelector('[data-ai-row="never-started"]')).toBeTruthy());
    expect(document.querySelector('[data-ai-row="never-started"]')?.textContent).toContain('无后端');
    // Unhealthy rows sort first so the one broken component is not buried in 49 rows.
    expect(document.querySelector('[data-ai-row]')?.getAttribute('data-ai-row')).toBe('never-started');
  });
});

describe('project basics', () => {
  it('says a project has no quota instead of leaving the block blank', async () => {
    stubFetch((url) => {
      if (url.includes('resourcequotas')) return json({ items: [] });
      if (url.includes('/namespaces/default')) {
        return json({
          metadata: { name: 'default', annotations: {}, labels: { 'kubesphere.io/workspace': 'ws1' } },
          status: { phase: 'Active' },
        });
      }
      return undefined;
    });
    renderPage('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/baseinfo', () => (
      <ProjectInfoPage cluster="host" namespace="default" />
    ));

    await waitFor(() => expect(document.querySelector('[data-ai-id="project-info:quota"]')).toBeTruthy());
    expect(surface('project-info:quota').textContent).toContain('没有设置资源配额');
  });
});

describe('network isolation', () => {
  it('reports an empty policy list without a header row', async () => {
    stubFetch((url) => {
      if (url.includes('networkpolicies')) return json({ items: [], totalItems: 0 });
      if (url.includes('/namespaces/default')) return json({ metadata: { name: 'default', annotations: {} } });
      return undefined;
    });
    renderPage('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/networkpolicies', () => (
      <NetworkIsolationPage workspace="system-workspace" cluster="host" namespace="default" />
    ));

    await waitFor(() => expect(surface('networkpolicies:surface')).toHaveAttribute('data-ai-state', 'empty'));
    expect(surface('networkpolicies:surface').querySelector('thead')).toBeNull();
    // The project-level switch stays available even with no policies: it is how a
    // project starts being isolated.
    expect(surface('networkpolicies:isolation')).toBeTruthy();
  });
});
