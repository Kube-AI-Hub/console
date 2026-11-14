import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { configMapsApi, type ConfigMapSummary } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { clusterConfigRowId, projectObjectUrl, useClusterProjectIndex } from './useClusterProjectIndex';

/**
 * 集群级配置字典（跨项目）.
 *
 * Same cross-project question as the Secret page: a ConfigMap is a namespaced
 * object, so a project page can only answer "what is in this project". The cluster
 * page answers "where does this key live", which is the first step of most
 * configuration debugging. Read-only, with the row linking into its own project.
 *
 * The key count is the number of entries under `data`; KubeSphere's old console
 * calls that column 字段, and the count is what tells a reader whether a ConfigMap
 * carries one value or a hundred.
 */
export interface ClusterConfigMapsPageProps {
  cluster: string;
}

const PAGE_SIZE = 20;
const AI_ID = 'cluster-configmaps';

export function ClusterConfigMapsPage({ cluster }: ClusterConfigMapsPageProps): React.ReactElement {
  const t = useT();
  const list = useResourceListState<'name' | 'createTime'>({ defaultSortBy: 'createTime', defaultOrder: 'desc', resetOn: [cluster] });
  const workspaceOf = useClusterProjectIndex(cluster);

  const query = useQuery({
    queryKey: [AI_ID, cluster, list.page, list.sortBy, list.order, list.search],
    queryFn: ({ signal }) =>
      configMapsApi(apiClient).list({
        cluster,
        /*
         * Empty namespace + the default project scope is the cross-project read:
         * the URL keeps the cluster segment, so a member cluster lists its own
         * objects. The module's explicit `scope: 'cluster'` would drop that
         * segment and read the host cluster from a member cluster page.
         */
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

  const schema = React.useMemo<ListSchema<ConfigMapSummary>>(
    () => ({
      title: t('cluster.config.configmaps.title'),
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
                page: 'configmaps',
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
          key: 'keys',
          title: t('configmaps.column.keys'),
          width: 90,
          align: 'right',
          render: (row) => <span className="tabular-nums text-ai-fg-secondary">{row.keys.length}</span>,
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
