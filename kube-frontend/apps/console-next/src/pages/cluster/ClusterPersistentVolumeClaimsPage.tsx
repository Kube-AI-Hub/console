import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { storageApi, type StorageSummary } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { statusLabel } from '@/lib/status';
import { formatTimestamp } from '@/lib/time';
import { clusterProjectRowId, projectObjectUrl, useClusterProjectIndex } from './useClusterProjectIndex';
import { useListRefresh } from '@/components/resource/useListRefresh';

/**
 * 集群级存储卷声明（跨项目）.
 *
 * The old console's storage page opens on this list, not on a project page: a
 * claim is where a storage problem first shows up, and the first question is
 * which project's claim is Pending or full. A project page cannot answer it.
 *
 * Read-only, like the other cluster lists: expanding, editing or deleting a claim
 * happens in the project console, where the volume's StorageClass and the
 * project's quota are visible next to it.
 *
 * The API already decides the phase (`Bound` / `Pending` / `Lost`), so the
 * status column translates it instead of deriving a second status. Capacity is
 * the requested size, the same number the project page shows.
 */
export interface ClusterPersistentVolumeClaimsPageProps {
  cluster: string;
}

/** Page sizes the old console offered (`PAGESIZE_OPTION`): 10/20/50/100. */
const PAGE_SIZES = [10, 20, 50, 100] as const;
const PAGE_SIZE = 20;
const AI_ID = 'cluster-pvc';

export function ClusterPersistentVolumeClaimsPage({ cluster }: ClusterPersistentVolumeClaimsPageProps): React.ReactElement {
  const t = useT();
  const list = useResourceListState<'name' | 'createTime'>({ defaultSortBy: 'createTime', defaultOrder: 'desc', defaultPageSize: PAGE_SIZE, resetOn: [cluster] });
  const workspaceOf = useClusterProjectIndex(cluster);

  const query = useQuery({
    queryKey: [AI_ID, cluster, list.page, list.pageSize, list.sortBy, list.order, list.search],
    queryFn: ({ signal }) =>
      storageApi(apiClient, 'persistentvolumeclaims').list({
        cluster,
        // Empty namespace asks the resources proxy for the cluster-wide collection.
        namespace: '',
        page: list.page,
        pageSize: list.pageSize,
        sortBy: list.sortBy,
        order: list.order,
        keyword: list.search,
        signal,
      }),
  });

  const rows = (query.data?.items ?? []) as StorageSummary[];
  const total = query.data?.total ?? 0;
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';
  const listRefresh = useListRefresh('cluster-persistentvolumeclaims', query);

  const schema = React.useMemo<ListSchema<StorageSummary>>(
    () => ({
      title: t('cluster.pvc.title'),
      refresh: listRefresh.refresh,
      description: t('cluster.pvc.description'),
      rowKey: (row) => clusterProjectRowId(row),
      rowAttributes: (row) => ({ 'data-ai-row': clusterProjectRowId(row) }),
      search: { placeholder: t('cluster.searchPlaceholder'), aiId: AI_ID + ':search' },
      sortableKeys: ['name', 'createTime'],
      sortAiPrefix: AI_ID,
      sort: { key: list.sortBy, order: list.order },
      columns: [
        {
          key: 'name',
          title: t('storage.column.name'),
          render: (row) => (
            <a
              href={projectObjectUrl({
                cluster,
                workspace: workspaceOf.get(row.namespace) ?? 'public',
                namespace: row.namespace,
                page: 'persistentvolumeclaims',
                name: row.name,
              })}
              className="truncate font-medium text-ai-accent hover:underline"
              {...actionProps(AI_ID + ':name:' + row.namespace + '/' + row.name)}
            >
              {row.name}
            </a>
          ),
        },
        {
          key: 'namespace',
          title: t('cluster.workloads.column.project'),
          width: 180,
          hideBelow: 'md',
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.namespace || '-'}</span>,
        },
        {
          key: 'status',
          title: t('storage.column.status'),
          width: 130,
          render: (row) => <Badge tone={pvcStatusTone(row.status)}>{statusLabel(t, row.status)}</Badge>,
        },
        {
          key: 'capacity',
          title: t('storage.column.capacity'),
          width: 110,
          hideBelow: 'md',
          render: (row) => <span className="tabular-nums text-ai-fg-secondary">{row.capacity || '-'}</span>,
        },
        {
          key: 'accessModes',
          title: t('storage.column.accessModes'),
          width: 130,
          hideBelow: 'lg',
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.accessModes.join(', ') || '-'}</span>,
        },
        {
          key: 'storageClass',
          title: t('storage.field.storageClass'),
          width: 180,
          hideBelow: 'xl',
          render: (row) => <span className="truncate font-mono text-[11px] text-ai-fg-muted">{row.storageClass || '-'}</span>,
        },
        {
          key: 'createTime',
          title: t('cluster.column.createdAt'),
          width: 170,
          hideBelow: 'xl',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
        },
      ],
      empty: { title: t('cluster.workloads.emptyTitle'), description: t('cluster.workloads.emptyDescription') },
      labels: {
        ...listRefresh.emptyLabels,
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      pagination: { page: list.page, pageSize: list.pageSize, pageSizeOptions: [...PAGE_SIZES], total },
    }),
    [cluster, list, query.isFetching, t, total, workspaceOf],
  );

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId={AI_ID + ':surface'} state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId={AI_ID + ':retry'} />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId={AI_ID + ':surface'} state={state} className="min-w-0">
      <ResourceList
        schema={schema}
        onRefresh={listRefresh.onRefresh}
        rows={rows}
        loading={state === 'loading'}
        searchValue={list.search}
        onSearchChange={list.setKeyword}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        onSortChange={(next: { key: string; order: SortOrder } | undefined) => {
          if (next) list.setSort(next);
        }}
      />
    </AiSurface>
  );
}

/**
 * Status → badge tone: only a bound claim is healthy.
 *
 * A resize in flight is not a failure, so it reads as a warning like `Pending`;
 * anything the API sends that is not in this table gets the neutral tone and its
 * raw value, rather than a guess.
 */
function pvcStatusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'Bound') return 'success';
  if (status === 'Pending' || status === 'Resizing' || status === 'FileSystemResizePending') return 'warning';
  if (status === 'Lost') return 'danger';
  return 'neutral';
}
