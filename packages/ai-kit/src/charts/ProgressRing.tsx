import * as React from 'react';
import { cn } from '../utils/cn';
import { PieChart } from './PieChart';

export interface ProgressRingLabels {
  used: string;
  free: string;
}

export interface ProgressRingProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The consumed amount, in whatever unit `total` is. */
  used: number;
  /** The capacity. Zero or missing draws the used part only. */
  total?: number | undefined;
  /** Accessible name, e.g. "GPU 显存". */
  label: string;
  /** Slice names for the legend. */
  labels: ProgressRingLabels;
  /** Shown in the hole. Defaults to the percentage when a total is known. */
  centerLabel?: React.ReactNode;
  /** Ring size in CSS pixels. Defaults to 120. */
  size?: number;
  /** Formats the legend values. */
  formatValue?: (value: number) => string;
  /** Draw the legend beside the ring. Defaults to false: a gauge is usually one number. */
  showLegend?: boolean;
  /** Colour of the consumed arc; the remainder uses the muted surface token. */
  tone?: 'accent' | 'success' | 'warning' | 'danger';
}

/**
 * Tone → chart token.
 *
 * A token name, not a colour: SVG `fill` cannot resolve `var()` inside an attribute
 * (`rgb(var(--x))` as an attribute value renders nothing), so the token is resolved
 * against the live theme by `PieChart`'s palette before it reaches the drawing. The
 * status tones are channel triples like the chart palette, which is why they resolve
 * the same way.
 */
const TONE_TOKEN: Record<NonNullable<ProgressRingProps['tone']>, string> = {
  accent: '--ai-chart-1',
  success: '--ai-raw-status-success',
  warning: '--ai-raw-status-warning',
  danger: '--ai-raw-status-error',
};

/**
 * A percentage as a ring.
 *
 * The gauge form of `PieChart`: two slices (used / remainder), a ring, and the
 * percentage in the hole. Used where a reader compares one value against its
 * capacity — a GPU's memory, a project's quota — and a bare "62%" leaves them
 * asking "out of what".
 *
 * The percentage is the hole's default because it is the comparable number; the
 * raw used/total pair belongs in the legend, where it has room to be exact.
 */
export function ProgressRing({
  used,
  total,
  label,
  labels,
  centerLabel,
  size = 120,
  formatValue = String,
  showLegend = false,
  tone = 'accent',
  className,
  ...attributes
}: ProgressRingProps): React.ReactElement {
  const known = Number.isFinite(used);
  const ratio = known && typeof total === 'number' && total > 0 ? used / total : undefined;
  const percent = ratio === undefined ? undefined : Math.round(ratio * 1000) / 10;

  const slices = React.useMemo(() => {
    if (!known) return [];
    const usedSlice = { key: 'used', label: labels.used, value: Math.max(0, used), color: TONE_TOKEN[tone] };
    const remainder = typeof total === 'number' ? Math.max(0, total - used) : 0;
    // The remainder is a real slice only when it is positive: an over-100% reading
    // has nothing left to draw, and a zero slice would be an invisible legend entry.
    if (remainder <= 0) return [usedSlice];
    return [
      usedSlice,
      { key: 'free', label: labels.free, value: remainder, color: '--ai-surface-3' },
    ];
  }, [known, used, total, labels.used, labels.free, tone]);

  return (
    <PieChart
      {...attributes}
      className={cn('justify-center', className)}
      slices={slices}
      label={label}
      emptyText="-"
      donut
      /*
       * A thin band, sized against the box rather than the radius.
       *
       * 0.16 of the radius is 9.6px on a 120px ring: thin enough to read as a gauge
       * rather than a filled disc, thick enough that the hover lift is visible. A
       * caller that wants a different weight sets `thickness` on `PieChart` directly.
       */
      thickness={0.16}
      size={size}
      showLegend={showLegend}
      formatValue={formatValue}
      centerLabel={centerLabel ?? (
        <span className="flex flex-col items-center leading-tight">
          <span className="text-lg font-semibold tabular-nums text-ai-fg" data-ai-id="progress-ring:value">
            {percent === undefined ? '-' : `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`}
          </span>
        </span>
      )}
      data-ai-progress-used={known ? used : undefined}
      {...(typeof total === 'number' ? { 'data-ai-progress-total': total } : {})}
      {...(percent === undefined ? {} : { 'data-ai-progress-percent': percent })}
    />
  );
}
