import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { gpusApi, type WorkloadSummary } from '@kube-ai-hub/api-client';
import { ResourceList, type ListSchema } from '@kube-ai-hub/ui';
import { api } from '@/api';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useT } from '@/i18n';
import { statusLabel } from '@/lib/status';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { useClusterProjectIndex } from './useClusterProjectIndex';

export function GpuPodsPanel({ cluster, node, uuid }: { cluster: string; node: string; uuid: string }): React.ReactElement {
  const t = useT();
  const list = useResourceListState<'name'>({ defaultSortBy: 'name', resetOn: [cluster, node, uuid] });
  const workspaceOf = useClusterProjectIndex(cluster);
  const query = useQuery({
    queryKey: ['gpu-card-pods', cluster, node, uuid, list.page, list.pageSize, list.search],
    queryFn: ({ signal }) => gpusApi(api).pods({
      cluster, node, uuid, page: list.page, pageSize: list.pageSize, keyword: list.search, signal,
    }),
    placeholderData: (previous, previousQuery) => previousQuery?.queryKey.slice(1, 4).join('/') === [cluster, node, uuid].join('/') ? previous : undefined,
    retry: false,
  });
  const schema: ListSchema<WorkloadSummary> = {
    rowKey: (row) => `${row.namespace}/${row.name}`, rowAttributes: (row) => ({ 'data-ai-row': `${row.namespace}/${row.name}` }),
    search: { placeholder: t('cluster.searchPlaceholder'), aiId: 'gpu-detail:pods-search' },
    refresh: { label: t('common.refresh'), aiId: 'gpu-detail:pods-refresh', busy: query.isFetching },
    columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'gpu-pods:columns' },
    columns: [
      { key: 'name', title: t('cluster.column.name'), render: (row) => <a className="text-ai-link hover:underline"
        href={`/kube-frontend/${encodeURIComponent(workspaceOf.get(row.namespace) ?? 'public')}/clusters/${encodeURIComponent(cluster)}/projects/${encodeURIComponent(row.namespace)}/pods/${encodeURIComponent(row.name)}`}>{row.name}</a> },
      { key: 'namespace', hideable: true, title: t('cluster.workloads.column.project') },
      { key: 'status', hideable: true, title: t('cluster.column.status'), render: (row) => statusLabel(t, row.status) },
      { key: 'node', hideable: true, title: t('workloads.field.node') },
    ],
    empty: { title: t('common.empty'), description: t('gpu.detail.podsHint') },
    labels: { previous: t('table.previous'), next: t('table.next'), pageSize: t('table.pageSize'),
      pageSizeSuffix: t('table.pageSizeSuffix'), clearSearch: t('gpu.list.clearSearch') },
    pagination: { page: list.page, pageSize: list.pageSize, total: query.data?.total ?? 0, pageSizeOptions: [10, 20, 50, 100] },
  };

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('gpu-pods', columnKeys);
  return <div data-ai-id="gpu-detail:pods" aria-busy={query.isFetching} className="flex flex-col gap-3">
    <p className="text-xs text-ai-fg-muted">{t('gpu.detail.podsHint')}</p>
    {query.isError ? <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="gpu-detail:pods-retry" /> :
      <ResourceList
        {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
        onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys}
        schema={schema} rows={query.data?.items ?? []} loading={query.isPending}
        refreshing={query.isFetching && !query.isPending}
        searchValue={list.keyword} onSearchChange={list.setKeyword} onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize} onRefresh={() => void query.refetch()} />}
  </div>;
}
