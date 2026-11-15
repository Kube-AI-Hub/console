import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AiSurface, Badge, ResourceList, type ListSchema } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { useListRefresh } from '@/components/resource/useListRefresh';

/**
 * 仓库应用.
 *
 * The apps a workspace has from its app repositories. Read from the workspace-scoped openpitrix
 * collection (/kapis/openpitrix.io/v1/workspaces/<ws>/apps).
 *
 * A repository filter is NOT applied here: the API accepts repo_id but ignores it (measured —
 * both with and without the parameter the same 15 workspace apps come back), and the app
 * objects carry no repo_id field to filter on client-side. Filtering by a parameter the server
 * ignores would label an unfiltered list as a repository's apps, so the page shows the
 * workspace's apps and the design records the limitation.
 */
export interface WorkspaceAppsPageProps {
  workspace: string;
}

interface RawApp {
  app_id?: string;
  name?: string;
  description?: string;
  app_version_types?: string;
  status?: string;
  create_time?: string;
}

interface AppRow {
  id: string;
  name: string;
  description: string;
  versionType: string;
  status: string;
  createdAt: string;
}

export function WorkspaceAppsPage({ workspace }: WorkspaceAppsPageProps): React.ReactElement {
  const t = useT();
  const query = useQuery({
    queryKey: ['workspace-apps', workspace],
    queryFn: async ({ signal }): Promise<AppRow[]> => {
      const body = await apiClient.request<{ items?: RawApp[] }>(
        `/kapis/openpitrix.io/v1/workspaces/${encodeURIComponent(workspace)}/apps`,
        { query: { limit: -1 }, ...(signal ? { signal } : {}) },
      );
      return (body?.items ?? []).map((item) => ({
        id: item.app_id ?? item.name ?? '',
        name: item.name ?? '',
        description: item.description ?? '',
        versionType: item.app_version_types ?? '',
        status: item.status ?? '',
        createdAt: item.create_time ?? '',
      }));
    },
  });

  const rows = query.data ?? [];
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';
  const listRefresh = useListRefresh('workspace-apps', query);

  const schema = React.useMemo<ListSchema<AppRow>>(
    () => ({
      title: t('appRepos.apps.title'),
      refresh: listRefresh.refresh,
      description: t('appRepos.apps.description'),
      rowKey: 'id',
      rowAttributes: (row) => ({ 'data-ai-row': row.id }),
      columns: [
        {
          key: 'name',
          title: t('cluster.column.name'),
          render: (row) => (
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-ai-fg">{row.name || '-'}</span>
              <span className="truncate text-[11px] text-ai-fg-muted">{row.description || '-'}</span>
            </span>
          ),
        },
        {
          key: 'versionType',
          title: t('appRepos.apps.column.versionType'),
          width: 130,
          hideBelow: 'md',
          render: (row) => <span className="text-ai-fg-secondary">{row.versionType || '-'}</span>,
        },
        {
          key: 'status',
          title: t('cluster.column.status'),
          width: 120,
          hideBelow: 'lg',
          render: (row) => (
            <Badge tone={row.status === 'active' ? 'success' : 'warning'}>{row.status || '-'}</Badge>
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
      empty: { title: t('appRepos.apps.emptyTitle'), description: t('appRepos.apps.emptyDescription') },
      labels: {
        ...listRefresh.emptyLabels,
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
    }),
    [query.isFetching, t],
  );

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="workspace-apps:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="workspace-apps:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="workspace-apps:surface" state={state} className="min-w-0">
      {/* Literal data-ai-id on the table wrapper: the action contract scans page source, and
          AiSurface's aiId prop is not a literal attribute in this file. */}
      <div data-ai-id="workspace-apps:table">
        <ResourceList schema={schema} onRefresh={listRefresh.onRefresh} rows={rows} loading={state === 'loading'} />
      </div>
    </AiSurface>
  );
}
