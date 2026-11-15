/**
 * Number formatting for the cluster monitor.
 *
 * Kept out of the page so the physical-resource cards and the component cards print the
 * same number the same way, and so the unit rules can be asserted from one place. Metric
 * units are the part of a monitoring page that is easiest to get silently wrong: a rate
 * printed as a count, or seconds printed as milliseconds of a different magnitude, still
 * looks like a number.
 */

/** Bytes per second in the units a reader recognises (KiB/s, MiB/s, ...). */
export function formatBytesPerSecond(value: number): string {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let scaled = Math.abs(value);
  let unit = 0;
  while (scaled >= 1024 && unit < units.length - 1) {
    scaled /= 1024;
    unit += 1;
  }
  const text = scaled >= 100 || unit === 0 ? scaled.toFixed(0) : scaled.toFixed(1);
  return `${value < 0 ? '-' : ''}${text} ${units[unit]}`;
}

/** A byte count (etcd DB size) in binary units, one decimal above 1 KiB. */
export function formatBytes(value: number): string {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let scaled = Math.abs(value);
  let unit = 0;
  while (scaled >= 1024 && unit < units.length - 1) {
    scaled /= 1024;
    unit += 1;
  }
  const text = unit === 0 ? scaled.toFixed(0) : scaled.toFixed(1);
  return `${value < 0 ? '-' : ''}${text} ${units[unit]}`;
}

/**
 * How a component metric is printed.
 *
 * `milliseconds` takes the value in **seconds** — the monitoring API reports durations in
 * seconds — and converts. The old console did the same via its chart `unit: 'ms'`.
 */
export type ComponentValueKind = 'perSecond' | 'milliseconds' | 'bytes' | 'bytesPerSecond' | 'count';

export interface ComponentUnits {
  /** Localised "requests per second" suffix. */
  perSecond: string;
}

export function formatComponentValue(value: number, kind: ComponentValueKind, units: ComponentUnits): string {
  switch (kind) {
    case 'perSecond':
      return `${value.toFixed(2)} ${units.perSecond}`;
    case 'milliseconds':
      return `${(value * 1000).toFixed(2)} ms`;
    case 'bytes':
      return formatBytes(value);
    case 'bytesPerSecond':
      return `${formatBytesPerSecond(value)}/s`;
    case 'count':
      return String(Math.round(value));
  }
}
