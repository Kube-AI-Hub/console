import { describe, expect, it } from 'vitest';
import {
  RANGE_PRESET_MS,
  formatRangeValue,
  gapForStep,
  parseRangeEdge,
  parseRangeValue,
  presetKeyOf,
  presetRange,
  resolveRange,
  sameRange,
  stepForSpan,
  stepToMs,
} from '../src/charts/timeRange';
import { pivotSeries } from '../src/charts/TimeSeriesChart';
import type { TimeSeries } from '../src/charts/TimeSeriesChart';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe('time range', () => {
  it('resolves a rolling window backwards from now, floored to the second', () => {
    const now = 1_700_000_000_999;
    const resolved = resolveRange(presetRange('1h'), now);
    // The API works in seconds: a millisecond remainder would make two identical
    // windows look different in the query key and refetch forever.
    expect(resolved.end).toBe(1_700_000_000_000);
    expect(resolved.start).toBe(1_700_000_000_000 - HOUR);
    expect(resolved.step).toBe('60s');
  });

  it('resolves a fixed span without moving it', () => {
    const range = { kind: 'absolute' as const, start: 1_700_000_000_000, end: 1_700_000_000_000 + 2 * HOUR };
    const first = resolveRange(range, 1_800_000_000_000);
    const later = resolveRange(range, 1_900_000_000_000);
    // A custom range must not follow the clock: that is the whole reason it exists.
    expect(first).toEqual(later);
    expect(first.start).toBe(range.start);
    expect(first.end).toBe(range.end);
  });

  it('derives the step from the span so the same length samples the same way', () => {
    // Two ways of selecting the same hour must not produce two different shapes.
    const relative = resolveRange(presetRange('1h'), 1_700_000_000_000);
    const absolute = resolveRange({ kind: 'absolute', start: 1_700_000_000_000 - HOUR, end: 1_700_000_000_000 });
    expect(relative.step).toBe(absolute.step);
  });

  it('keeps a window between roughly 30 and 200 samples at every preset', () => {
    for (const [key, ms] of Object.entries(RANGE_PRESET_MS)) {
      const step = stepToMs(stepForSpan(ms));
      const samples = ms / step;
      expect(samples, `${key} → ${step}`).toBeGreaterThanOrEqual(30);
      expect(samples, `${key} → ${step}`).toBeLessThanOrEqual(200);
    }
  });

  it('scales the gap threshold with the step', () => {
    expect(gapForStep('15s')).toBe(45_000);
    expect(gapForStep('1h')).toBe(3 * HOUR);
    // An unparseable step falls back to a minute rather than producing NaN.
    expect(gapForStep('nonsense')).toBe(3 * MINUTE);
  });

  it('identifies the preset behind a relative range', () => {
    expect(presetKeyOf(presetRange('30m'))).toBe('30m');
    expect(presetKeyOf({ kind: 'absolute', start: 0, end: 1 })).toBeUndefined();
  });

  it('compares ranges by preset identity or by instant', () => {
    expect(sameRange(presetRange('1h'), presetRange('1h'))).toBe(true);
    expect(sameRange(presetRange('1h'), presetRange('2h'))).toBe(false);
    expect(sameRange({ kind: 'absolute', start: 1, end: 2 }, { kind: 'absolute', start: 1, end: 2 })).toBe(true);
    expect(sameRange(presetRange('1h'), { kind: 'absolute', start: 1, end: 2 })).toBe(false);
  });

  it('round-trips a span through the DatePicker value shape', () => {
    // `DatePicker range withTime` emits `start,end` with `YYYY-MM-DD HH:mm` edges.
    const start = new Date(2026, 10, 19, 9, 26).getTime();
    const end = new Date(2026, 10, 19, 10, 31).getTime();
    const value = formatRangeValue(start, end);
    expect(value).toBe('2026-11-19 09:26,2026-11-19 10:31');
    expect(parseRangeValue(value)).toEqual({ kind: 'absolute', start, end });
  });

  it('rejects a half-finished or inverted pair instead of guessing', () => {
    // A half-picked range is a state the calendar shows; it is not an error the
    // caller should have to explain, and it must not silently become "now".
    expect(parseRangeValue('2026-11-19 09:26,')).toBeUndefined();
    expect(parseRangeValue(',2026-11-19 09:26')).toBeUndefined();
    expect(parseRangeValue('2026-11-19 10:31,2026-11-19 09:26')).toBeUndefined();
    expect(parseRangeValue('not a date,also not')).toBeUndefined();
  });

  it('parses an edge without seconds, and keeps seconds when present', () => {
    expect(parseRangeEdge('2026-11-19 09:26')).toBe(new Date(2026, 10, 19, 9, 26).getTime());
    expect(parseRangeEdge('2026-11-19 09:26:52')).toBe(new Date(2026, 10, 19, 9, 26, 52).getTime());
    expect(Number.isNaN(parseRangeEdge(''))).toBe(true);
  });
});

describe('series pivot', () => {
  const line = (key: string, points: Array<[number, number]>): TimeSeries => ({
    key,
    label: key,
    points: points.map(([at, value]) => ({ at, value })),
  });

  it('puts every series on one row per instant, with null where a series has none', () => {
    const { rows } = pivotSeries([line('a', [[0, 1], [100, 2]]), line('b', [[100, 5]])], 0, 100);
    expect(rows).toEqual([
      { at: 0, a: 1, b: null },
      { at: 100, a: 2, b: 5 },
    ]);
  });

  it('marks a sample after a gap as null so the line breaks instead of bridging', () => {
    // A bridged gap draws a straight line across a period with no samples, which is
    // how a node that stopped reporting looks healthy. The null goes in the middle of
    // the gap so every real sample stays readable in the tooltip.
    const { rows } = pivotSeries([line('a', [[0, 1], [10, 2], [90, 3]])], 0, 100, 30);
    const values = rows.map((row) => row['a']);
    expect(values).toEqual([1, 2, null, 3]);
    // The first sample after the hole keeps its own value.
    expect(rows[rows.length - 1]!.a).toBe(3);
  });

  it('drops samples outside the window and non-finite values', () => {
    const { rows } = pivotSeries([line('a', [[-10, 1], [0, 2], [50, Number.NaN], [100, 3], [200, 4]])], 0, 100);
    expect(rows.map((row) => row['a'])).toEqual([2, 3]);
  });

  it('excludes hidden series from the drawing but keeps them in the input', () => {
    const series = [{ ...line('a', [[0, 1]]), hidden: true }, line('b', [[0, 2]])];
    const { rows, visible } = pivotSeries(series, 0, 100);
    expect(visible.map((entry) => entry.key)).toEqual(['b']);
    expect(rows).toEqual([{ at: 0, b: 2 }]);
  });

  it('sorts samples that arrive out of order', () => {
    const { rows } = pivotSeries([line('a', [[100, 2], [0, 1], [50, 3]])], 0, 100);
    expect(rows.map((row) => row['at'])).toEqual([0, 50, 100]);
  });
});
