import * as React from 'react';
import { Skeleton } from '@kube-ai-hub/ui';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { useT } from '@/i18n';
import { ClusterChartCard, linesToSeries } from './ClusterChartCard';
import { useManualRefresh } from './ClusterResourceTab';
import { toComponentCharts, useComponentMetrics } from './componentMonitorQueries';
import { formatComponentValue } from './monitorFormat';
import type { WindowContext } from './monitorTabs';

/**
 * Chart-key → contract id suffix for the Scheduler tab.
 *
 * Three charts, matching the old console's scheduler page: cumulative scheduling
 * attempts by result (scheduled/error/unschedulable), the attempt rate, and the
 * end-to-end scheduling latency (average plus quantiles).
 */
export const SCHEDULER_CHART_IDS: Record<string, string> = {
  scheduleAttempts: 'attempts',
  scheduleAttemptRate: 'rate',
  scheduleLatency: 'latency',
};

/**
 * 调度器监控 -- the old console's fourth 集群状态 page.
 *
 * Same identity rule as the API Server tab: a result or quantile is a label, so two
 * series never share a line and a missing identity is never inferred from the array
 * index. The latency chart renders its explanation when this cluster reports no
 * scheduling-latency samples -- an empty chart is an answer, a zero line is a lie.
 */
export function ClusterSchedulerTab({
  cluster,
  rangeKey,
  start,
  end,
  step,
  manualTick,
  onStateChange,
}: WindowContext): React.ReactElement {
  const t = useT();
  const units = React.useMemo(() => ({ perSecond: t('cluster.monitor.unit.perSecond') }), [t]);
  const query = useComponentMetrics({ cluster, component: 'scheduler', rangeKey, start, end, step });
  const charts = React.useMemo(
    () => (query.data ? toComponentCharts('scheduler', query.data, t) : []),
    [query.data, t],
  );

  const manual = useManualRefresh(manualTick, query.isFetching);
  const state = query.isPending
    ? 'loading'
    : query.isError
      ? 'error'
      : charts.length > 0 && charts.every((chart) => !chart.hasData)
        ? 'empty'
        : 'ready';

  React.useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  return (
    <div className="flex flex-col gap-4" data-ai-id="cluster-monitor:scheduler" data-ai-state={state}>
      {state === 'loading' ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : null}

      {state === 'error' ? (
        <ResourceErrorPanel
          error={query.error}
          onRetry={() => void query.refetch()}
          retryAiId="cluster-monitor:scheduler:retry"
        />
      ) : null}

      {state === 'ready' || state === 'empty'
        ? charts
            .filter((chart) => SCHEDULER_CHART_IDS[chart.key] !== undefined)
            .map((chart) => (
              <ClusterChartCard
                key={chart.key}
                aiId={'cluster-monitor:scheduler:chart:' + SCHEDULER_CHART_IDS[chart.key]}
                title={t(chart.title)}
                series={linesToSeries(chart.lines)}
                start={start}
                end={end}
                hasData={chart.hasData}
                emptyText={t('cluster.monitor.empty')}
                emptyHint={t('cluster.monitor.emptyHint')}
                formatValue={(value) => formatComponentValue(value, chart.kind, units)}
                refreshing={manual.refreshing}
                refreshingLabel={manual.label}
              />
            ))
        : null}
    </div>
  );
}
