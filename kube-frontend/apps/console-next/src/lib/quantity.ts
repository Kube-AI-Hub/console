/**
 * Kubernetes quantity formatting.
 *
 * The API returns quantities exactly as written in the object: `255600m` for cores,
 * `3170330328Ki` for memory, plain bytes for ephemeral storage. Printing them raw makes a
 * resource section that no one can read — `3083573052660 / 3170330328Ki` is the same
 * number in two units and looks like a bug.
 */

const BINARY: Record<string, number> = {
  Ki: 1024,
  Mi: 1024 ** 2,
  Gi: 1024 ** 3,
  Ti: 1024 ** 4,
  Pi: 1024 ** 5,
};

/** Split a quantity into its numeric part and suffix (`255600m`, `3170330328Ki`, `110`). */
function split(quantity: string): { value: number; suffix: string } {
  const match = /^([0-9.]+)([A-Za-z]*)$/.exec(quantity.trim());
  if (!match) return { value: Number.NaN, suffix: '' };
  return { value: Number(match[1]), suffix: match[2] ?? '' };
}

/** CPU in cores: `255600m` -> `255.6`, `256` -> `256`. */
export function formatCpu(quantity: string): string {
  const { value, suffix } = split(quantity);
  if (Number.isNaN(value)) return quantity || '-';
  const cores = suffix === 'm' ? value / 1000 : value;
  return Number.isInteger(cores) ? String(cores) : cores.toFixed(1);
}

/** Bytes-like quantities (memory, storage) in GiB/TiB, the unit operators compare in. */
export function formatBytes(quantity: string): string {
  const { value, suffix } = split(quantity);
  if (Number.isNaN(value)) return quantity || '-';
  const bytes = suffix in BINARY ? value * BINARY[suffix]! : suffix === '' ? value : Number.NaN;
  if (Number.isNaN(bytes)) return quantity || '-';
  const gib = bytes / BINARY['Gi']!;
  if (gib >= 1024) return `${(gib / 1024).toFixed(1)} TiB`;
  return `${gib.toFixed(1)} GiB`;
}

/** `110` -> `110`; used for pod counts, where a unit would be noise. */
export function formatCount(quantity: string): string {
  const { value } = split(quantity);
  return Number.isNaN(value) ? quantity || '-' : String(value);
}

/** Format one capacity key (`cpu`, `memory`, `pods`, `ephemeral-storage`). */
export function formatQuantity(key: string, quantity: string): string {
  if (!quantity) return '-';
  if (key === 'cpu') return formatCpu(quantity);
  if (key === 'memory' || key === 'ephemeral-storage' || key.startsWith('hugepages-')) return formatBytes(quantity);
  return formatCount(quantity);
}
