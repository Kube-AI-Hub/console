import { quantityToNumber, type NodeCondition, type NodeDetail } from '@kube-ai-hub/api-client';
import { formatQuantity } from '@/lib/quantity';
import type { LocaleKey } from '@/i18n';

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
  if (key === 'nvidia.com/gpu') return 'node.resource.gpu';
  if (key === 'nvidia.com/vgpu') return 'node.resource.vgpu';
  if (key.startsWith('hugepages-')) return 'node.resource.hugepages';
  return undefined;
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
