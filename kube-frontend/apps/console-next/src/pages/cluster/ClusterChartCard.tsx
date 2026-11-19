import * as React from 'react';
import {
  FALLBACK_CHART_COLORS,
  ChartSkeleton,
  TimeSeriesChart,
  seriesColors,
  type TimeSeries,
} from '@kube-ai-hub/ui/charts';
import { cn } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';

/**
 * One large chart with a legend on a tab of 集群监控.
 *
 * The tabs and the overview differ in data, not in how a chart reads: a title, a
 * chart with axes and a hover readout, a legend that names every line and prints its
 * latest value, and — when the metric is not reported — an explanation instead of a
 * blank plot. That shape is written once here so a missing series cannot be drawn as a
 * zero line on one tab and as an empty state on another.
 *
 * The legend is always rendered, even for a single series: a value without its colour
 * dot leaves the reader guessing which line it belongs to. It is also the toggle —
 * pointing at a row lifts nothing here (there is no hover-to-emphasise on a static
 * legend), but clicking one hides its line, which is how a reader compares two of
 * eighteen charts without scrolling.
 */
export interface ClusterChartCardProps {
  /** Card handle, e.g. `cluster-monitor:resource:chart:gpu:gpuMemory`. The chart/legend/empty ids derive from it. */
  aiId: string;
  title: string;
  series: TimeSeries[];
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
  /**
   * The first read is still in flight: draw the skeleton instead of the plot.
   *
   * Different from `refreshing`. A first load has no curve to keep on screen, and a
   * solid grey block where a chart will be reads as "broken" rather than "arriving".
   */
  loading?: boolean;
  /**
   * A reader-initiated refresh is in flight.
   *
   * Draws the same translucent veil the resource lists use. The tab sets it from the
   * page's manual-refresh signal, so the header's 刷新 and a chart's own refresh look
   * identical — the two buttons start the same reads and must not behave two ways.
   */
  refreshing?: boolean;
  /** Accessible name for the veil. */
  refreshingLabel?: string;
  /** Plot height in CSS pixels. Defaults to 160. */
  height?: number;
}

/** The latest sample of a line, or undefined when it has none. */
function latestOf(series: TimeSeries): number | undefined {
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
  loading = false,
  refreshing = false,
  refreshingLabel,
  height = 160,
}: ClusterChartCardProps): React.ReactElement {
  const t = useT();
  const veilLabel = refreshingLabel ?? t('cluster.monitor.refreshing');
  /*
   * The legend dots use the palette the plot itself resolves, so a dot is never a
   * shade off its line. Reading the tokens through the same helper the chart uses is
   * the only way to guarantee that — the alternative was a second copy of the palette
   * that drifts on a theme change.
   */
  const colors = React.useMemo(() => seriesColors(series, FALLBACK_CHART_COLORS), [series]);
  /*
   * Which lines the reader has switched off.
   *
   * Owned here rather than by the chart: a tab re-renders its cards on every
   * auto-refresh tick, and a choice that reset each tick would be unusable. The set
   * is dropped when the metric identity changes (a different group's cards), so a
   * hidden key cannot hide an unrelated line that happens to share its name.
   */
  const seriesKey = series.map((entry) => entry.key).join('|');
  const [hidden, setHidden] = React.useState<ReadonlySet<string>>(() => new Set());
  React.useEffect(() => setHidden(new Set()), [seriesKey]);
  const plotted = React.useMemo(
    () => series.map((entry) => ({ ...entry, hidden: hidden.has(entry.key), area: entry.area ?? area })),
    [series, hidden, area],
  );

  return (
    <section
      className={cn(
        'flex min-w-0 flex-col rounded-ai-md border border-ai-line/60 bg-ai-surface p-4',
        'transition-colors duration-ai-base hover:border-ai-line',
      )}
      data-ai-id={aiId}
      /*
       * The card reports the same four states as the surfaces around it.
       *
       * `refreshing` is its own state, not `ready`: a reader's refresh keeps the curve
       * on screen while the veil covers it, and an automation that waited for "ready"
       * would otherwise read a card that is being replaced. `loading` and `refreshing`
       * are mutually exclusive — the first has nothing to show, the second has.
       */
      data-ai-state={loading ? 'loading' : hasData ? (refreshing ? 'refreshing' : 'ready') : 'empty'}
      aria-busy={loading || refreshing || undefined}
      aria-label={title}
      {...(group ? { 'data-ai-group': group } : {})}
    >
      <div className="mb-3">
        {loading ? (
          /* `text-sm` at `font-medium` is a 20px line; the placeholder matches it. */
          <span className="block h-5 w-32 animate-pulse rounded-ai-sm bg-ai-surface-3" />
        ) : (
          <h3 className="text-sm font-medium text-ai-fg">{title}</h3>
        )}
      </div>

      {/*
        * A first load has nothing to draw, so the skeleton stands in the plot's box
        * rather than a solid grey block appearing where the chart will be. `loading`
        * and `hasData` are separate: a host that has not finished its first read passes
        * `loading`, and one whose read came back empty passes neither.
        *
        * `legend` is on: `TimeSeriesChart` draws a legend row under its plot, and the
        * skeleton stands in for the whole chart, not just the drawing area. The card's
        * own legend below is then reproduced separately, at its own `mt-3`.
        */}
      {loading ? (
        <>
          <ChartSkeleton height={height} legend aiId={`${aiId}:loading`} />
          {/*
            * The card's own legend, at its own height. `series` is empty while
            * loading (nothing has been fetched), so the row is built from a fixed
            * number of placeholders rather than from the data: what matters is that
            * the 16px line is there, so the card does not shrink when data lands.
            */}
          <div className="mt-3 flex h-4 flex-wrap gap-x-4 gap-y-1" aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <span key={index} className="flex items-center gap-1.5">
                <span className="size-2 shrink-0 animate-pulse rounded-full bg-ai-surface-3" />
                <span className="h-2 w-16 animate-pulse rounded-ai-sm bg-ai-surface-3" />
              </span>
            ))}
          </div>
        </>
      ) : null}

      {/*
        * The empty explanation only exists once there is an answer. Rendering it while
        * `loading` put a 68px paragraph under the skeleton, so the card shrank when the
        * data landed instead of staying the same height.
        */}
      {hasData ? (
        <React.Fragment>
          <TimeSeriesChart
            series={plotted}
            start={start}
            end={end}
            label={title}
            emptyText={emptyText}
            height={height}
            formatValue={formatValue}
            refreshing={refreshing}
            refreshingLabel={veilLabel}
            onToggleSeries={(key) =>
              setHidden((current) => {
                const next = new Set(current);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              })
            }
            data-ai-id={aiId + ':chart'}
          />
          <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs" data-ai-id={aiId + ':legend'}>
            {series.map((line) => {
              const latest = latestOf(line);
              const off = hidden.has(line.key);
              return (
                <div
                  key={line.key}
                  className={cn('flex items-center gap-1.5 transition-opacity duration-ai-fast', off && 'opacity-40')}
                  data-ai-id={aiId + ':legend:' + line.key}
                >
                  <span
                    aria-hidden
                    className="inline-block size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: colors.get(line.key) ?? FALLBACK_CHART_COLORS[0] }}
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
      ) : loading ? null : (
        <div className="flex flex-col gap-1 py-6" data-ai-id={aiId + ':empty'}>
          <span className="text-sm text-ai-fg-secondary">{emptyText}</span>
          {emptyHint ? <span className="text-xs text-ai-fg-muted">{emptyHint}</span> : null}
        </div>
      )}
    </section>
  );
}

/** `TrendSeries` from component lines: the shape both component tabs plot. */
export function linesToSeries(lines: readonly { key: string; label: string; points: { at: number; value: number }[] }[]): TimeSeries[] {
  return lines.map((line) => ({ key: line.key, label: line.label, points: line.points }));
}

/** The latest point of a series, for the card's top-right summary. */
export function latestSeriesValue(series: TimeSeries): number | undefined {
  return latestOf(series);
}
