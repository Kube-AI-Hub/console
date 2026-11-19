import * as React from 'react';
import { Cell, Pie, PieChart } from 'recharts';
import { cn } from '../utils/cn';
import { useChartPalette } from '../charts/useChartPalette';

/**
 * One slice of a composition chart.
 *
 * `key` is the identity (a vendor, a status), so the legend row and the sector
 * stay addressable from tests and from the host page; `label` is display text.
 */
export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  /**
   * Fill colour. Defaults to the next ai-kit chart-palette entry, so a host that
   * has no colour to say gets a consistent palette instead of inventing one.
   */
  color?: string;
}

export interface DonutChartProps extends React.HTMLAttributes<HTMLDivElement> {
  segments: DonutSegment[];
  /** Accessible name of the figure; also the name a screen reader announces. */
  label: string;
  /** Shown instead of the drawing when no segment carries a positive finite value. */
  emptyText: string;
  formatValue?: (value: number) => string;
  /** Show the HTML legend (dot + name + value + share). Defaults to true. */
  showLegend?: boolean;
  /** Drawing box in CSS pixels. Defaults to 160. */
  size?: number;
  /** Content rendered in the hole, e.g. a total. Purely presentational. */
  centerLabel?: React.ReactNode;
}

/**
 * Fallback chart palette and token resolution live in `../charts/useChartPalette`,
 * shared with the time-series chart: two copies of the palette would drift the day
 * one of them gained a seventh colour.
 */

interface DrawnSegment {
  key: string;
  label: string;
  value: number;
  color: string;
  percent: number;
}

/**
 * Keep only slices that can be drawn: a non-finite or non-positive value is not
 * "zero", it is missing data, and a zero-width arc is invisible anyway. The
 * share is computed from those slices, so a dropped value never silently becomes
 * part of the whole.
 */
function collectDrawn(segments: DonutSegment[], palette: readonly string[]): { items: DrawnSegment[]; total: number } {
  const input = Array.isArray(segments) ? segments : [];
  const valid = input
    .map((segment, index) => ({ segment, index }))
    .filter(({ segment }) => segment !== null && typeof segment === 'object' && Number.isFinite(segment.value) && segment.value > 0);
  const total = valid.reduce((sum, { segment }) => sum + segment.value, 0);
  const items = valid.map(({ segment, index }): DrawnSegment => ({
    key: String(segment.key),
    label: String(segment.label),
    value: segment.value,
    color: segment.color && segment.color.trim() ? segment.color : palette[index % palette.length]!,
    percent: total > 0 ? (segment.value / total) * 100 : 0,
  }));
  return { items, total };
}

function formatPercent(percent: number): string {
  const rounded = Math.round(percent * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

/**
 * Composition chart (one value split across categories).
 *
 * Presentational only: no i18n, no requests, no routing. The host supplies the
 * accessible name, the empty copy and the value formatter; the component owns
 * the drawing, the legend and the tokens. A composition with no drawable slice
 * renders the empty text and no SVG at all — it never draws a zero line or an
 * empty ring that reads as "all good".
 */
export function DonutChart({
  segments,
  label,
  emptyText,
  formatValue = String,
  showLegend = true,
  size = 160,
  centerLabel,
  className,
  ...attributes
}: DonutChartProps): React.ReactElement {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const palette = useChartPalette(hostRef);
  const drawn = React.useMemo(() => collectDrawn(segments, palette), [segments, palette]);

  if (drawn.items.length === 0 || !(drawn.total > 0)) {
    return (
      <div
        {...attributes}
        className={cn('py-6 text-sm text-ai-fg-muted', className)}
        role="img"
        aria-label={label}
        data-ai-state="empty"
      >
        {emptyText}
      </div>
    );
  }

  const side = Number.isFinite(size) && size > 0 ? Math.round(size) : 160;

  return (
    <div
      {...attributes}
      ref={hostRef}
      className={cn('flex flex-wrap items-center gap-4', className)}
      role="img"
      aria-label={label}
      data-ai-state="ready"
      data-ai-segments={drawn.items.length}
    >
      <div className="relative shrink-0" style={{ width: side, height: side }} aria-hidden="true">
        <PieChart width={side} height={side} accessibilityLayer={false} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Pie
            data={drawn.items}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius="62%"
            outerRadius="88%"
            startAngle={90}
            endAngle={-270}
            isAnimationActive={false}
            stroke="none"
            // The whole figure is one `role="img"`; leave no empty focus stop inside it.
            rootTabIndex={-1}
          >
            {drawn.items.map((item) => <Cell key={item.key} fill={item.color} />)}
          </Pie>
        </PieChart>
        {centerLabel !== undefined && centerLabel !== null ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center px-8 text-center" aria-hidden="true">
            {centerLabel}
          </div>
        ) : null}
      </div>
      {showLegend ? (
        <ul className="min-w-0 flex-1 space-y-1.5 text-sm" data-ai-donut-legend>
          {drawn.items.map((item) => (
            <li
              key={item.key}
              data-ai-segment={item.key}
              data-ai-segment-value={item.value}
              className="flex items-baseline justify-between gap-3"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                  aria-hidden="true"
                />
                <span className="truncate text-ai-fg-secondary">{item.label}</span>
              </span>
              <span className="shrink-0 tabular-nums text-ai-fg">
                {formatValue(item.value)}
                <span className="ml-1.5 text-ai-fg-muted">{formatPercent(item.percent)}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
