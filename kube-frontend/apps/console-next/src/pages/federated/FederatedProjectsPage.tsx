import * as React from 'react';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, ResourceList, type ListSchema } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { useFederatedProjects, type FederatedProject } from './queries';

/**
 * 联邦项目列表.
 *
 * A federated project is a FederatedNamespace: one object places a namespace on a set
 * of clusters. The list is deliberately read-only — creating, editing placement and
 * deleting are federation-control-plane writes and are a later step (the write path
 * is still being stabilised on this cluster).
 *
 * The workspace comes from the route, but the object carries the workspace label on
 * its federated template, so filtering happens after the read (see queries.ts).
 */
export interface FederatedProjectsPageProps {
  workspace: string;
}

export function FederatedProjectsPage({ workspace }: FederatedProjectsPageProps): React.ReactElement {
  const t = useT();
  const query = useFederatedProjects(workspace);
  const rows = query.data ?? [];
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  const schema = React.useMemo<ListSchema<FederatedProject>>(
    () => ({
      title: t('fedprojects.list.title'),
      description: t('fedprojects.list.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      columns: [
        {
          key: 'name',
          title: t('workspace.field.name'),
          render: (row) => (
            <a
              href={'/kube-frontend/workspaces/' + encodeURIComponent(workspace) + '/federatedprojects/' + encodeURIComponent(row.name)}
              className="inline-flex min-h-6 items-center truncate font-medium text-ai-accent hover:underline"
              {...actionProps('federated-projects:open:' + row.name)}
            >
              {row.name}
            </a>
          ),
        },
        {
          key: 'namespace',
          title: t('fedprojects.field.namespace'),
          width: 220,
          hideBelow: 'md',
          render: (row) => <span className="truncate font-mono text-[11px] text-ai-fg-secondary">{row.namespace || '-'}</span>,
        },
        {
          key: 'clusters',
          title: t('workspace.field.clusters'),
          width: 180,
          render: (row) =>
            row.clusters.length === 0 ? (
              <span className="text-ai-fg-muted">-</span>
            ) : (
              <span className="flex flex-wrap gap-1">
                {row.clusters.map((cluster) => (
                  <Badge key={cluster} tone="info">
                    {cluster}
                  </Badge>
                ))}
              </span>
            ),
        },
        {
          key: 'createdAt',
          title: t('workspace.field.createdAt'),
          width: 170,
          hideBelow: 'lg',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
        },
      ],
      empty: { title: t('fedprojects.list.emptyTitle'), description: t('fedprojects.list.emptyDescription') },
      labels: {
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
    }),
    [t, workspace],
  );

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="federated-projects:surface" state="error" className="min-w-0">
        <ResourceErrorPanel
          error={query.error}
          onRetry={() => void query.refetch()}
          retryAiId="federated-projects:retry"
        />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="federated-projects:surface" state={state} className="min-w-0">
      <ResourceList schema={schema} rows={rows} loading={state === 'loading'} />
    </AiSurface>
  );
}
