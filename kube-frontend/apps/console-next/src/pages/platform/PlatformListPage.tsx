import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { clustersApi, isProtectedPlatformUser, type ClusterRoleSummary, type UserSummary, type WorkspaceSummary } from '@kube-ai-hub/api-client';
import { ClusterRolesPage } from '@/pages/cluster/ClusterRolesPage';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { useResourceListState, toListParams } from '@/components/resource/useResourceListState';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { PLATFORM_DESCRIPTORS, useCreateWorkspace, useDeleteClusterRole, useDeleteUser, useDeleteWorkspace, usePlatformList, useSetUserRole, useUpdateWorkspace, type PlatformKind } from './queries';
import { WorkspaceEditorDialog } from './WorkspaceEditorDialog';
import { RoleEditorDialog } from './RoleEditorDialog';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { useResetUserPassword, useSetUserActive, useSetUsersActive, useUpdateUser } from './queries';
import { UserEditDialog } from './UserEditDialog';
import { UserResetPasswordDialog } from './UserResetPasswordDialog';
import { useAuth } from '@/shell/AuthProvider';
import { MutationAlert } from '@/components/resource/ResourceErrorPanel';
import { UserCreateDialog } from './UserCreateDialog';
import { UserRoleDialog } from './UserRoleDialog';
import { useListRefresh } from '@/components/resource/useListRefresh';

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

/** Page sizes the old console offered (`PAGESIZE_OPTION`): 10/20/50/100. */
const PAGE_SIZES = [10, 20, 50, 100] as const;
const PAGE_SIZE = 10;

type SortKey = 'name' | 'createTime';

type Row = UserSummary | ClusterRoleSummary | WorkspaceSummary;

/**
 * Cluster picker above the platform role list (N-06).
 *
 * Only rendered when the installation actually has more than one cluster: a select with one
 * option is noise, and a single-cluster deployment has no member roles to show.
 */
function RoleClusterBar({
  cluster,
  clusterNames,
  onChange,
}: {
  cluster: string;
  clusterNames: string[];
  onChange: (next: string) => void;
}): React.ReactElement {
  const t = useT();
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-ai-fg-secondary">
      <label htmlFor="platform-roles-cluster" className="font-medium">
        {t('platform.roles.cluster')}
      </label>
      <select
        id="platform-roles-cluster"
        className="min-h-9 rounded-ai-md border border-ai-line bg-ai-bg px-2 text-xs text-ai-fg"
        value={cluster}
        data-ai-id="clusterroles:cluster"
        onChange={(event) => onChange(event.target.value)}
      >
        {['host', ...clusterNames.filter((name) => name !== 'host')].map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function PlatformListPage({ kind }: PlatformListPageProps): React.ReactElement {
  const t = useT();
  const { user } = useAuth();
  const currentUsername = user?.name;
  const list = useResourceListState<SortKey>({
    defaultSortBy: kind === 'users' ? 'createTime' : 'name',
    defaultPageSize: PAGE_SIZE,
    resetOn: [kind],
  });
  const query = usePlatformList(kind, toListParams(list, { cluster: 'host', namespace: '' }));
  const [creating, setCreating] = React.useState(false);
  const [roleTarget, setRoleTarget] = React.useState<UserSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<UserSummary | null>(null);
  const setRole = useSetUserRole();
  const removeUser = useDeleteUser();
  const setUserActive = useSetUserActive();
  const setUsersActive = useSetUsersActive();
  const updateUser = useUpdateUser();
  const resetPassword = useResetUserPassword();
  const [editTarget, setEditTarget] = React.useState<UserSummary | null>(null);
  const [resetTarget, setResetTarget] = React.useState<UserSummary | null>(null);
  // Bulk enable/disable needs the selection; the list owns the checkbox state.
  const [selectedUsernames, setSelectedUsernames] = React.useState<string[]>([]);
  const [roleEditor, setRoleEditor] = React.useState<{ name: string; alias: string; description: string } | null | 'new'>(null);
  const [deleteRole, setDeleteRole] = React.useState<ClusterRoleSummary | null>(null);
  const removeRole = useDeleteClusterRole();
  // N-06: the platform role page used to always read the host cluster. The selector
  // switches reads to a member cluster; those rows are read-only here because the
  // write APIs below are host-scoped (the cluster console owns member-cluster writes).
  const [roleCluster, setRoleCluster] = React.useState('host');
  const clusters = useQuery({
    queryKey: ['clusters'],
    queryFn: ({ signal }) => clustersApi(apiClient).list({ signal }),
    enabled: kind === 'clusterroles',
    staleTime: 60_000,
  });
  const clusterNames = (clusters.data?.items ?? []).map((item) => item.name);
  const memberRoleView = kind === 'clusterroles' && roleCluster !== 'host';
  const [workspaceEditor, setWorkspaceEditor] = React.useState<{ name: string; alias: string; description: string } | null | 'new'>(null);
  const [deleteWorkspace, setDeleteWorkspace] = React.useState<WorkspaceSummary | null>(null);
  const createWorkspace = useCreateWorkspace();
  const updateWorkspace = useUpdateWorkspace();
  const removeWorkspace = useDeleteWorkspace();

  const rows = (query.data?.items ?? []) as Row[];
  const total = query.data?.total ?? 0;
  const listRefresh = useListRefresh(`${kind}`, query);

  const schema = React.useMemo<ListSchema<Row>>(
    () => ({
      title: t(PLATFORM_DESCRIPTORS[kind].titleKey),
      refresh: listRefresh.refresh,
      description: t(PLATFORM_DESCRIPTORS[kind].descriptionKey),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('platform.searchPlaceholder'), aiId: `${kind}:search` },
      sortableKeys: ['name', 'createTime'],
      // Third click of the header cycle returns to the page's default order;
      // a server list must send a sort key, so "off" cannot be absent.
      sortFallback: list.sortFallback,
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
                /* Pinned: the row's identity, kept in place while the other columns scroll. */
                width: 220,
                pin: 'start',
                render: (row: Row) => {
                  const user = row as UserSummary;
                  return (
                    <span className="flex min-w-0 flex-col" {...actionProps(`${kind}:name:${user.name}`)}>
                      <Link
                        to="/kube-frontend/access/users/$name"
                        params={{ name: user.username }}
                        className="truncate font-medium text-ai-link hover:underline"
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
                  return (
                    <span className="tabular-nums text-ai-fg-muted">
                      {user.lastLogin ? formatTimestamp(user.lastLogin) : t('platform.column.notLoginYet')}
                    </span>
                  );
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
                          className="truncate font-medium text-ai-link hover:underline"
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
                          className="truncate font-medium text-ai-link hover:underline"
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
      // Bulk enable/disable, as the old console offers on a selection: disabling ten
      // departed accounts one menu at a time is the chore that gets skipped.
      ...(kind === 'users'
        ? {
            selection: 'multiple' as const,
            // Preset accounts and the signed-in user cannot be mutated, so they are
            // not selectable: a checkbox that leads to a refused action is a trap.
            isRowSelectable: (row: Row) => !isProtectedPlatformUser((row as UserSummary).username, currentUsername),
            actions: [
              { key: 'enable-users', label: t('platform.users.enable'), aiId: 'users:bulk-enable' },
              { key: 'disable-users', label: t('platform.users.disable'), aiId: 'users:bulk-disable' },
            ],
          }
        : {}),
      rowActions:
        kind === 'users'
          ? [
              /*
               * Two mutually exclusive entries: a row action's label is static, so a single
               * 'toggle' would claim the wrong state for half the rows. Preset accounts and
               * the signed-in user never get write actions — that would lock the operator
               * out of the platform or out of their own session.
               */
              {
                key: 'enableUser',
                label: t('platform.users.enable'),
                visible: (row: Row) =>
                  (row as UserSummary).status === 'Disabled' &&
                  !isProtectedPlatformUser((row as UserSummary).username, currentUsername),
              },
              {
                key: 'disableUser',
                label: t('platform.users.disable'),
                visible: (row: Row) =>
                  (row as UserSummary).status !== 'Disabled' &&
                  !isProtectedPlatformUser((row as UserSummary).username, currentUsername),
              },
              {
                key: 'editUser',
                label: t('resource.action.editInfo'),
                visible: (row: Row) => !isProtectedPlatformUser((row as UserSummary).username, currentUsername),
              },
              {
                key: 'changeRole',
                label: t('platform.users.changeRole'),
                visible: (row: Row) => !isProtectedPlatformUser((row as UserSummary).username, currentUsername),
              },
              {
                key: 'resetPassword',
                label: t('platform.users.resetPassword'),
                visible: (row: Row) => !isProtectedPlatformUser((row as UserSummary).username, currentUsername),
              },
              {
                key: 'delete',
                label: t('common.delete'),
                tone: 'danger' as const,
                visible: (row: Row) => !isProtectedPlatformUser((row as UserSummary).username, currentUsername),
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
        ...listRefresh.emptyLabels, ...listRefresh.filterLabels,
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      pagination: { page: list.page, pageSize: list.pageSize, pageSizeOptions: [...PAGE_SIZES], total },
    }),
    [kind, list, query.isFetching, t, total, currentUsername],
  );

  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  if (memberRoleView) {
    return (
      <div className="min-w-0">
        <RoleClusterBar cluster={roleCluster} clusterNames={clusterNames} onChange={setRoleCluster} />
        <p className="mb-3 text-xs text-ai-fg-muted" data-ai-id="clusterroles:member-readonly">
          {t('platform.roles.memberReadOnly')}
        </p>
        <ClusterRolesPage cluster={roleCluster} />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId={`${kind}:surface`} state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId={`${kind}:retry`} />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId={`${kind}:surface`} state={state} className="min-w-0">
      {kind === 'clusterroles' && clusterNames.length > 1 ? (
        <RoleClusterBar cluster={roleCluster} clusterNames={clusterNames} onChange={setRoleCluster} />
      ) : null}
      <ResourceList
        onRefresh={listRefresh.onRefresh}
        schema={schema}
        rows={rows}
        loading={state === 'loading'}

        // Rows stay while a refetch runs, dimmed, so the reader keeps their place
        // and the refresh button's spinner has something to explain.
        refreshing={listRefresh.refreshing}
        searchValue={list.keyword}
        onSearchChange={list.setKeyword}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        onSortChange={(next: { key: string; order: SortOrder }) => {
          if (next) list.setSort(next);
        }}
        {...(kind === 'users' ? { selectedKeys: selectedUsernames, onSelectionChange: setSelectedUsernames } : {})}
        onBulkAction={(action, keys) => {
          if (action !== 'enable-users' && action !== 'disable-users') return;
          const targets = keys.filter((name) => !isProtectedPlatformUser(name, currentUsername));
          if (!targets.length) return;
          setUsersActive.mutate({ names: targets, active: action === 'enable-users' });
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
          if (action === 'resetPassword') setResetTarget(row as UserSummary);
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

      <MutationAlert error={setUsersActive.error ?? updateUser.error ?? resetPassword.error ?? setUserActive.error ?? setRole.error ?? removeUser.error ?? removeRole.error ?? createWorkspace.error ?? updateWorkspace.error ?? removeWorkspace.error} />

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

      {resetTarget ? (
        <UserResetPasswordDialog
          name={resetTarget.username}
          pending={resetPassword.isPending}
          {...(resetPassword.error ? { error: resetPassword.error } : {})}
          onCancel={() => {
            setResetTarget(null);
            resetPassword.reset();
          }}
          onSubmit={async (password) => {
            await resetPassword.mutateAsync({ name: resetTarget.username, password });
            setResetTarget(null);
          }}
        />
      ) : null}

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
