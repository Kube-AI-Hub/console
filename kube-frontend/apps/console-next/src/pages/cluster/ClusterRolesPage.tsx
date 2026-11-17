import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { clusterRolesForClusterApi, type ClusterRoleSummary } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, ResourceList, type ListSchema } from '@kube-ai-hub/ui';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { useListRefresh } from '@/components/resource/useListRefresh';

/**
 * 集群角色（集群作用域）.
 *
 * The platform access page already lists cluster roles, but always the **host** cluster.
 * From a cluster console the roles of *that* cluster are what matter; this page reads them
 * through the cluster-scoped IAM prefix, and its detail page adds the two tabs the old
 * console had (permission rules / authorized users). Read-only: role writes stay on the
 * platform access page. [N-06]
 */
export interface ClusterRolesPageProps {
  cluster: string;
}

const PAGE_SIZES = [10, 20, 50, 100] as const;
const PAGE_SIZE = 20;

export function ClusterRolesPage({ cluster }: ClusterRolesPageProps): React.ReactElement {
  const t = useT();
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<number>(PAGE_SIZE);
  const query = useQuery({
    queryKey: ['cluster-roles', cluster],
    queryFn: ({ signal }) => clusterRolesForClusterApi(apiClient).list({ cluster, signal }),
  });
  React.useEffect(() => setPage(1), [cluster]);

  const rows = query.data ?? [];
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';
  const paged = rows.length > pageSize;
  const visibleRows = React.useMemo(
    () => (paged ? rows.slice((page - 1) * pageSize, page * pageSize) : rows),
    [page, pageSize, paged, rows],
  );
  const listRefresh = useListRefresh('cluster-roles', query);

  const schema = React.useMemo<ListSchema<ClusterRoleSummary>>(
    () => ({
      title: t('cluster.roles.title'),
      sortAiPrefix: 'cluster-roles',
      refresh: listRefresh.refresh,
      description: t('cluster.roles.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'cluster-roles:columns' },
      columns: [
        {
          key: 'name',
          title: t('workspace.field.name'),
          render: (row) => (
            <Link
              to="/kube-frontend/clusters/$cluster/roles/$name"
              params={{ cluster, name: row.name }}
              className="flex min-w-0 flex-col hover:underline"
              data-ai-id={'cluster-roles:name:' + row.name}
            >
              <span className="flex items-center gap-2">
                <span className="truncate font-medium text-ai-accent">{row.alias || row.name}</span>
                {row.system ? <Badge tone="neutral">{t('cluster.roles.systemBadge')}</Badge> : null}
              </span>
              {row.alias ? <span className="truncate font-mono text-[11px] text-ai-fg-muted">{row.name}</span> : null}
            </Link>
          ),
        },
        {
          key: 'ruleCount',
          hideable: true,
          title: t('platform.column.ruleCount'),
          width: 120,
          align: 'right',
          render: (row) => <span className="tabular-nums text-ai-fg-secondary">{row.ruleCount}</span>,
        },
        {
          key: 'createdAt',
          hideable: true,
          title: t('workspace.field.createdAt'),
          width: 180,
          hideBelow: 'lg',
          render: (row) => (
            <span className="tabular-nums text-ai-fg-muted">{row.createdAt ? formatTimestamp(row.createdAt) : '-'}</span>
          ),
        },
      ],
      empty: { title: t('common.empty'), description: t('cluster.roles.emptyDescription') },
      labels: {
        ...listRefresh.emptyLabels,
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      ...(paged ? { pagination: { page, pageSize, pageSizeOptions: [...PAGE_SIZES], total: rows.length } } : {}),
    }),
    [listRefresh, page, pageSize, paged, query.isFetching, rows.length, t, cluster],
  );

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('cluster-roles', columnKeys);

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="cluster-roles:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="cluster-roles:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="cluster-roles:surface" state={state} className="min-w-0">
      <div data-ai-id="cluster-roles:table" className="min-w-0">
        <ResourceList
          {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
          onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys}
          schema={schema}
          onRefresh={listRefresh.onRefresh}
          rows={visibleRows}
          loading={state === 'loading'}
          {...(paged ? { onPageChange: setPage, onPageSizeChange: (next: number) => { setPageSize(next); setPage(1); } } : {})}
        />
      </div>
    </AiSurface>
  );
}
