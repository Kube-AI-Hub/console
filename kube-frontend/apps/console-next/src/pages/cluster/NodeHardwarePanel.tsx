import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { nodeInsightsApi, type NodeDetail } from '@kube-ai-hub/api-client';
import { Badge, Button, Table } from '@kube-ai-hub/ui';
import { api } from '@/api';
import { useT } from '@/i18n';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { topologyRows } from './nodeDetailModel';
import { formatGpuMemory } from './gpuFormat';

export function NodeHardwarePanel({ cluster, node }: { cluster: string; node: NodeDetail }): React.ReactElement {
  const t = useT();
  const [selected, setSelected] = React.useState('');
  const cards = useQuery({ queryKey: ['node-cards', cluster, node.name], retry: false,
    queryFn: ({ signal }) => nodeInsightsApi(api).cards({ cluster, node: node.name, signal }) });
  const ports = useQuery({ queryKey: ['node-ports', cluster, node.name], retry: false,
    queryFn: ({ signal }) => nodeInsightsApi(api).ports({ cluster, node: node.name, signal }) });
  const topology = topologyRows(node.gpuTopology);
  return <div className="flex min-w-0 flex-col gap-4">
    <section className="rounded-ai-lg border border-ai-line bg-ai-surface-1 p-4" data-ai-id="node-detail:cards">
      <h2 className="mb-3 text-sm font-semibold">{t('node.hardware.cards')} · {cards.data?.length ?? '-'}</h2>
      {cards.isError ? <ResourceErrorPanel error={cards.error} onRetry={() => void cards.refetch()} retryAiId="node-detail:cards-retry" /> :
        <Table rows={cards.data ?? []} loading={cards.isPending} rowKey={(row) => row.uuid} empty={t('common.empty')} columns={[
          { key: 'index', title: t('cluster.gpu.column.index'), render: (row) => row.index },
          { key: 'uuid', title: t('cluster.gpu.column.uuid'), render: (row) => <Link to="/kube-frontend/clusters/$cluster/gpus/$name"
            params={{ cluster, name: row.uuid }} className="block max-w-64 truncate text-ai-link" title={row.uuid}>{row.uuid}</Link> },
          { key: 'health', title: t('cluster.column.status'), className: 'whitespace-nowrap', render: (row) => <Badge tone={row.health ? 'success' : 'warning'}>{t(row.health ? 'cluster.gpu.healthy' : 'cluster.gpu.unhealthy')}</Badge> },
          { key: 'model', title: t('cluster.gpu.column.model'), render: (row) => row.model || '-' },
          { key: 'memory', title: t('cluster.gpu.column.memory'), className: 'whitespace-nowrap', render: (row) => row.memoryTotalMiB > 0 ? `${formatGpuMemory(row.memoryUsedMiB)} / ${formatGpuMemory(row.memoryTotalMiB)}` : '-' },
          { key: 'numa', title: 'NUMA', render: (row) => row.numa ?? '-' },
        ]} />}
    </section>
    <section className="rounded-ai-lg border border-ai-line bg-ai-surface-1 p-4" data-ai-id="node-detail:rdma">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t('node.hardware.rdma')}</h2>
        {ports.data ? <Badge tone={ports.data.every((port) => port.healthy) ? 'success' : 'warning'}>{ports.data.filter((port) => port.healthy).length} / {ports.data.length} {t('node.health.normal')}</Badge> : null}
      </header>
      {ports.isError ? <ResourceErrorPanel error={ports.error} onRetry={() => void ports.refetch()} retryAiId="node-detail:rdma-retry" /> :
        <Table rows={ports.data ?? []} loading={ports.isPending} rowKey={(row) => `${row.device}/${row.port}`}
          rowAttributes={(row) => ({ 'data-ai-port': `${row.device}/${row.port}` })} empty={t('node.hardware.noPorts')} columns={[
            { key: 'device', title: t('node.hardware.device'), className: 'whitespace-nowrap', render: (row) => row.device || '-' },
            { key: 'linkLayer', title: t('node.hardware.transport'), className: 'whitespace-nowrap', render: (row) => row.linkLayer === 'Ethernet' ? 'RoCE' : row.linkLayer },
            { key: 'port', title: t('node.hardware.port'), render: (row) => row.port || '-' },
            { key: 'state', title: t('cluster.column.status'), className: 'whitespace-nowrap', render: (row) => <span title={`physState: ${row.physicalState}`}>
              <Badge tone={row.healthy ? 'success' : 'warning'}>{row.state}</Badge></span> },
            { key: 'speedBytes', title: t('node.hardware.speed'), className: 'whitespace-nowrap', render: (row) => row.speedBytes === undefined ? '-' : `${row.speedBytes * 8 / 1e9} Gb/s` },
            { key: 'hca', title: 'HCA', render: (row) => <span className="block max-w-40 truncate" title={row.hca}>{row.hca || '-'}</span> },
            { key: 'firmware', title: t('node.hardware.firmware'), className: 'whitespace-nowrap', render: (row) => row.firmware || '-' },
            { key: 'resourceReady', title: t('node.hardware.resource'), className: 'whitespace-nowrap', render: (row) => t(row.resourceReady ? 'node.hardware.available' : 'node.hardware.unavailable') },
          ]} />}
    </section>
    <section className="rounded-ai-lg border border-ai-line bg-ai-surface-1 p-4" data-ai-id="node-detail:topology">
      <h2 className="mb-2 text-sm font-semibold">{t('node.hardware.topology')}</h2>
      <p className="mb-3 text-xs text-ai-fg-muted">{t('node.hardware.topologyHint')}</p>
      <Table rows={topology.rows} rowKey={(row, index) => `${row.device}:${index}`} empty={t('node.hardware.noTopology')}
        rowAttributes={(row) => ({ 'data-ai-device': row.device })} columns={[
          { key: 'device', title: t('node.hardware.device'), render: (row) => <Button size="sm" variant={selected === row.device ? 'primary' : 'ghost'}
            data-ai-id={`node-detail:topology-select:${row.device}`} onClick={() => setSelected(row.device)}>{row.device}</Button> },
          ...topology.columns.map((key) => ({ key, title: key, render: (row: typeof topology.rows[number]) => <span
            data-ai-connection={`${row.device}:${key}`} className={selected === row.device || selected === key ? 'text-ai-accent font-semibold' : 'text-ai-fg-secondary'}>{row.connections[key]}</span> })),
          ...['CPU Affinity', 'NUMA Affinity', 'GPU NUMA ID'].map((key) => ({ key, title: key, render: (row: typeof topology.rows[number]) => <span className="whitespace-nowrap">{row.affinity[key]}</span> })),
        ]} />
    </section>
  </div>;
}
