import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectDashboardsApi, type DashboardSummary } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, Button, ResourceList, Skeleton, type ListSchema } from '@kube-ai-hub/ui';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { YamlDialog } from '@/components/resource/YamlDialog';
import { formatTimestamp } from '@/lib/time';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { useListRefresh } from '@/components/resource/useListRefresh';

/**
 * 自定义监控（项目级）.
 *
 * The project half of custom monitoring: the namespaced `dashboards` CRDs the old console
 * lists at `/projects/:namespace/custom-monitoring`. The cluster page reads the same object
 * shape from `clusterdashboards`; the two differ only in scope, which is why the column set
 * and the YAML dialog are the same (see `pages/cluster/ClusterCustomMonitoringPage.tsx`).
 *
 * **Version matters**: the CRDs are `monitoring.kubesphere.io/v1alpha2`, not v1alpha3. The
 * v1alpha3 path answers 404 on this deployment, which is how the migration plan once recorded
 * the whole area as "no dashboards API".
 *
 * **What is not migrated**: the panel editor and chart rendering (the old Grafana-style modal).
 * The list and the YAML document are what an administrator needs to find a dashboard and read
 * or fix its definition; drawing the panels is a separate component suite.
 */
export interface ProjectCustomMonitoringPageProps {
  /**
   * The project 的 namespace.
   *
   * The route also carries workspace and cluster, but neither changes the read: the CRD
   * collection is namespaced under `/apis/monitoring.kubesphere.io/v1alpha2/namespaces/<ns>`,
   * the same shape the old console's store used. See the design doc's known pitfall for
   * member clusters.
   */
  namespace: string;
}

export function ProjectCustomMonitoringPage({ namespace }: ProjectCustomMonitoringPageProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['project-dashboards', namespace],
    queryFn: ({ signal }) => projectDashboardsApi(apiClient).list({ namespace, signal }),
  });

  const [yamlFor, setYamlFor] = React.useState<DashboardSummary | null>(null);
  const [yaml, setYaml] = React.useState<string>('');

  const saveYaml = useMutation({
    mutationFn: (params: { name: string; body: Record<string, unknown> }) =>
      projectDashboardsApi(apiClient).save({ ...params, namespace }),
    onSuccess: () => {
      setYamlFor(null);
      void queryClient.invalidateQueries({ queryKey: ['project-dashboards', namespace] });
    },
  });

  const rows = query.data ?? [];
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  const openYaml = React.useCallback(
    async (row: DashboardSummary) => {
      const item = await projectDashboardsApi(apiClient).get({ namespace, name: row.name });
      setYaml(item ? JSON.stringify(item, null, 2) : '');
      setYamlFor(row);
    },
    [namespace],
  );
  const listRefresh = useListRefresh('project-custom-monitoring', query);

  const schema = React.useMemo<ListSchema<DashboardSummary>>(
    () => ({
      title: t('customMonitoring.title'),
      refresh: listRefresh.refresh,
      description: t('customMonitoring.projectDescription'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'project-custom-monitoring:columns' },
      columns: [
        {
          key: 'title',
          hideable: true,
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
          hideable: true,
          title: t('customMonitoring.panels'),
          width: 120,
          render: (row) => <span className="tabular-nums text-ai-fg-secondary">{row.panels}</span>,
        },
        {
          key: 'editable',
          hideable: true,
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
          hideable: true,
          title: t('cluster.column.createdAt'),
          width: 170,
          hideBelow: 'lg',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
        },
      ],
      labels: {
        ...listRefresh.emptyLabels,
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      // Viewing the document is the one operation this page owns; the panel editor is the
      // part that is not migrated, and saying so by offering no create button is clearer
      // than a create dialog that cannot lay out a panel.
      rowActions: [{ key: 'yaml', label: t('customMonitoring.viewYaml'), aiId: 'project-custom-monitoring:yaml' }],
    }),
    [openYaml, query.isFetching, t],
  );

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('project-custom-monitoring', columnKeys);

  return (
    <AiSurface as="section" aiId="project-custom-monitoring:surface" state={state} className="flex min-w-0 flex-col gap-4">
      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="project-custom-monitoring:retry" />
      ) : null}

      {state === 'ready' ? (
        <div data-ai-id="project-custom-monitoring:table" className="min-w-0">
          <ResourceList
        {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
        onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys}
            schema={schema}
            onRefresh={listRefresh.onRefresh}
            rows={rows}
            loading={false}
            onAction={(action, row) => {
              if (action === 'yaml') void openYaml(row);
            }}
          />
        </div>
      ) : null}

      {state === 'empty' ? (
        // The explicit empty block owns its own handle: the list's built-in empty row is
        // inside a table, and an agent asked to "check the empty state" should not have to
        // go through a table that is not there.
        <div
          data-ai-id="project-custom-monitoring:empty"
          className="flex flex-col gap-1 rounded-ai-md border border-ai-line p-8 text-center"
        >
          {/* The list header lives in ResourceList when rows exist; the empty state replaces
              the list, so it repeats the same title and project description here. */}
          <h2 className="text-base font-semibold text-ai-fg">{t('customMonitoring.title')}</h2>
          <p className="text-xs text-ai-fg-muted">{t('customMonitoring.projectDescription')}</p>
          <p className="mt-3 text-sm text-ai-fg-secondary">{t('customMonitoring.empty')}</p>
          <p className="text-xs text-ai-fg-muted">{t('customMonitoring.emptyDescription')}</p>
          {/* The explicit empty block replaces the list, so it must carry the escape too. */}
          <div className="mt-3 flex justify-center">
            <Button
              size="sm"
              variant="secondary"
              {...actionProps('project-custom-monitoring:empty:refresh')}
              onClick={listRefresh.onRefresh}
            >
              {t('common.refresh')}
            </Button>
          </div>
        </div>
      ) : null}

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
