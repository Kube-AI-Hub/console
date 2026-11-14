import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clusterDashboardsApi, type DashboardSummary } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, ResourceList, Skeleton, type ListSchema } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { YamlDialog } from '@/components/resource/YamlDialog';
import { formatTimestamp } from '@/lib/time';

/**
 * 自定义监控（集群级）.
 *
 * The page the old console puts at `/clusters/:cluster/custom-monitoring`: the list of
 * ClusterDashboard objects, each a Grafana-shaped bundle of `spec.panels`.
 *
 * **What is migrated**: the list itself (title, description, panel count, created), plus
 * deleting one and reading/writing its YAML. Those are the operations that do not depend on a
 * chart renderer, and they are what an administrator needs first: what dashboards exist, what
 * do they contain, and how do I remove one.
 *
 * **What is not**: the panel editor and the panel rendering. The old console opens a
 * Grafana-style editor (`stores/monitoring/custom/CustomMonitoringModal`) that drags, resizes
 * and queries PromQL per panel. That is a component suite of its own, not a page, and
 * pretending otherwise by showing an empty chart area would be worse than saying so.
 *
 * The earlier plan recorded this whole area as "dashboards API returns 404". It does — at
 * `v1alpha3`. The objects live at `v1alpha2`, and this cluster has one (an NVIDIA DCGM GPU
 * dashboard).
 */
export interface ClusterCustomMonitoringPageProps {
  cluster: string;
}

export function ClusterCustomMonitoringPage({ cluster }: ClusterCustomMonitoringPageProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['cluster-dashboards', cluster],
    queryFn: ({ signal }) => clusterDashboardsApi(apiClient).list({ signal }),
  });

  const [deleting, setDeleting] = React.useState<DashboardSummary | null>(null);
  const [yamlFor, setYamlFor] = React.useState<DashboardSummary | null>(null);
  const [yaml, setYaml] = React.useState<string>('');

  const saveYaml = useMutation({
    mutationFn: (params: { name: string; body: Record<string, unknown> }) =>
      clusterDashboardsApi(apiClient).save(params),
    onSuccess: () => {
      setYamlFor(null);
      void queryClient.invalidateQueries({ queryKey: ['cluster-dashboards', cluster] });
    },
  });

  const remove = useMutation({
    mutationFn: (name: string) => clusterDashboardsApi(apiClient).remove({ name }),
    onSuccess: () => {
      setDeleting(null);
      void queryClient.invalidateQueries({ queryKey: ['cluster-dashboards', cluster] });
    },
  });

  const rows = query.data ?? [];
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  const openYaml = React.useCallback(
    async (row: DashboardSummary) => {
      const item = await clusterDashboardsApi(apiClient).get({ name: row.name });
      setYaml(item ? JSON.stringify(item, null, 2) : '');
      setYamlFor(row);
    },
    [],
  );

  const schema = React.useMemo<ListSchema<DashboardSummary>>(
    () => ({
      title: t('customMonitoring.title'),
      description: t('customMonitoring.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      columns: [
        {
          key: 'title',
          title: t('cluster.column.name'),
          render: (row) => (
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-ai-fg">{row.title || row.name}</span>
              <span className="truncate text-[11px] text-ai-fg-muted">{row.summary || row.name}</span>
            </span>
          ),
        },
        {
          key: 'panels',
          title: t('customMonitoring.panels'),
          width: 120,
          render: (row) => <span className="tabular-nums text-ai-fg-secondary">{row.panels}</span>,
        },
        {
          key: 'editable',
          title: t('customMonitoring.editable'),
          width: 120,
          hideBelow: 'md',
          render: (row) => (
            <Badge tone={row.editable ? 'info' : 'neutral'}>
              {row.editable ? t('customMonitoring.yes') : t('customMonitoring.no')}
            </Badge>
          ),
        },
        {
          key: 'createTime',
          title: t('cluster.column.createdAt'),
          width: 170,
          hideBelow: 'lg',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
        },
      ],
      empty: { title: t('customMonitoring.empty'), description: t('customMonitoring.emptyDescription') },
      labels: {
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      // 行操作只声明；点击通过 ResourceList 的 onAction 到达。
      rowActions: [
        { key: 'yaml', label: t('customMonitoring.viewYaml'), aiId: 'custom-monitoring:yaml' },
        { key: 'delete', label: t('common.delete'), tone: 'danger', aiId: 'custom-monitoring:delete' },
      ],
    }),
    [openYaml, t],
  );

  return (
    <AiSurface as="section" aiId="custom-monitoring:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <p className="text-xs text-ai-fg-muted" {...actionProps('custom-monitoring:panel-note')}>
        {t('customMonitoring.panelsNotMigrated')}
      </p>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="custom-monitoring:retry" />
      ) : null}

      {state !== 'loading' && state !== 'error' ? (
        <ResourceList
          schema={schema}
          rows={rows}
          loading={false}
          onAction={(action, row) => {
            if (action === 'delete') setDeleting(row);
            else if (action === 'yaml') void openYaml(row);
          }}
        />
      ) : null}

      <DeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        names={deleting ? [deleting.title || deleting.name] : []}
        resource="custom-monitoring"
        noun={t('customMonitoring.title')}
        pending={remove.isPending}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.name);
        }}
      />

      <YamlDialog
        open={yamlFor !== null}
        onOpenChange={(open) => {
          if (!open) setYamlFor(null);
        }}
        initialYaml={yaml}
        {...(yamlFor?.name ? { lockName: yamlFor.name } : {})}
        title={`${yamlFor?.title || yamlFor?.name || ''} · YAML`}
        submitLabel={t('common.confirm')}
        pending={saveYaml.isPending}
        onSubmit={(parsed) => {
          if (yamlFor) saveYaml.mutate({ name: yamlFor.name, body: parsed });
        }}
      />
    </AiSurface>
  );
}
