import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { workspaceReposApi } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, ResourceList, Skeleton, Tabs, TabsContent, type ListSchema } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { formatTimestamp } from '@/lib/time';
import { useListRefresh } from '@/components/resource/useListRefresh';

/**
 * 应用仓库详情.
 *
 * The old console's repo detail page: the repository's attributes plus its 事件 tab, which lists
 * every index attempt (creation time / status / message). Both are read-only here; editing and
 * deleting stay on the list page where the row actions already live.
 *
 * The attributes are the same fields the list shows, plus the sync period and the last sync time —
 * the two values an administrator needs to tell "never synced" from "synced and failed".
 */
export interface WorkspaceRepoDetailPageProps {
  workspace: string;
  repoId: string;
}

type Tab = 'info' | 'events';

export function WorkspaceRepoDetailPage({ workspace, repoId }: WorkspaceRepoDetailPageProps): React.ReactElement {
  const t = useT();
  const [tab, setTab] = React.useState<Tab>('info');

  const repo = useQuery({
    queryKey: ['workspace-repo', workspace, repoId],
    retry: false,
    queryFn: ({ signal }) => workspaceReposApi(apiClient).get({ workspace, repoId, signal }),
  });

  const events = useQuery({
    queryKey: ['workspace-repo-events', workspace, repoId],
    enabled: tab === 'events',
    queryFn: ({ signal }) => workspaceReposApi(apiClient).events({ workspace, repoId, signal }),
  });

  const listRefresh = useListRefresh('workspace-repo-events', events);

  const eventSchema = React.useMemo<ListSchema<{ id: string; createdAt: string; status: string; message: string }>>(
    () => ({
      columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'workspace-repo-events:columns' },
      title: t('appRepos.repos.eventsTitle'),
      refresh: listRefresh.refresh,
      rowKey: 'id',
      rowAttributes: (row) => ({ 'data-ai-row': row.id }),
      columns: [
        {
          key: 'createdAt',
          /* Pinned: the row's identity, kept in place while the other columns scroll. */
          width: 190,
          pin: 'start',
          title: t('cluster.column.createdAt'),
          render: (row) => <span className="tabular-nums text-ai-fg-secondary">{row.createdAt ? formatTimestamp(row.createdAt) : '-'}</span>,
        },
        {
          key: 'status',
          hideable: true,
          title: t('cluster.column.status'),
          width: 140,
          render: (row) => (
            <Badge tone={row.status === 'successful' || row.status === 'active' ? 'success' : 'warning'}>{row.status || '-'}</Badge>
          ),
        },
        {
          key: 'message',
          hideable: true,
          title: t('appRepos.repos.column.message'),
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.message || '-'}</span>,
        },
      ],
      empty: { title: t('appRepos.repos.eventsEmptyTitle'), description: t('appRepos.repos.eventsEmptyDescription') },
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
    [events.isFetching, t, listRefresh],
  );

  const eventSchemaKeyMap = React.useMemo(() => eventSchema.columns.map((column) => column.key), [eventSchema]);
  const columnVisibility = useColumnVisibility('workspace-repo-events', eventSchemaKeyMap);

  const back = (
    <Link
      to="/kube-frontend/workspaces/$workspace/repos"
      params={{ workspace }}
      className="text-sm text-ai-link hover:underline"
      {...actionProps('workspace-repo-detail:back')}
    >
      ← {t('appRepos.repos.detailBack')}
    </Link>
  );

  // One surface state for the whole page: the contract asks a page to announce loading /
  // ready / error through state={...} (data-ai-state), and four literal props drift apart.
  const surfaceState: 'loading' | 'error' | 'ready' = repo.isPending
    ? 'loading'
    : repo.isError
      ? 'error'
      : 'ready';

  if (repo.isPending) {
    return (
      <AiSurface as="section" aiId="workspace-repo-detail:surface" state={surfaceState} className="flex min-w-0 flex-col gap-4">
        {back}
        <Skeleton className="h-32 w-full" />
      </AiSurface>
    );
  }

  if (repo.isError) {
    return (
      <AiSurface as="section" aiId="workspace-repo-detail:surface" state={surfaceState} className="flex min-w-0 flex-col gap-4">
        {back}
        <ResourceErrorPanel error={repo.error} onRetry={() => void repo.refetch()} retryAiId="workspace-repo-detail:retry" />
      </AiSurface>
    );
  }

  const detail = repo.data;
  const eventRows = events.data?.items ?? [];

  return (
    <AiSurface as="section" aiId="workspace-repo-detail:surface" state={surfaceState} className="flex min-w-0 flex-col gap-4">
      {back}
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold text-ai-fg" data-ai-id="workspace-repo-detail:name">
          {detail.name || detail.id}
        </h1>
        <Badge tone={detail.status === 'successful' || detail.status === 'active' ? 'success' : 'warning'}>
          {detail.status || '-'}
        </Badge>
      </header>

      <Tabs
        value={tab}
        onValueChange={(next) => setTab(next as Tab)}
        items={[
          { value: 'info', label: t('appRepos.repos.tabInfo'), aiId: 'workspace-repo-detail:tab:info' },
          {
            value: 'events',
            label: t('appRepos.repos.events'),
            aiId: 'workspace-repo-detail:tab:events',
            ...(events.data ? { count: eventRows.length } : {}),
          },
        ]}
      >
        <TabsContent value="info">
          <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="workspace-repo-detail:basic">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[minmax(8rem,12rem)_1fr]">
              <DefinitionRow label={t('cluster.column.name')} value={detail.name || '-'} />
              <DefinitionRow label={t('appRepos.repos.column.url')} value={detail.url || '-'} />
              <DefinitionRow label={t('appRepos.repos.column.description')} value={detail.description || '-'} />
              <DefinitionRow label={t('cluster.column.status')} value={detail.status || '-'} />
              <DefinitionRow label={t('appRepos.repos.column.creator')} value={detail.creator || '-'} />
              <DefinitionRow label={t('appRepos.repos.column.syncPeriod')} value={detail.syncPeriod || '-'} />
              <DefinitionRow
                label={t('appRepos.repos.column.statusTime')}
                value={detail.statusTime && !detail.statusTime.startsWith('0001') ? formatTimestamp(detail.statusTime) : '-'}
              />
              <DefinitionRow label={t('cluster.column.createdAt')} value={detail.createdAt ? formatTimestamp(detail.createdAt) : '-'} />
            </dl>
          </section>
        </TabsContent>
        <TabsContent value="events">
          {events.isError ? (
            <ResourceErrorPanel error={events.error} onRetry={() => void events.refetch()} retryAiId="workspace-repo-detail:events-retry" />
          ) : (
            <div data-ai-id="workspace-repo-detail:events">
              <ResourceList schema={eventSchema}
        {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
        onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys} rows={eventRows} loading={events.isPending} refreshing={events.isFetching && !events.isPending} onRefresh={listRefresh.onRefresh} />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AiSurface>
  );
}
