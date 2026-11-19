import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { clusterMetricsApi, rangeMetricsApi, type ClusterUsage, type MetricSeries } from '@kube-ai-hub/api-client';
import { Card, Icon, MetricRing, Panel, Progress, Skeleton, cn, useSpotlight } from '@kube-ai-hub/ui';
import {
  ChartPanel,
  presetRange,
  resolveRange,
  type ChartPanelLabels,
  type TimeRange,
} from '@kube-ai-hub/ui/charts';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { api } from '@/api';
import { useT } from '@/i18n';
import {
  OVERVIEW_RESOURCES, formatOverviewValue, overviewRatio, overviewRatioPoints,
  type OverviewResource,
} from './overviewResourceMetrics';

/**
 * The copy the shared chart panel needs, assembled once.
 *
 * Every monitoring surface passes the same sentences; keeping the assembly in one
 * helper means a wording change lands everywhere instead of on the page that was
 * edited.
 */
export function chartPanelLabels(t: ReturnType<typeof useT>): ChartPanelLabels {
  return {
    placeholder: t('cluster.monitor.range.1h'),
    presets: t('cluster.monitor.rangeLabel'),
    custom: t('cluster.monitor.rangeCustom'),
    rangePlaceholder: t('cluster.monitor.rangePlaceholder'),
    /*
     * The preset labels are localised here, not left as bare keys.
     *
     * `TimeRangePicker` falls back to the preset key when the host passes none, which
     * is fine for a story but reads as `1h` / `6h` on a Chinese page — the picker's
     * menu was a column of identifiers.
     */
    presetLabels: {
      '10m': t('cluster.monitor.range.10m'),
      '20m': t('cluster.monitor.range.20m'),
      '30m': t('cluster.monitor.range.30m'),
      '1h': t('cluster.monitor.range.1h'),
      '2h': t('cluster.monitor.range.2h'),
      '3h': t('cluster.monitor.range.3h'),
      '5h': t('cluster.monitor.range.5h'),
      '12h': t('cluster.monitor.range.12h'),
      '1d': t('cluster.monitor.range.1d'),
      '2d': t('cluster.monitor.range.2d'),
      '3d': t('cluster.monitor.range.3d'),
      '7d': t('cluster.monitor.range.7d'),
    },
    step: t('cluster.monitor.step'),
    stepHint: t('cluster.monitor.stepHint'),
    stepOptions: [],
    cancel: t('common.cancel'),
    confirm: t('common.confirm'),
    invalid: t('cluster.monitor.rangeInvalid'),
    refresh: t('common.refresh'),
    error: t('cluster.overview.emptyTrend'),
    retry: t('common.retry'),
    loading: t('common.loading'),
    refreshing: t('cluster.monitor.refreshing'),
    autoPause: t('cluster.monitor.autoPause'),
    autoResume: t('cluster.monitor.autoResume'),
    autoPauseLabel: t('cluster.monitor.autoPauseLabel'),
    autoResumeLabel: t('cluster.monitor.autoResumeLabel'),
  };
}

function ResourceMetricCard({ entry, data, active, onSelect }: {
  entry: (typeof OVERVIEW_RESOURCES)[number]; data: ClusterUsage; active: boolean;
  onSelect: () => void;
}): React.ReactElement {
  const t = useT();
  const spotlight = useSpotlight<HTMLDivElement>();
  const description = React.useId();
  const ratio = overviewRatio(data[entry.used], data[entry.total]);
  const allocated = 'allocated' in entry ? formatOverviewValue(data[entry.allocated], entry.unit, t('node.list.cards')) : undefined;
  return <div ref={spotlight.ref} className="min-w-0">
    <Card interactive {...actionProps(`overview:usage-${entry.key}`)}
      role="button" tabIndex={0}
      aria-label={t(entry.label)} aria-describedby={description}
      aria-pressed={active}
      onPointerMove={spotlight.onPointerMove}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(); }
      }}
      className={cn('relative grid min-w-0 gap-1 rounded-ai-md p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-ring',
        'grid-rows-[1.75rem_2.75rem_1.25rem_1.25rem]',
        active ? 'border-ai-accent/50 bg-ai-accent/5' : 'border-ai-line bg-ai-surface-2')}>
      <div className="flex items-center text-sm font-medium text-ai-fg" data-ai-field="name"
        {...actionProps(`overview:select-resource:${entry.key}`)}>{t(entry.label)}</div>
      <dl id={description} className="contents">
        <div className="grid grid-cols-2 gap-2 pr-16">
          <div><dt className="text-[10px] text-ai-fg-secondary">{t('cluster.overview.used')}</dt>
            <dd className="mt-1 whitespace-nowrap text-base font-semibold tabular-nums" data-ai-field="used">{formatOverviewValue(data[entry.used], entry.unit, t('node.list.cards'))}</dd></div>
          <div><dt className="text-[10px] text-ai-fg-secondary">{t('cluster.overview.total')}</dt>
            <dd className="mt-1 whitespace-nowrap text-base font-semibold tabular-nums" data-ai-field="total">{formatOverviewValue(data[entry.total], entry.unit, t('node.list.cards'))}</dd></div>
        </div>
        <div className="flex items-center gap-2 text-xs text-ai-fg-secondary">
          {t('cluster.overview.usageRate')}<span className="font-medium tabular-nums text-ai-fg" data-ai-field="ratio">{ratio === undefined ? '-' : `${Math.round(ratio * 100)}%`}</span>
        </div>
        <div className="text-xs text-ai-fg-secondary" data-ai-field="allocated">
          {allocated !== undefined ? <>{t('cluster.overview.allocated')} <span className="tabular-nums text-ai-fg">{allocated}</span></> : null}
        </div>
      </dl>
      <MetricRing value={ratio === undefined ? undefined : ratio * 100} aria-label={t(entry.label)}
        tone={'health' in entry ? ratio === 1 ? 'success' : 'warning' : 'auto'} className="absolute right-3 top-11 size-14">
        <Icon name={entry.icon} size={22} />
      </MetricRing>
    </Card>
  </div>;
}

/**
 * 节点数.
 *
 * Node readiness is the one number on this page that answers "can this cluster accept
 * work at all", so it gets its own block beside the ranking rather than a seventh card in
 * the resource grid. The block shares the 1:2 row with the ranking and stretches to the
 * same height, which means the content has to fill that height: a 134px card in a 324px
 * panel left most of the block empty and read as a rendering fault.
 *
 * The proportions are the same facts as before — ready nodes, total, ready rate — only
 * larger. No trend, no time window, no action inside the block: the readiness rate over
 * time is the node page's job, and a control here would duplicate its entry.
 */
function NodeReadinessBlock({ entry, data }: {
  entry: (typeof OVERVIEW_RESOURCES)[number]; data: ClusterUsage;
}): React.ReactElement {
  const t = useT();
  const ratio = overviewRatio(data[entry.used], data[entry.total]);
  const percent = ratio === undefined ? undefined : Math.round(ratio * 100);
  const used = formatOverviewValue(data[entry.used], entry.unit, t('node.list.cards'));
  const total = formatOverviewValue(data[entry.total], entry.unit, t('node.list.cards'));
  // Full readiness is healthy; anything less is a warning, not a neutral colour. The
  // ring and the bar share this tone so they cannot disagree.
  const tone = ratio === undefined ? 'auto' : ratio === 1 ? 'success' : 'warning';
  /*
   * Ring on the left, figures on the right, the pair centred in the block.
   *
   * A top-aligned number row plus a bottom-aligned progress bar left a dead band in the
   * middle of a panel that is stretched by its neighbour. Centring one visual unit —
   * ring, counts and rate read together — fills the height without inventing a spacer,
   * and the ratio it displays is the ring's own number rather than a second fact.
   */
  return <div className="flex min-w-0 flex-1 items-center gap-5" data-ai-id={`overview:usage-${entry.key}`}>
    <MetricRing value={percent} aria-label={t('cluster.overview.nodeReadyRate')} tone={tone}
      className="size-24 shrink-0 sm:size-28">
      <span className="flex flex-col items-center leading-none">
        <span className="text-xl font-semibold tabular-nums" data-ai-field="ratio">
          {percent === undefined ? '-' : `${percent}%`}
        </span>
        <span className="mt-1 text-[10px] font-normal opacity-80">{t('cluster.overview.nodeReadyRate')}</span>
      </span>
    </MetricRing>
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <dl className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-1">
        <div className="min-w-0">
          <dt className="text-[11px] text-ai-fg-muted">{t('cluster.overview.readyNodes')}</dt>
          <dd className="mt-1 whitespace-nowrap text-4xl font-semibold leading-none tabular-nums text-ai-fg" data-ai-field="used">
            {used}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] text-ai-fg-muted">{t('cluster.overview.total')}</dt>
          <dd className="mt-1 whitespace-nowrap text-4xl font-semibold leading-none tabular-nums text-ai-fg-secondary" data-ai-field="total">
            {total}
          </dd>
        </div>
      </dl>
      {percent === undefined ? null : <Progress value={percent} tone={tone} aria-label={t('cluster.overview.nodeReadyRate')} />}
      {/* Kept for the field-grid contract shared with the resource cards: nodes have no
          allocation concept, so the slot stays empty rather than inventing a value. */}
      <span className="sr-only" data-ai-field="allocated" />
    </div>
  </div>;
}

export function NodeSummaryPanel({ cluster }: {
  cluster: string;
}): React.ReactElement {
  const t = useT();
  const usage = useQuery({
    queryKey: ['cluster-usage', cluster], retry: false, staleTime: 30_000,
    refetchOnWindowFocus: false, refetchOnReconnect: false,
    queryFn: ({ signal }) => clusterMetricsApi(api).usage({ cluster, signal }),
  });
  const entry = OVERVIEW_RESOURCES.find((resource) => resource.key === 'nodes')!;
  return <Panel title={t('cluster.overview.nodeCount')} icon="nodes" titleLevel={2}
    data-ai-id="overview:node-summary" aria-busy={usage.isFetching}
    className="flex h-full min-w-0 flex-col"
    /*
     * `min-h` matches the ranking header, which is taller because it carries a select
     * control: without it the two panels start their content on different baselines and
     * the row looks assembled from two designs.
     */
    headerClassName="min-h-[3.75rem] items-center"
    bodyClassName="flex min-h-0 flex-1 flex-col"
    actions={<Link to="/kube-frontend/clusters/$cluster/nodes" params={{ cluster }}
      className="text-xs text-ai-link underline-offset-4 hover:underline" data-ai-id="overview:node-summary-more">
      {t('cluster.overview.viewNodes')}
    </Link>}>
    {usage.isError ? <p role="alert" data-ai-id="overview:no-node-metrics" className="mb-3 text-sm text-ai-warning">
      {t('cluster.overview.noMetrics')}{usage.data ? ` · ${t('cluster.overview.staleValues')}` : ''}
    </p> : null}
    {usage.isPending ? <Skeleton className="h-36" /> : usage.data
      ? <NodeReadinessBlock entry={entry} data={usage.data} />
      : null}
  </Panel>;
}

export function OverviewResourcePanel({ cluster, refreshAt, manualRefresh }: {
  cluster: string;
  /**
   * The page's refresh tick.
   *
   * Kept in the signature because the page passes it and because a rolling window
   * has to move with the tick: the plot's `range` is a `TimeRange` now, so the
   * component re-resolves it whenever this value changes rather than freezing the
   * window at mount.
   */
  refreshAt: number;
  /**
   * Whether a **reader-initiated** refresh is in flight, from the page's scheduler.
   *
   * The page header and this panel both start the same reads. The header's button has
   * no chart of its own to veil, so it reports the intent here; without it the two
   * buttons behaved differently — one dimmed the plot, the other changed it silently.
   */
  manualRefresh?: boolean;
}): React.ReactElement {
  const t = useT();
  const [selected, setSelected] = React.useState<OverviewResource>('gpu-memory');
  /*
   * The window is the shared range selection, not a local key: this panel is one of
   * four monitoring surfaces, and a reader who picked "last 10 minutes" on the
   * cluster monitor expects the same choice to mean the same thing here.
   */
  const [range, setRange] = React.useState<TimeRange>(() => presetRange('1h'));
  /*
   * Re-resolve the rolling window on every auto-refresh tick.
   *
   * `resolveRange` reads `Date.now()`; without this the window would be pinned to
   * the instant the panel mounted and the page's timer would re-query the same
   * frozen minutes. A fixed span is unaffected (its timestamps do not move).
   */
  const resolved = React.useMemo(() => resolveRange(range), [range, refreshAt]);
  const usage = useQuery({
    queryKey: ['cluster-usage', cluster], retry: false, staleTime: 30_000,
    refetchOnWindowFocus: false, refetchOnReconnect: false,
    queryFn: ({ signal }) => clusterMetricsApi(api).usage({ cluster, signal }),
  });
  const resources = OVERVIEW_RESOURCES.filter((resource) => resource.key !== 'nodes' &&
    (!('gpu' in resource) || usage.data?.gpuTotal !== 0));
  const resource = resources.find((entry) => entry.key === selected) ?? resources[0]!;
  const trends = useQuery<MetricSeries[]>({
    queryKey: ['overview-trends', cluster, resource.key, resolved.start, resolved.end],
    enabled: Boolean(usage.data), retry: false, staleTime: 30_000, refetchOnWindowFocus: false, refetchOnReconnect: false,
    /*
     * Keep the previous window's points while the new one loads.
     *
     * A rolling window moves on every refresh, so the query key changes and the query
     * would otherwise report `pending` with no data — the plot vanished for a frame and
     * came back. Keeping the last answer means a refresh *updates* the chart, which is
     * the whole point of veiling it rather than blanking it.
     */
    placeholderData: (previous: MetricSeries[] | undefined): MetricSeries[] | undefined => previous,
    queryFn: ({ signal }) => rangeMetricsApi(api).cluster({
      cluster, metrics: [resource.metric, resource.capacity], start: resolved.start, end: resolved.end, step: resolved.step, signal,
    }),
  });
  /*
   * Whether the current read is the reader's or the page's timer.
   *
   * Two entry points start the same reads: this panel's own 刷新 and the page
   * header's. The page reports the header click through `manualRefresh`; the panel
   * reports its own through `ownRefresh`. Either one means "a person asked", and
   * both must veil the plot — the same action cannot behave two ways depending on
   * which button was clicked.
   *
   * The timer (`refreshAt` moving) sets neither, so the line animates to the new
   * shape with no veil.
   */
  const [ownRefresh, setOwnRefresh] = React.useState(false);
  const refreshNow = React.useCallback(() => {
    setOwnRefresh(true);
    void trends.refetch().finally(() => setOwnRefresh(false));
  }, [trends]);
  const isManualRefresh = ownRefresh || manualRefresh === true;
  const points = React.useMemo(() => overviewRatioPoints(trends.data ?? [], resource.metric, resource.capacity),
    [trends.data, resource.metric, resource.capacity]);
  const title = `${t(resource.label)} · ${t('cluster.overview.trend')}`;
  const prefix = 'overview:trend';
  const chartLabels = React.useMemo(() => chartPanelLabels(t), [t]);
  const trendState: 'loading' | 'refreshing' | 'ready' | 'error' | 'empty' = trends.isPending
    ? 'loading'
    : trends.isError
      ? 'error'
      : points.length === 0
        ? 'empty'
        : trends.isFetching
          ? 'refreshing'
          : 'ready';
  return <Panel title={t('cluster.overview.resourceOverview')} icon="computing" titleLevel={2}
    data-ai-id="overview:usage" aria-busy={usage.isFetching} className="min-w-0"
    actions={<span className="hidden text-xs text-ai-fg-muted sm:inline">{t('cluster.overview.selectTrend')}</span>}>
    {usage.isError ? <p role="alert" data-ai-id="overview:no-metrics" className="mb-3 text-sm text-ai-warning">
      {t('cluster.overview.noMetrics')}{usage.data ? ` · ${t('cluster.overview.staleValues')}` : ''}
    </p> : null}
    {usage.isPending ? <Skeleton className="h-72" /> : usage.data ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {resources.map((entry) => <ResourceMetricCard key={entry.key} entry={entry} data={usage.data}
        active={entry.key === resource.key} onSelect={() => setSelected(entry.key)} />)}
    </div> : null}
    {usage.data ? <div
      className="mt-4 border-t border-ai-line pt-3"
      data-ai-id={`${prefix}-panel`}
      /*
       * The panel's state stays on this wrapper: it is the handle the page's
       * automation and the older tests address, and it answers "does this section
       * have data" — which the chart's own state also answers, but from a node that
       * only exists once the plot has been laid out.
       */
      data-ai-state={trendState === 'refreshing' ? 'ready' : trendState}
    >
      {/*
        * `ChartPanel` owns the window picker, the refresh and the fixed-height plot.
        *
        * The previous version had three problems the reader could see: the plot grew
        * after its first paint (a `Skeleton` of a different height was swapped for the
        * chart), the refresh replaced the whole chart with a skeleton, and the window
        * was three buttons rather than the shared picker every other monitoring page
        * uses.
        */}
      <ChartPanel
        aiId={prefix}
        title={title}
        series={[{ key: title, label: title, points, area: true, smooth: true }]}
        range={range}
        onRangeChange={setRange}
        start={resolved.start}
        end={resolved.end}
        step={resolved.step}
        labels={chartLabels}
        state={trendState}
        onRetry={() => void trends.refetch()}
        onRefresh={refreshNow}
        manualRefresh={isManualRefresh}
        height={180}
        yDomain={[0, Math.max(100, ...points.map((point) => point.value))]}
        formatValue={(value) => `${Math.round(value)}%`}
        formatAxis={(value) => `${Math.round(value)}%`}
        formatTime={(at) => new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
        className="border-0 bg-transparent p-0"
      />
    </div> : null}
  </Panel>;
}
