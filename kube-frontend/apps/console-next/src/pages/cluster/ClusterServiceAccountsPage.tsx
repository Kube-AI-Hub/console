import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { serviceAccountsApi, type ServiceAccountSummary } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { clusterProjectRowId, projectObjectUrl, useClusterProjectIndex } from './useClusterProjectIndex';
import { useListRefresh } from '@/components/resource/useListRefresh';

/**
 * 集群级服务账号（跨项目）.
 *
 * The third of the cross-project configuration pages, and the one where the
 * cluster view earns its keep: a reader checks whether an account exists in the
 * right project before copying a kubeconfig around. The Secrets column counts the
 * token Secrets the controller bound to the account — a zero is meaningful, it
 * says the account has no usable token yet.
 *
 * Read-only, like the other two: changing a role or a token belongs in the project
 * console, which owns the role list the account's project can offer.
 */
export interface ClusterServiceAccountsPageProps {
  cluster: string;
}

/** Page sizes the old console offered (`PAGESIZE_OPTION`): 10/20/50/100. */
const PAGE_SIZES = [10, 20, 50, 100] as const;
const PAGE_SIZE = 20;
const AI_ID = 'cluster-serviceaccounts';

export function ClusterServiceAccountsPage({ cluster }: ClusterServiceAccountsPageProps): React.ReactElement {
  const t = useT();
  const list = useResourceListState<'name' | 'createTime'>({ defaultSortBy: 'createTime', defaultOrder: 'desc', defaultPageSize: PAGE_SIZE, resetOn: [cluster] });
  const workspaceOf = useClusterProjectIndex(cluster);

  const query = useQuery({
    queryKey: [AI_ID, cluster, list.page, list.pageSize, list.sortBy, list.order, list.search],
    queryFn: ({ signal }) =>
      serviceAccountsApi(apiClient).list({
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

  const rows = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';
  const listRefresh = useListRefresh('cluster-serviceaccounts', query);

  const schema = React.useMemo<ListSchema<ServiceAccountSummary>>(
    () => ({
      title: t('cluster.config.serviceaccounts.title'),
      refresh: listRefresh.refresh,
      description: t('cluster.config.description'),
      rowKey: (row) => clusterProjectRowId(row),
      rowAttributes: (row) => ({ 'data-ai-row': clusterProjectRowId(row) }),
      search: { placeholder: t('cluster.searchPlaceholder'), aiId: AI_ID + ':search' },
      sortableKeys: ['name', 'createTime'],
      sortAiPrefix: AI_ID,
      sort: { key: list.sortBy, order: list.order },
      columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'cluster-serviceaccounts:columns' },
      columns: [
        {
          key: 'name',
          title: t('cluster.column.name'),
          render: (row) => (
            <a
              href={projectObjectUrl({
                cluster,
                workspace: workspaceOf.get(row.namespace) ?? 'public',
                namespace: row.namespace,
                page: 'serviceaccounts',
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
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.namespace || '-'}</span>,
        },
        {
          key: 'secrets',
          hideable: true,
          title: t('serviceaccounts.column.secrets'),
          width: 100,
          align: 'right',
          render: (row) => <span className="tabular-nums text-ai-fg-secondary">{row.secrets.length}</span>,
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

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('cluster-serviceaccounts', columnKeys);

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
        {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
        onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys}
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
