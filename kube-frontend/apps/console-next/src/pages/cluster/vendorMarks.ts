/**
 * Vendor marks for heterogeneous accelerators.
 *
 * Every glyph is drawn from scratch here rather than copied from the old console's
 * `src/assets/gpu-vendors` tree. That tree is AGPL-3.0 and this package is
 * Apache-2.0; the licence boundary is the reason this app was rewritten at all, so
 * importing a vendor icon from it would be the one copy that matters. The shapes
 * below are neutral, geometric abstractions of what each vendor's silicon is known
 * for — a stylised hexagon for Cambricon's Cambrian-explosion branding, a peak for
 * Kunlunxin, parallel slashes for Moore Threads — not reproductions of trademarked
 * logos.
 *
 * Consequence, stated plainly: these are **not** official logos and must not be
 * presented as such. They exist so a list can distinguish an NVIDIA node from a
 * Cambricon one at a glance, which is the job.
 *
 * All paths use `currentColor` and a 24×24 viewBox so they line up with the ai-kit
 * sprite and inherit the surrounding text colour.
 */

import type { IconName } from '@kube-ai-hub/ui';

/** One vendor's mark: a render function plus the accessible name key. */
export interface VendorMark {
  /** Path data drawn on a 24×24 grid with `currentColor`. */
  path: string;
  /** Locale key naming the vendor, used as the glyph's title. */
  labelKey: string;
}

/**
 * The vendor marks, keyed by the normalised vendor name.
 *
 * `cpu` is present because a node with no accelerator is a real and common case;
 * showing it with the same weight as a GPU vendor is what makes "3 NVIDIA + 1 CPU"
 * legible as a mix rather than as three GPUs and an unexplained blank.
 */
export const VENDOR_MARKS: Record<string, VendorMark> = {
  // A chip outline: die plus pins. Neutral, and the visual baseline every
  // accelerator mark is compared against.
  cpu: {
    path:
      'M9 9h6v6H9zM9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3M6 6h12v12H6z',
    labelKey: 'node.vendor.cpu',
  },
  // Two concentric eyes: NVIDIA's mark is an eye motif.
  nvidia: {
    path:
      'M12 4C7 4 3 7.6 1.5 12 3 16.4 7 20 12 20s9-3.6 10.5-8C21 7.6 17 4 12 4zm0 3.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9zm0 2.5a2 2 0 100 4 2 2 0 000-4z',
    labelKey: 'node.vendor.nvidia',
  },
  // Hexagon with a radiating star: Cambricon's "Cambrian explosion" theme.
  cambricon: {
    path:
      'M12 2l8.7 5v10L12 22l-8.7-5V7L12 2zm0 4.6L6.4 9.8v4.4L12 17.4l5.6-3.2V9.8L12 6.6zM12 9l2.2 3-2.2 3-2.2-3L12 9z',
    labelKey: 'node.vendor.cambricon',
  },
  // Eight petals around a core: Ascend's flower mark.
  ascend: {
    path:
      'M12 2c1.4 2.6 1.4 5.4 0 8-1.4-2.6-1.4-5.4 0-8zm0 20c-1.4-2.6-1.4-5.4 0-8 1.4 2.6 1.4 5.4 0 8zM2 12c2.6-1.4 5.4-1.4 8 0-2.6 1.4-5.4 1.4-8 0zm20 0c-2.6 1.4-5.4 1.4-8 0 2.6-1.4 5.4-1.4 8 0zM4.9 4.9c2.9.4 5.2 2.7 5.6 5.6-2.9-.4-5.2-2.7-5.6-5.6zm14.2 14.2c-2.9-.4-5.2-2.7-5.6-5.6 2.9.4 5.2 2.7 5.6 5.6zM19.1 4.9c-.4 2.9-2.7 5.2-5.6 5.6.4-2.9 2.7-5.2 5.6-5.6zM4.9 19.1c.4-2.9 2.7-5.2 5.6-5.6-.4 2.9-2.7 5.2-5.6 5.6z',
    labelKey: 'node.vendor.ascend',
  },
  // An H inside a chip: Hygon's letter mark.
  hygon: {
    path: 'M4 4h16v16H4V4zm3 3v10h2.5v-4h5v4H17V7h-2.5v3.5h-5V7H7z',
    labelKey: 'node.vendor.hygon',
  },
  // Paired arrows: MetaX's acceleration mark.
  metax: {
    path: 'M2 6l8 6-8 6V6zm9 0l8 6-8 6V6z',
    labelKey: 'node.vendor.metax',
  },
  // Twin flames: Enflame's mark.
  enflame: {
    path:
      'M11 2c3 3.6 1 7.6-1.6 11.6C7 17 9.5 20 12 21.5 9 22 5 20 4.6 16.4 4.2 12.8 9.4 9.6 11 2zm3.6 6.6c1.6 2.4-.6 4.8-1.8 7.4-1 2.2.4 4.2 1.4 5.2-2-.2-4.4-1.8-4-4.6.4-2.8 3.4-4.8 4.4-8z',
    labelKey: 'node.vendor.enflame',
  },
  // Two peaks on a base: Kunlunxin's mountain.
  kunlunxin: {
    path: 'M2 20l6-12 4 7 3-5 7 10H2zm14 0l3-4 3 4h-6z',
    labelKey: 'node.vendor.kunlunxin',
  },
  // Stacked chevrons: Iluvatar CoreX's forward arrows.
  iluvatar: {
    path: 'M3 5l9 7-9 7v-3.5L9 12 3 8.5V5zm9 0l9 7-9 7v-3.5L18 12l-6-3.5V5z',
    labelKey: 'node.vendor.iluvatar',
  },
  // Rounded "a" with a smile: Alibaba's mark.
  alibaba: {
    path:
      'M12 2a10 10 0 100 20 10 10 0 000-20zm-3.2 6h2.4l2.6 8h-2.3l-.5-1.8H8.4L7.9 16H5.6l3.2-8zm1.2 2.4l-1 3.2h1.9l-1-3.2zM16 8h2v8h-2V8z',
    labelKey: 'node.vendor.alibaba',
  },
  // Three parallel slashes: Moore Threads' "threads" motif.
  mthreads: {
    path: 'M4 4l4 16h3L7 4H4zm6.5 0l4 16h3l-4-16h-3zM17 4l4 16h3L20 4h-3z',
    labelKey: 'node.vendor.mthreads',
  },
};

/** A neutral fallback for a vendor nobody has drawn yet. */
export const DEFAULT_VENDOR_MARK: VendorMark = {
  path: 'M12 3l9 5v8l-9 5-9-5V8l9-5zm0 2.3L5.5 9v6L12 18.7 18.5 15V9L12 5.3z',
  labelKey: 'node.vendor.unknown',
};

/**
 * The mark for a vendor name, falling back to the neutral glyph.
 *
 * Names arrive from labels (`xpu-vendor`) in whatever case the operator typed, and
 * Huawei's accelerator is labelled `huawei` on some installations and `ascend` on
 * others, so both are folded before lookup.
 */
export function vendorMark(vendor: string | undefined): VendorMark {
  const normalized = String(vendor ?? '').trim().toLowerCase();
  if (!normalized) return DEFAULT_VENDOR_MARK;
  const folded = normalized === 'huawei' ? 'ascend' : normalized;
  return VENDOR_MARKS[folded] ?? DEFAULT_VENDOR_MARK;
}

/** Whether a vendor name has a dedicated glyph (used by tests). */
export function hasVendorMark(vendor: string): boolean {
  const normalized = vendor.trim().toLowerCase();
  return (normalized === 'huawei' ? 'ascend' : normalized) in VENDOR_MARKS;
}

/**
 * The ai-kit icon name for a vendor, when the sprite already has one.
 *
 * Only the CPU case maps to a sprite glyph; accelerator marks are drawn above
 * because the sprite has no per-vendor art.
 */
export const VENDOR_SPRITE_ICONS: Partial<Record<string, IconName>> = { cpu: 'cpu' };
