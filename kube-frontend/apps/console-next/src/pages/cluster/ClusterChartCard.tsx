import * as React from 'react';
import { TREND_SERIES_COLORS, TrendChart, type TrendSeries } from '@kube-ai-hub/ui';

/**
 * One large chart with a legend on a tab of 集群监控.
 *
 * The tabs and the overview differ in data, not in how a chart reads: a title, a
 * chart with axes and a hover readout, a legend that names every line and prints its
 * latest value, and -- when the metric is not reported -- an explanation instead of a
 * blank plot. That shape is written once here so a missing series cannot be drawn as a
 * zero line on one tab and as an empty state on another.
 *
 * The legend is always rendered, even for a single series: a value without its colour
 * dot leaves the reader guessing which line it belongs to.
 */
export interface ClusterChartCardProps {
  /** Card handle, e.g. `cluster-monitor:resource:chart:gpu:gpuMemory`. The chart/legend/empty ids derive from it. */
  aiId: string;
  title: string;
  series: TrendSeries[];
  /** Epoch milliseconds. */
  start: number;
  end: number;
  /** False renders `<aiId>:empty` and no plot. */
  hasData: boolean;
  emptyText: string;
  emptyHint?: string;
  formatValue: (value: number) => string;
  /** Group handle for disambiguating repeated chart keys across groups. */
  group?: string;
  /** Area fill under the lines; off unless a stacked magnitude reads better filled. */
  area?: boolean;
}

/** The latest sample of a line, or undefined when it has none. */
function latestOf(series: TrendSeries): number | undefined {
  return series.points.length > 0 ? series.points[series.points.length - 1]?.value : undefined;
}

export function ClusterChartCard({
  aiId,
  title,
  series,
  start,
  end,
  hasData,
  emptyText,
  emptyHint,
  formatValue,
  group,
  area = false,
}: ClusterChartCardProps): React.ReactElement {
  return (
    <section
      className="flex min-w-0 flex-col rounded-ai-md border border-ai-line/60 bg-ai-surface p-4"
      data-ai-id={aiId}
      aria-label={title}
      {...(group ? { 'data-ai-group': group } : {})}
    >
      <div className="mb-3">
        <h3 className="text-sm font-medium text-ai-fg">{title}</h3>
      </div>

      {hasData ? (
        <React.Fragment>
          <TrendChart
            series={series}
            start={start}
            end={end}
            label={title}
            emptyText={emptyText}
            showAxes
            showGrid
            interactive
            area={area}
            formatValue={formatValue}
            data-ai-id={aiId + ':chart'}
            /*
             * The shared chart is 24 units tall by design; a tab is the page's main
             * content, so the plot gets more height here. The arbitrary variant beats
             * the primitive's own h-24 without forking the component.
             */
            className="[&_svg]:h-40"
          />
          <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs" data-ai-id={aiId + ':legend'}>
            {series.map((line, index) => {
              const latest = latestOf(line);
              return (
                <div key={line.key} className="flex items-center gap-1.5" data-ai-id={aiId + ':legend:' + line.key}>
                  <span
                    aria-hidden
                    className="inline-block size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: TREND_SERIES_COLORS[index % TREND_SERIES_COLORS.length] }}
                  />
                  <dt className="text-ai-fg-secondary">{line.label}</dt>
                  <dd className="tabular-nums text-ai-fg-muted" data-ai-id={aiId + ':legend:' + line.key + ':value'}>
                    {latest === undefined ? '—' : formatValue(latest)}
                  </dd>
                </div>
              );
            })}
          </dl>
        </React.Fragment>
      ) : (
        <div className="flex flex-col gap-1 py-6" data-ai-id={aiId + ':empty'}>
          <span className="text-sm text-ai-fg-secondary">{emptyText}</span>
          {emptyHint ? <span className="text-xs text-ai-fg-muted">{emptyHint}</span> : null}
        </div>
      )}
    </section>
  );
}

/** `TrendSeries` from component lines: the shape both component tabs plot. */
export function linesToSeries(lines: readonly { key: string; label: string; points: { at: number; value: number }[] }[]): TrendSeries[] {
  return lines.map((line) => ({ key: line.key, label: line.label, points: line.points }));
}

/** The latest point of a series, for the card's top-right summary. */
export function latestSeriesValue(series: TrendSeries): number | undefined {
  return latestOf(series);
}
