import * as React from 'react';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useT } from '@/i18n';
import { formatTimestamp } from '@/lib/time';
import { statusLabel } from '@/lib/status';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { useClusterProjectIndex } from './useClusterProjectIndex';
import { useClusterVolumeSnapshots, useSnapshotCrd, type VolumeSnapshotRow } from './snapshotQueries';
import { useListRefresh } from '@/components/resource/useListRefresh';

/**
 * 集群级存储卷快照（跨项目）.
 *
 * The old console opens 存储 on a cluster-wide snapshot list for the same reason
 * it does for claims: the question is "which project's snapshot failed", and a
 * project page cannot answer it. The project column and the name link are the two
 * ways back into the project console; both point at pages that already exist
 * there, so the cluster view stays read-only.
 *
 * A cluster without the CSI snapshot CRDs gets an explicit explanation instead of
 * an empty table: "no snapshots" and "snapshotting is not installed" are
 * different facts, and only one of them is fixed by taking a snapshot.
 */
export interface ClusterVolumeSnapshotsPageProps {
  cluster: string;
}

/** Page sizes the old console offered (`PAGESIZE_OPTION`): 10/20/50/100. */
const PAGE_SIZES = [10, 20, 50, 100] as const;
const PAGE_SIZE = 20;
const AI_ID = 'cluster-volume-snapshots';

type SortKey = 'name' | 'createTime';

/** One object in its own project console: the snapshot detail, or the project list. */
function projectSnapshotUrl(params: {
  workspace: string;
  cluster: string;
  namespace: string;
  name?: string;
}): string {
  return (
    '/kube-frontend/' +
    encodeURIComponent(params.workspace) +
    '/clusters/' +
    encodeURIComponent(params.cluster) +
    '/projects/' +
    encodeURIComponent(params.namespace) +
    '/volumesnapshots' +
    (params.name ? '/' + encodeURIComponent(params.name) : '')
  );
}

export function ClusterVolumeSnapshotsPage({ cluster }: ClusterVolumeSnapshotsPageProps): React.ReactElement {
  const t = useT();
  const list = useResourceListState<SortKey>({ defaultSortBy: 'createTime', defaultOrder: 'desc', defaultPageSize: PAGE_SIZE, resetOn: [cluster] });
  const workspaceOf = useClusterProjectIndex(cluster);
  const crd = useSnapshotCrd(cluster);
  const installed = crd.data === true;
  const query = useClusterVolumeSnapshots(
    {
      cluster,
      namespace: '',
      page: list.page,
      pageSize: list.pageSize,
      sortBy: list.sortBy,
      order: list.order,
      keyword: list.search,
    },
    installed,
  );

  const rows = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const state =
    crd.isPending || (installed && query.isPending)
      ? 'loading'
      : crd.isError || query.isError
        ? 'error'
        : rows.length === 0
          ? 'empty'
          : 'ready';

  const retry = () => {
    void crd.refetch();
    if (installed) void query.refetch();
  };
  const listRefresh = useListRefresh('cluster-volume-snapshots', query);

  const schema = React.useMemo<ListSchema<VolumeSnapshotRow>>(
    () => ({
      title: t('storage.snapshots.title'),
      refresh: listRefresh.refresh,
      description: t('storage.snapshots.clusterDescription'),
      rowKey: (row) => row.namespace + '/' + row.name,
      rowAttributes: (row) => ({ 'data-ai-row': row.namespace + '/' + row.name }),
      search: { placeholder: t('cluster.searchPlaceholder'), aiId: AI_ID + ':search' },
      sortableKeys: ['name', 'createTime'],
      sortAiPrefix: AI_ID,
      sort: { key: list.sortBy, order: list.order },
      columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'cluster-volume-snapshots:columns' },
      columns: [
        {
          key: 'name',
          title: t('storage.column.name'),
          render: (row) => (
            <a
              href={projectSnapshotUrl({
                workspace: workspaceOf.get(row.namespace) ?? 'public',
                cluster,
                namespace: row.namespace,
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
          hideable: true,
          title: t('cluster.workloads.column.project'),
          width: 180,
          hideBelow: 'md',
          // The project column goes to that project's own snapshot list: the
          // cluster page is a cross-project index, and the project page is where
          // the grouped view and its actions live.
          render: (row) => (
            <a
              href={projectSnapshotUrl({ workspace: workspaceOf.get(row.namespace) ?? 'public', cluster, namespace: row.namespace })}
              className="text-ai-fg-secondary hover:text-ai-accent hover:underline"
            >
              {row.namespace || '-'}
            </a>
          ),
        },
        {
          key: 'status',
          hideable: true,
          title: t('storage.column.status'),
          width: 130,
          render: (row) => <Badge tone={snapshotTone(row.status)}>{statusLabel(t, row.status)}</Badge>,
        },
        {
          key: 'capacity',
          hideable: true,
          title: t('storage.column.capacity'),
          width: 110,
          hideBelow: 'md',
          render: (row) => <span className="tabular-nums text-ai-fg-secondary">{row.capacity || '-'}</span>,
        },
        {
          key: 'snapshotClass',
          hideable: true,
          title: t('storage.field.snapshotClass'),
          width: 190,
          hideBelow: 'xl',
          render: (row) => <span className="truncate font-mono text-[11px] text-ai-fg-muted">{row.snapshotClass || '-'}</span>,
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
      empty: { title: t('storage.snapshots.emptyTitle'), description: t('storage.snapshots.emptyDescription') },
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

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('cluster-volume-snapshots', columnKeys);

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="cluster-volume-snapshots:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={crd.error ?? query.error} onRetry={retry} retryAiId={AI_ID + ':retry'} />
      </AiSurface>
    );
  }

  /*
   * The CRD is absent, not the data: say so before the list is even attempted.
   * An empty table here would be read as "this cluster has no snapshots", which
   * points an operator at the workloads instead of at the missing snapshot
   * controller.
   */
  if (crd.data === false) {
    return (
      <AiSurface as="section" aiId="cluster-volume-snapshots:surface" state="empty" className="min-w-0">
        <div className="rounded-ai-md border border-ai-line bg-ai-surface-2 p-6" data-ai-id="cluster-volume-snapshots:crd-missing">
          <h2 className="text-sm font-medium text-ai-fg">{t('storage.snapshots.crdMissingTitle')}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-ai-fg-muted">{t('storage.snapshots.crdMissingDescription')}</p>
          <p className="mt-3 font-mono text-[11px] text-ai-fg-muted">snapshot.storage.k8s.io/v1</p>
        </div>
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="cluster-volume-snapshots:surface" state={state} className="min-w-0">
      <ResourceList
        {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
        onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys}
        schema={schema}
        onRefresh={listRefresh.onRefresh}
        rows={rows}
        loading={state === 'loading'}
        searchValue={list.keyword}
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

/** Status → badge tone: only a ready snapshot is healthy. */
function snapshotTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'Ready') return 'success';
  if (status === 'Pending') return 'warning';
  if (status === 'Error') return 'danger';
  return 'neutral';
}
