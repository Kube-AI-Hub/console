import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { rangeMetricsApi } from '@kube-ai-hub/api-client';
import { Select } from '@kube-ai-hub/ui';
import { ChartPanel, presetRange, resolveRange, type ChartPanelLabels, type TimeRange } from '@kube-ai-hub/ui/charts';
import { api } from '@/api';
import { useT } from '@/i18n';
import { chartPanelLabels } from './OverviewResourcePanel';

const CHARTS = [
  { key: 'gpu', metric: 'node_gpu_utilisation', label: 'node.list.gpu', ratio: true },
  { key: 'gpuMemory', metric: 'node_gpu_memory_utilisation', label: 'node.list.gpuMemory', ratio: true },
  { key: 'gpuAllocated', metric: 'node_gpu_allocated', label: 'node.trend.gpuAllocated', ratio: false },
  { key: 'cpu', metric: 'node_cpu_utilisation', label: 'cluster.column.cpuUsage', ratio: true },
  { key: 'memory', metric: 'node_memory_utilisation', label: 'cluster.column.memoryUsage', ratio: true },
  { key: 'pods', metric: 'node_pod_utilisation', label: 'cluster.workloads.pods.title', ratio: true },
  { key: 'disk', metric: 'node_disk_size_utilisation', label: 'node.trend.disk', ratio: true },
] as const;

/**
 * One node's trend, in the shared chart panel.
 *
 * The panel — not a hand-built section — is what makes the first load a skeleton
 * shaped like a plot, a refresh a veil over the previous curve, and the window picker
 * the same control every other monitoring surface uses. A bare `<TimeSeriesChart>`
 * here used to show a single grey block while loading and no feedback at all while
 * refreshing.
 */
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
  /*
   * The reader's refresh only. This panel has no timer, so every fetch after the first
   * is a click — but saying it with a flag keeps the rule the same everywhere: a veil
   * means a person asked, never a clock.
   */
  const [ownRefresh, setOwnRefresh] = React.useState(false);
  const refreshNow = React.useCallback(() => {
    setOwnRefresh(true);
    void query.refetch().finally(() => setOwnRefresh(false));
  }, [query]);
  const state: 'loading' | 'refreshing' | 'ready' | 'error' =
    query.isPending ? 'loading' : query.isError ? 'error' : query.isFetching ? 'refreshing' : 'ready';
  const labels = React.useMemo<ChartPanelLabels>(() => chartPanelLabels(t), [t]);
  const pointsOf = (chart: (typeof CHARTS)[number]) =>
    (query.data?.find((series) => series.name === chart.metric)?.points ?? [])
      .map((point) => ({ at: point.at, value: chart.ratio ? point.value * 100 : point.value }));

  if (all) {
    return <div className="grid gap-4 xl:grid-cols-2" data-ai-id="node-detail:monitor">
      {charts.map((chart) => (
        <ChartPanel
          key={chart.key}
          aiId={`node-detail:chart:${chart.key}`}
          title={t(chart.label)}
          series={[{ key: chart.key, label: t(chart.label), points: pointsOf(chart), area: true, smooth: true }]}
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
          formatValue={(value) => `${value.toFixed(1)}${chart.ratio ? '%' : ''}`}
        />
      ))}
    </div>;
  }

  const chart = charts.find((entry) => entry.key === selected) ?? charts[0]!;
  return <ChartPanel
    aiId="node-detail:trend"
    title={t('node.trend.title')}
    series={[{ key: chart.key, label: t(chart.label), points: pointsOf(chart), area: true, smooth: true }]}
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
    height={180}
    formatValue={(value) => `${value.toFixed(1)}${chart.ratio ? '%' : ` ${t('node.list.cards')}`}`}
    actions={<Select value={selected} aria-label={t('node.trend.metric')} data-ai-id="node-detail:trend-select"
      options={charts.map((entry) => ({ value: entry.key, label: t(entry.label) }))} onValueChange={setSelected} className="w-40" />}
  />;
}
