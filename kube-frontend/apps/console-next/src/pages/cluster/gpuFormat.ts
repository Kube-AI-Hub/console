import type { GpuDevice } from '@kube-ai-hub/api-client';

/**
 * Formatting shared by the GPU list and the single-card page, defined once.
 *
 * Memory arrives in MiB from the GPU API. Printing the raw number is the one
 * mistake this module exists to prevent: `183359` reads as MB or GB depending on
 * the reader, while the card is 179 GiB. The unit is part of the string.
 */
export function formatGpuMemory(mib: number): string {
  if (!Number.isFinite(mib) || mib <= 0) return '0 GiB';
  return `${(mib / 1024).toFixed(2)} GiB`;
}

/** "used / total (percent)" for one capacity pair. */
export function formatGpuUsage(used: number, total: number, unit: string): string {
  if (!Number.isFinite(total) || total <= 0) return '-';
  const percent = Math.round((used / total) * 100);
  return `${used} / ${total}${unit}（${percent}%）`;
}

/**
 * Badge tone for one card's health.
 *
 * The verdict is the API's `health` field, written by the HAMi device plugin and
 * summarised by gpu-agent; this function only maps true/false to a colour. It is
 * not a second health judgement, and there is no "unknown" state to invent: the
 * interface reports a bool.
 */
export function gpuHealthTone(device: Pick<GpuDevice, 'health'>): 'success' | 'warning' {
  return device.health ? 'success' : 'warning';
}
