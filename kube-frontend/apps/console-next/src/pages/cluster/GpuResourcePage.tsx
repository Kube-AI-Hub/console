import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { rangeMetricsApi, type MetricSeries } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Button, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';

/**
 * GPU 资源监控.
 *
 * Two cluster-level trends over a chosen window — GPU utilisation and GPU-memory
 * utilisation — read from the monitoring API's range endpoint. The named metrics
 * are the ones ks-apiserver defines (`cluster_gpu_utilization`,
 * `cluster_gpu_memory_utilisation`); both are ratios in [0,1], so the page only
 * multiplies by 100 for display and never divides anything itself.
 *
 * Charts are inline SVG bars, not a charting library: the whole cluster monitor page
 * already proves that a 60–100 point series is a few dozen rects, and adding a chart
 * dependency for two of them would cost more than the page. The bars exist to show
 * shape; the current/min/max numbers beside them carry the quantity.
 *
 * The window selects both the range and the step: asking for 24h at 60-second
 * resolution is 1,440 points over the wire and illegible as bars. Every window keeps
 * the series near 60–100 samples.
 */
export interface GpuResourcePageProps {
  cluster: string;
}

const WINDOWS = [
  { key: '1h', ms: 60 * 60 * 1000, step: '60s' },
  { key: '6h', ms: 6 * 60 * 60 * 1000, step: '5m' },
  { key: '24h', ms: 24 * 60 * 60 * 1000, step: '15m' },
] as const;

type WindowKey = (typeof WINDOWS)[number]['key'];

/** The two trends the page plots. */
const CHARTS = [
  {
    key: 'utilization',
    metric: 'cluster_gpu_utilization',
    titleKey: 'cluster.gpuResource.utilization',
    aiId: 'cluster-gpu-resource:utilization',
  },
  {
    key: 'memory',
    metric: 'cluster_gpu_memory_utilisation',
    titleKey: 'cluster.gpuResource.memoryUtilisation',
    aiId: 'cluster-gpu-resource:memory',
  },
] as const;

/**
 * Read for the summary line, not charted.
 *
 * `allocated`/`total` answer "how much of the cluster's GPU capacity is handed out",
 * which is a different question from "how busy is it"; the old console shows both.
 */
const COUNT_METRICS = ['cluster_gpu_allocated', 'cluster_gpu_total'] as const;

const METRICS: string[] = [...CHARTS.map((chart) => chart.metric), ...COUNT_METRICS];

/** Latest sample of a series, or undefined when the window has none. */
function latestPoint(series: MetricSeries | undefined): number | undefined {
  const points = series?.points ?? [];
  return points.length ? points[points.length - 1]?.value : undefined;
}

function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function GpuResourcePage({ cluster }: GpuResourcePageProps): React.ReactElement {
  const t = useT();
  const [windowKey, setWindowKey] = React.useState<WindowKey>('1h');
  const window = WINDOWS.find((entry) => entry.key === windowKey) ?? WINDOWS[0];

  /*
   * Resolve the window to absolute timestamps once per selection.
   *
   * `end: Date.now()` inside the query key would change on every render and the query
   * would refetch forever — the same trap the cluster monitor page documents.
   */
  const [range, setRange] = React.useState(() => {
    const end = Math.floor(Date.now() / 1000) * 1000;
    return { start: end - WINDOWS[0].ms, end };
  });
  React.useEffect(() => {
    const end = Math.floor(Date.now() / 1000) * 1000;
    setRange({ start: end - window.ms, end });
  }, [windowKey, window.ms]);

  const trends = useQuery({
    queryKey: ['cluster-gpu-resource', cluster, windowKey, range.start, range.end],
    queryFn: ({ signal }) =>
      rangeMetricsApi(apiClient).cluster({
        cluster,
        metrics: [...METRICS],
        start: range.start,
        end: range.end,
        step: window.step,
        signal,
      }),
    // A historical window does not become more true by refetching: re-downloading an
    // hour of samples to append one point is waste.
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
        points: seriesByName.get(chart.metric)?.points ?? [],
      })),
    [seriesByName],
  );

  const totalPoints = charted.reduce((sum, entry) => sum + entry.points.length, 0);
  const allocated = latestPoint(seriesByName.get('cluster_gpu_allocated'));
  const gpuTotal = latestPoint(seriesByName.get('cluster_gpu_total'));

  const state = trends.isPending ? 'loading' : trends.isError ? 'error' : 'ready';

  return (
    <AiSurface as="section" aiId="cluster-gpu-resource:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-ai-fg">{t('cluster.gpuResource.title')}</h1>
          <p className="text-sm text-ai-fg-muted">{t('cluster.gpuResource.description')}</p>
        </div>
        {/* The shared Button: a bare element would be an action without an agent handle. */}
        <div className="flex flex-wrap gap-1" {...actionProps('cluster-gpu-resource:range')}>
          {WINDOWS.map((entry) => (
            <Button
              key={entry.key}
              size="sm"
              variant={entry.key === windowKey ? 'primary' : 'secondary'}
              aria-pressed={entry.key === windowKey}
              {...actionProps(`cluster-gpu-resource:range:${entry.key}`)}
              onClick={() => setWindowKey(entry.key)}
            >
              {t(`cluster.gpuResource.range.${entry.key}`)}
            </Button>
          ))}
        </div>
      </header>

      {state === 'loading' ? <Skeleton className="h-64 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel
          error={trends.error}
          onRetry={() => void trends.refetch()}
          retryAiId="cluster-gpu-resource:retry"
        />
      ) : null}

      {state === 'ready' && totalPoints === 0 ? (
        /*
         * No metric data at all. This is a real state, not an error: the GPU series are
         * recording rules fed by gpu-agent, and a cluster without them answers an empty
         * result rather than a 404. Say so instead of rendering two blank charts.
         */
        <div
          className="flex flex-col gap-1 rounded-lg border border-ai-border bg-ai-surface p-4"
          data-ai-id="cluster-gpu-resource:empty"
        >
          <span className="text-sm text-ai-fg-secondary">{t('cluster.gpuResource.empty')}</span>
          <span className="text-xs text-ai-fg-muted">{t('cluster.gpuResource.emptyHint')}</span>
        </div>
      ) : null}

      {state === 'ready' && totalPoints > 0 ? (
        <React.Fragment>
          {allocated !== undefined && gpuTotal !== undefined ? (
            <div
              className="flex flex-wrap items-center gap-3 rounded-lg border border-ai-border bg-ai-surface p-3 text-xs text-ai-fg-secondary"
              data-ai-id="cluster-gpu-resource:summary"
              data-ai-allocated={String(Math.round(allocated))}
              data-ai-total={String(Math.round(gpuTotal))}
            >
              {t('cluster.gpuResource.summary', {
                allocated: String(Math.round(allocated)),
                total: String(Math.round(gpuTotal)),
              })}
            </div>
          ) : null}

          <div
            className="grid grid-cols-1 gap-3 xl:grid-cols-2"
            data-ai-id="cluster-gpu-resource:chart"
            data-ai-window={windowKey}
            data-ai-points={String(totalPoints)}
          >
            {charted.map(({ chart, points }) => (
              <TrendCard
                key={chart.key}
                title={t(chart.titleKey)}
                aiId={chart.aiId}
                points={points}
                start={range.start}
                end={range.end}
              />
            ))}
          </div>
        </React.Fragment>
      ) : null}
    </AiSurface>
  );
}

/**
 * One trend.
 *
 * The bars show shape; the numbers below show quantity, because a spike touching 90%
 * for one sample and a series sitting at 60% draw almost the same picture at this
 * height. Each card scales to its own peak (with headroom) rather than a fixed 0–100:
 * a cluster idling at 3% is exactly the case a trend view must distinguish from "no
 * data", and a fixed scale flattens it onto the baseline.
 */
function TrendCard({
  title,
  aiId,
  points,
  start,
  end,
}: {
  title: string;
  aiId: string;
  points: MetricSeries['points'];
  start: number;
  end: number;
}): React.ReactElement {
  const t = useT();
  const values = points.map((point) => point.value);
  const current = values.length ? values[values.length - 1] : undefined;
  const min = values.length ? Math.min(...values) : undefined;
  const max = values.length ? Math.max(...values) : undefined;

  return (
    <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id={aiId} data-ai-points={String(points.length)}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-ai-fg">{title}</h2>
        <span className="text-xs tabular-nums text-ai-fg-muted" data-ai-id={`${aiId}:current`}>
          {current === undefined ? '-' : formatPercent(current)}
        </span>
      </div>

      {points.length === 0 ? (
        <p className="py-6 text-sm text-ai-fg-secondary" data-ai-id={`${aiId}:empty`}>
          {t('cluster.gpuResource.empty')}
        </p>
      ) : (
        <React.Fragment>
          <BarChart points={points} start={start} end={end} />
          <dl className="mt-2 flex flex-wrap gap-4 text-xs text-ai-fg-muted">
            <div className="flex gap-1">
              <dt>{t('cluster.gpuResource.min')}</dt>
              <dd className="tabular-nums text-ai-fg-secondary">{min === undefined ? '-' : formatPercent(min)}</dd>
            </div>
            <div className="flex gap-1">
              <dt>{t('cluster.gpuResource.max')}</dt>
              <dd className="tabular-nums text-ai-fg-secondary">{max === undefined ? '-' : formatPercent(max)}</dd>
            </div>
            <div className="flex gap-1">
              <dt>{t('cluster.gpuResource.current')}</dt>
              <dd className="tabular-nums text-ai-fg-secondary">{current === undefined ? '-' : formatPercent(current)}</dd>
            </div>
          </dl>
        </React.Fragment>
      )}
    </section>
  );
}

/**
 * The bars.
 *
 * One rect per sample, positioned by its timestamp so a missing scrape leaves a gap
 * instead of silently squeezing the neighbours together. `data-ai-bar` is the handle
 * automation counts; the SVG itself is decorative (the numbers are in text), so it is
 * hidden from assistive technology rather than given a redundant label.
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
  const peak = Math.max(...points.map((point) => point.value), 0.02);
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
      {/* Baseline, so a zero series reads as zero rather than as an empty card. */}
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
