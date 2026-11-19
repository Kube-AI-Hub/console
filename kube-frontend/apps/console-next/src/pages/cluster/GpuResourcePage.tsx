import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { rangeMetricsApi, type MetricSeries } from '@kube-ai-hub/api-client';
import { AiSurface, Skeleton } from '@kube-ai-hub/ui';
import { ChartPanel, presetRange, resolveRange, type ChartPanelLabels, type TimeRange } from '@kube-ai-hub/ui/charts';
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
 * The plots are the shared `ChartPanel`: it brings the window control, the refresh,
 * the hover readout and the legend, so this page no longer carries its own hand-drawn
 * bars. That matters beyond tidiness — the previous SVG scaled each card to its own
 * peak, which made a cluster idling at 3% look as busy as one at 90%. A shared y axis
 * of 0–100% is the only scale on which two utilisation charts are comparable.
 *
 * The window drives the step through the shared range arithmetic: asking for 24h at
 * 60-second resolution is 1,440 points over the wire and illegible on screen.
 */
export interface GpuResourcePageProps {
  cluster: string;
}

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
  const [range, setRange] = React.useState<TimeRange>(() => presetRange('1h'));
  const resolved = React.useMemo(() => resolveRange(range), [range]);

  const trends = useQuery({
    queryKey: [
      'cluster-gpu-resource',
      cluster,
      range.kind === 'relative' ? range.key : 'custom',
      resolved.start,
      resolved.end,
    ],
    queryFn: ({ signal }) =>
      rangeMetricsApi(apiClient).cluster({
        cluster,
        metrics: [...METRICS],
        start: resolved.start,
        end: resolved.end,
        step: resolved.step,
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
        // Ratios in [0,1] → percent for the axis and the readout.
        points: (seriesByName.get(chart.metric)?.points ?? []).map((point) => ({
          at: point.at,
          value: point.value * 100,
        })),
      })),
    [seriesByName],
  );

  const totalPoints = charted.reduce((sum, entry) => sum + entry.points.length, 0);
  const allocated = latestPoint(seriesByName.get('cluster_gpu_allocated'));
  const gpuTotal = latestPoint(seriesByName.get('cluster_gpu_total'));

  const labels: ChartPanelLabels = React.useMemo(
    () => ({
      placeholder: t('cluster.gpuResource.range.1h'),
      custom: t('cluster.monitor.rangeCustom'),
      rangePlaceholder: t('cluster.monitor.rangePlaceholder'),
      step: t('cluster.monitor.step'),
      stepHint: t('cluster.monitor.stepHint'),
      stepOptions: [],
      cancel: t('common.cancel'),
      confirm: t('common.confirm'),
      invalid: t('cluster.monitor.rangeInvalid'),
      refresh: t('common.refresh'),
      error: t('cluster.gpuResource.empty'),
      retry: t('common.retry'),
      loading: t('common.loading'),
      refreshing: t('cluster.monitor.refreshing'),
      autoPause: t('cluster.monitor.autoPause'),
      autoResume: t('cluster.monitor.autoResume'),
      autoPauseLabel: t('cluster.monitor.autoPauseLabel'),
      autoResumeLabel: t('cluster.monitor.autoResumeLabel'),
    }),
    [t],
  );

  const state: 'loading' | 'refreshing' | 'ready' | 'error' | 'empty' = trends.isPending
    ? 'loading'
    : trends.isError
      ? 'error'
      : totalPoints === 0
        ? 'empty'
        : trends.isFetching
          ? 'refreshing'
          : 'ready';

  return (
    <AiSurface as="section" aiId="cluster-gpu-resource:surface" state={state === 'refreshing' ? 'ready' : state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-ai-fg">{t('cluster.gpuResource.title')}</h1>
        <p className="text-sm text-ai-fg-muted">{t('cluster.gpuResource.description')}</p>
      </header>

      {state === 'loading' ? <Skeleton className="h-64 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel
          error={trends.error}
          onRetry={() => void trends.refetch()}
          retryAiId="cluster-gpu-resource:retry"
        />
      ) : null}

      {state === 'empty' ? (
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

      {state !== 'loading' && state !== 'error' && state !== 'empty' ? (
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

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2" data-ai-id="cluster-gpu-resource:chart">
            {charted.map(({ chart, points }) => (
              <ChartPanel
                key={chart.key}
                aiId={chart.aiId}
                title={t(chart.titleKey)}
                series={[{ key: chart.key, label: t(chart.titleKey), points, area: true }]}
                range={range}
                onRangeChange={setRange}
                labels={labels}
                state={state}
                onRetry={() => void trends.refetch()}
                onRefresh={() => void trends.refetch()}
                height={180}
                // A fixed 0–100% axis: two utilisation charts are only comparable on a
                // shared scale, and a peak-scaled axis made an idle cluster look busy.
                yDomain={[0, 100]}
                formatAxis={(value) => `${Math.round(value)}%`}
                formatValue={(value) => formatPercent(value / 100)}
              />
            ))}
          </div>
        </React.Fragment>
      ) : null}
    </AiSurface>
  );
}
