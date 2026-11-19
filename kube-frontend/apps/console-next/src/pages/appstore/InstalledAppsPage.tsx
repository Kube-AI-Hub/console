import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  installedReleasesApi,
  storeAppsApi,
  type InstalledRelease,
  type StoreApp,
  type StoreAppVersion,
} from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, Button, InputSearch, Modal, ResourceList, Skeleton, type ListSchema } from '@kube-ai-hub/ui';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { useListRefresh } from '@/components/resource/useListRefresh';
import { AppInstallDialog } from './AppInstallDialog';

/**
 * 已安装应用（企业空间）.
 *
 * Every release installed in every project of the workspace, from the cross-project aggregate
 * `GET /kapis/openpitrix.io/v1/workspaces/<ws>/applications`. The old console showed the same
 * data as each app's 应用实例 tab and as the project's 应用 list; this page is the workspace-level
 * view the install flow already links to ("查看企业空间应用"), which is what makes an install
 * verifiable without switching consoles.
 *
 * The aggregate is **read-only and unpaged**: it answers `items` + `total_count` and ignores
 * `keyword`, so the filter below runs over the whole list in the page and there is deliberately
 * no pager — a pager the server cannot honour would be a dead control (design DEC).
 *
 * Uninstalling is project-scoped and takes the release **object id** (`rls-…`); deleting by
 * release name answers 200 and removes nothing, so the row carries the id, not the name.
 */
export interface InstalledAppsPageProps {
  workspace: string;
  /**
   * Project scope.
   *
   * The old console had both views over the same releases: the project's 应用 list (this
   * namespace only, with install/edit/uninstall) and the workspace aggregate (read-only,
   * "where did my install go"). Same rows, different source and different set of actions, so
   * the two live in one component rather than drifting apart as a copy.
   */
  project?: string | undefined;
  /** Only meaningful with `project`: the project route carries the cluster segment. */
  cluster?: string | undefined;
}

const STATUS_TONES: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  created: 'warning',
  creating: 'warning',
  upgrading: 'warning',
  upgraded: 'warning',
  failed: 'danger',
  deleting: 'warning',
};

export function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  return STATUS_TONES[status] ?? 'neutral';
}

export function InstalledAppsPage({ workspace, project, cluster = 'host' }: InstalledAppsPageProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = React.useState('');
  const [removing, setRemoving] = React.useState<InstalledRelease | null>(null);
  /* Project scope only: pick a store app, then hand it to the shared install dialog. */
  const [picking, setPicking] = React.useState(false);
  const [pickKeyword, setPickKeyword] = React.useState('');
  const [picked, setPicked] = React.useState<{ appId: string; appName: string; versions: StoreAppVersion[] } | null>(null);
  const [pickError, setPickError] = React.useState<string | null>(null);

  const query = useQuery({
    queryKey: ['installed-apps', workspace, project ?? 'all'],
    queryFn: ({ signal }) =>
      project
        ? installedReleasesApi(apiClient).listProject({ workspace, namespace: project, signal })
        : installedReleasesApi(apiClient).list({ workspace, signal }),
  });

  const storeApps = useQuery({
    enabled: picking,
    queryKey: ['project-apps-picker', pickKeyword],
    queryFn: ({ signal }) =>
      storeAppsApi(apiClient).list({ page: 1, pageSize: 24, ...(pickKeyword.trim() ? { keyword: pickKeyword.trim() } : {}), signal }),
  });

  const remove = useMutation({
    mutationFn: (release: InstalledRelease) =>
      installedReleasesApi(apiClient).remove({ workspace, namespace: release.project, id: release.id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['installed-apps', workspace, project ?? 'all'] });
      setRemoving(null);
    },
  });

  /* Pick a store app, resolve its versions, then let the shared dialog install it. */
  const chooseApp = async (app: StoreApp): Promise<void> => {
    setPickError(null);
    try {
      const versions = await storeAppsApi(apiClient).versions({ appId: app.id });
      if (!versions.length) {
        setPickError(t('installedApps.pickNoVersions', { name: app.name }));
        return;
      }
      setPicked({ appId: app.id, appName: app.name, versions });
      setPicking(false);
    } catch (error) {
      setPickError(error instanceof Error ? error.message : String(error));
    }
  };

  const rows = query.data?.items ?? [];
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';
  const listRefresh = useListRefresh('installed-apps', query);
  const needle = keyword.trim().toLowerCase();
  const visibleRows = needle
    ? rows.filter((row) =>
        [row.name, row.appName, row.project, row.versionName].some((value) => value.toLowerCase().includes(needle)),
      )
    : rows;

  const schema = React.useMemo<ListSchema<InstalledRelease>>(
    () => ({
      title: project ? t('installedApps.projectTitle') : t('installedApps.title'),
      refresh: listRefresh.refresh,
      description: project ? t('installedApps.projectDescription', { project }) : t('installedApps.description'),
      ...(project
        ? {
            primaryAction: {
              key: 'install',
              label: t('installedApps.installAction'),
              aiId: 'installed-apps:install',
            },
          }
        : {}),
      rowKey: 'id',
      rowAttributes: (row) => ({ 'data-ai-row': row.id }),
      search: { placeholder: t('installedApps.searchPlaceholder'), aiId: 'installed-apps:search' },
      rowActions: [
        { key: 'remove', label: t('installedApps.uninstall'), aiId: 'installed-apps:uninstall', tone: 'danger' as const },
      ],
      columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'installed-apps:columns' },
      columns: [
        {
          key: 'name',
          title: t('installedApps.column.name'),
          /* Pinned: the row's identity, kept in place while the other columns scroll. */
          width: 220,
          pin: 'start',
          render: (row) => (
            <span className="flex min-w-0 flex-col">
              {project ? (
                <Link
                  to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/applications/$releaseId"
                  params={{ workspace, cluster, namespace: project, releaseId: row.id }}
                  className="truncate font-medium text-ai-link hover:underline"
                  data-ai-id={`installed-apps:name:${row.id}`}
                >
                  {row.name || row.id}
                </Link>
              ) : (
                <Link
                  to="/kube-frontend/workspaces/$workspace/apps/instances/$releaseId"
                  params={{ workspace, releaseId: row.id }}
                  className="truncate font-medium text-ai-link hover:underline"
                  data-ai-id={`installed-apps:name:${row.id}`}
                >
                  {row.name || row.id}
                </Link>
              )}
              <span className="truncate text-[11px] text-ai-fg-muted">{row.description || '-'}</span>
            </span>
          ),
        },
        {
          key: 'status',
          hideable: true,
          title: t('installedApps.column.status'),
          width: 130,
          render: (row) => <Badge tone={statusTone(row.status)}>{row.status || '-'}</Badge>,
        },
        {
          key: 'appName',
          hideable: true,
          title: t('installedApps.column.app'),
          width: 180,
          hideBelow: 'md',
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.appName || '-'}</span>,
        },
        {
          key: 'versionName',
          hideable: true,
          title: t('installedApps.column.version'),
          width: 150,
          hideBelow: 'lg',
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.versionName || '-'}</span>,
        },
        /* Project scope: every row is the same project, so the column repeats a constant. */
        ...(project
          ? []
          : [
              {
                key: 'project',
                hideable: true,
                title: t('installedApps.column.project'),
                width: 140,
                hideBelow: 'lg' as const,
                render: (row: InstalledRelease) => (
                  <span className="truncate text-ai-fg-secondary">{row.project || '-'}</span>
                ),
              },
            ]),
        {
          key: 'createdAt',
          hideable: true,
          title: t('installedApps.column.createdAt'),
          width: 170,
          hideBelow: 'xl',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{row.createdAt ? formatTimestamp(row.createdAt) : '-'}</span>,
        },
      ],
      empty: { title: t('installedApps.emptyTitle'), description: t('installedApps.emptyDescription') },
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
    [query.isFetching, t, listRefresh, workspace, project, cluster],
  );

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('installed-apps', columnKeys);

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="installed-apps:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="installed-apps:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="installed-apps:surface" state={state} className="min-w-0">
      {project ? (
        <div className="mb-3 flex justify-end">
          <Link
            to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/applications/composing"
            params={{ workspace, cluster, namespace: project }}
            className="text-xs text-ai-link hover:underline"
            data-ai-id="installed-apps:composed-link"
          >
            {t('composedApps.title')}
          </Link>
        </div>
      ) : null}
      <div data-ai-id="installed-apps:table">
        <ResourceList
        {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
        onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys}
          schema={schema}
          rows={visibleRows}
          loading={query.isPending} refreshing={query.isFetching && !query.isPending}
          searchValue={keyword}
          onSearchChange={setKeyword}
          onRefresh={listRefresh.onRefresh}
          onAction={(action, row) => {
            if (action === 'remove' && row) {
              remove.reset();
              setRemoving(row as InstalledRelease);
            }
            if (action === 'install') {
              setPickKeyword('');
              setPickError(null);
              setPicking(true);
            }
          }}
        />
      </div>
      {/* The aggregate cannot page or search server-side; say so instead of drawing a dead pager. */}
      <p className="mt-2 text-[11px] text-ai-fg-muted" data-ai-id="installed-apps:source-note">
        {project
          ? t('installedApps.projectFilterHint', { total: query.data?.total ?? rows.length })
          : t('installedApps.clientFilterHint', { total: query.data?.total ?? rows.length })}
      </p>

      <Modal
        open={Boolean(removing)}
        onOpenChange={(open) => {
          if (!remove.isPending && !open) setRemoving(null);
        }}
        title={t('installedApps.uninstallTitle')}
        description={removing ? t('installedApps.uninstallDescription', { name: removing.name }) : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={remove.isPending} onClick={() => setRemoving(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              {...actionProps('installed-apps:uninstall:confirm')}
              disabled={remove.isPending}
              onClick={() => {
                if (removing) void remove.mutateAsync(removing).catch(() => undefined);
              }}
            >
              {t('installedApps.uninstall')}
            </Button>
          </div>
        }
      >
        <MutationAlert error={remove.error} />
        {remove.error ? (
          <p role="alert" data-ai-id="installed-apps:uninstall:error" className="text-sm text-ai-danger">
            {t('installedApps.uninstallFailed', { reason: remove.error instanceof Error ? remove.error.message : '' })}
          </p>
        ) : null}
      </Modal>

      <Modal
        open={picking}
        onOpenChange={(open) => {
          if (!open) {
            setPicking(false);
            setPickError(null);
          }
        }}
        title={t('installedApps.pickTitle')}
        description={t('installedApps.pickDescription', { project: project ?? '' })}
        footer={
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setPicking(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-2" data-ai-id="installed-apps:pick">
          <InputSearch
            value={pickKeyword}
            placeholder={t('installedApps.pickSearch')}
            data-ai-id="installed-apps:pick-search"
            onSearch={setPickKeyword}
            onChange={setPickKeyword}
          />
          {pickError ? (
            <p role="alert" className="text-sm text-ai-danger" data-ai-id="installed-apps:pick-error">
              {pickError}
            </p>
          ) : null}
          {storeApps.isPending ? <Skeleton className="h-24 w-full" /> : null}
          {storeApps.isError ? (
            <p role="alert" className="text-sm text-ai-danger" data-ai-id="installed-apps:pick-load-error">
              {t('installedApps.pickLoadError')}
            </p>
          ) : null}
          {!storeApps.isPending && !storeApps.isError && (storeApps.data?.items ?? []).length === 0 ? (
            <p className="text-sm text-ai-fg-muted" data-ai-id="installed-apps:pick-empty">
              {t('installedApps.pickEmpty')}
            </p>
          ) : null}
          <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {(storeApps.data?.items ?? []).map((app) => (
              <li key={app.id}>
                <Button
                  variant="ghost"
                  className="w-full flex-col items-start gap-0.5"
                  data-ai-id={`installed-apps:pick-app:${app.id}`}
                  onClick={() => void chooseApp(app)}
                >
                  <span className="text-sm text-ai-fg">{app.name}</span>
                  <span className="truncate text-[11px] text-ai-fg-muted">{app.description || '-'}</span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </Modal>

      <AppInstallDialog
        open={Boolean(picked)}
        onOpenChange={(open) => {
          if (!open) setPicked(null);
        }}
        appId={picked?.appId ?? ''}
        appName={picked?.appName ?? ''}
        versions={picked?.versions ?? []}
        {...(project ? { lockedWorkspace: workspace, lockedProject: project } : {})}
        onInstalled={() => {
          void queryClient.invalidateQueries({ queryKey: ['installed-apps', workspace, project ?? 'all'] });
        }}
      />
    </AiSurface>
  );
}
