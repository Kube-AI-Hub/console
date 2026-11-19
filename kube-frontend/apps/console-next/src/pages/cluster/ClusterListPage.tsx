import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { nodesWriteApi, type NamespaceSummary, type NodeSummary } from '@kube-ai-hub/api-client';
import { Link } from '@tanstack/react-router';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, ResourceList, Tooltip, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { api as apiClient } from '@/api';
import { useT } from '@/i18n';
import { useResourceListState, toListParams } from '@/components/resource/useResourceListState';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { ExecConsoleDialog } from '@/components/resource/ExecConsoleDialog';
import { formatTimestamp } from '@/lib/time';
import { CLUSTER_DESCRIPTORS, useClusterList, useNodeUsage, useProjectPods, withNodeUsage, withProjectUsage, type ClusterKind } from './queries';
import { NodesPage } from './NodesPage';

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

/** Page sizes the old console offered (`PAGESIZE_OPTION`): 10/20/50/100. */
const PAGE_SIZE = 10;

type SortKey = 'name' | 'createTime';

type Row = NodeSummary | NamespaceSummary;

export function ClusterListPage(props: ClusterListPageProps): React.ReactElement {
  return props.kind === 'nodes' ? <NodesPage cluster={props.cluster} /> : <NamespaceListPage {...props} />;
}

function NamespaceListPage({ kind, cluster }: ClusterListPageProps): React.ReactElement {
  const t = useT();
  /*
   * The API's own strings are English (`Ready` / `NotReady` / `Unknown`) because they
   * come from the node's `Ready` condition, not from a catalogue. Printing them raw
   * left an English word in an otherwise Chinese row.
   */
  const nodeStatusLabel = (status: string) => status === 'Running' ? t('node.status.running')
    : status === 'Warning' ? t('node.status.warning')
      : status === 'Unschedulable' ? t('node.status.unschedulable') : status;
  // Cluster-scoped: no project filter, and nothing to reset when the caller changes
  // project — the page has no project context by design.
  const list = useResourceListState<SortKey>({ defaultSortBy: 'name', defaultPageSize: PAGE_SIZE, resetOn: [cluster] });
  const queryClient = useQueryClient();
  const [terminalNode, setTerminalNode] = React.useState<string | null>(null);
  React.useEffect(() => { setTerminalNode(null); }, [cluster, kind]);

  /*
   * 停止调度 / 启动调度 — the old console's cordon and uncordon.
   *
   * Cordon is reversible and evicts nothing, so it is a row action without a confirmation
   * dialog: the status column is the feedback, and it updates because the list is
   * invalidated, not because the page remembers a click.
   */
  const cordon = useMutation({
    mutationFn: (input: { name: string; unschedulable: boolean }) =>
      nodesWriteApi(apiClient).setUnschedulable({ ...input, cluster }),
    // Invalidate the list's own key (see `clusterKey`): a cordon changes a node's
    // schedulability, which is what decides whether the row offers 停止 or 启动调度.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cluster', 'nodes', cluster] });
      void queryClient.invalidateQueries({ queryKey: ['node-detail', cluster] });
    },
  });
  // Empty namespace = cluster-wide collection; the API layer already treats it that way.
  const query = useClusterList(kind, toListParams(list, { cluster, namespace: '' }, list.pageSize));
  // Usage comes from the metrics API and is merged onto the node rows below.
  const nodeUsage = useNodeUsage(cluster, kind === 'nodes');
  // Project rows aggregate pod metrics by namespace; one call covers every project.
  const projectPods = useProjectPods(cluster, kind === 'namespaces');

  const baseRows = (query.data?.items ?? []) as Row[];
  const rows = (kind === 'nodes'
    ? withNodeUsage(baseRows as NodeSummary[], nodeUsage.data ?? {})
    : kind === 'namespaces'
      ? withProjectUsage(baseRows as NamespaceSummary[], projectPods.data)
      : baseRows) as Row[];
  const total = query.data?.total ?? 0;

  const schema = React.useMemo<ListSchema<Row>>(
    () => ({
      title: t(CLUSTER_DESCRIPTORS[kind].titleKey),
      description: t(CLUSTER_DESCRIPTORS[kind].descriptionKey),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('cluster.searchPlaceholder'), aiId: `${kind}:search` },
      ...(kind === 'nodes'
        ? {
            rowActions: [
              {
                key: 'cordon',
                label: t('node.action.cordon'),
                aiId: 'nodes:cordon',
                visible: (row: Row) => !(row as NodeSummary).unschedulable,
                disabled: () => cordon.isPending,
              },
              {
                key: 'uncordon',
                label: t('node.action.uncordon'),
                aiId: 'nodes:uncordon',
                visible: (row: Row) => (row as NodeSummary).unschedulable,
                disabled: () => cordon.isPending,
              },
              { key: 'terminal', label: t('container.terminal.open'), aiId: 'nodes:terminal-open',
                disabled: (row: Row) => (row as NodeSummary).status !== 'Running' },
            ],
          }
        : {}),
      sortableKeys: ['name', 'createTime'],
      // Third click of the header cycle returns to the page's default order;
      // a server list must send a sort key, so "off" cannot be absent.
      sortFallback: list.sortFallback,
      sortAiPrefix: kind,
      sort: { key: list.sortBy, order: list.order },
      columns:
        kind === 'nodes'
          ? [
              {
                key: 'name',
                /* Pinned: the row's identity, kept in place while the other columns scroll. */
                width: 220,
                pin: 'start',
                title: t('cluster.column.name'),
                render: (row: Row) => {
                  const node = row as NodeSummary;
                  return (
                    <span className="flex min-w-0 flex-col" {...actionProps(`${kind}:name:${node.name}`)}>
                      {/* Linked to the node's detail: the row answers "is it healthy", the
                          next question is "why not", which needs its conditions. */}
                      <Link
                        to="/kube-frontend/clusters/$cluster/nodes/$name"
                        params={{ cluster, name: node.name }}
                        className="truncate font-medium text-ai-link hover:underline"
                      >
                        {node.name}
                      </Link>
                      <span className="truncate text-[11px] text-ai-fg-muted">{node.internalIP || '-'}</span>
                    </span>
                  );
                },
              },
              {
                key: 'status',
                title: t('cluster.column.status'),
                width: 120,
                hideable: true,
                hideBelow: 'md',
                render: (row: Row) => {
                  const node = row as NodeSummary;
                  /*
                   * Same three states as the node list, from `kube-server`'s rule:
                   * cordoned, a condition out of range, or healthy. A cordoned node
                   * carries its taints in a tooltip — there can be several and the
                   * badge alone does not say which.
                   */
                  return (
                    <span className="flex flex-col items-start gap-0.5">
                      {node.status === 'Unschedulable' && node.taints.length > 0 ? (
                        <Tooltip content={<span className="flex flex-col gap-0.5">
                          <span className="font-medium">{t('node.status.taints')}</span>
                          {node.taints.map((taint) => <span key={`${taint.key}=${taint.value}:${taint.effect}`} className="font-ai-mono text-[11px]">
                            {`${taint.key}=${taint.value || ''}:${taint.effect}`}
                          </span>)}
                        </span>}>
                          <span data-ai-id={`nodes:taints:${node.name}`}><Badge tone="warning">{nodeStatusLabel(node.status)}</Badge></span>
                        </Tooltip>
                      ) : (
                        <Badge tone={node.status === 'Running' ? 'success' : node.status === 'Warning' ? 'warning' : 'danger'}>
                          {nodeStatusLabel(node.status)}
                        </Badge>
                      )}
                    </span>
                  );
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
                key: 'xpu',
                title: t('node.detail.xpu'),
                render: (row: Row) => <span className="text-ai-fg-secondary">{(row as NodeSummary).xpu || '-'}</span>,
              },
              {
                key: 'version',
                title: t('node.detail.kubeletVersion'),
                hideBelow: 'xl',
                render: (row: Row) => <span className="text-ai-fg-secondary">{(row as NodeSummary).version || '-'}</span>,
              },
              {
                key: 'cpu',
                title: t('cluster.column.cpuUsage'),
                width: 110,
                hideable: true,
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
                hideable: true,
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
                      {/* The row used to be a dead end. The name opens the read-only project
                          detail (quota/limits); the project console stays one click further. */}
                      <Link
                        to="/kube-frontend/clusters/$cluster/namespaces/$name"
                        params={{ cluster, name: project.name }}
                        className="truncate font-medium text-ai-link hover:underline"
                        data-ai-id={`projects:link:${project.name}`}
                      >
                        {project.name}
                      </Link>
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
                hideable: true,
                hideBelow: 'xl',
                render: (row: Row) => <span className="tabular-nums text-ai-fg-secondary">{(row as unknown as { podCount?: number }).podCount ?? '-'}</span>,
              },
              {
                key: 'workspace',
                title: t('cluster.column.workspace'),
                width: 160,
                hideable: true,
                hideBelow: 'lg',
                render: (row: Row) => <span className="truncate text-ai-fg-secondary">{(row as NamespaceSummary).workspace || '-'}</span>,
              },
              {
                key: 'createTime',
                title: t('cluster.column.createdAt'),
                width: 170,
                hideable: true,
                hideBelow: 'xl',
                render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
              },
            ],
      ...(kind === 'namespaces'
        ? { columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'namespaces:columns' } }
        : {}),
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
        pageSize: t('table.pageSize'),
        pageSizeSuffix: t('table.pageSizeSuffix'),
      },
      refresh: { aiId: `${kind}:refresh`, label: t('common.refresh'), busy: query.isFetching },
      pagination: { page: list.page, pageSize: list.pageSize, total, pageSizeOptions: [10, 20, 50, 100] },
    }),
    [kind, list, t, total, cluster, query.isFetching, cordon.isPending],
  );

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('namespaces', columnKeys);

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
        refreshing={query.isFetching && !query.isPending}
        searchValue={list.keyword}
        onSearchChange={list.setKeyword}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        {...(kind === 'namespaces' && columnVisibility.visibleColumnKeys
          ? { visibleColumnKeys: columnVisibility.visibleColumnKeys }
          : {})}
        {...(kind === 'namespaces' ? { onVisibleColumnsChange: columnVisibility.setVisibleColumnKeys } : {})}
        onRefresh={() => { void query.refetch(); if (kind === 'nodes') void nodeUsage.refetch(); else void projectPods.refetch(); }}
        onSortChange={(next: { key: string; order: SortOrder }) => {
          if (next) list.setSort(next);
        }}
        onAction={(action, row) => {
          const node = row as NodeSummary;
          if (action === 'cordon') cordon.mutate({ name: node.name, unschedulable: true });
          if (action === 'uncordon') cordon.mutate({ name: node.name, unschedulable: false });
          if (action === 'terminal' && node.status === 'Running') setTerminalNode(node.name);
        }}
      />
      <MutationAlert error={cordon.error} />
      {terminalNode ? <ExecConsoleDialog target={{ cluster, node: terminalNode }}
        title={`${t('container.terminal.title')} · ${terminalNode}`} aiPrefix="node" onClose={() => setTerminalNode(null)} /> : null}
    </AiSurface>
  );
}
