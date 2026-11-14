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
const CHARTS = [
  { key: 'cpu', metric: 'cluster_cpu_usage', total: 'cluster_cpu_total', kind: 'percent', aiId: 'cluster-monitor:cpu' },
  {
    key: 'memory',
    metric: 'cluster_memory_usage_wo_cache',
    total: 'cluster_memory_total',
    kind: 'percent',
    aiId: 'cluster-monitor:memory',
  },
  { key: 'pods', metric: 'cluster_pod_running_count', kind: 'count', aiId: 'cluster-monitor:pods' },
  { key: 'nodes', metric: 'cluster_node_online', kind: 'count', aiId: 'cluster-monitor:nodes' },
] as const;

/** Every metric a chart needs, including the totals the ratios divide by. */
const METRICS = Array.from(
  new Set(CHARTS.flatMap((chart) => ('total' in chart && chart.total ? [chart.metric, chart.total] : [chart.metric]))),
);

export function ClusterMonitorPage({ cluster, node }: ClusterMonitorPageProps): React.ReactElement {
  const t = useT();
  const charts = React.useMemo(() => node ? CHARTS.slice(0, 3).map((chart) => ({
    ...chart, metric: chart.metric.replace(/^cluster_/, 'node_'),
    ...('total' in chart ? { total: chart.total.replace(/^cluster_/, 'node_') } : {}),
  })) : CHARTS, [node]);
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
      if (!('total' in chart) || !chart.total) {
        out.set(chart.key, used);
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
        </div>
      </header>

      {state === 'loading' ? <Skeleton className="h-64 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={trends.error} onRetry={() => void trends.refetch()} retryAiId="cluster-monitor:retry" />
      ) : null}

      {state === 'ready' ? (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {charts.map((chart) => (
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
      ) : null}
    </AiSurface>
  );
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
  kind: 'percent' | 'count';
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
  kind: 'percent' | 'count';
}): React.ReactElement {
  return <TrendChart points={points} start={start} end={end}
    label={`${t_count(points.length)} ${kind}`} emptyText="-" data-ai-id="cluster-monitor:chart" />;
}

/** Stable aria label; kept out of the JSX so the SVG has no template noise. */
function t_count(count: number): string {
  return `${count} samples`;
}

function formatValue(value: number, kind: 'percent' | 'count'): string {
  if (kind === 'percent') return `${Math.round(value)}%`;
  return String(Math.round(value));
}
