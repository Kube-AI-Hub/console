import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { namespacesApi, networkPoliciesApi, type NetworkPolicySummary } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { useListRefresh } from '@/components/resource/useListRefresh';

/**
 * 集群级网络策略.
 *
 * NetworkPolicy is a core Kubernetes object (`networking.k8s.io/v1`), not a KubeSphere
 * module resource. The migration plan had recorded this page as "network module off,
 * not migrating" — that conflated two different things. The module flag gates the IP-pool
 * *menu*, while NetworkPolicy reads back from the plain kube API with no module at all.
 *
 * The page is a cross-project list: what isolation exists anywhere in the cluster. Editing
 * happens inside the project that owns the policy, which is where the project's isolation
 * switch and its rules live. Linking there is better than a second editor here — one place
 * to change rules means one place to explain what a rule does.
 */
export interface ClusterNetworkPoliciesPageProps {
  cluster: string;
}

/** Page sizes the old console offered (`PAGESIZE_OPTION`): 10/20/50/100. */
const PAGE_SIZES = [10, 20, 50, 100] as const;
const PAGE_SIZE = 10;

export function ClusterNetworkPoliciesPage({ cluster }: ClusterNetworkPoliciesPageProps): React.ReactElement {
  const t = useT();
  const list = useResourceListState<'name' | 'createTime'>({ defaultSortBy: 'createTime', defaultOrder: 'desc', defaultPageSize: PAGE_SIZE, resetOn: [cluster] });

  const query = useQuery({
    queryKey: ['cluster-networkpolicies', cluster, list.page, list.pageSize, list.sortBy, list.order, list.search],
    queryFn: ({ signal }) =>
      networkPoliciesApi(apiClient).list({
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

  // Policies do not carry their workspace, and the project console's URL needs one. One
  // namespace read is enough to map every row.
  const namespaces = useQuery({
    queryKey: ['namespaces-for-workspace', cluster],
    queryFn: ({ signal }) => namespacesApi(apiClient).list({ cluster, namespace: '', page: 1, pageSize: 500, signal }),
  });
  const workspaceOf = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const namespace of namespaces.data?.items ?? []) {
      map.set(namespace.name, namespace.workspace || 'public');
    }
    return map;
  }, [namespaces.data]);

  const rows = (query.data?.items ?? []) as NetworkPolicySummary[];
  const total = query.data?.total ?? 0;
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';
  const listRefresh = useListRefresh('cluster-networkpolicies', query);

  const schema = React.useMemo<ListSchema<NetworkPolicySummary>>(
    () => ({
      title: t('cluster.network.policies.title'),
      refresh: listRefresh.refresh,
      description: t('cluster.network.policies.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': `${row.namespace}/${row.name}` }),
      search: { placeholder: t('cluster.searchPlaceholder'), aiId: 'cluster-networkpolicies:search' },
      sortableKeys: ['name', 'createTime'],
      sortAiPrefix: 'cluster-networkpolicies',
      sort: { key: list.sortBy, order: list.order },
      columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'cluster-networkpolicies:columns' },
      columns: [
        {
          key: 'name',
          title: t('cluster.column.name'),
          render: (row) => {
            const workspace = workspaceOf.get(row.namespace) ?? 'public';
            return (
              <a
                href={`/kube-frontend/${encodeURIComponent(workspace)}/clusters/${encodeURIComponent(cluster)}/projects/${encodeURIComponent(row.namespace)}/settings/network`}
                className="truncate font-medium text-ai-accent hover:underline"
                {...actionProps(`cluster-networkpolicies:name:${row.namespace}/${row.name}`)}
              >
                {row.name}
              </a>
            );
          },
        },
        {
          key: 'namespace',
          hideable: true,
          title: t('cluster.workloads.column.project'),
          width: 180,
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.namespace || '-'}</span>,
        },
        {
          key: 'policyTypes',
          hideable: true,
          title: t('settings.network.types'),
          width: 150,
          hideBelow: 'md',
          render: (row) => (
            <span className="flex flex-wrap gap-1">
              {row.policyTypes.length > 0 ? (
                row.policyTypes.map((type) => (
                  <Badge key={type} tone="neutral">
                    {type}
                  </Badge>
                ))
              ) : (
                <span className="text-ai-fg-muted">-</span>
              )}
            </span>
          ),
        },
        {
          key: 'rules',
          hideable: true,
          title: t('settings.network.rules'),
          width: 140,
          hideBelow: 'lg',
          render: (row) => (
            <span className="tabular-nums text-ai-fg-secondary">
              {/* Ingress/Egress counts, spelled out: a bare number would not say which
                  direction it counts. */}
              {`${row.ingressRules} / ${row.egressRules}`}
            </span>
          ),
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
      empty: { title: t('cluster.network.policies.empty'), description: t('cluster.network.policies.emptyDescription') },
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
  const columnVisibility = useColumnVisibility('cluster-networkpolicies', columnKeys);

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="cluster-networkpolicies:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="cluster-networkpolicies:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="cluster-networkpolicies:surface" state={state} className="min-w-0">
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
