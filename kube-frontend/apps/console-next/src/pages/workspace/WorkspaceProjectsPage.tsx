import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { workspaceDetailApi } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, ResourceList, type ListSchema } from '@kube-ai-hub/ui';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { useListRefresh } from '@/components/resource/useListRefresh';

/**
 * 企业空间项目.
 *
 * The workspace's projects, one row each, linking into the project console. The link needs a
 * cluster segment because a project console URL is project-scoped; the workspace's own placement
 * names its clusters, so the first one is used (and `host` when the placement is empty — a
 * federated workspace lists its clusters explicitly, the default one does not).
 */
export interface WorkspaceProjectsPageProps {
  workspace: string;
}

export function WorkspaceProjectsPage({ workspace }: WorkspaceProjectsPageProps): React.ReactElement {
  const t = useT();
  const detail = useQuery({
    queryKey: ['workspace-detail', workspace],
    queryFn: ({ signal }) => workspaceDetailApi(apiClient).get({ name: workspace, signal }),
  });
  const query = useQuery({
    queryKey: ['workspace-projects', workspace],
    queryFn: ({ signal }) => workspaceDetailApi(apiClient).projects({ name: workspace, signal }),
  });
  const cluster = detail.data?.clusters[0] || 'host';
  const rows = query.data ?? [];
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';
  const listRefresh = useListRefresh('workspace-projects', query);

  const schema = React.useMemo<ListSchema<(typeof rows)[number]>>(
    () => ({
      title: t('workspace.projects.title'),
      refresh: listRefresh.refresh,
      description: t('workspace.projects.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'workspace-projects:columns' },
      columns: [
        {
          key: 'name',
          title: t('workspace.field.project'),
          render: (row) => (
            <a
              href={`/kube-frontend/${encodeURIComponent(workspace)}/clusters/${encodeURIComponent(cluster)}/projects/${encodeURIComponent(row.name)}/overview`}
              className="truncate font-medium text-ai-link hover:underline"
              {...actionProps(`workspace-projects:name:${row.name}`)}
            >
              {row.alias || row.name}
            </a>
          ),
        },
        {
          key: 'alias',
          hideable: true,
          title: t('workspace.field.name'),
          width: 180,
          hideBelow: 'md',
          render: (row) => <span className="truncate font-mono text-[11px] text-ai-fg-muted">{row.name}</span>,
        },
        {
          key: 'status',
          hideable: true,
          title: t('cluster.column.status'),
          width: 120,
          render: (row) => (
            <Badge tone={row.status === 'Active' ? 'success' : 'warning'}>{row.status || '-'}</Badge>
          ),
        },
        {
          key: 'creator',
          hideable: true,
          title: t('workspace.field.creator'),
          width: 150,
          hideBelow: 'lg',
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.creator || '-'}</span>,
        },
        {
          key: 'createdAt',
          hideable: true,
          title: t('workspace.field.createdAt'),
          width: 170,
          hideBelow: 'xl',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
        },
      ],
      empty: { title: t('workspace.projects.empty'), description: t('workspace.projects.emptyDescription') },
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
    // `busy` comes from the query, so the schema must rebuild when the fetch state changes.
    [cluster, query.isFetching, t, workspace],
  );

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('workspace-projects', columnKeys);

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="workspace-projects:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="workspace-projects:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="workspace-projects:surface" state={state} className="min-w-0">
      <ResourceList
        {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
        onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys} schema={schema} onRefresh={listRefresh.onRefresh} rows={rows} loading={state === 'loading'} />
    </AiSurface>
  );
}