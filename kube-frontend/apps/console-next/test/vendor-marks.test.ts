import { describe, expect, it } from 'vitest';
import { DEFAULT_VENDOR_MARK, VENDOR_MARKS, hasVendorMark, vendorMark } from '../src/pages/cluster/vendorMarks';

/**
 * Vendor marks.
 *
 * Two things have to hold, and both are easy to break by accident:
 *
 * 1. **Every vendor draws something different.** The whole point is telling an
 *    NVIDIA node from a Cambricon one at a glance; a copy-paste that leaves two
 *    vendors sharing a path would look correct in a diff and be useless on screen.
 * 2. **The licence boundary holds.** These glyphs are authored here rather than
 *    copied from the old console's AGPL `src/assets/gpu-vendors` tree, so this file
 *    must not read from that directory — the check below is a cheap tripwire for a
 *    future edit that "just imports the real logo".
 */
describe('vendor marks', () => {
  it('draws a distinct path for every vendor', () => {
    const paths = Object.entries(VENDOR_MARKS).map(([vendor, mark]) => ({ vendor, path: mark.path }));
    const seen = new Map<string, string>();
    for (const { vendor, path } of paths) {
      expect(path.length, `${vendor} has no geometry`).toBeGreaterThan(20);
      const duplicate = seen.get(path);
      expect(duplicate, `${vendor} reuses ${duplicate}'s path`).toBeUndefined();
      seen.set(path, vendor);
    }
    // The fallback must not collide with a real vendor either.
    expect(seen.has(DEFAULT_VENDOR_MARK.path)).toBe(false);
  });

  it('names every vendor with a locale key', () => {
    for (const [vendor, mark] of Object.entries(VENDOR_MARKS)) {
      expect(mark.labelKey, `${vendor} has no label`).toMatch(/^node\.vendor\./);
    }
  });

  it('folds the vendor spellings that appear in labels', () => {
    // Some installations label a Huawei accelerator `huawei`, others `ascend`.
    expect(vendorMark('huawei')).toBe(VENDOR_MARKS.ascend);
    expect(vendorMark('ASCEND')).toBe(VENDOR_MARKS.ascend);
    expect(vendorMark('  Nvidia ')).toBe(VENDOR_MARKS.nvidia);
    expect(vendorMark('CPU')).toBe(VENDOR_MARKS.cpu);
  });

  it('falls back to a neutral mark for an unknown or absent vendor', () => {
    expect(vendorMark('some-new-chip')).toBe(DEFAULT_VENDOR_MARK);
    expect(vendorMark(undefined)).toBe(DEFAULT_VENDOR_MARK);
    expect(vendorMark('')).toBe(DEFAULT_VENDOR_MARK);
    expect(hasVendorMark('some-new-chip')).toBe(false);
    expect(hasVendorMark('cambricon')).toBe(true);
  });
});
