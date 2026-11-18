import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { rangeMetricsApi } from '@kube-ai-hub/api-client';
import { Skeleton } from '@kube-ai-hub/ui';
import { api } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { useT } from '@/i18n';
import { ClusterChartCard } from './ClusterChartCard';
import type { WindowContext } from './monitorTabs';
import {
  RESOURCE_GROUPS,
  RESOURCE_GROUP_TITLE_KEYS,
  RESOURCE_METRICS,
  chartsInGroup,
  formatResourceValue,
  toResourceCharts,
} from './monitorResourceCharts';

/**
 * 物理资源监控 -- the old console's second 集群状态 page.
 *
 * The same facts it showed, re-grouped: eighteen charts across GPU, host, disk,
 * network and RDMA. Several cards that each drew one line are merged into one chart
 * with one line per series (load 1/5/15, disk read/write, pod states, RDMA port up/total,
 * RDMA tx/rx, RDMA errors) so the reader compares shapes on one scale instead of
 * holding several small plots in their head.
 *
 * One range request carries every metric: one request per chart would multiply the
 * load and let two charts disagree about the same instant. The tab is mounted only on
 * its own tab, so switching away cancels nothing that is still shown and switching in
 * never pre-fetches.
 */
export function ClusterResourceTab({
  cluster,
  rangeKey,
  start,
  end,
  step,
  onStateChange,
}: WindowContext): React.ReactElement {
  const t = useT();

  const query = useQuery({
    queryKey: ['cluster-monitor-resource', cluster, rangeKey, start, end, step],
    queryFn: ({ signal }) =>
      rangeMetricsApi(api).cluster({
        cluster,
        metrics: [...RESOURCE_METRICS],
        start,
        end,
        step,
        signal,
      }),
    // A window is historical: refetching it every 30 seconds would re-download the
    // whole range to add one point. The header moves the range when auto refresh is on.
    staleTime: 60_000,
    retry: false,
  });

  const charts = React.useMemo(
    () => (query.data ? toResourceCharts(query.data, t) : []),
    [query.data, t],
  );

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
    <div className="flex flex-col gap-6" data-ai-id="cluster-monitor:resource" data-ai-state={state}>
      {state === 'loading' ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : null}

      {state === 'error' ? (
        <ResourceErrorPanel
          error={query.error}
          onRetry={() => void query.refetch()}
          retryAiId="cluster-monitor:resource:retry"
        />
      ) : null}

      {state === 'ready' || state === 'empty'
        ? RESOURCE_GROUPS.map((group) => {
            const inGroup = chartsInGroup(charts, group);
            if (inGroup.length === 0) return null;
            return (
              <section key={group} className="flex flex-col gap-3" data-ai-id={'cluster-monitor:resource:group:' + group}>
                <h2 className="text-sm font-semibold text-ai-fg-secondary">{t(RESOURCE_GROUP_TITLE_KEYS[group])}</h2>
                <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                  {inGroup.map((chart) => (
                    <ClusterChartCard
                      key={chart.spec.group + ':' + chart.spec.key}
                      aiId={'cluster-monitor:resource:chart:' + chart.spec.group + ':' + chart.spec.key}
                      group={chart.spec.group}
                      title={t(chart.spec.titleKey)}
                      series={chart.series}
                      start={start}
                      end={end}
                      hasData={chart.hasData}
                      emptyText={t('cluster.monitor.empty')}
                      emptyHint={t('cluster.monitor.emptyHint')}
                      formatValue={(value) => formatResourceValue(value, chart.spec.kind)}
                    />
                  ))}
                </div>
              </section>
            );
          })
        : null}
    </div>
  );
}
