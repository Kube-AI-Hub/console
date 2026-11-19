import * as React from 'react';
import { cn } from '../utils/cn';
import { Button } from '../primitives/Button';
import { Icon } from '../primitives/Icon/Icon';
import { ChartSkeleton, RefreshVeil } from '../primitives/RefreshVeil';
import { TimeRangePicker, type TimeRangePickerLabels } from './TimeRangePicker';
import { TimeSeriesChart, type TimeSeries } from './TimeSeriesChart';
import { gapForStep, resolveRange, stepToMs, type TimeRange } from './timeRange';

export interface ChartPanelLabels extends TimeRangePickerLabels {
  refresh: string;
  /** Shown instead of the plot when the query failed. */
  error: string;
  retry: string;
  /** Shown while the first load is in flight. */
  loading: string;
  /** Shown on the veil while a manual refresh runs. */
  refreshing: string;
  /**
   * Auto-refresh control, worded as a verb rather than a state.
   *
   * The cluster overview sets the precedent: the button reads 暂停 while refreshing
   * and 继续 while paused, so it always names what the click will do. "自动刷新：开"
   * describes the current state instead, which leaves the reader to work out
   * whether pressing it turns it on or off.
   */
  autoPause: string;
  autoResume: string;
  /** Accessible names, including the cadence. */
  autoPauseLabel: string;
  autoResumeLabel: string;
}

export interface ChartPanelProps {
  /** Stable handle, e.g. `cluster-monitor:gpu`. Child ids derive from it. */
  aiId: string;
  title: string;
  description?: string;
  series: TimeSeries[];
  range: TimeRange;
  onRangeChange: (next: TimeRange) => void;
  /**
   * The absolute span the host actually queried.
   *
   * A rolling range (`最近 1 小时`) is resolved against `Date.now()` **by whoever
   * issues the request**. When the panel resolved it a second time, the axis and the
   * data described two different spans — a few seconds apart, which showed up as the
   * curve's start sliding right on every auto-refresh: the points were drawn from
   * their own timestamps while the axis had already moved on.
   *
   * Pass the same values the query used and the two cannot disagree. Omit it only
   * for a static story, where the panel resolves the range once.
   */
  start?: number;
  end?: number;
  /** Prometheus step, printed under the plot. Defaults to the one the span implies. */
  step?: string;
  labels: ChartPanelLabels;
  /** `loading` on the first load; `refreshing` keeps the plot and dims it. */
  state: 'loading' | 'refreshing' | 'ready' | 'error' | 'empty';
  onRetry?: () => void;
  onRefresh?: () => void;
  /** Auto-refresh toggle; omit the pair to hide the control. */
  autoRefresh?: { value: boolean; onChange: (next: boolean) => void };
  /** Plot height. Defaults to 220. */
  height?: number;
  yDomain?: [number, number];
  formatAxis?: (value: number) => string;
  formatValue?: (value: number) => string;
  formatTime?: (at: number) => string;
  /** Render as bars instead of lines. */
  chartType?: 'line' | 'bar';
  /**
   * Fill under the line and smooth it.
   *
   * Defaults to on when there is exactly one series: a single filled curve is what
   * makes a lone metric legible at a glance, while several filled curves stack into
   * mud. Pass `false` to keep a single series as a bare line.
   */
  area?: boolean;
  /** Smooth the curve instead of joining samples with straight segments. */
  smooth?: boolean;
  /**
   * This refresh was started by the reader, not by the clock.
   *
   * Only a manual refresh draws the translucent veil: an auto-refresh moves the
   * window every few seconds, and a veil on each tick would strobe. The host owns
   * the distinction because only it knows which request it started.
   */
  manualRefresh?: boolean;
  /** Extra controls in the header, e.g. a metric picker. */
  actions?: React.ReactNode;
  /**
   * Whether the panel carries its own window picker. Defaults to true.
   *
   * A panel inside a page that already owns one window control must not show a
   * second: two pickers on one screen is two answers to "which period", and the
   * reader cannot tell which one the plot is following.
   */
  showRangePicker?: boolean;
  className?: string;
}

/**
 * A monitoring chart with its own window control.
 *
 * The shape the four monitoring surfaces share: a title, the period, a refresh, the
 * plot, and a legend the reader can toggle. It is one component rather than four
 * copies so that "a chart's window, its step and its gaps" cannot be decided
 * differently on each page — a gap drawn as a straight line on one page and as a
 * break on another makes the same incident look like two different events.
 *
 * The plot is **not** unmounted while a refresh runs: the previous series stay on
 * screen, dimmed, and the new points animate in. Replacing the chart with a
 * skeleton on every auto-refresh tick is the flicker this exists to avoid.
 */
export function ChartPanel({
  aiId,
  title,
  description,
  series,
  range,
  onRangeChange,
  start,
  end,
  step,
  labels,
  state,
  onRetry,
  onRefresh,
  autoRefresh,
  height = 220,
  yDomain,
  formatAxis,
  formatValue,
  formatTime,
  chartType = 'line',
  area,
  smooth = true,
  manualRefresh,
  showRangePicker = true,
  actions,
  className,
  ...attributes
}: ChartPanelProps): React.ReactElement {
  /*
   * The reader's legend toggles, kept here rather than in the host.
   *
   * They reset when the series identity changes (a different metric set), because a
   * hidden key from the previous metric would otherwise hide an unrelated line with
   * the same name.
   */
  const seriesKey = series.map((entry) => entry.key).join('|');
  const [hidden, setHidden] = React.useState<ReadonlySet<string>>(() => new Set());
  React.useEffect(() => setHidden(new Set()), [seriesKey]);

  /*
   * The axis must be the span the host queried, not a fresh reading of the clock.
   *
   * `start`/`end` are what the request used; `resolveRange` is the fallback for a
   * host that does not own a query (a story). Resolving here unconditionally is the
   * bug this guards: a rolling window read twice lands a few seconds apart, so the
   * points — placed by their own timestamps — slid right against a moving axis on
   * every auto-refresh.
   */
  const resolved = React.useMemo(() => {
    const auto = resolveRange(range);
    return {
      start: start ?? auto.start,
      end: end ?? auto.end,
      step: step ?? auto.step,
    };
  }, [range, start, end, step]);
  const fill = area ?? series.length === 1;
  const plotted = React.useMemo(
    () => series.map((entry) => ({
      ...entry,
      ...(chartType === 'bar' ? { type: 'bar' as const } : {}),
      // A bar has no curve to smooth and no area to fill.
      ...(chartType === 'line' ? { area: entry.area ?? fill, smooth: entry.smooth ?? smooth } : {}),
      hidden: hidden.has(entry.key),
    })),
    [series, hidden, chartType, fill, smooth],
  );

  const toggle = (key: string): void => {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const busy = state === 'refreshing';
  /*
   * Whether this refresh is the reader's or the clock's.
   *
   * `manualRefresh` is the precise signal: the host knows which request it started,
   * and an auto tick must not veil. But `state === 'refreshing'` already means "data
   * is on screen and being replaced" — a panel rendered in that state (a story, a
   * host that has not wired the flag yet) must look like a refresh rather than like
   * nothing happening. So the veil shows when either says so.
   */
  const manual = busy && (manualRefresh === true || manualRefresh === undefined);

  return (
    <section
      {...attributes}
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-ai-lg border border-ai-line bg-ai-surface-1 p-4',
        'transition-colors duration-ai-base',
        className,
      )}
      data-ai-id={aiId}
      data-ai-state={state}
      aria-busy={busy}
      aria-label={title}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="truncate text-sm font-medium text-ai-fg">{title}</h3>
          {description ? <p className="text-[11px] text-ai-fg-muted">{description}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {actions}
          {autoRefresh ? (
            /*
             * Ghost buttons with a glyph, matching the cluster overview's header: the
             * auto-refresh control and the manual refresh are the same kind of action
             * (re-read the window), so they look the same and sit together. The label
             * is the verb — 暂停 while running, 继续 while paused.
             */
            <Button
              size="sm"
              variant="ghost"
              aria-pressed={autoRefresh.value}
              aria-label={autoRefresh.value ? labels.autoPauseLabel : labels.autoResumeLabel}
              title={autoRefresh.value ? labels.autoPauseLabel : labels.autoResumeLabel}
              data-ai-id={`${aiId}:auto-refresh`}
              onClick={() => autoRefresh.onChange(!autoRefresh.value)}
            >
              <Icon name={autoRefresh.value ? 'pause' : 'start'} />
              {autoRefresh.value ? labels.autoPause : labels.autoResume}
            </Button>
          ) : null}
          {onRefresh ? (
            <Button
              size="sm"
              variant="ghost"
              loading={busy}
              aria-label={labels.refresh}
              title={labels.refresh}
              data-ai-id={`${aiId}:refresh`}
              onClick={onRefresh}
            >
              {!busy ? <Icon name="refresh" /> : null}
              {labels.refresh}
            </Button>
          ) : null}
          {showRangePicker ? (
            <TimeRangePicker
              value={range}
              onChange={onRangeChange}
              labels={labels}
              aiId={`${aiId}:range`}
            />
          ) : null}
        </div>
      </header>

      {/*
       * The plot keeps its height in every state, so a refresh or an error never
       * moves the page under the reader's cursor.
       */}
      <div className="relative" style={{ minHeight: height }}>
        {state === 'loading' ? <ChartSkeleton height={height} legend aiId={`${aiId}:loading`} /> : null}

        {state === 'error' ? (
          <div className="flex flex-col items-start gap-2 py-6" data-ai-id={`${aiId}:error`}>
            <p className="text-xs text-ai-fg-muted">{labels.error}</p>
            {onRetry ? (
              <Button size="sm" variant="secondary" data-ai-id={`${aiId}:retry`} onClick={onRetry}>
                {labels.retry}
              </Button>
            ) : null}
          </div>
        ) : null}

        {/*
         * The plot is not drawn on the first load: the skeleton stands in its box.
         *
         * Rendering both put the skeleton in the flow above the plot, so a 220px panel
         * measured 468px and the empty axes showed underneath the placeholder. A
         * refresh is different — there the previous series stay on screen, dimmed.
         */}
        {state !== 'error' && state !== 'loading' ? (
          <div
            /*
             * Dimming is for a *manual* refresh only. An auto-refresh moves the window
             * every few seconds; dimming on each tick would strobe, so that path lets
             * the line animate to its new shape instead. The `refreshing` prop (which
             * draws the veil) is likewise only set for a manual read — see `manual`.
             */
            className={cn('transition-opacity duration-ai-base', manual && 'opacity-70')}
            data-ai-id={`${aiId}:plot`}
          >
            <TimeSeriesChart
              series={plotted}
              start={resolved.start}
              end={resolved.end}
              label={title}
              emptyText={labels.loading}
              height={height}
              maxGap={gapForStep(resolved.step)}
              gridSlack={stepToMs(resolved.step) / 2}
              {...(yDomain ? { yDomain } : {})}
              {...(formatAxis ? { formatAxis } : {})}
              {...(formatValue ? { formatValue } : {})}
              {...(formatTime ? { formatTime } : {})}
              onToggleSeries={toggle}
              data-ai-id={`${aiId}:chart`}
            />
            {/*
              * The legend lives inside the chart; this handle names it for automation
              * that addressed the previous panel shape. It wraps nothing, so it costs
              * no layout — a zero-height marker with the panel's id.
              */}
            <span className="sr-only" data-ai-id={`${aiId}:legend`} aria-hidden="true" />
            {/*
             * The veil is drawn here, not inside the plot.
             *
             * The plot renders an empty state when a series has no points — and a
             * refresh is exactly when that can happen. A veil nested in the plot would
             * vanish with it, so the panel owns the layer: the same `RefreshVeil` every
             * table uses, always covering the plot box.
             */}
            {manual ? <RefreshVeil aiId={`${aiId}:refreshing`} label={labels.refreshing} /> : null}
          </div>
        ) : null}
      </div>

      {/*
       * The step is printed because it decides what a spike looks like: the same
       * metric at a 15-second step and a 1-hour step draws two different stories.
       */}
      <p className="text-[11px] tabular-nums text-ai-fg-faint" data-ai-id={`${aiId}:step`}>
        {labels.step}: {resolved.step}
      </p>
      {/*
       * The empty-state handle.
       *
       * A panel whose series have no points still renders its frame and its window
       * control — the reader can widen the period — but the plot area is the empty
       * picture, and that is what this handle marks. Kept as a sibling of the plot so
       * an automation can tell "no data in this window" from "still loading".
       */}
      {state !== 'error' && state !== 'loading' && plotted.every((entry) => entry.points.length === 0) ? (
        <div className="sr-only" data-ai-id={`${aiId}:empty`} data-ai-state="empty">
          {labels.error}
        </div>
      ) : null}
    </section>
  );
}
