import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { installedReleasesApi, objectEventsApi } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, Button, Modal, ResourceList, Skeleton, Tabs, TabsContent, type ListSchema } from '@kube-ai-hub/ui';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { formatTimestamp } from '@/lib/time';
import { useListRefresh } from '@/components/resource/useListRefresh';
import { statusTone } from './InstalledAppsPage';

/**
 * 已安装应用详情.
 *
 * The old console's project 应用详情 tabs, gathered on one page: 基本信息 (cluster/project/status/
 * version/creator/times), 资源 (the workloads/services/ingresses the chart created, found by the
 * `app.kubesphere.io/instance` selector), 事件 (Kubernetes events about the release), 配置 (the
 * values.yaml submitted at install) and YAML (the HelmRelease object as stored).
 *
 * Everything but 卸载 is a read. Uninstalling uses the release object id and its project, which
 * is why both are carried in the URL-derived data rather than asked for again.
 *
 * Upgrade / rollback is **not** offered: the openpitrix API has a project-level create route and
 * no upgrade route for a release (`POST …/applications/<id>` answers 405/404 — see design DEC),
 * so the page says so instead of showing a control that cannot work.
 */
export interface InstalledAppDetailPageProps {
  workspace: string;
  releaseId: string;
  /** The KubeSphere cluster from the route; resource reads are scoped to it. */
  cluster?: string;
}

type Tab = 'info' | 'resources' | 'events' | 'config' | 'yaml';

export function InstalledAppDetailPage({ workspace, releaseId, cluster: routeCluster }: InstalledAppDetailPageProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState<Tab>('info');
  const [removing, setRemoving] = React.useState(false);

  const detail = useQuery({
    queryKey: ['installed-app', workspace, releaseId],
    retry: false,
    queryFn: ({ signal }) => installedReleasesApi(apiClient).get({ workspace, releaseId, signal }),
  });

  const release = detail.data?.release ?? null;
  const helmRelease = detail.data?.helmRelease ?? null;

  const resources = useQuery({
    enabled: tab === 'resources' && Boolean(release?.project),
    queryKey: ['installed-app-resources', workspace, releaseId, release?.project, release?.name],
    queryFn: ({ signal }) =>
      installedReleasesApi(apiClient).resources({
        // The console cluster from the route -- **not** `release.cluster`, which is OpenPitrix's
        // runtime id (`default`). Using it sent the reads to `/clusters/default/...`, which 404s,
        // and the 资源 tab said 「资源不存在」 for a release that had resources.
        cluster: routeCluster || 'host',
        namespace: release?.project ?? '',
        releaseName: release?.name ?? '',
        signal,
      }),
  });

  const events = useQuery({
    enabled: tab === 'events' && Boolean(release?.project),
    queryKey: ['installed-app-events', releaseId, release?.project],
    queryFn: ({ signal }) =>
      objectEventsApi(apiClient).list({
        namespace: release?.project ?? '',
        name: release?.name ?? '',
        kind: 'HelmRelease',
        signal,
      }),
  });

  const remove = useMutation({
    mutationFn: () => installedReleasesApi(apiClient).remove({ workspace, namespace: release?.project ?? '', id: releaseId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['installed-apps', workspace] });
      setRemoving(false);
    },
  });

  const resourcesRefresh = useListRefresh('installed-app-resources', resources);
  const eventsRefresh = useListRefresh('installed-app-events', events);

  const resourceSchema = React.useMemo<ListSchema<{ kind: string; name: string; detail: string }>>(
    () => ({
      columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'installed-app-resources:columns' },
      title: t('installedApps.tabResources'),
      refresh: resourcesRefresh.refresh,
      rowKey: (row) => `${row.kind}/${row.name}`,
      rowAttributes: (row) => ({ 'data-ai-row': `${row.kind}/${row.name}` }),
      columns: [
        { key: 'kind', hideable: true, title: t('installedApps.column.app'), width: 160, render: (row) => <span className="text-ai-fg-secondary">{row.kind}</span> },
        { key: 'name', title: t('installedApps.column.name'), render: (row) => <span className="truncate font-medium text-ai-fg">{row.name}</span> },
        { key: 'detail', hideable: true, title: t('installedApps.column.status'), width: 160, render: (row) => <span className="tabular-nums text-ai-fg-secondary">{row.detail}</span> },
      ],
      empty: { title: t('installedApps.resourcesEmptyTitle'), description: t('installedApps.resourcesEmptyDescription') },
      labels: {
        ...resourcesRefresh.emptyLabels,
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
    }),
    [resources.isFetching, t, resourcesRefresh],
  );

  const resourceSchemaKeyMap = React.useMemo(() => resourceSchema.columns.map((column) => column.key), [resourceSchema]);
  const columnVisibility = useColumnVisibility('installed-app-resources', resourceSchemaKeyMap);

  const eventSchema = React.useMemo<ListSchema<{ reason: string; message: string; type: string; lastSeen: string }>>(
    () => ({
      title: t('installedApps.tabEvents'),
      refresh: eventsRefresh.refresh,
      rowKey: (row) => `${row.reason}/${row.lastSeen}`,
      columns: [
        { key: 'type', title: t('installedApps.column.status'), width: 120, render: (row) => <Badge tone={row.type === 'Warning' ? 'warning' : 'neutral'}>{row.type || '-'}</Badge> },
        { key: 'reason', title: t('installedApps.column.app'), width: 160, render: (row) => <span className="truncate text-ai-fg-secondary">{row.reason || '-'}</span> },
        { key: 'message', title: t('appRepos.repos.column.message'), render: (row) => <span className="truncate text-ai-fg-secondary">{row.message || '-'}</span> },
        { key: 'lastSeen', title: t('cluster.column.createdAt'), width: 170, render: (row) => <span className="tabular-nums text-ai-fg-muted">{row.lastSeen ? formatTimestamp(row.lastSeen) : '-'}</span> },
      ],
      empty: { title: t('installedApps.eventsEmptyTitle'), description: t('installedApps.eventsEmptyDescription') },
      labels: {
        ...eventsRefresh.emptyLabels,
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
    }),
    [events.isFetching, t, eventsRefresh],
  );

  const back = (
    <Link
      to="/kube-frontend/workspaces/$workspace/apps/instances"
      params={{ workspace }}
      className="text-sm text-ai-link hover:underline"
      {...actionProps('installed-app:back')}
    >
      ← {t('installedApps.detailBack')}
    </Link>
  );

  // One surface state for the whole page: the contract asks a page to announce loading /
  // ready / error through state={...} (data-ai-state), and four literal props drift apart.
  const surfaceState: 'loading' | 'error' | 'ready' = detail.isPending
    ? 'loading'
    : detail.isError
      ? 'error'
      : 'ready';

  if (detail.isPending) {
    return (
      <AiSurface as="section" aiId="installed-app:surface" state={surfaceState} className="flex min-w-0 flex-col gap-4">
        {back}
        <Skeleton className="h-32 w-full" />
      </AiSurface>
    );
  }

  if (detail.isError) {
    return (
      <AiSurface as="section" aiId="installed-app:surface" state={surfaceState} className="flex min-w-0 flex-col gap-4">
        {back}
        <ResourceErrorPanel error={detail.error} onRetry={() => void detail.refetch()} retryAiId="installed-app:retry" />
      </AiSurface>
    );
  }

  if (!release) {
    return (
      <AiSurface as="section" aiId="installed-app:surface" state={surfaceState} className="flex min-w-0 flex-col gap-4">
        {back}
        <div className="rounded-ai-md border border-ai-line p-8 text-center" data-ai-id="installed-app:not-found">
          <p className="text-sm font-medium text-ai-fg">{t('installedApps.notFoundTitle')}</p>
          <p className="mt-1 text-xs text-ai-fg-muted">{t('installedApps.notFoundDescription')}</p>
        </div>
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="installed-app:surface" state={surfaceState} className="flex min-w-0 flex-col gap-4">
      {back}
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold text-ai-fg" data-ai-id="installed-app:name">
          {release.name || release.id}
        </h1>
        <Badge tone={statusTone(release.status)}>{release.status || '-'}</Badge>
        <span className="text-xs text-ai-fg-muted">{release.appName || '-'} · {release.versionName || '-'}</span>
        <div className="ml-auto">
          <Button
            variant="danger"
            size="sm"
            data-ai-id="installed-app:uninstall"
            onClick={() => {
              remove.reset();
              setRemoving(true);
            }}
          >
            {t('installedApps.uninstall')}
          </Button>
        </div>
      </header>

      <Tabs
        value={tab}
        onValueChange={(next) => setTab(next as Tab)}
        items={[
          { value: 'info', label: t('installedApps.tabInfo'), aiId: 'installed-app:tab:info' },
          { value: 'resources', label: t('installedApps.tabResources'), aiId: 'installed-app:tab:resources' },
          { value: 'events', label: t('installedApps.tabEvents'), aiId: 'installed-app:tab:events' },
          { value: 'config', label: t('installedApps.tabConfig'), aiId: 'installed-app:tab:config' },
          { value: 'yaml', label: t('installedApps.tabYaml'), aiId: 'installed-app:tab:yaml' },
        ]}
      >
        <TabsContent value="info" className="pt-4">
          <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="installed-app:basic">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[minmax(8rem,12rem)_1fr]">
              <DefinitionRow label={t('installedApps.column.name')} value={release.name || '-'} />
              <DefinitionRow label={t('installedApps.column.status')} value={release.status || '-'} />
              <DefinitionRow label={t('installedApps.column.app')} value={release.appName || '-'} />
              <DefinitionRow label={t('installedApps.column.version')} value={release.versionName || '-'} />
              <DefinitionRow label={t('installedApps.column.project')} value={release.project || '-'} />
              <DefinitionRow label={t('installedApps.column.cluster')} value={release.cluster || '-'} />
              <DefinitionRow label={t('appRepos.repos.column.creator')} value={release.owner || '-'} />
              <DefinitionRow label={t('installedApps.revision')} value={helmRelease ? String(helmRelease.revision || '-') : '-'} />
              <DefinitionRow label={t('cluster.column.createdAt')} value={release.createdAt ? formatTimestamp(release.createdAt) : '-'} />
              <DefinitionRow label={t('appRepos.repos.column.statusTime')} value={release.statusTime ? formatTimestamp(release.statusTime) : '-'} />
              <DefinitionRow
                label={t('installedApps.deployHistory')}
                value={helmRelease?.deployHistory.length ? helmRelease.deployHistory.map((entry) => `${entry.state} ${entry.deployTime}`).join(' → ') : '-'}
              />
              <DefinitionRow label={t('installedApps.column.app')} value={helmRelease ? `${helmRelease.chartName} ${helmRelease.chartVersion}` : '-'} />
            </dl>
            <p className="mt-3 text-[11px] text-ai-fg-muted" data-ai-id="installed-app:upgrade-note">
              {t('installedApps.upgradeUnsupported')}
            </p>
          </section>
        </TabsContent>

        <TabsContent value="resources" className="pt-4">
          {resources.isError ? (
            <ResourceErrorPanel error={resources.error} onRetry={() => void resources.refetch()} retryAiId="installed-app:resources-retry" />
          ) : (
            <div data-ai-id="installed-app:resources">
              <ResourceList schema={resourceSchema}
        {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
        onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys} rows={resources.data ?? []} loading={resources.isPending} onRefresh={resourcesRefresh.onRefresh} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="events" className="pt-4">
          {events.isError ? (
            <ResourceErrorPanel error={events.error} onRetry={() => void events.refetch()} retryAiId="installed-app:events-retry" />
          ) : (
            <div data-ai-id="installed-app:events">
              <ResourceList schema={eventSchema} rows={events.data ?? []} loading={events.isPending} onRefresh={eventsRefresh.onRefresh} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="config" className="pt-4">
          <section className="flex flex-col gap-2" data-ai-id="installed-app:config">
            <p className="text-[11px] text-ai-fg-muted">{t('installedApps.configHint')}</p>
            {helmRelease?.values ? (
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-ai-md border border-ai-line bg-ai-bg p-3 text-[11px] leading-relaxed text-ai-fg-secondary">
                {helmRelease.values}
              </pre>
            ) : (
              <p className="text-xs text-ai-fg-muted" data-ai-id="installed-app:config-empty">
                {t('installedApps.configEmpty')}
              </p>
            )}
          </section>
        </TabsContent>

        <TabsContent value="yaml" className="pt-4">
          <section className="flex flex-col gap-2" data-ai-id="installed-app:yaml">
            <p className="text-[11px] text-ai-fg-muted">{t('installedApps.yamlHint')}</p>
            <pre className="max-h-96 overflow-auto rounded-ai-md border border-ai-line bg-ai-bg p-3 text-[11px] leading-relaxed text-ai-fg-secondary">
              {helmRelease ? JSON.stringify(helmRelease.raw, null, 2) : '-'}
            </pre>
          </section>
        </TabsContent>
      </Tabs>

      <Modal
        open={removing}
        onOpenChange={(open) => {
          if (!remove.isPending) setRemoving(open);
        }}
        title={t('installedApps.uninstallTitle')}
        description={t('installedApps.uninstallDescription', { name: release.name })}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={remove.isPending} onClick={() => setRemoving(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              {...actionProps('installed-app:uninstall:confirm')}
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              {t('installedApps.uninstall')}
            </Button>
          </div>
        }
      >
        <MutationAlert error={remove.error} />
      </Modal>
    </AiSurface>
  );
}
