import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { customResourcesApi, type CustomResourceSummary } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { useListRefresh } from '@/components/resource/useListRefresh';

/**
 * 自定义资源（CRD）.
 *
 * What this cluster can serve: every CustomResourceDefinition, with the kind a user
 * actually writes, the group and versions behind it, and whether it is cluster- or
 * namespace-scoped.
 *
 * The list is read from the apiextensions group rather than the resources proxy: the
 * proxy has been observed to lag on newly-created objects elsewhere, and "what does
 * this cluster serve" is exactly the question a stale answer makes useless.
 */
export interface CustomResourcesPageProps {
  cluster: string;
}

type SortKey = 'kind' | 'name' | 'scope' | 'createTime';

export function CustomResourcesPage({ cluster }: CustomResourcesPageProps): React.ReactElement {
  const t = useT();
  const list = useResourceListState<SortKey>({ defaultSortBy: 'kind', resetOn: [cluster] });

  const query = useQuery({
    queryKey: ['custom-resources', cluster],
    queryFn: ({ signal }) => customResourcesApi(apiClient).list({ cluster, signal }),
  });

  const all = query.data?.items ?? [];
  const keyword = list.search.trim().toLowerCase();
  const filtered = keyword
    ? all.filter((row) => row.kind.toLowerCase().includes(keyword) || row.name.toLowerCase().includes(keyword))
    : all;

  /*
   * Sorted here, not on the server: apiextensions has no sort parameter, and the list
   * is a few hundred entries at most. Sending a sort that the API ignores is how a
   * sort control ends up doing nothing (that happened on the storage-class page).
   */
  const rows = React.useMemo(() => {
    const items = [...filtered];
    const direction = list.order === 'asc' ? 1 : -1;
    const key = list.sortBy as SortKey;
    return items.sort((a, b) => {
      if (key === 'createTime') return a.createdAt.localeCompare(b.createdAt) * direction;
      if (key === 'scope') return a.scope.localeCompare(b.scope) * direction || a.kind.localeCompare(b.kind);
      if (key === 'name') return a.name.localeCompare(b.name) * direction;
      return a.kind.localeCompare(b.kind) * direction || a.name.localeCompare(b.name);
    });
  }, [filtered, list.sortBy, list.order]);
  const listRefresh = useListRefresh('custom-resources', query);

  const schema = React.useMemo<ListSchema<CustomResourceSummary>>(
    () => ({
      title: t('cluster.customResources.title'),
      refresh: listRefresh.refresh,
      description: t('cluster.customResources.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('cluster.searchPlaceholder'), aiId: 'custom-resources:search' },
      sortableKeys: ['kind', 'name', 'scope', 'createTime'],
      sortAiPrefix: 'custom-resources',
      sort: { key: list.sortBy, order: list.order },
      columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'custom-resources:columns' },
      columns: [
        {
          key: 'kind',
          hideable: true,
          title: t('cluster.customResources.kind'),
          render: (row: CustomResourceSummary) => (
            <span className="flex min-w-0 flex-col" data-ai-id={`custom-resources:kind:${row.name}`}>
              {/*
                Linked because seeing "RuleGroup exists" raises the next question — "is
                anything using it", which is answered on the detail page's instance list.
              */}
              <Link
                to="/kube-frontend/clusters/$cluster/custom-resources/$name"
                params={{ cluster, name: row.name }}
                className="truncate font-medium text-ai-link hover:underline"
              >
                {row.kind || '-'}
              </Link>
              {/* The group and version are what a reader needs to write a manifest. */}
              <span className="truncate text-[11px] text-ai-fg-muted">
                {row.group}
                {row.versions.length ? `/${row.versions[0]}` : ''}
              </span>
            </span>
          ),
        },
        {
          key: 'name',
          title: t('cluster.column.name'),
          hideBelow: 'md',
          render: (row: CustomResourceSummary) => (
            <span className="truncate font-mono text-[11px] text-ai-fg-secondary" title={row.name}>
              {row.name}
            </span>
          ),
        },
        {
          key: 'scope',
          hideable: true,
          title: t('cluster.customResources.scope'),
          width: 120,
          hideBelow: 'lg',
          render: (row: CustomResourceSummary) => (
            <span className="text-ai-fg-secondary">
              {row.scope === 'Namespaced' ? t('cluster.customResources.namespaced') : t('cluster.customResources.clusterScoped')}
            </span>
          ),
        },
        {
          key: 'served',
          hideable: true,
          title: t('cluster.customResources.served'),
          width: 110,
          hideBelow: 'lg',
          render: (row: CustomResourceSummary) => (
            <Badge tone={row.served ? 'success' : 'neutral'}>
              {row.served ? t('cluster.customResources.servedYes') : t('cluster.customResources.servedNo')}
            </Badge>
          ),
        },
        {
          key: 'createTime',
          hideable: true,
          title: t('cluster.column.createdAt'),
          width: 170,
          hideBelow: 'xl',
          render: (row: CustomResourceSummary) => (
            <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>
          ),
        },
      ],
      empty: {
        title: t('cluster.customResources.emptyTitle'),
        description: t('cluster.customResources.emptyDescription'),
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
      pagination: { page: 1, pageSize: Math.max(rows.length, 10), total: rows.length },
    }),
    [list.sortBy, list.order, query.isFetching, rows.length, t],
  );

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('custom-resources', columnKeys);

  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="custom-resources:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="custom-resources:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="custom-resources:surface" state={state} className="min-w-0">
      <ResourceList
        {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
        onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys}
        schema={schema}
        onRefresh={listRefresh.onRefresh}
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