import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { rangeMetricsApi, type MetricSeries, type WorkloadKind } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { Button, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';

/**
 * 详情页的监控面板（工作负载与容器组共用）。
 *
 * It plots two ranges — CPU and memory — over 1h/6h/24h. The data comes from the
 * monitoring API's range endpoint:
 *
 * - a workload reads `workload_cpu_usage` / `workload_memory_usage_wo_cache`,
 *   which are the server's `namespace:workload_*_usage:sum` recording rules, i.e.
 *   the pods are already summed server-side. Re-summing pod series here would
 *   download a series per pod and could disagree with the recording rule.
 * - a pod reads `pod_cpu_usage` / `pod_memory_usage_wo_cache`, its own series.
 *
 * Three states are deliberately distinct: a failed request is "monitoring
 * unavailable" (the cluster may have no monitoring backend), a successful request
 * with no samples is "no data in this range", and a series whose values are all 0
 * is a real chart with zero-height bars — idle is not missing.
 */
export interface WorkloadMonitorPanelProps {
  cluster: string;
  namespace: string;
  kind: WorkloadKind;
  name: string;
}

const WINDOWS = [
  { key: '1h', ms: 60 * 60 * 1000, step: '60s' },
  { key: '6h', ms: 6 * 60 * 60 * 1000, step: '5m' },
  { key: '24h', ms: 24 * 60 * 60 * 1000, step: '15m' },
] as const;

type WindowKey = (typeof WINDOWS)[number]['key'];

/** The workload kinds whose detail page has workload-level monitoring metrics. */
const METRIC_WORKLOAD_KINDS = ['deployments', 'statefulsets', 'daemonsets'] as const;

type ChartKey = 'cpu' | 'memory';

interface ChartSpec {
  key: ChartKey;
  titleKey: 'workloads.detail.monitor.cpu' | 'workloads.detail.monitor.memory';
  aiId: string;
}

const CHARTS: ChartSpec[] = [
  { key: 'cpu', titleKey: 'workloads.detail.monitor.cpu', aiId: 'workload-detail:monitor:cpu' },
  { key: 'memory', titleKey: 'workloads.detail.monitor.memory', aiId: 'workload-detail:monitor:memory' },
];

/** Bytes to GiB, always with the unit: the API reports memory in bytes. */
function formatMemory(bytes: number): string {
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GiB`;
}

export function WorkloadMonitorPanel({ cluster, namespace, kind, name }: WorkloadMonitorPanelProps): React.ReactElement {
  const t = useT();
  const [windowKey, setWindowKey] = React.useState<WindowKey>('1h');
  const window = WINDOWS.find((entry) => entry.key === windowKey) ?? WINDOWS[0];

  /*
   * Resolve the window to absolute timestamps once per selection.
   *
   * `end: Date.now()` inside the query key would change on every render and refetch
   * forever; the same trap is documented on the cluster monitor page.
   */
  const [range, setRange] = React.useState(() => {
    const end = Math.floor(Date.now() / 1000) * 1000;
    return { start: end - WINDOWS[0].ms, end };
  });
  React.useEffect(() => {
    const end = Math.floor(Date.now() / 1000) * 1000;
    setRange({ start: end - window.ms, end });
  }, [windowKey, window.ms]);

  const isPod = kind === 'pods';
  const metricKind = METRIC_WORKLOAD_KINDS.find((candidate) => candidate === kind);

  const trends = useQuery({
    queryKey: ['detail-monitor', cluster, namespace, kind, name, windowKey, range.start, range.end],
    queryFn: ({ signal }) => {
      const base = {
        cluster,
        metrics: isPod
          ? ['pod_cpu_usage', 'pod_memory_usage_wo_cache']
          : ['workload_cpu_usage', 'workload_memory_usage_wo_cache'],
        start: range.start,
        end: range.end,
        step: window.step,
        signal,
      };
      if (isPod) return rangeMetricsApi(apiClient).pod({ ...base, namespace, pod: name });
      if (!metricKind) return Promise.resolve<MetricSeries[]>([]);
      return rangeMetricsApi(apiClient).workload({ ...base, namespace, kind: metricKind, workload: name });
    },
    // A historical window does not improve by being refetched every 30 seconds.
    staleTime: 60_000,
    retry: false,
  });

  const seriesByName = React.useMemo(() => {
    const map = new Map<string, MetricSeries>();
    for (const series of trends.data ?? []) map.set(series.name, series);
    return map;
  }, [trends.data]);

  const charted = React.useMemo(
    () =>
      CHARTS.map((chart) => ({
        chart,
        points:
          seriesByName.get(isPod ? `pod_${chart.key === 'cpu' ? 'cpu_usage' : 'memory_usage_wo_cache'}` : `workload_${chart.key === 'cpu' ? 'cpu_usage' : 'memory_usage_wo_cache'}`)
            ?.points ?? [],
      })),
    [isPod, seriesByName],
  );

  const totalPoints = charted.reduce((sum, entry) => sum + entry.points.length, 0);
  const loading = trends.isPending;
  const unavailable = trends.isError;
  const empty = !loading && !unavailable && totalPoints === 0;
  const hasData = !loading && !unavailable && totalPoints > 0;

  const format = React.useCallback(
    (key: ChartKey, value: number): string =>
      key === 'cpu' ? `${value.toFixed(3)} ${t('workloads.detail.monitor.cores')}` : formatMemory(value),
    [t],
  );

  return (
    <div className="flex flex-col gap-4" data-ai-id="workload-detail:monitor">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs text-ai-fg-muted">
            {isPod ? t('workloads.detail.monitor.hintPod') : t('workloads.detail.monitor.hintWorkload')}
          </p>
        </div>
        <div className="flex flex-wrap gap-1" {...actionProps('workload-detail:monitor:range')}>
          {WINDOWS.map((entry) => (
            <Button
              key={entry.key}
              size="sm"
              variant={entry.key === windowKey ? 'primary' : 'secondary'}
              aria-pressed={entry.key === windowKey}
              {...actionProps(`workload-detail:monitor:range:${entry.key}`)}
              onClick={() => setWindowKey(entry.key)}
            >
              {t(`workloads.detail.monitor.range.${entry.key}`)}
            </Button>
          ))}
        </div>
      </header>

      {loading ? <Skeleton className="h-64 w-full" /> : null}

      {unavailable ? (
        <div
          className="flex flex-col gap-2 rounded-lg border border-ai-border bg-ai-surface p-4"
          data-ai-id="workload-detail:monitor:unavailable"
        >
          <span className="text-sm text-ai-fg-secondary">{t('workloads.detail.monitor.unavailable')}</span>
          <span className="text-xs text-ai-fg-muted">{t('workloads.detail.monitor.unavailableHint')}</span>
          <div>
            <Button
              size="sm"
              variant="secondary"
              {...actionProps('workload-detail:monitor:retry')}
              onClick={() => void trends.refetch()}
            >
              {t('common.retry')}
            </Button>
          </div>
        </div>
      ) : null}

      {empty ? (
        <div
          className="flex flex-col gap-1 rounded-lg border border-ai-border bg-ai-surface p-4"
          data-ai-id="workload-detail:monitor:empty"
        >
          <span className="text-sm text-ai-fg-secondary">{t('workloads.detail.monitor.empty')}</span>
          <span className="text-xs text-ai-fg-muted">{t('workloads.detail.monitor.emptyHint')}</span>
        </div>
      ) : null}

      {hasData ? (
        <div
          className="grid grid-cols-1 gap-3 xl:grid-cols-2"
          data-ai-id="workload-detail:monitor:chart"
          data-ai-window={windowKey}
          data-ai-points={String(totalPoints)}
        >
          {charted.map(({ chart, points }) => (
            <TrendCard
              key={chart.key}
              chart={chart}
              points={points}
              start={range.start}
              end={range.end}
              format={format}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * One trend card. Numbers carry the quantity; the bars carry the shape.
 * A series of zeros draws zero-height rects (still present in the DOM, still a
 * chart) so "idle" never looks like "no data".
 */
function TrendCard({
  chart,
  points,
  start,
  end,
  format,
}: {
  chart: ChartSpec;
  points: MetricSeries['points'];
  start: number;
  end: number;
  format: (key: ChartKey, value: number) => string;
}): React.ReactElement {
  const t = useT();
  const values = points.map((point) => point.value);
  const current = values.length ? values[values.length - 1] : undefined;
  const min = values.length ? Math.min(...values) : undefined;
  const max = values.length ? Math.max(...values) : undefined;

  return (
    <section
      className="rounded-lg border border-ai-border bg-ai-surface p-4"
      data-ai-id={chart.aiId}
      data-ai-points={String(points.length)}
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-ai-fg">{t(chart.titleKey)}</h3>
        <span className="text-xs tabular-nums text-ai-fg-muted" data-ai-id={`${chart.aiId}:current`}>
          {current === undefined ? '-' : format(chart.key, current)}
        </span>
      </div>

      {points.length === 0 ? (
        <p className="py-6 text-sm text-ai-fg-secondary" data-ai-id={`${chart.aiId}:empty`}>
          {t('workloads.detail.monitor.empty')}
        </p>
      ) : (
        <React.Fragment>
          <BarChart points={points} start={start} end={end} />
          <dl className="mt-2 flex flex-wrap gap-4 text-xs text-ai-fg-muted">
            <div className="flex gap-1">
              <dt>{t('workloads.detail.monitor.min')}</dt>
              <dd className="tabular-nums text-ai-fg-secondary">{min === undefined ? '-' : format(chart.key, min)}</dd>
            </div>
            <div className="flex gap-1">
              <dt>{t('workloads.detail.monitor.max')}</dt>
              <dd className="tabular-nums text-ai-fg-secondary">{max === undefined ? '-' : format(chart.key, max)}</dd>
            </div>
            <div className="flex gap-1">
              <dt>{t('workloads.detail.monitor.current')}</dt>
              <dd className="tabular-nums text-ai-fg-secondary">{current === undefined ? '-' : format(chart.key, current)}</dd>
            </div>
          </dl>
        </React.Fragment>
      )}
    </section>
  );
}

/**
 * One rect per sample, positioned by timestamp so a missing scrape leaves a gap.
 * `data-ai-bar` is the stable handle automation counts; the SVG is decorative, so
 * it is hidden from assistive technology (the numbers above it are text).
 */
function BarChart({
  points,
  start,
  end,
}: {
  points: MetricSeries['points'];
  start: number;
  end: number;
}): React.ReactElement {
  const width = 100;
  const height = 32;
  const span = Math.max(1, end - start);
  const peak = Math.max(...points.map((point) => point.value), 1e-9);
  const scaleMax = peak * 1.12;
  const slot = width / Math.max(points.length, 1);
  const barWidth = Math.max(slot * 0.72, 0.18);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-24 w-full text-ai-accent"
      aria-hidden="true"
    >
      {points.map((point) => {
        const barHeight = Math.min(height, (point.value / scaleMax) * height);
        const x = ((point.at - start) / span) * width;
        return (
          <rect
            key={point.at}
            data-ai-bar
            x={x.toFixed(2)}
            y={(height - barHeight).toFixed(2)}
            width={barWidth.toFixed(2)}
            height={Math.max(barHeight, 0).toFixed(2)}
            fill="currentColor"
            opacity="0.85"
          />
        );
      })}
      <line
        x1="0"
        y1={height}
        x2={width}
        y2={height}
        stroke="currentColor"
        strokeWidth="0.3"
        opacity="0.25"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
