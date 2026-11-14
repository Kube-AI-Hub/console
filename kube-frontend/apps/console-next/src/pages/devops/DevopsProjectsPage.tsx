import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { AiSurface, ResourceList, type ListSchema } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';

/**
 * DevOps 工程（集群作用域）.
 *
 * The cluster console's entry into DevOps: every DevOpsProject in the cluster, one row each.
 * A DevOpsProject is a cluster-scoped CRD (devops.kubesphere.io/v1alpha3), so the list is
 * read from the raw group rather than the workspace-scoped kapis aggregate: this page has no
 * workspace segment (the registry puts it under the cluster menu), and the CRD carries the
 * workspace as a label. The kapis paths that do exist
 * (/kapis/devops.../workspaces/<ws>/devops) need a workspace the URL does not have.
 *
 * Read-only for now: creating a DevOps project (and the pipeline editor) belongs to the
 * ks-devops write side, which is a separate delivery. The page's job is to make the area
 * reachable and to be honest when there is nothing to show (this cluster currently has zero
 * projects).
 */
export interface DevopsProjectsPageProps {
  cluster: string;
}

interface KubeDevopsProject {
  metadata?: {
    name?: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
}

interface DevopsProjectRow {
  name: string;
  description: string;
  workspace: string;
  createdAt: string;
}

const DEVOPS_PROJECTS = '/apis/devops.kubesphere.io/v1alpha3/devopsprojects';

export function DevopsProjectsPage({ cluster }: DevopsProjectsPageProps): React.ReactElement {
  const t = useT();
  const query = useQuery({
    queryKey: ['devops-projects'],
    queryFn: async ({ signal }): Promise<DevopsProjectRow[]> => {
      const body = await apiClient.request<{ items?: KubeDevopsProject[] }>(DEVOPS_PROJECTS, {
        ...(signal ? { signal } : {}),
      });
      return (body?.items ?? []).map((item) => {
        const labels = item.metadata?.labels ?? {};
        const annotations = item.metadata?.annotations ?? {};
        return {
          name: item.metadata?.name ?? '',
          description: annotations['kubesphere.io/description'] ?? '',
          workspace: labels['kubesphere.io/workspace'] ?? '',
          createdAt: item.metadata?.creationTimestamp ?? '',
        };
      });
    },
  });

  const rows = query.data ?? [];
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  const schema = React.useMemo<ListSchema<DevopsProjectRow>>(
    () => ({
      title: t('devops.list.title'),
      description: t('devops.list.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      columns: [
        {
          key: 'name',
          title: t('cluster.column.name'),
          render: (row) => (
            <Link
              to="/kube-frontend/clusters/$cluster/devops/$name"
              params={{ cluster, name: row.name }}
              className="truncate font-medium text-ai-accent hover:underline"
              data-ai-id={`devops:link:${row.name}`}
            >
              {row.name}
            </Link>
          ),
        },
        {
          key: 'description',
          title: t('projectInfo.field.description'),
          hideBelow: 'md',
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.description || '-'}</span>,
        },
        {
          key: 'workspace',
          title: t('projectInfo.field.workspace'),
          width: 160,
          hideBelow: 'lg',
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.workspace || '-'}</span>,
        },
        {
          key: 'createdAt',
          title: t('cluster.column.createdAt'),
          width: 170,
          hideBelow: 'xl',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
        },
      ],
      empty: { title: t('devops.list.emptyTitle'), description: t('devops.list.emptyDescription') },
      labels: {
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
    }),
    [cluster, t],
  );

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="devops:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="devops:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="devops:surface" state={state} className="min-w-0">
      <ResourceList schema={schema} rows={rows} loading={state === 'loading'} />
    </AiSurface>
  );
}
