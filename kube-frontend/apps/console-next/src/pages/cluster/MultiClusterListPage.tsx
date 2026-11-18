import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMulticluster } from '@/shell/useMulticluster';
import { Link } from '@tanstack/react-router';
import { accessReviewApi, clustersApi, type ClusterSummary } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { connectionLabelKey, connectionTone } from './connectionLabel';
import { AddClusterDialog } from './AddClusterDialog';
import { ClusterEditDialog } from './ClusterEditDialog';
import { RemoveClusterDialog } from './RemoveClusterDialog';
import { UpdateKubeconfigDialog } from './UpdateKubeconfigDialog';

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
  const [removing, setRemoving] = React.useState<ClusterSummary | null>(null);
  const [updatingKubeconfig, setUpdatingKubeconfig] = React.useState<ClusterSummary | null>(null);

  const query = useQuery({
    queryKey: ['clusters'],
    // Clusters change rarely while a session is open; membership is an installation
    // decision, not a per-minute fact.
    staleTime: 60_000,
    queryFn: ({ signal }) => clustersApi(apiClient).list({ signal }),
  });

  /*
   * Whether this account may import a cluster.
   *
   * The old console hides 添加集群 unless the account's rules include `clusters:create`.
   * The button is not merely decorative: pressing it opens a form whose submit is refused
   * with a 403, which reads as a broken dialog. `fail-open` (undefined → allowed) matches
   * the rest of the app: a broken permission check must not take a permitted action away.
   */
  const canWrite = useQuery({
    queryKey: ['clusters-can-create'],
    staleTime: 60_000,
    retry: false,
    queryFn: ({ signal }) => accessReviewApi(apiClient).allowed({ verb: 'create', resource: 'clusters', group: 'cluster.kubesphere.io', signal }),
  });
  const writeBlocked = canWrite.data === false;

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
  /*
   * Host vs member is the fleet's only real grouping. A column already says which is which;
   * a filter is what makes it operational ("show me the member clusters that may be lagging").
   */
  const [typeFilter, setTypeFilter] = React.useState<string>('');
  const byType = typeFilter === 'host'
    ? all.filter((row) => row.isHost)
    : typeFilter === 'member'
      ? all.filter((row) => !row.isHost)
      : all;
  const filtered = keyword
    ? byType.filter((row) => row.name.toLowerCase().includes(keyword) || row.provider.toLowerCase().includes(keyword))
    : byType;
  const rows = React.useMemo(() => {
    /*
     * The host cluster is pinned first, whatever the sort: it is where the platform runs and
     * the row a reader looks for without reading the list. Sorting the rest by the requested
     * field keeps the control honest -- without the pin, a member cluster that sorts before
     * "host" (a descending name sort does it) would push the host cluster off the top, which is
     * exactly the ordering the old console never showed.
     */
    const direction = list.order === 'asc' ? 1 : -1;
    const sorted = [...filtered];
    if (list.sortBy === 'createTime') sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt) * direction);
    else if (list.sortBy === 'nodeCount') sorted.sort((a, b) => (a.nodeCount - b.nodeCount) * direction);
    else sorted.sort((a, b) => a.name.localeCompare(b.name) * direction);
    const hosts = sorted.filter((row) => row.isHost);
    const members = sorted.filter((row) => !row.isHost);
    return [...hosts, ...members];
  }, [filtered, list.sortBy, list.order]);

  const schema = React.useMemo<ListSchema<ClusterSummary>>(
    () => ({
      title: t('cluster.list.title'),
      description: t('cluster.list.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('cluster.searchPlaceholder'), aiId: 'clusters:search' },
      filters: [
        {
          key: 'type',
          title: t('cluster.list.type'),
          aiId: 'clusters:filter:type',
          options: [
            { value: 'host', label: t('cluster.list.host') },
            { value: 'member', label: t('cluster.list.member') },
          ],
        },
      ],
      refresh: { label: t('cluster.list.refresh'), aiId: 'clusters:refresh', busy: query.isFetching },
      sortableKeys: ['name', 'createTime', 'nodeCount'],
      sortAiPrefix: 'clusters',
      sort: { key: list.sortBy, order: list.order },
      columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'clusters:columns' },
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
                className="truncate font-medium text-ai-link hover:underline"
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
          hideable: true,
          title: t('cluster.column.status'),
          /*
           * Sized to the widest status label plus the cell's 24px of padding
           * (`Not ready`, ~71px), not to the longest `readyMessage` sentence —
           * that one is truncated anyway, and giving it room cost every row a band
           * of empty space beside a short badge.
           */
          width: 120,
          render: (row: ClusterSummary) => (
            /*
             * `items-start` is load-bearing: a flex column defaults to
             * `align-items: stretch`, which made the badge as wide as the cell
             * (126px for a ~70px label) and left a band of empty colour beside
             * every status. Letting it size to its text is also what the cluster
             * switcher does, where the badge is a flex child of the row.
             */
            <span className="flex flex-col items-start gap-0.5">
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
          hideable: true,
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
          key: 'connectionType',
          hideable: true,
          title: t('cluster.list.connection'),
          width: 100,
          /*
           * Rendered as a badge, sized to its text: this column is all pills like
           * `role` beside it, so a plain word would read as a different kind of fact.
           * The badge is a direct child of the cell — a column wrapper would stretch
           * it to the full width of the column.
           */
          render: (row: ClusterSummary) => {
            const label = connectionLabelKey(row.connectionType);
            return label
              ? <Badge tone={connectionTone(row.connectionType)}>{t(label)}</Badge>
              : <span className="text-ai-fg-muted">-</span>;
          },
        },
        {
          key: 'endpoint',
          hideable: true,
          title: t('cluster.column.apiEndpoint'),
          width: 200,
          /*
           * The address the platform calls is the first thing to check when a member
           * cluster will not answer, but it is long enough to dominate the row, so it
           * is truncated and carries the full value in `title`. Hidden below `lg`: on a
           * laptop it would push the columns that answer "is it healthy" off-screen.
           */
          hideBelow: 'lg',
          render: (row: ClusterSummary) => (
            <span
              className="block truncate font-ai-mono text-[11px] text-ai-fg-secondary"
              title={row.endpoint || undefined}
              data-ai-id={`clusters:endpoint:${row.name}`}
            >
              {row.endpoint || '-'}
            </span>
          ),
        },
        {
          key: 'kubernetesVersion',
          hideable: true,
          title: t('cluster.list.kubernetesVersion'),
          width: 150,
          hideBelow: 'md',
          render: (row: ClusterSummary) => <span className="tabular-nums text-ai-fg-secondary">{row.kubernetesVersion || '-'}</span>,
        },
        {
          key: 'nodeCount',
          hideable: true,
          title: t('cluster.list.nodeCount'),
          width: 110,
          hideBelow: 'lg',
          render: (row: ClusterSummary) => <span className="tabular-nums text-ai-fg-secondary">{row.nodeCount}</span>,
        },
        {
          key: 'createTime',
          hideable: true,
          title: t('cluster.column.createdAt'),
          width: 170,
          hideBelow: 'xl',
          render: (row: ClusterSummary) => (
            <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>
          ),
        },
      ],
      primaryAction: {
        key: 'add',
        label: t('cluster.add.title'),
        aiId: 'clusters:add',
        disabled: writeBlocked,
        ...(writeBlocked ? { disabledHint: t('cluster.add.noPermission') } : {}),
      },
      rowActions: [
        { key: 'edit', label: t('resource.action.editInfo'), aiId: 'clusters:edit' },
        /*
         * The two lifecycle actions follow the old console's rules:
         *  - the host cluster can be neither removed nor re-pointed: every other page
         *    depends on it;
         *  - a proxy cluster has no kubeconfig to replace (its agent dials out), so the
         *    action is absent instead of failing after a paste.
         */
        {
          key: 'kubeconfig',
          label: t('cluster.row.updateKubeconfig'),
          aiId: 'clusters:update-kubeconfig',
          visible: (row: ClusterSummary) => !row.isHost && row.connectionType !== 'proxy',
        },
        {
          key: 'remove',
          label: t('cluster.row.remove'),
          tone: 'danger' as const,
          aiId: 'clusters:remove',
          visible: (row: ClusterSummary) => !row.isHost,
        },
      ],
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
    [list.sortBy, list.order, rows.length, t, writeBlocked],
  );

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('clusters', columnKeys);

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
        {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
        onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys}
        schema={schema}
        rows={rows}
        loading={state === 'loading'}
        searchValue={list.keyword}
        onSearchChange={list.setKeyword}
        filters={{ type: typeFilter }}
        onFiltersChange={(next) => setTypeFilter(next.type ?? '')}
        onRefresh={() => void query.refetch()}
        onSortChange={(next: { key: string; order: SortOrder } | undefined) => {
          if (next) list.setSort(next);
        }}
        onAction={(action, row) => {
          // The primary action arrives without a row. (An `onClick` on `primaryAction`
          // type-checks and does nothing — the click comes back through here.)
          if (action === 'add') return setAdding(true);
          if (action === 'edit' && row) setEditing(row as ClusterSummary);
          if (action === 'kubeconfig' && row) setUpdatingKubeconfig(row as ClusterSummary);
          if (action === 'remove' && row) setRemoving(row as ClusterSummary);
        }}
      />
      <AddClusterDialog
        open={adding}
        onOpenChange={setAdding}
        onCreated={() => void queryClient.invalidateQueries({ queryKey: ['clusters'] })}
      />
      <RemoveClusterDialog
        open={removing !== null}
        onOpenChange={(next) => {
          if (!next) setRemoving(null);
        }}
        cluster={removing}
        onRemoved={() => void queryClient.invalidateQueries({ queryKey: ['clusters'] })}
      />
      <UpdateKubeconfigDialog
        open={updatingKubeconfig !== null}
        onOpenChange={(next) => {
          if (!next) setUpdatingKubeconfig(null);
        }}
        cluster={updatingKubeconfig}
        onUpdated={() => void queryClient.invalidateQueries({ queryKey: ['clusters'] })}
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