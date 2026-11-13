import * as React from 'react';
import { type NamespaceSummary, type NodeSummary } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { useResourceListState, toListParams } from '@/components/resource/useResourceListState';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { CLUSTER_DESCRIPTORS, useClusterList, useNodeUsage, useProjectPods, withNodeUsage, withProjectUsage, type ClusterKind } from './queries';

/**
 * The cluster console's lists: 节点 and 项目.
 *
 * These are cluster-scoped — `/kube-frontend/clusters/<id>/<page>` with no workspace
 * and no namespace — so they read the cluster-wide collections the old console's
 * 集群管理 group reads. Both are read-only here; draining a node or editing a
 * project is a separate workflow the platform owns.
 */
export interface ClusterListPageProps {
  kind: ClusterKind;
  cluster: string;
}

const PAGE_SIZE = 10;

type SortKey = 'name' | 'createTime';

type Row = NodeSummary | NamespaceSummary;

export function ClusterListPage({ kind, cluster }: ClusterListPageProps): React.ReactElement {
  const t = useT();
  // Cluster-scoped: no project filter, and nothing to reset when the caller changes
  // project — the page has no project context by design.
  const list = useResourceListState<SortKey>({ defaultSortBy: 'name', resetOn: [cluster] });
  // Empty namespace = cluster-wide collection; the API layer already treats it that way.
  const query = useClusterList(kind, toListParams(list, { cluster, namespace: '' }, PAGE_SIZE));
  // Usage comes from the metrics API and is merged onto the node rows below.
  const nodeUsage = useNodeUsage();
  // Project rows aggregate pod metrics by namespace; one call covers every project.
  const projectPods = useProjectPods();

  const baseRows = (query.data?.items ?? []) as Row[];
  const rows = (kind === 'nodes'
    ? withNodeUsage(baseRows as NodeSummary[], nodeUsage.data ?? {})
    : kind === 'namespaces'
      ? withProjectUsage(baseRows as NamespaceSummary[], projectPods.data ?? {})
      : baseRows) as Row[];
  const total = query.data?.total ?? 0;

  const schema = React.useMemo<ListSchema<Row>>(
    () => ({
      title: t(CLUSTER_DESCRIPTORS[kind].titleKey),
      description: t(CLUSTER_DESCRIPTORS[kind].descriptionKey),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('cluster.searchPlaceholder'), keys: ['name'], aiId: `${kind}:search` },
      sortableKeys: ['name', 'createTime'],
      sortAiPrefix: kind,
      sort: { key: list.sortBy, order: list.order },
      columns:
        kind === 'nodes'
          ? [
              {
                key: 'name',
                title: t('cluster.column.name'),
                render: (row: Row) => {
                  const node = row as NodeSummary;
                  return (
                    <span className="flex min-w-0 flex-col" {...actionProps(`${kind}:name:${node.name}`)}>
                      <span className="truncate font-medium text-ai-fg">{node.name}</span>
                      <span className="truncate text-[11px] text-ai-fg-muted">{node.internalIP || '-'}</span>
                    </span>
                  );
                },
              },
              {
                key: 'status',
                title: t('cluster.column.status'),
                width: 120,
                hideBelow: 'md',
                render: (row: Row) => {
                  const node = row as NodeSummary;
                  return <Badge tone={node.status === 'Ready' ? 'success' : 'danger'}>{node.status}</Badge>;
                },
              },
              {
                key: 'role',
                title: t('cluster.column.role'),
                width: 140,
                hideBelow: 'lg',
                render: (row: Row) => <span className="text-ai-fg-secondary">{(row as NodeSummary).role}</span>,
              },
              {
                key: 'cpu',
                title: t('cluster.column.cpuUsage'),
                width: 110,
                hideBelow: 'lg',
                // The percentage is what an operator watches; the capacity sits in the
                // title so the absolute number is one hover away.
                render: (row: Row) => {
                  const node = row as NodeSummary;
                  return node.cpuPercent === undefined ? (
                    <span className="text-ai-fg-muted">-</span>
                  ) : (
                    <span className="tabular-nums text-ai-fg-secondary" title={`${node.cpuUsage} / ${node.cpu}`}>
                      {node.cpuPercent}%
                    </span>
                  );
                },
              },
              {
                key: 'memory',
                title: t('cluster.column.memoryUsage'),
                width: 110,
                hideBelow: 'lg',
                render: (row: Row) => {
                  const node = row as NodeSummary;
                  return node.memoryPercent === undefined ? (
                    <span className="text-ai-fg-muted">-</span>
                  ) : (
                    <span className="tabular-nums text-ai-fg-secondary" title={`${node.memoryUsage} / ${node.memory}`}>
                      {node.memoryPercent}%
                    </span>
                  );
                },
              },
            ]
          : [
              {
                key: 'name',
                title: t('cluster.column.name'),
                render: (row: Row) => {
                  const project = row as NamespaceSummary;
                  return (
                    <span className="flex min-w-0 flex-col" {...actionProps(`${kind}:name:${project.name}`)}>
                      <span className="truncate font-medium text-ai-fg">{project.name}</span>
                      <span className="truncate text-[11px] text-ai-fg-muted">{project.description || '-'}</span>
                    </span>
                  );
                },
              },
              {
                key: 'status',
                title: t('cluster.column.status'),
                width: 130,
                hideBelow: 'md',
                render: (row: Row) => {
                  const project = row as NamespaceSummary;
                  return <Badge tone={project.status === 'Active' ? 'success' : 'warning'}>{project.status}</Badge>;
                },
              },
              {
                key: 'cpu',
                title: t('cluster.column.cpuUsage'),
                width: 100,
                hideBelow: 'lg',
                // A project has no fixed capacity, so a percentage would need a quota
                // to divide by; the absolute total is what the old console shows too.
                render: (row: Row) => <span className="tabular-nums text-ai-fg-secondary">{(row as unknown as { cpuUsed?: string }).cpuUsed ?? '-'}</span>,
              },
              {
                key: 'memory',
                title: t('cluster.column.memoryUsage'),
                width: 110,
                hideBelow: 'lg',
                render: (row: Row) => <span className="tabular-nums text-ai-fg-secondary">{(row as unknown as { memoryUsed?: string }).memoryUsed ?? '-'}</span>,
              },
              {
                key: 'pods',
                title: t('cluster.column.pods'),
                width: 90,
                hideBelow: 'xl',
                render: (row: Row) => <span className="tabular-nums text-ai-fg-secondary">{(row as unknown as { podCount?: number }).podCount ?? '-'}</span>,
              },
              {
                key: 'workspace',
                title: t('cluster.column.workspace'),
                width: 160,
                hideBelow: 'lg',
                render: (row: Row) => <span className="truncate text-ai-fg-secondary">{(row as NamespaceSummary).workspace || '-'}</span>,
              },
              {
                key: 'createTime',
                title: t('cluster.column.createdAt'),
                width: 170,
                hideBelow: 'xl',
                render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
              },
            ],
      rowActions: [],
      empty: {
        title: t(CLUSTER_DESCRIPTORS[kind].emptyTitleKey),
        description: t(CLUSTER_DESCRIPTORS[kind].emptyDescriptionKey),
      },
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
    [kind, list, t, total],
  );

  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId={`${kind}:surface`} state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId={`${kind}:retry`} />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId={`${kind}:surface`} state={state} className="min-w-0">
      <ResourceList
        schema={schema}
        rows={rows}
        loading={state === 'loading'}
        searchValue={list.keyword}
        onSearchChange={list.setKeyword}
        onPageChange={list.setPage}
        onSortChange={(next: { key: string; order: SortOrder } | undefined) => {
          if (next) list.setSort(next);
        }}
      />
    </AiSurface>
  );
}
