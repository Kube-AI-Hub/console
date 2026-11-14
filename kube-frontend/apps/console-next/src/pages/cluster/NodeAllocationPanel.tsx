import * as React from 'react';
import type { NodeDetail } from '@kube-ai-hub/api-client';
import { Table } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { formatQuantity } from '@/lib/quantity';
import { allocationText, allocationValue } from './nodeDetailModel';

export function NodeAllocationPanel({ node }: { node: NodeDetail }): React.ReactElement {
  const t = useT();
  const primary = ['cpu', 'memory', 'pods', 'ephemeral-storage'];
  const keys = Array.from(new Set([...primary, ...Object.keys(node.capacity), ...Object.keys(node.allocatable),
    ...Object.keys(node.allocated), ...Object.keys(node.allocatedLimits)]));
  const rows = keys.map((key) => ({ key }));
  return <section className="rounded-ai-lg border border-ai-line bg-ai-surface-1 p-4" data-ai-id="node-detail:capacity">
    <h2 className="mb-3 text-sm font-semibold">{t('node.allocation.title')}</h2>
    <Table rows={rows} rowKey={(row) => row.key} rowAttributes={(row) => ({ 'data-ai-resource': row.key })} columns={[
      { key: 'key', title: t('node.allocation.resource'), width: 200, render: (row) => <span className="break-all font-mono text-[11px]">{row.key}</span> },
      { key: 'capacity', title: t('node.allocation.capacity'), render: (row) => <span className="whitespace-nowrap text-xs">{formatQuantity(row.key, node.capacity[row.key] ?? '')}</span> },
      { key: 'allocatable', title: t('node.allocation.allocatable'), render: (row) => <span className="whitespace-nowrap text-xs">{formatQuantity(row.key, node.allocatable[row.key] ?? '')}</span> },
      { key: 'requests', title: 'Requests', render: (row) => <span className="whitespace-nowrap text-xs"
        data-ai-id={`node-detail:requests:${row.key}`}>{allocationText(row.key, allocationValue(node, 'requests', row.key), node.allocatable[row.key])}</span> },
      { key: 'limits', title: 'Limits', render: (row) => <span className="whitespace-nowrap text-xs"
        data-ai-id={`node-detail:limits:${row.key}`}>{allocationText(row.key, allocationValue(node, 'limits', row.key), node.allocatable[row.key])}</span> },
    ]} />
    <p className="mt-2 text-[11px] text-ai-fg-muted">{t('node.allocation.hint')}</p>
  </section>;
}
