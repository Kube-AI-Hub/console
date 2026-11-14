import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workspaceMembersApi, type WorkspaceMemberSummary } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, ResourceList, type ListSchema } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { errorMessage, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { WorkspaceMemberDialog } from './WorkspaceMemberDialog';
import { formatTimestamp } from '@/lib/time';

/**
 * 企业空间成员.
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

export function WorkspaceMembersPage({ workspace }: WorkspaceMembersPageProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = React.useState<{ kind: 'invite' } | { kind: 'edit' | 'remove'; member: WorkspaceMemberSummary } | null>(null);
  React.useEffect(() => { setDialog(null); }, [workspace]);
  const members = workspaceMembersApi(apiClient);
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
    mutationFn: (username: string) => members.remove({ workspace, username }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspace-members', workspace] });
      setDialog(null);
    },
  });
  const query = useQuery({
    queryKey: ['workspace-members', workspace],
    queryFn: ({ signal }) => workspaceMembersApi(apiClient).list({ workspace, signal }),
  });
  const rows = query.data ?? [];
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  const schema = React.useMemo<ListSchema<(typeof rows)[number]>>(
    () => ({
      title: t('workspace.members.title'),
      description: t('workspace.members.description'),
      primaryAction: { key: 'invite', label: t('settings.members.invite'), aiId: 'workspace-members:invite' },
      refresh: { label: t('common.refresh'), busy: query.isFetching },
      rowActions: [
        { key: 'edit', label: t('settings.members.modifyRole') },
        { key: 'remove', label: t('settings.members.remove'), tone: 'danger' },
      ],
      rowKey: 'username',
      rowAttributes: (row) => ({ 'data-ai-row': row.username }),
      columns: [
        {
          key: 'username',
          title: t('workspace.field.member'),
          render: (row) => <span className="truncate font-medium text-ai-fg">{row.username}</span>,
        },
        {
          key: 'role',
          title: t('workspace.field.role'),
          width: 200,
          hideBelow: 'md',
          render: (row) => <span className="truncate font-mono text-[11px] text-ai-fg-secondary">{row.role || '-'}</span>,
        },
        {
          key: 'status',
          title: t('cluster.column.status'),
          width: 120,
          hideBelow: 'lg',
          render: (row) => (
            <Badge tone={row.status === 'Active' ? 'success' : 'warning'}>{row.status || '-'}</Badge>
          ),
        },
        {
          key: 'lastLogin',
          title: t('workspace.field.lastLogin'),
          width: 170,
          hideBelow: 'xl',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{row.lastLogin ? formatTimestamp(row.lastLogin) : '-'}</span>,
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
    [t, query.isFetching],
  );

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
        <ResourceList schema={schema} rows={rows} loading={state === 'loading'} onRefresh={() => void query.refetch()}
          onAction={(key, member) => {
            if (key === 'invite') setDialog({ kind: 'invite' });
            if (key === 'edit') setDialog({ kind: 'edit', member });
            if (key === 'remove') { remove.reset(); setDialog({ kind: 'remove', member }); }
          }} />
      </div>
      {dialog?.kind === 'invite' || dialog?.kind === 'edit' ? <WorkspaceMemberDialog
        key={`${workspace}:${dialog.kind === 'edit' ? dialog.member.username : 'invite'}`}
        workspace={workspace}
        {...(dialog.kind === 'edit' ? { member: dialog.member } : {})}
        pending={write.isPending} onOpenChange={(open) => { if (!open) setDialog(null); }}
        onSubmit={(input) => write.mutateAsync(input)} /> : null}
      {dialog?.kind === 'remove' ? <DeleteDialog open names={[dialog.member.username]}
        resource="workspace-members" noun={t('workspace.field.member')}
        title={t('settings.members.remove')} confirmLabel={t('settings.members.remove')}
        pending={remove.isPending} {...(remove.error ? { error: errorMessage(t, remove.error) } : {})}
        onOpenChange={(open) => { if (!open && !remove.isPending) setDialog(null); }}
        onConfirm={async () => { try { await remove.mutateAsync(dialog.member.username); } catch { /* Error stays in the confirmation. */ } }} /> : null}
    </AiSurface>
  );
}
