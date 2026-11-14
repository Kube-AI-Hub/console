import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { namespacesApi, workloadsApi, type WorkloadKind, type WorkloadSummary } from '@kube-ai-hub/api-client';
import { api as apiClient } from '@/api';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';

/**
 * 集群级工作负载（跨项目）.
 *
 * One list per controller, all of them cluster-wide: the old console's 集群 › 工作负载 group is
 * eight pages and every one answers the same question the project pages cannot — 'what exists
 * anywhere, and in which project'. Rows carry a project column and link into it.
 *
 * The shared piece is this page; the kind-specific columns are the only difference. Pods live on
 * their own page because they also show the node and pod IP.
 */
const KINDS: WorkloadKind[] = ['deployments', 'statefulsets', 'daemonsets', 'jobs', 'cronjobs', 'services', 'ingresses'];

export interface ClusterWorkloadsPageProps {
  cluster: string;
  kind: WorkloadKind;
}

const PAGE_SIZE = 20;

export function ClusterWorkloadsPage({ cluster, kind }: ClusterWorkloadsPageProps): React.ReactElement {
  const t = useT();
  const list = useResourceListState<'name' | 'createTime'>({ defaultSortBy: 'createTime', defaultOrder: 'desc', resetOn: [cluster, kind] });
  const aiId = `cluster-${kind}`;

  const query = useQuery({
    queryKey: [aiId, cluster, list.page, list.sortBy, list.order, list.search],
    queryFn: ({ signal }) =>
      workloadsApi(apiClient, kind).list({
        cluster,
        namespace: '',
        page: list.page,
        pageSize: PAGE_SIZE,
        sortBy: list.sortBy,
        order: list.order,
        keyword: list.search,
        signal,
      }),
  });

  // Projects are indexed once so each row can link into its own console.
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

  const rows = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  const schema = React.useMemo<ListSchema<WorkloadSummary>>(
    () => ({
      title: t(`cluster.workloads.${kind}.title` as 'cluster.workloads.deployments.title'),
      description: t('cluster.workloads.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('cluster.searchPlaceholder'), aiId: `${aiId}:search` },
      sortableKeys: ['name', 'createTime'],
      sortAiPrefix: aiId,
      sort: { key: list.sortBy, order: list.order },
      columns: [
        {
          key: 'name',
          title: t('cluster.column.name'),
          render: (row) => {
            const workspace = workspaceOf.get(row.namespace) ?? 'public';
            return (
              <a
                href={`/kube-frontend/${workspace}/clusters/${encodeURIComponent(cluster)}/projects/${encodeURIComponent(row.namespace)}/${kind}/${encodeURIComponent(row.name)}`}
                className="truncate font-medium text-ai-accent hover:underline"
                {...actionProps(`${aiId}:name:${row.name}`)}
              >
                {row.name}
              </a>
            );
          },
        },
        {
          key: 'namespace',
          title: t('cluster.workloads.column.project'),
          width: 180,
          hideBelow: 'md',
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.namespace || '-'}</span>,
        },
        {
          key: 'status',
          title: t('cluster.column.status'),
          width: 130,
          render: (row) => (
            <Badge tone={row.status === 'running' ? 'success' : row.status === 'failed' ? 'danger' : 'warning'}>
              {row.status || '-'}
            </Badge>
          ),
        },
        {
          key: 'ready',
          title: t('cluster.workloads.column.ready'),
          width: 110,
          hideBelow: 'lg',
          render: (row) => (
            <span className="tabular-nums text-ai-fg-secondary">
              {row.ready !== undefined || row.total !== undefined ? `${row.ready ?? 0}/${row.total ?? 0}` : '-'}
            </span>
          ),
        },
        {
          key: 'images',
          title: t('cluster.workloads.column.images'),
          hideBelow: 'xl',
          render: (row) => (
            <span className="truncate font-mono text-[11px] text-ai-fg-muted">{row.images.join(', ') || '-'}</span>
          ),
        },
        {
          key: 'createTime',
          title: t('cluster.column.createdAt'),
          width: 170,
          hideBelow: 'xl',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
        },
      ],
      empty: { title: t('cluster.workloads.emptyTitle'), description: t('cluster.workloads.emptyDescription') },
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
    [aiId, cluster, kind, list, t, total, workspaceOf],
  );

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId={`${aiId}:surface`} state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId={`${aiId}:retry`} />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId={`${aiId}:surface`} state={state} className="min-w-0">
      <ResourceList
        schema={schema}
        rows={rows}
        loading={state === 'loading'}
        searchValue={list.search}
        onSearchChange={list.setKeyword}
        onPageChange={list.setPage}
        onSortChange={(next: { key: string; order: SortOrder } | undefined) => {
          if (next) list.setSort(next);
        }}
      />
    </AiSurface>
  );
}

export const CLUSTER_WORKLOAD_KINDS = KINDS;