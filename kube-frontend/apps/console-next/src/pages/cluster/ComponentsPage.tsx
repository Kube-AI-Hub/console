import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { componentsApi, type ComponentSummary } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { COMPONENT_GROUPS } from './componentGroups';
import { useListRefresh } from '@/components/resource/useListRefresh';

/**
 * 系统组件.
 *
 * The platform's own components and how many of their backends are healthy. The old
 * console groups them by module (KubeSphere / application governance / monitoring /
 * logging); this page shows one list sorted by health, because the question an
 * administrator has is "is anything down", not "which module is this".
 *
 * The endpoint returns a bare array rather than the usual `{ items }` envelope — see
 * `componentsApi` — which is why this page does not use `resourceApi`.
 */
/** Page sizes the old console offered (`PAGESIZE_OPTION`): 10/20/50/100. */
const PAGE_SIZES = [10, 20, 50, 100] as const;

export interface ComponentsPageProps {
  cluster: string;
  initialType?: string;
}

export function ComponentsPage({ cluster: _cluster, initialType = '' }: ComponentsPageProps): React.ReactElement {
  const t = useT();
  const [type, setType] = React.useState(initialType);
  React.useEffect(() => setType(initialType), [initialType, _cluster]);
  // Default to health so a broken component is not buried among 49 rows; the sort
  // control then works like everywhere else.
  const list = useResourceListState<'name' | 'createTime' | 'health'>({ defaultSortBy: 'health', defaultOrder: 'asc' });
  /* 每页档位 (old console's PAGESIZE_OPTION): the list is client-side, so the slice is here. */
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);

  const query = useQuery({
    queryKey: ['components', _cluster],
    queryFn: ({ signal }) => componentsApi(apiClient).list({ cluster: _cluster, signal }),
  });

  const all = query.data?.items ?? [];
  const group = COMPONENT_GROUPS.find((entry) => entry.key === type);
  const grouped = group ? all.filter((row) => row.namespace === group.namespace) : all;
  const keyword = list.search.trim().toLowerCase();
  const filtered = keyword ? grouped.filter((row) => row.name.toLowerCase().includes(keyword)) : grouped;
  /*
   * Ordered by whatever the sort control says, and the control starts on health so the
   * one broken component is not buried among the rest.
   *
   * The order used to be hard-coded to health-then-name while the schema still offered a
   * sortable name column: clicking it changed the state, re-rendered, and produced the
   * same order — a control that does nothing.
   */
  const rows = React.useMemo(() => {
    const items = [...filtered];
    const direction = list.order === 'asc' ? 1 : -1;
    return items.sort((a, b) => {
      if (list.sortBy === 'health') return (Number(a.up) - Number(b.up)) * direction || a.name.localeCompare(b.name);
      if (list.sortBy === 'createTime') return a.createdAt.localeCompare(b.createdAt) * direction;
      return a.name.localeCompare(b.name) * direction;
    });
  }, [filtered, list.sortBy, list.order]);
  const total = rows.length;
  const listRefresh = useListRefresh('components', query);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const schema = React.useMemo<ListSchema<ComponentSummary>>(
    () => ({
      title: t('cluster.components.title'),
      refresh: listRefresh.refresh,
      description: t('cluster.components.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('cluster.searchPlaceholder'), aiId: 'components:search' },
      filters: [{ key: 'type', title: t('cluster.overview.componentGroup'), aiId: 'components:group',
        allLabel: t('cluster.overview.allComponents'), options: COMPONENT_GROUPS.map((entry) => ({
          value: entry.key, label: entry.label.startsWith('cluster.') ? t(entry.label as 'cluster.overview.module.monitoring') : entry.label,
        })) }],
      sortableKeys: ['name', 'health'],
      // Third click of the header cycle returns to the page's default order;
      // a server list must send a sort key, so "off" cannot be absent.
      sortFallback: list.sortFallback,
      sortAiPrefix: 'components',
      sort: { key: list.sortBy, order: list.order },
      columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'components:columns' },
      columns: [
        {
          key: 'name',
          title: t('cluster.column.name'),
          render: (row) => (
            <span className="flex min-w-0 flex-col" {...actionProps(`components:name:${row.name}`)}>
              <Link
                to="/kube-frontend/clusters/$cluster/components/$name"
                params={{ cluster: _cluster, name: row.name }}
                className="inline-flex min-h-6 items-center truncate font-medium text-ai-link hover:underline"
                data-ai-id={`components:link:${row.name}`}
              >
                {row.name}
              </Link>
              <span className="truncate text-[11px] text-ai-fg-muted">{row.namespace || '-'}</span>
            </span>
          ),
        },
        {
          key: 'health',
          hideable: true,
          title: t('cluster.components.health'),
          width: 140,
          render: (row) => (
            <Badge tone={row.up ? 'success' : 'danger'}>
              {row.total === 0 ? t('cluster.components.noBackends') : `${row.healthy}/${row.total}`}
            </Badge>
          ),
        },
        {
          key: 'startedAt',
          hideable: true,
          title: t('cluster.components.startedAt'),
          width: 170,
          hideBelow: 'md',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{row.startedAt ? formatTimestamp(row.startedAt) : '-'}</span>,
        },
      ],
      rowActions: [],
      empty: { title: t('cluster.components.emptyTitle'), description: t('cluster.components.emptyDescription') },
      labels: {
        ...listRefresh.emptyLabels,
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      pagination: { page: currentPage, pageSize, pageSizeOptions: [...PAGE_SIZES], total },
    }),
    [list.sortBy, list.order, query.isFetching, t, total],
  );

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('components', columnKeys);

  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="components:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="components:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="components:surface" state={state} className="min-w-0">
      <ResourceList
        {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
        onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys}
        onRefresh={listRefresh.onRefresh}
        filters={{ type: group?.key ?? '' }} onFiltersChange={(next) => setType(next.type ?? '')}
        schema={schema}
        rows={pageRows}
        loading={state === 'loading'}
        searchValue={list.keyword}
        onSearchChange={list.setKeyword}
        onPageChange={setPage}
        onPageSizeChange={(size: number) => {
          setPageSize(size);
          setPage(1);
        }}
        onSortChange={(next: { key: string; order: SortOrder }) => {
          if (next) list.setSort(next);
        }}
      />
    </AiSurface>
  );
}