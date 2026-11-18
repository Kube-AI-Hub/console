import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { rangeMetricsApi, type MetricSeries } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { Button, Skeleton, TREND_SERIES_COLORS, TrendChart, cn } from '@kube-ai-hub/ui';
import type { LocaleKey } from '@kube-ai-hub/locales';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { ClusterStatusSection } from './ClusterStatusSection';
import { formatBytes, formatBytesPerSecond } from './monitorFormat';
import type { MonitorTabKey, MonitorTabState, WindowContext } from './monitorTabs';

/**
 * 概览: the cluster's status band, its resource usage as a main chart with a detail
 * list, and the RDMA summary.
 *
 * The old console's overview put the three status blocks on top and a wall of small
 * charts below, where every chart was the same size and the reader had to guess
 * which number was the headline. The new shape keeps the status band (it answers
 * "is the cluster healthy") and gives resource usage one large chart that the seven
 * current values on its left select: the chart is the question "what shape", the
 * list is the answer "how much right now", and the two share a scale.
 *
 * One range query answers the whole tab. The detail rows and the main chart must
 * describe the same instants, and one request guarantees that the two cannot
 * disagree because of a stale or partial second read.
 */
export interface ClusterOverviewTabProps extends WindowContext {
  /** The page's tab switch, used by 查看 RDMA 趋势. */
  onTabChange?: (tab: MonitorTabKey) => void;
}

/** How a usage row is printed: a byte size, a core count, or a whole card/pod count. */
type UsageUnit = 'bytes' | 'cores' | 'count';

/** How the main chart prints its y values. */
type ChartKind = 'percent' | 'count';

interface UsageSpec {
  key: 'gpuMemory' | 'gpu' | 'gpuAllocated' | 'cpu' | 'memory' | 'disk' | 'pods';
  /** The row's resource name, e.g. "GPU 内存" — a value, not a utilisation rate. */
  labelKey: LocaleKey;
  /** The chart's title, e.g. "GPU 显存使用率" — the ratio the line shows. */
  chartLabelKey: LocaleKey;
  /** Series for the current "used" number. */
  used: string;
  /** Series for the current capacity; missing means the row prints '-'. */
  total: string;
  /** Series for the main chart. */
  chart: string;
  /** Unit of the used/total pair. */
  unit: UsageUnit;
  /** How the chart metric is printed. */
  chartKind: ChartKind;
  /**
   * Multiplier for the chart metric: utilisation metrics are 0..1 and are drawn as
   * percent; allocated cards and pod counts are already counts.
   */
  scale?: number;
}

/**
 * The seven rows, in the old console's order (GPU memory, GPU, allocated GPU, CPU,
 * memory, disk, pods).
 *
 * The current value is always a *used/total pair from the raw series*, never the
 * utilisation metric: a utilisation ratio and a "used out of total" are different
 * questions on an overcommitted GPU pool, and the old page printed the pair.
 */
const USAGE: readonly UsageSpec[] = [
  { key: 'gpuMemory', labelKey: 'cluster.monitor.overview.usage.gpuMemory', chartLabelKey: 'cluster.monitor.gpuMemory', used: 'cluster_gpu_memory_usage', total: 'cluster_gpu_memory_total', chart: 'cluster_gpu_memory_utilisation', unit: 'bytes', chartKind: 'percent', scale: 100 },
  { key: 'gpu', labelKey: 'cluster.monitor.overview.usage.gpu', chartLabelKey: 'cluster.monitor.gpuUtilization', used: 'cluster_gpu_usage', total: 'cluster_gpu_total', chart: 'cluster_gpu_utilization', unit: 'count', chartKind: 'percent', scale: 100 },
  { key: 'gpuAllocated', labelKey: 'cluster.monitor.overview.usage.gpuAllocated', chartLabelKey: 'cluster.monitor.gpuAllocated', used: 'cluster_gpu_allocated', total: 'cluster_gpu_total', chart: 'cluster_gpu_allocated', unit: 'count', chartKind: 'count' },
  { key: 'cpu', labelKey: 'cluster.monitor.overview.usage.cpu', chartLabelKey: 'cluster.monitor.cpu', used: 'cluster_cpu_usage', total: 'cluster_cpu_total', chart: 'cluster_cpu_utilisation', unit: 'cores', chartKind: 'percent', scale: 100 },
  { key: 'memory', labelKey: 'cluster.monitor.overview.usage.memory', chartLabelKey: 'cluster.monitor.memory', used: 'cluster_memory_usage_wo_cache', total: 'cluster_memory_total', chart: 'cluster_memory_utilisation', unit: 'bytes', chartKind: 'percent', scale: 100 },
  { key: 'disk', labelKey: 'cluster.monitor.overview.usage.disk', chartLabelKey: 'cluster.monitor.disk', used: 'cluster_disk_size_usage', total: 'cluster_disk_size_capacity', chart: 'cluster_disk_size_utilisation', unit: 'bytes', chartKind: 'percent', scale: 100 },
  { key: 'pods', labelKey: 'cluster.monitor.overview.usage.pods', chartLabelKey: 'cluster.monitor.pods', used: 'cluster_pod_running_count', total: 'cluster_pod_quota', chart: 'cluster_pod_running_count', unit: 'count', chartKind: 'count' },
];

/** The RDMA summary metrics; details live on the physical-resources tab. */
const RDMA_METRICS = [
  'cluster_ib_port_up',
  'cluster_ib_port_total',
  'cluster_ib_tx_bytes',
  'cluster_ib_rx_bytes',
  'cluster_ib_rx_errors',
] as const;

/** Everything one overview request has to carry. */
const OVERVIEW_METRICS = Array.from(
  new Set<string>([
    ...USAGE.flatMap((spec) => [spec.used, spec.total, spec.chart]),
    ...RDMA_METRICS,
  ]),
);

const USAGE_CHART_ID = 'cluster-monitor:overview:usage-chart';

/** The latest point of a series, or undefined when it has none. */
function latest(series: MetricSeries | undefined): number | undefined {
  const points = series?.points;
  if (!points || points.length === 0) return undefined;
  const point = points[points.length - 1];
  return point && Number.isFinite(point.value) ? point.value : undefined;
}

/**
 * The last instant at which both series have a sample.
 *
 * The pair printed on a row has to describe one instant: taking each series' own
 * last point can pair a fresh "used" with a stale "total" after a scrape gap, which
 * is exactly the silent wrong number this page exists to avoid.
 */
function latestPair(used: MetricSeries | undefined, total: MetricSeries | undefined): { used: number; total: number } | undefined {
  if (!used || !total) return undefined;
  const totalByTime = new Map(total.points.map((point) => [point.at, point.value]));
  for (let index = used.points.length - 1; index >= 0; index -= 1) {
    const point = used.points[index];
    if (!point || !Number.isFinite(point.value)) continue;
    const capacity = totalByTime.get(point.at);
    if (capacity === undefined || !Number.isFinite(capacity)) continue;
    return { used: point.value, total: capacity };
  }
  return undefined;
}

/** A byte size / core count / whole count, printed with the row's unit. */
function formatUsage(value: number, unit: UsageUnit): string {
  if (unit === 'bytes') return formatBytes(value);
  if (unit === 'cores') return trimNumber(value);
  return String(Math.round(value));
}

/**
 * `used / total` in **one unit**.
 *
 * Formatting each side on its own produced "0 B / 182.5 GiB": the same quantity in
 * two scales reads as a different measurement, and the old console printed the pair
 * in a single unit. Bytes therefore pick the unit from the total and scale both
 * sides with it; counts and cores already share a unit.
 */
function formatUsagePair(pair: { used: number; total: number }, unit: UsageUnit): string {
  if (unit !== 'bytes') return `${formatUsage(pair.used, unit)} / ${formatUsage(pair.total, unit)}`;
  const UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'] as const;
  let index = 0;
  let scaledTotal = pair.total;
  while (scaledTotal >= 1024 && index < UNITS.length - 1) {
    scaledTotal /= 1024;
    index += 1;
  }
  const scale = 1024 ** index;
  // TiB-scale totals need two decimals: a 0.2 TiB / 5.9 TiB pair loses the
  // difference between 180 GiB and 240 GiB at one decimal.
  const digits = index >= 4 ? 2 : 1;
  const show = (value: number): string => {
    const factor = 10 ** digits;
    const scaled = Math.round((value / scale) * factor) / factor;
    return index >= 4 ? scaled.toFixed(digits) : Number.isInteger(scaled) ? String(scaled) : scaled.toFixed(digits);
  };
  return `${show(pair.used)} ${UNITS[index]} / ${show(pair.total)} ${UNITS[index]}`;
}

/** A number with at most one decimal and no trailing '.0' (cores are fractional). */
function trimNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * How the main chart prints its numbers.
 *
 * Percent keeps one decimal: rounding first made a 0–1% axis print "1% / 1% / 0%"
 * (two identical gridline labels) and hid the shape of a nearly-idle cluster.
 */
function formatChartValue(value: number, kind: ChartKind): string {
  if (kind !== 'percent') return String(Math.round(value));
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

export function ClusterOverviewTab({
  cluster,
  rangeKey,
  start,
  end,
  step,
  live,
  onStateChange,
  onTabChange,
}: ClusterOverviewTabProps): React.ReactElement {
  const t = useT();
  const [selected, setSelected] = React.useState<UsageSpec['key']>('gpuMemory');

  const query = useQuery({
    queryKey: ['cluster-monitor', 'overview', cluster, rangeKey, start, end],
    queryFn: ({ signal }) =>
      rangeMetricsApi(apiClient).cluster({ cluster, metrics: OVERVIEW_METRICS, start, end, step, signal }),
    // A window is historical: refetching it every 30 seconds would re-download an hour
    // of samples to add one point. Auto refresh moves the window instead.
    staleTime: 60_000,
    retry: false,
  });

  const seriesByName = React.useMemo(() => {
    const map = new Map<string, MetricSeries>();
    for (const series of query.data ?? []) map.set(series.name, series);
    return map;
  }, [query.data]);

  /** The current used/total pair per row; undefined means the row prints '-'. */
  const currentValues = React.useMemo(() => {
    const out = new Map<UsageSpec['key'], { used: number; total: number }>();
    for (const spec of USAGE) {
      const pair = latestPair(seriesByName.get(spec.used), seriesByName.get(spec.total));
      if (pair) out.set(spec.key, pair);
    }
    return out;
  }, [seriesByName]);

  const selectedSpec = USAGE.find((spec) => spec.key === selected) ?? USAGE[0]!;

  /** The chart series, scaled the way its metric is reported (ratio 0..1 vs count). */
  const chartPoints = React.useMemo(() => {
    const series = seriesByName.get(selectedSpec.chart);
    if (!series) return [];
    const scale = selectedSpec.scale ?? 1;
    return series.points
      .filter((point) => Number.isFinite(point.value) && Number.isFinite(point.at))
      .map((point) => ({ at: point.at, value: point.value * scale }));
  }, [seriesByName, selectedSpec]);

  const chartLatest = chartPoints.length > 0 ? chartPoints[chartPoints.length - 1]!.value : undefined;

  const rdma = React.useMemo(() => {
    const portUp = latest(seriesByName.get('cluster_ib_port_up'));
    const portTotal = latest(seriesByName.get('cluster_ib_port_total'));
    return {
      ports: portUp !== undefined && portTotal !== undefined ? `${Math.round(portUp)}/${Math.round(portTotal)}` : undefined,
      tx: latest(seriesByName.get('cluster_ib_tx_bytes')),
      rx: latest(seriesByName.get('cluster_ib_rx_bytes')),
      rxErrors: latest(seriesByName.get('cluster_ib_rx_errors')),
    };
  }, [seriesByName]);

  /**
   * The tab's main query state.
   *
   * "empty" means the request succeeded but returned no series at all -- a different
   * answer from "loaded and the values happen to be zero", and the reason the page
   * surface must not be permanently 'ready'.
   */
  const state: MonitorTabState = query.isPending
    ? 'loading'
    : query.isError
      ? 'error'
      : seriesByName.size === 0
        ? 'empty'
        : 'ready';
  React.useEffect(() => onStateChange?.(state), [onStateChange, state]);

  return (
    <div className="flex flex-col gap-4" data-ai-id="cluster-monitor:overview">
      {/*
        The status band is independent of this tab's query: the resource read failing
        must not blank whether the cluster itself is monitored. It owns its own reads
        (componenthealth / nodes-stats / etcd probe) and its own states.
      */}
      <ClusterStatusSection cluster={cluster} live={live ?? false} />

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-ai-fg-secondary">{t('cluster.monitor.overview.usage')}</h2>
          <p className="text-xs text-ai-fg-muted">{t('cluster.monitor.overview.usageHint')}</p>
        </div>
        {state === 'loading' ? <Skeleton className="h-64 w-full" /> : null}
        {state === 'error' ? (
          <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="cluster-monitor:retry" />
        ) : null}
        {state === 'ready' || state === 'empty' ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
            {/* ---- The seven current values; a row selects the chart. -------- */}
            <ul className="flex flex-col gap-0.5 rounded-ai-lg border border-ai-line bg-ai-surface-1 p-1.5" data-ai-id="cluster-monitor:overview:usage">
              {USAGE.map((spec) => {
                const pair = currentValues.get(spec.key);
                const active = spec.key === selected;
                return (
                  <li key={spec.key}>
                    <Button
                      variant="ghost"
                      size="sm"
                      block
                      aria-pressed={active}
                      className={cn(
                        'justify-between gap-2 px-2 text-left',
                        active && 'border-l-2 border-l-ai-accent bg-ai-accent/10 text-ai-fg',
                      )}
                      data-ai-state={pair ? 'ready' : 'empty'}
                      {...actionProps(`cluster-monitor:overview:usage:${spec.key}`)}
                      onClick={() => setSelected(spec.key)}
                    >
                      <span className="min-w-0 truncate text-xs text-ai-fg-secondary">{t(spec.labelKey)}</span>
                      <span
                        className="shrink-0 text-xs font-medium tabular-nums text-ai-fg"
                        data-ai-id={`cluster-monitor:overview:usage:${spec.key}:value`}
                      >
                        {pair ? formatUsagePair(pair, spec.unit) : '-'}
                      </span>
                    </Button>
                  </li>
                );
              })}
            </ul>

            {/* ---- The main chart: the selected row's trend. ----------------- */}
            <section
              className="flex min-w-0 flex-col gap-2 rounded-ai-lg border border-ai-line bg-ai-surface-1 p-4"
              data-ai-id={USAGE_CHART_ID}
              data-ai-state={chartPoints.length === 0 ? 'empty' : 'ready'}
              aria-label={t(selectedSpec.chartLabelKey)}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-medium text-ai-fg">{t(selectedSpec.chartLabelKey)}</h3>
                <span className="text-xs tabular-nums text-ai-fg-muted" data-ai-id={USAGE_CHART_ID + ':now'}>
                  {chartLatest === undefined ? '-' : formatChartValue(chartLatest, selectedSpec.chartKind)}
                </span>
              </div>
              {chartPoints.length === 0 ? (
                <div className="flex flex-col gap-1 py-10" data-ai-id={`${USAGE_CHART_ID}:empty`}>
                  <span className="text-sm text-ai-fg-secondary">{t('cluster.monitor.empty')}</span>
                  <span className="text-xs text-ai-fg-muted">{t('cluster.monitor.emptyHint')}</span>
                </div>
              ) : (
                <TrendChart
                  series={[
                    {
                      key: selectedSpec.key,
                      label: t(selectedSpec.chartLabelKey),
                      points: chartPoints,
                      color: TREND_SERIES_COLORS[0],
                    },
                  ]}
                  start={start}
                  end={end}
                  label={t(selectedSpec.chartLabelKey)}
                  emptyText={t('cluster.monitor.empty')}
                  showAxes
                  showGrid
                  interactive
                  formatValue={(value) => formatChartValue(value, selectedSpec.chartKind)}
                  data-ai-id={USAGE_CHART_ID + ':trend'}
                />
              )}
              <div className="flex flex-wrap items-center gap-2 text-xs" data-ai-id={USAGE_CHART_ID + ':legend'}>
                <span
                  aria-hidden
                  className="inline-block size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: TREND_SERIES_COLORS[0] }}
                />
                <span className="text-ai-fg-secondary">{t(selectedSpec.chartLabelKey)}</span>
                <span className="tabular-nums text-ai-fg-muted" data-ai-id={USAGE_CHART_ID + ':legend:value'}>
                  {chartLatest === undefined ? '-' : formatChartValue(chartLatest, selectedSpec.chartKind)}
                </span>
              </div>
            </section>
          </div>
        ) : null}
      </section>

      {/* ---- RDMA summary: five numbers and the way to the detail tab. ------ */}
      <section
        className="flex flex-col gap-3 rounded-ai-lg border border-ai-line bg-ai-surface-1 p-4"
        data-ai-id="cluster-monitor:overview:rdma"
        data-ai-state={
          rdma.ports === undefined && rdma.tx === undefined && rdma.rx === undefined && rdma.rxErrors === undefined
            ? 'empty'
            : 'ready'
        }
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold text-ai-fg-secondary">{t('cluster.monitor.overview.rdma')}</h2>
            <p className="text-xs text-ai-fg-muted">{t('cluster.monitor.overview.rdmaHint')}</p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            {...actionProps('cluster-monitor:overview:view-rdma')}
            onClick={() => onTabChange?.('resource')}
          >
            {t('cluster.monitor.overview.viewRdma')}
          </Button>
        </div>
        {rdma.ports === undefined && rdma.tx === undefined && rdma.rx === undefined && rdma.rxErrors === undefined ? (
          <p className="text-xs text-ai-fg-muted" data-ai-id="cluster-monitor:overview:rdma:empty">
            {t('cluster.monitor.empty')}
          </p>
        ) : null}
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <RdmaStat label={t('cluster.monitor.rdmaPorts')} value={rdma.ports} aiId="cluster-monitor:overview:rdma:ports" />
          <RdmaStat
            label={t('cluster.monitor.rdmaTx')}
            value={rdma.tx === undefined ? undefined : `${formatBytesPerSecond(rdma.tx)}/s`}
            aiId="cluster-monitor:overview:rdma:tx"
          />
          <RdmaStat
            label={t('cluster.monitor.rdmaRx')}
            value={rdma.rx === undefined ? undefined : `${formatBytesPerSecond(rdma.rx)}/s`}
            aiId="cluster-monitor:overview:rdma:rx"
          />
          <RdmaStat
            label={t('cluster.monitor.rdmaRxErrors')}
            value={rdma.rxErrors === undefined ? undefined : String(Math.round(rdma.rxErrors))}
            aiId="cluster-monitor:overview:rdma:rx-errors"
          />
        </dl>
      </section>
    </div>
  );
}

/** One RDMA summary number; a missing metric prints '-' rather than a zero. */
function RdmaStat({ label, value, aiId }: { label: string; value: string | undefined; aiId: string }): React.ReactElement {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-ai-fg-muted">{label}</dt>
      <dd className="text-sm font-medium tabular-nums text-ai-fg" data-ai-id={aiId}>
        {value ?? '-'}
      </dd>
    </div>
  );
}
