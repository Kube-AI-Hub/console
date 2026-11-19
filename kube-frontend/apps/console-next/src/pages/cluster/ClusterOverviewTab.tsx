import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { rangeMetricsApi, type MetricSeries } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { Button, Skeleton, TREND_SERIES_COLORS, cn } from '@kube-ai-hub/ui';
import { ChartPanel, type TimeRange } from '@kube-ai-hub/ui/charts';
import type { LocaleKey } from '@kube-ai-hub/locales';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { ClusterStatusSection } from './ClusterStatusSection';
import { ClusterOverviewComponentsBlock } from './ClusterOverviewComponentsBlock';
import { ClusterOverviewRdmaBlock, RDMA_BLOCK_METRICS } from './ClusterOverviewRdmaBlock';
import { formatBytes } from './monitorFormat';
import { chartPanelLabels } from './OverviewResourcePanel';
import type { MonitorTabState, WindowContext } from './monitorTabs';

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
export interface ClusterOverviewTabProps extends WindowContext {}

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
/** Everything one overview request has to carry. */
const OVERVIEW_METRICS = Array.from(
  new Set<string>([
    ...USAGE.flatMap((spec) => [spec.used, spec.total, spec.chart]),
    // The RDMA block plots four metrics (health, ports, throughput, errors) from this
    // same request: one window, one query, one set of timestamps to pair on.
    ...RDMA_BLOCK_METRICS,
  ]),
);

const USAGE_CHART_ID = 'cluster-monitor:overview:usage-chart';

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
}: ClusterOverviewTabProps): React.ReactElement {
  const t = useT();
  const [selected, setSelected] = React.useState<UsageSpec['key']>('gpuMemory');
  /*
   * The tab reads the page's window (`start`/`end`/`step`) and never owns one: the
   * header has the only picker, so a second one here would be two answers to "which
   * period". The panel still needs a `TimeRange` value to label its refresh veil, so
   * the page's resolved span is passed in as an absolute range.
   */
  const range = React.useMemo<TimeRange>(() => ({ kind: 'absolute', start, end }), [start, end]);

  const query = useQuery({
    queryKey: ['cluster-monitor', 'overview', cluster, rangeKey, start, end],
    queryFn: ({ signal }) =>
      rangeMetricsApi(apiClient).cluster({ cluster, metrics: OVERVIEW_METRICS, start, end, step, signal }),
    // A window is historical: refetching it every 30 seconds would re-download an hour
    // of samples to add one point. Auto refresh moves the window instead.
    staleTime: 60_000,
    retry: false,
  });

  /*
   * Manual vs auto refresh. The page moves the window every few seconds when
   * 自动刷新 is on — that path must not dim the plot. A click on 刷新 does, which is
   * the same gesture the resource lists use.
   */
  const [manualRefresh, setManualRefresh] = React.useState(false);
  const refreshNow = React.useCallback(() => {
    setManualRefresh(true);
    void query.refetch().finally(() => setManualRefresh(false));
  }, [query]);

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

  const chartLabels = React.useMemo(() => chartPanelLabels(t), [t]);
  /*
   * The panel's state, derived from this tab's query.
   *
   * `refreshing` is what keeps the plot on screen while new points arrive — the
   * skeleton is for the first load only, so a refresh never blanks the chart.
   */
  const chartState: 'loading' | 'refreshing' | 'ready' | 'error' | 'empty' = query.isPending
    ? 'loading'
    : query.isError
      ? 'error'
      : chartPoints.length === 0
        ? 'empty'
        : query.isFetching
          ? 'refreshing'
          : 'ready';

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
            {/*
              * `ChartPanel` rather than a bare plot: it owns the fixed-height box, the
              * window picker, the refresh (with its manual-only veil) and the legend.
              * The title and the current value stay in the page's own header row above
              * it, because the seven-row list on the left is the page's subject and the
              * chart is the detail of the row the reader picked.
              */}
            <ChartPanel
              aiId={USAGE_CHART_ID}
              title={t(selectedSpec.chartLabelKey)}
              series={[
                {
                  key: selectedSpec.key,
                  label: t(selectedSpec.chartLabelKey),
                  points: chartPoints,
                  color: TREND_SERIES_COLORS[0],
                  area: true,
                  smooth: true,
                },
              ]}
              range={range}
              onRangeChange={() => undefined}
              showRangePicker={false}
              labels={chartLabels}
              state={chartState}
              onRetry={() => void query.refetch()}
              onRefresh={refreshNow}
              manualRefresh={manualRefresh}
              height={260}
              formatValue={(value) => formatChartValue(value, selectedSpec.chartKind)}
              className="min-h-[22rem]"
              data-ai-state={chartPoints.length === 0 ? 'empty' : 'ready'}
              aria-label={t(selectedSpec.chartLabelKey)}
            />
          </div>
        ) : null}
      </section>

      {/*
        RDMA 状态: four metrics, each with its own curve and the node list when a port
        is down — the old overview's block. It reads the series this tab already
        fetched; only the port inventory is a separate read (it is an inventory).
      */}
      <ClusterOverviewRdmaBlock cluster={cluster} seriesByName={seriesByName} start={start} end={end} />

      {/*
        服务组件监控: the control plane preview the old overview carried (APIServer
        latency/rate, scheduler attempts/rate). The dedicated tabs remain the place for
        the full set; this block answers "is the control plane degrading" without a tab
        switch.
      */}
      <ClusterOverviewComponentsBlock cluster={cluster} rangeKey={rangeKey} start={start} end={end} step={step} />
    </div>
  );
}
