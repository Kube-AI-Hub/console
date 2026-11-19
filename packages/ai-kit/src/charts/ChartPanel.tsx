import * as React from 'react';
import { cn } from '../utils/cn';
import { Button } from '../primitives/Button';
import { Icon } from '../primitives/Icon/Icon';
import { TimeRangePicker, type TimeRangePickerLabels } from './TimeRangePicker';
import { TimeSeriesChart, type TimeSeries } from './TimeSeriesChart';
import { gapForStep, resolveRange, type TimeRange } from './timeRange';

export interface ChartPanelLabels extends TimeRangePickerLabels {
  refresh: string;
  /** Shown instead of the plot when the query failed. */
  error: string;
  retry: string;
  /** Shown while the first load is in flight. */
  loading: string;
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
  labels: ChartPanelLabels;
  /** `loading` on the first load; `refreshing` keeps the plot and dims it. */
  state: 'loading' | 'refreshing' | 'ready' | 'error' | 'empty';
  error?: unknown;
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
  /** Extra controls in the header, e.g. a metric picker. */
  actions?: React.ReactNode;
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
  labels,
  state,
  error,
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
  actions,
  className,
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

  const resolved = React.useMemo(() => resolveRange(range), [range]);
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

  return (
    <section
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
          <TimeRangePicker
            value={range}
            onChange={onRangeChange}
            labels={labels}
            aiId={`${aiId}:range`}
          />
        </div>
      </header>

      {/*
       * The plot keeps its height in every state, so a refresh or an error never
       * moves the page under the reader's cursor.
       */}
      <div className="relative" style={{ minHeight: height }}>
        {state === 'loading' ? (
          <div
            className="absolute inset-0 animate-pulse rounded-ai-md bg-ai-surface-2/60 motion-reduce:animate-none"
            data-ai-id={`${aiId}:loading`}
            aria-label={labels.loading}
          />
        ) : null}

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

        {state !== 'error' ? (
          <div
            className={cn(
              'transition-opacity duration-ai-base',
              busy && 'pointer-events-none opacity-60',
            )}
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
              {...(yDomain ? { yDomain } : {})}
              {...(formatAxis ? { formatAxis } : {})}
              {...(formatValue ? { formatValue } : {})}
              {...(formatTime ? { formatTime } : {})}
              onToggleSeries={toggle}
              data-ai-id={`${aiId}:chart`}
            />
          </div>
        ) : null}
      </div>

      {/*
       * The step is printed because it decides what a spike looks like: the same
       * metric at a 15-second step and a 1-hour step draws two different stories.
       */}
      <p className="text-[11px] tabular-nums text-ai-fg-faint" data-ai-id={`${aiId}:step`}>
        {labels.step}: {resolved.step}
        {error ? null : null}
      </p>
    </section>
  );
}
