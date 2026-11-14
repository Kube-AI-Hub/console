import { quantityToNumber, type NodeCondition, type NodeDetail } from '@kube-ai-hub/api-client';
import { formatQuantity } from '@/lib/quantity';

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
