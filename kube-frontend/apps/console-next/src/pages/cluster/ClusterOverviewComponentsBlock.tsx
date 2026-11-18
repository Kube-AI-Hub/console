import * as React from 'react';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { Button, Skeleton, TREND_SERIES_COLORS, TrendChart, type TrendSeries } from '@kube-ai-hub/ui';
import type { LocaleKey } from '@kube-ai-hub/locales';
import { useT } from '@/i18n';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { toComponentCharts, useComponentMetrics, type ComponentChart } from './componentMonitorQueries';
import { formatComponentValue } from './monitorFormat';

/**
 * 服务组件监控: the old overview's fourth block, restored.
 *
 * The old console previewed the control plane from the overview — APIServer request
 * latency (split by verb) and rate, scheduler attempts and attempt rate — with the full
 * pages one click away. The tabbed rewrite dropped the block entirely, which made the
 * overview answer "how busy" but not "is the control plane degrading".
 *
 * Each tab renders one chart from the same component reads the dedicated tabs use, so a
 * series identity (verb / result) is merged the same way in both places.
 */

interface ComponentsTabSpec {
  key: string;
  labelKey: LocaleKey;
  component: 'apiserver' | 'scheduler';
  /** The chart key inside `COMPONENT_CHARTS`. */
  chartKey: string;
}

export const COMPONENTS_TABS: readonly ComponentsTabSpec[] = [
  { key: 'latency', labelKey: 'cluster.monitor.component.requestLatency', component: 'apiserver', chartKey: 'requestLatency' },
  { key: 'requestRate', labelKey: 'cluster.monitor.component.requestRate', component: 'apiserver', chartKey: 'requestRate' },
  { key: 'attempts', labelKey: 'cluster.monitor.component.scheduleAttempts', component: 'scheduler', chartKey: 'scheduleAttempts' },
  { key: 'attemptRate', labelKey: 'cluster.monitor.component.scheduleAttemptRate', component: 'scheduler', chartKey: 'scheduleAttemptRate' },
];

function toTrend(chart: ComponentChart | undefined): TrendSeries[] {
  if (!chart) return [];
  return chart.lines
    .filter((line) => line.points.length > 0)
    .map((line) => ({ key: line.key, label: line.label, points: line.points }));
}

export function ClusterOverviewComponentsBlock({
  cluster,
  rangeKey,
  start,
  end,
  step,
}: {
  cluster: string;
  rangeKey: string;
  start: number;
  end: number;
  step: string;
}): React.ReactElement {
  const t = useT();
  const [selected, setSelected] = React.useState<string>('latency');
  const tab = COMPONENTS_TABS.find((entry) => entry.key === selected) ?? COMPONENTS_TABS[0]!;

  const units = React.useMemo(() => ({ perSecond: t('cluster.monitor.unit.perSecond') }), [t]);
  const apiserver = useComponentMetrics({ cluster, component: 'apiserver', rangeKey, start, end, step });
  const scheduler = useComponentMetrics({ cluster, component: 'scheduler', rangeKey, start, end, step });
  const query = tab.component === 'apiserver' ? apiserver : scheduler;

  const charts = React.useMemo(() => {
    const source = tab.component === 'apiserver' ? apiserver.data : scheduler.data;
    return toComponentCharts(tab.component, source ?? [], t);
  }, [apiserver.data, scheduler.data, t, tab.component]);

  const chart = charts.find((entry) => entry.key === tab.chartKey);
  const lines = toTrend(chart);
  const state = query.isPending ? 'loading' : query.isError ? 'error' : lines.length === 0 ? 'empty' : 'ready';

  return (
    <section className="flex flex-col gap-3" data-ai-id="cluster-monitor:overview:components">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-ai-fg-secondary">{t('cluster.monitor.overview.components')}</h2>
        <p className="text-xs text-ai-fg-muted">{t('cluster.monitor.overview.componentsHint')}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <ul className="flex flex-col gap-0.5 rounded-ai-lg border border-ai-line bg-ai-surface-1 p-1.5" data-ai-id="cluster-monitor:overview:components:tabs">
          {COMPONENTS_TABS.map((entry) => {
            const source = entry.component === 'apiserver' ? apiserver.data : scheduler.data;
            const entryCharts = toComponentCharts(entry.component, source ?? [], t);
            const entryChart = entryCharts.find((candidate) => candidate.key === entry.chartKey);
            const entryLines = toTrend(entryChart);
            const active = entry.key === selected;
            const latest = entryLines[0]?.points[entryLines[0].points.length - 1]?.value;
            return (
              <li key={entry.key}>
                <Button
                  variant="ghost"
                  size="sm"
                  block
                  aria-pressed={active}
                  className={
                    'justify-between gap-2 px-2 text-left' +
                    (active ? ' border-l-2 border-l-ai-accent bg-ai-accent/10 text-ai-fg' : '')
                  }
                  data-ai-state={entryLines.length > 0 ? 'ready' : 'empty'}
                  {...actionProps(`cluster-monitor:overview:components:tab:${entry.key}`)}
                  onClick={() => setSelected(entry.key)}
                >
                  <span className="min-w-0 truncate text-xs text-ai-fg-secondary">{t(entry.labelKey)}</span>
                  <span
                    className="shrink-0 text-xs font-medium tabular-nums text-ai-fg"
                    data-ai-id={`cluster-monitor:overview:components:tab:${entry.key}:value`}
                  >
                    {latest === undefined ? '-' : formatComponentValue(latest, entryChart?.kind ?? 'perSecond', units)}
                  </span>
                </Button>
              </li>
            );
          })}
        </ul>

        <section
          className="flex min-w-0 flex-col gap-2 rounded-ai-lg border border-ai-line bg-ai-surface-1 p-4"
          data-ai-id="cluster-monitor:overview:components:chart"
          data-ai-state={state}
          aria-label={t(tab.labelKey)}
        >
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-medium text-ai-fg">{t(tab.labelKey)}</h3>
            <span className="text-xs tabular-nums text-ai-fg-muted" data-ai-id="cluster-monitor:overview:components:chart:now">
              {lines.length === 0
                ? '-'
                : lines.map((line) => formatComponentValue(line.points[line.points.length - 1]!.value, chart?.kind ?? 'perSecond', units)).join(' / ')}
            </span>
          </div>
          {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
          {state === 'error' ? (
            <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="cluster-monitor:overview:components:retry" />
          ) : null}
          {state === 'empty' ? (
            <div className="flex flex-col gap-1 py-10" data-ai-id="cluster-monitor:overview:components:chart:empty">
              <p className="text-sm text-ai-fg-secondary">{t('cluster.monitor.components.notReported')}</p>
              <p className="text-xs text-ai-fg-muted">{t('cluster.monitor.components.notReportedHint')}</p>
            </div>
          ) : null}
          {state === 'ready' ? (
            <>
              <TrendChart
                series={lines}
                start={start}
                end={end}
                label={t(tab.labelKey)}
                emptyText={t('cluster.monitor.empty')}
                showAxes
                showGrid
                interactive
                formatValue={(value) => formatComponentValue(value, chart?.kind ?? 'perSecond', units)}
              />
              <div className="flex flex-wrap items-center gap-3 text-xs" data-ai-id="cluster-monitor:overview:components:chart:legend">
                {lines.map((line, index) => (
                  <span key={line.key} className="flex items-center gap-1.5" data-ai-id={`cluster-monitor:overview:components:legend:${line.key}`}>
                    <i className="size-2 rounded-full" style={{ background: TREND_SERIES_COLORS[index % TREND_SERIES_COLORS.length] }} />
                    <span className="text-ai-fg-secondary">{line.label}</span>
                    <span className="tabular-nums text-ai-fg-muted">
                      {formatComponentValue(line.points[line.points.length - 1]!.value, chart?.kind ?? 'perSecond', units)}
                    </span>
                  </span>
                ))}
              </div>
            </>
          ) : null}
        </section>
      </div>
    </section>
  );
}