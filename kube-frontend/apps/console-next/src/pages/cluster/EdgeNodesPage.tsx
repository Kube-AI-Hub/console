import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { toNodeSummary, type KubeObject, type NodeSummary } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';

/**
 * 边缘节点.
 *
 * The cluster node list deliberately excludes edge nodes (`labelSelector=!node-role.kubernetes.io/edge`):
 * a node that may be intermittently connected belongs in its own list, which is what the old
 * console does. This page reads the same kapis collection with the inverse selector, so no new
 * backend is involved, and links into the shared node detail (running status, pods, monitoring).
 */
export interface EdgeNodesPageProps {
  cluster: string;
}

export function EdgeNodesPage({ cluster }: EdgeNodesPageProps): React.ReactElement {
  const t = useT();
  const list = useResourceListState<'name' | 'createTime'>({ defaultSortBy: 'name', resetOn: [cluster] });

  const query = useQuery({
    queryKey: ['edge-nodes', cluster],
    queryFn: async ({ signal }) => {
      const body = await apiClient.request<{ items?: KubeObject[]; totalItems?: number }>(
        '/kapis/resources.kubesphere.io/v1alpha3/nodes',
        { query: { limit: -1, labelSelector: 'node-role.kubernetes.io/edge' }, signal },
      );
      const items = (body?.items ?? []).map((item) => toNodeSummary(item));
      return { items, total: body?.totalItems ?? items.length };
    },
  });

  const all = query.data?.items ?? [];
  const keyword = list.search.trim().toLowerCase();
  const filtered = keyword ? all.filter((row) => row.name.toLowerCase().includes(keyword)) : all;
  const rows = React.useMemo(() => {
    const sorted = [...filtered];
    const direction = list.order === 'asc' ? 1 : -1;
    if (list.sortBy === 'createTime') sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt) * direction);
    else sorted.sort((a, b) => a.name.localeCompare(b.name) * direction);
    return sorted;
  }, [filtered, list.sortBy, list.order]);

  const schema: ListSchema<NodeSummary> = {
    title: t('cluster.edgeNodes.title'),
    description: t('cluster.edgeNodes.description'),
    rowKey: 'name',
    rowAttributes: (row) => ({ 'data-ai-row': row.name }),
    search: { placeholder: t('cluster.searchPlaceholder'), aiId: 'edgenodes:search' },
    refresh: { label: t('common.refresh'), aiId: 'edgenodes:refresh', busy: query.isFetching },
    sortableKeys: ['name', 'createTime'],
    sortAiPrefix: 'edgenodes',
    sort: { key: list.sortBy, order: list.order },
    columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'edge-nodes:columns' },
    columns: [
      {
        key: 'name',
        title: t('cluster.column.name'),
        render: (row) => (
          <Link
            to="/kube-frontend/clusters/$cluster/edgenodes/$name"
            params={{ cluster, name: row.name }}
            className="inline-flex min-h-6 items-center font-medium text-ai-accent hover:underline"
            data-ai-id={`edgenodes:link:${row.name}`}
          >
            {row.name}
          </Link>
        ),
      },
      { key: 'status', hideable: true, title: t('cluster.column.status'), render: (row) => <Badge tone={row.status === 'Ready' ? 'success' : 'danger'}>{row.status}</Badge> },
      { key: 'internalIP', hideable: true, title: t('node.detail.internalIP'), hideBelow: 'md', render: (row) => <span className="tabular-nums">{row.internalIP || '-'}</span> },
      { key: 'createdAt', hideable: true, title: t('cluster.column.createdAt'), hideBelow: 'md', render: (row) => <span className="tabular-nums text-ai-fg-muted">{row.createdAt || '-'}</span> },
    ],
    empty: {
      title: t('cluster.edgeNodes.emptyTitle'),
      description: t('cluster.edgeNodes.emptyDescription'),
    },
  };

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('edge-nodes', columnKeys);

  return (
    <AiSurface as="section" aiId="edgenodes:surface" data-ai-id="edgenodes:surface" state={query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready'}>
      {query.isError ? (
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="edgenodes:retry" />
      ) : (
        <ResourceList
        {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
        onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys}
          schema={schema}
          rows={rows}
          loading={query.isPending}
          searchValue={list.keyword}
          onSearchChange={list.setKeyword}
          onRefresh={() => void query.refetch()}
          onSortChange={(next: { key: string; order: SortOrder } | undefined) => { if (next) list.setSort(next); }}
        />
      )}
    </AiSurface>
  );

}
