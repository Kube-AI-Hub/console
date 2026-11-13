import * as React from 'react';
import { type MemberSummary, type RoleDetail, type RoleSummary } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, Modal, ResourceList, Skeleton, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { rolesApi } from '@kube-ai-hub/api-client';
import { useQuery } from '@tanstack/react-query';
import { useProjectFilter } from '@/components/projects/useProjects';
import { useResourceListState, toListParams } from '@/components/resource/useResourceListState';
import { MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { RolePermissionsDialog } from './RolePermissionsDialog';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { EditInfoDialog } from '@/components/resource/EditInfoDialog';
import { formatTimestamp } from '@/lib/time';
import { SETTINGS_DESCRIPTORS, useDeleteRole, useSettingsList, useUpdateRole, type SettingsKind } from './queries';

/**
 * Project settings: 角色 and 成员.
 *
 * Both are IAM lists (`iam.kubesphere.io/v1alpha2`). Roles are read with their rule
 * count and a detail view that lists the rules; members show the role they hold and
 * whether the account is still active. Editing roles and inviting members are forms
 * the platform already owns elsewhere and are not migrated here.
 */
export interface SettingsListPageProps {
  kind: SettingsKind;
  cluster: string;
  namespace: string;
}

const PAGE_SIZE = 10;

type SortKey = 'name' | 'createTime';

type Row = RoleSummary | MemberSummary;

export function SettingsListPage({ kind, cluster, namespace }: SettingsListPageProps): React.ReactElement {
  const t = useT();
  const descriptor = SETTINGS_DESCRIPTORS[kind];
  const [projectFilter, setProjectFilter] = React.useState(namespace);
  React.useEffect(() => setProjectFilter(namespace), [cluster, namespace]);

  const list = useResourceListState<SortKey>({ defaultSortBy: 'createTime', resetOn: [cluster, projectFilter] });
  const query = useSettingsList(kind, toListParams(list, { cluster, namespace: projectFilter }, PAGE_SIZE));
  const projectFilterControl = useProjectFilter(cluster, t('settings.filter.projectLabel'), t('settings.filter.project'));

  const [roleName, setRoleName] = React.useState<string | null>(null);
  const [editRole, setEditRole] = React.useState<RoleSummary | null>(null);
  const [permissionsRole, setPermissionsRole] = React.useState<RoleSummary | null>(null);
  const [deleteRole, setDeleteRole] = React.useState<RoleSummary | null>(null);
  const updateRole = useUpdateRole({ cluster, namespace: projectFilter });
  const removeRole = useDeleteRole({ cluster, namespace: projectFilter });
  const roleDetail = useQuery({
    queryKey: ['settings', 'role', cluster, projectFilter, roleName],
    queryFn: ({ signal }) => rolesApi(apiClient).get({ cluster, namespace: projectFilter, name: roleName ?? '', signal }),
    enabled: kind === 'roles' && Boolean(roleName),
  });

  const rows = (query.data?.items ?? []) as Row[];
  const total = query.data?.total ?? 0;

  const schema = React.useMemo<ListSchema<Row>>(
    () => ({
      title: t(descriptor.titleKey),
      description: t(descriptor.descriptionKey),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('settings.searchPlaceholder'), aiId: `${kind}:search` },
      filters: [projectFilterControl],
      sortableKeys: ['name', 'createTime'],
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
                  return (
                    <span className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate font-medium text-ai-fg">{role.alias || role.name}</span>
                        {role.system ? <Badge tone="neutral">{t('settings.roles.templateBadge')}</Badge> : null}
                      </span>
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
                  return <span className="truncate font-medium text-ai-fg">{member.alias || member.username}</span>;
                },
              },
              {
                key: 'active',
                title: t('settings.column.status'),
                width: 120,
                hideBelow: 'md',
                render: (row: Row) => {
                  const member = row as MemberSummary;
                  return <Badge tone={member.active ? 'success' : 'neutral'}>{member.active ? t('settings.status.active') : t('settings.status.inactive')}</Badge>;
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
                key: 'lastActive',
                title: t('settings.column.lastActive'),
                width: 170,
                hideBelow: 'xl',
                render: (row: Row) => {
                  const member = row as MemberSummary;
                  return <span className="tabular-nums text-ai-fg-muted">{member.lastActive ? formatTimestamp(member.lastActive) : '-'}</span>;
                },
              },
            ],
      /*
       * Templated roles are the platform's building blocks: the API rejects writes to
       * them, so the row offers only the detail view. Everything else gets the old
       * console's 编辑 / 删除 alongside it.
       */
      rowActions:
        kind === 'roles'
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
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      pagination: { page: list.page, pageSize: PAGE_SIZE, total },
    }),
    [descriptor, kind, list, projectFilterControl, t, total],
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
        filters={{ project: projectFilter }}
        onFiltersChange={(next) => {
          setProjectFilter(next['project'] ?? '');
          list.setPage(1);
        }}
        onPageChange={list.setPage}
        onSortChange={(next: { key: string; order: SortOrder } | undefined) => {
          if (next) list.setSort(next);
        }}
        onAction={(action, row) => {
          if (!row) return;
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
      />

      <MutationAlert error={updateRole.error ?? removeRole.error} />

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
