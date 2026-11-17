import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  workspaceRolesApi,
  workspaceRolesWriteApi,
  type WorkspaceRoleDetail,
  type WorkspaceRoleSummary,
} from '@kube-ai-hub/api-client';
import { AiSurface, ResourceList, type ListSchema } from '@kube-ai-hub/ui';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { errorMessage, MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { EditInfoDialog } from '@/components/resource/EditInfoDialog';
import { LoadingDialog } from '@/components/resource/LoadingDialog';
import { formatTimestamp } from '@/lib/time';
import { useListRefresh } from '@/components/resource/useListRefresh';
import { WorkspaceRoleDialog } from './WorkspaceRoleDialog';

/**
 * 企业空间角色.
 *
 * Workspace roles are the workspace-scoped half of KubeSphere's RBAC. Writes were
 * re-included by the 2026-11-17 review (N-21): create / edit info / edit permissions /
 * delete, through the IAM aggregate. Custom roles aggregate platform templates (the
 * aggregation-roles annotation); roles created by the platform (kubesphere.io/creator=system)
 * are read-only, matching the old console's preset-role guard.
 */
export interface WorkspaceRolesPageProps {
  workspace: string;
}

/** Page sizes the old console offered: 10/20/50/100. */
const PAGE_SIZES = [10, 20, 50, 100] as const;
const PAGE_SIZE = 20;

type Dialog =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'loading'; target: 'editInfo' | 'permissions'; subject: string }
  | { kind: 'editInfo'; detail: WorkspaceRoleDetail }
  | { kind: 'permissions'; detail: WorkspaceRoleDetail }
  | { kind: 'delete'; name: string };

/** Platform-maintained roles are read-only: the API rejects writes to them. */
export function isReadOnlyWorkspaceRole(role: WorkspaceRoleSummary): boolean {
  return role.creator === 'system' || role.name.startsWith('role-template-');
}

export function WorkspaceRolesPage({ workspace }: WorkspaceRolesPageProps): React.ReactElement {
  const t = useT();
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<number>(PAGE_SIZE);
  const [dialog, setDialog] = React.useState<Dialog>({ kind: 'none' });
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['workspace-roles', workspace],
    queryFn: ({ signal }) => workspaceRolesApi(apiClient).list({ workspace, signal }),
  });

  React.useEffect(() => {
    setPage(1);
  }, [workspace]);

  const invalidate = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['workspace-roles', workspace] });
  }, [queryClient, workspace]);

  const create = useMutation({
    mutationFn: (input: { name: string; alias: string; description: string; templates: string[] }) =>
      workspaceRolesWriteApi(apiClient).create({ workspace, ...input }),
    onSuccess: () => {
      invalidate();
      setDialog({ kind: 'none' });
    },
  });
  const updateInfo = useMutation({
    mutationFn: (params: { name: string; annotations: Record<string, string> }) =>
      workspaceRolesWriteApi(apiClient).updateInfo({ workspace, ...params }),
    onSuccess: () => {
      invalidate();
      setDialog({ kind: 'none' });
    },
  });
  const setTemplates = useMutation({
    mutationFn: (params: { name: string; templates: string[] }) =>
      workspaceRolesWriteApi(apiClient).setTemplates({ workspace, ...params }),
    onSuccess: () => {
      invalidate();
      setDialog({ kind: 'none' });
    },
  });
  const remove = useMutation({
    mutationFn: (name: string) => workspaceRolesWriteApi(apiClient).remove({ workspace, name }),
    onSuccess: () => {
      invalidate();
      setDialog({ kind: 'none' });
    },
  });

  const openWithDetail = React.useCallback(
    async (target: 'editInfo' | 'permissions', name: string) => {
      setDialog({ kind: 'loading', target, subject: name });
      try {
        const detail = await workspaceRolesApi(apiClient).get({ workspace, name });
        setDialog({ kind: target, detail });
      } catch {
        setDialog({ kind: 'none' });
      }
    },
    [workspace],
  );

  const rows = query.data ?? [];
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';
  const paged = rows.length > pageSize;
  const visibleRows = React.useMemo(
    () => (paged ? rows.slice((page - 1) * pageSize, page * pageSize) : rows),
    [page, pageSize, paged, rows],
  );
  const listRefresh = useListRefresh('workspace-roles', query);

  const schema = React.useMemo<ListSchema<WorkspaceRoleSummary>>(
    () => ({
      title: t('workspace.roles.title'),
      sortAiPrefix: 'workspace-roles',
      refresh: listRefresh.refresh,
      description: t('workspace.roles.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'workspace-roles:columns' },
      primaryAction: { key: 'create', label: t('workspace.roles.create'), aiId: 'workspace-roles:create' },
      columns: [
        {
          key: 'name',
          title: t('workspace.field.name'),
          render: (row) => (
            <Link
              to="/kube-frontend/workspaces/$workspace/roles/$name"
              params={{ workspace, name: row.name }}
              className="flex min-w-0 flex-col hover:underline"
              data-ai-id={'workspace-roles:name:' + row.name}
            >
              <span className="truncate font-medium text-ai-accent">{row.alias || row.name}</span>
              {row.alias ? <span className="truncate font-mono text-[11px] text-ai-fg-muted">{row.name}</span> : null}
            </Link>
          ),
        },
        {
          key: 'ruleCount',
          hideable: true,
          title: t('platform.column.ruleCount'),
          width: 120,
          align: 'right',
          render: (row) => <span className="tabular-nums text-ai-fg-secondary">{row.ruleCount}</span>,
        },
        {
          key: 'createdAt',
          hideable: true,
          title: t('workspace.field.createdAt'),
          width: 180,
          hideBelow: 'lg',
          render: (row) => (
            <span className="tabular-nums text-ai-fg-muted">{row.createdAt ? formatTimestamp(row.createdAt) : '-'}</span>
          ),
        },
      ],
      rowActions: [
        { key: 'editInfo', label: t('resource.action.editInfo'), visible: (row) => !isReadOnlyWorkspaceRole(row) },
        { key: 'permissions', label: t('settings.roles.permissions'), visible: (row) => !isReadOnlyWorkspaceRole(row) },
        { key: 'delete', label: t('common.delete'), tone: 'danger', visible: (row) => !isReadOnlyWorkspaceRole(row) },
      ],
      empty: { title: t('common.empty'), description: t('settings.roles.emptyDescription') },
      labels: {
        ...listRefresh.emptyLabels,
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      ...(paged ? { pagination: { page, pageSize, pageSizeOptions: [...PAGE_SIZES], total: rows.length } } : {}),
    }),
    [listRefresh, page, pageSize, paged, query.isFetching, rows.length, t, workspace],
  );

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('workspace-roles', columnKeys);

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="workspace-roles:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="workspace-roles:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="workspace-roles:surface" state={state} className="min-w-0">
      <div data-ai-id="workspace-roles:table" className="min-w-0">
        <ResourceList
          {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
          onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys}
          schema={schema}
          onRefresh={listRefresh.onRefresh}
          rows={visibleRows}
          loading={state === 'loading'}
          {...(paged ? { onPageChange: setPage, onPageSizeChange: (next: number) => { setPageSize(next); setPage(1); } } : {})}
          onAction={(action, row) => {
            if (action === 'create') {
              setDialog({ kind: 'create' });
              return;
            }
            if (!row) return;
            if (action === 'delete') {
              setDialog({ kind: 'delete', name: row.name });
              return;
            }
            if (action === 'editInfo' || action === 'permissions') void openWithDetail(action, row.name);
          }}
        />
      </div>

      <MutationAlert error={create.error ?? updateInfo.error ?? setTemplates.error ?? remove.error} />

      <WorkspaceRoleDialog
        open={dialog.kind === 'create'}
        onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
        mode="create"
        workspace={workspace}
        pending={create.isPending}
        error={create.error}
        onSubmit={async (input) => {
          await create.mutateAsync(input);
        }}
      />
      <WorkspaceRoleDialog
        open={dialog.kind === 'permissions'}
        onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
        mode="permissions"
        workspace={workspace}
        {...(dialog.kind === 'permissions' ? { role: dialog.detail } : {})}
        pending={setTemplates.isPending}
        error={setTemplates.error}
        onSubmit={async (input) => {
          if (dialog.kind !== 'permissions') return;
          await setTemplates.mutateAsync({ name: dialog.detail.name, templates: input.templates });
        }}
      />

      {dialog.kind === 'loading' ? (
        <LoadingDialog
          open
          title={dialog.target === 'editInfo' ? t('resource.action.editInfo') : t('settings.roles.permissions')}
          subject={dialog.subject}
          size="xl"
        />
      ) : null}

      {dialog.kind === 'editInfo' ? (
        <EditInfoDialog
          open
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          resource="workspace-roles"
          name={dialog.detail.name}
          alias={dialog.detail.alias}
          description={dialog.detail.description}
          annotations={dialog.detail.annotations}
          pending={updateInfo.isPending}
          onSubmit={async (annotations) => {
            await updateInfo.mutateAsync({ name: dialog.detail.name, annotations });
          }}
        />
      ) : null}

      {dialog.kind === 'delete' ? (
        <DeleteDialog
          open
          onOpenChange={(open) => !open && setDialog({ kind: 'none' })}
          names={[dialog.name]}
          resource="workspace-roles"
          noun={t('workspace.roles.title')}
          pending={remove.isPending}
          {...(remove.error ? { error: errorMessage(t, remove.error) } : {})}
          onConfirm={async () => {
            await remove.mutateAsync(dialog.name);
          }}
        />
      ) : null}
    </AiSurface>
  );
}
