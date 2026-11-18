import { fireEvent, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { ClusterMonitorPage } from '@/pages/cluster/ClusterMonitorPage';
import { ClusterOverviewTab } from '@/pages/cluster/ClusterOverviewTab';
import { MONITOR_TABS, type MonitorTabKey } from '@/pages/cluster/monitorTabs';

/*
 * The status band links to the node list. Rendering 'Link' as an anchor keeps this
 * test about the page rather than about the router.
 */
/*
 * DonutChart carries recharts (a second React root in ai-kit's own install, React
 * 18). jsdom does not need the drawing: the app only owns the segment inputs and
 * the surrounding handles, and ai-kit's own suite covers the ring, legend and empty
 * state. Mocking the subpath keeps this test about the status band.
 */
vi.mock('@kube-ai-hub/ui/charts', () => ({
  DonutChart: ({ segments, label, emptyText, centerLabel }: {
    segments: { key: string; label: string; value: number }[];
    label: string;
    emptyText: string;
    centerLabel?: React.ReactNode;
  }) => (
    <div role="img" aria-label={label} data-ai-segments={segments.length}>
      {segments.length > 0 ? centerLabel ?? null : emptyText}
    </div>
  ),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, ...rest }: {
    children: React.ReactNode;
    to: string;
    params: Record<string, string>;
    [key: string]: unknown;
  }) => (
    <a
      href={Object.entries(params).reduce((url, [key, value]) => url.replace('$' + key, value), to)}
      {...rest}
    >
      {children}
    </a>
  ),
}));

function mount(element: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="zh">{element}</I18nProvider>
    </QueryClientProvider>,
  );
}

const readyCluster = {
  metadata: { name: 'host' },
  status: { conditions: [{ type: 'Ready', status: 'True' }], configz: { monitoring: true, logging: true, devops: true } },
};

const healthyComponentHealth = {
  nodeStatus: { totalNodes: 3, healthyNodes: 3 },
  kubesphereStatus: [
    { name: 'ks-apiserver', namespace: 'kubesphere-system', totalBackends: 1, healthyBackends: 1 },
    { name: 'coredns', namespace: 'kube-system', totalBackends: 2, healthyBackends: 2 },
  ],
};

/** One metric as the range API answers it. */
function series(name: string, points: { at: number; value: number }[]) {
  return {
    metric_name: name,
    data: {
      resultType: 'matrix',
      result: [{ metric: {}, values: points.map((point) => [Math.round(point.at / 1000), String(point.value)]) }],
    },
  };
}

type MetricSeriesFixture = ReturnType<typeof series>;

/**
 * Stub every read a monitor tab can make.
 *
 * 'metrics' decides what the range API answers; the page/tab tests override it to
 * sit in the data or the no-data branch. Anything unexpected throws, so a tab that
 * quietly starts requesting a new endpoint fails the test instead of hiding.
 */
/** One readable point for the default fixture; the overview is "ready" when it has data. */
function defaultMetrics(): MetricSeriesFixture[] {
  const at = Math.floor(Date.now() / 1000) * 1000;
  return [
    series('cluster_cpu_usage', [{ at, value: 1 }]),
    series('cluster_cpu_total', [{ at, value: 4 }]),
  ];
}

function stubApi(
  metrics: (url: URL) => MetricSeriesFixture[] = defaultMetrics,
  options: { etcdStatus?: number } = {},
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const path = url.pathname;
    if (path.endsWith('/clusters/host')) return Response.json(readyCluster);
    if (path.endsWith('/componenthealth')) return Response.json(healthyComponentHealth);
    if (path.endsWith('/nodes/stats')) return Response.json({ nvidia: 3, healthy: 3, total: 3 });
    if (path.endsWith('/servicemonitors/etcd')) {
      // 200 means etcd is wired into monitoring and the conditional tab exists.
      if (options.etcdStatus === 200) return Response.json({});
      return new Response(JSON.stringify({ reason: 'NotFound' }), {
        status: options.etcdStatus ?? 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (path.includes('/kapis/monitoring.kubesphere.io/')) return Response.json({ results: metrics(url) });
    throw new Error('unexpected request ' + path);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** How many requests a given path fragment received. */
function requestCount(fetchMock: ReturnType<typeof vi.fn>, fragment: string): number {
  return fetchMock.mock.calls.filter((call) => String(call[0]).includes(fragment)).length;
}

/** A context for mounting one tab without the page shell. */
function context(overrides: Partial<React.ComponentProps<typeof ClusterOverviewTab>> = {}): React.ComponentProps<typeof ClusterOverviewTab> {
  const end = Math.floor(Date.now() / 1000) * 1000;
  return { cluster: 'host', rangeKey: '1h', start: end - 3_600_000, end, step: '60s', live: false, ...overrides };
}

describe('cluster monitor tabs', () => {
  it('renders the five tabs and opens the overview by default', async () => {
    stubApi();
    const view = mount(<ClusterMonitorPage cluster="host" />);

    for (const key of MONITOR_TABS) {
      expect(view.container.querySelector('[data-ai-id="cluster-monitor:tab:' + key + '"]')).not.toBeNull();
    }
    await waitFor(() =>
      expect(view.container.querySelector('[data-ai-id="cluster-monitor:tabpanel:overview"]')).not.toBeNull(),
    );
    await waitFor(() =>
      expect(view.container.querySelector('[data-ai-id="cluster-monitor:surface"]')).toHaveAttribute('data-ai-state', 'ready'),
    );
    expect(view.container.querySelector('[data-ai-id="cluster-monitor:overview"]')).not.toBeNull();
    // Only the active tab's component is mounted: the other panel wrappers exist
    // (Radix renders them with `hidden`) but hold no content.
    expect(view.container.querySelector('[data-ai-id="cluster-monitor:tabpanel:ranking"]')).toBeEmptyDOMElement();
  });

  it('switches tabs, mounts only the clicked tab and does not re-read the old one', async () => {
    const fetchMock = stubApi();
    const onTabChange = vi.fn();
    const view = mount(<ClusterMonitorPage cluster="host" onTabChange={onTabChange} />);

    await waitFor(() =>
      expect(view.container.querySelector('[data-ai-id="cluster-monitor:overview"]')).not.toBeNull(),
    );
    await waitFor(() => expect(requestCount(fetchMock, '/componenthealth')).toBe(1));

    // Radix's trigger activates on mousedown, not click.
    fireEvent.mouseDown(view.container.querySelector('[data-ai-id="cluster-monitor:tab:resource"]')!, { button: 0 });

    await waitFor(() =>
      expect(view.container.querySelector('[data-ai-id="cluster-monitor:resource"]')).not.toBeNull(),
    );
    expect(view.container.querySelector('[data-ai-id="cluster-monitor:overview"]')).toBeNull();
    expect(onTabChange).toHaveBeenCalledWith('resource');
    // The status band lives on the overview; switching away must not fire its reads
    // again, and the resource tab must not have borrowed the page's range read.
    expect(requestCount(fetchMock, '/componenthealth')).toBe(1);
  });

  it('opens the tab named by the URL', async () => {
    stubApi();
    const view = mount(<ClusterMonitorPage cluster="host" tab="scheduler" />);

    await waitFor(() =>
      expect(view.container.querySelector('[data-ai-id="cluster-monitor:tabpanel:scheduler"]')).not.toBeNull(),
    );
    expect(view.container.querySelector('[data-ai-id="cluster-monitor:tab:scheduler"]')).toHaveAttribute('data-state', 'active');
    // The overview was never mounted: its status reads are absent.
    expect(view.container.querySelector('[data-ai-id="cluster-monitor:overview"]')).toBeNull();
    expect(view.container.querySelector('[data-ai-id="cluster-monitor:status"]')).toBeNull();
  });

  it('offers the etcd tab only when etcd is monitored', async () => {
    stubApi(() => [], { etcdStatus: 200 });
    const view = mount(<ClusterMonitorPage cluster="host" />);

    await waitFor(() =>
      expect(view.container.querySelector('[data-ai-id="cluster-monitor:tab:etcd"]')).not.toBeNull(),
    );
    expect(view.container.querySelector('[data-ai-id="cluster-monitor:tab:etcd"]')).toHaveTextContent('etcd');
  });

  it('hides the conditional etcd tab when its service monitor is absent', async () => {
    const fetchMock = stubApi();
    const view = mount(<ClusterMonitorPage cluster="host" />);

    await waitFor(() =>
      expect(view.container.querySelector('[data-ai-id="cluster-monitor:overview"]')).not.toBeNull(),
    );
    await waitFor(() => expect(requestCount(fetchMock, '/servicemonitors/etcd')).toBe(1));
    // The probe answered 404: the strip keeps the five base tabs.
    expect(view.container.querySelector('[data-ai-id="cluster-monitor:tab:etcd"]')).toBeNull();
  });

  it('opens a deep link to the etcd tab when it exists', async () => {
    stubApi(() => [], { etcdStatus: 200 });
    const view = mount(<ClusterMonitorPage cluster="host" tab="etcd" />);

    await waitFor(() =>
      expect(view.container.querySelector('[data-ai-id="cluster-monitor:etcd"]')).not.toBeNull(),
    );
    await waitFor(() =>
      expect(view.container.querySelector('[data-ai-id="cluster-monitor:tab:etcd"]')).not.toBeNull(),
    );
    expect(view.container.querySelector('[data-ai-id="cluster-monitor:tab:etcd"]')).toHaveAttribute('data-state', 'active');
  });

  it('falls back to the overview for a hidden etcd deep link', async () => {
    stubApi();
    const onTabChange = vi.fn();
    const view = mount(<ClusterMonitorPage cluster="host" tab="etcd" onTabChange={onTabChange} />);

    await waitFor(() =>
      expect(view.container.querySelector('[data-ai-id="cluster-monitor:overview"]')).not.toBeNull(),
    );
    expect(view.container.querySelector('[data-ai-id="cluster-monitor:etcd"]')).toBeNull();
    // The URL is normalized rather than left pointing at a tab that does not exist.
    await waitFor(() => expect(onTabChange).toHaveBeenCalledWith('overview'));
  });

  it('falls back to the overview for an unknown tab value', async () => {
    stubApi();
    // A hand-edited URL / stale bookmark can deliver a value the route did not accept.
    const view = mount(<ClusterMonitorPage cluster="host" tab={'bogus' as MonitorTabKey} />);

    await waitFor(() =>
      expect(view.container.querySelector('[data-ai-id="cluster-monitor:overview"]')).not.toBeNull(),
    );
    // The regression this guards: an unmatched tab mounts no panel, no tab reports a
    // state, and the surface used to stay 'loading' forever.
    await waitFor(() =>
      expect(view.container.querySelector('[data-ai-id="cluster-monitor:surface"]')).toHaveAttribute('data-ai-state', 'ready'),
    );
  });

  it('keeps the node variant tab-free', async () => {
    stubApi();
    const view = mount(<ClusterMonitorPage cluster="host" node="node-1" />);

    await waitFor(() =>
      expect(view.container.querySelector('[data-ai-id="cluster-monitor:node-trends"]')).not.toBeNull(),
    );
    for (const key of MONITOR_TABS) {
      expect(view.container.querySelector('[data-ai-id="cluster-monitor:tab:' + key + '"]')).toBeNull();
    }
    expect(view.container.querySelector('[data-ai-id="cluster-monitor:status"]')).toBeNull();
    expect(view.container.querySelector('h1')).toHaveTextContent('node-1');
  });
});

describe('cluster monitor overview tab', () => {
  it('prints used/total for the seven rows and a dash when a metric is missing', async () => {
    const end = Math.floor(Date.now() / 1000) * 1000;
    const start = end - 3_600_000;
    stubApi(() => [
      series('cluster_gpu_memory_usage', [{ at: start, value: 0 }, { at: end, value: 1024 ** 3 }]),
      series('cluster_gpu_memory_total', [{ at: start, value: 1024 ** 3 }, { at: end, value: 4 * 1024 ** 3 }]),
      series('cluster_gpu_memory_utilisation', [{ at: end, value: 0.25 }]),
    ]);
    const view = mount(<ClusterOverviewTab {...context()} />);

    await waitFor(() =>
      expect(view.container.querySelector('[data-ai-id="cluster-monitor:overview:usage:gpuMemory:value"]')).not.toBeNull(),
    );
    // bytes are printed in binary units and the pair describes one instant.
    expect(view.container.querySelector('[data-ai-id="cluster-monitor:overview:usage:gpuMemory:value"]'))
      .toHaveTextContent('1 GiB / 4 GiB');
    // A missing metric is a dash, never a zero.
    expect(view.container.querySelector('[data-ai-id="cluster-monitor:overview:usage:cpu:value"]')).toHaveTextContent('-');
    // The main chart renders the selected row's trend.
    expect(view.container.querySelector('[data-ai-id="cluster-monitor:overview:usage-chart"]'))
      .toHaveAttribute('data-ai-state', 'ready');
    expect(view.container.querySelector('[data-ai-id="cluster-monitor:overview:usage-chart:legend"]')).not.toBeNull();
  });

  it('draws no zero line when the range has no data', async () => {
    stubApi(() => []);
    const view = mount(<ClusterOverviewTab {...context()} />);

    await waitFor(() =>
      expect(view.container.querySelector('[data-ai-id="cluster-monitor:overview:usage-chart:empty"]')).not.toBeNull(),
    );
    expect(view.container.querySelector('[data-ai-id="cluster-monitor:overview:usage-chart"]'))
      .toHaveAttribute('data-ai-state', 'empty');
    // Every row reports a dash rather than a fabricated zero.
    for (const key of ['gpuMemory', 'gpu', 'gpuAllocated', 'cpu', 'memory', 'disk', 'pods']) {
      expect(view.container.querySelector('[data-ai-id="cluster-monitor:overview:usage:' + key + ':value"]'))
        .toHaveTextContent('-');
    }
    expect(view.container.querySelector('[data-ai-id="cluster-monitor:overview:rdma"]'))
      .toHaveAttribute('data-ai-state', 'empty');
  });

  it('switches to the physical-resource tab from the RDMA summary', async () => {
    stubApi(() => []);
    const onTabChange = vi.fn();
    const view = mount(<ClusterOverviewTab {...context({ onTabChange })} />);

    await waitFor(() =>
      expect(view.container.querySelector('[data-ai-id="cluster-monitor:overview:view-rdma"]')).not.toBeNull(),
    );
    fireEvent.click(view.container.querySelector('[data-ai-id="cluster-monitor:overview:view-rdma"]')!);
    expect(onTabChange).toHaveBeenCalledWith('resource');
  });
});