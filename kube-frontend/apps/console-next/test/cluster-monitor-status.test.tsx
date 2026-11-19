import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { ClusterStatusSection } from '@/pages/cluster/ClusterStatusSection';

/*
 * 'Link' is the only router entry the section uses: the node ring opens the node
 * list. Rendering it as an anchor keeps this test about the section rather than
 * about the router.
 */
/*
 * DonutChart carries recharts (a second React root in ai-kit's own install, React
 * 18). jsdom does not need the drawing: the app only owns the segment inputs and
 * the surrounding handles, and ai-kit's own suite covers the ring, legend and empty
 * state. Mocking the subpath keeps this test about the status band.
 */
vi.mock('@kube-ai-hub/ui/charts', () => ({
  /*
   * The drawing library does not paint in jsdom, so the three chart components are
   * replaced with the smallest stand-ins that keep their observable contract: the
   * label, the segment/slice count and the centre content. The tests below assert the
   * block's states and handles, not the pixels.
   */
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
  PieChart: ({ slices, label, emptyText, centerLabel }: {
    slices: { key: string; label: string; value: number }[];
    label: string;
    emptyText: string;
    centerLabel?: React.ReactNode;
  }) => (
    <div role="img" aria-label={label} data-ai-slices={slices?.length ?? 0}>
      {slices && slices.length > 0 ? centerLabel ?? null : emptyText}
    </div>
  ),
  ProgressRing: ({ used, total, label, centerLabel }: {
    used: number;
    total?: number;
    label: string;
    centerLabel?: React.ReactNode;
  }) => (
    <div role="img" aria-label={label} data-ai-progress-used={used} data-ai-progress-total={total}>
      {centerLabel ?? null}
    </div>
  ),
  // The monitor page's header range control; its calendar is ai-kit's own subject.
  TimeRangePicker: ({ value }: { value: { kind: string; key?: string } }) => (
    <button type="button" data-ai-range-kind={value.kind}>{value.kind === 'relative' ? value.key : 'custom'}</button>
  ),
  TimeSeriesChart: ({ label, emptyText }: { label: string; emptyText: string }) => (
    <div role="img" aria-label={label} data-ai-state="ready">{emptyText}</div>
  ),
  seriesColors: () => new Map<string, string>(),
  FALLBACK_CHART_COLORS: ['rgb(0 0 0)'],
  CHART_TOKENS: [],
  rangePresets: (labelOf: (key: string) => string) => [{ key: '1h', ms: 3_600_000, label: labelOf('1h') }],
  presetRange: (key: string) => ({ kind: 'relative', key, ms: 3_600_000 }),
  resolveRange: () => ({ start: 0, end: 3_600_000, step: '60s' }),
  gapForStep: () => 180_000,
  stepForSpan: () => '60s',
  stepToMs: () => 60_000,
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

/**
 * Like 'mount', but keeps the client and can rerender inside the same providers.
 *
 * The polling test has to flip 'live' on one mounted section: unmounting would
 * destroy the observers and prove nothing about what the switch does.
 */
function mountWithClient(element: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = (node: React.ReactNode) => (
    <QueryClientProvider client={client}>
      <I18nProvider locale="zh">{node}</I18nProvider>
    </QueryClientProvider>
  );
  const view = render(ui(element));
  return { client, rerender: (node: React.ReactNode) => view.rerender(ui(node)), view };
}

/** The interval an active observer of one query was configured with. */
function refetchInterval(client: QueryClient, queryKey: readonly unknown[]): unknown {
  return client.getQueryCache().find({ queryKey })?.observers[0]?.options.refetchInterval;
}

const readyCluster = {
  metadata: { name: 'host' },
  status: {
    conditions: [{ type: 'Ready', status: 'True' }],
    // servicemesh off, the other optional modules on: 未安装 and 未上报 must stay distinct.
    configz: { monitoring: true, logging: true, devops: true, servicemesh: false },
  },
};

const healthyComponentHealth = {
  nodeStatus: { totalNodes: 3, healthyNodes: 3 },
  kubesphereStatus: [
    { name: 'ks-apiserver', namespace: 'kubesphere-system', totalBackends: 1, healthyBackends: 1 },
    { name: 'ks-console', namespace: 'kubesphere-system', totalBackends: 1, healthyBackends: 1 },
    { name: 'coredns', namespace: 'kube-system', totalBackends: 2, healthyBackends: 2 },
    { name: 'kube-proxy', namespace: 'kube-system', totalBackends: 2, healthyBackends: 2 },
    { name: 'istiod', namespace: 'istio-system', totalBackends: 1, healthyBackends: 1 },
    { name: 'prometheus', namespace: 'kubesphere-monitoring-system', totalBackends: 2, healthyBackends: 2 },
    { name: 'alertmanager', namespace: 'kubesphere-monitoring-system', totalBackends: 1, healthyBackends: 0 },
    { name: 'devops-jenkins', namespace: 'kubesphere-devops-system', totalBackends: 1, healthyBackends: 1 },
    { name: 'kube-controller-manager-svc', namespace: 'kube-system', label: { component: 'kube-controller-manager' }, totalBackends: 1, healthyBackends: 1 },
    { name: 'kube-scheduler-svc', namespace: 'kube-system', label: { component: 'kube-scheduler' }, totalBackends: 1, healthyBackends: 0 },
  ],
};

/** A JSON 404, which is what the etcd ServiceMonitor probe answers on mls370. */
function notFound(): Response {
  return new Response(JSON.stringify({ reason: 'NotFound', message: 'servicemonitors.monitoring.coreos.com "etcd" not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Stub the four reads the section makes.
 *
 * Every branch test only changes one answer, so the failing block and the working
 * blocks are always visible together — that is what proves one failure does not
 * blank the neighbours.
 */
function stubApi(overrides: {
  componentHealth?: () => Response;
  nodeVendorStats?: () => Response;
} = {}): void {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/clusters/host')) return Response.json(readyCluster);
    if (url.pathname.endsWith('/componenthealth')) {
      return overrides.componentHealth ? overrides.componentHealth() : Response.json(healthyComponentHealth);
    }
    if (url.pathname.endsWith('/nodes/stats')) {
      return overrides.nodeVendorStats
        ? overrides.nodeVendorStats()
        : Response.json({ nvidia: 3, healthy: 3, total: 3 });
    }
    if (url.pathname.endsWith('/servicemonitors/etcd')) return notFound();
    throw new Error('unexpected request ' + url.pathname);
  }));
}

const NODE_RING = 'cluster-monitor:overview:node-ring';
const VENDOR = 'cluster-monitor:overview:vendor-donut';
const COMPONENTS = 'cluster-monitor:status:components';

/** Every per-vendor handle of the overview's vendor block. */
const vendorId = (vendor: string) => 'cluster-monitor:overview:vendor:' + vendor;

describe('cluster monitor status section', () => {
  it('renders the node ring, vendor composition and component tiles', async () => {
    stubApi();
    const view = mount(<ClusterStatusSection cluster="host" live={false} />);

    // Node ring: the percentage lives in the ring, the raw pair next to it.
    await waitFor(() => expect(view.container.querySelector('[data-ai-id="' + NODE_RING + ':value"]')).not.toBeNull());
    expect(view.container.querySelector('[data-ai-id="' + NODE_RING + ':value"]')).toHaveTextContent('100%');
    expect(view.container.querySelector('[data-ai-id="' + NODE_RING + ':count"]')).toHaveTextContent('3/3');
    expect(view.container.querySelector('[data-ai-id="' + NODE_RING + ':link"]'))
      .toHaveAttribute('href', '/kube-frontend/clusters/host/nodes');

    // Vendor composition: the ring plus one row per vendor with count and share.
    expect(view.container.querySelector('[data-ai-id="' + VENDOR + '"]')).not.toBeNull();
    const vendorRow = view.container.querySelector('[data-ai-id="' + vendorId('nvidia') + '"]')!;
    expect(vendorRow).toHaveTextContent('英伟达');
    expect(vendorRow.querySelector('[data-ai-id="' + vendorId('nvidia') + ':count"]')).toHaveTextContent('3');
    expect(vendorRow.querySelector('[data-ai-id="' + vendorId('nvidia') + ':percent"]')).toHaveTextContent('100%');

    // Component tiles: same semantics as the previous rows, new 3×2 layout.
    const platform = view.container.querySelector('[data-ai-id="' + COMPONENTS + ':service:kubesphere-system"]')!;
    expect(platform).toHaveTextContent('2/2');
    expect(platform).toHaveAttribute('data-ai-status', 'healthy');
    // A healthy tile prints the ratio, not a redundant 正常 badge; the badge
    // stays on the unhealthy/absent tiles where the verdict is the only signal.
    expect(platform).not.toHaveTextContent('正常');
    expect(view.container.querySelector('[data-ai-id="' + COMPONENTS + ':service:kubesphere-monitoring-system"]'))
      .toHaveTextContent('2/3');
    expect(view.container.querySelector('[data-ai-id="' + COMPONENTS + ':service:kubesphere-monitoring-system"]'))
      .toHaveAttribute('data-ai-status', 'unhealthy');
    expect(view.container.querySelector('[data-ai-id="' + COMPONENTS + ':service:kubesphere-monitoring-system"]'))
      .toHaveTextContent('异常');
    expect(view.container.querySelector('[data-ai-id="' + COMPONENTS + ':service:kubesphere-logging-system"]'))
      .toHaveTextContent('未上报');
    expect(view.container.querySelector('[data-ai-id="' + COMPONENTS + ':service:kubesphere-logging-system"]'))
      .toHaveAttribute('data-ai-status', 'not-reported');
    // configz says servicemesh is off: the namespace has healthy backends but the
    // module is not installed, and the two answers must not collapse into one.
    expect(view.container.querySelector('[data-ai-id="' + COMPONENTS + ':service:istio-system"]'))
      .toHaveTextContent('未安装');
    expect(view.container.querySelector('[data-ai-id="' + COMPONENTS + ':service:istio-system"]'))
      .toHaveAttribute('data-ai-status', 'not-installed');

    expect(view.container.querySelector('[data-ai-id="' + COMPONENTS + ':core:controller-manager"]'))
      .toHaveTextContent('正常');
    expect(view.container.querySelector('[data-ai-id="' + COMPONENTS + ':core:scheduler"]'))
      .toHaveTextContent('异常');
    expect(view.container.querySelector('[data-ai-id="' + COMPONENTS + ':core:etcd"]'))
      .toHaveTextContent('未接入监控');
    expect(view.container.querySelector('[data-ai-id="' + COMPONENTS + ':core:etcd"]'))
      .toHaveAttribute('data-ai-status', 'not-reported');
  });

  it('shows empty states instead of a normal 0/0 status', async () => {
    stubApi({
      componentHealth: () => Response.json({ nodeStatus: { totalNodes: 0, healthyNodes: 0 }, kubesphereStatus: [] }),
      nodeVendorStats: () => Response.json({ healthy: 0, total: 0 }),
    });
    const view = mount(<ClusterStatusSection cluster="host" live={false} />);

    await waitFor(() => expect(view.container.querySelector('[data-ai-id="cluster-monitor:status:node-online:empty"]')).not.toBeNull());
    expect(view.container.querySelector('[data-ai-id="cluster-monitor:status:vendor:empty"]')).not.toBeNull();
    // 0/0 is not an online ratio: nothing in the ring may claim the cluster is healthy.
    expect(view.container.querySelector('[data-ai-id="' + NODE_RING + ':value"]')).toBeNull();
  });

  it('marks an unreported node count as unreported, not as zero', async () => {
    stubApi({ componentHealth: () => Response.json({ kubesphereStatus: [] }) });
    const view = mount(<ClusterStatusSection cluster="host" live={false} />);

    await waitFor(() => expect(view.container.querySelector('[data-ai-id="cluster-monitor:status:node-online:unreported"]')).not.toBeNull());
    expect(view.container.querySelector('[data-ai-id="' + NODE_RING + ':value"]')).toBeNull();
  });

  it('explains a forbidden read without offering a retry', async () => {
    stubApi({ componentHealth: () => new Response('forbidden', { status: 403 }) });
    const view = mount(<ClusterStatusSection cluster="host" live={false} />);

    await waitFor(() => expect(view.container.querySelector('[data-ai-id="cluster-monitor:status:permission"]')).not.toBeNull());
    expect(view.container.querySelector('[data-ai-id="cluster-monitor:status:node-online:permission"]')).not.toBeNull();
    expect(view.container.querySelector('[data-ai-id="cluster-monitor:status:retry"]')).toBeNull();
    expect(view.container.querySelector('[data-ai-id="cluster-monitor:status:error"]')).toBeNull();
    // The vendor block reads a different endpoint and still renders: one failed block
    // must not take its neighbours down.
    expect(view.container.querySelector('[data-ai-id="' + vendorId('nvidia') + '"]')).not.toBeNull();
  });

  it('offers a retry when the component health read fails with a server error', async () => {
    stubApi({
      componentHealth: () => new Response(
        'Internal Server Error: "/kapis/resources.kubesphere.io/v1alpha2/componenthealth": cluster agent is not ready',
        { status: 500 },
      ),
    });
    const view = mount(<ClusterStatusSection cluster="host" live={false} />);

    await waitFor(() => expect(view.container.querySelector('[data-ai-id="cluster-monitor:status:error"]')).not.toBeNull());
    expect(view.container.querySelector('[data-ai-id="cluster-monitor:status:retry"]')).not.toBeNull();
    // The upstream sentence is the only actionable part, so it stays on screen. It is
    // shown once per affected block (node ring and components card).
    expect(screen.getAllByText('cluster agent is not ready').length).toBeGreaterThan(0);
    expect(view.container.querySelector('[data-ai-id="cluster-monitor:status:node-online:error"]')).not.toBeNull();
  });

  it('renders a CPU vendor row with no accelerator mark', async () => {
    stubApi({ nodeVendorStats: () => Response.json({ CPU: 2, cambricon: 1, healthy: 3, total: 3 }) });
    const view = mount(<ClusterStatusSection cluster="host" live={false} />);

    await waitFor(() => expect(view.container.querySelector('[data-ai-id="' + vendorId('CPU') + '"]')).not.toBeNull());
    const row = view.container.querySelector('[data-ai-id="' + vendorId('CPU') + '"]')!;
    // 'CPU' is normalised by vendorKey but is not an accelerator vendor; the mark
    // falls back to the CPU glyph instead of an empty slot.
    expect(row).toHaveTextContent('CPU 节点');
    expect(row.querySelector('[data-ai-id="' + vendorId('CPU') + ':count"]')).toHaveTextContent('2');
    expect(row.querySelector('[data-ai-id="' + vendorId('CPU') + ':percent"]')).toHaveTextContent('66.7%');
    expect(row.querySelector('svg')).not.toBeNull();
  });

  it('polls the three status reads only while the page auto refresh is on', async () => {
    stubApi();
    const { client, rerender, view } = mountWithClient(<ClusterStatusSection cluster="host" live={false} />);
    await waitFor(() => expect(view.container.querySelector('[data-ai-id="' + NODE_RING + '"]')).not.toBeNull());

    // Switched off: no query schedules a repeat, so a reader who paused auto refresh
    // stops all of the page's polling, not just the trends.
    expect(refetchInterval(client, ['cluster-status', 'host', 'component-health'])).toBe(false);
    expect(refetchInterval(client, ['cluster-status', 'host', 'node-vendor-stats'])).toBe(false);
    expect(refetchInterval(client, ['cluster-status', 'host', 'etcd-service-monitor'])).toBe(false);
    // The cluster object is register-once information and stays out of the cadence.
    expect(refetchInterval(client, ['cluster-detail', 'host'])).not.toBe(5000);

    rerender(<ClusterStatusSection cluster="host" live />);
    // The switch drives the same five-second cadence the tabs use: one refresh
    // semantic for the whole page.
    await waitFor(() => {
      expect(refetchInterval(client, ['cluster-status', 'host', 'component-health'])).toBe(5000);
    });
    expect(refetchInterval(client, ['cluster-status', 'host', 'node-vendor-stats'])).toBe(5000);
    expect(refetchInterval(client, ['cluster-status', 'host', 'etcd-service-monitor'])).toBe(5000);
    expect(refetchInterval(client, ['cluster-detail', 'host'])).not.toBe(5000);
  });
});