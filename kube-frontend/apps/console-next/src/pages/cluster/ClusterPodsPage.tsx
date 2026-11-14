import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api as apiClient, workloadsApi } from '@/api';
import { namespacesApi } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';

/**
 * 集群级容器组.
 *
 * The old console lists pods across the whole cluster from the cluster navigation, with a PROJECT
 * column: the question there is 'what is running anywhere', not 'what is in this project'. The
 * user console cannot answer it — a project page is scoped by definition.
 *
 * The row's project column is also the key to the detail link: the project console lives under a
 * workspace, which a pod does not carry, so the namespaces are read once and indexed by name.
 */
export interface ClusterPodsPageProps {
  cluster: string;
}

const PAGE_SIZE = 20;

export function ClusterPodsPage({ cluster }: ClusterPodsPageProps): React.ReactElement {
  const t = useT();
  const list = useResourceListState<'name' | 'createTime'>({ defaultSortBy: 'createTime', defaultOrder: 'desc', resetOn: [cluster] });

  const query = useQuery({
    queryKey: ['cluster-pods', cluster, list.page, list.sortBy, list.order, list.search],
    queryFn: ({ signal }) =>
      workloadsApi(apiClient, 'pods').list({
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

  // Namespace → workspace, so a row can link into its own project console.
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

  const schema = React.useMemo<ListSchema<WorkloadSummaryLike>>(
    () => ({
      title: t('cluster.workloads.pods.title'),
      description: t('cluster.workloads.pods.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('cluster.searchPlaceholder'), aiId: 'cluster-pods:search' },
      sortableKeys: ['name', 'createTime'],
      sortAiPrefix: 'cluster-pods',
      sort: { key: list.sortBy, order: list.order },
      columns: [
        {
          key: 'name',
          title: t('cluster.column.name'),
          render: (row) => {
            const workspace = workspaceOf.get(row.namespace) ?? 'public';
            return (
              <a
                href={`/kube-frontend/${workspace}/clusters/${encodeURIComponent(cluster)}/projects/${encodeURIComponent(row.namespace)}/pods/${encodeURIComponent(row.name)}`}
                className="truncate font-medium text-ai-accent hover:underline"
                {...actionProps(`cluster-pods:name:${row.name}`)}
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
          width: 120,
          render: (row) => (
            <Badge tone={row.status === 'running' ? 'success' : row.status === 'failed' ? 'danger' : 'warning'}>
              {row.status || '-'}
            </Badge>
          ),
        },
        {
          key: 'node',
          title: t('workloads.field.node'),
          width: 160,
          hideBelow: 'lg',
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.node || '-'}</span>,
        },
        {
          key: 'podIP',
          title: t('workloads.field.podIP'),
          width: 140,
          hideBelow: 'xl',
          render: (row) => <span className="truncate font-mono text-[11px] text-ai-fg-muted">{row.podIP || '-'}</span>,
        },
        {
          key: 'createTime',
          title: t('cluster.column.createdAt'),
          width: 170,
          hideBelow: 'xl',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
        },
      ],
      empty: { title: t('cluster.workloads.pods.empty'), description: t('cluster.workloads.emptyDescription') },
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
    [cluster, list, t, total, workspaceOf],
  );

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="cluster-pods:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="cluster-pods:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="cluster-pods:surface" state={state} className="min-w-0">
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

/** The fields this page reads from a pod summary. */
interface WorkloadSummaryLike {
  name: string;
  namespace: string;
  status: string;
  node?: string;
  podIP?: string;
  createdAt: string;
}