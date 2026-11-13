import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { componentsApi, type ComponentSummary } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';

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
export interface ComponentsPageProps {
  cluster: string;
}

export function ComponentsPage({ cluster: _cluster }: ComponentsPageProps): React.ReactElement {
  const t = useT();
  // Default to health so a broken component is not buried among 49 rows; the sort
  // control then works like everywhere else.
  const list = useResourceListState<'name' | 'createTime' | 'health'>({ defaultSortBy: 'health', defaultOrder: 'asc' });

  const query = useQuery({
    queryKey: ['components'],
    queryFn: ({ signal }) => componentsApi(apiClient).list({ signal }),
  });

  const all = query.data?.items ?? [];
  const keyword = list.search.trim().toLowerCase();
  const filtered = keyword ? all.filter((row) => row.name.toLowerCase().includes(keyword)) : all;
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

  const schema = React.useMemo<ListSchema<ComponentSummary>>(
    () => ({
      title: t('cluster.components.title'),
      description: t('cluster.components.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('cluster.searchPlaceholder'), keys: ['name'], aiId: 'components:search' },
      sortableKeys: ['name', 'health'],
      sortAiPrefix: 'components',
      sort: { key: list.sortBy, order: list.order },
      columns: [
        {
          key: 'name',
          title: t('cluster.column.name'),
          render: (row) => (
            <span className="flex min-w-0 flex-col" {...actionProps(`components:name:${row.name}`)}>
              <span className="truncate font-medium text-ai-fg">{row.name}</span>
              <span className="truncate text-[11px] text-ai-fg-muted">{row.namespace || '-'}</span>
            </span>
          ),
        },
        {
          key: 'health',
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
          title: t('cluster.components.startedAt'),
          width: 170,
          hideBelow: 'md',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{row.startedAt ? formatTimestamp(row.startedAt) : '-'}</span>,
        },
      ],
      rowActions: [],
      empty: { title: t('cluster.components.emptyTitle'), description: t('cluster.components.emptyDescription') },
      labels: {
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      pagination: { page: 1, pageSize: Math.max(total, 1), total },
    }),
    [list.sortBy, list.order, t, total],
  );

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
        schema={schema}
        rows={rows}
        loading={state === 'loading'}
        searchValue={list.keyword}
        onSearchChange={list.setKeyword}
        onSortChange={(next: { key: string; order: SortOrder } | undefined) => {
          if (next) list.setSort(next);
        }}
      />
    </AiSurface>
  );
}
