import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { persistentVolumesApi, type PersistentVolumeSummary } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { statusLabel } from '@/lib/status';
import { useListRefresh } from '@/components/resource/useListRefresh';

/**
 * 持久卷 (PersistentVolume).
 *
 * Cluster-scoped and read-only: a PV is infrastructure, and deleting one destroys data.
 * The columns answer "what backs this, who holds it, and what happens on release".
 *
 * Read from the core API rather than the kapis proxy: measured 24s against 63s for the
 * same list, and the page only needs the standard fields.
 */
export interface PersistentVolumesPageProps {
  cluster: string;
}

export function PersistentVolumesPage({ cluster }: PersistentVolumesPageProps): React.ReactElement {
  const t = useT();
  const list = useResourceListState<'name' | 'createTime'>({ defaultSortBy: 'name', defaultOrder: 'asc' });

  const query = useQuery({
    queryKey: ['persistentvolumes'],
    queryFn: ({ signal }) => persistentVolumesApi(apiClient).list({ signal }),
  });

  const all = query.data?.items ?? [];
  const keyword = list.search.trim().toLowerCase();
  const filtered = keyword
    ? all.filter((row) => row.name.toLowerCase().includes(keyword) || row.claim.toLowerCase().includes(keyword))
    : all;

  const rows = React.useMemo(() => {
    const items = [...filtered];
    const direction = list.order === 'asc' ? 1 : -1;
    return items.sort((a, b) =>
      list.sortBy === 'createTime'
        ? a.createdAt.localeCompare(b.createdAt) * direction
        : a.name.localeCompare(b.name) * direction,
    );
  }, [filtered, list.sortBy, list.order]);
  const listRefresh = useListRefresh('persistentvolumes', query);

  const schema = React.useMemo<ListSchema<PersistentVolumeSummary>>(
    () => ({
      title: t('cluster.persistentVolumes.title'),
      refresh: listRefresh.refresh,
      description: t('cluster.persistentVolumes.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('cluster.searchPlaceholder'), aiId: 'persistentvolumes:search' },
      sortableKeys: ['name', 'createTime'],
      sortAiPrefix: 'persistentvolumes',
      sort: { key: list.sortBy, order: list.order },
      columns: [
        {
          key: 'name',
          title: t('cluster.column.name'),
          render: (row) => (
            <span className="flex min-w-0 flex-col" {...actionProps(`persistentvolumes:name:${row.name}`)}>
              <Link
                to="/kube-frontend/clusters/$cluster/persistentvolumes/$name"
                params={{ cluster, name: row.name }}
                className="truncate font-medium text-ai-accent hover:underline"
              >
                {row.name}
              </Link>
              <span className="truncate text-[11px] text-ai-fg-muted">{row.storageClass || '-'}</span>
            </span>
          ),
        },
        {
          key: 'status',
          title: t('storage.column.status'),
          width: 120,
          render: (row) => (
            <Badge tone={row.status === 'Bound' ? 'success' : row.status === 'Available' ? 'info' : 'warning'}>
              {row.status ? statusLabel(t, row.status) : '-'}
            </Badge>
          ),
        },
        {
          key: 'capacity',
          title: t('storage.column.capacity'),
          width: 100,
          render: (row) => <span className="tabular-nums text-ai-fg-secondary">{row.capacity || '-'}</span>,
        },
        {
          key: 'accessModes',
          title: t('storage.column.accessModes'),
          width: 110,
          hideBelow: 'lg',
          render: (row) => <span className="text-ai-fg-secondary">{row.accessModes.join(', ') || '-'}</span>,
        },
        {
          key: 'claim',
          title: t('cluster.persistentVolumes.claim'),
          width: 200,
          hideBelow: 'md',
          render: (row) => <span className="truncate font-mono text-[11px] text-ai-fg-secondary">{row.claim || '-'}</span>,
        },
        {
          key: 'reclaimPolicy',
          title: t('cluster.storageClasses.reclaim'),
          width: 110,
          hideBelow: 'xl',
          render: (row) => <span className="text-ai-fg-secondary">{row.reclaimPolicy}</span>,
        },
        {
          key: 'createTime',
          title: t('cluster.column.createdAt'),
          width: 160,
          hideBelow: 'xl',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
        },
      ],
      rowActions: [],
      empty: { title: t('cluster.persistentVolumes.emptyTitle'), description: t('cluster.persistentVolumes.emptyDescription') },
      labels: {
        ...listRefresh.emptyLabels,
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      pagination: { page: 1, pageSize: Math.max(rows.length, 1), total: rows.length },
    }),
    [list.sortBy, list.order, query.isFetching, rows.length, t],
  );

  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="persistentvolumes:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="persistentvolumes:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="persistentvolumes:surface" state={state} className="min-w-0">
      <ResourceList
        schema={schema}
        onRefresh={listRefresh.onRefresh}
        rows={rows}
        // The list takes ~24s on this cluster; showing the skeleton while a refetch is
        // in flight is what tells the reader the page is working.
        loading={query.isFetching}
        searchValue={list.keyword}
        onSearchChange={list.setKeyword}
        onSortChange={(next: { key: string; order: SortOrder } | undefined) => {
          if (next) list.setSort(next);
        }}
      />
    </AiSurface>
  );
}
