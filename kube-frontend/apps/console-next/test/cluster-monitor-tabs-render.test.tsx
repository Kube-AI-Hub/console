import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { ClusterResourceTab } from '@/pages/cluster/ClusterResourceTab';
import { ClusterApiServerTab } from '@/pages/cluster/ClusterApiServerTab';
import { ClusterSchedulerTab } from '@/pages/cluster/ClusterSchedulerTab';
import { ClusterRankingTab } from '@/pages/cluster/ClusterRankingTab';
import { ClusterEtcdTab } from '@/pages/cluster/ClusterEtcdTab';

/**
 * Render-level checks for the four tabs impl-tabs owns.
 *
 * The data mapping has its own unit test; what is asserted here is the wiring the
 * contract's data-ai-id list depends on: the chart/legend/empty handles, one range
 * request for the whole physical-resource tab, seconds-to-milliseconds in the legend,
 * the ranking's prefixed handles and the JSON export download.
 */

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, ...rest }: { children: React.ReactNode; to: string; params: Record<string, string>; [key: string]: unknown }) => (
    <a href={Object.entries(params).reduce((url, [key, value]) => url.replace('$' + key, value), to)} {...rest}>{children}</a>
  ),
}));

const RANGE = {
  cluster: 'host',
  rangeKey: '1h' as const,
  start: 1_700_000_000_000,
  end: 1_700_003_600_000,
  step: '60s',
};

function mount(element: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="zh">{element}</I18nProvider>
    </QueryClientProvider>,
  );
}

/** One monitoring range response entry. */
function matrix(name: string, values: number[], labels: Record<string, string> = {}) {
  return {
    metric_name: name,
    data: {
      resultType: 'matrix',
      result: [{ metric: labels, values: values.map((value, index) => [1_700_000_000 + index * 60, String(value)]) }],
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('monitor tabs render', () => {
  it('renders resource groups, multi-series legends and RDMA empty states from one range request', async () => {
    const calls: URL[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      calls.push(url);
      return Response.json({
        results: [
          matrix('cluster_load1', [1.5]),
          matrix('cluster_load5', [1.2]),
          matrix('cluster_load15', [1]),
          matrix('cluster_cpu_utilisation', [0.33]),
        ],
      });
    }));
    const view = mount(<ClusterResourceTab {...RANGE} />);
    await waitFor(() => expect(view.container.querySelector('[data-ai-id="cluster-monitor:resource:chart:host:cpu"]')).not.toBeNull());
    expect(view.container.querySelector('[data-ai-id="cluster-monitor:resource:group:host"]')).not.toBeNull();
    expect(view.container.querySelectorAll('[data-ai-id="cluster-monitor:resource:group:rdma"]')).toHaveLength(1);
    expect(view.container.querySelectorAll('[data-ai-id="cluster-monitor:resource:chart:host:load:legend"] > div')).toHaveLength(3);
    // A metric the cluster does not report renders an explanation, not a zero line.
    expect(view.container.querySelector('[data-ai-id="cluster-monitor:resource:chart:rdma:health:empty"]')).not.toBeNull();
    expect(view.container.querySelector('[data-ai-id="cluster-monitor:resource:chart:gpu:gpuMemory:empty"]')).not.toBeNull();
    const rangeCalls = calls.filter((url) => url.pathname.includes('/monitoring.kubesphere.io/v1alpha3/cluster'));
    expect(rangeCalls).toHaveLength(1);
    expect(rangeCalls[0]!.searchParams.get('metrics_filter')).toContain('cluster_ib_rx_errors$');
  });

  it('renders apiserver latency in milliseconds and scheduler latency as an empty state', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/components/apiserver')) {
        return Response.json({
          results: [
            matrix('apiserver_request_latencies', [0.05, 0.06]),
            matrix('apiserver_request_by_verb_latencies', [0.04, 0.041], { verb: 'GET' }),
            matrix('apiserver_request_rate', [12, 13]),
          ],
        });
      }
      if (url.pathname.endsWith('/components/scheduler')) {
        return Response.json({
          results: [
            { metric_name: 'scheduler_schedule_attempts', data: { result: [{ metric: { result: 'scheduled' }, values: [[1_700_000_000, '10'], [1_700_000_060, '11']] }] } },
            { metric_name: 'scheduler_schedule_attempt_rate', data: { result: [{ metric: { result: 'scheduled' }, values: [[1_700_000_000, '0.2'], [1_700_000_060, '0.3']] }] } },
            { metric_name: 'scheduler_e2e_scheduling_latency', data: { result: [] } },
          ],
        });
      }
      return Response.json({ results: [] });
    }));

    const apiView = mount(<ClusterApiServerTab {...RANGE} />);
    await waitFor(() => expect(apiView.container.querySelector('[data-ai-id="cluster-monitor:apiserver:chart:latency"]')).not.toBeNull());
    expect(apiView.container.querySelector('[data-ai-id="cluster-monitor:apiserver:chart:rate"]')).not.toBeNull();
    const latencyLegend = apiView.container.querySelector('[data-ai-id="cluster-monitor:apiserver:chart:latency:legend"]');
    expect(latencyLegend).toHaveTextContent('60.00 ms');
    expect(latencyLegend).toHaveTextContent('41.00 ms');

    const schedView = mount(<ClusterSchedulerTab {...RANGE} />);
    await waitFor(() => expect(schedView.container.querySelector('[data-ai-id="cluster-monitor:scheduler:chart:attempts"]')).not.toBeNull());
    expect(schedView.container.querySelector('[data-ai-id="cluster-monitor:scheduler:chart:rate"]')).not.toBeNull();
    expect(schedView.container.querySelector('[data-ai-id="cluster-monitor:scheduler:chart:latency:empty"]')).not.toBeNull();
  });

  it('renders etcd charts when reported and one explanation when the component reports nothing', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/components/etcd')) {
        return Response.json({
          results: [
            matrix('etcd_mvcc_db_size', [1.5e9]),
            matrix('etcd_network_client_grpc_received_bytes', [1024]),
            matrix('etcd_disk_wal_fsync_duration_quantile', [0.012], { quantile: '0.99' }),
          ],
        });
      }
      return Response.json({ results: [] });
    }));

    const reported = mount(<ClusterEtcdTab {...RANGE} />);
    await waitFor(() => expect(reported.container.querySelector('[data-ai-id="cluster-monitor:etcd:chart:dbSize"]')).not.toBeNull());
    expect(reported.container.querySelector('[data-ai-id="cluster-monitor:etcd:chart:dbSize:legend"]')).not.toBeNull();
    expect(reported.container.querySelector('[data-ai-id="cluster-monitor:etcd:chart:clientTraffic"]')).not.toBeNull();
    expect(reported.container.querySelector('[data-ai-id="cluster-monitor:etcd:chart:walFsync:legend"]')).toHaveTextContent('12.00 ms');
    expect(reported.container.querySelector('[data-ai-id="cluster-monitor:etcd:no-data"]')).toBeNull();

    // The same cluster without etcd monitoring: one explanation, not seven empty plots.
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ results: [] })));
    const empty = mount(<ClusterEtcdTab {...RANGE} />);
    await waitFor(() => expect(empty.container.querySelector('[data-ai-id="cluster-monitor:etcd:no-data"]')).not.toBeNull());
    expect(empty.container.querySelectorAll('[data-ai-id^="cluster-monitor:etcd:chart:"]')).toHaveLength(0);
  });

  it('renders the ranking with prefixed ids and exports the whole ranking as JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.searchParams.get('type') !== 'rank') return Response.json({ items: [], totalItems: 0 });
      const metric = url.searchParams.get('sort_metric')!;
      return Response.json({
        total_item: 2,
        results: [{
          metric_name: metric,
          data: { result: [
            { metric: { node: 'n1' }, value: [1_700_000_000, '0.5'] },
            { metric: { node: 'n2' }, value: [1_700_000_000, '0.25'] },
          ] },
        }],
      });
    }));
    const blobs: Blob[] = [];
    (URL as unknown as { createObjectURL: (blob: Blob) => string }).createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return 'blob:mock';
    });
    (URL as unknown as { revokeObjectURL: (url: string) => void }).revokeObjectURL = vi.fn();
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });

    const view = mount(<ClusterRankingTab cluster="host" />);
    await waitFor(() => expect(view.container.querySelector('[data-ai-id="cluster-monitor:ranking:surface"]')).not.toBeNull());
    expect(view.container.querySelector('[data-ai-id="cluster-monitor:ranking:metric"]')).not.toBeNull();
    expect(view.container.querySelector('[data-ai-id="cluster-monitor:ranking:refresh"]')).not.toBeNull();
    expect(view.container.querySelector('[data-ai-id="cluster-monitor:ranking:search"]')).not.toBeNull();
    await waitFor(() => expect(view.container.querySelector('[data-ai-id="cluster-monitor:ranking:node_cpu_utilisation:n1"]')).not.toBeNull());

    const exportButton = view.container.querySelector('[data-ai-id="cluster-monitor:ranking:export"]') as HTMLButtonElement;
    expect(exportButton).not.toBeNull();
    expect(exportButton.disabled).toBe(false);
    await userEvent.click(exportButton);
    await waitFor(() => expect(downloads).toEqual(['node.usage.rank.json']));

    const json = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(blobs[0]!);
    });
    const payload = JSON.parse(json) as { cluster: string; metric: string; order: string; generatedAt: string; items: Array<{ name: string }> };
    expect(payload.cluster).toBe('host');
    expect(payload.metric).toBe('node_cpu_utilisation');
    expect(payload.order).toBe('desc');
    expect(payload.generatedAt).toEqual(expect.any(String));
    expect(payload.items.map((item) => item.name)).toEqual(['n1', 'n2']);
  });
});
