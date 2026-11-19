import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { rangeMetricsApi } from '@kube-ai-hub/api-client';
import { ChartPanel, presetRange, resolveRange, type ChartPanelLabels, type TimeRange } from '@kube-ai-hub/ui/charts';
import { api } from '@/api';
import { useT } from '@/i18n';
import { chartPanelLabels } from './OverviewResourcePanel';

const CHARTS = [
  { key: 'utilisation', metric: 'gpu_card_utilisation', unit: '%' },
  { key: 'memory', metric: 'gpu_card_memory_usage', unit: 'GiB' },
  { key: 'allocation', metric: 'gpu_card_allocation_rate', unit: '%' },
  { key: 'power', metric: 'gpu_card_power', unit: 'W' },
  { key: 'temperature', metric: 'gpu_card_temperature', unit: 'C' },
] as const;

/**
 * One GPU card's five metrics, in the shared chart panel.
 *
 * The panel is what gives each card the standard first load (a skeleton shaped like a
 * plot) and the standard refresh (a veil over the previous curve). A bare
 * `<TimeSeriesChart>` had neither: the container only set `aria-busy`, so a slow
 * refresh looked like a button that did nothing.
 */
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
  /*
   * The reader's refresh only — this panel has no timer, but the rule stays the same
   * everywhere: a veil means a person asked, never a clock.
   */
  const [ownRefresh, setOwnRefresh] = React.useState(false);
  const refreshNow = React.useCallback(() => {
    setOwnRefresh(true);
    void query.refetch().finally(() => setOwnRefresh(false));
  }, [query]);
  const byName = new Map((query.data ?? []).map((series) => [series.name, series.points]));
  const state: 'loading' | 'refreshing' | 'ready' | 'error' =
    query.isPending ? 'loading' : query.isError ? 'error' : query.isFetching ? 'refreshing' : 'ready';
  const labels = React.useMemo<ChartPanelLabels>(() => chartPanelLabels(t), [t]);
  return <div data-ai-id="gpu-detail:monitor" className="flex flex-col gap-3">
    <p className="text-xs text-ai-fg-muted">{t('gpu.monitor.hint')}</p>
    <div className="grid gap-3 xl:grid-cols-2">{CHARTS.map((chart) => {
      const raw = byName.get(chart.metric) ?? [];
      const points = raw.map((point) => ({ at: point.at, value: chart.key === 'memory' ? point.value / 1024 ** 3 : point.value }));
      const format = (value: number) => `${value.toFixed(2)} ${chart.unit}`;
      return <ChartPanel
        key={chart.key}
        aiId={`gpu-detail:metric:${chart.key}`}
        title={`${t(`gpu.monitor.${chart.key}`)} (${chart.unit})`}
        series={[{ key: chart.key, label: t(`gpu.monitor.${chart.key}`), points, area: true, smooth: true }]}
        range={range}
        onRangeChange={setRange}
        start={resolved.start}
        end={resolved.end}
        step={resolved.step}
        labels={labels}
        state={state}
        onRetry={() => void query.refetch()}
        onRefresh={refreshNow}
        manualRefresh={ownRefresh}
        height={140}
        formatValue={format}
      />;
    })}</div>
  </div>;
}
