import * as React from 'react';
import { Cell, Pie, PieChart as RechartsPie, Sector } from 'recharts';
import { cn } from '../utils/cn';
import { resolveTokenValue, useChartPalette } from './useChartPalette';

/** One slice: a category and how much of the whole it holds. */
export interface PieSlice {
  key: string;
  label: string;
  value: number;
  /** Fill colour. Defaults to the next palette entry. */
  color?: string;
}

export interface PieChartProps extends React.HTMLAttributes<HTMLDivElement> {
  slices: PieSlice[];
  /** Accessible name of the figure. */
  label: string;
  /** Shown instead of the drawing when no slice carries a positive finite value. */
  emptyText: string;
  /**
   * Draw a ring instead of a full pie.
   *
   * A ring leaves the centre for the one number the reader came for (a total, a
   * percentage, a used/total pair). A full pie has nowhere to put it and forces the
   * answer into a corner label.
   */
  donut?: boolean;
  /**
   * Ring band width, as a share of the radius.
   *
   * `0.32` is a comfortable ring; `0.12` is a thin gauge line. Ignored unless
   * `donut` — and it is the **band**, not the hole: reading it as the hole's size
   * made `0.12` render a near-solid disc, which is the opposite of "thin".
   */
  thickness?: number;
  /** Drawing box in CSS pixels. Defaults to 180. */
  size?: number;
  /** Content rendered in the hole. Purely presentational. */
  centerLabel?: React.ReactNode;
  /**
   * Animate the sweep when the chart first appears or when the values change.
   *
   * On by default: a composition chart that snaps into place reads as a static
   * image, and the sweep is what tells the reader the slices grew from the same
   * origin. Respects `prefers-reduced-motion` through recharts' own check.
   */
  animate?: boolean;
  /** Animation length in milliseconds. Defaults to 600. */
  animationDuration?: number;
  formatValue?: (value: number) => string;
  /** Show the HTML legend. Defaults to true. */
  showLegend?: boolean;
}

interface DrawnSlice {
  key: string;
  label: string;
  value: number;
  color: string;
  percent: number;
}

/**
 * Keep only slices that can be drawn.
 *
 * A non-finite or non-positive value is missing data, not zero — and a zero-width
 * arc is invisible anyway. The share is computed from the drawn slices, so a
 * dropped value never silently becomes part of the whole.
 *
 * A `color` may be a token name (`--ai-chart-1`) instead of a colour: SVG `fill`
 * cannot resolve `var()` in an attribute, so a host that wants a theme token has no
 * way to say so — resolving it here, from the same computed styles the palette uses,
 * is what lets `ProgressRing` ask for "the success tone" without hard-coding it.
 */
function resolveColor(color: string | undefined, palette: readonly string[], index: number, host: HTMLElement | null): string {
  const raw = color?.trim();
  if (!raw) return palette[index % palette.length]!;
  if (!raw.startsWith('--')) return raw;
  return resolveTokenValue(host, raw, palette[index % palette.length]!);
}

function collect(
  slices: readonly PieSlice[],
  palette: readonly string[],
  host: HTMLElement | null,
): { items: DrawnSlice[]; total: number } {
  const valid = slices
    .map((slice, index) => ({ slice, index }))
    .filter(({ slice }) => slice && Number.isFinite(slice.value) && slice.value > 0);
  const total = valid.reduce((sum, { slice }) => sum + slice.value, 0);
  const items = valid.map(({ slice, index }): DrawnSlice => ({
    key: String(slice.key),
    label: String(slice.label),
    value: slice.value,
    color: resolveColor(slice.color, palette, index, host),
    percent: total > 0 ? (slice.value / total) * 100 : 0,
  }));
  return { items, total };
}

function formatPercent(percent: number): string {
  const rounded = Math.round(percent * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

/**
 * Whether animation is allowed right now.
 *
 * recharts animates by default and does not consult `prefers-reduced-motion`; the
 * rest of this design system does (see the `@media` block in `tokens.css`). A
 * reader who asked their OS for less motion must not get a spinning gauge anyway.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Composition or progress as a pie / ring.
 *
 * Two jobs, one drawing:
 *
 * - **Composition** — a total split across categories (vendor mix, status mix).
 *   Several slices, each labelled with its share.
 * - **Progress** — one value against the remainder of its capacity. Give it two
 *   slices (used / free) and `donut`, and the ring reads as a gauge with the
 *   percentage in the hole.
 *
 * Different from `DonutChart` (which stays for the compact side-by-side
 * legend layout): this one is responsive, animates the sweep, and can draw a full
 * pie. Both resolve the same palette from the live theme tokens.
 *
 * Presentational only: no requests, no i18n, no routing.
 */
export function PieChart({
  slices,
  label,
  emptyText,
  donut = false,
  thickness = 0.32,
  size = 180,
  centerLabel,
  animate = true,
  animationDuration = 600,
  formatValue = String,
  showLegend = true,
  className,
  ...attributes
}: PieChartProps): React.ReactElement {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const palette = useChartPalette(hostRef);
  const drawn = React.useMemo(() => collect(slices, palette, hostRef.current), [slices, palette]);
  /*
   * The sector under the pointer.
   *
   * Kept as state rather than left to recharts' own `activeShape`: the hover state
   * also drives the legend highlight and the tooltip, and one source means the two
   * cannot disagree about which slice is being described.
   */
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
  const hovered = activeIndex === null ? undefined : drawn.items[activeIndex];
  // Read once per mount: the OS setting does not change mid-render in practice, and
  // a media-query listener here would re-render every gauge on the page.
  const sweep = animate && !prefersReducedMotion();

  if (drawn.items.length === 0 || !(drawn.total > 0)) {
    return (
      <div
        {...attributes}
        className={cn('flex items-center justify-center py-6 text-sm text-ai-fg-muted', className)}
        role="img"
        aria-label={label}
        data-ai-state="empty"
      >
        {emptyText}
      </div>
    );
  }

  const side = Number.isFinite(size) && size > 0 ? Math.round(size) : 180;
  /*
   * `thickness` is the **band width**, as a share of the radius — not the hole's size.
   *
   * It used to be read as the inner-radius fraction, so `thickness={0.12}` produced
   * an inner radius of 10.8px on a 180px box: a ring with a pinprick hole, which
   * renders as a full pie. Reading it as the band is what makes "thin ring" thin —
   * and it is the number a designer actually specifies.
   */
  const outerRadius = (side / 2) * 0.92;
  const band = donut ? Math.max(0.02, Math.min(1, thickness)) * (side / 2) : 0;
  const inner = donut ? Math.max(0, outerRadius - band) : 0;

  return (
    <div
      {...attributes}
      ref={hostRef}
      className={cn('flex min-w-0 flex-wrap items-center gap-4', className)}
      role="img"
      aria-label={label}
      data-ai-state="ready"
      data-ai-slices={drawn.items.length}
      data-ai-pie-total={drawn.total}
    >
      <div
        className="relative shrink-0"
        style={{ width: side, height: side }}
        aria-hidden="true"
        /*
         * One place clears the highlight: the box the drawing lives in. A per-sector
         * `mouseout` did not fire reliably through recharts' wrapper, and a stuck
         * highlight is worse than none — the reader leaves the ring and the sector
         * stays lifted, as if selected.
         */
        onMouseLeave={() => setActiveIndex(null)}
      >
        {/*
          * Fixed dimensions rather than `ResponsiveContainer`: the box is already sized
          * by `size`, and a container that measures itself renders nothing where there
          * is no layout (jsdom, SSR, a hidden tab) — the ring would silently vanish.
          */}
        <RechartsPie width={side} height={side} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Pie
            data={drawn.items}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={inner}
            outerRadius={outerRadius}
            startAngle={90}
            endAngle={-270}
            stroke="none"
            // The sweep is the animation: it starts at 12 o'clock and grows clockwise,
            // which is how a reader expects a share to fill.
            isAnimationActive={sweep}
            animationDuration={animationDuration}
            animationBegin={0}
            /*
             * Hover feedback: the pointed-at sector lifts out of the ring.
             *
             * On a thin ring a colour change alone is invisible — the band is only a
             * few pixels tall. Pushing the sector outward is visible at any thickness,
             * and it is the gesture a reader already expects from a pie. `activeShape`
             * is how recharts 3 grows one slice; `activeIndex` was removed.
             */
            activeShape={(props: unknown) => (
              <Sector
                {...(props as React.ComponentProps<typeof Sector>)}
                outerRadius={outerRadius + Math.max(3, side * 0.03)}
                cornerRadius={2}
              />
            )}
            onMouseEnter={(_, index) => setActiveIndex(index)}
            /*
             * No `onMouseOut` here: recharts attaches the handler to the sector's inner
             * shape, and a `mouseout` fired on the wrapping `<g>` never reaches it, so
             * the highlight stuck after the pointer left. The clearing happens on the
             * chart box's own `onMouseLeave`, which is one handler for the whole
             * drawing instead of one per sector.
             */
          >
            {drawn.items.map((item) => (
              <Cell key={item.key} fill={item.color} />
            ))}
          </Pie>
        </RechartsPie>
        {centerLabel !== undefined && centerLabel !== null ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center">
            {centerLabel}
          </div>
        ) : null}
        {/*
          * The readout follows the pointer.
          *
          * Positioned in the box's top-right rather than at the cursor: a tooltip that
          * tracks the mouse covers the sector it describes on a 132px ring, and the
          * reader then cannot see the slice that just grew. A fixed corner keeps both
          * visible, and the numbers do not jump as the pointer moves.
          */}
        {hovered ? (
          <div
            className="pointer-events-none absolute right-0 top-0 rounded-ai-sm border border-ai-line bg-ai-bg-overlay px-2 py-1 text-[11px] shadow-ai-pop animate-ai-fade-in"
            data-ai-pie-tooltip
          >
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: hovered.color }} />
              <span className="text-ai-fg-secondary">{hovered.label}</span>
            </span>
            <span className="mt-0.5 block pl-3.5 tabular-nums text-ai-fg" data-ai-pie-tooltip-value={hovered.key}>
              {formatValue(hovered.value)}
              <span className="ml-1 text-ai-fg-muted">{formatPercent(hovered.percent)}</span>
            </span>
          </div>
        ) : null}
      </div>

      {showLegend ? (
        <ul className="min-w-0 flex-1 space-y-1.5 text-sm" data-ai-pie-legend>
          {drawn.items.map((item, index) => (
            <li
              key={item.key}
              data-ai-slice={item.key}
              data-ai-slice-value={item.value}
              data-ai-slice-percent={Math.round(item.percent * 10) / 10}
              data-ai-slice-active={activeIndex === index ? 'true' : undefined}
              /*
               * The legend is the second half of the hover: pointing at a row lifts the
               * matching sector, so a reader comparing two shares can highlight either
               * one from whichever side they are looking at. It is not a link or a
               * button — nothing is selected, so nothing claims to be.
               */
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              className={cn(
                'flex items-baseline justify-between gap-3 rounded-ai-sm px-1 transition-colors duration-ai-fast',
                activeIndex === index ? 'bg-ai-surface-2' : 'bg-transparent',
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
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

/**
 * The two slices a progress ring needs.
 *
 * `used` against the remainder of `total`. A `total` of zero (or a used value that
 * exceeds it, which an overcommitted pool can report) still draws the used part
 * rather than nothing: the ring is a gauge, and "over 100%" is information.
 */
export function progressSlices(used: number, total: number, labels: { used: string; free: string }): PieSlice[] {
  if (!Number.isFinite(used) || used <= 0) return [];
  const free = Number.isFinite(total) ? Math.max(0, total - used) : 0;
  const slices: PieSlice[] = [{ key: 'used', label: labels.used, value: used }];
  if (free > 0) slices.push({ key: 'free', label: labels.free, value: free });
  return slices;
}
