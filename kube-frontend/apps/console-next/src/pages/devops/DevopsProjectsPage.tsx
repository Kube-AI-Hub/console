import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { AiSurface, Button, ResourceList, type ListSchema } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { devopsApi } from '@kube-ai-hub/api-client';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { useListRefresh } from '@/components/resource/useListRefresh';
import { DevopsProjectCreateDialog } from './components/DevopsDialogs';

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
 * Creating a project needs a workspace: the devops API rejects a project that carries no
 * `kubesphere.io/workspace` label, and the name it stores is `generateName` plus a
 * 5-character suffix. The create dialog therefore asks for the workspace, and the page
 * navigates to the **generated** name the API returns rather than to what was typed.
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
  const listRefresh = useListRefresh('devops', query);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [creating, setCreating] = React.useState(false);

  // The workspaces a project can be created in. Failing to read them must not hide the
  // list; the dialog simply has no workspace to offer and says so through its disabled
  // select.
  const workspaces = useQuery({
    queryKey: ['devops-project-workspaces'],
    staleTime: 60_000,
    retry: false,
    queryFn: async ({ signal }): Promise<string[]> => {
      const body = await apiClient.request<{ items?: { metadata?: { name?: string } }[] }>(
        '/kapis/tenant.kubesphere.io/v1alpha2/workspaces',
        { query: { limit: -1 }, ...(signal ? { signal } : {}) },
      );
      return (body?.items ?? []).map((item) => item.metadata?.name ?? '').filter(Boolean);
    },
  });

  const create = useMutation({
    mutationFn: (draft: { generateName: string; workspace: string; alias: string; description: string }) =>
      devopsApi(apiClient).createProject({
        generateName: draft.generateName,
        workspace: draft.workspace,
        alias: draft.alias,
        description: draft.description,
      }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['devops-projects'] });
      setCreating(false);
      void navigate({
        to: '/kube-frontend/clusters/$cluster/devops/$name',
        params: { cluster, name: created.name },
      });
    },
  });

  const schema = React.useMemo<ListSchema<DevopsProjectRow>>(
    () => ({
      title: t('devops.list.title'),
      refresh: listRefresh.refresh,
      description: t('devops.list.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'devops-projects:columns' },
      columns: [
        {
          key: 'name',
          title: t('cluster.column.name'),
          /* Pinned: the row's identity, kept in place while the other columns scroll. */
          width: 220,
          pin: 'start',
          render: (row) => (
            <Link
              to="/kube-frontend/clusters/$cluster/devops/$name"
              params={{ cluster, name: row.name }}
              className="truncate font-medium text-ai-link hover:underline"
              data-ai-id={`devops:link:${row.name}`}
            >
              {row.name}
            </Link>
          ),
        },
        {
          key: 'description',
          hideable: true,
          title: t('projectInfo.field.description'),
          hideBelow: 'md',
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.description || '-'}</span>,
        },
        {
          key: 'workspace',
          hideable: true,
          title: t('projectInfo.field.workspace'),
          width: 160,
          hideBelow: 'lg',
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.workspace || '-'}</span>,
        },
        {
          key: 'createdAt',
          hideable: true,
          title: t('cluster.column.createdAt'),
          width: 170,
          hideBelow: 'xl',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
        },
      ],
      empty: { title: t('devops.list.emptyTitle'), description: t('devops.list.emptyDescription') },
      labels: {
        ...listRefresh.emptyLabels, ...listRefresh.filterLabels,
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
    }),
    [cluster, query.isFetching, t],
  );

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('devops-projects', columnKeys);

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="devops:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="devops:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="devops:surface" state={state} className="flex min-w-0 flex-col gap-3">
      <div className="flex justify-end">
        <Button size="sm" {...actionProps('devops:create')} onClick={() => setCreating(true)}>
          {t('devops.create.title')}
        </Button>
      </div>
      <ResourceList
        {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
        onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys} schema={schema} onRefresh={listRefresh.onRefresh} rows={rows} loading={state === 'loading'} refreshing={listRefresh.refreshing} />
      <DevopsProjectCreateDialog
        open={creating}
        onOpenChange={(open) => {
          setCreating(open);
          if (!open) create.reset();
        }}
        workspaces={workspaces.data ?? []}
        pending={create.isPending}
        {...(create.error ? { error: create.error instanceof Error ? create.error.message : String(create.error) } : {})}
        onSubmit={(draft) => create.mutate(draft)}
      />
    </AiSurface>
  );
}
