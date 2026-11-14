import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api as apiClient, workloadsApi } from '@/api';
import { namespacesApi, type ResourceListResult, type WorkloadSummary } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';

/**
 * 集群级容器组.
 *
 * The old console lists pods across the whole cluster from the cluster navigation, with a PROJECT
 * column: the question there is 'what is running anywhere', not 'what is in this project'. The
 * user console cannot answer it — a project page is scoped by definition.
 *
 * The row's project column is also the key to the detail link: the project console lives under a
 * workspace, which a pod does not carry, so the namespaces are read once and indexed by name.
 */
export interface ClusterPodsPageProps {
  cluster: string;
}

export function ClusterPodsPage({ cluster }: ClusterPodsPageProps): React.ReactElement {
  const t = useT();
  const list = useResourceListState<'name' | 'createTime'>({ defaultSortBy: 'createTime', defaultOrder: 'desc', resetOn: [cluster] });

  const query = useQuery<ResourceListResult<WorkloadSummary>>({
    queryKey: ['cluster-pods', cluster, list.page, list.pageSize, list.sortBy, list.order, list.search],
    // Retain rows while changing list conditions, never across clusters.
    placeholderData: (previous, previousQuery) => previousQuery?.queryKey[1] === cluster ? previous : undefined,
    queryFn: ({ signal }) =>
      workloadsApi(apiClient, 'pods').list({
        cluster,
        namespace: '',
        page: list.page,
        pageSize: list.pageSize,
        sortBy: list.sortBy,
        order: list.order,
        keyword: list.search,
        signal,
      }),
  });

  // Namespace → workspace, so a row can link into its own project console.
  const namespaces = useQuery({
    queryKey: ['namespaces-for-workspace', cluster],
    queryFn: ({ signal }) => namespacesApi(apiClient).list({ cluster, namespace: '', page: 1, pageSize: 500, signal }),
  });
  const workspaceOf = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const namespace of namespaces.data?.items ?? []) {
      map.set(namespace.name, namespace.workspace || 'public');
    }
    return map;
  }, [namespaces.data]);

  const rows = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  const schema = React.useMemo<ListSchema<WorkloadSummaryLike>>(
    () => ({
      title: t('cluster.workloads.pods.title'),
      description: t('cluster.workloads.pods.description'),
      rowKey: (row) => `${row.namespace}/${row.name}`,
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('cluster.searchPlaceholder'), aiId: 'cluster-pods:search' },
      refresh: { label: t('cluster.list.refresh'), aiId: 'cluster-pods:refresh', busy: query.isFetching },
      sortableKeys: ['name', 'createTime'],
      sortAiPrefix: 'cluster-pods',
      sort: { key: list.sortBy, order: list.order },
      // Only the identity column is permanent; every other column can be hidden.
      columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'cluster-pods:columns' },
      columns: [
        {
          key: 'name',
          title: t('cluster.column.name'),
          render: (row) => {
            const workspace = workspaceOf.get(row.namespace) ?? 'public';
            return (
              <a
                href={`/kube-frontend/${workspace}/clusters/${encodeURIComponent(cluster)}/projects/${encodeURIComponent(row.namespace)}/pods/${encodeURIComponent(row.name)}`}
                className="truncate font-medium text-ai-accent hover:underline"
                {...actionProps(`cluster-pods:name:${row.name}`)}
              >
                {row.name}
              </a>
            );
          },
        },
        {
          key: 'namespace',
          hideable: true,
          title: t('cluster.workloads.column.project'),
          width: 180,
          hideBelow: 'md',
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.namespace || '-'}</span>,
        },
        {
          key: 'status',
          hideable: true,
          title: t('cluster.column.status'),
          width: 120,
          render: (row) => (
            <Badge tone={row.status === 'running' ? 'success' : row.status === 'failed' ? 'danger' : 'warning'}>
              {row.status || '-'}
            </Badge>
          ),
        },
        {
          key: 'node',
          hideable: true,
          title: t('workloads.field.node'),
          width: 160,
          hideBelow: 'lg',
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.node || '-'}</span>,
        },
        {
          key: 'podIP',
          hideable: true,
          title: t('workloads.field.podIP'),
          width: 140,
          hideBelow: 'xl',
          render: (row) => <span className="truncate font-mono text-[11px] text-ai-fg-muted">{row.podIP || '-'}</span>,
        },
        {
          key: 'createTime',
          hideable: true,
          title: t('cluster.column.createdAt'),
          width: 170,
          hideBelow: 'xl',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
        },
      ],
      empty: { title: t('cluster.workloads.pods.empty'), description: t('cluster.workloads.emptyDescription') },
      labels: {
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
        pageSize: t('table.pageSize'),
        pageSizeSuffix: t('table.pageSizeSuffix'),
      },
      pagination: { page: list.page, pageSize: list.pageSize, pageSizeOptions: [10, 20, 50, 100], total },
    }),
    [cluster, list, query.isFetching, t, total, workspaceOf],
  );

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('cluster-pods', columnKeys);

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="cluster-pods:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="cluster-pods:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="cluster-pods:surface" state={state} aria-busy={query.isFetching} className="min-w-0">
      <ResourceList
        schema={schema}
        rows={rows}
        {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
        onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys}
        loading={state === 'loading'}
        searchValue={list.keyword}
        onSearchChange={list.setKeyword}
        onRefresh={() => void query.refetch()}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        onSortChange={(next: { key: string; order: SortOrder } | undefined) => {
          if (next) list.setSort(next);
        }}
      />
    </AiSurface>
  );
}

/** The fields this page reads from a pod summary. */
interface WorkloadSummaryLike {
  name: string;
  namespace: string;
  status: string;
  node?: string;
  podIP?: string;
  createdAt: string;
}
