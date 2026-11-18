/**
 * Accelerator vendor marks.
 *
 * **Ported from `console/src/assets/gpu-vendors`.** Those files were themselves
 * brought into the old console from elsewhere: NVIDIA and Ascend use simple-icons
 * paths (CC0), Enflame and MetaX were extracted from the vendors' own published
 * SVG, and the rest were drawn from each vendor's visual identity. The licensing
 * was reviewed before this port and permits reuse here.
 *
 * They are inlined as geometry rather than imported as `.svg` files because this
 * app has no SVGR plugin, and adding one for twelve static glyphs would put a build
 * dependency in the critical path of every page. The markup is a mechanical
 * transcription of the source files — same `viewBox`, same elements, same
 * fill/stroke — so the shapes are identical, not redrawn.
 *
 * Every mark uses `currentColor` so it inherits the tile's tone, and keeps its own
 * `viewBox` because the vendors' artwork does not share a coordinate system
 * (Enflame is 27×47, MetaX 107×88, the rest 24×24 or 100×100).
 */

import type { IconName } from '@kube-ai-hub/ui';

export interface VendorPart {
  tag: 'path' | 'circle' | 'rect' | 'polygon';
  /** Geometry attributes, verbatim from the source SVG. */
  [attribute: string]: string;
}

export interface VendorMark {
  viewBox: string;
  parts: VendorPart[];
  /** Locale key naming the vendor, used as the glyph's accessible name. */
  labelKey: string;
}

/** Vendor marks keyed by the normalised vendor name. */
export const VENDOR_MARKS: Record<string, VendorMark> = {
  // nvidia
  nvidia: {
    viewBox: '0 0 24 24',
    labelKey: 'node.vendor.nvidia',
    parts: [
      { tag: 'path', d: 'M8.948 8.798v-1.43a6.7 6.7 0 0 1 .424-.018c3.922-.124 6.493 3.374 6.493 3.374s-2.774 3.851-5.75 3.851c-.398 0-.787-.062-1.158-.185v-4.346c1.528.185 1.837.857 2.747 2.385l2.04-1.714s-1.492-1.952-4-1.952a6.016 6.016 0 0 0-.796.035m0-4.735v2.138l.424-.027c5.45-.185 9.01 4.47 9.01 4.47s-4.08 4.964-8.33 4.964c-.37 0-.733-.035-1.095-.097v1.325c.3.035.61.062.91.062 3.957 0 6.82-2.023 9.593-4.408.459.371 2.34 1.263 2.73 1.652-2.633 2.208-8.772 3.984-12.253 3.984-.335 0-.653-.018-.971-.053v1.864H24V4.063zm0 10.326v1.131c-3.657-.654-4.673-4.46-4.673-4.46s1.758-1.944 4.673-2.262v1.237H8.94c-1.528-.186-2.73 1.245-2.73 1.245s.68 2.412 2.739 3.11M2.456 10.9s2.164-3.197 6.5-3.533V6.201C4.153 6.59 0 10.653 0 10.653s2.35 6.802 8.948 7.42v-1.237c-4.84-.6-6.492-5.936-6.492-5.936z' },
    ],
  },
  // cambricon
  cambricon: {
    viewBox: '0 0 100 100',
    labelKey: 'node.vendor.cambricon',
    parts: [
      { tag: 'polygon', points: '50,4 93,27.5 93,72.5 50,96 7,72.5 7,27.5', fill: 'none', stroke: 'currentColor', strokeWidth: '6' },
      { tag: 'polygon', points: '50,20 58,38 76,40 63,53 67,71 50,63 33,71 37,53 24,40 42,38' },
    ],
  },
  // ascend
  ascend: {
    viewBox: '0 0 24 24',
    labelKey: 'node.vendor.ascend',
    parts: [
      { tag: 'path', d: 'M3.67 6.14S1.82 7.91 1.72 9.78v.35c.08 1.51 1.22 2.4 1.22 2.4 1.83 1.79 6.26 4.04 7.3 4.55 0 0 .06.03.1-.01l.02-.04v-.04C7.52 10.8 3.67 6.14 3.67 6.14zM9.65 18.6c-.02-.08-.1-.08-.1-.08l-7.38.26c.8 1.43 2.15 2.53 3.56 2.2.96-.25 3.16-1.78 3.88-2.3.06-.05.04-.09.04-.09zm.08-.78C6.49 15.63.21 12.28.21 12.28c-.15.46-.2.9-.21 1.3v.07c0 1.07.4 1.82.4 1.82.8 1.69 2.34 2.2 2.34 2.2.7.3 1.4.31 1.4.31.12.02 4.4 0 5.54 0 .05 0 .08-.05.08-.05v-.06c0-.03-.03-.05-.03-.05zM9.06 3.19a3.42 3.42 0 00-2.57 3.15v.41c.03.6.16 1.05.16 1.05.66 2.9 3.86 7.65 4.55 8.65.05.05.1.03.1.03a.1.1 0 00.06-.1c1.06-10.6-1.11-13.42-1.11-13.42-.32.02-1.19.23-1.19.23zm8.299 2.27s-.49-1.8-2.44-2.28c0 0-.57-.14-1.17-.22 0 0-2.18 2.81-1.12 13.43.01.07.06.08.06.08.07.03.1-.03.1-.03.72-1.03 3.9-5.76 4.55-8.64 0 0 .36-1.4.02-2.34zm-2.92 13.07s-.07 0-.09.05c0 0-.01.07.03.1.7.51 2.85 2 3.88 2.3 0 0 .16.05.43.06h.14c.69-.02 1.9-.37 3-2.26l-7.4-.25zm7.83-8.41c.14-2.06-1.94-3.97-1.94-3.98 0 0-3.85 4.66-6.67 10.8 0 0-.03.08.02.13l.04.01h.06c1.06-.53 5.46-2.77 7.28-4.54 0 0 1.15-.93 1.21-2.42zm1.52 2.14s-6.28 3.37-9.52 5.55c0 0-.05.04-.03.11 0 0 .03.06.07.06 1.16 0 5.56 0 5.67-.02 0 0 .57-.02 1.27-.29 0 0 1.56-.5 2.37-2.27 0 0 .73-1.45.17-3.14z' },
    ],
  },
  // hygon
  hygon: {
    viewBox: '0 0 100 100',
    labelKey: 'node.vendor.hygon',
    parts: [
      { tag: 'rect', x: '6', y: '6', width: '88', height: '88', rx: '10', fill: 'none', stroke: 'currentColor', strokeWidth: '6' },
      { tag: 'rect', x: '22', y: '24', width: '14', height: '52', rx: '3' },
      { tag: 'rect', x: '64', y: '24', width: '14', height: '52', rx: '3' },
      { tag: 'rect', x: '22', y: '43', width: '56', height: '14', rx: '3' },
    ],
  },
  // metax
  metax: {
    viewBox: '227 0 107 88',
    labelKey: 'node.vendor.metax',
    parts: [
      { tag: 'polygon', points: '239.42 25.88 264.23 50.77 227.25 87.74 245.81 87.74 282.79 50.77 257.97 25.88' },
      { tag: 'polygon', points: '315.01 0 278.65 36.36 287.93 45.64 333.57 0' },
      { tag: 'polygon', points: '301.27 87.74 278.65 65.2 287.93 55.92 319.83 87.74' },
    ],
  },
  // enflame
  enflame: {
    viewBox: '2 1.3 27 47',
    labelKey: 'node.vendor.enflame',
    parts: [
      { tag: 'path', d: 'M11.9,1.3C16,6.9,10.6,14.6,2,27.7c-8.6,13.1,13.6,19.8,15,20.4c1.4,0.6-10.7-5.9-8.2-13.8 c2.6-7.9,8.9-12.7,10.1-18.7C20.1,9.6,7.7-4.3,11.9,1.3z' },
      { tag: 'path', d: 'M24,18.3c2.4,3.2-0.7,7.6-5.7,15.2c-4.2,6.3,0.4,10.7,2.4,12.2c0.4,0.3,2.2,1.5,2.2,1.5 s-2.7-4.6-0.7-9.9c1.7-4.5,5.1-7.3,5.8-10.7C28.7,23,21.6,15,24,18.3z' },
    ],
  },
  // kunlunxin
  kunlunxin: {
    viewBox: '0 0 100 100',
    labelKey: 'node.vendor.kunlunxin',
    parts: [
      { tag: 'polygon', points: '10,80 35,25 53,62' },
      { tag: 'polygon', points: '47,80 65,20 90,80' },
      { tag: 'rect', x: '10', y: '80', width: '80', height: '10', rx: '3' },
    ],
  },
  // iluvatar
  iluvatar: {
    viewBox: '0 0 100 100',
    labelKey: 'node.vendor.iluvatar',
    parts: [
      { tag: 'polygon', points: '10,20 55,50 10,80 28,80 73,50 28,20' },
      { tag: 'polygon', points: '42,32 72,50 42,68 54,68 84,50 54,32' },
    ],
  },
  // alibaba
  alibaba: {
    viewBox: '0 0 100 100',
    labelKey: 'node.vendor.alibaba',
    parts: [
      { tag: 'circle', cx: '46', cy: '50', r: '30', fill: 'none', stroke: 'currentColor', strokeWidth: '10' },
      { tag: 'rect', x: '70', y: '30', width: '10', height: '46', rx: '5' },
      { tag: 'path', d: 'M 28 55 Q 46 72 64 55', fill: 'none', stroke: 'currentColor', strokeWidth: '8', strokeLinecap: 'round' },
    ],
  },
  // mthreads
  mthreads: {
    viewBox: '0 0 100 100',
    labelKey: 'node.vendor.mthreads',
    parts: [
      { tag: 'rect', x: '8', y: '8', width: '84', height: '14', rx: '7', transform: 'rotate(-38 50 50)' },
      { tag: 'rect', x: '8', y: '30', width: '84', height: '14', rx: '7', transform: 'rotate(-38 50 50)' },
      { tag: 'rect', x: '8', y: '52', width: '84', height: '14', rx: '7', transform: 'rotate(-38 50 50)' },
    ],
  },
  // default
  _default: {
    viewBox: '0 0 24 24',
    labelKey: 'node.vendor.unknown',
    parts: [
      { tag: 'rect', x: '2', y: '2', width: '20', height: '20', rx: '4', fill: 'none', stroke: 'currentColor', strokeWidth: '2' },
      { tag: 'circle', cx: '12', cy: '12', r: '4' },
    ],
  },
};

/**
 * CPU nodes: no accelerator at all.
 *
 * Drawn here rather than ported, because the old set had no CPU mark — it used the
 * absence of a vendor label. A dedicated glyph matters once a list mixes CPU-only
 * nodes with accelerators: "no card" is a fact to show, not a blank.
 */
export const CPU_MARK: VendorMark = {
  viewBox: '0 0 24 24',
  labelKey: 'node.vendor.cpu',
  parts: [
    { tag: 'rect', x: '6', y: '6', width: '12', height: '12', rx: '1.5', fill: 'none', stroke: 'currentColor', strokeWidth: '1.6' },
    { tag: 'rect', x: '9.5', y: '9.5', width: '5', height: '5', rx: '0.5' },
    { tag: 'path', d: 'M9 3v2M12 3v2M15 3v2M9 19v2M12 19v2M15 19v2M3 9h2M3 12h2M3 15h2M19 9h2M19 12h2M19 15h2', fill: 'none', stroke: 'currentColor', strokeWidth: '1.6', strokeLinecap: 'round' },
  ],
};

/** The mark for a vendor, falling back to the neutral glyph the old set shipped. */
export function vendorMark(vendor: string | undefined): VendorMark {
  const normalized = String(vendor ?? '').trim().toLowerCase();
  if (!normalized) return VENDOR_MARKS._default!;
  // Some installations label a Huawei accelerator `huawei`, others `ascend`.
  const folded = normalized === 'huawei' ? 'ascend' : normalized;
  if (folded === 'cpu') return CPU_MARK;
  return VENDOR_MARKS[folded] ?? VENDOR_MARKS._default!;
}

/** Whether a vendor name has its own mark (used by tests). */
export function hasVendorMark(vendor: string): boolean {
  const normalized = vendor.trim().toLowerCase();
  if (normalized === 'cpu') return true;
  return (normalized === 'huawei' ? 'ascend' : normalized) in VENDOR_MARKS;
}

/** Sprite icon for CPU, when a caller would rather use the shared sprite. */
export const VENDOR_SPRITE_ICONS: Partial<Record<string, IconName>> = { cpu: 'cpu' };
