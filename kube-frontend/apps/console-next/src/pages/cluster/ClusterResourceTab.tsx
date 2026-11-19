import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { rangeMetricsApi } from '@kube-ai-hub/api-client';
import { api } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { useT } from '@/i18n';
import { ClusterChartCard } from './ClusterChartCard';
import type { WindowContext } from './monitorTabs';
import {
  RESOURCE_CHARTS,
  RESOURCE_GROUPS,
  RESOURCE_GROUP_TITLE_KEYS,
  RESOURCE_METRICS,
  chartsInGroup,
  formatResourceValue,
  toResourceCharts,
  type ResourceChart,
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
/** The chart copy a tab needs for the refresh veil. */
export interface ManualRefreshState {
  /** True while a reader-initiated refresh is in flight. */
  refreshing: boolean;
  /** Accessible name for the veil. */
  label: string;
}

/**
 * Whether the refresh now in flight was the reader's.
 *
 * Every tab has two entry points for the same read: its own controls (none, in most
 * tabs) and the page header's 刷新, which arrives as `manualTick`. A tab cannot see
 * the button, so it watches the counter: a bump while the query is fetching means a
 * person asked, and the plot should veil itself exactly as it would for a local
 * button.
 *
 * The flag clears when the query settles, or after a ceiling so a request that never
 * settles cannot leave the veil on for ever.
 */
export function useManualRefresh(manualTick: number | undefined, isFetching: boolean): ManualRefreshState {
  const t = useT();
  const lastTick = React.useRef(manualTick ?? 0);
  const [bumped, setBumped] = React.useState(false);
  React.useEffect(() => {
    if ((manualTick ?? 0) === lastTick.current) return;
    lastTick.current = manualTick ?? 0;
    setBumped(true);
    const timer = globalThis.setTimeout(() => setBumped(false), 8_000);
    return () => globalThis.clearTimeout(timer);
  }, [manualTick]);
  React.useEffect(() => {
    if (!isFetching) setBumped(false);
  }, [isFetching]);
  return { refreshing: bumped, label: t('cluster.monitor.refreshing') };
}

export function ClusterResourceTab({
  cluster,
  rangeKey,
  start,
  end,
  step,
  manualTick,
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
    /*
     * Keep the previous window's points while the new one loads: a rolling window
     * moves on every refresh, so the key changes and the query would otherwise report
     * `pending` with no data — the plot blinked out and back. Keeping the last answer
     * is what lets a refresh update the chart instead of replacing it.
     */
    placeholderData: (previous) => previous,
    retry: false,
  });

  const charts = React.useMemo(
    () => (query.data ? toResourceCharts(query.data, t) : []),
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
    <div className="flex flex-col gap-6" data-ai-id="cluster-monitor:resource" data-ai-state={state}>
      {state === 'loading' ? (
        /*
         * The real cards, from the static spec list, with `loading` set.
         *
         * The spec list — not `charts`, which is built from the response — is what
         * makes this work: on a first load `charts` is empty, so driving the skeleton
         * from it rendered nothing at all and the page went from blank to full. The
         * title, the plot box and the legend now take their final places before the
         * data exists, so nothing moves when it lands.
         */
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          {chartsInGroup(
            RESOURCE_CHARTS.map((spec): ResourceChart => ({ spec, series: [], hasData: false })),
            RESOURCE_GROUPS[0],
          ).map((chart) => (
            <ClusterChartCard
              key={chart.spec.group + ':' + chart.spec.key}
              aiId={'cluster-monitor:resource:chart:' + chart.spec.group + ':' + chart.spec.key}
              group={chart.spec.group}
              title={t(chart.spec.titleKey)}
              series={[]}
              start={start}
              end={end}
              hasData={false}
              loading
              emptyText={t('cluster.monitor.empty')}
              formatValue={(value) => formatResourceValue(value, chart.spec.kind)}
            />
          ))}
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
                      refreshing={manual.refreshing}
                      refreshingLabel={manual.label}
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
