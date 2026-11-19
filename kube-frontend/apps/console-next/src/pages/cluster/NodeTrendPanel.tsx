import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { rangeMetricsApi } from '@kube-ai-hub/api-client';
import { Button, Select, Skeleton } from '@kube-ai-hub/ui';
import { TimeRangePicker, TimeSeriesChart, presetRange, resolveRange, gapForStep, type TimeRange } from '@kube-ai-hub/ui/charts';
import { api } from '@/api';
import { useT } from '@/i18n';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';

const CHARTS = [
  { key: 'gpu', metric: 'node_gpu_utilisation', label: 'node.list.gpu', ratio: true },
  { key: 'gpuMemory', metric: 'node_gpu_memory_utilisation', label: 'node.list.gpuMemory', ratio: true },
  { key: 'gpuAllocated', metric: 'node_gpu_allocated', label: 'node.trend.gpuAllocated', ratio: false },
  { key: 'cpu', metric: 'node_cpu_utilisation', label: 'cluster.column.cpuUsage', ratio: true },
  { key: 'memory', metric: 'node_memory_utilisation', label: 'cluster.column.memoryUsage', ratio: true },
  { key: 'pods', metric: 'node_pod_utilisation', label: 'cluster.workloads.pods.title', ratio: true },
  { key: 'disk', metric: 'node_disk_size_utilisation', label: 'node.trend.disk', ratio: true },
] as const;

export function NodeTrendPanel({ cluster, node, gpu, all = false }: { cluster: string; node: string; gpu: boolean; all?: boolean }): React.ReactElement {
  const t = useT();
  const charts = gpu ? CHARTS : CHARTS.slice(3);
  const [selected, setSelected] = React.useState(gpu ? 'gpu' : 'cpu');
  /*
   * The window is the shared range control, not four fixed buttons: a reader
   * investigating a spike needs "last 10 minutes" as often as "last hour", and the
   * custom span is what makes a post-incident review reproducible.
   */
  const [range, setRange] = React.useState<TimeRange>(() => presetRange('1h'));
  const resolved = React.useMemo(() => resolveRange(range), [range]);
  const shown = all ? charts : charts.filter((chart) => chart.key === selected);
  const query = useQuery({
    queryKey: ['node-trend', cluster, node, all, selected, range.kind === 'relative' ? range.key : 'custom', resolved.start, resolved.end],
    queryFn: ({ signal }) => rangeMetricsApi(api).cluster({
      cluster, scope: 'node', node, metrics: shown.map((chart) => chart.metric),
      start: resolved.start, end: resolved.end, step: resolved.step, signal,
    }), retry: false, staleTime: 60_000,
  });
  return <section className="rounded-ai-lg border border-ai-line bg-ai-surface-1 p-4"
    data-ai-id={all ? 'node-detail:monitor' : 'node-detail:trend'} data-ai-state={query.isPending ? 'loading' : query.isError ? 'error' : 'ready'}>
    <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold">{t('node.trend.title')}</h2>
      <div className="flex flex-wrap items-center gap-2">
        {!all ? <Select value={selected} aria-label={t('node.trend.metric')} data-ai-id="node-detail:trend-select"
          options={charts.map((chart) => ({ value: chart.key, label: t(chart.label) }))} onValueChange={setSelected} className="w-40" /> : null}
        <TimeRangePicker
          value={range}
          onChange={setRange}
          presets={[
            { key: '1h', ms: 3_600_000, label: t('cluster.monitor.range.1h') },
            { key: '6h', ms: 21_600_000, label: t('cluster.monitor.range.6h') },
            { key: '24h', ms: 86_400_000, label: t('cluster.monitor.range.24h') },
            { key: '7d', ms: 604_800_000, label: t('cluster.monitor.range.7d') },
          ]}
          labels={{
            placeholder: t('cluster.monitor.range.1h'),
            custom: t('cluster.monitor.rangeCustom'),
            rangePlaceholder: t('cluster.monitor.rangePlaceholder'),
            step: t('cluster.monitor.step'),
            stepHint: t('cluster.monitor.stepHint'),
            stepOptions: [],
            cancel: t('common.cancel'),
            confirm: t('common.confirm'),
            invalid: t('cluster.monitor.rangeInvalid'),
          }}
          aiId="node-detail:trend-range"
        />
        <Button size="sm" variant="ghost" disabled={query.isFetching} aria-busy={query.isFetching}
          data-ai-id="node-detail:trend-refresh" onClick={() => void query.refetch()}>{t('common.refresh')}</Button>
      </div>
    </header>
    {query.isPending ? <Skeleton className="h-32" /> : query.isError ?
      <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="node-detail:trend-retry" /> :
      <div className={all ? 'grid gap-4 xl:grid-cols-2' : ''}>{shown.map((chart) => {
        const raw = query.data?.find((series) => series.name === chart.metric)?.points ?? [];
        const points = raw.map((point) => ({ ...point, value: chart.ratio ? point.value * 100 : point.value }));
        const latest = points.at(-1)?.value;
        return <div key={chart.key} data-ai-id={`node-detail:chart:${chart.key}`}>
          <div className="mb-2 flex justify-between text-xs">
            <span>{t(chart.label)}</span><span className="tabular-nums">{latest === undefined ? '-' : `${latest.toFixed(1)} ${chart.ratio ? '%' : t('node.list.cards')}`}</span>
          </div>
          <TimeSeriesChart
            series={[{ key: chart.key, label: t(chart.label), points, area: true, smooth: true }]}
            start={resolved.start}
            end={resolved.end}
            maxGap={gapForStep(resolved.step)}
            label={t(chart.label)}
            emptyText={t('cluster.monitor.empty')}
            height={140}
          />
        </div>;
      })}</div>}
  </section>;
}
