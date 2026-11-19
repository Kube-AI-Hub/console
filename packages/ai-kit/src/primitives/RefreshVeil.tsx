import * as React from 'react';
import { cn } from '../utils/cn';

export interface RefreshVeilProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Text in the pill. Defaults to 更新中… */
  label?: string;
  /**
   * Automation handle, e.g. `table:refreshing` or `${aiId}:refreshing`.
   *
   * The handle lives on the veil rather than on the container, so an automation can
   * wait for "the refresh finished" without reading a CSS class.
   */
  aiId?: string;
}

/**
 * The translucent veil a refresh puts over content that is still on screen.
 *
 * One implementation for every surface that refreshes in place — the resource
 * tables and the chart panels. It used to be copied into both, and the copies had
 * already drifted (40% vs 45% tint, a rounded corner on one, a different z-index),
 * which made the same action look like two different features depending on the page.
 *
 * `absolute inset-0` covers the content rather than sitting under it: the reader's eye
 * is on the values that are about to change. `pointer-events-none` keeps the dimmed
 * content inert without trapping focus or blocking a scrollbar, and the caller marks
 * its container `aria-busy` so a screen reader hears the replacement too.
 */
export function RefreshVeil({ label = '更新中…', aiId, className, ...attributes }: RefreshVeilProps): React.ReactElement {
  return (
    <div
      aria-hidden="true"
      {...attributes}
      {...(aiId ? { 'data-ai-id': aiId } : {})}
      className={cn(
        'pointer-events-none absolute inset-0 z-30 flex items-center justify-center gap-2',
        'bg-ai-bg/40 backdrop-blur-[1px]',
        className,
      )}
    >
      <span className="flex items-center gap-2 rounded-ai-pill border border-ai-line bg-ai-bg-overlay px-3 py-1.5 text-[11px] text-ai-fg-secondary shadow-ai-pop">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="size-3.5 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        >
          <path d="M20 11a8 8 0 1 0-2.3 5.7" />
          <path d="M20 4v7h-7" />
        </svg>
        {label}
      </span>
    </div>
  );
}

export interface ChartSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Plot height in CSS pixels, so the skeleton occupies the plot's own box. */
  height: number;
  aiId?: string;
}

/**
 * The first-load placeholder for a chart.
 *
 * Shaped like the plot it stands in for — an axis gutter plus a few bars across the
 * drawing area — rather than a single grey block. The block read as "something is
 * broken here"; bars read as "a chart is arriving", and they use the same
 * `animate-pulse` + `bg-ai-surface-3` as the table's skeleton rows, so the two
 * loading states on one page are visibly the same kind of thing.
 */
export function ChartSkeleton({ height, aiId, className, ...attributes }: ChartSkeletonProps): React.ReactElement {
  return (
    <div
      aria-hidden="true"
      {...attributes}
      {...(aiId ? { 'data-ai-id': aiId } : {})}
      className={cn('flex w-full gap-3', className)}
      style={{ height }}
    >
      {/* The y-axis gutter: four tick labels' worth of bars. */}
      <div className="flex w-9 shrink-0 flex-col justify-between py-3">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="h-2 w-6 animate-pulse rounded-ai-sm bg-ai-surface-3" />
        ))}
      </div>
      {/* The drawing area: three bands where the curve would be, plus the baseline. */}
      <div className="relative min-w-0 flex-1">
        {[20, 48, 76].map((top) => (
          <div
            key={top}
            className="absolute inset-x-0 h-2 animate-pulse rounded-ai-sm bg-ai-surface-3"
            style={{ top: `${top}%` }}
          />
        ))}
        <div className="absolute inset-x-0 bottom-0 h-px bg-ai-line" />
      </div>
    </div>
  );
}
