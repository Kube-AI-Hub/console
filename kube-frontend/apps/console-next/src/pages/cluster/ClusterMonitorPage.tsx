import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { rangeMetricsApi, type MetricSeries } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Button, Skeleton, TrendChart } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';

/**
 * 集群监控.
 *
 * Four trends over a chosen window: CPU, memory, running pods, nodes online.
 *
 * Rendering is shared with per-card monitoring through ai-kit TrendChart. Unit
 * conversion and timestamp-based ratios remain here. A full charting library can
 * be reconsidered when axes interaction, zooming or stacked series are needed.
 *
 * The window drives the step, because the API returns raw samples: asking for seven
 * days at 60-second resolution is 10,080 points per metric over the wire and rendered
 * as a smear. Each window has a step that keeps the series near 60 points.
 */
export interface ClusterMonitorPageProps {
  cluster: string;
  node?: string;
}

const WINDOWS = [
  { key: '1h', ms: 60 * 60 * 1000, step: '60s' },
  { key: '6h', ms: 6 * 60 * 60 * 1000, step: '5m' },
  { key: '24h', ms: 24 * 60 * 60 * 1000, step: '15m' },
  { key: '7d', ms: 7 * 24 * 60 * 60 * 1000, step: '2h' },
] as const;

type WindowKey = (typeof WINDOWS)[number]['key'];

/**
 * Which shape each chart imposes on its metric.
 *
 * The two utilisation charts are **ratios of two series**: the monitoring API
 * reports CPU in cores and memory in bytes, so plotting them directly gives
 * hundreds of percent (memory read as a percentage printed 937053405184%). The
 * total has to be read in the same request and the pair divided sample by sample.
 */
/**
 * The physical-resource charts, matching the old console's cluster monitor.
 *
 * `kind` decides only how a number is printed; `scale` converts a ratio the API
 * reports as 0..1 into a percentage. Disk and inode usage are ratios of two series,
 * so they carry a `total` like CPU and memory do.
 */
/**
 * Every trend on the page, grouped the way the old console grouped its physical-resource
 * panel: GPU, host resources, disk I/O, network, RDMA.
 *
 * The old console rendered about thirty separate cards in one column. The same facts are kept
 * here but split into titled groups: a flat wall of sparklines does not say which numbers
 * belong together. The nodeScoped flag marks the three charts the node detail reuses (they
 * read the node_* series instead of cluster_*).
 */
const CHARTS = [
  // --- GPU ---------------------------------------------------------------
  { key: 'gpuMemory', group: 'gpu', metric: 'cluster_gpu_memory_utilisation', kind: 'percent', scale: 100, aiId: 'cluster-monitor:gpu-memory' },
  { key: 'gpuUtilization', group: 'gpu', metric: 'cluster_gpu_utilization', kind: 'percent', scale: 100, aiId: 'cluster-monitor:gpu-utilization' },
  { key: 'gpuAllocated', group: 'gpu', metric: 'cluster_gpu_allocated', kind: 'count', aiId: 'cluster-monitor:gpu-allocated' },
  // --- Host resources -----------------------------------------------------
  { key: 'cpu', group: 'host', nodeScoped: true, metric: 'cluster_cpu_usage', total: 'cluster_cpu_total', kind: 'percent', aiId: 'cluster-monitor:cpu' },
  {
    key: 'memory',
    group: 'host',
    nodeScoped: true,
    metric: 'cluster_memory_usage_wo_cache',
    total: 'cluster_memory_total',
    kind: 'percent',
    aiId: 'cluster-monitor:memory',
  },
  { key: 'pods', group: 'host', nodeScoped: true, metric: 'cluster_pod_running_count', kind: 'count', aiId: 'cluster-monitor:pods' },
  { key: 'podsAbnormal', group: 'host', metric: 'cluster_pod_abnormal_count', kind: 'count', aiId: 'cluster-monitor:pods-abnormal' },
  { key: 'podsSucceeded', group: 'host', metric: 'cluster_pod_succeeded_count', kind: 'count', aiId: 'cluster-monitor:pods-succeeded' },
  { key: 'nodes', group: 'host', metric: 'cluster_node_online', kind: 'count', aiId: 'cluster-monitor:nodes' },
  { key: 'load1', group: 'host', metric: 'cluster_load1', kind: 'decimal', aiId: 'cluster-monitor:load1' },
  { key: 'load5', group: 'host', metric: 'cluster_load5', kind: 'decimal', aiId: 'cluster-monitor:load5' },
  { key: 'load15', group: 'host', metric: 'cluster_load15', kind: 'decimal', aiId: 'cluster-monitor:load15' },
  {
    key: 'disk',
    group: 'host',
    metric: 'cluster_disk_size_usage',
    total: 'cluster_disk_size_capacity',
    kind: 'percent',
    aiId: 'cluster-monitor:disk',
  },
  { key: 'inode', group: 'host', metric: 'cluster_disk_inode_utilisation', kind: 'percent', scale: 100, aiId: 'cluster-monitor:inode' },
  // --- Disk I/O -----------------------------------------------------------
  { key: 'diskReadThroughput', group: 'disk', metric: 'cluster_disk_read_throughput', kind: 'rate', aiId: 'cluster-monitor:disk-read-throughput' },
  { key: 'diskWriteThroughput', group: 'disk', metric: 'cluster_disk_write_throughput', kind: 'rate', aiId: 'cluster-monitor:disk-write-throughput' },
  { key: 'diskReadIops', group: 'disk', metric: 'cluster_disk_read_iops', kind: 'decimal', aiId: 'cluster-monitor:disk-read-iops' },
  { key: 'diskWriteIops', group: 'disk', metric: 'cluster_disk_write_iops', kind: 'decimal', aiId: 'cluster-monitor:disk-write-iops' },
  // --- Network ------------------------------------------------------------
  { key: 'netTx', group: 'network', metric: 'cluster_net_bytes_transmitted', kind: 'rate', aiId: 'cluster-monitor:net-tx' },
  { key: 'netRx', group: 'network', metric: 'cluster_net_bytes_received', kind: 'rate', aiId: 'cluster-monitor:net-rx' },
  // --- RDMA / InfiniBand ---------------------------------------------------
  { key: 'rdmaHealth', group: 'rdma', metric: 'cluster_ib_health', kind: 'percent', scale: 100, aiId: 'cluster-monitor:rdma-health' },
  {
    key: 'rdmaPorts',
    group: 'rdma',
    metric: 'cluster_ib_port_up',
    total: 'cluster_ib_port_total',
    kind: 'percent',
    aiId: 'cluster-monitor:rdma-ports',
  },
  { key: 'rdmaTx', group: 'rdma', metric: 'cluster_ib_tx_bytes', kind: 'rate', aiId: 'cluster-monitor:rdma-tx' },
  { key: 'rdmaRx', group: 'rdma', metric: 'cluster_ib_rx_bytes', kind: 'rate', aiId: 'cluster-monitor:rdma-rx' },
  { key: 'rdmaLinkSpeed', group: 'rdma', metric: 'cluster_ib_link_speed', kind: 'linkRate', aiId: 'cluster-monitor:rdma-link-speed' },
  { key: 'rdmaRxErrors', group: 'rdma', metric: 'cluster_ib_rx_errors', kind: 'count', aiId: 'cluster-monitor:rdma-rx-errors' },
  { key: 'rdmaRetrans', group: 'rdma', metric: 'cluster_ib_retrans', kind: 'count', aiId: 'cluster-monitor:rdma-retrans' },
  { key: 'rdmaDiscards', group: 'rdma', metric: 'cluster_ib_discards', kind: 'count', aiId: 'cluster-monitor:rdma-discards' },
  { key: 'rdmaLinkDowned', group: 'rdma', metric: 'cluster_ib_link_downed', kind: 'count', aiId: 'cluster-monitor:rdma-link-downed' },
] as const;

/** Section order on the page; charts keep array order inside each group. */
const GROUPS = ['gpu', 'host', 'disk', 'network', 'rdma'] as const;

/** Every metric a chart needs, including the totals the ratios divide by. */
const METRICS = Array.from(
  new Set(CHARTS.flatMap((chart) => ('total' in chart && chart.total ? [chart.metric, chart.total] : [chart.metric]))),
);

export function ClusterMonitorPage({ cluster, node }: ClusterMonitorPageProps): React.ReactElement {
  const t = useT();
  const charts = React.useMemo(
    () =>
      node
        ? CHARTS.filter((chart) => 'nodeScoped' in chart && chart.nodeScoped).map((chart) => ({
            ...chart,
            metric: chart.metric.replace(/^cluster_/, 'node_'),
            ...('total' in chart ? { total: chart.total.replace(/^cluster_/, 'node_') } : {}),
          }))
        : CHARTS,
    [node],
  );
  const metrics = React.useMemo(() => node ? Array.from(new Set(charts.flatMap((chart) =>
    'total' in chart && chart.total ? [chart.metric, chart.total] : [chart.metric]))) : METRICS, [charts, node]);
  const [windowKey, setWindowKey] = React.useState<WindowKey>('1h');
  const window = WINDOWS.find((entry) => entry.key === windowKey) ?? WINDOWS[0];

  /*
   * The window is resolved to absolute timestamps once per window selection, not on
   * every render: `end: Date.now()` inside the query key would change on each paint
   * and refetch forever.
   */
  const [range, setRange] = React.useState(() => {
    const end = Math.floor(Date.now() / 1000) * 1000;
    return { start: end - WINDOWS[0].ms, end };
  });
  React.useEffect(() => {
    const end = Math.floor(Date.now() / 1000) * 1000;
    setRange({ start: end - window.ms, end });
  }, [window.ms, windowKey]);

  /*
   * Auto refresh, matching the old console's monitoring controller: a play/pause control that
   * re-reads the last N minutes every five seconds. Each tick moves the window forward rather
   * than re-querying the frozen range, which is the whole point of watching a live cluster.
   */
  const [autoRefresh, setAutoRefresh] = React.useState(false);
  React.useEffect(() => {
    if (!autoRefresh) return;
    // `window` here is the selected time window, not the global: use globalThis explicitly.
    const timer = globalThis.setInterval(() => {
      const end = Math.floor(Date.now() / 1000) * 1000;
      setRange({ start: end - window.ms, end });
    }, 5_000);
    return () => globalThis.clearInterval(timer);
  }, [autoRefresh, window.ms]);

  const trends = useQuery({
    queryKey: ['cluster-monitor', cluster, node, windowKey, range.start, range.end],
    queryFn: ({ signal }) =>
      rangeMetricsApi(apiClient).cluster({
        cluster,
        metrics,
        ...(node ? { scope: 'node' as const, node } : {}),
        start: range.start,
        end: range.end,
        step: window.step,
        signal,
      }),
    // A trend window is historical: refetching it every 30 seconds would re-download
    // an hour of samples to add one point.
    staleTime: 60_000,
    retry: false,
  });

  const seriesByName = React.useMemo(() => {
    const map = new Map<string, MetricSeries>();
    for (const series of trends.data ?? []) map.set(series.name, series);
    return map;
  }, [trends.data]);

  /**
   * The series each card plots.
   *
   * A percentage card divides its two series sample by sample, matching on
   * timestamp: the two are scraped at the same instants, and zipping by index
   * would silently mis-pair them the first time a scrape is missing.
   */
  const plotted = React.useMemo(() => {
    const out = new Map<string, MetricSeries>();
    for (const chart of charts) {
      const used = seriesByName.get(chart.metric);
      if (!used) continue;
      // A ratio the API already reports as 0..1 (inode usage) is scaled, not divided:
      // dividing it by another series would be a different quantity.
      const scale = 'scale' in chart && chart.scale ? chart.scale : 1;
      if (!('total' in chart) || !chart.total) {
        out.set(
          chart.key,
          scale === 1 ? used : { name: used.name, points: used.points.map((point) => ({ at: point.at, value: point.value * scale })) },
        );
        continue;
      }
      const total = seriesByName.get(chart.total);
      if (!total) continue;
      const totalByTime = new Map(total.points.map((point) => [point.at, point.value]));
      const points = used.points
        .map((point) => {
          const capacity = totalByTime.get(point.at);
          if (capacity === undefined || capacity <= 0) return null;
          return { at: point.at, value: (point.value / capacity) * 100 };
        })
        .filter((point): point is { at: number; value: number } => point !== null);
      out.set(chart.key, { name: chart.metric, points });
    }
    return out;
  }, [seriesByName, charts]);

  const state = trends.isPending ? 'loading' : trends.isError ? 'error' : 'ready';

  return (
    <AiSurface as="section" aiId="cluster-monitor:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-ai-fg">{node ? `${node} · ${t('node.detail.monitor')}` : t('cluster.monitor.title')}</h1>
          {!node ? <p className="text-sm text-ai-fg-muted">{t('cluster.monitor.description')}</p> : null}
        </div>
        <div className="flex flex-wrap gap-1" {...actionProps('cluster-monitor:range')}>
          {WINDOWS.map((entry) => (
            /*
             * The shared Button, not a bare element: the ai-surface contract requires
             * every interactive element to carry an agent handle, and a hand-written
             * one is exactly the kind that ends up without it.
             */
            <Button
              key={entry.key}
              size="sm"
              variant={entry.key === windowKey ? 'primary' : 'secondary'}
              aria-pressed={entry.key === windowKey}
              {...actionProps(`cluster-monitor:range:${entry.key}`)}
              onClick={() => setWindowKey(entry.key)}
            >
              {t(`cluster.monitor.range.${entry.key}`)}
            </Button>
          ))}
          <Button
            size="sm"
            variant={autoRefresh ? 'primary' : 'secondary'}
            aria-pressed={autoRefresh}
            {...actionProps('cluster-monitor:auto-refresh')}
            onClick={() => setAutoRefresh((previous) => !previous)}
          >
            {autoRefresh ? t('cluster.monitor.autoRefreshOn') : t('cluster.monitor.autoRefreshOff')}
          </Button>
        </div>
      </header>

      {state === 'loading' ? <Skeleton className="h-64 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={trends.error} onRetry={() => void trends.refetch()} retryAiId="cluster-monitor:retry" />
      ) : null}

      {state === 'ready'
        ? GROUPS.filter((group) => charts.some((chart) => chart.group === group)).map((group) => {
            const inGroup = charts.filter((chart) => chart.group === group);
            return (
              <section key={group} className="flex flex-col gap-2" data-ai-id={`cluster-monitor:group:${group}`}>
                <h2 className="text-sm font-semibold text-ai-fg-secondary">{t(`cluster.monitor.group.${group}`)}</h2>
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {inGroup.map((chart) => (
                    <TrendCard
                      key={chart.key}
                      title={t(`cluster.monitor.${chart.key}`)}
                      aiId={chart.aiId}
                      series={plotted.get(chart.key)}
                      kind={chart.kind}
                      start={range.start}
                      end={range.end}
                    />
                  ))}
                </div>
              </section>
            );
          })
        : null}
    </AiSurface>
  );
}

/** How a chart prints its numbers. */
/**
 * How a chart prints its numbers.
 *
 * linkRate is the RDMA case: the API reports bits per second (907,500,000,000 for a
 * 907.5 Gb/s fabric), and printing that raw number is unreadable, so it is divided by
 * 1e9 and labelled Gb/s.
 */
type ChartKind = 'percent' | 'count' | 'decimal' | 'rate' | 'linkRate';

/** Bytes per second in the units a reader recognises (KiB/s, MiB/s, ...). */
function formatBytesPerSecond(value: number): string {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let scaled = Math.abs(value);
  let unit = 0;
  while (scaled >= 1024 && unit < units.length - 1) {
    scaled /= 1024;
    unit += 1;
  }
  const text = scaled >= 100 || unit === 0 ? scaled.toFixed(0) : scaled.toFixed(1);
  return `${value < 0 ? '-' : ''}${text} ${units[unit]}`;
}

/**
 * One trend.
 *
 * The current/min/max numbers are printed beside the line because a line answers
 * "what shape" and the numbers answer "how much": a spike that touches 90% for one
 * sample and one that sits at 60% draw almost the same curve at this height.
 */
function TrendCard({
  title,
  aiId,
  series,
  kind,
  start,
  end,
}: {
  title: string;
  aiId: string;
  series: MetricSeries | undefined;
  kind: ChartKind;
  start: number;
  end: number;
}): React.ReactElement {
  const t = useT();
  const points = series?.points ?? [];
  const latest = points.length ? points[points.length - 1]?.value : undefined;
  const min = points.length ? Math.min(...points.map((point) => point.value)) : undefined;
  const max = points.length ? Math.max(...points.map((point) => point.value)) : undefined;

  return (
    <section className="rounded-lg border border-ai-border bg-ai-surface p-4" {...actionProps(aiId)}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-ai-fg">{title}</h2>
        <span className="text-xs tabular-nums text-ai-fg-muted" data-ai-id={`${aiId}:latest`}>
          {latest === undefined ? '-' : formatValue(latest, kind)}
        </span>
      </div>

      {points.length === 0 ? (
        <div className="flex flex-col gap-1 py-6" data-ai-id={`${aiId}:empty`}>
          <span className="text-sm text-ai-fg-secondary">{t('cluster.monitor.empty')}</span>
          <span className="text-xs text-ai-fg-muted">{t('cluster.monitor.emptyHint')}</span>
        </div>
      ) : (
        <React.Fragment>
          <Sparkline points={points} start={start} end={end} kind={kind} />
          <dl className="mt-2 flex flex-wrap gap-4 text-xs text-ai-fg-muted">
            <div className="flex gap-1">
              <dt>{t('cluster.monitor.min')}</dt>
              <dd className="tabular-nums text-ai-fg-secondary">{min === undefined ? '-' : formatValue(min, kind)}</dd>
            </div>
            <div className="flex gap-1">
              <dt>{t('cluster.monitor.max')}</dt>
              <dd className="tabular-nums text-ai-fg-secondary">{max === undefined ? '-' : formatValue(max, kind)}</dd>
            </div>
            <div className="flex gap-1">
              <dt>{t('cluster.monitor.now')}</dt>
              <dd className="tabular-nums text-ai-fg-secondary">{latest === undefined ? '-' : formatValue(latest, kind)}</dd>
            </div>
            <div className="flex gap-1">
              <dt>{t('cluster.monitor.until')}</dt>
              <dd className="tabular-nums">{formatTimestamp(new Date(end).toISOString())}</dd>
            </div>
          </dl>
        </React.Fragment>
      )}
    </section>
  );
}

/**
 * The line itself.
 *
 * Each card scales to its own peak (plus headroom) rather than to a fixed 0–100.
 * A fixed scale is comparable across cards but useless to read: a cluster idling at
 * 5% CPU drew a flat line along the bottom, which is exactly the case a trend view
 * exists to distinguish from "no data". The trade is stated where it matters — the
 * numbers above the line are absolute, so the height is a shape, not a quantity.
 */
function Sparkline({
  points,
  start,
  end,
  kind,
}: {
  points: MetricSeries['points'];
  start: number;
  end: number;
  kind: ChartKind;
}): React.ReactElement {
  return <TrendChart points={points} start={start} end={end}
    label={`${t_count(points.length)} ${kind}`} emptyText="-" data-ai-id="cluster-monitor:chart" />;
}

/** Stable aria label; kept out of the JSX so the SVG has no template noise. */
function t_count(count: number): string {
  return `${count} samples`;
}

function formatValue(value: number, kind: ChartKind): string {
  if (kind === 'percent') return `${Math.round(value)}%`;
  if (kind === 'decimal') return value.toFixed(2);
  if (kind === 'rate') return `${formatBytesPerSecond(value)}/s`;
  if (kind === 'linkRate') return `${(value / 1e9).toFixed(1)} Gb/s`;
  return String(Math.round(value));
}
