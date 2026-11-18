import { describe, expect, it } from 'vitest';
import { CPU_MARK, VENDOR_MARKS, hasVendorMark, vendorMark } from '../src/pages/cluster/vendorMarks';

/**
 * Vendor marks.
 *
 * Two things have to hold, and both are easy to break by accident:
 *
 * 1. **Every vendor draws something different.** The whole point is telling an
 *    NVIDIA node from a Cambricon one at a glance; a transcription slip that leaves
 *    two vendors with the same geometry would look fine in a diff and be useless on
 *    screen.
 * 2. **The port stayed a port.** These are transcribed from
 *    `console/src/assets/gpu-vendors`, not redrawn, so each mark must keep the
 *    source's own `viewBox` — the vendors' artwork does not share a coordinate
 *    system, and normalising them all to 24×24 would silently distort four of them.
 */
describe('vendor marks', () => {
  it('gives every vendor its own geometry', () => {
    const signatures = new Map<string, string>();
    for (const [vendor, mark] of Object.entries(VENDOR_MARKS)) {
      expect(mark.parts.length, `${vendor} has no geometry`).toBeGreaterThan(0);
      const signature = JSON.stringify(mark.parts);
      const duplicate = signatures.get(signature);
      expect(duplicate, `${vendor} reuses ${duplicate}'s geometry`).toBeUndefined();
      signatures.set(signature, vendor);
    }
    expect(signatures.has(JSON.stringify(CPU_MARK.parts))).toBe(false);
  });

  it('keeps each source viewBox instead of forcing one grid', () => {
    // Enflame is 27×47 and MetaX 107×88 in the originals; squashing either into a
    // 24×24 box changes the mark's proportions.
    expect(VENDOR_MARKS.enflame?.viewBox).toBe('2 1.3 27 47');
    expect(VENDOR_MARKS.metax?.viewBox).toBe('227 0 107 88');
    expect(VENDOR_MARKS.nvidia?.viewBox).toBe('0 0 24 24');
    expect(VENDOR_MARKS.cambricon?.viewBox).toBe('0 0 100 100');
  });

  it('names every vendor with a locale key', () => {
    for (const [vendor, mark] of Object.entries(VENDOR_MARKS)) {
      expect(mark.labelKey, `${vendor} has no label`).toMatch(/^node\.vendor\./);
    }
    expect(CPU_MARK.labelKey).toBe('node.vendor.cpu');
  });

  it('folds the vendor spellings that appear in labels', () => {
    // Some installations label a Huawei accelerator `huawei`, others `ascend`.
    expect(vendorMark('huawei')).toBe(VENDOR_MARKS.ascend);
    expect(vendorMark('ASCEND')).toBe(VENDOR_MARKS.ascend);
    expect(vendorMark('  Nvidia ')).toBe(VENDOR_MARKS.nvidia);
    expect(vendorMark('CPU')).toBe(CPU_MARK);
  });

  it('falls back to the neutral mark for an unknown or absent vendor', () => {
    expect(vendorMark('some-new-chip')).toBe(VENDOR_MARKS._default);
    expect(vendorMark(undefined)).toBe(VENDOR_MARKS._default);
    expect(vendorMark('')).toBe(VENDOR_MARKS._default);
    expect(hasVendorMark('some-new-chip')).toBe(false);
    expect(hasVendorMark('cambricon')).toBe(true);
    expect(hasVendorMark('cpu')).toBe(true);
  });
});
