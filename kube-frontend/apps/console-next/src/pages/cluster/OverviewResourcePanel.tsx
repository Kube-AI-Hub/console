import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { clusterMetricsApi, rangeMetricsApi, type ClusterUsage } from '@kube-ai-hub/api-client';
import { Button, Card, Icon, MetricRing, Panel, Progress, Skeleton, TrendChart, cn, useSpotlight } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { api } from '@/api';
import { useT } from '@/i18n';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import {
  OVERVIEW_RESOURCES, OVERVIEW_WINDOWS, formatOverviewValue, overviewRatio, overviewRatioPoints,
  type OverviewResource, type OverviewWindow,
} from './overviewResourceMetrics';

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

export function OverviewResourcePanel({ cluster, refreshAt }: {
  cluster: string; refreshAt: number;
}): React.ReactElement {
  const t = useT();
  const [selected, setSelected] = React.useState<OverviewResource>('gpu-memory');
  const [windowKey, setWindowKey] = React.useState<OverviewWindow>('1h');
  const usage = useQuery({
    queryKey: ['cluster-usage', cluster], retry: false, staleTime: 30_000,
    refetchOnWindowFocus: false, refetchOnReconnect: false,
    queryFn: ({ signal }) => clusterMetricsApi(api).usage({ cluster, signal }),
  });
  const resources = OVERVIEW_RESOURCES.filter((resource) => resource.key !== 'nodes' &&
    (!('gpu' in resource) || usage.data?.gpuTotal !== 0));
  const resource = resources.find((entry) => entry.key === selected) ?? resources[0]!;
  const window = OVERVIEW_WINDOWS.find((entry) => entry.key === windowKey)!;
  const start = refreshAt - window.ms;
  const trends = useQuery({
    queryKey: ['overview-trends', cluster, resource.key, windowKey, start, refreshAt],
    enabled: Boolean(usage.data), retry: false, staleTime: 30_000, refetchOnWindowFocus: false, refetchOnReconnect: false,
    queryFn: ({ signal }) => rangeMetricsApi(api).cluster({
      cluster, metrics: [resource.metric, resource.capacity], start, end: refreshAt, step: window.step, signal,
    }),
  });
  const points = React.useMemo(() => overviewRatioPoints(trends.data ?? [], resource.metric, resource.capacity),
    [trends.data, resource.metric, resource.capacity]);
  const title = `${t(resource.label)} · ${t('cluster.overview.trend')}`;
  const prefix = 'overview:trend';
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
    {usage.data ? <div className="mt-4 border-t border-ai-line pt-3" data-ai-id={`${prefix}-panel`}
      data-ai-state={trends.isPending ? 'loading' : trends.isError ? 'error' : points.length ? 'ready' : 'empty'}>
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-medium text-ai-fg-secondary">{title}</h3>
        <div className="flex gap-1">{OVERVIEW_WINDOWS.map((entry) => <Button key={entry.key} size="sm"
          variant={entry.key === windowKey ? 'primary' : 'ghost'} aria-pressed={entry.key === windowKey}
          aria-label={t(`cluster.monitor.range.${entry.key}`)}
          {...actionProps(`${prefix}-range:${entry.key}`)} onClick={() => setWindowKey(entry.key)}>
          {t(`cluster.monitor.range.${entry.key}`)}
        </Button>)}</div>
      </header>
      {trends.isPending ? <Skeleton className="h-28" /> : trends.isError ?
        <ResourceErrorPanel error={trends.error} onRetry={() => void trends.refetch()} retryAiId={`${prefix}-retry`} /> :
        <TrendChart points={points} start={start} end={refreshAt} maxGap={window.gap} label={title}
          emptyText={t('cluster.overview.emptyTrend')} interactive showAxes showGrid area
          yDomain={[0, Math.max(100, ...points.map((point) => point.value))]}
          formatValue={(value) => `${Math.round(value)}%`}
          formatTime={(at) => new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          data-ai-id={`${prefix}-chart`} />}
    </div> : null}
  </Panel>;
}
