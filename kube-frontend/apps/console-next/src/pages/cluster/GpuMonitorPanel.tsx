import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { rangeMetricsApi } from '@kube-ai-hub/api-client';
import { Button, Skeleton } from '@kube-ai-hub/ui';
import { TimeRangePicker, TimeSeriesChart, gapForStep, presetRange, resolveRange, type TimeRange } from '@kube-ai-hub/ui/charts';
import { api } from '@/api';
import { useT } from '@/i18n';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';

const CHARTS = [
  { key: 'utilisation', metric: 'gpu_card_utilisation', unit: '%' },
  { key: 'memory', metric: 'gpu_card_memory_usage', unit: 'GiB' },
  { key: 'allocation', metric: 'gpu_card_allocation_rate', unit: '%' },
  { key: 'power', metric: 'gpu_card_power', unit: 'W' },
  { key: 'temperature', metric: 'gpu_card_temperature', unit: 'C' },
] as const;

export function GpuMonitorPanel({ cluster, node, uuid }: { cluster: string; node: string; uuid: string }): React.ReactElement {
  const t = useT();
  /* The shared range control, not three fixed buttons: a spike needs 10 minutes. */
  const [range, setRange] = React.useState<TimeRange>(() => presetRange('1h'));
  const resolved = React.useMemo(() => resolveRange(range), [range]);
  const query = useQuery({
    queryKey: ['gpu-card-monitor', cluster, node, uuid, range.kind === 'relative' ? range.key : 'custom', resolved.start, resolved.end],
    queryFn: ({ signal }) => rangeMetricsApi(api).gpuCard({
      cluster, node, uuid, metrics: CHARTS.map((chart) => chart.metric),
      start: resolved.start, end: resolved.end, step: resolved.step, signal,
    }),
    retry: false, staleTime: 60_000,
  });
  const byName = new Map((query.data ?? []).map((series) => [series.name, series.points]));
  return <div data-ai-id="gpu-detail:monitor" aria-busy={query.isFetching} className="flex flex-col gap-3">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-ai-fg-muted">{t('gpu.monitor.hint')}</p>
      <div className="flex flex-wrap items-center gap-2">
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
          aiId="gpu-detail:range"
        />
        <Button size="sm" variant="ghost" loading={query.isFetching} data-ai-id="gpu-detail:monitor-refresh"
          onClick={() => void query.refetch()}>{t('common.refresh')}</Button>
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
          <TimeSeriesChart
            series={[{ key: chart.key, label: t(`gpu.monitor.${chart.key}`), points, area: true, smooth: true }]}
            start={resolved.start}
            end={resolved.end}
            maxGap={gapForStep(resolved.step)}
            label={`${t(`gpu.monitor.${chart.key}`)} (${chart.unit})`}
            emptyText={t('cluster.monitor.empty')}
            height={140}
            formatValue={format}
          />
          {points.length > 0 ? <p className="mt-2 text-xs text-ai-fg-muted">
            {t('cluster.monitor.min')}: {format(Math.min(...points.map((point) => point.value)))} · {t('cluster.monitor.max')}: {format(Math.max(...points.map((point) => point.value)))}</p> : null}
        </section>;
      })}</div>}
  </div>;
}
