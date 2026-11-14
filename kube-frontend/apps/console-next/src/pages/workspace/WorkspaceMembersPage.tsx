import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { workspaceMembersApi } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, ResourceList, type ListSchema } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';

/**
 * 企业空间成员.
 *
 * Who can act inside this workspace and with which workspace role. Read from the IAM aggregate's
 * workspacemembers collection (the tenant path has no members endpoint — it answers 404), which
 * is the same source the platform's workspace detail reads.
 *
 * Inviting is deliberately not here yet: the invite writes a workspace role binding, and doing it
 * without the role list would offer a free-text role field that can silently grant nothing.
 */
export interface WorkspaceMembersPageProps {
  workspace: string;
}

export function WorkspaceMembersPage({ workspace }: WorkspaceMembersPageProps): React.ReactElement {
  const t = useT();
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
    [t],
  );

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="workspace-members:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="workspace-members:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="workspace-members:surface" state={state} className="min-w-0">
      <ResourceList schema={schema} rows={rows} loading={state === 'loading'} />
    </AiSurface>
  );
}