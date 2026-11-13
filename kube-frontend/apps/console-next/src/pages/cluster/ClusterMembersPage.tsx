import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { clusterMembersApi, type ClusterMemberSummary } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, ResourceList, type ListSchema } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';

/**
 * 集群成员.
 *
 * Who has a cluster role binding — the cluster-level counterpart of the project members page.
 * The role matters more here: `cluster-admin` is the difference between reading the cluster
 * and administering it, so it is a column rather than something to open.
 *
 * Read-only: inviting and removing require writing cluster role bindings, which is a
 * separate feature (and the platform's own API for it is a PUT of the whole member list).
 */
export interface ClusterMembersPageProps {
  cluster: string;
}

export function ClusterMembersPage({ cluster }: ClusterMembersPageProps): React.ReactElement {
  const t = useT();
  const query = useQuery({
    queryKey: ['cluster-members', cluster],
    queryFn: ({ signal }) => clusterMembersApi(apiClient).list({ cluster, signal }),
  });

  const rows = query.data?.items ?? [];
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  const schema = React.useMemo<ListSchema<ClusterMemberSummary>>(
    () => ({
      title: t('cluster.members.title'),
      description: t('cluster.members.description'),
      rowKey: 'username',
      rowAttributes: (row) => ({ 'data-ai-row': row.username }),
      columns: [
        {
          key: 'username',
          title: t('platform.column.username'),
          render: (row: ClusterMemberSummary) => (
            <span className="truncate font-medium text-ai-fg" data-ai-id={`cluster-members:name:${row.username}`}>
              {row.username}
            </span>
          ),
        },
        {
          key: 'status',
          title: t('platform.column.status'),
          width: 120,
          render: (row: ClusterMemberSummary) => (
            <Badge tone={row.status === 'Active' ? 'success' : 'danger'}>{row.status}</Badge>
          ),
        },
        {
          key: 'role',
          title: t('cluster.members.role'),
          width: 180,
          render: (row: ClusterMemberSummary) => <span className="truncate text-ai-fg-secondary">{row.role || '-'}</span>,
        },
        {
          key: 'lastLogin',
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
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      pagination: { page: 1, pageSize: Math.max(rows.length, 10), total: rows.length },
    }),
    [rows.length, t],
  );

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="cluster-members:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="cluster-members:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="cluster-members:surface" state={state} className="min-w-0">
      <ResourceList schema={schema} rows={rows} loading={state === 'loading'} />
    </AiSurface>
  );
}