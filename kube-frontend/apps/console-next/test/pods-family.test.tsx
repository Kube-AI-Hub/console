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
import { WorkloadListPage } from '@/pages/app-workloads/WorkloadListPage';
import { WorkloadDetailPage } from '@/pages/app-workloads/WorkloadDetailPage';
import { WORKLOAD_DESCRIPTORS } from '@/pages/app-workloads/queries';

/**
 * 容器组页面族（2026-11-18）：列表的状态筛选、节点下钻与状态原因，详情的调度信息与环境变量页签。
 *
 * Stubs answer kube-api shapes, not a made-up envelope: the mapper under test reads
 * `metadata`/`spec`/`status`, so a test that answered `{items, total}` with flat rows
 * would pass while the real response mapped to empty strings.
 */

const podsBody = {
  kind: 'PodList',
  items: [
    {
      metadata: { name: 'web-0', namespace: 'default', creationTimestamp: '2026-11-18T09:00:00Z', labels: { app: 'web' } },
      spec: { nodeName: 'gpu01', containers: [{ name: 'app', image: 'nginx:1.27' }] },
      status: {
        phase: 'Running',
        podIP: '10.244.0.7',
        hostIP: '10.0.0.5',
        conditions: [{ type: 'PodScheduled', status: 'True', lastTransitionTime: '2026-11-18T09:00:03Z' }],
        containerStatuses: [{ name: 'app', ready: true, restartCount: 0, state: { running: { startedAt: '2026-11-18T09:00:04Z' } } }],
      },
    },
    {
      metadata: { name: 'web-1', namespace: 'default', creationTimestamp: '2026-11-18T09:05:00Z' },
      spec: { nodeName: 'gpu01', containers: [{ name: 'app', image: 'nginx:1.27' }] },
      status: {
        phase: 'Running',
        hostIP: '10.0.0.5',
        containerStatuses: [{ name: 'app', ready: false, restartCount: 7, state: { waiting: { reason: 'CrashLoopBackOff' } } }],
      },
    },
  ],
  totalItems: 2,
};

const podDetail = {
  kind: 'Pod',
  apiVersion: 'v1',
  metadata: {
    name: 'web-0',
    namespace: 'default',
    creationTimestamp: '2026-11-18T09:00:00Z',
    labels: { app: 'web' },
    annotations: { 'hami.io/vgpu-devices-allocated': 'GPU-aaa,NVIDIA,10240,50' },
  },
  spec: {
    nodeName: 'gpu01',
    containers: [
      {
        name: 'app',
        image: 'nginx:1.27',
        resources: { requests: { cpu: '250m', memory: '256Mi' }, limits: { cpu: '1', memory: '1Gi' } },
        env: [
          { name: 'MODE', value: 'fast' },
          { name: 'DB_PASSWORD', value: 'hunter2' },
          { name: 'FROM_CONFIG', valueFrom: { configMapKeyRef: { name: 'app-config', key: 'mode' } } },
          { name: 'VAULT_TOKEN', valueFrom: { secretKeyRef: { name: 'app-secret', key: 'token' } } },
        ],
      },
    ],
    initContainers: [{ name: 'init-db', resources: { requests: { cpu: '500m' } } }],
  },
  status: {
    phase: 'Running',
    podIP: '10.244.0.7',
    hostIP: '10.0.0.5',
    qosClass: 'Burstable',
    conditions: [
      { type: 'PodScheduled', status: 'True', lastTransitionTime: '2026-11-18T09:00:03Z' },
      { type: 'Initialized', status: 'True', lastTransitionTime: '2026-11-18T09:00:04Z' },
      { type: 'Ready', status: 'False', reason: 'ContainersNotReady', message: 'containers with unready status: [app]', lastTransitionTime: '2026-11-18T09:02:00Z' },
    ],
    containerStatuses: [{ name: 'app', ready: false, restartCount: 7, state: { running: { startedAt: '2026-11-18T09:00:05Z' } } }],
  },
};

const projectsBody = {
  kind: 'NamespaceList',
  items: [{ metadata: { name: 'default', labels: { 'kubesphere.io/workspace': 'system-workspace' } }, status: { phase: 'Active' } }],
  totalItems: 1,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** Records every list request so a filter can be asserted on the URL it really sent. */
function stubFetch(listResponses: unknown[] = [podsBody]) {
  const requests: URL[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const path = url.pathname;
      if (path.endsWith('/namespaces')) return json(projectsBody);
      if (path.endsWith('/configmaps/app-config')) return json({ metadata: { name: 'app-config' }, data: { mode: 'from-config' } });
      if (path.endsWith('/secrets/app-secret')) return json({ metadata: { name: 'app-secret' }, data: { token: btoa('s3cr3t') } });
      if (path.includes('/events')) return json({ items: [] });
      if (path.endsWith('/pods/web-0')) return json(podDetail);
      if (path.endsWith('/pods')) {
        requests.push(url);
        return json(listResponses[Math.min(requests.length - 1, listResponses.length - 1)]);
      }
      return json({ items: [], totalItems: 0 });
    }),
  );
  return requests;
}

function renderList() {
  const client = createQueryClient();
  const rootRoute = createRootRoute();
  const listRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/pods',
    component: () => (
      <WorkloadListPage descriptor={WORKLOAD_DESCRIPTORS['pods']!} workspace="system-workspace" cluster="host" namespace="default" />
    ),
  });
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/pods/$name',
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([listRoute.addChildren([detailRoute])]),
    history: createMemoryHistory({ initialEntries: ['/kube-frontend/system-workspace/clusters/host/projects/default/pods'] }),
  });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="zh">
        <RouterProvider router={router} />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

function renderDetail() {
  const client = createQueryClient();
  const rootRoute = createRootRoute();
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/pods/$name',
    component: () => (
      <WorkloadDetailPage descriptor={WORKLOAD_DESCRIPTORS['pods']!} workspace="system-workspace" cluster="host" namespace="default" name="web-0" />
    ),
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([detailRoute]),
    history: createMemoryHistory({ initialEntries: ['/kube-frontend/system-workspace/clusters/host/projects/default/pods/web-0'] }),
  });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="zh">
        <RouterProvider router={router} />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('容器组列表', () => {
  it('shows the container reason next to the status badge', async () => {
    stubFetch();
    renderList();
    await screen.findByText('web-0');
    // The waiting container's reason is the answer to "why is this one unhealthy";
    // the running pod with no reason must not grow an empty line.
    expect(document.querySelector('[data-ai-id="pods:reason:web-1"]')).toHaveTextContent('CrashLoopBackOff');
    expect(document.querySelector('[data-ai-id="pods:reason:web-0"]')).toBeNull();
  });

  it('links the node column to that node, with the node IP beside it', async () => {
    stubFetch();
    renderList();
    await screen.findByText('web-0');
    const link = document.querySelector<HTMLAnchorElement>('[data-ai-id="pods:node:web-0"]');
    expect(link).not.toBeNull();
    expect(link!.getAttribute('href')).toBe('/kube-frontend/clusters/host/nodes/gpu01');
    expect(link!.textContent).toContain('10.0.0.5');
  });

  it('sends the status filter to the server and resets to page 1', async () => {
    const requests = stubFetch();
    renderList();
    await screen.findByText('web-0');
    const user = userEvent.setup();
    await user.click(document.querySelector<HTMLElement>('[data-ai-id="pods:filter:status"]')!);
    await user.click(await screen.findByRole('option', { name: '运行中' }));
    await waitFor(() => {
      const filtered = requests.at(-1)!;
      expect(filtered.searchParams.get('status')).toBe('Running');
      expect(filtered.searchParams.get('page')).toBe('1');
    });
  });
});

describe('容器组详情', () => {
  it('offers the scheduling and environment tabs the old page had', async () => {
    stubFetch();
    renderDetail();
    await screen.findByRole('heading', { name: 'web-0' });
    expect(document.querySelector('[data-ai-id="workload-detail:tab-trigger:schedule"]')).not.toBeNull();
    expect(document.querySelector('[data-ai-id="workload-detail:tab-trigger:env"]')).not.toBeNull();
  });

  it('shows the scheduling result, the GPU allocation and the conditions', async () => {
    stubFetch();
    renderDetail();
    await screen.findByRole('heading', { name: 'web-0' });
    const user = userEvent.setup();
    await user.click(document.querySelector<HTMLElement>('[data-ai-id="workload-detail:tab-trigger:schedule"]')!);

    const panel = document.querySelector('[data-ai-id="workload-detail:tab:schedule"]')!;
    expect(panel.textContent).toContain('已调度到节点 gpu01');
    // A missing condition must not be invented: Ready is present, ContainersReady is not.
    expect(document.querySelector('[data-ai-id="pods-detail:condition:PodScheduled"]')).not.toBeNull();
    expect(document.querySelector('[data-ai-id="pods-detail:condition:Ready"]')!.textContent).toContain('ContainersNotReady');
    expect(document.querySelector('[data-ai-id="pods-detail:condition:ContainersReady"]')).toBeNull();
    // The GPU link points at that card's page on the cluster GPU list.
    expect(document.querySelector<HTMLAnchorElement>('[data-ai-id="pods-detail:gpu:GPU-aaa"]')!.getAttribute('href')).toBe(
      '/kube-frontend/clusters/host/gpus/GPU-aaa',
    );
  });

  it('resolves environment variables and masks the password-like names', async () => {
    stubFetch();
    renderDetail();
    await screen.findByRole('heading', { name: 'web-0' });
    const user = userEvent.setup();
    await user.click(document.querySelector<HTMLElement>('[data-ai-id="workload-detail:tab-trigger:env"]')!);

    await waitFor(() => expect(document.querySelector('[data-ai-id="pods-detail:env:app"]')).not.toBeNull());
    const card = document.querySelector('[data-ai-id="pods-detail:env:app"]')!;
    expect(card.textContent).toContain('MODE');
    // A ConfigMap reference shows the value of the key it names.
    expect(card.textContent).toContain('from-config');
    // A Secret reference is base64 in the object and readable here (its name says
    // "token", not "secret", so the masking rule does not apply to it).
    expect(card.textContent).toContain('s3cr3t');
    // A password-named variable is masked, and its literal value never reaches the DOM.
    expect(card.textContent).toContain('******');
    expect(card.textContent).not.toContain('hunter2');
  });

  it('sums the container requests and limits on the overview', async () => {
    stubFetch();
    renderDetail();
    await screen.findByRole('heading', { name: 'web-0' });
    const requests = document.querySelector('[data-ai-id="pods-detail:requests"]')!;
    // 250m from the app container plus 500m from the init container.
    expect(requests.textContent).toContain('cpu: 0.75');
    expect(requests.textContent).toContain('memory: 256Mi');
    const limits = document.querySelector('[data-ai-id="pods-detail:limits"]')!;
    expect(limits.textContent).toContain('memory: 1024Mi');
  });
});
