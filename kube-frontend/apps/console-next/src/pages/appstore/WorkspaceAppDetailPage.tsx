import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  appTemplateInstancesApi,
  appTemplatesApi,
  VERSION_DELETABLE,
  VERSION_STATUS_ACTION,
  type AppTemplateVersion,
  type StoreAppVersion,
} from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, Button, Modal, ResourceList, Skeleton, Tabs, TabsContent, type ListSchema } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { formatTimestamp } from '@/lib/time';
import { useListRefresh } from '@/components/resource/useListRefresh';
import { AppInstallDialog } from './AppInstallDialog';
import { statusTone } from './InstalledAppsPage';

/**
 * 企业空间应用模板详情.
 *
 * The old console's template detail (Versions / App information / App instances tabs) with the
 * actions it offered: install, upload a new version, and the per-version review actions. The
 * review state machine is the server's — `draft → submitted → (passed) → active` and the
 * reverse — and `VERSION_STATUS_ACTION` names the one transition each status allows, verified
 * against the live API (draft→submit→submitted, submitted→cancel→draft).
 *
 * Deleting a template is refused by the server while versions remain
 * (`500 app … has some versions not deleted`), so the dialog says that instead of letting the
 * reader discover it as a failure.
 *
 * Installing reuses the store's install dialog: a release is created in a project either way, and
 * a second wizard would only drift from the first.
 */
export interface WorkspaceAppDetailPageProps {
  workspace: string;
  appId: string;
}

type Tab = 'versions' | 'instances' | 'info';

/** Adapt a template version to the shape the install dialog's version select expects. */
function toStoreVersion(version: AppTemplateVersion): StoreAppVersion {
  return {
    id: version.id,
    appId: '',
    name: version.name,
    status: version.status,
    active: version.active,
    createdAt: version.createdAt,
    statusTime: version.statusTime,
    packageName: version.packageName,
    home: '',
    icon: '',
    maintainers: [],
    sources: [],
  };
}

export function WorkspaceAppDetailPage({ workspace, appId }: WorkspaceAppDetailPageProps): React.ReactElement {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState<Tab>('versions');
  const [installOpen, setInstallOpen] = React.useState(false);
  const [removingVersion, setRemovingVersion] = React.useState<AppTemplateVersion | null>(null);
  const [removingApp, setRemovingApp] = React.useState(false);
  const [actionError, setActionError] = React.useState('');

  const app = useQuery({
    queryKey: ['workspace-app-template', workspace, appId],
    retry: false,
    queryFn: ({ signal }) => appTemplatesApi(apiClient).get({ workspace, appId, signal }),
  });

  const versions = useQuery({
    queryKey: ['workspace-app-template-versions', workspace, appId],
    queryFn: ({ signal }) => appTemplatesApi(apiClient).versions({ workspace, appId, signal }),
  });

  const instances = useQuery({
    enabled: tab === 'instances',
    queryKey: ['workspace-app-template-instances', workspace, appId],
    queryFn: ({ signal }) => appTemplateInstancesApi(apiClient).list({ workspace, appId, signal }),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['workspace-app-template', workspace, appId] });
    await queryClient.invalidateQueries({ queryKey: ['workspace-app-template-versions', workspace, appId] });
    await queryClient.invalidateQueries({ queryKey: ['workspace-app-templates', workspace] });
  };

  const versionAction = useMutation({
    mutationFn: (params: { versionId: string; action: string }) =>
      appTemplatesApi(apiClient).versionAction({ workspace, appId, versionId: params.versionId, action: params.action }),
    onSuccess: async () => {
      setActionError('');
      await invalidate();
    },
    onError: (cause) => setActionError(cause instanceof Error ? cause.message : String(cause)),
  });

  const deleteVersion = useMutation({
    mutationFn: (versionId: string) => appTemplatesApi(apiClient).deleteVersion({ workspace, appId, versionId }),
    onSuccess: async () => {
      setRemovingVersion(null);
      await invalidate();
    },
  });

  const deleteApp = useMutation({
    mutationFn: () => appTemplatesApi(apiClient).remove({ workspace, appId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspace-app-templates', workspace] });
      setRemovingApp(false);
      await navigate({ to: '/kube-frontend/workspaces/$workspace/apps', params: { workspace } });
    },
  });

  const versionsRefresh = useListRefresh('workspace-app-template-versions', versions);
  const instancesRefresh = useListRefresh('workspace-app-template-instances', instances);

  const versionSchema = React.useMemo<ListSchema<AppTemplateVersion>>(
    () => ({
      title: t('appRepos.apps.tabVersions'),
      refresh: versionsRefresh.refresh,
      rowKey: 'id',
      rowAttributes: (row) => ({ 'data-ai-row': row.id }),

      columns: [
        { key: 'name', title: t('store.detail.versionNumber'), render: (row) => <span className="truncate font-medium text-ai-fg">{row.name || row.id}</span> },
        {
          key: 'status',
          title: t('cluster.column.status'),
          width: 130,
          render: (row) => <Badge tone={row.status === 'active' ? 'success' : row.status === 'rejected' ? 'danger' : 'warning'}>{row.status || '-'}</Badge>,
        },
        { key: 'owner', title: t('appRepos.repos.column.creator'), width: 140, hideBelow: 'md', render: (row) => <span className="truncate text-ai-fg-secondary">{row.owner || '-'}</span> },
        { key: 'updatedAt', title: t('appRepos.apps.column.updateTime'), width: 170, hideBelow: 'lg', render: (row) => <span className="tabular-nums text-ai-fg-muted">{row.updatedAt ? formatTimestamp(row.updatedAt) : '-'}</span> },
        {
          /*
           * The review transition is a named button, not a generic menu entry: the old console
           * rendered 提交审核 / 撤销提交 / 发布 / 下架 per status, and a row menu whose only item
           * says "操作已提交" tells the reader nothing about what it will do.
           */
          key: 'actions',
          title: t('appRepos.apps.tabVersions'),
          width: 200,
          render: (row) => {
            const next = VERSION_STATUS_ACTION[row.status];
            const deletable = VERSION_DELETABLE.includes(row.status);
            return (
              <span className="flex items-center gap-1">
                {next ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    data-ai-id={`workspace-app-version:transition:${row.id}`}
                    disabled={versionAction.isPending}
                    onClick={() => versionAction.mutate({ versionId: row.id, action: next.action })}
                  >
                    {t(next.labelKey as 'appRepos.apps.action.submit')}
                  </Button>
                ) : null}
                {deletable ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    data-ai-id={`workspace-app-version:delete:${row.id}`}
                    onClick={() => {
                      deleteVersion.reset();
                      setRemovingVersion(row);
                    }}
                  >
                    {t('appRepos.apps.versionDelete')}
                  </Button>
                ) : null}
              </span>
            );
          },
        },
      ],
      empty: { title: t('appRepos.apps.versionsEmpty') },
      labels: {
        ...versionsRefresh.emptyLabels,
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [versions.isFetching, t, versionsRefresh, versionAction.isPending],
  );

  const instanceSchema = React.useMemo<ListSchema<{ id: string; name: string; status: string; project: string; versionName: string; createdAt: string }>>(
    () => ({
      title: t('appRepos.apps.tabInstances'),
      refresh: instancesRefresh.refresh,
      rowKey: 'id',
      rowAttributes: (row) => ({ 'data-ai-row': row.id }),
      columns: [
        {
          key: 'name',
          title: t('installedApps.column.name'),
          render: (row) => (
            <Link
              to="/kube-frontend/workspaces/$workspace/apps/instances/$releaseId"
              params={{ workspace, releaseId: row.id }}
              className="truncate font-medium text-ai-accent hover:underline"
            >
              {row.name || row.id}
            </Link>
          ),
        },
        { key: 'status', title: t('installedApps.column.status'), width: 130, render: (row) => <Badge tone={statusTone(row.status)}>{row.status || '-'}</Badge> },
        { key: 'versionName', title: t('installedApps.column.version'), width: 150, hideBelow: 'md', render: (row) => <span className="truncate text-ai-fg-secondary">{row.versionName || '-'}</span> },
        { key: 'project', title: t('installedApps.column.project'), width: 140, hideBelow: 'lg', render: (row) => <span className="truncate text-ai-fg-secondary">{row.project || '-'}</span> },
        { key: 'createdAt', title: t('cluster.column.createdAt'), width: 170, hideBelow: 'xl', render: (row) => <span className="tabular-nums text-ai-fg-muted">{row.createdAt ? formatTimestamp(row.createdAt) : '-'}</span> },
      ],
      empty: { title: t('appRepos.apps.instancesEmptyTitle'), description: t('appRepos.apps.instancesEmptyDescription') },
      labels: {
        ...instancesRefresh.emptyLabels,
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
    }),
    [instances.isFetching, t, instancesRefresh, workspace],
  );

  const back = (
    <Link
      to="/kube-frontend/workspaces/$workspace/apps"
      params={{ workspace }}
      className="text-sm text-ai-accent hover:underline"
      {...actionProps('workspace-app:back')}
    >
      ← {t('appRepos.apps.detailBack')}
    </Link>
  );

  if (app.isPending) {
    return (
      <AiSurface as="section" aiId="workspace-app:surface" state="loading" className="flex min-w-0 flex-col gap-4">
        {back}
        <Skeleton className="h-32 w-full" />
      </AiSurface>
    );
  }

  if (app.isError) {
    return (
      <AiSurface as="section" aiId="workspace-app:surface" state="error" className="flex min-w-0 flex-col gap-4">
        {back}
        <ResourceErrorPanel error={app.error} onRetry={() => void app.refetch()} retryAiId="workspace-app:retry" />
      </AiSurface>
    );
  }

  const detail = app.data;
  const versionRows = versions.data ?? [];
  const storeVersions = versionRows.map(toStoreVersion);

  return (
    <AiSurface as="section" aiId="workspace-app:surface" state="ready" className="flex min-w-0 flex-col gap-4">
      {back}
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold text-ai-fg" data-ai-id="workspace-app:name">
          {detail.name || detail.id}
        </h1>
        <Badge tone={detail.status === 'active' ? 'success' : detail.status === 'draft' ? 'neutral' : 'warning'}>{detail.status || '-'}</Badge>
        <span className="text-xs text-ai-fg-muted">{detail.description || '-'}</span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            data-ai-id="workspace-app:install"
            disabled={versionRows.length === 0}
            onClick={() => setInstallOpen(true)}
          >
            {t('appRepos.apps.install')}
          </Button>
          <Button
            size="sm"
            variant="danger"
            data-ai-id="workspace-app:delete"
            onClick={() => {
              deleteApp.reset();
              setRemovingApp(true);
            }}
          >
            {t('appRepos.apps.deleteApp')}
          </Button>
        </div>
      </header>

      {actionError ? (
        <p role="alert" data-ai-id="workspace-app:action-error" className="text-xs text-ai-danger">
          {t('appRepos.apps.actionFailed', { reason: actionError })}
        </p>
      ) : null}

      <Tabs
        value={tab}
        onValueChange={(next) => setTab(next as Tab)}
        items={[
          { value: 'versions', label: t('appRepos.apps.tabVersions'), aiId: 'workspace-app:tab:versions', ...(versions.data ? { count: versionRows.length } : {}) },
          { value: 'instances', label: t('appRepos.apps.tabInstances'), aiId: 'workspace-app:tab:instances' },
          { value: 'info', label: t('appRepos.apps.tabInfo'), aiId: 'workspace-app:tab:info' },
        ]}
      >
        <TabsContent value="versions" className="pt-4">
          {versions.isError ? (
            <ResourceErrorPanel error={versions.error} onRetry={() => void versions.refetch()} retryAiId="workspace-app:versions-retry" />
          ) : (
            <div data-ai-id="workspace-app:versions">
              <ResourceList
                schema={versionSchema}
                rows={versionRows}
                loading={versions.isPending}
                onRefresh={versionsRefresh.onRefresh}

              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="instances" className="pt-4">
          {instances.isError ? (
            <ResourceErrorPanel error={instances.error} onRetry={() => void instances.refetch()} retryAiId="workspace-app:instances-retry" />
          ) : (
            <div data-ai-id="workspace-app:instances">
              <ResourceList schema={instanceSchema} rows={instances.data ?? []} loading={instances.isPending} onRefresh={instancesRefresh.onRefresh} />
              <p className="mt-2 text-[11px] text-ai-fg-muted">{t('appRepos.apps.instancesHint', { workspace })}</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="info" className="pt-4">
          <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="workspace-app:basic">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[minmax(8rem,12rem)_1fr]">
              <DefinitionRow label={t('cluster.column.name')} value={detail.name || '-'} />
              <DefinitionRow label={t('cluster.column.status')} value={detail.status || '-'} />
              <DefinitionRow label={t('appRepos.apps.column.versionType')} value={detail.versionTypes || '-'} />
              <DefinitionRow label={t('appRepos.apps.column.latestVersion')} value={detail.latestVersionName || '-'} />
              <DefinitionRow label={t('store.detail.category')} value={detail.categories.map((category) => category.name).filter(Boolean).join(' / ') || '-'} />
              <DefinitionRow label={t('appRepos.repos.column.creator')} value={detail.owner || '-'} />
              <DefinitionRow label={t('store.detail.home')} value={detail.home || '-'} />
              <DefinitionRow label={t('cluster.column.createdAt')} value={detail.createdAt ? formatTimestamp(detail.createdAt) : '-'} />
              <DefinitionRow label={t('appRepos.apps.column.updateTime')} value={detail.updatedAt ? formatTimestamp(detail.updatedAt) : '-'} />
            </dl>
          </section>
        </TabsContent>
      </Tabs>

      <AppInstallDialog
        open={installOpen}
        onOpenChange={setInstallOpen}
        appId={appId}
        appName={detail.name || appId}
        versions={storeVersions}
        defaultVersionId={versionRows[0]?.id}
      />

      <Modal
        open={Boolean(removingVersion)}
        onOpenChange={(open) => {
          if (!deleteVersion.isPending && !open) setRemovingVersion(null);
        }}
        title={t('appRepos.apps.versionDeleteTitle')}
        description={removingVersion ? t('appRepos.apps.versionDeleteDescription', { name: removingVersion.name }) : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={deleteVersion.isPending} onClick={() => setRemovingVersion(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              {...actionProps('workspace-app-version:delete:confirm')}
              disabled={deleteVersion.isPending}
              onClick={() => {
                if (removingVersion) void deleteVersion.mutateAsync(removingVersion.id).catch(() => undefined);
              }}
            >
              {t('common.delete')}
            </Button>
          </div>
        }
      >
        <MutationAlert error={deleteVersion.error} />
      </Modal>

      <Modal
        open={removingApp}
        onOpenChange={(open) => {
          if (!deleteApp.isPending) setRemovingApp(open);
        }}
        title={t('appRepos.apps.deleteAppTitle')}
        description={t('appRepos.apps.deleteAppDescription', { name: detail.name })}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={deleteApp.isPending} onClick={() => setRemovingApp(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              {...actionProps('workspace-app:delete:confirm')}
              disabled={deleteApp.isPending || versionRows.length > 0}
              onClick={() => deleteApp.mutate()}
            >
              {t('common.delete')}
            </Button>
          </div>
        }
      >
        {versionRows.length > 0 ? (
          <p role="alert" data-ai-id="workspace-app:delete-blocked" className="text-sm text-ai-danger">
            {t('appRepos.apps.deleteAppVersionsFirst')}
          </p>
        ) : null}
        <MutationAlert error={deleteApp.error} />
      </Modal>
    </AiSurface>
  );
}
