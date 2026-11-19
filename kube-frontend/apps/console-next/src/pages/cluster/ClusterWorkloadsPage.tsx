import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  workloadsApi,
  type ResourceListResult,
  type WorkloadDetail,
  type WorkloadKind,
  type WorkloadSummary,
} from '@kube-ai-hub/api-client';
import { api as apiClient } from '@/api';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useListRefresh } from '@/components/resource/useListRefresh';
import { useProjectFilter } from '@/components/projects/useProjects';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { EditInfoDialog } from '@/components/resource/EditInfoDialog';
import { LoadingDialog } from '@/components/resource/LoadingDialog';
import { DialogSuspense } from '@/components/resource/DialogSuspense';
import { MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { statusLabel } from '@/lib/status';
import { clusterProjectRowId, projectObjectUrl, useClusterProjectIndex } from './useClusterProjectIndex';

const YamlDialog = React.lazy(() => import('@/components/resource/YamlDialog'));
import { toYaml } from '@/components/resource/yaml';

/**
 * 集群级工作负载（跨项目）.
 *
 * One list per controller, all of them cluster-wide: the old console's 集群 › 工作负载 group is
 * eight pages and every one answers the same question the project pages cannot — 'what exists
 * anywhere, and in which project'. Rows carry a project column and link into it.
 *
 * The shared piece is this page; the kind-specific columns are the only difference. Pods live on
 * their own page because they also show the node and pod IP.
 *
 * Two things live here that are easy to lose in a refactor, because the page still looks right
 * without them:
 *
 * - **项目筛选** narrows the request to one namespace. Without it the page can only answer
 *   "everything", and a reader who spotted a name in a conversation has to guess the project
 *   by scrolling.
 * - **行操作** (编辑信息 / 编辑 YAML / 删除) write to the row's *own* namespace. A cluster list
 *   has no namespace of its own, so the row is the only source of truth for the address —
 *   writing with the page's empty namespace produces a path with no `namespaces/<ns>` segment
 *   and a 404.
 */
const KINDS: WorkloadKind[] = ['deployments', 'statefulsets', 'daemonsets', 'jobs', 'cronjobs', 'services', 'ingresses'];

/** Kinds whose YAML is worth opening in the editor; a Service has no template to read. */
const YAML_EDITABLE: WorkloadKind[] = ['deployments', 'statefulsets', 'daemonsets', 'jobs', 'cronjobs', 'services', 'ingresses'];

export interface ClusterWorkloadsPageProps {
  cluster: string;
  kind: WorkloadKind;
}

type Dialog =
  | { kind: 'none' }
  | { kind: 'loading'; target: 'editInfo' | 'editYaml'; subject: string }
  | { kind: 'editInfo'; detail: WorkloadDetail }
  | { kind: 'editYaml'; detail: WorkloadDetail }
  | { kind: 'delete'; rows: WorkloadSummary[] };

export function ClusterWorkloadsPage({ cluster, kind }: ClusterWorkloadsPageProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const list = useResourceListState<'name' | 'createTime'>({ defaultSortBy: 'createTime', defaultOrder: 'desc', resetOn: [cluster, kind] });
  const aiId = `cluster-${kind}`;
  const [projectFilter, setProjectFilter] = React.useState('');
  const [dialog, setDialog] = React.useState<Dialog>({ kind: 'none' });
  // A cluster switch must not carry a namespace that belongs to the previous one.
  React.useEffect(() => setProjectFilter(''), [cluster, kind]);

  const query = useQuery<ResourceListResult<WorkloadSummary>>({
    // The namespace is part of the key: two requests that differ only by project would
    // otherwise share one cache entry and the filtered list would show the unfiltered page.
    queryKey: [aiId, cluster, projectFilter, list.page, list.pageSize, list.sortBy, list.order, list.search],
    // List transitions retain rows, but switching resource or cluster must not.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[0] === aiId && previousQuery.queryKey[1] === cluster ? previous : undefined,
    queryFn: ({ signal }) =>
      workloadsApi(apiClient, kind).list({
        cluster,
        /*
         * Empty namespace is the cross-project read; a chosen project narrows it. The
         * cluster segment stays in the path either way, so a member cluster lists its
         * own objects.
         */
        namespace: projectFilter,
        page: list.page,
        pageSize: list.pageSize,
        sortBy: list.sortBy,
        order: list.order,
        keyword: list.search,
        signal,
      }),
  });

  const api = workloadsApi(apiClient, kind);
  const invalidate = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [aiId] });
  }, [queryClient, aiId]);
  /*
   * Every write addresses the row's own namespace, never the page's.
   *
   * `projectFilter` is empty on the default view, and a write built from it would go to
   * `/kapis/.../deployments/<name>` — a collection path with no name — which the API
   * answers 404/405 rather than explaining.
   */
  const patch = useMutation({
    mutationFn: (input: { namespace: string; name: string; body: unknown }) =>
      api.patch({ cluster, namespace: input.namespace, name: input.name, body: input.body as never }),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: (input: { namespace: string; body: Record<string, unknown> }) =>
      api.update({ cluster, namespace: input.namespace, body: input.body as never }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (input: { namespace: string; names: string[] }) =>
      api.remove({ cluster, namespace: input.namespace, names: input.names }),
    onSuccess: invalidate,
  });

  const openWithDetail = React.useCallback(
    async (target: 'editInfo' | 'editYaml', row: WorkloadSummary) => {
      setDialog({ kind: 'loading', target, subject: row.name });
      try {
        const detail = await api.get({ cluster, namespace: row.namespace, name: row.name });
        setDialog({ kind: target, detail });
      } catch {
        setDialog({ kind: 'none' });
      }
    },
    [api, cluster],
  );

  // Projects are indexed once so each row can link into its own console.
  const workspaceOf = useClusterProjectIndex(cluster);
  const projectFilterControl = useProjectFilter(
    cluster,
    t('cluster.workloads.filter.projectLabel'),
    t('cluster.workloads.filter.project'),
    undefined,
    `${aiId}:filter:project`,
  );

  const rows = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';
  const listRefresh = useListRefresh(aiId, query);

  const schema = React.useMemo<ListSchema<WorkloadSummary>>(
    () => ({
      title: t(`cluster.workloads.${kind}.title` as 'cluster.workloads.deployments.title'),
      description: t('cluster.workloads.description'),
      // Project + name: `kube-root-ca.crt`-style duplicates across projects are the
      // normal case on a cluster-wide list.
      rowKey: (row) => clusterProjectRowId(row),
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('cluster.searchPlaceholder'), aiId: `${aiId}:search` },
      // The project picker is a scope, not a field of a row, so it stays in the toolbar.
      filters: [projectFilterControl],
      refresh: listRefresh.refresh,
      selection: 'multiple',
      sortableKeys: ['name', 'createTime'],
      // Third click of the header cycle returns to the page's default order;
      // a server list must send a sort key, so "off" cannot be absent.
      sortFallback: list.sortFallback,
      sortAiPrefix: aiId,
      sort: { key: list.sortBy, order: list.order },
      selectAiId: `${aiId}:select`,
      // Only the identity column is permanent; every other column can be hidden.
      columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: `${aiId}:columns` },
      actions: [
        {
          key: 'bulk-delete',
          label: t('cluster.workloads.action.bulkDelete'),
          tone: 'danger' as const,
          aiId: `${aiId}:bulk-delete`,
          aiNeeds: [`${aiId}:row-select`],
        },
      ],
      columns: [
        {
          key: 'name',
          title: t('cluster.column.name'),
          /*
           * Pinned: the name is the row's identity, and the project/status columns to
           * its right are what scroll away on a narrow viewport.
           */
          width: 220,
          pin: 'start',
          render: (row) => {
            const workspace = workspaceOf.get(row.namespace) ?? 'public';
            return (
              <a
                href={projectObjectUrl({
                  cluster,
                  workspace,
                  namespace: row.namespace,
                  page: kind,
                  name: row.name,
                })}
                className="truncate font-medium text-ai-link hover:underline"
                {...actionProps(`${aiId}:name:${row.name}`)}
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
          hideBelow: 'md',
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.namespace || '-'}</span>,
        },
        {
          key: 'status',
          hideable: true,
          title: t('cluster.column.status'),
          width: 130,
          render: (row) => (
            <Badge tone={statusTone(row.status)}>
              {/* Shared label table: the same state must not read "running" here and 「运行中」
                  on the project page (guide pitfall 52). */}
              {row.status ? statusLabel(t as never, row.status) : '-'}
            </Badge>
          ),
        },
        {
          key: 'ready',
          hideable: true,
          title: t('cluster.workloads.column.ready'),
          width: 110,
          hideBelow: 'lg',
          hint: t('workloads.hint.ready'),
          hintLabel: t('cluster.workloads.column.ready'),
          render: (row) => (
            <span className="tabular-nums text-ai-fg-secondary">
              {row.ready !== undefined || row.total !== undefined ? `${row.ready ?? 0}/${row.total ?? 0}` : '-'}
            </span>
          ),
        },
        {
          key: 'images',
          hideable: true,
          title: t('cluster.workloads.column.images'),
          hideBelow: 'xl',
          hint: t('workloads.hint.images'),
          hintLabel: t('cluster.workloads.column.images'),
          render: (row) => (
            <span className="truncate font-mono text-[11px] text-ai-fg-muted">{row.images.join(', ') || '-'}</span>
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
      /*
       * Row actions, in the old console's order, on the row's own namespace.
       *
       * Federated objects carry `kubefed.io/managed=true` and are reconciled from the
       * control plane: editing one here is silently reverted, so the entry is omitted
       * rather than offered and undone.
       */
      rowActions: [
        { key: 'editInfo', label: t('resource.action.editInfo'), visible: (row) => !row.federated },
        ...(YAML_EDITABLE.includes(kind)
          ? [{ key: 'editYaml', label: t('resource.action.editYaml'), visible: (row: WorkloadSummary) => !row.federated }]
          : []),
        { key: 'delete', label: t('common.delete'), tone: 'danger' as const, visible: (row) => !row.federated },
      ],
      empty: { title: t('cluster.workloads.emptyTitle'), description: t('cluster.workloads.emptyDescription') },
      // A narrowed list says "nothing matches"; the project scope alone does not count
      // as narrowing (an empty project is a real, different answer).
      narrowed: Boolean(list.search),
      labels: {
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
        pageSize: t('table.pageSize'),
        pageSizeSuffix: t('table.pageSizeSuffix'),
        range: (from, to, count) => t('table.range', { from, to, total: count }),
        goToPage: t('table.goToPage'),
        jumpTo: t('table.jumpTo'),
        clearSearch: t('cluster.workloads.clearSearch'),
        clearFilters: t('node.filter.clearAll'),
        clearFilter: (title) => t('node.filter.clear', { title }),
        emptyClear: t('table.clearSearchAndFilters'),
        emptyRefresh: t('common.refresh'),
      },
      pagination: { page: list.page, pageSize: list.pageSize, pageSizeOptions: [10, 20, 50, 100], total },
    }),
    [aiId, cluster, kind, list, listRefresh, projectFilterControl, t, total, workspaceOf],
  );

  // One stored choice per resource kind: hiding a column on Deployments must not hide
  // the same key on Services, which has different columns behind the same page.
  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('cluster-workloads:' + kind, columnKeys);

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId={`${aiId}:surface`} state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId={`${aiId}:retry`} />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId={`${aiId}:surface`} state={state} aria-busy={query.isFetching} className="min-w-0">
      <ResourceList
        schema={schema}
        rows={rows}
        {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
        onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys}
        loading={state === 'loading'}
        // Rows stay while a refetch runs, dimmed, so the reader keeps their place.
        refreshing={listRefresh.refreshing}
        searchValue={list.keyword}
        onSearchChange={list.setKeyword}
        onRefresh={listRefresh.onRefresh}
        filters={{ project: projectFilter }}
        onFiltersChange={(next) => {
          setProjectFilter(next['project'] ?? '');
          list.setPage(1);
        }}
        selectedKeys={list.selected}
        onSelectionChange={list.setSelected}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        onSortChange={(next: { key: string; order: SortOrder }) => {
          if (next) list.setSort(next);
        }}
        onAction={(action, row) => {
          if (!row) return;
          if (action === 'delete') return setDialog({ kind: 'delete', rows: [row] });
          if (action === 'editInfo' || action === 'editYaml') void openWithDetail(action, row);
        }}
        onBulkAction={(action, keys) => {
          if (action !== 'bulk-delete' || keys.length === 0) return;
          // The selection holds row keys (`ns/name`), so the rows themselves are the
          // only way back to each object's own namespace.
          setDialog({ kind: 'delete', rows: rows.filter((row) => keys.includes(clusterProjectRowId(row))) });
        }}
      />

      <MutationAlert error={patch.error ?? update.error ?? remove.error} />

      {dialog.kind === 'loading' ? (
        <LoadingDialog
          open
          subject={dialog.subject}
          size="xl"
          title={dialog.target === 'editInfo' ? t('resource.action.editInfo') : t('resource.action.editYaml')}
        />
      ) : null}

      {dialog.kind === 'delete' ? (
        <DeleteDialog
          open
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          names={dialog.rows.map((row) => row.name)}
          resource={kind}
          noun={t(`cluster.workloads.${kind}.title` as 'cluster.workloads.deployments.title')}
          pending={remove.isPending}
          onConfirm={async () => {
            /*
             * Grouped by project: one delete call per namespace, so a partial failure
             * is visible against the project that failed instead of being collapsed
             * into one opaque error. A cluster-wide delete has no single endpoint.
             */
            const byNamespace = new Map<string, string[]>();
            for (const row of dialog.rows) {
              const names = byNamespace.get(row.namespace) ?? [];
              names.push(row.name);
              byNamespace.set(row.namespace, names);
            }
            for (const [namespace, names] of byNamespace) {
              await remove.mutateAsync({ namespace, names });
            }
            list.setSelected([]);
            setDialog({ kind: 'none' });
          }}
        />
      ) : null}

      {dialog.kind === 'editInfo' ? (
        <EditInfoDialog
          open
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          resource={kind}
          name={dialog.detail.name}
          alias={dialog.detail.alias}
          description={dialog.detail.description}
          annotations={dialog.detail.annotations}
          pending={patch.isPending}
          onSubmit={async (annotations) => {
            // A merge patch on the row's own namespace: the rest of the object is not
            // re-sent, so a concurrent scale is not undone by an alias edit.
            await patch.mutateAsync({
              namespace: dialog.detail.namespace,
              name: dialog.detail.name,
              body: { metadata: { annotations } },
            });
            setDialog({ kind: 'none' });
          }}
        />
      ) : null}

      {dialog.kind === 'editYaml' ? (
        <DialogSuspense>
          <YamlDialog
            open
            onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
            initialYaml={toYaml(dialog.detail.raw)}
            lockName={dialog.detail.name}
            title={t('resource.action.editYaml')}
            submitLabel={t('common.confirm')}
            pending={update.isPending}
            onSubmit={async (object) => {
              await update.mutateAsync({ namespace: dialog.detail.namespace, body: object as Record<string, unknown> });
              setDialog({ kind: 'none' });
            }}
          />
        </DialogSuspense>
      ) : null}
    </AiSurface>
  );
}

/** Badge tone per state, shared with the project lists' vocabulary. */
function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  if (status === 'running') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'stopped' || status === 'paused') return 'neutral';
  if (status === 'updating' || status === 'waiting') return 'warning';
  return 'info';
}

export const CLUSTER_WORKLOAD_KINDS = KINDS;
