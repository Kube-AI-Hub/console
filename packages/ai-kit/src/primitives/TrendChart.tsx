import * as React from 'react';
import { cn } from '../utils/cn';

export interface TrendPoint { at: number; value: number }
export interface TrendChartProps extends React.HTMLAttributes<HTMLDivElement> {
  points: TrendPoint[];
  start: number;
  end: number;
  label: string;
  emptyText: string;
  /** A missing scrape beyond this interval starts a separate line, never a fake zero. */
  maxGap?: number;
}

/** Pure time-series rendering. Metric units and summaries belong to the host. */
export function TrendChart({ points, start, end, label, emptyText, maxGap, className, ...attributes }: TrendChartProps): React.ReactElement {
  const valid = Array.from(new Map(points.filter((point) =>
    Number.isFinite(point.at) && Number.isFinite(point.value) && point.at >= start && point.at <= end)
    .map((point) => [point.at, point])).values()).sort((a, b) => a.at - b.at);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || valid.length === 0) {
    return <div className={cn('py-6 text-sm text-ai-fg-muted', className)} {...attributes} data-ai-state="empty">{emptyText}</div>;
  }
  const low = Math.min(0, ...valid.map((point) => point.value));
  const high = Math.max(1, ...valid.map((point) => point.value));
  const span = (high - low) * 1.1;
  const path = valid.map((point, index) => {
    const previous = valid[index - 1];
    const move = !previous || (maxGap !== undefined && point.at - previous.at > maxGap);
    return `${move ? 'M' : 'L'}${((point.at - start) / (end - start) * 100).toFixed(2)},${(30 - (point.value - low) / span * 30).toFixed(2)}`;
  }).join(' ');
  return <div className={cn('text-ai-accent', className)} {...attributes} data-ai-state="ready" data-ai-points={valid.length}>
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" role="img" aria-label={label} className="h-24 w-full">
      <path data-ai-trend-line d={path} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      {valid.length === 1 ? <circle cx={((valid[0]!.at - start) / (end - start) * 100)} cy={30 - (valid[0]!.value - low) / span * 30} r="1" fill="currentColor" /> : null}
      <line x1="0" y1="30" x2="100" y2="30" stroke="currentColor" opacity=".25" vectorEffect="non-scaling-stroke" />
    </svg>
  </div>;
}
