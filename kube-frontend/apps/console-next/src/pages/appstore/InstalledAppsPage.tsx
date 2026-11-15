import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { installedReleasesApi, type InstalledRelease } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, Button, Modal, ResourceList, type ListSchema } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { useListRefresh } from '@/components/resource/useListRefresh';

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

export function InstalledAppsPage({ workspace }: InstalledAppsPageProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = React.useState('');
  const [removing, setRemoving] = React.useState<InstalledRelease | null>(null);

  const query = useQuery({
    queryKey: ['installed-apps', workspace],
    queryFn: ({ signal }) => installedReleasesApi(apiClient).list({ workspace, signal }),
  });

  const remove = useMutation({
    mutationFn: (release: InstalledRelease) =>
      installedReleasesApi(apiClient).remove({ workspace, namespace: release.project, id: release.id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['installed-apps', workspace] });
      setRemoving(null);
    },
  });

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
      title: t('installedApps.title'),
      refresh: listRefresh.refresh,
      description: t('installedApps.description'),
      rowKey: 'id',
      rowAttributes: (row) => ({ 'data-ai-row': row.id }),
      search: { placeholder: t('installedApps.searchPlaceholder'), aiId: 'installed-apps:search' },
      rowActions: [
        { key: 'remove', label: t('installedApps.uninstall'), aiId: 'installed-apps:uninstall', tone: 'danger' as const },
      ],
      columns: [
        {
          key: 'name',
          title: t('installedApps.column.name'),
          render: (row) => (
            <span className="flex min-w-0 flex-col">
              <Link
                to="/kube-frontend/workspaces/$workspace/apps/instances/$releaseId"
                params={{ workspace, releaseId: row.id }}
                className="truncate font-medium text-ai-accent hover:underline"
                data-ai-id={`installed-apps:name:${row.id}`}
              >
                {row.name || row.id}
              </Link>
              <span className="truncate text-[11px] text-ai-fg-muted">{row.description || '-'}</span>
            </span>
          ),
        },
        {
          key: 'status',
          title: t('installedApps.column.status'),
          width: 130,
          render: (row) => <Badge tone={statusTone(row.status)}>{row.status || '-'}</Badge>,
        },
        {
          key: 'appName',
          title: t('installedApps.column.app'),
          width: 180,
          hideBelow: 'md',
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.appName || '-'}</span>,
        },
        {
          key: 'versionName',
          title: t('installedApps.column.version'),
          width: 150,
          hideBelow: 'lg',
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.versionName || '-'}</span>,
        },
        {
          key: 'project',
          title: t('installedApps.column.project'),
          width: 140,
          hideBelow: 'lg',
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.project || '-'}</span>,
        },
        {
          key: 'createdAt',
          title: t('installedApps.column.createdAt'),
          width: 170,
          hideBelow: 'xl',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{row.createdAt ? formatTimestamp(row.createdAt) : '-'}</span>,
        },
      ],
      empty: { title: t('installedApps.emptyTitle'), description: t('installedApps.emptyDescription') },
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
    [query.isFetching, t, listRefresh, workspace],
  );

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="installed-apps:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="installed-apps:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="installed-apps:surface" state={state} className="min-w-0">
      <div data-ai-id="installed-apps:table">
        <ResourceList
          schema={schema}
          rows={visibleRows}
          loading={query.isPending}
          searchValue={keyword}
          onSearchChange={setKeyword}
          onRefresh={listRefresh.onRefresh}
          onAction={(action, row) => {
            if (action === 'remove' && row) {
              remove.reset();
              setRemoving(row as InstalledRelease);
            }
          }}
        />
      </div>
      {/* The aggregate cannot page or search server-side; say so instead of drawing a dead pager. */}
      <p className="mt-2 text-[11px] text-ai-fg-muted" data-ai-id="installed-apps:source-note">
        {t('installedApps.clientFilterHint', { total: query.data?.total ?? rows.length })}
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
    </AiSurface>
  );
}
