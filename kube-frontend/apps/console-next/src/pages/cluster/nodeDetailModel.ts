import { quantityToNumber, type NodeCondition, type NodeDetail } from '@kube-ai-hub/api-client';
import { formatBytes, formatCount, formatCpu, formatQuantity } from '@/lib/quantity';
import type { LocaleKey } from '@/i18n';
import { acceleratorByResource, acceleratorForSubResource, type AcceleratorKind } from './acceleratorKinds';

export function conditionTone(condition: NodeCondition): 'success' | 'danger' | 'neutral' {
  if (!['True', 'False'].includes(condition.status)) return 'neutral';
  if (condition.type === 'Ready') return condition.status === 'True' ? 'success' : 'danger';
  if (['MemoryPressure', 'DiskPressure', 'PIDPressure', 'NetworkUnavailable'].includes(condition.type)) {
    return condition.status === 'False' ? 'success' : 'danger';
  }
  return 'neutral';
}

export function allocationValue(node: NodeDetail, kind: 'requests' | 'limits', key: string): string | undefined {
  const reported = (kind === 'requests' ? node.allocated : node.allocatedLimits)[key];
  if (reported !== undefined && reported !== '') return reported;
  if (key !== 'cpu' && key !== 'memory') return undefined;
  return node.raw.metadata?.annotations?.[`node.kubesphere.io/${key}-${kind}`];
}

export function allocationText(key: string, value: string | undefined, allocatable: string | undefined): string {
  if (value === undefined || value === '') return '-';
  const formatted = formatQuantity(key, value);
  const used = quantityToNumber(value);
  const total = quantityToNumber(allocatable ?? '');
  return Number.isFinite(used) && Number.isFinite(total) && total > 0 ?
    `${formatted} (${Math.round(used / total * 100)}%)` : formatted;
}

/**
 * Resource keys that belong in the "资源总量" block, in reading order.
 *
 * Deliberately not `Object.keys(capacity)`: that also carries `hugepages-1Gi` and
 * `hugepages-2Mi`, which are near-always zero and are tuning knobs rather than
 * headline capacity. The old console's total block showed exactly these six.
 */
export const NODE_TOTAL_RESOURCES = ['cpu', 'memory', 'pods', 'ephemeral-storage'] as const;

/**
 * A resource key as a reader recognises it.
 *
 * The table used to print the raw key (`ephemeral-storage`, `nvidia.com/gpu`) in a
 * monospace cell, which is the API's vocabulary, not the operator's. The old console
 * named the same rows 临时存储 / GPU 总量, and the total block uses the same words so
 * the two sections read as one story: totals first, then the breakdown.
 *
 * `undefined` means "no catalogue entry" — the caller falls back to the raw key,
 * which is what an unknown extended resource (`example.com/foo`) should show.
 */
export function resourceLabelKey(key: string): LocaleKey | undefined {
  if (key === 'cpu') return 'node.resource.cpu';
  if (key === 'memory') return 'node.resource.memory';
  if (key === 'pods') return 'node.resource.pods';
  if (key === 'ephemeral-storage') return 'node.resource.ephemeralStorage';
  return undefined;
}

/**
 * The readable name for any capacity key, accelerator sub-resources included.
 *
 * Three shapes, matching the old console:
 *
 * 1. core keys → catalogue entry (`CPU 总量`, `临时存储`);
 * 2. a key that *is* an accelerator kind → that kind's `displayName`
 *    (`GPU - Nvidia/英伟达`);
 * 3. a key that is an accelerator's memory/vcores sub-resource → the kind's name
 *    plus what the sub-resource is (`vMLU - Cambricon/寒武纪 显存`), because
 *    `cambricon.com/mlu.smlu.vmemory` on its own says nothing about which card it
 *    belongs to.
 *
 * Anything else keeps its own name — including every accelerator key when `kinds` is
 * empty because the lookup failed. Showing the identifier is honest; inventing a label
 * is not.
 */
export function capacityLabel(key: string, t: (key: LocaleKey) => string, kinds: readonly AcceleratorKind[]): string {
  const core = resourceLabelKey(key);
  if (core) return t(core);
  const own = acceleratorByResource(kinds, key);
  if (own) return own.displayName;
  const sub = acceleratorForSubResource(kinds, key);
  if (sub) {
    const suffix = sub.role === 'memory' ? t('node.resource.gpuMemory') : t('node.resource.gpuCores');
    return `${sub.kind.displayName} ${suffix}`;
  }
  return key;
}

/**
 * Format a capacity value in the unit its resource actually uses.
 *
 * The unit is a property of the *resource*, not of the string: `memory: 2Gi` and
 * `cambricon.com/mlu.smlu.vmemory: 100` are both "memory-ish" but one is bytes and
 * the other is a percentage. `formatQuantity` alone guesses from the key name and
 * gets the accelerator cases wrong, which is why this takes the kind's
 * `memoryUnit` into account.
 *
 * The unit strings come from the installer and include a multiplier form —
 * `*256Mi` means "a count of 256Mi blocks" (Iluvatar, MThreads), so `40` renders as
 * `40 * 256Mi`, not as 10 GiB. Resolving it to bytes would be a silent unit change.
 */
export function formatCapacityValue(key: string, quantity: string, memoryUnit?: string): string {
  if (!quantity) return '-';
  // Accelerator memory: honour the declared unit rather than the key's shape.
  if (memoryUnit !== undefined) {
    if (memoryUnit === '%') return `${formatCount(quantity)}%`;
    if (memoryUnit.startsWith('*')) {
      const blocks = formatCount(quantity);
      return blocks === '-' ? '-' : `${blocks} ${memoryUnit}`;
    }
    if (memoryUnit === 'Mi' || memoryUnit === 'Gi') {
      // The value is already expressed in this unit; convert to the GiB the rest of
      // the page uses so a node's memory rows are comparable.
      const bytes = quantityToBytes(quantity, memoryUnit);
      return bytes === undefined ? formatCount(quantity) : formatBytes(String(bytes));
    }
    return `${formatCount(quantity)} ${memoryUnit}`;
  }
  if (key === 'cpu') return `${formatCpu(quantity)} ${'Core'}`;
  return formatQuantity(key, quantity);
}

/** `40960` with unit `Mi` → `42949672960` bytes. `undefined` when unparseable. */
function quantityToBytes(quantity: string, unit: 'Mi' | 'Gi'): number | undefined {
  const value = Number(quantity);
  if (!Number.isFinite(value)) return undefined;
  return value * (unit === 'Gi' ? 1024 ** 3 : 1024 ** 2);
}

export interface TopologyRow {
  device: string;
  connections: Record<string, string>;
  affinity: Record<string, string>;
}
export function topologyRows(raw: Array<Record<string, string>>): { columns: string[]; rows: TopologyRow[] } {
  const affinityKeys = new Set(['CPU Affinity', 'NUMA Affinity', 'GPU NUMA ID']);
  const keys = Array.from(new Set(raw.flatMap((row) => Object.keys(row))))
    .filter((key) => !affinityKeys.has(key));
  const columns = keys.filter((key) => /^(GPU|NIC|MLU)\d+$/i.test(key) || raw.some((row) =>
    /^(X|SYS|NODE|PHB|PXB|PIX|NV\d+|MLK.*|CPU|H_B|SGL|MUL)$/i.test(row[key] ?? '')))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return { columns, rows: raw.map((row, index) => {
    const self = columns.filter((key) => row[key]?.toUpperCase() === 'X');
    return {
      // Diagonal identity is reliable; array order and alphabetically sorted metadata are not.
      device: self.length === 1 ? self[0]! : `row-${index + 1}`,
      connections: Object.fromEntries(columns.map((key) => [key, row[key] || '-'])),
      affinity: Object.fromEntries([...affinityKeys].map((key) => [key, row[key] || '-'])),
    };
  }) };
}
