import * as React from 'react';
import { Link } from '@tanstack/react-router';
import { type ClusterRoleSummary, type UserSummary, type WorkspaceSummary } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { useResourceListState, toListParams } from '@/components/resource/useResourceListState';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { PLATFORM_DESCRIPTORS, useCreateWorkspace, useDeleteClusterRole, useDeleteUser, useDeleteWorkspace, usePlatformList, useSetUserRole, useUpdateWorkspace, type PlatformKind } from './queries';
import { WorkspaceEditorDialog } from './WorkspaceEditorDialog';
import { RoleEditorDialog } from './RoleEditorDialog';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { useSetUserActive, useUpdateUser } from './queries';
import { UserEditDialog } from './UserEditDialog';
import { MutationAlert } from '@/components/resource/ResourceErrorPanel';
import { UserCreateDialog } from './UserCreateDialog';
import { UserRoleDialog } from './UserRoleDialog';

/**
 * Platform-level lists: 用户, 平台角色 and 企业空间.
 *
 * These are not scoped to a cluster or a project — they are the platform's own
 * records — so the page reads them cluster-wide and renders under its own area.
 * Users and cluster roles come from the IAM group; workspaces from the resources
 * proxy (see `pages/platform/queries.ts`).
 */
export interface PlatformListPageProps {
  kind: PlatformKind;
}

const PAGE_SIZE = 10;

type SortKey = 'name' | 'createTime';

type Row = UserSummary | ClusterRoleSummary | WorkspaceSummary;

export function PlatformListPage({ kind }: PlatformListPageProps): React.ReactElement {
  const t = useT();
  const list = useResourceListState<SortKey>({ defaultSortBy: 'name', resetOn: [kind] });
  const query = usePlatformList(kind, toListParams(list, { cluster: 'host', namespace: '' }, PAGE_SIZE));
  const [creating, setCreating] = React.useState(false);
  const [roleTarget, setRoleTarget] = React.useState<UserSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<UserSummary | null>(null);
  const setRole = useSetUserRole();
  const removeUser = useDeleteUser();
  const setUserActive = useSetUserActive();
  const updateUser = useUpdateUser();
  const [editTarget, setEditTarget] = React.useState<UserSummary | null>(null);
  const [roleEditor, setRoleEditor] = React.useState<{ name: string; alias: string; description: string } | null | 'new'>(null);
  const [deleteRole, setDeleteRole] = React.useState<ClusterRoleSummary | null>(null);
  const removeRole = useDeleteClusterRole();
  const [workspaceEditor, setWorkspaceEditor] = React.useState<{ name: string; alias: string; description: string } | null | 'new'>(null);
  const [deleteWorkspace, setDeleteWorkspace] = React.useState<WorkspaceSummary | null>(null);
  const createWorkspace = useCreateWorkspace();
  const updateWorkspace = useUpdateWorkspace();
  const removeWorkspace = useDeleteWorkspace();

  const rows = (query.data?.items ?? []) as Row[];
  const total = query.data?.total ?? 0;

  const schema = React.useMemo<ListSchema<Row>>(
    () => ({
      title: t(PLATFORM_DESCRIPTORS[kind].titleKey),
      description: t(PLATFORM_DESCRIPTORS[kind].descriptionKey),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('platform.searchPlaceholder'), aiId: `${kind}:search` },
      sortableKeys: ['name', 'createTime'],
      sortAiPrefix: kind,
      sort: { key: list.sortBy, order: list.order },
      // Creating users is the one write this area offers; roles and workspaces are
      // read-only here (see the PRD's 明确不做).
      ...(kind === 'users'
        ? { primaryAction: { key: 'create', label: t('platform.users.create'), aiId: 'users:create' } }
        : kind === 'clusterroles'
          ? { primaryAction: { key: 'create', label: t('platform.roles.create'), aiId: 'clusterroles:create' } }
          : kind === 'workspaces'
            ? { primaryAction: { key: 'create', label: t('platform.workspaces.create'), aiId: 'workspaces:create' } }
            : {}),
      columns:
        kind === 'users'
          ? [
              {
                key: 'name',
                title: t('platform.column.username'),
                render: (row: Row) => {
                  const user = row as UserSummary;
                  return (
                    <span className="flex min-w-0 flex-col" {...actionProps(`${kind}:name:${user.name}`)}>
                      <Link
                        to="/kube-frontend/access/users/$name"
                        params={{ name: user.username }}
                        className="truncate font-medium text-ai-accent hover:underline"
                      >
                        {user.username}
                      </Link>
                      <span className="truncate text-[11px] text-ai-fg-muted">{user.email || '-'}</span>
                    </span>
                  );
                },
              },
              {
                key: 'status',
                title: t('platform.column.status'),
                width: 120,
                hideBelow: 'md',
                render: (row: Row) => {
                  const user = row as UserSummary;
                  const active = user.status === 'Active';
                  return <Badge tone={active ? 'success' : 'neutral'}>{active ? t('platform.status.active') : t('platform.status.disabled')}</Badge>;
                },
              },
              {
                key: 'platformRole',
                title: t('platform.column.platformRole'),
                width: 160,
                hideBelow: 'lg',
                render: (row: Row) => <span className="truncate text-ai-fg-secondary">{(row as UserSummary).platformRole || '-'}</span>,
              },
              {
                key: 'lastLogin',
                title: t('platform.column.lastLogin'),
                width: 170,
                hideBelow: 'xl',
                render: (row: Row) => {
                  const user = row as UserSummary;
                  return <span className="tabular-nums text-ai-fg-muted">{user.lastLogin ? formatTimestamp(user.lastLogin) : '-'}</span>;
                },
              },
            ]
          : kind === 'clusterroles'
            ? [
                {
                  key: 'name',
                  title: t('platform.column.name'),
                  render: (row: Row) => {
                    const role = row as ClusterRoleSummary;
                    return (
                      <span className="flex min-w-0 flex-col">
                        <span className="flex items-center gap-1.5">
                          <Link
                          to="/kube-frontend/access/clusterroles/$name"
                          params={{ name: role.name }}
                          className="truncate font-medium text-ai-accent hover:underline"
                        >
                          {role.alias || role.name}
                        </Link>
                          {role.system ? <Badge tone="neutral">{t('platform.roles.templateBadge')}</Badge> : null}
                        </span>
                        <span className="truncate text-[11px] text-ai-fg-muted">{role.description || '-'}</span>
                      </span>
                    );
                  },
                },
                {
                  key: 'ruleCount',
                  title: t('platform.column.ruleCount'),
                  width: 120,
                  hideBelow: 'md',
                  render: (row: Row) => <span className="tabular-nums text-ai-fg-secondary">{(row as ClusterRoleSummary).ruleCount}</span>,
                },
                {
                  key: 'createTime',
                  title: t('platform.column.createdAt'),
                  width: 170,
                  hideBelow: 'lg',
                  render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
                },
              ]
            : [
                {
                  key: 'name',
                  title: t('platform.column.name'),
                  render: (row: Row) => {
                    const ws = row as WorkspaceSummary;
                    return (
                      <span className="flex min-w-0 flex-col">
                        <Link
                          to="/kube-frontend/access/workspaces/$name"
                          params={{ name: ws.name }}
                          className="truncate font-medium text-ai-accent hover:underline"
                        >
                          {ws.alias || ws.name}
                        </Link>
                        <span className="truncate text-[11px] text-ai-fg-muted">{ws.description || '-'}</span>
                      </span>
                    );
                  },
                },
                {
                  key: 'status',
                  title: t('platform.column.status'),
                  width: 120,
                  hideBelow: 'md',
                  render: (row: Row) => {
                    const ws = row as WorkspaceSummary;
                    return <Badge tone={ws.status === 'Active' ? 'success' : 'warning'}>{ws.status || '-'}</Badge>;
                  },
                },
                {
                  key: 'clusters',
                  title: t('platform.column.clusters'),
                  width: 150,
                  hideBelow: 'lg',
                  render: (row: Row) => <span className="truncate text-ai-fg-secondary">{(row as WorkspaceSummary).clusters}</span>,
                },
                {
                  key: 'createTime',
                  title: t('platform.column.createdAt'),
                  width: 170,
                  hideBelow: 'xl',
                  render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
                },
              ],
      // Users are the only writable kind here: roles and workspaces stay read-only.
      rowActions:
        kind === 'users'
          ? [
              /*
               * Two mutually exclusive entries: a row action's label is static, so a single
               * 'toggle' would claim the wrong state for half the rows. The admin account is
               * never disabled or deleted here — that would lock the platform out of itself.
               */
              {
                key: 'enableUser',
                label: t('platform.users.enable'),
                visible: (row: Row) => (row as UserSummary).status === 'Disabled',
              },
              {
                key: 'disableUser',
                label: t('platform.users.disable'),
                visible: (row: Row) => (row as UserSummary).status !== 'Disabled' && (row as UserSummary).username !== 'admin',
              },
              { key: 'editUser', label: t('resource.action.editInfo') },
              { key: 'changeRole', label: t('platform.users.changeRole') },
              {
                key: 'delete',
                label: t('common.delete'),
                tone: 'danger' as const,
                visible: (row: Row) => (row as UserSummary).username !== 'admin',
              },
            ]
          : kind === 'clusterroles'
            ? [
                // A template role belongs to the platform; the API rejects writes to it,
                // so the actions are withheld rather than offered and failed.
                { key: 'edit', label: t('resource.action.editInfo'), visible: (row: Row) => !(row as ClusterRoleSummary).system },
                { key: 'delete', label: t('common.delete'), tone: 'danger' as const, visible: (row: Row) => !(row as ClusterRoleSummary).system },
              ]
            : kind === 'workspaces'
              ? [
                  { key: 'edit', label: t('platform.workspaces.edit') },
                  { key: 'delete', label: t('common.delete'), tone: 'danger' as const },
                ]
              : [],
      empty: {
        title: t(PLATFORM_DESCRIPTORS[kind].emptyTitleKey),
        description: t(PLATFORM_DESCRIPTORS[kind].emptyDescriptionKey),
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
        onAction={(action, row) => {
          // `primaryAction` dispatches with no row, so the create branch is reached
          // before any row-shape assumption.
          if (action === 'create') {
            if (kind === 'clusterroles') return setRoleEditor('new');
            if (kind === 'workspaces') return setWorkspaceEditor('new');
            return setCreating(true);
          }
          if (!row) return;
          if (action === 'changeRole') setRoleTarget(row as UserSummary);
          if (action === 'editUser') setEditTarget(row as UserSummary);
          if (action === 'enableUser') setUserActive.mutate({ name: (row as UserSummary).username, active: true });
          if (action === 'disableUser') setUserActive.mutate({ name: (row as UserSummary).username, active: false });
          if (action === 'edit' && kind === 'clusterroles') {
            const role = row as ClusterRoleSummary;
            setRoleEditor({ name: role.name, alias: role.alias, description: role.description });
          }
          if (action === 'edit' && kind === 'workspaces') {
            const ws = row as WorkspaceSummary;
            setWorkspaceEditor({ name: ws.name, alias: ws.alias, description: ws.description });
          }
          if (action === 'delete') {
            if (kind === 'clusterroles') return setDeleteRole(row as ClusterRoleSummary);
            if (kind === 'workspaces') return setDeleteWorkspace(row as WorkspaceSummary);
            setDeleteTarget(row as UserSummary);
          }
        }}
      />

      <MutationAlert error={updateUser.error ?? setUserActive.error ?? setRole.error ?? removeUser.error ?? removeRole.error ?? createWorkspace.error ?? updateWorkspace.error ?? removeWorkspace.error} />

      <WorkspaceEditorDialog
        open={workspaceEditor !== null}
        {...(workspaceEditor && workspaceEditor !== 'new' ? { workspace: workspaceEditor } : {})}
        pending={createWorkspace.isPending || updateWorkspace.isPending}
        onOpenChange={(next) => !next && setWorkspaceEditor(null)}
        onSubmit={async (values) => {
          if (workspaceEditor === 'new') {
            await createWorkspace.mutateAsync(values);
          } else {
            // The name identifies the object and cannot change; only the alias and
            // description are sent.
            await updateWorkspace.mutateAsync({ name: values.name, alias: values.alias, description: values.description });
          }
          setWorkspaceEditor(null);
        }}
      />

      {editTarget ? (
        <UserEditDialog
          name={editTarget.username}
          pending={updateUser.isPending}
          {...(updateUser.error ? { error: updateUser.error } : {})}
          onCancel={() => setEditTarget(null)}
          onSubmit={async (values) => {
            await updateUser.mutateAsync({ name: editTarget.username, ...values });
            setEditTarget(null);
          }}
        />
      ) : null}

      {deleteWorkspace ? (
        <DeleteDialog
          open
          onOpenChange={(next) => !next && setDeleteWorkspace(null)}
          names={[deleteWorkspace.name]}
          resource="workspaces"
          noun={t('platform.workspaces.title')}
          pending={removeWorkspace.isPending}
          onConfirm={async () => {
            await removeWorkspace.mutateAsync(deleteWorkspace.name);
            setDeleteWorkspace(null);
          }}
        />
      ) : null}

      <RoleEditorDialog
        open={roleEditor !== null}
        {...(roleEditor && roleEditor !== 'new' ? { role: roleEditor } : {})}
        onOpenChange={(next) => !next && setRoleEditor(null)}
      />

      {deleteRole ? (
        <DeleteDialog
          open
          onOpenChange={(next) => !next && setDeleteRole(null)}
          names={[deleteRole.name]}
          resource="clusterroles"
          noun={t('platform.roles.title')}
          pending={removeRole.isPending}
          onConfirm={async () => {
            await removeRole.mutateAsync(deleteRole.name);
            setDeleteRole(null);
          }}
        />
      ) : null}

      {roleTarget ? (
        <UserRoleDialog
          open
          name={roleTarget.username}
          current={roleTarget.platformRole}
          pending={setRole.isPending}
          onOpenChange={(open) => !open && setRoleTarget(null)}
          onSubmit={async (platformRole) => {
            await setRole.mutateAsync({ name: roleTarget.username, platformRole });
            setRoleTarget(null);
          }}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteDialog
          open
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          names={[deleteTarget.username]}
          resource="users"
          noun={t('platform.users.title')}
          pending={removeUser.isPending}
          onConfirm={async () => {
            await removeUser.mutateAsync(deleteTarget.username);
            setDeleteTarget(null);
          }}
        />
      ) : null}

      <UserCreateDialog open={creating} onOpenChange={setCreating} />
    </AiSurface>
  );
}
