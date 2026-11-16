import * as React from 'react';
import { cn } from '../utils/cn';

export interface TrendPoint { at: number; value: number }

/**
 * One line of a multi-series trend.
 *
 * `key` is the identity (a verb, a result, a quantile) and must be unique inside the
 * chart: two series are two lines, never merged, even if they come from the same metric.
 */
export interface TrendSeries {
  key: string;
  label: string;
  points: TrendPoint[];
  /** Stroke colour. Defaults to the next chart-palette entry; host renders the legend. */
  color?: string | undefined;
}

export interface TrendChartProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Single-series shorthand, kept for existing consumers. */
  points?: TrendPoint[];
  /** Several lines sharing one scale. Mutually exclusive with `points`. */
  series?: TrendSeries[];
  start: number;
  end: number;
  label: string;
  emptyText: string;
  /** A missing scrape beyond this interval starts a separate line, never a fake zero. */
  maxGap?: number;
  interactive?: boolean;
  showAxes?: boolean;
  showGrid?: boolean;
  area?: boolean;
  yDomain?: [number, number] | undefined;
  formatValue?: (value: number) => string;
  formatTime?: (at: number) => string;
}

/**
 * Chart series palette, in order.
 *
 * The tokens are channel triples (`--ai-chart-1: 169 129 248`), so they must be
 * wrapped in `rgb()` — a bare `var()` as an SVG stroke renders nothing and the chart
 * silently disappears. Exported so a host can colour its legend dots with the same
 * colour as the line instead of inventing a second palette.
 */
export const TREND_SERIES_COLORS = [
  'rgb(var(--ai-chart-1))',
  'rgb(var(--ai-chart-2))',
  'rgb(var(--ai-chart-3))',
  'rgb(var(--ai-chart-4))',
  'rgb(var(--ai-chart-5))',
  'rgb(var(--ai-chart-6))',
] as const;

interface PendingLine {
  key: string;
  label: string;
  color: string | undefined;
  points: TrendPoint[];
}

function toLines(points: TrendPoint[] | undefined, series: TrendSeries[] | undefined, start: number, end: number): PendingLine[] {
  const input: PendingLine[] = series
    ? series.map((entry, index) => ({
        key: entry.key,
        label: entry.label,
        color: entry.color ?? TREND_SERIES_COLORS[index % TREND_SERIES_COLORS.length],
        points: entry.points,
      }))
    : [{ key: '', label: '', color: undefined, points: points ?? [] }];

  return input.map((line) => ({
    ...line,
    /*
     * A NaN point is dropped, not plotted: this deployment returns whole series of
     * "NaN", and putting one into an SVG path produces an empty `d` (the line
     * vanishes) or, if coerced, a fake zero.
     */
    points: Array.from(
      new Map(
        line.points
          .filter((point) => Number.isFinite(point.at) && Number.isFinite(point.value) && point.at >= start && point.at <= end)
          .map((point) => [point.at, point]),
      ).values(),
    ).sort((a, b) => a.at - b.at),
  }));
}

function endOfLine(at: number, start: number, end: number): number {
  return ((at - start) / (end - start)) * 100;
}

/** Pure time-series rendering. Metric units and summaries belong to the host. */
export function TrendChart({
  points,
  series,
  start,
  end,
  label,
  emptyText,
  maxGap,
  interactive = false,
  showAxes = false,
  showGrid = false,
  area = false,
  yDomain,
  formatValue = String,
  formatTime = (at) => new Date(at).toLocaleTimeString(),
  className,
  ...attributes
}: TrendChartProps): React.ReactElement {
  const lines = toLines(points, series, start, end);
  const total = lines.reduce((sum, line) => sum + line.points.length, 0);
  const [activeAt, setActiveAt] = React.useState<number | null>(null);
  const times = [...new Set(lines.flatMap((line) => line.points.map((point) => point.at)))].sort((a, b) => a - b);
  React.useEffect(() => setActiveAt(null), [start, end]);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || total === 0) {
    return (
      <div className={cn('py-6 text-sm text-ai-fg-muted', className)} {...attributes} data-ai-state="empty">
        {emptyText}
      </div>
    );
  }
  const all = lines.flatMap((line) => line.points.map((point) => point.value));
  const domain = yDomain && Number.isFinite(yDomain[0]) && Number.isFinite(yDomain[1]) && yDomain[1] > yDomain[0] ? yDomain : undefined;
  const low = domain?.[0] ?? Math.min(0, ...all);
  const high = domain?.[1] ?? Math.max(1, ...all);
  const span = (high - low) * (domain ? 1 : 1.1);
  const y = (value: number) => 30 - ((value - low) / span) * 30;
  const selectedAt = activeAt !== null && times.includes(activeAt) ? activeAt : null;

  return (
    <div
      className={cn('text-ai-accent', className)}
      {...attributes}
      {...(interactive ? {
        tabIndex: attributes.tabIndex ?? 0,
        role: 'group',
        'aria-label': label,
        onFocus: (event: React.FocusEvent<HTMLDivElement>) => {
          attributes.onFocus?.(event);
          setActiveAt(times[times.length - 1] ?? null);
        },
        onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
          attributes.onKeyDown?.(event);
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const index = selectedAt === null ? times.length - 1 : times.indexOf(selectedAt);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? times.length - 1 :
            Math.max(0, Math.min(times.length - 1, index + (event.key === 'ArrowLeft' ? -1 : 1)));
          setActiveAt(times[next] ?? null);
        },
        onMouseMove: (event: React.MouseEvent<HTMLDivElement>) => {
          attributes.onMouseMove?.(event);
          const box = event.currentTarget.querySelector('svg')?.getBoundingClientRect();
          if (!box || box.width <= 0) return;
          const at = start + Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)) * (end - start);
          setActiveAt(times.reduce((nearest, time) => Math.abs(time - at) < Math.abs(nearest - at) ? time : nearest, times[0]!));
        },
        onMouseLeave: (event: React.MouseEvent<HTMLDivElement>) => { attributes.onMouseLeave?.(event); setActiveAt(null); },
      } : {})}
      data-ai-state="ready"
      data-ai-points={total}
      data-ai-series-count={lines.length}
      data-ai-cursor-at={selectedAt ?? undefined}
    >
      <div className={showAxes ? 'relative pl-9' : undefined}>
      {showAxes ? <div className="absolute inset-y-0 left-0 flex h-24 flex-col justify-between text-[10px] tabular-nums text-ai-fg-muted">
        <span>{formatValue(high)}</span><span>{formatValue((low + high) / 2)}</span><span>{formatValue(low)}</span>
      </div> : null}
      <svg viewBox="0 0 100 30" preserveAspectRatio="none" role="img" aria-label={label} className={cn('h-24 w-full', interactive && 'cursor-crosshair')}>
        {showGrid ? [0, 10, 20, 30].map((at) => <line key={at} x1="0" y1={at} x2="100" y2={at}
          stroke="currentColor" opacity=".12" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />) : null}
        {area ? lines.flatMap((line) => {
          const segments: TrendPoint[][] = [];
          for (const point of line.points) {
            const previous = segments[segments.length - 1]?.at(-1);
            if (!previous || (maxGap !== undefined && point.at - previous.at > maxGap)) segments.push([point]);
            else segments[segments.length - 1]!.push(point);
          }
          return segments.filter((segment) => segment.length > 1).map((segment, index) => <path
            key={`${line.key}:area:${index}`} data-ai-trend-area
            d={`M${endOfLine(segment[0]!.at, start, end)},30 ${segment.map((point) => `L${endOfLine(point.at, start, end)},${y(point.value)}`).join(' ')} L${endOfLine(segment.at(-1)!.at, start, end)},30 Z`}
            fill={line.color ?? 'currentColor'} opacity=".12" />);
        }) : null}
        {lines.map((line) => {
          if (line.points.length === 0) return null;
          const path = line.points.map((point, index) => {
            const previous = line.points[index - 1];
            const move = !previous || (maxGap !== undefined && point.at - previous.at > maxGap);
            return `${move ? 'M' : 'L'}${endOfLine(point.at, start, end).toFixed(2)},${y(point.value).toFixed(2)}`;
          }).join(' ');
          return (
            <path
              key={line.key || 'single'}
              data-ai-trend-line
              data-ai-series={line.key}
              data-ai-series-points={line.points.length}
              d={path}
              fill="none"
              stroke={line.color ?? 'currentColor'}
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        {lines.map((line) => line.points.length === 1 ? (
          <circle
            key={`dot-${line.key || 'single'}`}
            data-ai-series-dot={line.key}
            cx={endOfLine(line.points[0]!.at, start, end)}
            cy={y(line.points[0]!.value)}
            r="1"
            fill={line.color ?? 'currentColor'}
          />
        ) : null)}
        <line x1="0" y1="30" x2="100" y2="30" stroke="currentColor" opacity=".25" vectorEffect="non-scaling-stroke" />
        {selectedAt !== null ? <line x1={endOfLine(selectedAt, start, end)} x2={endOfLine(selectedAt, start, end)}
          y1="0" y2="30" stroke="currentColor" opacity=".6" vectorEffect="non-scaling-stroke" /> : null}
      </svg>
      </div>
      {showAxes ? <div className="mt-1 ml-9 flex justify-between text-[10px] tabular-nums text-ai-fg-muted">
        <span>{formatTime(start)}</span><span>{formatTime(end)}</span>
      </div> : null}
      {interactive ? <div className="mt-2 min-h-4 flex flex-wrap gap-x-4 text-xs tabular-nums text-ai-fg-secondary" aria-live="polite" data-ai-trend-readout>
        {selectedAt === null ? <span>{label}</span> : <>
          <time dateTime={new Date(selectedAt).toISOString()}>{formatTime(selectedAt)}</time>
          {lines.map((line) => {
            const point = line.points.find((entry) => entry.at === selectedAt);
            return <span key={line.key || 'single'}>{line.label ? `${line.label}: ` : ''}{point ? formatValue(point.value) : '-'}</span>;
          })}
        </>}
      </div> : null}
    </div>
  );
}
