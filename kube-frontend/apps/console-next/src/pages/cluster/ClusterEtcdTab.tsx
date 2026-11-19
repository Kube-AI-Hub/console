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
 * etcd 监控 -- a sixth, **conditional** tab, restored from the old console.
 *
 * The old console showed an etcd page only when etcd's service monitor existed; the
 * overview's system-component section already reports the other branch ("本集群未上报"),
 * and this tab is where the reported case belongs. The page owns the visibility probe
 * (it appears only when `etcdServiceMonitor` answers 200); this component is only the
 * content, so it can be mounted in a test without the route.
 *
 * When every etcd metric comes back without series the tab renders one explanation
 * (`cluster-monitor:etcd:no-data`) instead of seven empty plots: on a cluster without
 * etcd monitoring that is the whole answer, and seven identical "no data" cards would
 * repeat it. A single chart that is missing while others report keeps its own
 * `:chart:<key>:empty` explanation, because there the missing metric is the news.
 */
export function ClusterEtcdTab({
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
  const query = useComponentMetrics({ cluster, component: 'etcd', rangeKey, start, end, step });
  const charts = React.useMemo(
    () => (query.data ? toComponentCharts('etcd', query.data, t) : []),
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
    <div className="flex flex-col gap-4" data-ai-id="cluster-monitor:etcd" data-ai-state={state}>
      {state === 'loading' ? (
        /* The skeleton stands in for the plots, at the plot's own height. */
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          <ChartSkeleton height={160} aiId="cluster-monitor:etcd:loading:0" />
          <ChartSkeleton height={160} aiId="cluster-monitor:etcd:loading:1" />
        </div>
      ) : null}

      {state === 'error' ? (
        <ResourceErrorPanel
          error={query.error}
          onRetry={() => void query.refetch()}
          retryAiId="cluster-monitor:etcd:retry"
        />
      ) : null}

      {state === 'empty' ? (
        <div
          className="flex flex-col gap-1 rounded-ai-md border border-ai-line/60 bg-ai-surface p-6"
          data-ai-id="cluster-monitor:etcd:no-data"
        >
          <span className="text-sm text-ai-fg-secondary">{t('cluster.monitor.components.notReported')}</span>
          <span className="text-xs text-ai-fg-muted">{t('cluster.monitor.components.notReportedHint')}</span>
        </div>
      ) : null}

      {state === 'ready'
        ? charts.map((chart) => (
            <ClusterChartCard
              key={chart.key}
              aiId={'cluster-monitor:etcd:chart:' + chart.key}
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
