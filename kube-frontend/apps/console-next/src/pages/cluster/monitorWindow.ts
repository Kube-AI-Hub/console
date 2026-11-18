/**
 * The shared time window for the cluster monitor.
 *
 * The page header owns one window control and one auto-refresh switch; every tab
 * reads through the same `start`/`end`/`step`, so moving the window re-queries
 * whichever tab is mounted and nothing else. Keeping the arithmetic here (rather
 * than in the page) means a tab can be mounted in isolation -- a unit test or a
 * story -- and still get a consistent range.
 *
 * The window drives the step, because the API returns raw samples: asking for seven
 * days at 60-second resolution is 10,080 points per metric over the wire and rendered
 * as a smear. Each window has a step that keeps the series near 60 points.
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
  return { start: end - windowFor(key).ms, end };
}
