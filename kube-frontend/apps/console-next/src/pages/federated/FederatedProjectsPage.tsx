import * as React from 'react';
import { accessReviewApi, type FederatedProjectSummary } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import {
  AiSurface,
  Badge,
  Notify,
  ResourceList,
  type ListSchema,
  type SortOrder,
} from '@kube-ai-hub/ui';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useT } from '@/i18n';
import { api } from '@/api';
import { formatTimestamp } from '@/lib/time';
import { useAuth } from '@/shell/AuthProvider';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { EditInfoDialog } from '@/components/resource/EditInfoDialog';
import { errorMessage, MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { useListRefresh } from '@/components/resource/useListRefresh';
import { useResourceListState } from '@/components/resource/useResourceListState';
import {
  useCreateFederatedProject,
  useDeleteFederatedProjects,
  useFederatedClusters,
  useFederatedPermission,
  useFederatedProjects,
  useUpdateFederatedProjectInfo,
  useUpdateFederatedProjectPlacement,
  useWorkspaceAliases,
} from './queries';
import {
  FederatedProjectCreateDialog,
  FederatedProjectPlacementDialog,
  type FederatedClusterOption,
} from './FederatedProjectDialogs';

/**
 * 联邦项目列表.
 *
 * A federated project is a FederatedNamespace: one object places a namespace on a set
 * of clusters. The list is the old console's 多集群项目页: name (with alias), namespace,
 * placement, propagation state and creation time, plus the writes the old console had —
 * create, edit information, add cluster (here: adjust placement) and delete, single and
 * bulk.
 *
 * The federation API collection has no KubeSphere page/sort/total contract, so this
 * page pages and sorts the complete workspace-scoped set in the browser. That is
 * deliberate and recorded in the design: filtering server-side would drop the objects
 * whose workspace label lives on the template (the pre-existing one does), i.e. it
 * would trade a correct list for a pager.
 */
export interface FederatedProjectsPageProps {
  workspace: string;
}

/** Page sizes the old console offered (`PAGESIZE_OPTION`): 10/20/50/100. */
const PAGE_SIZES = [10, 20, 50, 100] as const;
const PAGE_SIZE = 10;

type SortKey = 'name' | 'createdAt';

/** Case-insensitive "contains" over the fields the list shows. */
function matchesSearch(project: FederatedProjectSummary, keyword: string): boolean {
  if (!keyword) return true;
  const needle = keyword.toLowerCase();
  return [project.name, project.alias, project.description, project.namespace].some((value) =>
    value.toLowerCase().includes(needle),
  );
}

/** True when the propagation state should read as healthy. */
function propagationTone(project: FederatedProjectSummary): 'success' | 'danger' | 'neutral' {
  if (project.propagated === true) return 'success';
  if (project.propagated === false) return 'danger';
  return 'neutral';
}

export function FederatedProjectsPage({ workspace }: FederatedProjectsPageProps): React.ReactElement {
  const t = useT();
  const { user } = useAuth();
  const query = useFederatedProjects(workspace);
  const aliases = useWorkspaceAliases();
  const clusters = useFederatedClusters();
  const list = useResourceListState<SortKey>({ defaultSortBy: 'createdAt', defaultOrder: 'desc', defaultPageSize: PAGE_SIZE, resetOn: [workspace] });
  const listRefresh = useListRefresh('federated-projects', query);
  const permission = useFederatedPermission({ verb: 'create', workspace });

  const all = React.useMemo(() => query.data ?? [], [query.data]);
  const visible = React.useMemo(() => {
    const filtered = all.filter((project) => matchesSearch(project, list.search));
    return [...filtered].sort((a, b) => {
      const direction = list.order === 'asc' ? 1 : -1;
      if (list.sortBy === 'createdAt') return a.createdAt.localeCompare(b.createdAt) * direction;
      return a.name.localeCompare(b.name) * direction;
    });
  }, [all, list.order, list.search, list.sortBy]);
  const total = visible.length;
  const pageRows = React.useMemo(
    () => visible.slice((list.page - 1) * list.pageSize, list.page * list.pageSize),
    [list.page, list.pageSize, visible],
  );

  const projected = React.useMemo(() => new Set(all.map((project) => project.name)), [all]);

  const [creating, setCreating] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<FederatedProjectSummary | null>(null);
  const [placementTarget, setPlacementTarget] = React.useState<FederatedProjectSummary | null>(null);
  const [deleting, setDeleting] = React.useState<string[] | null>(null);
  const [denied, setDenied] = React.useState<string | null>(null);

  const createProject = useCreateFederatedProject(workspace);
  const updateProject = useUpdateFederatedProjectInfo(workspace);
  const updatePlacement = useUpdateFederatedProjectPlacement(workspace);
  const removeProjects = useDeleteFederatedProjects(workspace);

  /**
   * Ask the authorization API before opening a destructive dialog, with the exact
   * namespace the request will use. It fails open: a broken probe must not take a
   * permitted action away — only an explicit denial blocks it.
   */
  const requirePermission = React.useCallback(
    async (verb: 'update' | 'delete', name: string): Promise<boolean> => {
      try {
        const allowed = await accessReviewApi(api).allowed({
          verb,
          resource: verb === 'delete' ? 'namespaces' : 'federatednamespaces',
          ...(verb === 'delete' ? {} : { group: 'types.kubefed.io' }),
          namespace: name,
          ...(verb === 'update' ? { name } : {}),
        });
        if (allowed) return true;
      } catch {
        return true;
      }
      setDenied(t(verb === 'delete' ? 'fedprojects.permission.deleteDenied' : 'fedprojects.permission.updateDenied'));
      return false;
    },
    [t],
  );

  const state = query.isPending ? 'loading' : query.isError ? 'error' : visible.length === 0 ? 'empty' : 'ready';
  const workspaceLabel = aliases.data?.get(workspace) ?? workspace;

  const clusterOptions: FederatedClusterOption[] = (clusters.data ?? []).map((cluster) => ({
    name: cluster.name,
    label: cluster.label,
    ready: cluster.ready,
    isHost: cluster.isHost,
  }));

  const schema = React.useMemo<ListSchema<FederatedProjectSummary>>(
    () => ({
      title: t('fedprojects.list.title'),
      refresh: listRefresh.refresh,
      description: t('fedprojects.list.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('fedprojects.list.searchPlaceholder'), aiId: 'federated-projects:search' },
      sortableKeys: ['name', 'createdAt'],
      // Third click of the header cycle returns to the page's default order;
      // a server list must send a sort key, so "off" cannot be absent.
      sortFallback: list.sortFallback,
      sortAiPrefix: 'federated-projects',
      columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'federated-projects:columns' },
      sort: { key: list.sortBy, order: list.order },
      columns: [
        {
          key: 'name',
          title: t('workspace.field.name'),
          /* Pinned: the row's identity, kept in place while the other columns scroll. */
          width: 220,
          pin: 'start',
          render: (row) => (
            <a
              href={'/kube-frontend/workspaces/' + encodeURIComponent(workspace) + '/federatedprojects/' + encodeURIComponent(row.name)}
              className="inline-flex min-h-6 min-w-0 flex-col justify-center text-ai-link hover:underline"
              {...actionProps('federated-projects:open:' + row.name)}
            >
              <span className="truncate font-medium">{row.name}</span>
              {row.alias && row.alias !== row.name ? (
                <span className="truncate text-[11px] text-ai-fg-muted">{row.alias}</span>
              ) : null}
            </a>
          ),
        },
        {
          key: 'namespace',
          hideable: true,
          title: t('fedprojects.field.namespace'),
          width: 200,
          hideBelow: 'md',
          render: (row) => <span className="truncate font-mono text-[11px] text-ai-fg-secondary">{row.namespace || '-'}</span>,
        },
        {
          key: 'clusters',
          hideable: true,
          title: t('workspace.field.clusters'),
          width: 170,
          render: (row) =>
            row.clusters.length === 0 ? (
              <span className="text-ai-fg-muted">-</span>
            ) : (
              <span className="flex flex-wrap gap-1">
                {row.clusters.map((cluster) => (
                  <Badge key={cluster} tone="info">
                    {cluster}
                  </Badge>
                ))}
              </span>
            ),
        },
        {
          key: 'propagated',
          hideable: true,
          title: t('fedprojects.field.propagation'),
          width: 120,
          hideBelow: 'lg',
          render: (row) =>
            row.propagated === undefined ? (
              <span className="text-ai-fg-muted">-</span>
            ) : (
              <Badge tone={propagationTone(row)} dot>
                {row.propagated ? t('fedprojects.detail.propagated') : t('fedprojects.detail.notPropagated')}
              </Badge>
            ),
        },
        {
          key: 'createdAt',
          hideable: true,
          title: t('workspace.field.createdAt'),
          width: 170,
          hideBelow: 'xl',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
        },
      ],
      primaryAction: {
        key: 'create',
        label: t('fedprojects.action.create'),
        aiId: 'federated-projects:create',
        // Only an explicit denial disables the entry, and the reason stays visible.
        disabled: permission.denied,
        ...(permission.denied ? { disabledHint: t('fedprojects.permission.createDenied') } : {}),
      },
      selection: 'multiple',
      isRowSelectable: (row) => !row.terminating,
      selectAiId: 'federated-projects:select',
      actions: [
        {
          key: 'bulkDelete',
          label: t('fedprojects.action.bulkDelete'),
          tone: 'danger',
          aiId: 'federated-projects:bulk-delete',
          aiNeeds: ['federated-projects:select'],
        },
      ],
      rowActions: [
        { key: 'edit', label: t('resource.action.editInfo'), aiId: 'federated-projects:edit' },
        { key: 'placement', label: t('fedprojects.action.editPlacement'), aiId: 'federated-projects:placement' },
        {
          key: 'delete',
          label: t('common.delete'),
          tone: 'danger',
          aiId: 'federated-projects:delete',
          visible: (row) => !row.terminating,
        },
      ],
      empty: {
        title: list.search ? t('fedprojects.list.noMatchTitle') : t('fedprojects.list.emptyTitle'),
        description: list.search ? t('fedprojects.list.noMatchDescription') : t('fedprojects.list.emptyDescription'),
      },
      labels: {
        ...listRefresh.emptyLabels, ...listRefresh.filterLabels,
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
        // The library's own defaults are Chinese; a page that pages on the server
        // must supply every sentence or the pager stays Chinese in an English UI.
        range: (from, to, total) => t('table.range', { from, to, total }),
        goToPage: t('table.goToPage'),
        jumpTo: t('table.jumpTo'),
        pageSize: t('table.pageSize'),
        pageSizeSuffix: t('table.pageSizeSuffix'),
      },
      pagination: {
        page: list.page,
        pageSize: list.pageSize,
        total,
        pageSizeOptions: [...PAGE_SIZES],
      },
    }),
    [
      list.page,
      list.pageSize,
      list.search,
      list.sortBy,
      list.order,
      listRefresh,
      permission.denied,
      t,
      total,
      workspace,
    ],
  );

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('federated-projects', columnKeys);

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="federated-projects:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="federated-projects:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="federated-projects:surface" state={state} className="min-w-0">
      <ResourceList
        {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
        onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys}
        schema={schema}
        rows={pageRows}
        loading={state === 'loading'}

        // Rows stay while a refetch runs, dimmed, so the reader keeps their place
        // and the refresh button's spinner has something to explain.
        refreshing={listRefresh.refreshing}
        onRefresh={listRefresh.onRefresh}
        searchValue={list.keyword}
        onSearchChange={list.setKeyword}
        selectedKeys={list.selected}
        onSelectionChange={list.setSelected}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        onSortChange={(next: { key: string; order: SortOrder }) => {
          if (next) list.setSort(next);
        }}
        onAction={(action, row) => {
          // The primary action arrives before any row exists; handle it first.
          if (action === 'create') {
            setDenied(null);
            createProject.reset();
            setCreating(true);
            return;
          }
          if (!row) return;
          if (action === 'edit') {
            setDenied(null);
            updateProject.reset();
            void requirePermission('update', row.name).then((allowed) => {
              if (allowed) setEditTarget(row);
            });
          }
          if (action === 'placement') {
            setDenied(null);
            updatePlacement.reset();
            void requirePermission('update', row.name).then((allowed) => {
              if (allowed) setPlacementTarget(row);
            });
          }
          if (action === 'delete') {
            setDenied(null);
            removeProjects.reset();
            void requirePermission('delete', row.name).then((allowed) => {
              if (allowed) setDeleting([row.name]);
            });
          }
        }}
        onBulkAction={(action, keys) => {
          if (action !== 'bulkDelete') return;
          const names = keys.filter((name) => projected.has(name));
          if (!names.length) return;
          setDenied(null);
          removeProjects.reset();
          setDeleting(names);
        }}
      />

      {denied ? (
        <p role="alert" className="mt-3 text-xs text-ai-danger" data-ai-id="federated-projects:permission-denied">
          {denied}
        </p>
      ) : null}

      <MutationAlert error={updateProject.error ?? updatePlacement.error ?? removeProjects.error} />

      <FederatedProjectCreateDialog
        open={creating}
        onOpenChange={(open) => {
          setCreating(open);
          if (!open) createProject.reset();
        }}
        workspaceLabel={workspaceLabel}
        clusters={clusterOptions}
        clustersPending={clusters.isPending}
        pending={createProject.isPending}
        {...(createProject.error ? { error: errorMessage(t, createProject.error) } : {})}
        onCreate={async (input) => {
          await createProject.mutateAsync({ ...input, ...(user?.name ? { creator: user.name } : {}) });
          setCreating(false);
          Notify.success({ content: t('fedprojects.create.succeeded', { name: input.name }) });
        }}
      />

      {editTarget ? (
        <EditInfoDialog
          open
          onOpenChange={(open) => {
            if (!open && !updateProject.isPending) setEditTarget(null);
          }}
          resource="federated-projects"
          name={editTarget.name}
          alias={editTarget.alias}
          description={editTarget.description}
          annotations={{
            'kubesphere.io/alias-name': editTarget.alias,
            'kubesphere.io/description': editTarget.description,
          }}
          pending={updateProject.isPending}
          onSubmit={async (annotations) => {
            const alias = annotations['kubesphere.io/alias-name'] ?? '';
            const description = annotations['kubesphere.io/description'] ?? '';
            await updateProject.mutateAsync({ name: editTarget.name, alias, description });
            setEditTarget(null);
            Notify.success({ content: t('common.saved') });
          }}
        />
      ) : null}

      {placementTarget ? (
        <FederatedProjectPlacementDialog
          open
          onOpenChange={(open) => {
            if (!open && !updatePlacement.isPending) setPlacementTarget(null);
          }}
          name={placementTarget.name}
          clusters={clusterOptions}
          current={placementTarget.clusters}
          pending={updatePlacement.isPending}
          {...(updatePlacement.error ? { error: errorMessage(t, updatePlacement.error) } : {})}
          onSubmit={async (next) => {
            await updatePlacement.mutateAsync({ name: placementTarget.name, clusters: next });
            setPlacementTarget(null);
            Notify.success({ content: t('fedprojects.placement.succeeded') });
          }}
        />
      ) : null}

      <DeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !removeProjects.isPending) setDeleting(null);
        }}
        names={deleting ?? []}
        resource="federated-projects"
        noun={t('fedprojects.noun')}
        pending={removeProjects.isPending}
        {...(removeProjects.error ? { error: errorMessage(t, removeProjects.error) } : {})}
        onConfirm={async () => {
          try {
            const result = await removeProjects.mutateAsync(deleting ?? []);
            if (result.failed.length === 0) {
              const count = (deleting ?? []).length;
              setDeleting(null);
              list.setSelected([]);
              Notify.success({ content: t('fedprojects.delete.succeeded', { count }) });
            }
          } catch {
            /* Error stays in the confirmation dialog. */
          }
        }}
      />
    </AiSurface>
  );
}
