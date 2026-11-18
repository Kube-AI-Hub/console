import * as React from 'react';
import { cn } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { vendorMark } from './vendorMarks';

/**
 * One vendor's mark, sized for a statistics tile.
 *
 * `currentColor` throughout, so the glyph takes the tile's tone: a healthy cluster
 * draws every vendor in the foreground colour, and an attention state tints the
 * whole row without a second styling rule.
 */
export function VendorIcon({ vendor, size = 20, className }: {
  vendor: string | undefined; size?: number; className?: string;
}): React.ReactElement {
  const t = useT();
  const mark = vendorMark(vendor);
  const label = t(mark.labelKey as Parameters<typeof t>[0]);
  return <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label={label}
    className={cn('shrink-0 fill-current', className)} data-vendor={vendor || 'unknown'}>
    <title>{label}</title>
    <path d={mark.path} fillRule="evenodd" clipRule="evenodd" />
  </svg>;
}

/**
 * The vendor mix of a cluster, as a compact strip.
 *
 * Drawn as marks plus counts rather than as text, because the point is to show that
 * this installation runs **several kinds of accelerator at once**: a reader who
 * sees an NVIDIA eye, a Cambricon hexagon and a CPU chip side by side understands
 * "heterogeneous" before reading a single label.
 *
 * Order is deliberate — CPU last, so the accelerator marks lead — and a vendor with
 * zero nodes is omitted rather than drawn greyed out: a zero here means the cluster
 * does not have that hardware, which is not a state worth a slot.
 */
export function VendorMix({ vendors, className }: {
  vendors: Array<{ vendor: string; count: number }>; className?: string;
}): React.ReactElement | null {
  const t = useT();
  const ordered = React.useMemo(() => {
    const rank = (vendor: string) => (vendor.toLowerCase() === 'cpu' ? 1 : 0);
    return [...vendors].filter((entry) => entry.count > 0)
      .sort((a, b) => rank(a.vendor) - rank(b.vendor) || b.count - a.count || a.vendor.localeCompare(b.vendor));
  }, [vendors]);
  if (ordered.length === 0) return null;
  return <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-2', className)} data-ai-id="nodes:vendor-mix">
    {ordered.map((entry) => <li key={entry.vendor} className="flex items-center gap-1.5"
      title={`${t(vendorMark(entry.vendor).labelKey as Parameters<typeof t>[0])}: ${entry.count}`}>
      <VendorIcon vendor={entry.vendor} size={18} className="text-ai-fg-secondary" />
      <span className="text-xs font-medium tabular-nums text-ai-fg">{entry.count}</span>
      <span className="text-[11px] text-ai-fg-muted">
        {t(vendorMark(entry.vendor).labelKey as Parameters<typeof t>[0])}
      </span>
    </li>)}
  </ul>;
}
