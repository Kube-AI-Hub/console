import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { workspaceMembersApi, type WorkspaceMemberSummary } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, ResourceList, type ListSchema } from '@kube-ai-hub/ui';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useListRefresh } from '@/components/resource/useListRefresh';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { errorMessage, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { WorkspaceMemberDialog } from './WorkspaceMemberDialog';
import { formatTimestamp } from '@/lib/time';
import { useAuth } from '@/shell/AuthProvider';

/**
 * 租户(企业空间)成员.
 *
 * Who can act inside this workspace and with which workspace role. Read from the IAM aggregate's
 * workspacemembers collection (the tenant path has no members endpoint — it answers 404), which
 * is the same source the platform's workspace detail reads.
 *
 * Writes use this same workspace IAM collection, never the project membership endpoint.
 */
export interface WorkspaceMembersPageProps {
  workspace: string;
}

type Dialog =
  | { kind: 'invite' }
  | { kind: 'edit'; member: WorkspaceMemberSummary }
  | { kind: 'remove'; names: string[] };

function memberStatusLabel(status: string, active: string, disabled: string): string {
  if (status === 'Active') return active;
  if (status === 'Disabled') return disabled;
  return status || '-';
}

export function WorkspaceMembersPage({ workspace }: WorkspaceMembersPageProps): React.ReactElement {
  const t = useT();
  const { user } = useAuth();
  const currentUsername = user?.name ?? '';
  const queryClient = useQueryClient();
  const [dialog, setDialog] = React.useState<Dialog | null>(null);
  const [keyword, setKeyword] = React.useState('');
  const [selected, setSelected] = React.useState<string[]>([]);
  React.useEffect(() => {
    setDialog(null);
    setKeyword('');
    setSelected([]);
  }, [workspace]);
  const members = workspaceMembersApi(apiClient);
  const isSelf = React.useCallback(
    (username: string) => Boolean(currentUsername) && username === currentUsername,
    [currentUsername],
  );
  const write = useMutation({
    mutationFn: async (input: { username: string; roleRef: string }) => {
      if (dialog?.kind === 'edit') await members.updateRole({ workspace, ...input });
      else await members.invite({ workspace, ...input });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspace-members', workspace] });
      setDialog(null);
    },
  });
  const remove = useMutation({
    mutationFn: (usernames: string[]) => members.removeMany({ workspace, usernames }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspace-members', workspace] });
      setSelected([]);
      setDialog(null);
    },
  });
  const query = useQuery({
    queryKey: ['workspace-members', workspace],
    queryFn: ({ signal }) => workspaceMembersApi(apiClient).list({ workspace, signal }),
  });
  const listRefresh = useListRefresh('workspace-members', query);
  const allRows = query.data ?? [];
  const rows = React.useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    if (!needle) return allRows;
    return allRows.filter(
      (row) => row.username.toLowerCase().includes(needle) || row.email.toLowerCase().includes(needle),
    );
  }, [allRows, keyword]);
  const state = query.isPending ? 'loading' : query.isError ? 'error' : allRows.length === 0 ? 'empty' : 'ready';

  const schema = React.useMemo<ListSchema<WorkspaceMemberSummary>>(
    () => ({
      title: t('workspace.members.title'),
      description: t('workspace.members.description'),
      primaryAction: { key: 'invite', label: t('settings.members.invite'), aiId: 'workspace-members:invite' },
      refresh: listRefresh.refresh,
      search: { placeholder: t('workspace.members.search'), aiId: 'workspace-members:search' },
      selection: 'multiple',
      isRowSelectable: (row) => !isSelf(row.username),
      selectAiId: 'workspace-members:select',
      actions: [{ key: 'bulk-remove', label: t('workspace.members.bulkRemove'), tone: 'danger', aiId: 'workspace-members:bulk-remove' }],
      rowActions: [
        { key: 'edit', label: t('settings.members.modifyRole'), visible: (row) => !isSelf(row.username) },
        { key: 'remove', label: t('settings.members.remove'), tone: 'danger', visible: (row) => !isSelf(row.username) },
      ],
      rowKey: 'username',
      rowAttributes: (row) => ({ 'data-ai-row': row.username }),
      columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'workspace-members:columns' },
      columns: [
        {
          key: 'username',
          /* Pinned: the row's identity, kept in place while the other columns scroll. */
          width: 220,
          pin: 'start',
          title: t('workspace.field.member'),
          render: (row) => (
            <span className="flex min-w-0 flex-col">
              <Link
                to="/kube-frontend/workspaces/$workspace/members/$name"
                params={{ workspace, name: row.username }}
                className="truncate font-medium text-ai-link hover:underline"
                {...actionProps(`workspace-members:name:${row.username}`)}
              >
                {row.username}
              </Link>
              <span className="truncate text-[11px] text-ai-fg-muted">{row.email || '-'}</span>
            </span>
          ),
        },
        {
          key: 'role',
          hideable: true,
          title: t('workspace.field.role'),
          width: 200,
          hideBelow: 'md',
          render: (row) => <span className="truncate font-mono text-[11px] text-ai-fg-secondary">{row.role || '-'}</span>,
        },
        {
          key: 'status',
          hideable: true,
          title: t('cluster.column.status'),
          width: 120,
          hideBelow: 'lg',
          render: (row) => (
            <Badge tone={row.status === 'Active' ? 'success' : 'warning'}>
              {memberStatusLabel(row.status, t('platform.status.active'), t('platform.status.disabled'))}
            </Badge>
          ),
        },
        {
          key: 'lastLogin',
          hideable: true,
          title: t('workspace.field.lastLogin'),
          width: 170,
          hideBelow: 'xl',
          render: (row) => (
            <span className="tabular-nums text-ai-fg-muted">
              {row.lastLogin ? formatTimestamp(row.lastLogin) : t('platform.column.notLoginYet')}
            </span>
          ),
        },
      ],
      empty: { title: t('workspace.members.empty'), description: t('workspace.members.emptyDescription') },
      labels: {
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
    }),
    [t, query.isFetching, isSelf, workspace],
  );

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('workspace-members', columnKeys);

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="workspace-members:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="workspace-members:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="workspace-members:surface" state={state} aria-busy={query.isFetching} className="min-w-0">
      {/* A literal data-ai-id on the table too: the action contract scans source text, and an
          AiSurface alone would leave this page without a targetable surface element. */}
      <div data-ai-id="workspace-members:table">
        <ResourceList
        {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
        onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys}
          schema={schema}
          rows={rows}
          loading={state === 'loading'} refreshing={query.isFetching && !query.isPending}
          searchValue={keyword}
          onSearchChange={setKeyword}
          selectedKeys={selected}
          onSelectionChange={setSelected}
          onRefresh={() => void query.refetch()}
          onAction={(key, member) => {
            if (key === 'invite') setDialog({ kind: 'invite' });
            if (key === 'edit' && member) setDialog({ kind: 'edit', member });
            if (key === 'remove' && member) {
              remove.reset();
              setDialog({ kind: 'remove', names: [member.username] });
            }
          }}
          onBulkAction={(action, keys) => {
            if (action !== 'bulk-remove') return;
            const names = keys.filter((name) => !isSelf(name));
            if (!names.length) return;
            remove.reset();
            setDialog({ kind: 'remove', names });
          }}
        />
      </div>
      {dialog?.kind === 'invite' || dialog?.kind === 'edit' ? (
        <WorkspaceMemberDialog
          key={`${workspace}:${dialog.kind === 'edit' ? dialog.member.username : 'invite'}`}
          workspace={workspace}
          {...(dialog.kind === 'edit' ? { member: dialog.member } : {})}
          pending={write.isPending}
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          onSubmit={(input) => write.mutateAsync(input)}
        />
      ) : null}
      {dialog?.kind === 'remove' ? (
        <DeleteDialog
          open
          names={dialog.names}
          resource="workspace-members"
          noun={t('workspace.field.member')}
          title={t('settings.members.remove')}
          confirmLabel={t('settings.members.remove')}
          pending={remove.isPending}
          {...(remove.error ? { error: errorMessage(t, remove.error) } : {})}
          onOpenChange={(open) => {
            if (!open && !remove.isPending) setDialog(null);
          }}
          onConfirm={async () => {
            try {
              await remove.mutateAsync(dialog.names);
            } catch {
              /* Error stays in the confirmation. */
            }
          }}
        />
      ) : null}
    </AiSurface>
  );
}
