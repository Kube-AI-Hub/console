import * as React from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '../utils/cn';
import { prefersReducedMotion } from './PieChart';
import { useChartPalette } from './useChartPalette';

/** One sample. `at` is epoch milliseconds, matching every other chart here. */
export interface SeriesPoint {
  at: number;
  value: number;
}

/**
 * One line or bar group in a multi-series chart.
 *
 * `key` is the identity and must be unique inside the chart: two series are two
 * lines, never merged, even when they come from the same metric with different
 * labels. `label` is what the legend and the tooltip print.
 */
export interface TimeSeries {
  key: string;
  label: string;
  points: SeriesPoint[];
  /**
   * Stroke / fill colour. Defaults to the next palette entry, so a host that has
   * nothing to say about colour gets a consistent palette.
   *
   * Spelled `string | undefined` rather than `string`: under
   * `exactOptionalPropertyTypes` the two are different types, and a host that maps
   * from another shape (`{ color?: string | undefined }`) must be assignable here.
   */
  color?: string | undefined;
  /**
   * Hide this series from the drawing while keeping it in the legend.
   *
   * The reader's legend toggle writes here; the chart never removes a series, so
   * the legend does not reflow as lines are switched on and off.
   */
  hidden?: boolean;
  /** Plot as bars instead of a line. Mixed charts are allowed. */
  type?: 'line' | 'bar';
  /**
   * Fill under the line.
   *
   * Off by default: a filled area hides the gridlines and the other series behind
   * it, and on a dense multi-series chart it turns into mud. On a single series it
   * is what makes a trend read at a glance — see `ChartPanel`, which turns it on
   * when there is exactly one series.
   */
  area?: boolean;
  /**
   * Use a smooth curve instead of straight segments between samples.
   *
   * Only sensible for a continuous measurement (utilisation, temperature). A
   * monotone curve is used rather than a spline: it never overshoots past the
   * samples, so a spike cannot be drawn taller than it was and a floor cannot dip
   * below zero.
   */
  smooth?: boolean;
  /** Bar width in CSS pixels. Defaults to `auto`, which divides the slot. */
  barSize?: number;
}

export interface TimeSeriesChartProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onMouseMove'> {
  series: TimeSeries[];
  /** Epoch milliseconds. */
  start: number;
  end: number;
  /** Accessible name of the figure. */
  label: string;
  /** Shown instead of the drawing when no series has a drawable point. */
  emptyText: string;
  /** Plot height in CSS pixels. Defaults to 200. */
  height?: number;
  /**
   * A gap longer than this starts a new segment instead of bridging it.
   *
   * A bridged gap draws a straight line across a period with no samples, which is
   * how a node that stopped reporting looks healthy. `connectNulls={false}` is what
   * enforces it; this value decides where the holes are.
   */
  maxGap?: number;
  /**
   * Half the sampling step, used to keep the sample nearest each window boundary.
   *
   * Samples arrive on the step grid, which rarely coincides with a boundary computed
   * from `Date.now()`. Without this slack the first point can fall outside the
   * window and be dropped, so the curve appears to start to the right of the axis
   * origin. The caller knows the step; the chart cannot infer it from the points.
   */
  gridSlack?: number;
  /** Print y-axis labels and gridlines. Defaults to true. */
  showYAxis?: boolean;
  /** Print the x-axis time labels. Defaults to true. */
  showXAxis?: boolean;
  /** Fixed y domain, e.g. `[0, 100]` for a percentage. */
  yDomain?: [number, number];
  /**
   * Print y labels with this formatter.
   *
   * Axis labels are short by necessity; the tooltip uses `formatValue` so a reader
   * can get the precise number without a wide axis gutter.
   */
  formatAxis?: (value: number) => string;
  formatValue?: (value: number) => string;
  formatTime?: (at: number) => string;
  /**
   * Animate a data update instead of redrawing instantly.
   *
   * On by default: an auto-refreshing chart that snaps between frames reads as
   * flicker. Animation is what makes a refresh look like the line grew a point
   * rather than the chart being replaced.
   */
  animate?: boolean;
  /**
   * A refetch is in flight while the plot stays on screen.
   *
   * Renders a translucent veil over the drawing, the same gesture the resource
   * lists use for a manual refresh. Deliberately **not** tied to the data: an
   * auto-refresh moves the window every few seconds, and a veil on every tick would
   * be a strobe. The host decides which kind of refresh this is.
   */
  refreshing?: boolean;
  /** Accessible name for the veil, e.g. 更新中… */
  refreshingLabel?: string;
  /** Legend position. `none` renders no legend (the host may render its own). */
  legend?: 'bottom' | 'none';
  /**
   * Called when the reader clicks a legend entry.
   *
   * The host owns visibility so the choice survives a refresh; the chart only
   * reports the click.
   */
  onToggleSeries?: (key: string) => void;
}

interface ChartRow {
  at: number;
  [key: string]: number | null;
}

/**
 * Pivot long-form series into the row-per-timestamp shape recharts wants.
 *
 * `null` (not `0`) for a missing sample: recharts draws `null` as a gap and `0` as
 * a real value at the baseline, and the difference is exactly "no data" versus
 * "zero". `connectNulls={false}` then breaks the line.
 *
 * A sample older than `maxGap` from the previous one for that series is also
 * written as `null` at its own timestamp, so the line stops rather than jumping —
 * without a row of its own, the two distant points would still be joined.
 */
export function pivotSeries(
  series: readonly TimeSeries[],
  start: number,
  end: number,
  maxGap?: number,
  /**
   * Half-width of the grid cell that contains the window boundaries.
   *
   * Defaults to 0 so an explicit-range caller keeps exact clipping. The chart passes
   * half its step, which is what lets the leftmost sample survive a boundary that
   * falls between two grid points.
   */
  gridSlack = 0,
): { rows: ChartRow[]; visible: TimeSeries[] } {
  const visible = series.filter((entry) => !entry.hidden);
  const byTime = new Map<number, ChartRow>();
  const touch = (at: number): ChartRow => {
    let row = byTime.get(at);
    if (!row) {
      row = { at };
      byTime.set(at, row);
    }
    return row;
  };
  for (const entry of visible) {
    const points = entry.points
      /*
       * The window is widened by one step on each side.
       *
       * Samples arrive on the step grid (a 15s step lands on :00/:15/:30/:45), which
       * rarely coincides with a window boundary computed from `Date.now()`. A strict
       * `at >= start` therefore dropped the first sample — often the only point in the
       * first few seconds — and the curve appeared to begin to the right of the axis
       * origin, sliding further with every auto-refresh. Clipping to the grid cell
       * that contains the boundary keeps the leftmost point where the axis starts.
       */
      .filter((point) => Number.isFinite(point.at) && Number.isFinite(point.value))
      .filter((point) => point.at >= start - gridSlack && point.at <= end + gridSlack)
      .sort((a, b) => a.at - b.at);
    let previousAt: number | undefined;
    for (const point of points) {
      /*
       * A gap gets its own `null` row at the midpoint of the missing period.
       *
       * Putting the `null` on the sample *after* the gap would break the line at the
       * right place but also blank that sample in the tooltip, so the reader loses the
       * first value after a scrape hole. A synthetic row in the middle of the gap
       * breaks the segment and leaves every real sample intact.
       */
      if (maxGap !== undefined && previousAt !== undefined && point.at - previousAt > maxGap) {
        const midpoint = Math.round((previousAt + point.at) / 2);
        if (midpoint > previousAt && midpoint < point.at) touch(midpoint)[entry.key] = null;
      }
      touch(point.at)[entry.key] = point.value;
      previousAt = point.at;
    }
  }
  const rows = [...byTime.values()].sort((a, b) => a.at - b.at);
  // Every series key must exist on every row: a missing key is `undefined`, which
  // recharts skips silently — but it also skips the gap, joining the neighbours.
  for (const row of rows) {
    for (const entry of visible) {
      if (!(entry.key in row)) row[entry.key] = null;
    }
  }
  return { rows, visible };
}

/** `start` / `end` as short axis labels, at the density the width allows. */
function axisTimeFormatter(formatTime: (at: number) => string): (value: number) => string {
  return (value) => formatTime(value);
}

/**
 * The colour each series is drawn with.
 *
 * Exported so a host that renders its own legend (or a summary row) uses the exact
 * colours the plot uses. Deriving them a second time from `TREND_SERIES_COLORS` was
 * how a legend dot ended up one shade off its line: the chart had already assigned a
 * palette entry per *visible* series, and a hidden series shifts the rest.
 */
export function seriesColors(
  series: readonly TimeSeries[],
  palette: readonly string[],
): Map<string, string> {
  return new Map(
    series.map((entry, index) => [entry.key, entry.color ?? palette[index % palette.length]!]),
  );
}

/**
 * A time-series chart for monitoring surfaces.
 *
 * Why recharts rather than the hand-drawn `TrendChart`: a monitoring chart needs
 * several series with a legend the reader can toggle, an axis that adapts to the
 * container, a crosshair tooltip that names every series at one instant, and
 * smooth updates. Those are a plotting library's job; `TrendChart` stays for the
 * small sparkline-like plots where a 24-unit SVG is the right size.
 *
 * Presentational only: no requests, no i18n, no routing. The host owns the window,
 * the data and the copy.
 */
export function TimeSeriesChart({
  series,
  start,
  end,
  label,
  emptyText,
  height = 200,
  maxGap,
  /**
   * Half the sampling step, used to keep the sample nearest each boundary.
   *
   * The caller knows the step (it built the request); the chart cannot infer it from
   * the points without guessing.
   */
  gridSlack = 0,
  showYAxis = true,
  showXAxis = true,
  yDomain,
  formatAxis = (value) => String(Math.round(value)),
  formatValue = String,
  formatTime = (at) => new Date(at).toLocaleTimeString(),
  animate = true,
  refreshing = false,
  refreshingLabel = '更新中…',
  legend = 'bottom',
  onToggleSeries,
  className,
  ...attributes
}: TimeSeriesChartProps): React.ReactElement {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const palette = useChartPalette(hostRef);
  /*
   * Legend toggles when the host does not own them.
   *
   * The legend renders as a button with `aria-pressed`, so it must respond to a
   * click in every case. It used to call `onToggleSeries?.(key)` unconditionally:
   * a host that passed `hidden` but no callback — a story, a read-only panel — got a
   * control that announced itself as pressable and did nothing. Now the host's
   * callback wins when present (a page persists the choice), and otherwise the
   * chart keeps its own set.
   *
   * The internal set is keyed by the series identity, so switching metrics does not
   * carry a hidden key over to an unrelated line that happens to share its name.
   */
  const seriesKey = series.map((entry) => entry.key).join('|');
  const seedHidden = (list: readonly TimeSeries[]): ReadonlySet<string> =>
    new Set(list.filter((entry) => entry.hidden).map((entry) => entry.key));
  const [ownHidden, setOwnHidden] = React.useState<ReadonlySet<string>>(() => seedHidden(series));
  /*
   * The `hidden` prop seeds the local set, so a chart that starts with a line switched
   * off can still switch it back on. It re-seeds only when the series identity
   * changes — re-seeding on every render would undo the reader's clicks whenever the
   * host re-rendered with the same `hidden` prop.
   *
   * The first render is skipped: a mount effect would clear the seed the initializer
   * just applied, which is exactly the bug this effect is here to avoid.
   */
  const lastSeriesKey = React.useRef(seriesKey);
  React.useEffect(() => {
    if (lastSeriesKey.current === seriesKey) return;
    lastSeriesKey.current = seriesKey;
    setOwnHidden(seedHidden(series));
    // `series` is covered by `seriesKey`; naming it would re-seed on every new array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesKey]);
  const isHidden = (key: string): boolean => ownHidden.has(key);
  /**
   * How many series carry data — the floor the legend cannot go below.
   *
   * A chart whose lines are all switched off has nothing to draw, and it used to
   * collapse into the empty state: "hide the last line" looked like the data had
   * disappeared. At least one line with points always stays visible, so the legend
   * can never blank the plot.
   *
   * Counted over the *plotted* series (which already include the `hidden` prop), not
   * over the raw input: a line the host seeded as hidden is not visible to begin
   * with, and counting it would refuse a click that is the reader's only line left.
   */
  const hasPoints = React.useMemo(() => series.filter((entry) => entry.points.length > 0), [series]);
  const plotted = React.useMemo(
    () => series.map((entry) => ({ ...entry, hidden: isHidden(entry.key) })),
    // `isHidden` closes over both the prop and the local set; the dependencies name
    // the two inputs rather than the function to avoid re-running on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, ownHidden, onToggleSeries],
  );
  const toggleLegend = (key: string): void => {
    if (onToggleSeries) {
      onToggleSeries(key);
      return;
    }
    setOwnHidden((current) => {
      /*
       * `current` is the state *before* this click: if the key is already hidden, the
       * click shows it again; otherwise the click hides it.
       */
      if (current.has(key)) {
        const next = new Set(current);
        next.delete(key);
        return next;
      }
      /*
       * Refuse to hide the last line that is both visible and non-empty.
       *
       * A chart whose lines are all switched off has nothing to draw, and it used to
       * collapse into the empty state: "hide the last line" looked like the data had
       * vanished. A single-series chart — the overview's usage plot — was one click
       * away from a blank panel.
       */
      const remains = hasPoints.filter((entry) => entry.key !== key && !current.has(entry.key));
      if (remains.length === 0 && hasPoints.some((entry) => entry.key === key)) return current;
      const next = new Set(current);
      next.add(key);
      return next;
    });
  };
  const { rows, visible } = React.useMemo(
    () => pivotSeries(plotted, start, end, maxGap, gridSlack),
    [plotted, start, end, maxGap, gridSlack],
  );
  // recharts does not consult `prefers-reduced-motion`; this design system does.
  const moving = animate && !prefersReducedMotion();

  const drawable = rows.some((row) => visible.some((entry) => row[entry.key] !== null && row[entry.key] !== undefined));

  if (!drawable) {
    return (
      <div
        {...attributes}
        className={cn('flex flex-col items-center justify-center gap-1 py-8 text-center', className)}
        role="img"
        aria-label={label}
        data-ai-state="empty"
      >
        <span className="text-sm text-ai-fg-muted">{emptyText}</span>
      </div>
    );
  }

  /*
   * Colours are assigned over **every** series, not only the visible ones.
   *
   * Indexing by `visible` renumbered the palette whenever the reader hid a line: hide
   * the first of three and the remaining two swapped colours, which reads as "the
   * data changed". A series keeps its colour for as long as it is on the chart.
   */
  const colors = seriesColors(series, palette);
  const hasBar = visible.some((entry) => entry.type === 'bar');

  return (
    <div {...attributes} ref={hostRef} className={cn('flex min-w-0 flex-col gap-2', className)} data-ai-state="ready">
      {/*
        * A fixed-height box around the plot.
        *
        * The height is declared here rather than by the drawing library: a chart that
        * grows after its first paint moves everything below it, and on a monitoring
        * page that is the whole panel jumping as data arrives.
        */}
      <div className="relative w-full" style={{ height }} role="img" aria-label={label} data-ai-series-count={visible.length}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgb(var(--ai-line))" strokeOpacity={0.35} vertical={false} />
            <XAxis
              dataKey="at"
              type="number"
              scale="time"
              domain={[start, end]}
              tickFormatter={axisTimeFormatter(formatTime)}
              tick={{ fill: 'rgb(var(--ai-fg-muted))', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: 'rgb(var(--ai-line))' }}
              minTickGap={48}
              hide={!showXAxis}
            />
            <YAxis
              domain={yDomain ?? [0, 'auto']}
              tickFormatter={formatAxis}
              tick={{ fill: 'rgb(var(--ai-fg-muted))', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={showYAxis ? 44 : 0}
              hide={!showYAxis}
            />
            <Tooltip
              // The crosshair is what makes a time axis readable: the reader is
              // pointing at an instant, not at a series.
              cursor={{ stroke: 'rgb(var(--ai-fg-muted))', strokeDasharray: '3 3', strokeOpacity: 0.6 }}
              content={(props) => (
                <ChartTooltip
                  {...props}
                  series={visible}
                  colors={colors}
                  formatValue={formatValue}
                  formatTime={formatTime}
                />
              )}
            />
            {visible.map((entry) => {
              const color = colors.get(entry.key)!;
              if (entry.type === 'bar') {
                return (
                  <Bar
                    key={entry.key}
                    dataKey={entry.key}
                    name={entry.label}
                    fill={color}
                    fillOpacity={0.75}
                    radius={[2, 2, 0, 0]}
                    isAnimationActive={moving}
                    animationDuration={380}
                    maxBarSize={entry.barSize ?? 18}
                  />
                );
              }
              return (
                <React.Fragment key={entry.key}>
                  {entry.area ? (
                    <Area
                      dataKey={entry.key}
                      name={entry.label}
                      stroke={color}
                      fill={color}
                      fillOpacity={0.14}
                      strokeWidth={1.8}
                      dot={false}
                      activeDot={{ r: 3, strokeWidth: 0 }}
                      connectNulls={false}
                      type={entry.smooth ? 'monotone' : 'linear'}
                      isAnimationActive={moving}
                      animationDuration={380}
                    />
                  ) : (
                    <Line
                      dataKey={entry.key}
                      name={entry.label}
                      stroke={color}
                      strokeWidth={1.8}
                      dot={false}
                      activeDot={{ r: 3, strokeWidth: 0 }}
                      connectNulls={false}
                      type={entry.smooth ? 'monotone' : 'linear'}
                      isAnimationActive={moving}
                      animationDuration={380}
                    />
                  )}
                </React.Fragment>
              );
            })}
            {/* An invisible bar keeps a bar-only chart's x scale honest; nothing renders. */}
            {hasBar ? null : null}
          </ComposedChart>
        </ResponsiveContainer>
        {/*
          * The manual-refresh veil, inside the fixed box so nothing moves when it
          * appears. It covers the drawing only — the legend stays readable, which is
          * what a reader compares against once the new data lands.
          */}
        {refreshing ? (
          <div
            aria-hidden="true"
            data-ai-chart-refreshing
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-ai-sm bg-ai-bg/45 backdrop-blur-[1px]"
          >
            <span className="flex items-center gap-2 rounded-ai-pill border border-ai-line bg-ai-bg-overlay px-3 py-1.5 text-[11px] text-ai-fg-secondary shadow-ai-pop">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                className="size-3.5 animate-spin motion-reduce:animate-none">
                <path d="M20 11a8 8 0 1 0-2.3 5.7" />
                <path d="M20 4v7h-7" />
              </svg>
              {refreshingLabel}
            </span>
          </div>
        ) : null}
      </div>

      {legend === 'bottom' ? (
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" data-ai-chart-legend>
          {plotted.map((entry, index) => {
            const color = colors.get(entry.key) ?? palette[index % palette.length]!;
            const hidden = entry.hidden === true;
            return (
              <li key={entry.key}>
                <button
                  type="button"
                  aria-pressed={!hidden}
                  data-ai-legend={entry.key}
                  data-ai-legend-hidden={hidden ? 'true' : 'false'}
                  onClick={() => toggleLegend(entry.key)}
                  className={cn(
                    'flex cursor-pointer items-center gap-1.5 rounded-ai-sm px-1 py-0.5 transition-opacity duration-ai-fast',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-ring',
                    hidden ? 'opacity-40' : 'opacity-100',
                  )}
                >
                  <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-ai-fg-secondary">{entry.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * The crosshair readout.
 *
 * A table of `series → value at this instant`, not a floating card per series: the
 * reader's question is "what was everything doing at 09:12", and separate cards
 * make them hunt across the plot to compare two numbers.
 */
function ChartTooltip({
  active,
  payload,
  label,
  series,
  colors,
  formatValue,
  formatTime,
}: {
  active?: boolean | undefined;
  /** recharts passes its own payload shape; only `dataKey` and `value` are read. */
  payload?: ReadonlyArray<{ dataKey?: unknown; value?: unknown }> | undefined;
  label?: string | number | undefined;
  series: TimeSeries[];
  colors: Map<string, string>;
  formatValue: (value: number) => string;
  formatTime: (at: number) => string;
}): React.ReactElement | null {
  if (!active || !payload?.length) return null;
  const at = typeof label === 'number' ? label : Number(label);
  const byKey = new Map(payload.map((item) => [String(item.dataKey), item.value]));
  return (
    <div
      className="rounded-ai-md border border-ai-line bg-ai-bg-overlay px-2.5 py-1.5 text-xs shadow-ai-pop"
      data-ai-chart-tooltip
    >
      <p className="mb-1 tabular-nums text-ai-fg-muted">{Number.isFinite(at) ? formatTime(at) : ''}</p>
      <ul className="flex flex-col gap-0.5">
        {series.map((entry) => {
          const raw = byKey.get(entry.key);
          const value = typeof raw === 'number' ? raw : raw === null || raw === undefined ? undefined : Number(raw);
          return (
            <li key={entry.key} className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: colors.get(entry.key) }} />
              <span className="text-ai-fg-secondary">{entry.label}</span>
              <span className="ml-auto pl-3 tabular-nums text-ai-fg" data-ai-chart-tooltip-value={entry.key}>
                {value === undefined || !Number.isFinite(value) ? '—' : formatValue(value)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
