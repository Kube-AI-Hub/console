import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { rangeMetricsApi } from '@kube-ai-hub/api-client';
import { Button, Skeleton, TrendChart } from '@kube-ai-hub/ui';
import { api } from '@/api';
import { useT } from '@/i18n';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';

const WINDOWS = [
  { key: '1h', ms: 3_600_000, step: '60s', gap: 120_000 },
  { key: '6h', ms: 21_600_000, step: '5m', gap: 600_000 },
  { key: '24h', ms: 86_400_000, step: '15m', gap: 1_800_000 },
] as const;
const CHARTS = [
  { key: 'utilisation', metric: 'gpu_card_utilisation', unit: '%' },
  { key: 'memory', metric: 'gpu_card_memory_usage', unit: 'GiB' },
  { key: 'allocation', metric: 'gpu_card_allocation_rate', unit: '%' },
  { key: 'power', metric: 'gpu_card_power', unit: 'W' },
  { key: 'temperature', metric: 'gpu_card_temperature', unit: 'C' },
] as const;

export function GpuMonitorPanel({ cluster, node, uuid }: { cluster: string; node: string; uuid: string }): React.ReactElement {
  const t = useT();
  const [windowKey, setWindowKey] = React.useState<string>('1h');
  const [end, setEnd] = React.useState(() => Math.floor(Date.now() / 1000) * 1000);
  const window = WINDOWS.find((entry) => entry.key === windowKey) ?? WINDOWS[0];
  const start = end - window.ms;
  const query = useQuery({
    queryKey: ['gpu-card-monitor', cluster, node, uuid, windowKey, end],
    queryFn: ({ signal }) => rangeMetricsApi(api).gpuCard({
      cluster, node, uuid, metrics: CHARTS.map((chart) => chart.metric), start, end, step: window.step, signal,
    }),
    retry: false, staleTime: 60_000,
  });
  const byName = new Map((query.data ?? []).map((series) => [series.name, series.points]));
  return <div data-ai-id="gpu-detail:monitor" aria-busy={query.isFetching} className="flex flex-col gap-3">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-ai-fg-muted">{t('gpu.monitor.hint')}</p>
      <div className="flex gap-1">{WINDOWS.map((entry) => <Button key={entry.key} size="sm"
        variant={windowKey === entry.key ? 'primary' : 'secondary'} aria-pressed={windowKey === entry.key}
        data-ai-id={`gpu-detail:range:${entry.key}`}
        onClick={() => { setWindowKey(entry.key); setEnd(Math.floor(Date.now() / 1000) * 1000); }}>
        {t(`cluster.monitor.range.${entry.key}`)}
      </Button>)}
        <Button size="sm" variant="secondary" disabled={query.isFetching} data-ai-id="gpu-detail:monitor-refresh"
          onClick={() => {
            const now = Math.floor(Date.now() / 1000) * 1000;
            if (now === end) void query.refetch(); else setEnd(now);
          }}>{t('common.refresh')}</Button>
      </div>
    </header>
    {query.isPending ? <Skeleton className="h-48" /> : query.isError ?
      <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="gpu-detail:monitor-retry" /> :
      <div className="grid gap-3 xl:grid-cols-2">{CHARTS.map((chart) => {
        const raw = byName.get(chart.metric) ?? [];
        const points = raw.map((point) => ({ ...point, value: chart.key === 'memory' ? point.value / 1024 ** 3 : point.value }));
        const latest = points.at(-1)?.value;
        const format = (value: number) => `${value.toFixed(2)} ${chart.unit}`;
        return <section key={chart.key} className="rounded-ai-lg border border-ai-line bg-ai-surface-1 p-4"
          data-ai-id={`gpu-detail:metric:${chart.key}`} data-ai-points={points.length}>
          <header className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="text-sm text-ai-fg">{t(`gpu.monitor.${chart.key}`)}</h3>
            <span className="text-xs tabular-nums text-ai-fg-secondary" data-ai-id={`gpu-detail:metric:${chart.key}:latest`}>
              {latest === undefined ? '-' : format(latest)}
            </span>
          </header>
          <TrendChart points={points} start={start} end={end} maxGap={window.gap}
            label={`${t(`gpu.monitor.${chart.key}`)} (${chart.unit})`} emptyText={t('cluster.monitor.empty')} />
          {points.length > 0 ? <p className="mt-2 text-xs text-ai-fg-muted">
            {t('cluster.monitor.min')}: {format(Math.min(...points.map((point) => point.value)))} · {t('cluster.monitor.max')}: {format(Math.max(...points.map((point) => point.value)))}
          </p> : null}
        </section>;
      })}</div>}
  </div>;
}
