import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { nodeResourcesApi, type WorkloadSummary } from '@kube-ai-hub/api-client';
import { ResourceList, Badge, type ListSchema } from '@kube-ai-hub/ui';
import { api } from '@/api';
import { useT } from '@/i18n';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { useClusterProjectIndex } from './useClusterProjectIndex';

type NodeEvent = Awaited<ReturnType<ReturnType<typeof nodeResourcesApi>['events']>>[number];
type Row = WorkloadSummary | NodeEvent;

export function NodeResourcesPanel({ cluster, node, kind }: { cluster: string; node: string; kind: 'pods' | 'events' }): React.ReactElement {
  const t = useT();
  const workspaceOf = useClusterProjectIndex(cluster);
  const list = useResourceListState<'name'>({ defaultSortBy: 'name', resetOn: [cluster, node, kind] });
  const query = useQuery<Row[]>({
    queryKey: ['node-resources', cluster, node, kind],
    queryFn: ({ signal }) => kind === 'pods' ? nodeResourcesApi(api).pods({ cluster, node, signal }) : nodeResourcesApi(api).events({ cluster, node, signal }),
  });
  const filtered = (query.data ?? []).filter((row) =>
    JSON.stringify(row).toLowerCase().includes(list.search.toLowerCase()));
  const schema: ListSchema<Row> = {
    title: t(kind === 'pods' ? 'cluster.workloads.pods.title' : 'node.detail.events'), description: '',
    rowKey: (row) => 'namespace' in row ? `${row.namespace}/${row.name}` : row.name,
    rowAttributes: (row) => ({ 'data-ai-row': row.name }),
    search: { placeholder: t('cluster.searchPlaceholder'), aiId: `node-${kind}:search` },
    refresh: { label: t('common.refresh'), aiId: `node-${kind}:refresh`, busy: query.isFetching },
    columns: kind === 'pods' ? [
      { key: 'name', title: t('cluster.column.name'), render: (row) => {
        const pod = row as WorkloadSummary;
        const workspace = workspaceOf.get(pod.namespace) ?? 'public';
        return <a className="text-ai-accent hover:underline"
          href={`/kube-frontend/${encodeURIComponent(workspace)}/clusters/${encodeURIComponent(cluster)}/projects/${encodeURIComponent(pod.namespace)}/pods/${encodeURIComponent(pod.name)}`}>{pod.name}</a>;
      } },
      { key: 'namespace', title: t('cluster.workloads.column.project') },
      { key: 'status', title: t('cluster.column.status'), render: (row) => <Badge>{(row as WorkloadSummary).status}</Badge> },
    ] : [
      { key: 'type', title: t('cluster.column.status') },
      { key: 'reason', title: t('node.event.reason') },
      { key: 'message', title: t('node.event.message') },
      { key: 'count', title: t('node.event.count') },
      { key: 'lastSeen', title: t('cluster.column.createdAt'), render: (row) => formatTimestamp((row as NodeEvent).lastSeen) },
    ],
    empty: { title: t('common.empty'), description: t('node.resources.empty') },
    labels: { selectAll: t('table.selectAll'), selectRow: (index) => t('table.selectRow', { index }),
      moreActions: t('table.moreActions'), previous: t('table.previous'), next: t('table.next'),
      selected: (count) => t('table.selectedCount', { count }), pageSize: t('table.pageSize'), pageSizeSuffix: t('table.pageSizeSuffix') },
    pagination: { page: list.page, pageSize: list.pageSize, total: filtered.length, pageSizeOptions: [20, 50, 100] },
  };
  return <div data-ai-id={`node-detail:${kind}`}>
    {query.isError ? <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId={`node-${kind}:retry`} /> :
      <ResourceList schema={schema} rows={filtered.slice((list.page - 1) * list.pageSize, list.page * list.pageSize)}
        loading={query.isPending} searchValue={list.keyword} onSearchChange={list.setKeyword}
        onPageChange={list.setPage} onPageSizeChange={list.setPageSize} onRefresh={() => void query.refetch()} />}
  </div>;
}
