import {
  RANGE_PRESET_MS,
  gapForStep,
  presetRange,
  resolveRange,
  stepForSpan,
  stepToMs,
  type TimeRange,
} from '@kube-ai-hub/ui/charts';

/**
 * The shared time window for the cluster monitor.
 *
 * The page header owns one range control and one auto-refresh switch; every tab
 * reads through the same `start`/`end`/`step`, so moving the window re-queries
 * whichever tab is mounted and nothing else. Keeping the arithmetic here (rather
 * than in the page) means a tab can be mounted in isolation -- a unit test or a
 * story -- and still get a consistent range.
 *
 * The presets and the step ladder live in ai-kit (`charts/timeRange`), shared with
 * the other monitoring surfaces: two copies would sample the same hour differently
 * depending on which page asked, and the same incident would draw two shapes.
 */

/** The windows the header offers, in display order. `step` is a Prometheus duration. */
export const WINDOWS = [
  { key: '1h', ms: 60 * 60 * 1000, step: '60s' },
  { key: '6h', ms: 6 * 60 * 60 * 1000, step: '5m' },
  { key: '24h', ms: 24 * 60 * 60 * 1000, step: '15m' },
  { key: '7d', ms: 7 * 24 * 60 * 60 * 1000, step: '2h' },
] as const;

export type WindowKey = (typeof WINDOWS)[number]['key'];

/** One entry of {@link WINDOWS}. */
export type MonitorWindow = (typeof WINDOWS)[number];

/** An absolute epoch-milliseconds range. */
export interface MonitorRange {
  start: number;
  end: number;
  /** Prometheus duration the query should use. */
  step: string;
}

/** How often 自动刷新 moves the window forward, matching the old console's monitor. */
export const AUTO_REFRESH_INTERVAL_MS = 5_000;

/** The default window a freshly opened monitor page uses. */
export const DEFAULT_WINDOW_KEY: WindowKey = '1h';

/** Narrow an unknown search value to a window key. */
export function isWindowKey(value: unknown): value is WindowKey {
  return typeof value === 'string' && WINDOWS.some((entry) => entry.key === value);
}

/** The entry for a key; falls back to the first window for values a caller made up. */
export function windowFor(key: WindowKey): MonitorWindow {
  return WINDOWS.find((entry) => entry.key === key) ?? WINDOWS[0];
}

/**
 * Resolve a window to absolute timestamps.
 *
 * The range is computed once per window selection (or per auto-refresh tick) and
 * then held in state: `end: Date.now()` inside a query key would change on every
 * paint and refetch forever. The end is rounded down to a whole second because the
 * monitoring API works in seconds.
 */
export function rangeForWindow(key: WindowKey, now: number = Date.now()): MonitorRange {
  const end = Math.floor(now / 1000) * 1000;
  return { start: end - windowFor(key).ms, end, step: windowFor(key).step };
}

/**
 * The presets the header's range control offers, as ai-kit presets.
 *
 * The four `WINDOWS` stay for the tab query keys; the control offers the full
 * ladder so a reader can ask for 10 minutes after an incident.
 */
export const MONITOR_PRESET_KEYS = Object.keys(RANGE_PRESET_MS);

/** A selected range plus the step it should query with. */
export interface ResolvedMonitorRange extends MonitorRange {
  /** Identity for query keys: the preset key, or `custom` for a fixed span. */
  rangeKey: string;
}

/**
 * Resolve any selection to the absolute range the tabs query.
 *
 * A relative selection is re-resolved against `now` on every call, which is what
 * makes auto-refresh move the window forward; a fixed span is returned as-is, which
 * is what makes an incident comparison keep its axis still.
 */
export function resolveMonitorRange(range: TimeRange, step?: string, now: number = Date.now()): ResolvedMonitorRange {
  const resolved = resolveRange(range, now);
  return {
    start: resolved.start,
    end: resolved.end,
    step: step ?? resolved.step,
    rangeKey: range.kind === 'absolute' ? 'custom' : range.key,
  };
}

/** The default selection, as the ai-kit range type. */
export function defaultMonitorRange(): TimeRange {
  return presetRange(DEFAULT_WINDOW_KEY);
}

/** A gap threshold for a step, so a scrape hole breaks the line. */
export function monitorGap(step: string): number {
  return gapForStep(step);
}

/** Re-exported so a tab can derive a step without importing ai-kit directly. */
export { stepForSpan, stepToMs };
