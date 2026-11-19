import * as React from 'react';
import type { NodeDetail } from '@kube-ai-hub/api-client';
import { Table } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { allocationText, allocationValue, capacityLabel, formatCapacityValue } from './nodeDetailModel';
import { acceleratorForSubResource } from './acceleratorKinds';
import { useAcceleratorKinds } from './useAcceleratorKinds';

export function NodeAllocationPanel({ node }: { node: NodeDetail }): React.ReactElement {
  const t = useT();
  const { kinds } = useAcceleratorKinds();
  const primary = ['cpu', 'memory', 'pods', 'ephemeral-storage'];
  const keys = Array.from(new Set([...primary, ...Object.keys(node.capacity), ...Object.keys(node.allocatable),
    ...Object.keys(node.allocated), ...Object.keys(node.allocatedLimits)]))
    /*
     * `hugepages-*` are tuning knobs, not capacity to plan against, and they are
     * zero on every node here. The old console leaves them out of this table too;
     * keeping them added two permanently-empty rows between the rows a reader
     * actually compares.
     */
    .filter((key) => !key.startsWith('hugepages-'));
  const rows = keys.map((key) => ({ key }));
  /* Accelerator memory carries its unit in the installer's metadata, not in the key. */
  const unitFor = (key: string): string | undefined => {
    const sub = acceleratorForSubResource(kinds, key);
    return sub?.role === 'memory' ? sub.kind.memoryUnit : undefined;
  };
  return <section className="rounded-ai-lg border border-ai-line bg-ai-surface-1 p-4" data-ai-id="node-detail:capacity">
    <h2 className="mb-3 text-sm font-semibold">{t('node.allocation.title')}</h2>
    <Table rows={rows} rowKey={(row) => row.key} rowAttributes={(row) => ({ 'data-ai-resource': row.key })} columns={[
      { key: 'key', title: t('node.allocation.resource'), width: 200, render: (row) => {
        const label = capacityLabel(row.key, t, kinds);
        return label === row.key
          // An extended resource with no catalogue entry keeps its own name; the
          // monospace says "this is the API's identifier", not "this is prose".
          ? <span className="break-all font-mono text-[11px]">{row.key}</span>
          : <span className="text-xs text-ai-fg" title={row.key}>{label}</span>;
      } },
      { key: 'capacity', title: t('node.allocation.capacity'), render: (row) => <span className="whitespace-nowrap text-xs">{formatCapacityValue(row.key, node.capacity[row.key] ?? '', unitFor(row.key))}</span> },
      { key: 'allocatable', title: t('node.allocation.allocatable'), render: (row) => <span className="whitespace-nowrap text-xs">{formatCapacityValue(row.key, node.allocatable[row.key] ?? '', unitFor(row.key))}</span> },
      { key: 'requests', title: t('node.allocation.requests'), render: (row) => <span className="whitespace-nowrap text-xs"
        data-ai-id={`node-detail:requests:${row.key}`}>{allocationText(row.key, allocationValue(node, 'requests', row.key), node.allocatable[row.key])}</span> },
      { key: 'limits', title: t('node.allocation.limits'), render: (row) => <span className="whitespace-nowrap text-xs"
        data-ai-id={`node-detail:limits:${row.key}`}>{allocationText(row.key, allocationValue(node, 'limits', row.key), node.allocatable[row.key])}</span> },
    ]} />
    <p className="mt-2 text-[11px] text-ai-fg-muted">{t('node.allocation.hint')}</p>
  </section>;
}
