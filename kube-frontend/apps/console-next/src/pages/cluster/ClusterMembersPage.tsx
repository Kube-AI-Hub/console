import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  accessReviewApi,
  clusterMembersApi,
  type ClusterMemberSummary,
  type ClusterRoleOption,
} from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, Button, Input, Modal, ResourceList, Select, type ListSchema } from '@kube-ai-hub/ui';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { useAuth } from '@/shell/AuthProvider';
import { MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { useListRefresh } from '@/components/resource/useListRefresh';

/**
 * 集群成员.
 *
 * Who has a cluster role binding — the cluster-level counterpart of the project members page.
 * The role matters more here: `cluster-admin` is the difference between reading the cluster
 * and administering it, so it is a column rather than something to open.
 *
 * Writing is the platform's own aggregate, not a raw RoleBinding edit: `clustermembers` takes
 * an array of `{username, roleRef}` on POST (invite), PUT on the member path (change role) and
 * DELETE (remove). All four verbs were probed on 2026-11-16; see the design's CON-*.
 *
 * Two protections the old console had and this page keeps: the signed-in account cannot change
 * its own role or remove itself, and such a row is not even selectable — selection drives the
 * bulk remove, and a row nobody may act on must not be checkable.
 */
export interface ClusterMembersPageProps {
  cluster: string;
}

type Dialog =
  | { kind: 'invite' }
  | { kind: 'role'; member: ClusterMemberSummary }
  | { kind: 'remove'; members: ClusterMemberSummary[] }
  | null;

const NAME_PATTERN = /^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/;

export function ClusterMembersPage({ cluster }: ClusterMembersPageProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const self = user?.name ?? '';
  const [selected, setSelected] = React.useState<string[]>([]);
  const [dialog, setDialog] = React.useState<Dialog>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const query = useQuery({
    queryKey: ['cluster-members', cluster],
    queryFn: ({ signal }) => clusterMembersApi(apiClient).list({ cluster, signal }),
  });
  const roles = useQuery({
    queryKey: ['cluster-member-roles'],
    staleTime: 5 * 60_000,
    queryFn: ({ signal }) => clusterMembersApi(apiClient).roles({ signal }),
  });
  /*
   * Permission gate. `clustermembers` is the platform aggregate; the review asks about that
   * resource so the answer matches what the write actually targets. A failed review fails
   * open: a broken check must not hide a control the identity is allowed to use.
   */
  const canWrite = useQuery({
    queryKey: ['cluster-members-permission'],
    retry: false,
    queryFn: async ({ signal }) => {
      try {
        const [create, remove] = await Promise.all([
          accessReviewApi(apiClient).allowed({ verb: 'create', resource: 'clustermembers', group: 'iam.kubesphere.io', signal }),
          accessReviewApi(apiClient).allowed({ verb: 'delete', resource: 'clustermembers', group: 'iam.kubesphere.io', signal }),
        ]);
        return create || remove;
      } catch {
        return true;
      }
    },
  });
  const writable = canWrite.data !== false;

  const rows = query.data?.items ?? [];
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';
  const listRefresh = useListRefresh('cluster-members', query);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['cluster-members', cluster] });

  const invite = useMutation({
    mutationFn: (members: Array<{ username: string; roleRef: string }>) => clusterMembersApi(apiClient).invite({ members }),
    onSuccess: async () => {
      setNotice(t('cluster.members.invited'));
      setDialog(null);
      await invalidate();
    },
  });
  const changeRole = useMutation({
    mutationFn: (input: { username: string; roleRef: string }) => clusterMembersApi(apiClient).changeRole(input),
    onSuccess: async () => {
      setNotice(t('cluster.members.roleChanged'));
      setDialog(null);
      await invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: async (members: ClusterMemberSummary[]) => {
      for (const member of members) await clusterMembersApi(apiClient).remove({ username: member.username });
    },
    onSuccess: async () => {
      setNotice(t('cluster.members.removed'));
      setDialog(null);
      setSelected([]);
      await invalidate();
    },
  });

  const roleOptions = React.useMemo(
    () => (roles.data ?? []).map((role: ClusterRoleOption) => ({ value: role.name, label: role.alias || role.name })),
    [roles.data],
  );

  const schema = React.useMemo<ListSchema<ClusterMemberSummary>>(
    () => ({
      title: t('cluster.members.title'),
      refresh: listRefresh.refresh,
      description: t('cluster.members.description'),
      rowKey: 'username',
      rowAttributes: (row) => ({ 'data-ai-row': row.username }),
      ...(writable
        ? {
            primaryAction: { key: 'invite', label: t('cluster.members.invite'), aiId: 'cluster-members:invite' },
            selection: 'multiple' as const,
            isRowSelectable: (row: ClusterMemberSummary) => row.username !== self,
            actions: [{ key: 'remove', label: t('common.delete'), aiId: 'cluster-members:bulk-remove', tone: 'danger' as const }],
          }
        : {}),
      rowActions: writable
        ? [
            {
              key: 'role',
              label: t('cluster.members.changeRole'),
              aiId: 'cluster-members:change-role',
              visible: (row: ClusterMemberSummary) => row.username !== self,
            },
            {
              key: 'remove',
              label: t('common.delete'),
              aiId: 'cluster-members:remove',
              tone: 'danger' as const,
              visible: (row: ClusterMemberSummary) => row.username !== self,
            },
          ]
        : [],
      columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'cluster-members:columns' },
      columns: [
        {
          key: 'username',
          hideable: true,
          title: t('platform.column.username'),
          render: (row: ClusterMemberSummary) => (
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium text-ai-fg" data-ai-id={`cluster-members:name:${row.username}`}>
                {row.username}
              </span>
              {row.username === self ? (
                <span className="text-[11px] text-ai-fg-muted" data-ai-id="cluster-members:self">
                  {t('cluster.members.selfProtected')}
                </span>
              ) : null}
            </span>
          ),
        },
        {
          key: 'status',
          hideable: true,
          title: t('platform.column.status'),
          width: 120,
          render: (row: ClusterMemberSummary) => (
            <Badge tone={row.status === 'Active' ? 'success' : 'danger'}>{row.status}</Badge>
          ),
        },
        {
          key: 'role',
          hideable: true,
          title: t('cluster.members.role'),
          width: 180,
          render: (row: ClusterMemberSummary) => <span className="truncate text-ai-fg-secondary">{row.role || '-'}</span>,
        },
        {
          key: 'lastLogin',
          hideable: true,
          title: t('platform.user.lastLogin'),
          width: 170,
          hideBelow: 'lg',
          render: (row: ClusterMemberSummary) => (
            <span className="tabular-nums text-ai-fg-muted">{row.lastLogin ? formatTimestamp(row.lastLogin) : '-'}</span>
          ),
        },
      ],
      empty: { title: t('cluster.members.emptyTitle'), description: t('cluster.members.emptyDescription') },
      labels: {
        ...listRefresh.emptyLabels,
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      pagination: { page: 1, pageSize: Math.max(rows.length, 10), total: rows.length },
    }),
    [listRefresh, rows.length, self, t, writable],
  );

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('cluster-members', columnKeys);

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="cluster-members:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="cluster-members:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="cluster-members:surface" state={state} className="min-w-0">
      {!writable ? (
        <p className="mb-2 text-xs text-ai-fg-muted" data-ai-id="cluster-members:no-write">
          {t('cluster.members.noWrite')}
        </p>
      ) : null}
      {notice ? (
        <p className="mb-2 text-xs text-ai-fg-secondary" data-ai-id="cluster-members:notice">
          {notice}
        </p>
      ) : null}
      <ResourceList
        {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
        onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys}
        schema={schema}
        onRefresh={listRefresh.onRefresh}
        rows={rows}
        loading={state === 'loading'}
        selectedKeys={selected}
        onSelectionChange={setSelected}
        onAction={(action, row) => {
          setNotice(null);
          invite.reset();
          changeRole.reset();
          remove.reset();
          if (action === 'invite') setDialog({ kind: 'invite' });
          if (action === 'role' && row) setDialog({ kind: 'role', member: row as ClusterMemberSummary });
          if (action === 'remove' && row) setDialog({ kind: 'remove', members: [row as ClusterMemberSummary] });
        }}
        onBulkAction={(action) => {
          if (action !== 'remove') return;
          const members = rows.filter((row) => selected.includes(row.username) && row.username !== self);
          if (members.length) {
            setNotice(null);
            setDialog({ kind: 'remove', members });
          }
        }}
      />

      <InviteDialog
        open={dialog?.kind === 'invite'}
        onOpenChange={(open) => !open && setDialog(null)}
        roles={roleOptions}
        submitting={invite.isPending}
        error={invite.error}
        onSubmit={(members) => invite.mutate(members)}
      />

      <RoleDialog
        member={dialog?.kind === 'role' ? dialog.member : null}
        roles={roleOptions}
        submitting={changeRole.isPending}
        error={changeRole.error}
        onClose={() => setDialog(null)}
        onSubmit={(roleRef) => {
          if (dialog?.kind === 'role') changeRole.mutate({ username: dialog.member.username, roleRef });
        }}
      />

      <RemoveDialog
        members={dialog?.kind === 'remove' ? dialog.members : []}
        submitting={remove.isPending}
        error={remove.error}
        onClose={() => setDialog(null)}
        onSubmit={(members) => remove.mutate(members)}
      />
    </AiSurface>
  );
}

/** Invite one or more platform users, each with a cluster role. */
function InviteDialog({
  open,
  onOpenChange,
  roles,
  submitting,
  error,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: Array<{ value: string; label: string }>;
  submitting: boolean;
  error: unknown;
  onSubmit: (members: Array<{ username: string; roleRef: string }>) => void;
}): React.ReactElement {
  const t = useT();
  const [username, setUsername] = React.useState('');
  const [roleRef, setRoleRef] = React.useState('');
  const [localError, setLocalError] = React.useState<string | null>(null);

  /* Reset on open only. Depending on `roles` too would wipe what the reader typed the moment
   * the role list finishes loading — a form that clears itself under the cursor. */
  React.useEffect(() => {
    if (!open) return;
    setUsername('');
    setLocalError(null);
  }, [open]);
  React.useEffect(() => {
    if (!open) return;
    setRoleRef((current) => current || roles[0]?.value || '');
  }, [open, roles]);

  const submit = (): void => {
    const name = username.trim();
    if (!name) {
      setLocalError(t('cluster.members.error.usernameRequired'));
      return;
    }
    if (!NAME_PATTERN.test(name)) {
      setLocalError(t('cluster.members.error.usernamePattern'));
      return;
    }
    if (!roleRef) {
      setLocalError(t('cluster.members.error.roleRequired'));
      return;
    }
    setLocalError(null);
    onSubmit([{ username: name, roleRef }]);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('cluster.members.inviteTitle')}
      description={t('cluster.members.inviteDescription')}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" {...actionProps('cluster-members:invite-cancel')} onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" loading={submitting} {...actionProps('cluster-members:invite-submit')} onClick={submit}>
            {t('common.confirm')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3" data-ai-id="cluster-members:invite-dialog">
        <MutationAlert error={error} />
        <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary" htmlFor="ai-field-member-username">
          {t('platform.column.username')}
          <Input
            id="ai-field-member-username"
            value={username}
            placeholder={t('cluster.members.usernamePlaceholder')}
            {...actionProps('cluster-members:invite-username')}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary" htmlFor="ai-field-member-role">
          {t('cluster.members.role')}
          <Select
            id="ai-field-member-role"
            value={roleRef}
            options={roles}
            placeholder={roles.length ? t('cluster.members.role') : t('cluster.members.noRoles')}
            disabled={roles.length === 0}
            data-ai-id="cluster-members:invite-role"
            onValueChange={setRoleRef}
          />
        </label>
        {localError ? (
          <p role="alert" className="text-sm text-ai-danger" data-ai-id="cluster-members:invite-error">
            {localError}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

/** Change one member's cluster role. */
function RoleDialog({
  member,
  roles,
  submitting,
  error,
  onClose,
  onSubmit,
}: {
  member: ClusterMemberSummary | null;
  roles: Array<{ value: string; label: string }>;
  submitting: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (roleRef: string) => void;
}): React.ReactElement {
  const t = useT();
  const [roleRef, setRoleRef] = React.useState('');

  React.useEffect(() => {
    if (!member) return;
    setRoleRef(member.role || roles[0]?.value || '');
  }, [member]);
  /* Only fill in a default while nothing is chosen, so a late role list cannot overwrite a pick. */
  React.useEffect(() => {
    if (!member) return;
    setRoleRef((current) => current || roles[0]?.value || '');
  }, [member, roles]);

  return (
    <Modal
      open={member !== null}
      onOpenChange={(open) => !open && onClose()}
      title={t('cluster.members.changeRoleTitle', { name: member?.username ?? '' })}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            loading={submitting}
            disabled={!roleRef}
            {...actionProps('cluster-members:role-submit')}
            onClick={() => roleRef && onSubmit(roleRef)}
          >
            {t('common.save')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3" data-ai-id="cluster-members:role-dialog">
        <MutationAlert error={error} />
        <Select
          value={roleRef}
          options={roles}
          disabled={roles.length === 0}
          data-ai-id="cluster-members:role-select"
          onValueChange={setRoleRef}
        />
      </div>
    </Modal>
  );
}

/** Remove one or more members; the name must be typed, as on the project members page. */
function RemoveDialog({
  members,
  submitting,
  error,
  onClose,
  onSubmit,
}: {
  members: ClusterMemberSummary[];
  submitting: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (members: ClusterMemberSummary[]) => void;
}): React.ReactElement {
  const t = useT();
  const [typed, setTyped] = React.useState('');
  const single = members.length === 1 ? members[0] : null;

  React.useEffect(() => {
    if (members.length) setTyped('');
  }, [members]);

  const confirmed = single ? typed.trim() === single.username : true;

  return (
    <Modal
      open={members.length > 0}
      onOpenChange={(open) => !open && onClose()}
      title={single ? t('cluster.members.removeTitle', { name: single.username }) : t('cluster.members.removeTitleBatch', { count: members.length })}
      description={t('cluster.members.removeDescription')}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            loading={submitting}
            disabled={!confirmed}
            {...actionProps('cluster-members:remove-confirm')}
            onClick={() => onSubmit(members)}
          >
            {t('common.delete')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3" data-ai-id="cluster-members:remove-dialog">
        <MutationAlert error={error} />
        {single ? (
          <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary" htmlFor="ai-field-member-confirm">
            {t('cluster.members.typeToConfirm', { name: single.username })}
            <Input
              id="ai-field-member-confirm"
              value={typed}
              {...actionProps('cluster-members:remove-confirm-input')}
              onChange={(event) => setTyped(event.target.value)}
            />
          </label>
        ) : (
          <ul className="flex flex-col gap-1 text-xs text-ai-fg-secondary" data-ai-id="cluster-members:remove-list">
            {members.map((member) => (
              <li key={member.username}>{member.username}</li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
