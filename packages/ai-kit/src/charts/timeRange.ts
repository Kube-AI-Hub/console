/**
 * The time range a monitoring chart is showing.
 *
 * Two kinds of range, because readers ask two different questions:
 *
 * - **A rolling window** ("最近 1 小时") always ends now, so an auto-refreshing
 *   chart keeps moving forward. This is what an operator watching a rollout wants.
 * - **A fixed span** ("09:00 到 10:30") ends where it ends. A reader comparing an
 *   incident against a known interval needs the axis to stop moving; a rolling
 *   window would silently re-sample different minutes on every refresh.
 *
 * Keeping both in one type is what lets a single picker serve every monitoring
 * surface: the quick presets are rolling windows, and the custom range is a fixed
 * span. `resolveRange` is the only place that turns a selection into the absolute
 * epoch-milliseconds pair the API and the charts need.
 *
 * `step` is derived from the span rather than asked for: the API returns raw
 * samples, and requesting seven days at 60-second resolution is 10,080 points per
 * metric over the wire and a smear on screen.
 */

/** A rolling window: `now - ms` … `now`. */
export interface RelativeRange {
  kind: 'relative';
  /** Stable identity for the preset, e.g. `1h`. */
  key: string;
  ms: number;
}

/** An absolute span the reader picked. */
export interface AbsoluteRange {
  kind: 'absolute';
  start: number;
  end: number;
}

export type TimeRange = RelativeRange | AbsoluteRange;

/** An absolute epoch-millisecond pair, plus the sampling step the API should use. */
export interface ResolvedRange {
  start: number;
  end: number;
  /** Prometheus duration (`60s`, `5m`, `2h`). */
  step: string;
}

/** One quick preset. `label` is display text supplied by the host (it is localised there). */
export interface RangePreset {
  key: string;
  label: string;
  ms: number;
}

/**
 * The presets every monitoring surface offers, in ascending order.
 *
 * The old console's picker listed 10m / 20m / 30m / 1h / 2h / 3h / 5h / 12h /
 * 1d / 2d / 3d / 7d in three columns; this is the same set as a flat list, which
 * keeps the menu one scrolling column instead of a nested grid on a phone.
 *
 * `ms` values are exact multiples so a test can assert them without arithmetic.
 */
export const RANGE_PRESET_MS: Readonly<Record<string, number>> = {
  '10m': 10 * 60 * 1000,
  '20m': 20 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '2h': 2 * 60 * 60 * 1000,
  '3h': 3 * 60 * 60 * 1000,
  '5h': 5 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '2d': 2 * 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

/** Preset keys in display order (shortest first). */
export const RANGE_PRESET_KEYS = Object.keys(RANGE_PRESET_MS) as readonly string[];

/**
 * Sample counts each step aims for.
 *
 * A chart is ~600 CSS pixels wide, so more than ~120 points cannot be told apart
 * and only makes the payload bigger. The steps below keep a window between roughly
 * 30 and 120 samples, which is dense enough to show a spike and light enough to
 * arrive in one request.
 */
const STEP_LADDER: ReadonlyArray<{ maxSpanMs: number; step: string }> = [
  { maxSpanMs: 30 * 60 * 1000, step: '15s' }, // ≤ 30m → 120 points
  { maxSpanMs: 2 * 60 * 60 * 1000, step: '60s' }, // ≤ 2h → 120 points
  { maxSpanMs: 6 * 60 * 60 * 1000, step: '2m' }, // ≤ 6h → 180 points
  { maxSpanMs: 12 * 60 * 60 * 1000, step: '5m' }, // ≤ 12h → 144 points
  { maxSpanMs: 24 * 60 * 60 * 1000, step: '10m' }, // ≤ 1d → 144 points
  { maxSpanMs: 3 * 24 * 60 * 60 * 1000, step: '30m' }, // ≤ 3d → 144 points
  { maxSpanMs: 7 * 24 * 60 * 60 * 1000, step: '1h' }, // ≤ 7d → 168 points
];

/** The fallback for spans longer than a week. */
const LONG_STEP = '2h';

/**
 * The sampling step for a span.
 *
 * Derived from the span rather than stored with the preset: a custom range has no
 * preset to inherit from, and two ranges of the same length must sample the same
 * way or the same incident looks different depending on how it was selected.
 */
export function stepForSpan(spanMs: number): string {
  if (!Number.isFinite(spanMs) || spanMs <= 0) return '60s';
  for (const entry of STEP_LADDER) {
    if (spanMs <= entry.maxSpanMs) return entry.step;
  }
  return LONG_STEP;
}

/**
 * A gap in the samples that starts a new line instead of bridging it.
 *
 * Three steps: one missed scrape is a hole, not a straight line drawn across it —
 * and drawing across it is how a stopped node looks like a healthy one. Scaled
 * from the step rather than fixed so a 15-second window and a 2-hour window behave
 * the same way.
 */
export function gapForStep(step: string): number {
  const ms = stepToMs(step);
  return ms * 3;
}

/** `60s` / `5m` / `2h` → milliseconds. Unparseable values fall back to a minute. */
export function stepToMs(step: string): number {
  const match = /^(\d+)([smhd])$/.exec(step.trim());
  if (!match) return 60_000;
  const value = Number(match[1]);
  const unit = match[2];
  const factor = unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return value * factor;
}

/**
 * Turn a selection into absolute timestamps.
 *
 * The end is floored to a whole second because the monitoring API works in
 * seconds; a millisecond remainder in the query key would otherwise make two
 * identical windows look different and refetch.
 *
 * A relative range is resolved against `now` at call time. That is deliberate: an
 * auto-refreshing chart must move its window forward, so the caller re-resolves on
 * each tick rather than freezing the range once.
 */
export function resolveRange(range: TimeRange, now: number = Date.now()): ResolvedRange {
  const end = range.kind === 'absolute' ? Math.floor(range.end / 1000) * 1000 : Math.floor(now / 1000) * 1000;
  const start = range.kind === 'absolute' ? Math.floor(range.start / 1000) * 1000 : end - range.ms;
  const span = Math.max(1, end - start);
  return { start, end, step: stepForSpan(span) };
}

/** A preset as a relative range. */
export function presetRange(key: string): RelativeRange {
  return { kind: 'relative', key, ms: RANGE_PRESET_MS[key] ?? RANGE_PRESET_MS['1h']! };
}

/**
 * The preset key a relative range corresponds to, or `undefined` for a custom span.
 *
 * Lets a picker highlight the active preset without the host keeping a second copy
 * of the selection.
 */
export function presetKeyOf(range: TimeRange): string | undefined {
  if (range.kind !== 'relative') return undefined;
  const match = RANGE_PRESET_KEYS.find((key) => RANGE_PRESET_MS[key] === range.ms);
  return match ?? range.key;
}

/**
 * Whether two selections describe the same window.
 *
 * Absolute spans compare by value so a re-pick of the same instants does not look
 * like a change; relative ranges compare by preset identity, because their
 * resolved timestamps move every second by design.
 */
export function sameRange(left: TimeRange, right: TimeRange): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === 'relative' && right.kind === 'relative') return left.ms === right.ms;
  if (left.kind === 'absolute' && right.kind === 'absolute') return left.start === right.start && left.end === right.end;
  return false;
}

/**
 * `YYYY-MM-DD HH:mm` — the shape `DatePicker` emits with `withTime`.
 *
 * A monitoring window does not need seconds: a range that starts at 09:26 and ends
 * at 10:31 is what a reader picks, and asking for seconds in a calendar popover is
 * friction with no answer behind it.
 */
export function formatRangeEdge(at: number): string {
  const date = new Date(at);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The `DatePicker range` value for a span: `start,end`. */
export function formatRangeValue(start: number, end: number): string {
  return `${formatRangeEdge(start)},${formatRangeEdge(end)}`;
}

/**
 * Parse one `YYYY-MM-DD HH:mm[:ss]` edge.
 *
 * Parsed by parts rather than `new Date(text)`: engines disagree about the
 * space-separated form, and a range silently landing in 1970 is worse than a
 * rejected input.
 */
export function parseRangeEdge(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value.trim());
  if (!match) return Number.NaN;
  const [, year, month, day, hour, minute, second] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour ?? 0),
    Number(minute ?? 0),
    Number(second ?? 0),
  ).getTime();
}

/**
 * Parse what `DatePicker range withTime` emits into an absolute range.
 *
 * Returns `undefined` for anything that is not a complete, ordered pair: a
 * half-finished selection is a state the picker itself shows, not an error the
 * caller has to explain.
 */
export function parseRangeValue(value: string): AbsoluteRange | undefined {
  const [startText, endText] = value.split(',').map((part) => part.trim());
  if (!startText || !endText) return undefined;
  const start = parseRangeEdge(startText);
  const end = parseRangeEdge(endText);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return undefined;
  return { kind: 'absolute', start, end };
}

/** What the picker's trigger reads: the preset label, or the custom span. */
export function describeRange(
  range: TimeRange,
  presets: readonly RangePreset[],
  formatAbsolute: (start: number, end: number) => string,
): string {
  if (range.kind === 'absolute') return formatAbsolute(range.start, range.end);
  const preset = presets.find((entry) => entry.ms === range.ms);
  return preset?.label ?? range.key;
}
