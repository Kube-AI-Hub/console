import * as React from 'react';
import { AiSurface, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useT } from '@/i18n';
import { formatTimestamp } from '@/lib/time';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { useSnapshotCrd, useVolumeSnapshotClasses, type VolumeSnapshotClassRow } from './snapshotQueries';
import { useListRefresh } from '@/components/resource/useListRefresh';

/**
 * 集群级快照类型（VolumeSnapshotClass）.
 *
 * A snapshot class is cluster-scoped: it names the CSI driver that creates the
 * snapshot and the deletion policy the driver follows when a snapshot or its
 * content is removed. The old console lists the same five columns; the parameter
 * count is shown instead of the parameters themselves because each driver invents
 * its own keys, and the count is what tells a reader whether a class is bare or
 * tuned without opening it.
 *
 * Read-only: creating a class is a cluster-admin action that belongs to the
 * installer, and a wrong driver here makes every snapshot in the cluster fail.
 */
export interface ClusterVolumeSnapshotClassesPageProps {
  cluster: string;
}

/** Page sizes the old console offered (`PAGESIZE_OPTION`): 10/20/50/100. */
const PAGE_SIZES = [10, 20, 50, 100] as const;
const PAGE_SIZE = 20;
const AI_ID = 'cluster-snapshot-classes';

type SortKey = 'name' | 'createTime';

export function ClusterVolumeSnapshotClassesPage({
  cluster,
}: ClusterVolumeSnapshotClassesPageProps): React.ReactElement {
  const t = useT();
  const list = useResourceListState<SortKey>({ defaultSortBy: 'createTime', defaultOrder: 'desc', resetOn: [cluster], defaultPageSize: PAGE_SIZE });
  const crd = useSnapshotCrd(cluster);
  const installed = crd.data === true;
  const query = useVolumeSnapshotClasses(
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
  const listRefresh = useListRefresh('cluster-snapshot-classes', query);

  const schema = React.useMemo<ListSchema<VolumeSnapshotClassRow>>(
    () => ({
      title: t('storage.snapshotClasses.title'),
      refresh: listRefresh.refresh,
      description: t('storage.snapshotClasses.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('cluster.searchPlaceholder'), aiId: AI_ID + ':search' },
      sortableKeys: ['name', 'createTime'],
      sortAiPrefix: AI_ID,
      sort: { key: list.sortBy, order: list.order },
      columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'cluster-snapshot-classes:columns' },
      columns: [
        {
          key: 'name',
          title: t('storage.column.name'),
          render: (row) => <span className="truncate font-mono text-[11px] font-medium text-ai-fg">{row.name}</span>,
        },
        {
          key: 'driver',
          hideable: true,
          title: t('storage.snapshotClasses.column.driver'),
          render: (row) => <span className="truncate font-mono text-[11px] text-ai-fg-secondary">{row.driver || '-'}</span>,
        },
        {
          key: 'deletionPolicy',
          hideable: true,
          title: t('storage.snapshotClasses.column.deletionPolicy'),
          width: 130,
          hideBelow: 'md',
          render: (row) => <span className="text-ai-fg-secondary">{row.deletionPolicy || '-'}</span>,
        },
        {
          key: 'parameterCount',
          hideable: true,
          title: t('storage.snapshotClasses.column.parameterCount'),
          width: 110,
          hideBelow: 'md',
          render: (row) => <span className="tabular-nums text-ai-fg-secondary">{row.parameterCount}</span>,
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
      empty: {
        title: t('storage.snapshotClasses.emptyTitle'),
        description: t('storage.snapshotClasses.emptyDescription'),
      },
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
    [list, query.isFetching, t, total],
  );

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('cluster-snapshot-classes', columnKeys);

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="cluster-snapshot-classes:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={crd.error ?? query.error} onRetry={retry} retryAiId={AI_ID + ':retry'} />
      </AiSurface>
    );
  }

  if (crd.data === false) {
    return (
      <AiSurface as="section" aiId="cluster-snapshot-classes:surface" state="empty" className="min-w-0">
        <div className="rounded-ai-md border border-ai-line bg-ai-surface-2 p-6" data-ai-id="cluster-snapshot-classes:crd-missing">
          <h2 className="text-sm font-medium text-ai-fg">{t('storage.snapshotClasses.crdMissingTitle')}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-ai-fg-muted">{t('storage.snapshotClasses.crdMissingDescription')}</p>
          <p className="mt-3 font-mono text-[11px] text-ai-fg-muted">snapshot.storage.k8s.io/v1</p>
        </div>
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="cluster-snapshot-classes:surface" state={state} className="min-w-0">
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
