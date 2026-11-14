import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { secretsApi, type SecretSummary } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { SECRET_TYPE_LABEL } from '@/pages/secrets/secretTypes';
import { clusterConfigRowId, projectObjectUrl, useClusterProjectIndex } from './useClusterProjectIndex';

/**
 * 集群级保密字典（跨项目）.
 *
 * The question this page answers is the one a project page cannot: which project
 * holds a Secret, and where it is. Rows are read-only and link into the owning
 * project's console, where editing lives — a second editor on the cluster page
 * would give one object two doors and two sets of permissions.
 *
 * The list is the cluster-wide kapis collection (no namespace segment). A Secret
 * does not carry its workspace, so the project index is read once to build the
 * link target.
 */
export interface ClusterSecretsPageProps {
  cluster: string;
}

const PAGE_SIZE = 20;
const AI_ID = 'cluster-secrets';

export function ClusterSecretsPage({ cluster }: ClusterSecretsPageProps): React.ReactElement {
  const t = useT();
  const list = useResourceListState<'name' | 'createTime'>({ defaultSortBy: 'createTime', defaultOrder: 'desc', resetOn: [cluster] });
  const workspaceOf = useClusterProjectIndex(cluster);

  const query = useQuery({
    queryKey: [AI_ID, cluster, list.page, list.sortBy, list.order, list.search],
    queryFn: ({ signal }) =>
      secretsApi(apiClient).list({
        cluster,
        // Empty namespace asks the resources proxy for the cluster-wide collection.
        namespace: '',
        page: list.page,
        pageSize: PAGE_SIZE,
        sortBy: list.sortBy,
        order: list.order,
        keyword: list.search,
        signal,
      }),
  });

  const rows = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  const schema = React.useMemo<ListSchema<SecretSummary>>(
    () => ({
      title: t('cluster.config.secrets.title'),
      description: t('cluster.config.description'),
      rowKey: (row) => clusterConfigRowId(row),
      rowAttributes: (row) => ({ 'data-ai-row': clusterConfigRowId(row) }),
      search: { placeholder: t('cluster.searchPlaceholder'), aiId: AI_ID + ':search' },
      sortableKeys: ['name', 'createTime'],
      sortAiPrefix: AI_ID,
      sort: { key: list.sortBy, order: list.order },
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
                page: 'secrets',
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
          title: t('cluster.workloads.column.project'),
          width: 180,
          hideBelow: 'md',
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.namespace || '-'}</span>,
        },
        {
          key: 'type',
          title: t('secrets.column.type'),
          width: 180,
          render: (row) => <span className="truncate text-ai-fg-secondary">{secretTypeLabel(t, row.type)}</span>,
        },
        {
          key: 'fieldCount',
          title: t('secrets.column.fieldCount'),
          width: 90,
          align: 'right',
          render: (row) => <span className="tabular-nums text-ai-fg-secondary">{row.fieldCount}</span>,
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
    [cluster, list, t, total, workspaceOf],
  );

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

/**
 * Type label for a stored type.
 *
 * Unknown types print verbatim (same rule as the project page): a CRD operator's
 * own type name is the most useful thing to show, and inventing a label would hide
 * what the workload expects.
 */
function secretTypeLabel(t: ReturnType<typeof useT>, type: string): string {
  const key = SECRET_TYPE_LABEL[type];
  return key ? t(key as Parameters<typeof t>[0]) : type || '-';
}
