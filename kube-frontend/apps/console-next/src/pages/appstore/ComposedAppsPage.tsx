import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { composedAppsApi, composedAppsWriteApi, type ComposedAppCreateInput, type ComposedAppHealth, type ComposedAppSummary } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, ResourceList, type ListSchema } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { ComposedAppCreateDialog } from './ComposedAppCreateDialog';
import { formatTimestamp } from '@/lib/time';
import { useListRefresh } from '@/components/resource/useListRefresh';

/**
 * 项目 › 自制应用.
 *
 * The old console's `applications/composing`: an Application CR whose selector names the
 * Deployment/StatefulSet/Service/Ingress that belong to it. Read-only here; the list derives
 * component counts and workload readiness because no server aggregate joins them. [N-01]
 */
export interface ComposedAppsPageProps {
  workspace: string;
  cluster: string;
  namespace: string;
}

const HEALTH_TONE: Record<ComposedAppHealth, 'success' | 'warning' | 'danger' | 'neutral'> = {
  healthy: 'success',
  progressing: 'warning',
  degraded: 'danger',
  unknown: 'neutral',
};

export function ComposedAppsPage({ workspace, cluster, namespace }: ComposedAppsPageProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const [creating, setCreating] = React.useState(false);
  const query = useQuery({
    queryKey: ['composed-apps', cluster, namespace],
    queryFn: ({ signal }) => composedAppsApi(apiClient).list({ namespace, cluster, signal }),
  });
  const create = useMutation({
    mutationFn: (input: ComposedAppCreateInput & { cluster: string }) => composedAppsWriteApi(apiClient).create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['composed-apps', cluster, namespace] });
      setCreating(false);
    },
  });
  const rows = query.data ?? [];
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';
  const listRefresh = useListRefresh('composed-apps', query);

  const schema = React.useMemo<ListSchema<ComposedAppSummary>>(
    () => ({
      title: t('composedApps.title'),
      sortAiPrefix: 'composed-apps',
      refresh: listRefresh.refresh,
      description: t('composedApps.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      // Creation composes native objects; member-cluster writes are not wired yet.
      ...(cluster === 'host' ? { primaryAction: { key: 'create', label: t('composedApps.create.action'), aiId: 'composed-apps:create' } } : {}),
      columns: [
        {
          key: 'name',
          title: t('workspace.field.name'),
          render: (row) => (
            <Link
              to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/applications/composing/$name"
              params={{ workspace, cluster, namespace, name: row.name }}
              className="flex min-w-0 flex-col hover:underline"
              data-ai-id={'composed-apps:name:' + row.name}
            >
              <span className="truncate font-medium text-ai-accent">{row.name}</span>
              <span className="truncate font-mono text-[11px] text-ai-fg-muted">{row.namespace}</span>
            </Link>
          ),
        },
        {
          key: 'health',
          title: t('composedApps.column.health'),
          width: 160,
          render: (row) => (
            <Badge tone={HEALTH_TONE[row.health]}>
              {t(('composedApps.health.' + row.health) as 'composedApps.health.healthy')}
              {row.healthDetail ? ' ' + row.healthDetail : ''}
            </Badge>
          ),
        },
        {
          key: 'components',
          title: t('composedApps.column.components'),
          width: 160,
          render: (row) => (
            <span className="tabular-nums text-ai-fg-secondary">
              {t('composedApps.workloads')} {row.components.workloads} · {t('composedApps.services')} {row.components.services} ·{' '}
              {t('composedApps.ingresses')} {row.components.ingresses}
            </span>
          ),
        },
        {
          key: 'version',
          title: t('composedApps.column.version'),
          width: 120,
          render: (row) => <span className="font-mono text-ai-fg-secondary">{row.version}</span>,
        },
        {
          key: 'createdAt',
          hideable: true,
          title: t('workspace.field.createdAt'),
          width: 180,
          hideBelow: 'lg',
          render: (row) => (
            <span className="tabular-nums text-ai-fg-muted">{row.createdAt ? formatTimestamp(row.createdAt) : '-'}</span>
          ),
        },
      ],
      empty: { title: t('composedApps.empty.title'), description: t('composedApps.empty.description') },
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
    [cluster, listRefresh, t],
  );

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="composed-apps:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="composed-apps:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="composed-apps:surface" state={state} className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link
          to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/applications"
          params={{ workspace, cluster, namespace }}
          className="text-xs text-ai-link hover:underline"
          data-ai-id="composed-apps:back"
        >
          {t('composedApps.back')}
        </Link>
      </div>
      <div data-ai-id="composed-apps:table" className="min-w-0">
        <ResourceList
          schema={schema}
          onRefresh={listRefresh.onRefresh}
          rows={rows}
          loading={state === 'loading'}
          onAction={(action) => {
            if (action === 'create') setCreating(true);
          }}
        />
      </div>

      <MutationAlert error={create.error} />

      <ComposedAppCreateDialog
        open={creating}
        onOpenChange={setCreating}
        namespace={namespace}
        cluster={cluster}
        pending={create.isPending}
        {...(create.error ? { error: create.error } : {})}
        onSubmit={async (input) => {
          await create.mutateAsync(input);
        }}
      />
    </AiSurface>
  );
}
