import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { clusterMetricsApi, rangeMetricsApi, type ClusterUsage } from '@kube-ai-hub/api-client';
import { Button, Card, Icon, MetricRing, Skeleton, TrendChart, cn, useSpotlight } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { api } from '@/api';
import { useT } from '@/i18n';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import {
  OVERVIEW_RESOURCES, OVERVIEW_WINDOWS, formatOverviewValue, overviewRatio, overviewRatioPoints,
  type OverviewResource, type OverviewWindow,
} from './overviewResourceMetrics';

function ResourceMetricCard({ entry, data, active, onSelect, nodeOnly }: {
  entry: (typeof OVERVIEW_RESOURCES)[number]; data: ClusterUsage; active: boolean;
  onSelect: () => void; nodeOnly: boolean;
}): React.ReactElement {
  const t = useT();
  const spotlight = useSpotlight<HTMLDivElement>();
  const description = React.useId();
  const ratio = overviewRatio(data[entry.used], data[entry.total]);
  const allocated = 'allocated' in entry ? formatOverviewValue(data[entry.allocated], entry.unit, t('node.list.cards')) : undefined;
  return <div ref={spotlight.ref} className="min-w-0">
    <Card interactive={!nodeOnly} {...actionProps(`overview:usage-${entry.key}`)}
      role={nodeOnly ? undefined : 'button'} tabIndex={nodeOnly ? undefined : 0}
      aria-label={nodeOnly ? undefined : t(entry.label)} aria-describedby={nodeOnly ? undefined : description}
      aria-pressed={nodeOnly ? undefined : active}
      onPointerMove={nodeOnly ? undefined : spotlight.onPointerMove}
      onClick={nodeOnly ? undefined : onSelect}
      onKeyDown={nodeOnly ? undefined : (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(); }
      }}
      className={cn('relative grid min-w-0 gap-1 rounded-ai-md p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-ring',
        nodeOnly ? 'grid-rows-[1.75rem_3.25rem_1.25rem] bg-ai-surface-2' :
          'grid-rows-[1.75rem_2.75rem_1.25rem_1.25rem]',
        !nodeOnly && active ? 'border-ai-accent/50 bg-ai-accent/5' : 'border-ai-line bg-ai-surface-2')}>
      <div className="flex items-center text-sm font-medium text-ai-fg" data-ai-field="name"
        {...(!nodeOnly ? actionProps(`overview:select-resource:${entry.key}`) : {})}>{t(entry.label)}</div>
      <dl id={description} className="contents">
        <div className="grid grid-cols-2 gap-2 pr-16">
          <div><dt className="text-[10px] text-ai-fg-secondary">{t(nodeOnly ? 'cluster.overview.readyNodes' : 'cluster.overview.used')}</dt>
            <dd className={cn('mt-1 whitespace-nowrap font-semibold tabular-nums', nodeOnly ? 'text-2xl' : 'text-base')} data-ai-field="used">{formatOverviewValue(data[entry.used], entry.unit, t('node.list.cards'))}</dd></div>
          <div><dt className="text-[10px] text-ai-fg-secondary">{t('cluster.overview.total')}</dt>
            <dd className={cn('mt-1 whitespace-nowrap font-semibold tabular-nums', nodeOnly ? 'text-2xl' : 'text-base')} data-ai-field="total">{formatOverviewValue(data[entry.total], entry.unit, t('node.list.cards'))}</dd></div>
        </div>
        <div className="flex items-center gap-2 text-xs text-ai-fg-secondary">
          {t(nodeOnly ? 'cluster.overview.nodeReadyRate' : 'cluster.overview.usageRate')}<span className="font-medium tabular-nums text-ai-fg" data-ai-field="ratio">{ratio === undefined ? '-' : `${Math.round(ratio * 100)}%`}</span>
        </div>
        <div className={nodeOnly ? 'sr-only' : 'text-xs text-ai-fg-secondary'} data-ai-field="allocated">
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

export function OverviewResourcePanel({ cluster, refreshAt, nodeOnly = false }: {
  cluster: string; refreshAt: number; nodeOnly?: boolean;
}): React.ReactElement {
  const t = useT();
  const [selected, setSelected] = React.useState<OverviewResource>(nodeOnly ? 'nodes' : 'gpu-memory');
  const [windowKey, setWindowKey] = React.useState<OverviewWindow>('1h');
  const usage = useQuery({
    queryKey: ['cluster-usage', cluster], retry: false, staleTime: 30_000,
    refetchOnWindowFocus: false, refetchOnReconnect: false,
    queryFn: ({ signal }) => clusterMetricsApi(api).usage({ cluster, signal }),
  });
  const resources = OVERVIEW_RESOURCES.filter((resource) => (nodeOnly ? resource.key === 'nodes' : resource.key !== 'nodes') &&
    (!('gpu' in resource) || usage.data?.gpuTotal !== 0));
  const resource = resources.find((entry) => entry.key === selected) ?? resources[0]!;
  const window = OVERVIEW_WINDOWS.find((entry) => entry.key === windowKey)!;
  const start = refreshAt - window.ms;
  const trends = useQuery({
    queryKey: ['overview-trends', cluster, resource.key, windowKey, start, refreshAt],
    enabled: !nodeOnly && Boolean(usage.data), retry: false, staleTime: 30_000, refetchOnWindowFocus: false, refetchOnReconnect: false,
    queryFn: ({ signal }) => rangeMetricsApi(api).cluster({
      cluster, metrics: [resource.metric, resource.capacity], start, end: refreshAt, step: window.step, signal,
    }),
  });
  const points = React.useMemo(() => overviewRatioPoints(trends.data ?? [], resource.metric, resource.capacity),
    [trends.data, resource.metric, resource.capacity]);
  const title = `${t(resource.label)} · ${t('cluster.overview.trend')}`;
  const prefix = 'overview:trend';
  return <section className={cn('min-w-0 rounded-ai-lg border border-ai-line bg-ai-surface-1 p-4', nodeOnly && 'h-full')}
    data-ai-id={nodeOnly ? 'overview:node-summary' : 'overview:usage'} aria-busy={usage.isFetching}>
    <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><Icon name={nodeOnly ? 'nodes' : 'computing'} size={18} />{t(nodeOnly ? 'cluster.overview.nodeCount' : 'cluster.overview.resourceOverview')}</h2>
      {!nodeOnly ? <span className="text-xs text-ai-fg-muted">{t('cluster.overview.selectTrend')}</span> : null}
    </header>
    {usage.isError ? <p role="alert" data-ai-id={nodeOnly ? 'overview:no-node-metrics' : 'overview:no-metrics'} className="mb-3 text-sm text-ai-warning">
      {t('cluster.overview.noMetrics')}{usage.data ? ` · ${t('cluster.overview.staleValues')}` : ''}
    </p> : null}
    {usage.isPending ? <Skeleton className={nodeOnly ? 'h-36' : 'h-72'} /> : usage.data ? <div className={nodeOnly ? 'min-w-0' : 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'}>
      {resources.map((entry) => <ResourceMetricCard key={entry.key} entry={entry} data={usage.data} nodeOnly={nodeOnly}
        active={entry.key === resource.key} onSelect={() => setSelected(entry.key)} />)}
    </div> : null}
    {!nodeOnly && usage.data ? <div className="mt-4 border-t border-ai-line pt-3" data-ai-id={`${prefix}-panel`}
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
  </section>;
}
