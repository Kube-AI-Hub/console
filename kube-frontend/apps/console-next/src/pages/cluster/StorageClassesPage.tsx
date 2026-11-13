import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { storageClassesApi, type StorageClassSummary } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { useResourceListState, toListParams } from '@/components/resource/useResourceListState';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';

/**
 * 存储类型 (StorageClass).
 *
 * Cluster-scoped and read-only: a StorageClass is infrastructure, and editing one
 * changes where every future claim lands. The columns are the questions an
 * administrator asks of it — who provisions it, what happens on delete, does it
 * default, and what may be done to the volumes it makes.
 */
export interface StorageClassesPageProps {
  cluster: string;
}

const PAGE_SIZE = 10;

export function StorageClassesPage({ cluster }: StorageClassesPageProps): React.ReactElement {
  const t = useT();
  // Cluster-scoped: `namespace` empty means the cluster-wide collection.
  const list = useResourceListState<'name' | 'createTime'>({ defaultSortBy: 'name', resetOn: [cluster] });
  const query = useQuery({
    queryKey: ['storageclasses', cluster],
    queryFn: ({ signal }) => storageClassesApi(apiClient).list({ ...toListParams(list, { cluster, namespace: '' }, 200), signal }),
  });

  /*
   * Sorted here, not by the server.
   *
   * `storageclasses` is a cluster-scoped core resource read from `storage.k8s.io`; the
   * `sortBy`/`ascending` query parameters are a KubeSphere convention that the core API
   * ignores, so the sort control used to do nothing at all. The whole collection is
   * fetched anyway (a cluster has a handful), so ordering it locally is both correct
   * and cheap.
   */
  const rows = React.useMemo(() => {
    const items = [...((query.data?.items ?? []) as StorageClassSummary[])];
    return items.sort((a, b) => {
      const direction = list.order === 'asc' ? 1 : -1;
      if (list.sortBy === 'createTime') return a.createdAt.localeCompare(b.createdAt) * direction;
      return a.name.localeCompare(b.name) * direction;
    });
  }, [query.data, list.sortBy, list.order]);
  const total = query.data?.total ?? 0;

  const schema = React.useMemo<ListSchema<StorageClassSummary>>(
    () => ({
      title: t('cluster.storageClasses.title'),
      description: t('cluster.storageClasses.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('cluster.searchPlaceholder'), keys: ['name'], aiId: 'storageclasses:search' },
      sortableKeys: ['name', 'createTime'],
      sortAiPrefix: 'storageclasses',
      sort: { key: list.sortBy, order: list.order },
      columns: [
        {
          key: 'name',
          title: t('cluster.column.name'),
          render: (row) => (
            <span className="flex min-w-0 items-center gap-1.5" {...actionProps(`storageclasses:name:${row.name}`)}>
              <span className="truncate font-medium text-ai-fg">{row.name}</span>
              {row.isDefault ? <Badge tone="info">{t('cluster.storageClasses.default')}</Badge> : null}
            </span>
          ),
        },
        {
          key: 'provisioner',
          title: t('cluster.storageClasses.provisioner'),
          width: 200,
          hideBelow: 'md',
          render: (row) => <span className="truncate font-mono text-[11px] text-ai-fg-secondary">{row.provisioner || '-'}</span>,
        },
        {
          key: 'pvcCount',
          title: t('cluster.storageClasses.pvcCount'),
          width: 110,
          hideBelow: 'lg',
          // The platform only reports this for some clusters; saying so is better than
          // a zero that reads as "none in use".
          render: (row) => (
            <span className="tabular-nums text-ai-fg-secondary">{row.pvcCount === undefined ? '-' : row.pvcCount}</span>
          ),
        },
        {
          key: 'capabilities',
          title: t('cluster.storageClasses.capabilities'),
          width: 220,
          hideBelow: 'lg',
          render: (row) => {
            /*
             * Only the capabilities the class actually has are rendered. Rendering all
             * three with a muted tone made every class look fully featured — the reader
             * had to compare colours to learn that `openebs-hostpath` cannot expand.
             */
            const supported = [
              row.allowExpansion ? t('cluster.storageClasses.expand') : null,
              row.allowCloning ? t('cluster.storageClasses.clone') : null,
              row.allowSnapshot ? t('cluster.storageClasses.snapshot') : null,
            ].filter((label): label is string => Boolean(label));
            if (supported.length === 0) return <span className="text-ai-fg-muted">-</span>;
            return (
              <span className="flex flex-wrap gap-1">
                {supported.map((label) => (
                  <Badge key={label} tone="success">{label}</Badge>
                ))}
              </span>
            );
          },
        },
        {
          key: 'reclaimPolicy',
          title: t('cluster.storageClasses.reclaim'),
          width: 130,
          hideBelow: 'xl',
          render: (row) => <span className="text-ai-fg-secondary">{row.reclaimPolicy}</span>,
        },
        {
          key: 'createTime',
          title: t('cluster.column.createdAt'),
          width: 170,
          hideBelow: 'xl',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
        },
      ],
      rowActions: [],
      empty: { title: t('cluster.storageClasses.emptyTitle'), description: t('cluster.storageClasses.emptyDescription') },
      labels: {
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      pagination: { page: list.page, pageSize: PAGE_SIZE, total },
    }),
    [list, t, total],
  );

  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="storageclasses:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="storageclasses:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="storageclasses:surface" state={state} className="min-w-0">
      <ResourceList
        schema={schema}
        rows={rows}
        loading={state === 'loading'}
        searchValue={list.keyword}
        onSearchChange={list.setKeyword}
        onPageChange={list.setPage}
        onSortChange={(next: { key: string; order: SortOrder } | undefined) => {
          if (next) list.setSort(next);
        }}
      />
    </AiSurface>
  );
}
