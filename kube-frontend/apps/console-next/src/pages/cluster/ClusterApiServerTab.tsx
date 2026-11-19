import * as React from 'react';
import { ChartSkeleton } from '@kube-ai-hub/ui/charts';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { useT } from '@/i18n';
import { ClusterChartCard, linesToSeries } from './ClusterChartCard';
import { useManualRefresh } from './ClusterResourceTab';
import { toComponentCharts, useComponentMetrics } from './componentMonitorQueries';
import { formatComponentValue } from './monitorFormat';
import type { WindowContext } from './monitorTabs';

/**
 * Chart-key → contract id suffix for the API Server tab.
 *
 * The data specs live in `componentMonitorQueries` (shared with the overview's system
 * component section); this map is only the naming the monitor tab contract fixes:
 * `cluster-monitor:apiserver:chart:latency` and `:chart:rate`. Keeping it as a map
 * means a spec key cannot silently grow a chart whose id no test asserts.
 */
export const APISERVER_CHART_IDS: Record<string, string> = {
  requestLatency: 'latency',
  requestRate: 'rate',
};

/**
 * API Server 监控 -- the old console's third 集群状态 page.
 *
 * The overview shows the same series in a compact card; this tab is the large view:
 * request latency (by verb, plus the total average) and request rate. The identity
 * merge (verb, quantile) happens in `componentMonitorQueries`, never by array position,
 * and seconds become milliseconds here so the legend and the axis agree.
 *
 * The query belongs to this tab alone: the scheduler tab reads its own component, so a
 * failure on one cannot blank the other.
 */
export function ClusterApiServerTab({
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
  const query = useComponentMetrics({ cluster, component: 'apiserver', rangeKey, start, end, step });
  const charts = React.useMemo(
    () => (query.data ? toComponentCharts('apiserver', query.data, t) : []),
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
    <div className="flex flex-col gap-4" data-ai-id="cluster-monitor:apiserver" data-ai-state={state}>
      {state === 'loading' ? (
        /*
         * The skeleton stands in for the plot, at the plot's own height. Two grey
         * blocks of a made-up 256px made the page jump when the real cards arrived
         * and told the reader nothing about what was coming.
         */
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          <ChartSkeleton height={160} aiId="cluster-monitor:apiserver:loading:0" />
          <ChartSkeleton height={160} aiId="cluster-monitor:apiserver:loading:1" />
        </div>
      ) : null}

      {state === 'error' ? (
        <ResourceErrorPanel
          error={query.error}
          onRetry={() => void query.refetch()}
          retryAiId="cluster-monitor:apiserver:retry"
        />
      ) : null}

      {state === 'ready' || state === 'empty'
        ? charts
            .filter((chart) => APISERVER_CHART_IDS[chart.key] !== undefined)
            .map((chart) => (
              <ClusterChartCard
                key={chart.key}
                aiId={'cluster-monitor:apiserver:chart:' + APISERVER_CHART_IDS[chart.key]}
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
