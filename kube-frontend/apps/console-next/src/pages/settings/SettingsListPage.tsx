import * as React from 'react';
import { Link } from '@tanstack/react-router';
import { type MemberSummary, type RoleDetail, type RoleSummary } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, Modal, ResourceList, Skeleton, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { rolesApi } from '@kube-ai-hub/api-client';
import { useQuery } from '@tanstack/react-query';
import { useProjectFilter } from '@/components/projects/useProjects';
import { useResourceListState, toListParams } from '@/components/resource/useResourceListState';
import { errorMessage, MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { RolePermissionsDialog } from './RolePermissionsDialog';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { EditInfoDialog } from '@/components/resource/EditInfoDialog';
import { formatTimestamp } from '@/lib/time';
import { useAuth } from '@/shell/AuthProvider';
import { SETTINGS_DESCRIPTORS, useDeleteRole, useMemberWrites, useSettingsList, useUpdateRole, type SettingsKind } from './queries';
import { MemberDialog } from './MemberDialog';
import { RoleCreateDialog } from './RoleCreateDialog';
import { useListRefresh } from '@/components/resource/useListRefresh';

/**
 * Project settings: 角色 and 成员.
 *
 * Both are IAM lists (`iam.kubesphere.io/v1alpha2`). Roles are read with their rule
 * count and a detail view that lists the rules. Members keep the old console's
 * invite / change-role / remove loop, plus search, email, last sign-in, and the
 * rule that you cannot unbind yourself.
 */
export interface SettingsListPageProps {
  kind: SettingsKind;
  /** Route parameter, needed to build the role-detail link; members never use it. */
  workspace?: string;
  cluster: string;
  namespace: string;
}

/** Page sizes the old console offered (`PAGESIZE_OPTION`): 10/20/50/100. */
const PAGE_SIZES = [10, 20, 50, 100] as const;
const PAGE_SIZE = 10;

type SortKey = 'name' | 'createTime';

type Row = RoleSummary | MemberSummary;

export function SettingsListPage({ kind, workspace, cluster, namespace }: SettingsListPageProps): React.ReactElement {
  const t = useT();
  const { user } = useAuth();
  const currentUsername = user?.name ?? '';
  const isSelf = React.useCallback((name: string) => Boolean(name) && name === currentUsername, [currentUsername]);
  const descriptor = SETTINGS_DESCRIPTORS[kind];
  const [projectFilter, setProjectFilter] = React.useState(namespace);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [removingNames, setRemovingNames] = React.useState<string[] | null>(null);
  React.useEffect(() => {
    setProjectFilter(namespace);
    setSelected([]);
    setRemovingNames(null);
  }, [cluster, namespace]);

  const list = useResourceListState<SortKey>({ defaultSortBy: 'createTime', resetOn: [cluster, projectFilter], defaultPageSize: PAGE_SIZE });
  const query = useSettingsList(kind, toListParams(list, { cluster, namespace: projectFilter }));
  const projectFilterControl = useProjectFilter(
    cluster,
    t('settings.filter.projectLabel'),
    t('settings.filter.project'),
    undefined,
    'settings:filter:project',
  );

  const [roleName, setRoleName] = React.useState<string | null>(null);
  const [editRole, setEditRole] = React.useState<RoleSummary | null>(null);
  const [permissionsRole, setPermissionsRole] = React.useState<RoleSummary | null>(null);
  const [deleteRole, setDeleteRole] = React.useState<RoleSummary | null>(null);
  const updateRole = useUpdateRole({ cluster, namespace: projectFilter });
  const memberWrites = useMemberWrites({ cluster, namespace: projectFilter });
  const [inviting, setInviting] = React.useState(false);
  const [creatingRole, setCreatingRole] = React.useState(false);
  const [editingMember, setEditingMember] = React.useState<MemberSummary | null>(null);
  const removeRole = useDeleteRole({ cluster, namespace: projectFilter });
  const roleDetail = useQuery({
    queryKey: ['settings', 'role', cluster, projectFilter, roleName],
    queryFn: ({ signal }) => rolesApi(apiClient).get({ cluster, namespace: projectFilter, name: roleName ?? '', signal }),
    enabled: kind === 'roles' && Boolean(roleName),
  });

  const rows = (query.data?.items ?? []) as Row[];
  const total = query.data?.total ?? 0;
  const listRefresh = useListRefresh(`${kind}`, query);

  const schema = React.useMemo<ListSchema<Row>>(
    () => ({
      title: t(descriptor.titleKey),
      refresh: listRefresh.refresh,
      description: t(descriptor.descriptionKey),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('settings.searchPlaceholder'), aiId: `${kind}:search` },
      filters: [projectFilterControl],
      sortableKeys: ['name', 'createTime'],
      // Third click of the header cycle returns to the page's default order;
      // a server list must send a sort key, so "off" cannot be absent.
      sortFallback: list.sortFallback,
      sortAiPrefix: kind,
      sort: { key: list.sortBy, order: list.order },
      columns:
        kind === 'roles'
          ? [
              {
                key: 'name',
                title: t('settings.column.name'),
                render: (row: Row) => {
                  const role = row as RoleSummary;
                  const label = (
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-medium text-ai-fg">{role.alias || role.name}</span>
                      {role.system ? <Badge tone="neutral">{t('settings.roles.templateBadge')}</Badge> : null}
                    </span>
                  );
                  return (
                    <span className="flex min-w-0 flex-col">
                      {workspace ? (
                        // The role's name is how a reader reaches its detail page; the old
                        // console linked it the same way. Members come from a route without a
                        // workspace parameter, which is why this is conditional.
                        <Link
                          to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/roles/$name"
                          params={{ workspace, cluster, namespace: projectFilter, name: role.name }}
                          className="flex hover:underline"
                          data-ai-id={`project-role-detail:link:${role.name}`}
                        >
                          {label}
                        </Link>
                      ) : (
                        label
                      )}
                      <span className="truncate text-[11px] text-ai-fg-muted">{role.description || '-'}</span>
                    </span>
                  );
                },
              },
              {
                key: 'ruleCount',
                title: t('settings.column.ruleCount'),
                width: 120,
                hideBelow: 'md',
                render: (row: Row) => <span className="tabular-nums text-ai-fg-secondary">{(row as RoleSummary).ruleCount}</span>,
              },
              {
                key: 'createTime',
                title: t('settings.column.createdAt'),
                width: 170,
                hideBelow: 'lg',
                render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
              },
            ]
          : [
              {
                key: 'name',
                title: t('settings.column.name'),
                render: (row: Row) => {
                  const member = row as MemberSummary;
                  return (
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-ai-fg">{member.username}</span>
                      <span className="truncate text-[11px] text-ai-fg-muted">{member.email || '-'}</span>
                    </span>
                  );
                },
              },
              {
                key: 'active',
                title: t('settings.column.status'),
                width: 120,
                hideBelow: 'md',
                render: (row: Row) => {
                  const member = row as MemberSummary;
                  return (
                    <Badge tone={member.active ? 'success' : 'warning'}>
                      {member.active ? t('platform.status.active') : t('platform.status.disabled')}
                    </Badge>
                  );
                },
              },
              {
                key: 'role',
                title: t('settings.column.role'),
                width: 140,
                hideBelow: 'md',
                render: (row: Row) => <span className="text-ai-fg-secondary">{(row as MemberSummary).role || '-'}</span>,
              },
              {
                key: 'lastLogin',
                title: t('settings.column.lastLogin'),
                width: 170,
                hideBelow: 'xl',
                render: (row: Row) => {
                  const member = row as MemberSummary;
                  return (
                    <span className="tabular-nums text-ai-fg-muted">
                      {member.lastLogin ? formatTimestamp(member.lastLogin) : t('platform.column.notLoginYet')}
                    </span>
                  );
                },
              },
            ],
      /*
       * Inviting is the members page's primary action, as it is in the old console; roles
       * have no create action because a project role is made by copying a template.
       */
      ...(kind === 'roles'
        ? { primaryAction: { key: 'createRole', label: t('settings.roles.create'), aiId: 'roles:create' } }
        : {}),
      ...(kind === 'members'
        ? {
            primaryAction: { key: 'invite', label: t('settings.members.invite'), aiId: 'members:invite' },
            selection: 'multiple' as const,
            isRowSelectable: (row: Row) => !isSelf((row as MemberSummary).username),
            selectAiId: 'members:select',
            actions: [{ key: 'bulk-remove', label: t('settings.members.bulkRemove'), tone: 'danger' as const, aiId: 'members:bulk-remove' }],
          }
        : {}),
      /*
       * Templated roles are the platform's building blocks: the API rejects writes to
       * them, so the row offers only the detail view. Everything else gets the old
       * console's 编辑 / 删除 alongside it.
       */
      rowActions:
        kind === 'members'
          ? [
              /* Two entries, not one menu of verbs: the old console's 成员 list offers exactly
               * these. Removing a member removes the role binding, not the user account — that
               * is the fact the confirmation has to state. */
              {
                key: 'modifyRole',
                label: t('settings.members.modifyRole'),
                visible: (row: Row) => !isSelf((row as MemberSummary).username),
              },
              {
                key: 'removeMember',
                label: t('settings.members.remove'),
                tone: 'danger' as const,
                visible: (row: Row) => !isSelf((row as MemberSummary).username),
              },
            ]
          : kind === 'roles'
          ? [
              { key: 'detail', label: t('settings.action.detail') },
              /*
               * A template role belongs to the platform: the API rejects writes to it.
               * The predicate hides the action — previously the handler returned early,
               * which left a menu entry that did nothing when clicked.
               */
              {
                key: 'edit',
                label: t('resource.action.editInfo'),
                visible: (row: Row) => !(row as RoleSummary).system,
              },
              // 编辑权限 writes the rules; a template role's rules belong to the
              // platform, so the entry is withheld rather than offered and rejected.
              {
                key: 'permissions',
                label: t('settings.roles.permissions'),
                visible: (row: Row) => !(row as RoleSummary).system,
              },
              {
                key: 'delete',
                label: t('common.delete'),
                tone: 'danger' as const,
                visible: (row: Row) => !(row as RoleSummary).system,
              },
            ]
          : [],
      empty: { title: t(descriptor.emptyTitleKey), description: t(descriptor.emptyDescriptionKey) },
      labels: {
        ...listRefresh.emptyLabels,
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      pagination: { page: list.page, pageSize: list.pageSize, pageSizeOptions: [...PAGE_SIZES], total },
    }),
    [cluster, descriptor, isSelf, kind, list, projectFilter, projectFilterControl, query.isFetching, t, total, workspace],
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
        onRefresh={listRefresh.onRefresh}
        schema={schema}
        rows={rows}
        loading={state === 'loading'}
        searchValue={list.keyword}
        onSearchChange={list.setKeyword}
        filters={{ project: projectFilter }}
        onFiltersChange={(next) => {
          setProjectFilter(next['project'] ?? '');
          list.setPage(1);
        }}
        {...(kind === 'members' ? { selectedKeys: selected, onSelectionChange: setSelected } : {})}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        onSortChange={(next: { key: string; order: SortOrder }) => {
          if (next) list.setSort(next);
        }}
        onAction={(action, row) => {
          // The primary action arrives without a row; handle it before the guard.
          if (action == 'createRole') {
            setCreatingRole(true);
            return;
          }
          if (action == 'invite') {
            setInviting(true);
            return;
          }
          if (!row) return;
          if (action == 'modifyRole') setEditingMember(row as MemberSummary);
          if (action == 'removeMember') {
            memberWrites.remove.reset();
            memberWrites.removeMany.reset();
            setRemovingNames([(row as MemberSummary).username]);
          }
          if (action === 'detail') setRoleName(row.name);
          if (action === 'permissions') {
            if ((row as RoleSummary).system) return;
            setPermissionsRole(row as RoleSummary);
          }
          if (action === 'edit') {
            // A template role cannot be written; say so instead of opening a dialog
            // whose save would fail with a permission error.
            if ((row as RoleSummary).system) return;
            setEditRole(row as RoleSummary);
          }
          if (action === 'delete') {
            if ((row as RoleSummary).system) return;
            setDeleteRole(row as RoleSummary);
          }
        }}
        onBulkAction={(action, keys) => {
          if (action !== 'bulk-remove') return;
          const names = keys.filter((name) => !isSelf(name));
          if (!names.length) return;
          memberWrites.remove.reset();
          memberWrites.removeMany.reset();
          setRemovingNames(names);
        }}
      />

      <MutationAlert
        error={updateRole.error ?? removeRole.error ?? memberWrites.invite.error ?? memberWrites.updateRole.error}
      />

      <RoleCreateDialog
        open={creatingRole}
        onOpenChange={setCreatingRole}
        cluster={cluster}
        namespace={projectFilter}
      />

      <MemberDialog
        open={inviting || editingMember !== null}
        onOpenChange={(open) => {
          if (!open) {
            setInviting(false);
            setEditingMember(null);
          }
        }}
        cluster={cluster}
        namespace={projectFilter}
        {...(editingMember ? { member: editingMember } : {})}
        onInvite={async (input) => {
          await memberWrites.invite.mutateAsync(input);
        }}
        onUpdateRole={async (input) => {
          await memberWrites.updateRole.mutateAsync(input);
        }}
      />

      {removingNames ? (
        <DeleteDialog
          open
          onOpenChange={(open) => {
            if (!open && !memberWrites.remove.isPending && !memberWrites.removeMany.isPending) setRemovingNames(null);
          }}
          names={removingNames}
          resource="members"
          noun={t('settings.members.remove')}
          title={t('settings.members.remove')}
          confirmLabel={t('settings.members.remove')}
          pending={memberWrites.remove.isPending || memberWrites.removeMany.isPending}
          {...(memberWrites.remove.error || memberWrites.removeMany.error
            ? { error: errorMessage(t, memberWrites.remove.error ?? memberWrites.removeMany.error) }
            : {})}
          onConfirm={async () => {
            try {
              if (removingNames.length === 1) await memberWrites.remove.mutateAsync(removingNames[0] ?? '');
              else await memberWrites.removeMany.mutateAsync(removingNames);
              setRemovingNames(null);
              setSelected([]);
            } catch {
              /* Error stays in the confirmation. */
            }
          }}
        />
      ) : null}

      {permissionsRole ? (
        <RolePermissionsDialog
          open
          namespace={projectFilter}
          name={permissionsRole.name}
          onOpenChange={(open) => !open && setPermissionsRole(null)}
          onSaved={() => setPermissionsRole(null)}
        />
      ) : null}

      {editRole ? (
        <EditInfoDialog
          open
          onOpenChange={(open) => !open && setEditRole(null)}
          resource="roles"
          name={editRole.name}
          alias={editRole.alias}
          description={editRole.description}
          annotations={editRole.annotations}
          pending={updateRole.isPending}
          onSubmit={async (annotations) => {
            await updateRole.mutateAsync({ name: editRole.name, annotations });
            setEditRole(null);
          }}
        />
      ) : null}

      {deleteRole ? (
        <DeleteDialog
          open
          onOpenChange={(open) => !open && setDeleteRole(null)}
          names={[deleteRole.name]}
          resource="roles"
          noun={t('settings.roles.title')}
          pending={removeRole.isPending}
          onConfirm={async () => {
            await removeRole.mutateAsync(deleteRole.name);
            setDeleteRole(null);
          }}
        />
      ) : null}

      <Modal
        open={roleName !== null}
        onOpenChange={(open) => !open && setRoleName(null)}
        title={t('settings.roles.rules')}
        size="lg"
      >
        {roleDetail.isPending && roleName ? <Skeleton className="h-24 w-full" /> : null}
        {roleDetail.data ? <RoleRules role={roleDetail.data} /> : null}
      </Modal>
    </AiSurface>
  );
}

/** The rules of one role: what it may do, to what, in which API groups. */
function RoleRules({ role }: { role: RoleDetail }): React.ReactElement {
  const t = useT();
  if (role.rules.length === 0) {
    return <p className="text-xs text-ai-fg-muted">{t('settings.roles.noRules')}</p>;
  }
  return (
    <table className="w-full border-collapse text-xs" data-ai-id="settings-role:rules">
      <thead>
        <tr className="border-b border-ai-line text-ai-fg-muted">
          <th scope="col" className="px-2 py-2 text-left font-medium">{t('settings.roles.ruleApiGroups')}</th>
          <th scope="col" className="px-2 py-2 text-left font-medium">{t('settings.roles.ruleResources')}</th>
          <th scope="col" className="px-2 py-2 text-left font-medium">{t('settings.roles.ruleVerbs')}</th>
        </tr>
      </thead>
      <tbody>
        {role.rules.map((rule, index) => (
          <tr key={`${rule.resources}-${index}`} className="border-b border-ai-line" data-ai-row={String(index)}>
            <td className="px-2 py-2 font-mono text-[11px] text-ai-fg-secondary">{rule.apiGroups || '-'}</td>
            <td className="px-2 py-2 font-mono text-[11px] text-ai-fg-secondary">{rule.resources || '-'}</td>
            <td className="px-2 py-2 font-mono text-[11px] text-ai-fg-secondary">{rule.verbs || '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
