import * as React from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { nodesWriteApi, type NodeSummary, type NodeMetricValues } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, Button, MetricCell, ResourceList, StatisticsGroup, type ListColumn, type ListSchema, type StatisticItem } from '@kube-ai-hub/ui';
import { api } from '@/api';
import { useT } from '@/i18n';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { ExecConsoleDialog } from '@/components/resource/ExecConsoleDialog';
import { formatCpu, formatBytes } from '@/lib/quantity';
import { GPU_MODES } from './gpuModeConfig';
import { GPU_VENDOR_LABEL_KEYS, vendorKey } from './gpuVendors';
import { formatGpuMemory } from './gpuFormat';
import { GpuModeDialog } from './GpuModeDialog';
import { hasPendingMode, timeOffsets, useNodesList, useNodesMetrics, useNodesStats, useNodesTime } from './nodeListQueries';

export function NodesPage({ cluster }: { cluster: string }): React.ReactElement {
  const t = useT();
  const client = useQueryClient();
  const list = useResourceListState<'name' | 'createTime'>({ defaultSortBy: 'name', defaultPageSize: 10, resetOn: [cluster] });
  const [filters, setFilters] = React.useState<Record<string, string>>({});
  const [model, setModel] = React.useState('');
  const [terminal, setTerminal] = React.useState<string | null>(null);
  const [modeNode, setModeNode] = React.useState<string | null>(null);
  const [visibleColumns, setVisibleColumns] = React.useState<string[] | undefined>();
  React.useEffect(() => { const timer = setTimeout(() => setModel(filters.model?.trim() ?? ''), 250); return () => clearTimeout(timer); }, [filters.model]);
  React.useEffect(() => { setTerminal(null); setModeNode(null); setFilters({}); list.setPage(1); list.setKeyword(''); }, [cluster]);
  const nodes = useNodesList({
    cluster, page: list.page, pageSize: list.pageSize, sortBy: list.sortBy, order: list.order,
    keyword: list.search, status: filters.status ?? '', role: filters.role ?? '',
    deviceVendors: (filters.vendor ?? '').split(',').filter(Boolean), xpuModel: model,
  });
  const rows = nodes.data?.items ?? [];
  const names = React.useMemo(() => rows.map((row) => row.name), [nodes.data?.items]);
  const metrics = useNodesMetrics(cluster, names);
  const time = useNodesTime(cluster);
  const offsets = React.useMemo(() => timeOffsets(time.data ?? {}), [time.data]);
  const { stats, controlPlane } = useNodesStats(cluster);
  const refresh = () => { void nodes.refetch(); void metrics.refetch(); void time.refetch(); void stats.refetch(); void controlPlane.refetch(); };
  const invalidate = () => {
    for (const key of ['node-list', 'node-list-stats', 'node-list-control-plane', 'node-list-metrics', 'node-list-time', 'node-detail', 'cluster']) {
      void client.invalidateQueries({ queryKey: key === 'cluster' ? [key, 'nodes', cluster] : [key, cluster] });
    }
  };
  const cordon = useMutation({
    mutationFn: (node: NodeSummary) => nodesWriteApi(api).setUnschedulable({ cluster, name: node.name, unschedulable: !node.unschedulable }),
    onSuccess: invalidate,
  });
  React.useEffect(() => {
    if (nodes.isPlaceholderData || !nodes.data || list.page === 1) return;
    const pages = Math.max(1, Math.ceil(nodes.data.total / list.pageSize));
    if (list.page > pages) list.setPage(pages);
  }, [nodes.data, nodes.isPlaceholderData, list.page, list.pageSize]);
  const vendorName = (vendor: string) => { const key = vendorKey(vendor); return key ? t(GPU_VENDOR_LABEL_KEYS[key]) : vendor || t('node.list.unknown'); };
  const statState = stats.isPending ? 'loading' : stats.isError ? 'error' : 'ready';
  const summary: StatisticItem[] = [
    { key: 'total', label: t('node.stats.total'), value: stats.data?.total, state: statState },
    { key: 'control-plane', label: t('node.stats.controlPlane'), value: controlPlane.data,
      state: controlPlane.isPending ? 'loading' : controlPlane.isError ? 'error' : 'ready' },
    { key: 'health', label: t('node.stats.health'), value: stats.data?.total ? `${(stats.data.healthy / stats.data.total * 100).toFixed(1)}%` : '-',
      description: stats.data ? t('node.stats.healthDetail', { healthy: stats.data.healthy, total: stats.data.total }) : '',
      state: statState, tone: stats.data?.healthy === stats.data?.total ? 'success' : 'warning' },
    ...(stats.data?.vendors ?? []).map((entry) => ({ key: `vendor:${entry.vendor}`, label: vendorName(entry.vendor), value: entry.count })),
  ];
  const metric = (row: NodeSummary, kind: 'gpu' | 'gpuMemory' | 'cpu' | 'memory' | 'pods') => {
    const data: NodeMetricValues = metrics.data?.[row.name] ?? {};
    const gpu = kind === 'gpu' || kind === 'gpuMemory';
    if (gpu && (!row.gpuVendor || row.gpuVendor.toLowerCase() === 'cpu')) return <MetricCell value="-" title={t('node.vendor.cpu')} />;
    const [ratio, used, total] = kind === 'gpu' ? [data.node_gpu_utilisation, data.node_gpu_usage, data.node_gpu_total] :
      kind === 'gpuMemory' ? [data.node_gpu_memory_utilisation, data.node_gpu_memory_usage, data.node_gpu_memory_total] :
      kind === 'cpu' ? [data.node_cpu_utilisation, data.node_cpu_usage, data.node_cpu_total] :
      kind === 'memory' ? [data.node_memory_utilisation, data.node_memory_usage_wo_cache, data.node_memory_total] :
      [data.node_pod_quota && data.node_pod_running_count !== undefined ? data.node_pod_running_count / data.node_pod_quota : undefined, data.node_pod_running_count, data.node_pod_quota];
    const value = ratio !== undefined && total !== undefined && total > 0 ? `${Math.round(ratio * 100)}%` : '-';
    const formatted = (number: number) => kind === 'gpuMemory' || kind === 'memory' ? formatGpuMemory(number / 1024 ** 2) :
      kind === 'pods' ? String(Math.round(number)) : number.toFixed(2);
    const unit = kind === 'gpu' ? ` ${t('node.list.cards')}` : kind === 'cpu' ? ` ${t('node.list.cores')}` : '';
    const detail = used !== undefined && total !== undefined && total > 0 ? `${formatted(used)} / ${formatted(total)}${unit}` : '-';
    const allocated = kind === 'gpu' ? data.node_gpu_allocated === undefined ? undefined : `${data.node_gpu_allocated} ${t('node.list.cards')}` :
      kind === 'cpu' ? row.cpuRequested === undefined ? undefined : `${formatCpu(row.cpuRequested)} ${t('node.list.cores')}` :
      kind === 'memory' ? row.memoryRequested === undefined ? undefined : formatBytes(row.memoryRequested) : undefined;
    return <MetricCell value={value} detail={detail} {...(allocated === undefined ? {} : { allocation: t('node.list.allocated', { value: allocated }) })}
      data-ai-id={`nodes:metric:${kind}:${row.name}`} tone={ratio !== undefined && ratio >= .9 ? 'warning' : 'neutral'} />;
  };
  const columns: ListColumn<NodeSummary>[] = [
    { key: 'name', title: t('cluster.column.name'), width: 170, render: (row) => <span className="flex flex-col">
      <Link to="/kube-frontend/clusters/$cluster/nodes/$name" params={{ cluster, name: row.name }} className="text-ai-accent hover:underline">{row.name}</Link>
      <span className="text-[11px] text-ai-fg-muted">{row.internalIP || '-'}</span></span> },
    { key: 'status', title: t('cluster.column.status'), hideable: true, render: (row) => <span className="flex flex-col gap-1">
      <Badge tone={row.status === 'Ready' ? 'success' : 'danger'}>{row.status}</Badge>
      {row.unschedulable ? <span className="text-[11px] text-ai-fg-muted" data-ai-id={`nodes:cordoned:${row.name}`}>{t('node.status.cordoned')}</span> : null}</span> },
    { key: 'role', title: t('cluster.column.role'), hideable: true, render: (row) => <span className="whitespace-nowrap">
      {row.role.split(', ').some((role) => ['master', 'control-plane'].includes(role)) ? t('node.list.controlPlane') : t('node.list.worker')}</span> },
    ...(['gpu', 'gpuMemory', 'cpu', 'memory', 'pods'] as const).map((key) => ({ key, hideable: true, width: 150,
      title: t(key === 'gpu' ? 'node.list.gpu' : key === 'gpuMemory' ? 'node.list.gpuMemory' : key === 'cpu' ? 'cluster.column.cpuUsage' : key === 'memory' ? 'cluster.column.memoryUsage' : 'cluster.workloads.pods.title'),
      render: (row: NodeSummary) => metric(row, key) })),
    { key: 'vendor', title: t('node.detail.xpu'), hideable: true, width: 130, render: (row) => <MetricCell
      value={vendorName(row.gpuVendor || 'CPU')} detail={row.gpuModel || '-'} data-ai-id={`nodes:vendor:${row.name}`} /> },
    { key: 'mode', title: t('node.detail.gpuMode'), hideable: true, width: 130, render: (row) => {
      const definition = GPU_MODES[row.gpuVendor?.toLowerCase() ?? '']?.find((entry) => entry.value === row.gpuMode);
      const current = definition ? t(definition.labelKey) : row.gpuMode || '-';
      const pending = hasPendingMode(row);
      return <MetricCell value={pending ? t(row.gpuModeStatus?.status === 'in_progress' ? 'node.mode.in_progress' : 'node.mode.waiting') : current}
        detail={row.gpuModeStatus?.status === 'failed' ? row.gpuModeStatus.message || t('node.mode.failed') : undefined}
        data-ai-id={`nodes:mode:${row.name}`} />;
    } },
    { key: 'ntp', title: t('node.list.ntp'), hideable: true, width: 110, render: (row) => {
      const entry = offsets[row.name];
      return <MetricCell value={entry?.offset === undefined ? '-' : `${entry.offset > 0 ? '+' : ''}${entry.offset}s`}
        detail={entry?.synced === undefined ? t('node.list.unknown') : t(entry.synced ? 'node.list.synced' : 'node.list.notSynced')}
        tone={entry?.offset !== undefined && Math.abs(entry.offset) >= 120 ? 'danger' : entry?.offset !== undefined && Math.abs(entry.offset) >= 30 ? 'warning' : 'neutral'}
        data-ai-id={`nodes:ntp:${row.name}`} />;
    } },
    { key: 'version', title: t('node.detail.kubeletVersion'), hideable: true, render: (row) => row.version || '-' },
  ];
  const schema: ListSchema<NodeSummary> = {
    rowKey: 'name', rowAttributes: (row) => ({ 'data-ai-row': row.name }), columns,
    search: { placeholder: t('node.filter.name'), aiId: 'nodes:search' },
    filters: [
      { key: 'status', title: t('node.filter.status'), allLabel: t('node.filter.all'), aiId: 'nodes:filter:status', options: [
        { value: 'running', label: t('node.list.running') }, { value: 'warning', label: t('node.list.warning') }, { value: 'unschedulable', label: t('node.status.cordoned') }] },
      { key: 'role', title: t('node.filter.role'), allLabel: t('node.filter.all'), aiId: 'nodes:filter:role', options: [
        { value: 'master', label: t('node.list.controlPlane') }, { value: 'worker', label: t('node.list.worker') }] },
      { key: 'vendor', title: t('node.filter.vendor'), multiple: true, searchable: true, aiId: 'nodes:filter:vendor', emptyText: t('common.empty'),
        options: Array.from(new Set([...Object.keys(GPU_VENDOR_LABEL_KEYS), ...(stats.data?.vendors ?? []).map((entry) => entry.vendor)]))
          .map((vendor) => ({ value: vendor, label: vendorName(vendor) })) },
      { key: 'model', title: t('node.filter.model'), type: 'text', aiId: 'nodes:filter:model' },
    ],
    columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'nodes:columns' },
    refresh: { label: t('common.refresh'), aiId: 'nodes:refresh', busy: nodes.isFetching },
    rowActions: [
      { key: 'cordon', label: t('node.action.cordon'), aiId: 'nodes:cordon', visible: (row) => !row.unschedulable, disabled: () => cordon.isPending },
      { key: 'uncordon', label: t('node.action.uncordon'), aiId: 'nodes:uncordon', visible: (row) => row.unschedulable, disabled: () => cordon.isPending },
      { key: 'terminal', label: t('container.terminal.open'), aiId: 'nodes:terminal-open', disabled: (row) => row.status !== 'Ready' },
      { key: 'gpu-mode', label: t('node.mode.title'), aiId: 'nodes:gpu-mode', visible: (row) => Boolean(row.gpuVendor && row.gpuVendor.toLowerCase() !== 'cpu'),
        disabled: (row) => cluster !== 'host' || hasPendingMode(row) },
    ],
    sortableKeys: ['name'], sortAiPrefix: 'nodes', sort: { key: list.sortBy, order: list.order },
    empty: { title: list.search || Object.values(filters).some(Boolean) ? t('node.list.noMatch') : t('cluster.nodes.emptyTitle') },
    pagination: { page: list.page, pageSize: list.pageSize, total: nodes.data?.total ?? 0, pageSizeOptions: [10, 20, 50, 100] },
    labels: { selectAll: t('table.selectAll'), selectRow: (index) => t('table.selectRow', { index }),
      moreActions: t('table.moreActions'), previous: t('table.previous'), next: t('table.next'),
      range: (from, to, total) => t('table.range', { from, to, total }), goToPage: t('table.goToPage'), jumpTo: t('table.jumpTo'),
      pageSize: t('table.pageSize'), pageSizeSuffix: t('table.pageSizeSuffix'), clearSearch: t('node.filter.clear', { title: t('node.filter.name') }),
      clearFilters: t('node.filter.clearAll'), clearFilter: (title) => t('node.filter.clear', { title }) },
  };
  const state = nodes.isPending ? 'loading' : nodes.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';
  return <AiSurface as="section" aiId="nodes:surface" state={state} className="flex min-w-0 flex-col gap-4">
    <header><h1 className="text-lg font-semibold text-ai-fg">{t('node.list.title')}</h1><p className="mt-1 text-xs text-ai-fg-muted">{t('node.list.description')}</p></header>
    <StatisticsGroup items={summary} unknownLabel={t('node.list.unknown')} data-ai-id="nodes:stats" />
    {stats.isError || controlPlane.isError ? <div className="text-xs"><ResourceErrorPanel error={stats.error || controlPlane.error}
      onRetry={() => { void stats.refetch(); void controlPlane.refetch(); }} retryAiId="nodes:stats-retry" /></div> : null}
    {metrics.isError || time.isError ? <p className="text-xs text-ai-warning">{t('node.list.metricsUnavailable')} <Button size="sm" variant="ghost" onClick={() => { void metrics.refetch(); void time.refetch(); }}>{t('common.retry')}</Button></p> : null}
    {Object.values(offsets).some((entry) => entry.offset !== undefined && Math.abs(entry.offset) >= 120) ? <p role="alert" className="text-xs text-ai-danger">{t('node.list.timeWarning')}</p> : null}
    {nodes.isError ? <ResourceErrorPanel error={nodes.error} onRetry={() => void nodes.refetch()} retryAiId="nodes:retry" /> :
      <ResourceList schema={schema} rows={rows} loading={nodes.isPending} filters={filters} onFiltersChange={(next) => { setFilters(next); list.setPage(1); }}
        searchValue={list.keyword} onSearchChange={list.setKeyword} onPageChange={list.setPage} onPageSizeChange={list.setPageSize}
        onRefresh={refresh} onSortChange={(next) => { if (next) list.setSort(next); }}
        {...(visibleColumns ? { visibleColumnKeys: visibleColumns } : {})} onVisibleColumnsChange={setVisibleColumns}
        onAction={(action, row) => { if (action === 'terminal') setTerminal(row.name); else if (action === 'gpu-mode') setModeNode(row.name); else cordon.mutate(row); }} />}
    <MutationAlert error={cordon.error} />
    {terminal ? <ExecConsoleDialog target={{ cluster, node: terminal }} title={`${t('container.terminal.title')} · ${terminal}`} aiPrefix="node" onClose={() => setTerminal(null)} /> : null}
    {modeNode ? <GpuModeDialog cluster={cluster} name={modeNode} onClose={() => setModeNode(null)} onUpdated={invalidate} /> : null}
  </AiSurface>;
}
