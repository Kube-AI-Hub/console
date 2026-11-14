import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { rangeMetricsApi } from '@kube-ai-hub/api-client';
import { Button, Select, Skeleton, TrendChart } from '@kube-ai-hub/ui';
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
const WINDOWS = [
  { value: '1h', ms: 3_600_000, step: '60s', gap: 120_000 },
  { value: '6h', ms: 21_600_000, step: '5m', gap: 600_000 },
  { value: '24h', ms: 86_400_000, step: '15m', gap: 1_800_000 },
] as const;

export function NodeTrendPanel({ cluster, node, gpu, all = false }: { cluster: string; node: string; gpu: boolean; all?: boolean }): React.ReactElement {
  const t = useT();
  const charts = gpu ? CHARTS : CHARTS.slice(3);
  const [selected, setSelected] = React.useState(gpu ? 'gpu' : 'cpu');
  const [windowKey, setWindowKey] = React.useState('1h');
  const [end, setEnd] = React.useState(() => Math.floor(Date.now() / 1000) * 1000);
  const window = WINDOWS.find((entry) => entry.value === windowKey) ?? WINDOWS[0];
  const shown = all ? charts : charts.filter((chart) => chart.key === selected);
  const query = useQuery({
    queryKey: ['node-trend', cluster, node, all, selected, windowKey, end],
    queryFn: ({ signal }) => rangeMetricsApi(api).cluster({
      cluster, scope: 'node', node, metrics: shown.map((chart) => chart.metric),
      start: end - window.ms, end, step: window.step, signal,
    }), retry: false, staleTime: 60_000,
  });
  return <section className="rounded-ai-lg border border-ai-line bg-ai-surface-1 p-4"
    data-ai-id={all ? 'node-detail:monitor' : 'node-detail:trend'} data-ai-state={query.isPending ? 'loading' : query.isError ? 'error' : 'ready'}>
    <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold">{t('node.trend.title')}</h2>
      <div className="flex items-center gap-2">
        {!all ? <Select value={selected} aria-label={t('node.trend.metric')} data-ai-id="node-detail:trend-select"
          options={charts.map((chart) => ({ value: chart.key, label: t(chart.label) }))} onValueChange={setSelected} className="w-40" /> : null}
        <Select value={windowKey} aria-label={t('node.trend.range')} data-ai-id="node-detail:trend-range" className="w-32"
          options={WINDOWS.map((entry) => ({ value: entry.value, label: t(`cluster.monitor.range.${entry.value}`) }))}
          onValueChange={(value) => { setWindowKey(value); setEnd(Math.floor(Date.now() / 1000) * 1000); }} />
        <Button size="sm" variant="ghost" disabled={query.isFetching} aria-busy={query.isFetching}
          data-ai-id="node-detail:trend-refresh" onClick={() => {
            const now = Math.floor(Date.now() / 1000) * 1000;
            if (now === end) void query.refetch(); else setEnd(now);
          }}>{t('common.refresh')}</Button>
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
          <TrendChart points={points} start={end - window.ms} end={end} maxGap={window.gap}
            label={t(chart.label)} emptyText={t('cluster.monitor.empty')} />
        </div>;
      })}</div>}
  </section>;
}
