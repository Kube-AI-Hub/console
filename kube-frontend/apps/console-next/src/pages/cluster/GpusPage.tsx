import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { gpusApi, type GpuDevice, type GpuSortKey } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, MetricCell, ResourceList, StatisticsGroup, type ListSchema, type StatisticItem } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatGpuMemory, formatGpuUsage, gpuHealthTone } from './gpuFormat';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { GPU_VENDOR_LABEL_KEYS, vendorKey } from './gpuVendors';
import { GPU_MODES } from './gpuModeConfig';

/**
 * 集群显卡.
 *
 * One row per physical card, with server-side filters and pagination. Statistics
 * remain cluster-wide regardless of the current page or filter.
 *
 * Health is a verdict, not a computation: HAMi's device plugin decides it, gpu-agent
 * writes the summary into `hami.io/node-gpu-info`, and the API reports it as a bool.
 * The page never derives it from capacity or XID events.
 */
export interface GpusPageProps {
  cluster: string;
}

export function GpusPage({ cluster }: GpusPageProps): React.ReactElement {
  const t = useT();
  const list = useResourceListState<GpuSortKey>({ defaultSortBy: 'nodeName', defaultOrder: 'asc', defaultPageSize: 20, resetOn: [cluster] });
  const [filters, setFilters] = React.useState<Record<string, string>>({});
  const [applied, setApplied] = React.useState<Record<string, string>>({});
  const [visibleColumns, setVisibleColumns] = React.useState<string[]>();
  React.useEffect(() => {
    if (JSON.stringify(filters) === JSON.stringify(applied)) return;
    const timer = setTimeout(() => { setApplied(filters); list.setPage(1); }, 250);
    return () => clearTimeout(timer);
  }, [filters, applied]);
  React.useEffect(() => { setFilters({}); setApplied({}); }, [cluster]);
  const devices = useQuery({
    queryKey: ['cluster-gpus', cluster, list.page, list.pageSize, list.sortBy, list.order, list.search, applied],
    queryFn: ({ signal }) => gpusApi(apiClient).list({
      cluster, page: list.page, limit: list.pageSize, sortBy: list.sortBy, ascending: list.order === 'asc',
      uuid: list.search, nodeName: applied.nodeName ?? '', labelSelector: applied.labelSelector ?? '',
      type: applied.type ?? '', deviceVendor: applied.vendor ?? '',
      ...(applied.status ? { status: applied.status as 'healthy' | 'unhealthy' } : {}), signal,
    }),
    placeholderData: (previous, previousQuery) => previousQuery?.queryKey[1] === cluster ? previous : undefined,
    retry: false,
  });

  /*
   * The overview totals come from the API's own stats endpoint, not from summing the
   * rows above: the list may be filtered or paged one day, and a sum of the visible
   * page would then silently describe only that page. The endpoint aggregates the same
   * cache the list reads, so the two cannot disagree.
   */
  const stats = useQuery({
    queryKey: ['cluster-gpus-stats', cluster],
    queryFn: ({ signal }) => gpusApi(apiClient).stats({ cluster, signal }),
    staleTime: 30_000,
    retry: false,
  });

  const rows = devices.data?.items ?? [];
  const total = devices.data?.total ?? 0;
  React.useEffect(() => {
    if (devices.isPlaceholderData || !devices.data) return;
    const last = Math.max(1, Math.ceil(devices.data.total / list.pageSize));
    if (list.page > last) list.setPage(last);
  }, [devices.data, devices.isPlaceholderData, list.page, list.pageSize]);
  const vendorLabel = (vendor: string) => {
    const key = vendorKey(vendor);
    return key ? t(GPU_VENDOR_LABEL_KEYS[key]) : vendor || '-';
  };
  const modeLabel = (row: GpuDevice) => {
    const mode = GPU_MODES[row.vendor.toLowerCase()]?.find((entry) => entry.value === row.mode);
    return mode ? t(mode.labelKey) : row.mode || '-';
  };
  const state = devices.isPending ? 'loading' : devices.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  const schema = React.useMemo<ListSchema<GpuDevice>>(
    () => ({
      rowKey: 'uuid',
      rowAttributes: (row) => ({
        'data-ai-row': row.uuid,
        // The acceptance case targets one row by UUID; `data-ai-row` alone would make
        // an agent guess which attribute is the handle.
        'data-ai-id': `cluster-gpus:row:${row.uuid}`,
      }),
      search: { placeholder: t('gpu.list.uuidSearch'), aiId: 'cluster-gpus:search' },
      filters: [
        { key: 'nodeName', type: 'text', title: t('cluster.gpu.column.node'), aiId: 'cluster-gpus:filter:node' },
        { key: 'labelSelector', type: 'text', title: t('gpu.list.nodeLabels'), aiId: 'cluster-gpus:filter:labels' },
        { key: 'type', type: 'text', title: t('cluster.gpu.column.model'), aiId: 'cluster-gpus:filter:model' },
        { key: 'vendor', title: t('cluster.gpu.column.vendor'), allLabel: `${t('node.filter.all')} ${t('cluster.gpu.column.vendor')}`, aiId: 'cluster-gpus:filter:vendor',
          options: Object.keys(GPU_VENDOR_LABEL_KEYS).filter((key) => key !== 'CPU').map((key) => ({ value: key, label: vendorLabel(key) })) },
        { key: 'status', title: t('cluster.column.status'), allLabel: `${t('node.filter.all')} ${t('cluster.column.status')}`, aiId: 'cluster-gpus:filter:status', options: [
          { value: 'healthy', label: t('cluster.gpu.healthy') }, { value: 'unhealthy', label: t('cluster.gpu.unhealthy') }] },
      ],
      columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'cluster-gpus:columns' },
      refresh: { label: t('common.refresh'), aiId: 'cluster-gpus:refresh', busy: devices.isFetching || stats.isFetching },
      sortableKeys: ['nodeName', 'index', 'uuid', 'health', 'type', 'deviceVendor'],
      // Third click of the header cycle returns to the page's default order;
      // a server list must send a sort key, so "off" cannot be absent.
      sortFallback: list.sortFallback,
      sortAiPrefix: 'cluster-gpus', sort: { key: list.sortBy, order: list.order },
      columns: [
        {
          key: 'nodeName',
          /* Pinned: the row's identity, kept in place while the other columns scroll. */
          width: 170,
          pin: 'start',
          title: t('cluster.gpu.column.node'),
          render: (row) => (
            <span className="flex min-w-0 flex-col">
              <Link
                to="/kube-frontend/clusters/$cluster/nodes/$name"
                params={{ cluster, name: row.node }}
                className="truncate font-medium text-ai-link hover:underline"
                {...actionProps(`cluster-gpus:node:${row.node}`)}
              >
                {row.node || '-'}
              </Link>
              <span className="truncate text-[11px] text-ai-fg-muted">{row.nodeIP || '-'}</span>
            </span>
          ),
        },
        {
          key: 'index',
          hideable: true,
          title: t('cluster.gpu.column.index'),
          width: 80,
          render: (row) => <span className="tabular-nums text-ai-fg-secondary">{row.index}</span>,
        },
        {
          key: 'uuid',
          title: t('cluster.gpu.column.uuid'),
          render: (row) => (
            <Link
              to="/kube-frontend/clusters/$cluster/gpus/$name"
              params={{ cluster, name: row.uuid }}
              className="block max-w-64 truncate font-mono text-[11px] text-ai-link hover:underline"
              title={row.uuid}
              {...actionProps(`cluster-gpus:uuid:${row.uuid}`)}
            >
              {row.uuid}
            </Link>
          ),
        },
        {
          key: 'health',
          hideable: true,
          title: t('cluster.column.status'),
          width: 110,
          render: (row) => (
            <Badge tone={gpuHealthTone(row)}>
              {row.health ? t('cluster.gpu.healthy') : t('cluster.gpu.unhealthy')}
            </Badge>
          ),
        },
        {
          key: 'type',
          hideable: true,
          title: t('cluster.gpu.column.model'),
          width: 140,
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.model || '-'}</span>,
        },
        {
          key: 'memory',
          hideable: true,
          title: t('cluster.gpu.column.memory'),
          width: 210,
          render: (row) => <MetricCell className="whitespace-nowrap" value={row.memoryTotalMiB > 0 ? `${formatGpuMemory(row.memoryUsedMiB)} / ${formatGpuMemory(row.memoryTotalMiB)}` : '-'} />,
        },
        {
          key: 'deviceVendor',
          hideable: true,
          title: t('cluster.gpu.column.vendor'),
          width: 120,
          render: (row) => <span className="whitespace-nowrap text-ai-fg-secondary" title={row.vendor}>{vendorLabel(row.vendor)}</span>,
        },
        { key: 'numa', title: t('cluster.gpu.detail.numa'), hideable: true, render: (row) => row.numa ?? '-' },
        { key: 'mode', title: t('cluster.gpu.detail.mode'), hideable: true, render: (row) => <span className="whitespace-nowrap">{modeLabel(row)}</span> },
        { key: 'vgpu', title: t('cluster.gpu.detail.vgpu'), hideable: true, render: (row) => <span className="whitespace-nowrap">{formatGpuUsage(row.vgpuUsed, row.vgpuTotal, '')}</span> },
        { key: 'core', title: t('cluster.gpu.detail.core'), hideable: true, render: (row) => <span className="whitespace-nowrap">{formatGpuUsage(row.coreUsed, row.coreTotal, '')}</span> },
      ],
      empty: { title: list.search || Object.values(applied).some(Boolean) ? t('gpu.list.noMatch') : t('cluster.gpu.emptyTitle'), description: t('cluster.gpu.emptyDescription') },
      labels: {
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
        pageSize: t('table.pageSize'), pageSizeSuffix: t('table.pageSizeSuffix'),
        range: (from, to, count) => t('table.range', { from, to, total: count }),
        goToPage: t('table.goToPage'), jumpTo: t('table.jumpTo'),
        clearSearch: t('gpu.list.clearSearch'), clearFilters: t('node.filter.clearAll'),
        clearFilter: (title) => t('node.filter.clear', { title }),
      },
      pagination: { page: list.page, pageSize: list.pageSize, total, pageSizeOptions: [10, 20, 50, 100] },
    }),
    [cluster, list, total, applied, devices.isFetching, stats.isFetching, t],
  );

  const health = stats.data;
  const percent = health && health.total > 0 ? `${Math.round((health.healthy / health.total) * 100)}%` : '-';
  const summary: StatisticItem[] = [
    { key: 'total', label: t('cluster.gpu.title'), value: health?.total, state: stats.isPending ? 'loading' : stats.isError ? 'error' : 'ready' },
    { key: 'health', label: t('cluster.gpu.health'), value: percent, description: health ? t('cluster.gpu.summary', { healthy: health.healthy, total: health.total }) : '',
      state: stats.isPending ? 'loading' : stats.isError ? 'error' : 'ready' },
    ...(health?.byModel ?? []).map((entry) => ({ key: `${entry.vendor}-${entry.model}`,
      label: `${vendorLabel(entry.vendor)} ${entry.model}`, value: entry.count })),
  ];

  return (
    <AiSurface as="section" aiId="cluster-gpus:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-ai-fg">{t('cluster.gpu.title')}</h1>
        <p className="text-xs text-ai-fg-muted">{t('cluster.gpu.description')}</p>
      </header>

      {/*
        The health ratio is server-side (`/gpus/stats`), so it stays correct if the
        table is ever filtered or paged. The data attributes expose the two numbers
        the ratio is built from, for agents that must not parse the badge text.
      */}
      <StatisticsGroup items={summary} unknownLabel={t('node.list.unknown')}
        data-ai-id="cluster-gpus:health" data-ai-total={health?.total} data-ai-healthy={health?.healthy} />
      {stats.isError && cluster === 'host' ? <ResourceErrorPanel error={stats.error} onRetry={() => void stats.refetch()} retryAiId="cluster-gpus:stats-retry" /> : null}
      <ResourceList schema={schema} rows={rows} loading={state === 'loading'} refreshing={devices.isFetching && !devices.isPending}
        errorContent={devices.isError ? <ResourceErrorPanel error={devices.error} onRetry={() => void devices.refetch()} retryAiId="cluster-gpus:retry" retryable={cluster === 'host'} /> : undefined}
        filters={filters} onFiltersChange={(next) => {
          setFilters(next);
          if (next.vendor !== filters.vendor || next.status !== filters.status) { setApplied(next); list.setPage(1); }
        }} searchValue={list.keyword} onSearchChange={list.setKeyword}
        onPageChange={list.setPage} onPageSizeChange={list.setPageSize}
        onSortChange={(next) => { if (next) list.setSort(next); }}
        {...(visibleColumns ? { visibleColumnKeys: visibleColumns } : {})} onVisibleColumnsChange={setVisibleColumns}
        onRefresh={() => { void devices.refetch(); void stats.refetch(); }} />
    </AiSurface>
  );
}
