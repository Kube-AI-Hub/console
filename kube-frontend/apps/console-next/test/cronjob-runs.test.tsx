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
import { WorkloadDetailPage } from '@/pages/app-workloads/WorkloadDetailPage';
import { WORKLOAD_DESCRIPTORS } from '@/pages/app-workloads/queries';

/**
 * 定时任务详情的「运行记录」页签（2026-11-19）。
 *
 * The page opens on that tab because the question a CronJob detail exists to answer is
 * "did it run, and did it work" — not "what is its schedule string". The cases below pin
 * the default tab, the row content, the empty state and 立即运行一次 (which creates a Job).
 */

const CRONJOB = {
  apiVersion: 'batch/v1',
  kind: 'CronJob',
  metadata: {
    name: 'nightly',
    namespace: 'default',
    creationTimestamp: '2026-11-18T00:00:00Z',
    labels: { app: 'nightly' },
  },
  spec: {
    schedule: '0 1 * * *',
    suspend: false,
    jobTemplate: {
      metadata: { labels: { 'cronjob-name': 'nightly' } },
      spec: {
        template: {
          spec: {
            restartPolicy: 'Never',
            containers: [{ name: 'main', image: 'nginx:1.27', resources: { requests: { cpu: '100m' } } }],
          },
        },
      },
    },
  },
  status: {},
};

const COMPLETED_JOB = {
  metadata: {
    name: 'nightly-29000001',
    namespace: 'default',
    creationTimestamp: '2026-11-18T01:00:00Z',
    ownerReferences: [{ kind: 'CronJob', name: 'nightly' }],
  },
  spec: { template: { spec: { containers: [{ name: 'main', resources: { requests: { cpu: '100m' } } }] } } },
  status: {
    startTime: '2026-11-18T01:00:01Z',
    completionTime: '2026-11-18T01:02:01Z',
    succeeded: 1,
    conditions: [{ type: 'Complete', status: 'True' }],
  },
};

const RUNNING_JOB = {
  metadata: {
    name: 'nightly-29000002',
    namespace: 'default',
    creationTimestamp: '2026-11-18T02:00:00Z',
    ownerReferences: [{ kind: 'CronJob', name: 'nightly' }],
  },
  spec: { template: { spec: { containers: [{ name: 'main' }] } } },
  status: { startTime: '2026-11-18T02:00:01Z', active: 1, conditions: [] },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function stubFetch(jobs: unknown[]) {
  const posts: Array<{ url: string; body: unknown }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const path = url.pathname;
      // The IAM review answers `allowed` at the top level; the kube fallback nests it under
      // `status`. Both are stubbed so the permission gate never decides this case.
      if (path.includes('selfsubjectaccessreviews')) return json({ allowed: true, status: { allowed: true } });
      if (init?.method === 'POST' && path.endsWith('/jobs')) {
        posts.push({ url: path, body: init.body ? JSON.parse(String(init.body)) : undefined });
        return json({ ...COMPLETED_JOB, metadata: { ...COMPLETED_JOB.metadata, name: 'nightly-manual-x' } });
      }
      if (path.endsWith('/cronjobs/nightly')) return json(CRONJOB);
      if (path.endsWith('/jobs')) return json({ items: jobs, totalItems: jobs.length });
      if (path.includes('/events')) return json({ items: [] });
      return json({ items: [], totalItems: 0 });
    }),
  );
  return posts;
}

function renderDetail() {
  const client = createQueryClient();
  const rootRoute = createRootRoute();
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/cronjobs/$name',
    component: () => (
      <WorkloadDetailPage
        descriptor={WORKLOAD_DESCRIPTORS['cronjobs']!}
        workspace="system-workspace"
        cluster="host"
        namespace="default"
        name="nightly"
      />
    ),
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([detailRoute]),
    history: createMemoryHistory({ initialEntries: ['/kube-frontend/system-workspace/clusters/host/projects/default/cronjobs/nightly'] }),
  });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="zh">
        <RouterProvider router={router} />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('定时任务详情 · 运行记录', () => {
  it('opens on the runs tab and lists each run with its outcome and duration', async () => {
    stubFetch([COMPLETED_JOB, RUNNING_JOB]);
    renderDetail();

    await screen.findByRole('heading', { name: 'nightly' });
    // The default tab is the run history, not the overview.
    expect(document.querySelector('[data-ai-id="workload-detail:tab:runs"]')).not.toBeNull();
    await waitFor(() => expect(document.querySelector('[data-ai-id="cronjobs-detail:runs-table"]')).not.toBeNull());

    const completedRow = document.querySelector('[data-ai-row="nightly-29000001"]')!;
    expect(completedRow.textContent).toContain('已完成');
    // 01:00:01 → 01:02:01 is two minutes.
    expect(completedRow.textContent).toContain('2 分');
    expect(completedRow.textContent).toContain('cpu: 0.1');
    // The Job name links to that Job's own page.
    const link = document.querySelector<HTMLAnchorElement>('[data-ai-id="cronjobs-detail:run:nightly-29000001"]');
    expect(link?.getAttribute('href')).toBe('/kube-frontend/system-workspace/clusters/host/projects/default/jobs/nightly-29000001');

    const runningRow = document.querySelector('[data-ai-row="nightly-29000002"]')!;
    expect(runningRow.textContent).toContain('运行中');
    // A run that has not finished has no duration — `-`, not 0.
    expect(runningRow.textContent).toContain('-');
  });

  it('explains an empty history instead of showing an empty table', async () => {
    stubFetch([]);
    renderDetail();
    await screen.findByRole('heading', { name: 'nightly' });
    await waitFor(() => expect(document.querySelector('[data-ai-id="cronjobs-detail:runs-empty"]')).not.toBeNull());
    expect(document.querySelector('[data-ai-id="cronjobs-detail:runs-table"]')).toBeNull();
    expect(document.querySelector('[data-ai-id="cronjobs-detail:runs-empty"]')!.textContent).toContain('还没有运行记录');
  });

  it('creates one Job from the template when 立即运行一次 is used', async () => {
    const posts = stubFetch([]);
    renderDetail();
    await screen.findByRole('heading', { name: 'nightly' });
    const user = userEvent.setup();
    await user.click(document.querySelector<HTMLElement>('[data-ai-id="cronjobs-detail:run-now"]')!);

    await waitFor(() => expect(posts.length).toBe(1));
    const body = posts[0]?.body as { kind: string; metadata: { labels: Record<string, string>; annotations: Record<string, string> } };
    expect(body.kind).toBe('Job');
    expect(body.metadata.labels).toEqual({ 'cronjob-name': 'nightly' });
    expect(body.metadata.annotations['cronjob.kubernetes.io/instantiate']).toBe('manual');
  });
});
