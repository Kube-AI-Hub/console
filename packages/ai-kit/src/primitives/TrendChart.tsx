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
  className,
  ...attributes
}: TrendChartProps): React.ReactElement {
  const lines = toLines(points, series, start, end);
  const total = lines.reduce((sum, line) => sum + line.points.length, 0);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || total === 0) {
    return (
      <div className={cn('py-6 text-sm text-ai-fg-muted', className)} {...attributes} data-ai-state="empty">
        {emptyText}
      </div>
    );
  }
  const all = lines.flatMap((line) => line.points.map((point) => point.value));
  const low = Math.min(0, ...all);
  const high = Math.max(1, ...all);
  const span = (high - low) * 1.1;
  const y = (value: number) => 30 - ((value - low) / span) * 30;

  return (
    <div
      className={cn('text-ai-accent', className)}
      {...attributes}
      data-ai-state="ready"
      data-ai-points={total}
      data-ai-series-count={lines.length}
    >
      <svg viewBox="0 0 100 30" preserveAspectRatio="none" role="img" aria-label={label} className="h-24 w-full">
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
      </svg>
    </div>
  );
}
