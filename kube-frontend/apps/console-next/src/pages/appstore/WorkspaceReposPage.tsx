import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AiSurface, Badge, ResourceList, type ListSchema } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';

/**
 * 企业空间应用仓库.
 *
 * The workspace's Helm repositories, read from openpitrix's workspace-scoped collection
 * (/kapis/openpitrix.io/v1/workspaces/<ws>/repos). The workspace console owns this because a
 * repository belongs to a workspace; the platform store management pages only see the store's
 * own apps/categories. Read-only for now — creating a repository is the next delivery.
 */
export interface WorkspaceReposPageProps {
  workspace: string;
}

interface RawRepo {
  repo_id?: string;
  name?: string;
  url?: string;
  status?: string;
  create_time?: string;
  /** Some openpitrix versions expose the package type on the repo; this one does not. */
  type?: string;
  repo_type?: string;
}

interface RepoRow {
  id: string;
  name: string;
  url: string;
  type: string;
  status: string;
  createdAt: string;
}

export function WorkspaceReposPage({ workspace }: WorkspaceReposPageProps): React.ReactElement {
  const t = useT();
  const query = useQuery({
    queryKey: ['workspace-repos', workspace],
    queryFn: async ({ signal }): Promise<RepoRow[]> => {
      const body = await apiClient.request<{ items?: RawRepo[] }>(
        `/kapis/openpitrix.io/v1/workspaces/${encodeURIComponent(workspace)}/repos`,
        { query: { limit: -1 }, ...(signal ? { signal } : {}) },
      );
      return (body?.items ?? []).map((item) => ({
        id: item.repo_id ?? item.name ?? '',
        name: item.name ?? '',
        url: item.url ?? '',
        type: item.type ?? item.repo_type ?? '',
        status: item.status ?? '',
        createdAt: item.create_time ?? '',
      }));
    },
  });

  const rows = query.data ?? [];
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  const schema = React.useMemo<ListSchema<RepoRow>>(
    () => ({
      title: t('appRepos.repos.title'),
      description: t('appRepos.repos.description'),
      rowKey: 'id',
      rowAttributes: (row) => ({ 'data-ai-row': row.id }),
      columns: [
        {
          key: 'name',
          title: t('cluster.column.name'),
          render: (row) => <span className="truncate font-medium text-ai-fg">{row.name || '-'}</span>,
        },
        {
          key: 'url',
          title: t('appRepos.repos.column.url'),
          hideBelow: 'md',
          render: (row) => <span className="truncate font-mono text-[11px] text-ai-fg-secondary">{row.url || '-'}</span>,
        },
        {
          key: 'type',
          title: t('appRepos.repos.column.type'),
          width: 100,
          hideBelow: 'lg',
          render: (row) => <span className="text-ai-fg-secondary">{row.type || '-'}</span>,
        },
        {
          key: 'status',
          title: t('cluster.column.status'),
          width: 130,
          render: (row) => (
            <Badge tone={row.status === 'successful' || row.status === 'active' ? 'success' : 'warning'}>
              {row.status || '-'}
            </Badge>
          ),
        },
        {
          key: 'createdAt',
          title: t('cluster.column.createdAt'),
          width: 170,
          hideBelow: 'xl',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{row.createdAt ? formatTimestamp(row.createdAt) : '-'}</span>,
        },
      ],
      empty: { title: t('appRepos.repos.emptyTitle'), description: t('appRepos.repos.emptyDescription') },
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
      <AiSurface as="section" aiId="workspace-repos:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="workspace-repos:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="workspace-repos:surface" state={state} className="min-w-0">
      {/* Literal data-ai-id on the table wrapper: the action contract scans page source, and
          AiSurface's aiId prop is not a literal attribute in this file. */}
      <div data-ai-id="workspace-repos:table">
        <ResourceList schema={schema} rows={rows} loading={state === 'loading'} />
      </div>
    </AiSurface>
  );
}
