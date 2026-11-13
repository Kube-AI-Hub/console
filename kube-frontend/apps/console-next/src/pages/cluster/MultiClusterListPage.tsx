import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMulticluster } from '@/shell/useMulticluster';
import { Link } from '@tanstack/react-router';
import { clustersApi, type ClusterSummary } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { AddClusterDialog } from './AddClusterDialog';
import { ClusterEditDialog } from './ClusterEditDialog';

/**
 * 集群列表（多集群）.
 *
 * The platform console's entry page: every cluster the platform knows about, with the
 * two facts that decide whether you can use it — is it ready, and what is it running.
 *
 * The old console lists clusters the same way and links each to its own console. The
 * link target is the cluster's overview, which is where a reader goes next: "this
 * cluster is not ready" is answered by its version, modules and node count.
 */
export interface MultiClusterListPageProps {}

type SortKey = 'name' | 'createTime' | 'nodeCount';

export function MultiClusterListPage(_props: MultiClusterListPageProps): React.ReactElement {
  const t = useT();
  const { multicluster, loading: configLoading } = useMulticluster();
  const queryClient = useQueryClient();
  const list = useResourceListState<SortKey>({ defaultSortBy: 'name' });
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<ClusterSummary | null>(null);

  const query = useQuery({
    queryKey: ['clusters'],
    // Clusters change rarely while a session is open; membership is an installation
    // decision, not a per-minute fact.
    staleTime: 60_000,
    queryFn: ({ signal }) => clustersApi(apiClient).list({ signal }),
  });

  const all = query.data?.items ?? [];

  /*
   * A single-cluster installation has no fleet to manage: the old console redirects
   * `/clusters` straight into its only cluster's overview, and a list of one row is a
   * click between the reader and where they were going.
   *
   * Guarded on `configLoading`: acting on the default (`true`) before configz answers
   * would flash the list and then jump.
   */
  React.useEffect(() => {
    if (configLoading || multicluster || all.length !== 1) return;
    const only = all[0]?.name;
    if (only) window.location.replace(`/kube-frontend/clusters/${encodeURIComponent(only)}/overview`);
  }, [all, configLoading, multicluster]);
  const keyword = list.search.trim().toLowerCase();
  const filtered = keyword
    ? all.filter((row) => row.name.toLowerCase().includes(keyword) || row.provider.toLowerCase().includes(keyword))
    : all;
  const rows = React.useMemo(() => {
    // The host cluster first, whatever the sort: it is the cluster the platform runs
    // on, and the one a reader looks for by default.
    const items = [...filtered].sort((a, b) => Number(b.isHost) - Number(a.isHost));
    const direction = list.order === 'asc' ? 1 : -1;
    if (list.sortBy === 'createTime') return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt) * direction);
    if (list.sortBy === 'nodeCount') return items.sort((a, b) => (a.nodeCount - b.nodeCount) * direction);
    // The host cluster stays first only under the default sort; a reader who asked for
    // another order (by age, by size) gets exactly that order.
    if (list.sortBy !== 'name' || list.order !== 'asc') items.sort((a, b) => Number(b.isHost) - Number(a.isHost));
    return items.sort((a, b) => a.name.localeCompare(b.name) * direction);
  }, [filtered, list.sortBy, list.order]);

  const schema = React.useMemo<ListSchema<ClusterSummary>>(
    () => ({
      title: t('cluster.list.title'),
      description: t('cluster.list.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('cluster.searchPlaceholder'), aiId: 'clusters:search' },
      refresh: { label: t('cluster.list.refresh'), aiId: 'clusters:refresh', busy: query.isFetching },
      sortableKeys: ['name', 'createTime', 'nodeCount'],
      sortAiPrefix: 'clusters',
      sort: { key: list.sortBy, order: list.order },
      columns: [
        {
          key: 'name',
          title: t('cluster.column.name'),
          render: (row: ClusterSummary) => (
            <span className="flex min-w-0 flex-col" data-ai-id={`clusters:name:${row.name}`}>
              {/* Linked to the cluster console: the next question about a cluster is
                  always inside it, never in this list.

                  The alias is what the reader named it; the object name (or the provider,
                  when there is no alias) stays underneath so the two are never confused —
                  the old console's `showNameAndAlias`. */}
              <Link
                to="/kube-frontend/clusters/$cluster/overview"
                params={{ cluster: row.name }}
                className="truncate font-medium text-ai-accent hover:underline"
                title={row.name}
              >
                {row.alias || row.name}
              </Link>
              <span className="flex min-w-0 items-center gap-1">
                <span className="truncate text-[11px] text-ai-fg-muted">{row.alias ? row.name : row.provider || '-'}</span>
                {/* The environment tag is the label the platform groups clusters by;
                    it is what tells two member clusters apart at a glance. */}
                {row.group ? (
                  <Badge tone="neutral">{t(`cluster.group.${row.group}` as 'cluster.group.production')}</Badge>
                ) : null}
              </span>
            </span>
          ),
        },
        {
          key: 'ready',
          title: t('cluster.column.status'),
          width: 150,
          render: (row: ClusterSummary) => (
            <span className="flex flex-col gap-0.5">
              <Badge tone={row.ready && row.enabled ? 'success' : 'warning'}>
                {!row.enabled
                  ? t('cluster.list.disabled')
                  : row.ready
                    ? t('cluster.list.ready')
                    : t('cluster.list.notReady')}
              </Badge>
              {/* The controller's own sentence is what explains a cluster that is not
                  ready; the badge alone leaves the reader with no next step. */}
              {!row.ready && row.readyMessage ? (
                <span className="truncate text-[11px] text-ai-fg-muted" title={row.readyMessage}>
                  {row.readyMessage}
                </span>
              ) : null}
            </span>
          ),
        },
        {
          key: 'role',
          title: t('cluster.list.role'),
          width: 110,
          // Rendered from the label the federation writes, so a member cluster called
          // `host` is still a member.
          render: (row: ClusterSummary) => (
            <Badge tone={row.isHost ? 'info' : 'neutral'}>
              {row.isHost ? t('cluster.list.host') : t('cluster.list.member')}
            </Badge>
          ),
        },
        {
          key: 'kubernetesVersion',
          title: t('cluster.list.kubernetesVersion'),
          width: 150,
          hideBelow: 'md',
          render: (row: ClusterSummary) => <span className="tabular-nums text-ai-fg-secondary">{row.kubernetesVersion || '-'}</span>,
        },
        {
          key: 'nodeCount',
          title: t('cluster.list.nodeCount'),
          width: 110,
          hideBelow: 'lg',
          render: (row: ClusterSummary) => <span className="tabular-nums text-ai-fg-secondary">{row.nodeCount}</span>,
        },
        {
          key: 'createTime',
          title: t('cluster.column.createdAt'),
          width: 170,
          hideBelow: 'xl',
          render: (row: ClusterSummary) => (
            <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>
          ),
        },
      ],
      primaryAction: { key: 'add', label: t('cluster.add.title'), aiId: 'clusters:add' },
      rowActions: [{ key: 'edit', label: t('resource.action.editInfo'), aiId: 'clusters:edit' }],
      empty: { title: t('cluster.list.emptyTitle'), description: t('cluster.list.emptyDescription') },
      labels: {
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      pagination: { page: 1, pageSize: Math.max(rows.length, 10), total: rows.length },
    }),
    [list.sortBy, list.order, rows.length, t],
  );

  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="clusters:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="clusters:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="clusters:surface" state={state} className="min-w-0">
      <ResourceList
        schema={schema}
        rows={rows}
        loading={state === 'loading'}
        searchValue={list.keyword}
        onSearchChange={list.setKeyword}
        onRefresh={() => void query.refetch()}
        onSortChange={(next: { key: string; order: SortOrder } | undefined) => {
          if (next) list.setSort(next);
        }}
        onAction={(action, row) => {
          // The primary action arrives without a row. (An `onClick` on `primaryAction`
          // type-checks and does nothing — the click comes back through here.)
          if (action === 'add') return setAdding(true);
          if (action === 'edit' && row) setEditing(row as ClusterSummary);
        }}
      />
      <AddClusterDialog
        open={adding}
        onOpenChange={setAdding}
        onCreated={() => void queryClient.invalidateQueries({ queryKey: ['clusters'] })}
      />
      <ClusterEditDialog
        open={editing !== null}
        onOpenChange={(next) => {
          if (!next) setEditing(null);
        }}
        cluster={editing}
        onSaved={() => void queryClient.invalidateQueries({ queryKey: ['clusters'] })}
      />
    </AiSurface>
  );
}