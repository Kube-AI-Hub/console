import { describe, expect, it } from 'vitest';
import { formatOverviewValue, overviewRatio } from '../apps/console-next/src/pages/cluster/overviewResourceMetrics';

/**
 * The overview's "missing is not zero" rules, as pure functions.
 *
 * These two helpers decide what a reader sees when the metrics backend does not answer: `undefined`
 * must render as `-`, never as `0`, and a ratio with no denominator must stay undefined rather than
 * becoming 0% (which reads as "nothing is used" instead of "we do not know").
 */
describe('overview metric rendering', () => {
  it('renders a missing value as a dash, never as zero', () => {
    expect(formatOverviewValue(undefined, 'bytes', 'cards')).toBe('-');
    expect(formatOverviewValue(Number.NaN, 'bytes', 'cards')).toBe('-');
    expect(formatOverviewValue(Number.POSITIVE_INFINITY, 'number', 'cards')).toBe('-');
  });

  it('keeps a real zero as zero', () => {
    expect(formatOverviewValue(0, 'bytes', 'cards')).toBe('0');
    expect(formatOverviewValue(0, 'cards', 'cards')).toBe('0 cards');
  });

  /*
   * Below MiB the value is rounded to a whole unit and from MiB up it keeps one decimal. That is
   * the existing contract (a 1536-byte object reads as `2KiB`), pinned here so a future "make it
   * more precise" change has to be deliberate.
   */
  it('formats bytes with the unit that fits', () => {
    expect(formatOverviewValue(1536, 'bytes', 'cards')).toBe('2KiB');
    expect(formatOverviewValue(1024 ** 3, 'bytes', 'cards')).toBe('1.0GiB');
    expect(formatOverviewValue(1.5 * 1024 ** 2, 'bytes', 'cards')).toBe('1.5MiB');
  });

  it('leaves a ratio undefined when either side is missing or the denominator is zero', () => {
    expect(overviewRatio(undefined, 10)).toBeUndefined();
    expect(overviewRatio(5, undefined)).toBeUndefined();
    expect(overviewRatio(5, 0)).toBeUndefined();
    expect(overviewRatio(5, 10)).toBe(0.5);
    expect(overviewRatio(0, 10)).toBe(0);
  });
});
