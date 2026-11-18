import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError, clusterStatusApi, rangeMetricsApi, type MetricSeries } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Button, Skeleton, Tabs, TabsContent, TrendChart } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { ClusterApiServerTab } from './ClusterApiServerTab';
import { ClusterEtcdTab } from './ClusterEtcdTab';
import { ClusterOverviewTab } from './ClusterOverviewTab';
import { ClusterRankingTab } from './ClusterRankingTab';
import { ClusterResourceTab } from './ClusterResourceTab';
import { ClusterSchedulerTab } from './ClusterSchedulerTab';
import {
  DEFAULT_MONITOR_TAB,
  ETCD_TAB,
  MONITOR_TABS,
  MONITOR_TAB_ITEMS,
  isMonitorTabKey,
  type MonitorTabKey,
  type MonitorTabState,
  type WindowContext,
} from './monitorTabs';
import {
  AUTO_REFRESH_INTERVAL_MS,
  DEFAULT_WINDOW_KEY,
  WINDOWS,
  rangeForWindow,
  windowFor,
  type WindowKey,
} from './monitorWindow';

/**
 * 集群监控 — one navigation entry, five tabs.
 *
 * The old console split this page into five sub-pages (概览 / 物理资源 / API Server /
 * 调度器 / 排行). The migration had flattened them into a single scroll, which made
 * the control-plane charts a hunt and kept every query mounted at once. The tabs
 * restore the old information architecture while keeping one header: the window
 * buttons and the 自动刷新 switch belong to the page, not to a tab, so there is
 * exactly one control for each action.
 *
 * Only the active tab is mounted. That is the load contract, not a rendering
 * detail: switching to the ranking tab must not keep re-querying the twelve
 * physical-resource charts behind it, and the ranking tab must not fire on first
 * paint.
 *
 * The node detail reuses this component for its three node-scoped trends. That
 * variant has no tabs and no cluster-wide blocks: a node monitor is one small page,
 * and wrapping three charts in a tab strip would be navigation for its own sake.
 */
export interface ClusterMonitorPageProps {
  cluster: string;
  node?: string;
  /** The tab to show; the route reads it from `?tab=`. Defaults to overview. */
  tab?: MonitorTabKey;
  /** Called when the reader picks another tab; the route writes it to the URL. */
  onTabChange?: (tab: MonitorTabKey) => void;
}

interface NodeChart {
  key: 'cpu' | 'memory' | 'pods';
  metric: string;
  total?: string;
  kind: 'percent' | 'count';
}

/** The node detail's three trends: CPU, memory, running pods. */
const NODE_CHARTS: readonly NodeChart[] = [
  { key: 'cpu', metric: 'node_cpu_usage', total: 'node_cpu_total', kind: 'percent' },
  { key: 'memory', metric: 'node_memory_usage_wo_cache', total: 'node_memory_total', kind: 'percent' },
  { key: 'pods', metric: 'node_pod_running_count', kind: 'count' },
];

export function ClusterMonitorPage({ cluster, node, tab, onTabChange }: ClusterMonitorPageProps): React.ReactElement {
  const t = useT();
  const [windowKey, setWindowKey] = React.useState<WindowKey>(DEFAULT_WINDOW_KEY);
  const [localTab, setLocalTab] = React.useState<MonitorTabKey>(DEFAULT_MONITOR_TAB);
  /*
   * Guard the prop, not just the route: a search value that slipped through (an old
   * bookmark, a hand-edited URL, a router that kept the raw key) must land on the
   * overview. An unknown tab would otherwise match no panel -- no panel is mounted,
   * so no tab reports a state, and the surface stays 'loading' forever.
   */
  const requestedTab: MonitorTabKey = tab !== undefined && isMonitorTabKey(tab) ? tab : localTab;
  const window = windowFor(windowKey);

  /*
   * The window is resolved to absolute timestamps once per window selection, not on
   * every render: `end: Date.now()` inside the query key would change on each paint
   * and refetch forever.
   */
  const [range, setRange] = React.useState(() => rangeForWindow(DEFAULT_WINDOW_KEY));
  React.useEffect(() => {
    setRange(rangeForWindow(windowKey));
  }, [windowKey]);

  /*
   * Auto refresh, matching the old console's monitoring controller: a play/pause
   * control that re-reads the last N minutes every five seconds. Each tick moves the
   * window forward rather than re-querying a frozen range, which is the whole point of
   * watching a live cluster. The tabs read the same `start`/`end`, so they follow the
   * switch without a second control -- and a tab that is not mounted issues nothing.
   */
  const [autoRefresh, setAutoRefresh] = React.useState(false);
  React.useEffect(() => {
    if (!autoRefresh) return;
    const timer = globalThis.setInterval(() => {
      setRange(rangeForWindow(windowKey));
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => globalThis.clearInterval(timer);
  }, [autoRefresh, windowKey]);

  /*
   * The node variant has one query, owned by NodeTrends; it reports through the same
   * state vocabulary so the surface contract is the same on both branches.
   */
  const [nodeState, setNodeState] = React.useState<MonitorTabState>('loading');

  /*
   * The etcd tab is **conditional**: the old console only showed it when etcd was
   * wired into monitoring, and the probe is the ServiceMonitor object itself (200 =
   * wired, 404 = not). The query key is the one the overview's component band uses,
   * so on the overview both readers share one request and one answer.
   *
   * A failed probe hides the tab rather than offering a broken one; the overview's
   * component band is where the failure is explained.
   */
  const etcdProbe = useQuery({
    queryKey: ['cluster-status', cluster, 'etcd-service-monitor'],
    enabled: !node,
    staleTime: 30_000,
    retry: false,
    queryFn: async ({ signal }): Promise<'monitoring' | 'not-monitored'> => {
      try {
        await clusterStatusApi(apiClient).etcdServiceMonitor({ cluster, signal });
        return 'monitoring';
      } catch (error) {
        // 404 is the answer "not wired into monitoring"; every other failure means
        // the tab's existence is unknown, and hiding it is the safe branch.
        if (error instanceof ApiError && error.isNotFound) return 'not-monitored';
        throw error;
      }
    },
  });
  const etcdVisible = !node && etcdProbe.data === 'monitoring';
  /*
   * While the probe is in flight, a `?tab=etcd` deep link keeps its tab (it may be
   * about to become visible); once the probe says the tab is hidden, the panel falls
   * back to the overview instead of painting blank.
   */
  const activeTab: MonitorTabKey =
    requestedTab === 'etcd' && !etcdProbe.isPending && !etcdVisible ? DEFAULT_MONITOR_TAB : requestedTab;

  const handleTabChange = React.useCallback(
    (value: string) => {
      if (!isMonitorTabKey(value)) return;
      setLocalTab(value);
      onTabChange?.(value);
    },
    [onTabChange],
  );

  /*
   * The active tab owns the page's AiSurface state, because the page cannot see the
   * tab's queries. The report is tagged with the tab it came from: a late report from
   * the tab we just left must not describe the one we are on.
   */
  const [tabReport, setTabReport] = React.useState<{ tab: MonitorTabKey; state: MonitorTabState }>({
    tab: DEFAULT_MONITOR_TAB,
    state: 'loading',
  });
  const reportTabState = React.useCallback(
    (state: MonitorTabState) => setTabReport({ tab: activeTab, state }),
    [activeTab],
  );
  const tabState: MonitorTabState = tabReport.tab === activeTab ? tabReport.state : 'loading';

  /*
   * Normalize a deep link to a hidden conditional tab: the URL should not keep
   * pointing at a tab the strip does not have.
   */
  React.useEffect(() => {
    if (node || requestedTab !== 'etcd' || etcdProbe.isPending || etcdVisible) return;
    handleTabChange(DEFAULT_MONITOR_TAB);
  }, [node, requestedTab, etcdProbe.isPending, etcdVisible, handleTabChange]);

  const context: WindowContext = React.useMemo(
    () => ({
      cluster,
      rangeKey: windowKey,
      start: range.start,
      end: range.end,
      step: window.step,
      live: autoRefresh,
      onStateChange: reportTabState,
    }),
    [cluster, windowKey, range.start, range.end, window.step, autoRefresh, reportTabState],
  );

  /*
   * The panel list follows the strip except during a deep link to the conditional
   * tab while its probe is in flight: then the content must render without a trigger
   * yet, or the page would be blank for one round trip.
   */
  const renderableTabs: readonly MonitorTabKey[] =
    etcdVisible || activeTab === ETCD_TAB.key ? [...MONITOR_TABS, ETCD_TAB.key] : MONITOR_TABS;

  return (
    <AiSurface
      as="section"
      aiId="cluster-monitor:surface"
      state={node ? nodeState : tabState}
      className="flex min-w-0 flex-col gap-4"
    >
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-ai-fg">
            {node ? `${node} · ${t('node.detail.monitor')}` : t('cluster.monitor.title')}
          </h1>
          {!node ? <p className="text-sm text-ai-fg-muted">{t('cluster.monitor.description')}</p> : null}
        </div>
        <div className="flex flex-wrap gap-1" {...actionProps('cluster-monitor:range')}>
          {WINDOWS.map((entry) => (
            /*
             * The shared Button, not a bare element: the ai-surface contract requires
             * every interactive element to carry an agent handle.
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
          <Button
            size="sm"
            variant={autoRefresh ? 'primary' : 'secondary'}
            aria-pressed={autoRefresh}
            {...actionProps('cluster-monitor:auto-refresh')}
            onClick={() => setAutoRefresh((previous) => !previous)}
          >
            {autoRefresh ? t('cluster.monitor.autoRefreshOn') : t('cluster.monitor.autoRefreshOff')}
          </Button>
        </div>
      </header>

      {node ? (
        <NodeTrends
          cluster={cluster}
          node={node}
          rangeKey={windowKey}
          start={range.start}
          end={range.end}
          step={window.step}
          onStateChange={setNodeState}
        />
      ) : (
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          items={[
            ...MONITOR_TAB_ITEMS.map((item) => ({ value: item.key, label: t(item.labelKey), aiId: item.aiId })),
            ...(etcdVisible
              ? [{ value: ETCD_TAB.key, label: t(ETCD_TAB.labelKey), aiId: ETCD_TAB.aiId }]
              : []),
          ]}
        >
          {renderableTabs.map((key) => (
            <TabsContent
              key={key}
              value={key}
              data-ai-id={`cluster-monitor:tabpanel:${key}`}
              className="mt-4 flex flex-col gap-4"
            >
              {activeTab === key ? renderTab(key, context, reportTabState, handleTabChange) : null}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </AiSurface>
  );
}

/**
 * The mounted tab.
 *
 * Only the active key renders a child, so Radix never mounts a hidden panel and a
 * tab that has never been opened issues no request.
 */
function renderTab(
  key: MonitorTabKey,
  context: WindowContext,
  onStateChange: (state: MonitorTabState) => void,
  onTabChange: (value: string) => void,
): React.ReactElement {
  switch (key) {
    case 'overview':
      return <ClusterOverviewTab {...context} onTabChange={onTabChange} />;
    case 'resource':
      return <ClusterResourceTab {...context} />;
    case 'apiserver':
      return <ClusterApiServerTab {...context} />;
    case 'scheduler':
      return <ClusterSchedulerTab {...context} />;
    case 'ranking':
      return (
        <ClusterRankingTab
          cluster={context.cluster}
          onStateChange={onStateChange}
          {...(context.live !== undefined ? { live: context.live } : {})}
        />
      );
    case 'etcd':
      return <ClusterEtcdTab {...context} />;
  }
}

/* ------------------------------------------------------------------ *
 * Node detail: three node-scoped trends.
 * ------------------------------------------------------------------ */

/**
 * The node-scoped trends, unchanged from the pre-tab page.
 *
 * The node monitor has no status band and no control-plane sections: it answers
 * "what is this one node doing", and the three charts are the whole page.
 */
function NodeTrends({
  cluster,
  node,
  rangeKey,
  start,
  end,
  step,
  onStateChange,
}: {
  cluster: string;
  node: string;
  rangeKey: WindowKey;
  start: number;
  end: number;
  step: string;
  onStateChange: (state: MonitorTabState) => void;
}): React.ReactElement {
  const t = useT();
  const metrics = React.useMemo(
    () => Array.from(new Set(NODE_CHARTS.flatMap((chart) => (chart.total ? [chart.metric, chart.total] : [chart.metric])))),
    [],
  );
  const trends = useQuery({
    queryKey: ['cluster-monitor', cluster, node, rangeKey, start, end],
    queryFn: ({ signal }) =>
      rangeMetricsApi(apiClient).cluster({ cluster, scope: 'node', node, metrics, start, end, step, signal }),
    staleTime: 60_000,
    retry: false,
  });
  const seriesByName = React.useMemo(() => {
    const map = new Map<string, MetricSeries>();
    for (const series of trends.data ?? []) map.set(series.name, series);
    return map;
  }, [trends.data]);
  const plotted = React.useMemo(() => {
    const out = new Map<string, MetricSeries>();
    for (const chart of NODE_CHARTS) {
      const used = seriesByName.get(chart.metric);
      if (!used) continue;
      if (!chart.total) {
        out.set(chart.key, used);
        continue;
      }
      const total = seriesByName.get(chart.total);
      if (!total) continue;
      const totalByTime = new Map(total.points.map((point) => [point.at, point.value]));
      const points = used.points.flatMap((point) => {
        const capacity = totalByTime.get(point.at);
        if (capacity === undefined || capacity <= 0) return [];
        return [{ at: point.at, value: (point.value / capacity) * 100 }];
      });
      out.set(chart.key, { name: chart.metric, points });
    }
    return out;
  }, [seriesByName]);

  const state: MonitorTabState = trends.isPending ? 'loading' : trends.isError ? 'error' : 'ready';
  React.useEffect(() => onStateChange(state), [onStateChange, state]);

  return (
    <div className="flex flex-col gap-3" data-ai-id="cluster-monitor:node-trends" data-ai-state={state}>
      {state === 'loading' ? <Skeleton className="h-64 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={trends.error} onRetry={() => void trends.refetch()} retryAiId="cluster-monitor:retry" />
      ) : null}
      {state === 'ready'
        ? NODE_CHARTS.map((chart) => (
            <TrendCard
              key={chart.key}
              title={t(`cluster.monitor.${chart.key}`)}
              aiId={`cluster-monitor:node-trends:${chart.key}`}
              series={plotted.get(chart.key)}
              kind={chart.kind}
              start={start}
              end={end}
            />
          ))
        : null}
    </div>
  );
}

/** How a chart prints its numbers. */
type ChartKind = 'percent' | 'count';

/**
 * One node trend card.
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
  kind: ChartKind;
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
          {latest === undefined ? '-' : formatChartValue(latest, kind)}
        </span>
      </div>

      {points.length === 0 ? (
        <div className="flex flex-col gap-1 py-6" data-ai-id={`${aiId}:empty`}>
          <span className="text-sm text-ai-fg-secondary">{t('cluster.monitor.empty')}</span>
          <span className="text-xs text-ai-fg-muted">{t('cluster.monitor.emptyHint')}</span>
        </div>
      ) : (
        <React.Fragment>
          <TrendChart
            points={points}
            start={start}
            end={end}
            label={title}
            emptyText={t('cluster.monitor.empty')}
            formatValue={(value) => formatChartValue(value, kind)}
            data-ai-id={`${aiId}:chart`}
          />
          <dl className="mt-2 flex flex-wrap gap-4 text-xs text-ai-fg-muted">
            <div className="flex gap-1">
              <dt>{t('cluster.monitor.min')}</dt>
              <dd className="tabular-nums text-ai-fg-secondary">{min === undefined ? '-' : formatChartValue(min, kind)}</dd>
            </div>
            <div className="flex gap-1">
              <dt>{t('cluster.monitor.max')}</dt>
              <dd className="tabular-nums text-ai-fg-secondary">{max === undefined ? '-' : formatChartValue(max, kind)}</dd>
            </div>
            <div className="flex gap-1">
              <dt>{t('cluster.monitor.now')}</dt>
              <dd className="tabular-nums text-ai-fg-secondary">{latest === undefined ? '-' : formatChartValue(latest, kind)}</dd>
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

/** Percent vs a plain integer count; shared by the node cards. */
function formatChartValue(value: number, kind: ChartKind): string {
  if (kind === 'percent') return `${Math.round(value)}%`;
  return String(Math.round(value));
}
