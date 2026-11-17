import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { clustersApi } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { Badge, Button, Icon, Modal } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { useAuth } from '@/shell/AuthProvider';
import { readClusterAlias, rememberClusterAlias, rememberLastCluster } from '@/lib/lastCluster';
import { useMulticluster } from '@/shell/useMulticluster';

/**
 * 集群切换 — the old console's `clusters/components/Selector` plus its `ClusterSelectModal`.
 *
 * The cluster console is one cluster at a time, and switching should not mean going back
 * to the fleet list and starting over. The old console puts the current cluster at the top
 * of the sidebar and opens a searchable list when clicked; so does this.
 *
 * A single-cluster installation gets the same block without the affordance: the label is
 * still worth showing ("you are in `host`"), but there is nothing to switch to.
 */
export interface ClusterSwitcherProps {
  /** The cluster the current URL is in. */
  current: string;
  /** Rendered as an icon-only rail when the sidebar is collapsed. */
  collapsed?: boolean;
}

export function ClusterSwitcher({ current, collapsed = false }: ClusterSwitcherProps): React.ReactElement {
  const t = useT();
  const { user } = useAuth();
  const { multicluster } = useMulticluster();
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const [keyword, setKeyword] = React.useState('');

  const query = useQuery({
    queryKey: ['clusters'],
    // Membership changes at installation time, not between page views.
    staleTime: 60_000,
    /*
     * Loaded with the shell, not only when the dialog opens.
     *
     * The switcher's label is the cluster's alias, which only the list carries. Fetching on
     * open meant a reload showed the raw object name until the reader opened the switcher —
     * the label silently changed identity across a refresh. One small request per cluster
     * page, shared through the query cache with the cluster list and the workspace bar.
     */
    queryFn: ({ signal }) => clustersApi(apiClient).list({ signal }),
  });

  const clusters = query.data?.items ?? [];
  const needle = keyword.trim().toLowerCase();
  const filtered = needle
    ? clusters.filter(
        (cluster) =>
          cluster.name.toLowerCase().includes(needle) || (cluster.alias ?? '').toLowerCase().includes(needle),
      )
    : clusters;

  const enter = React.useCallback(
    (target: string) => {
      rememberLastCluster(user?.name ?? '', target);
      const targetAlias = clusters.find((cluster) => cluster.name === target)?.alias ?? '';
      rememberClusterAlias(user?.name ?? '', target, targetAlias);
      setOpen(false);
      // Overview, like the old console's `enterCluster`: not every cluster runs every
      // module, and the overview is the page that explains why one is missing.
      //
      // A client-side transition, not `location.assign`: the shell, the sidebar and the
      // cluster list are identical for every cluster, so a full document load would
      // re-fetch ~1.5 MB to reach a page this app can render immediately.
      void navigate({ href: `/kube-frontend/clusters/${encodeURIComponent(target)}/overview` });
    },
    [clusters, navigate, user?.name],
  );

  /*
   * Keep the remembered alias in step with the cluster list whenever it is loaded.
   *
   * The switcher's label is the alias; the list is the only source of it. Caching it here
   * means the next page load — where the list has not been fetched yet — still shows the
   * same label, and an alias edited elsewhere replaces the stale one on the next visit.
   */
  const knownAlias = clusters.find((cluster) => cluster.name === current)?.alias;
  React.useEffect(() => {
    if (knownAlias !== undefined) rememberClusterAlias(user?.name ?? '', current, knownAlias);
  }, [current, knownAlias, user?.name]);

  const currentAlias = knownAlias || readClusterAlias(user?.name ?? '', current);

  return (
    <>
      <button
        type="button"
        onClick={() => (multicluster ? setOpen(true) : undefined)}
        aria-haspopup={multicluster ? 'dialog' : undefined}
        className={`flex w-full items-center gap-2 rounded-ai-md px-2 py-2 text-left hover:bg-ai-surface-2 ${
          collapsed ? 'justify-center' : ''
        }`}
        {...actionProps('shell:cluster-switcher', { label: t('cluster.switch.trigger') })}
      >
        <Icon name="cluster" size={16} />
        {collapsed ? null : (
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-ai-fg">
              {currentAlias || current}
            </span>
            {/* The object name sits under the alias, as in the cluster list: the alias is
                what the reader recognises, the name is what every URL and every other page
                calls the cluster. Showing only the alias made the console address the same
                cluster by two different names. */}
            <span className="truncate text-[11px] text-ai-fg-muted">
              {currentAlias ? `${current} · ${t('cluster.switch.trigger')}` : t('cluster.switch.trigger')}
            </span>
          </span>
        )}
        {multicluster && !collapsed ? <Icon name="chevron-down" size={12} /> : null}
      </button>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={t('cluster.switch.title')}
        footer={
          <div className="flex items-center justify-between gap-2">
            {/*
             * The way back to the fleet. The switcher answers "which cluster", but the
             * next question is often "which clusters are there, and how do I add one" —
             * and that page is otherwise only reachable from the header menu.
             */}
            <Button
              variant="ghost"
              onClick={() => window.location.assign('/kube-frontend/clusters')}
              {...actionProps('clusters:switch-manage')}
            >
              {t('cluster.switch.manage')}
            </Button>
            <Button variant="secondary" onClick={() => setOpen(false)} {...actionProps('clusters:switch-cancel')}>
              {t('common.cancel')}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          {/*
           * Search and refresh share one row: they shape the same list, and the refresh
           * used to sit on its own line under the field, which read as a stray control
           * between the search box and the clusters it refreshes.
           */}
          <div className="flex items-center gap-2">
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={t('cluster.switch.search')}
              aria-label={t('cluster.switch.search')}
              className="h-9 min-w-0 flex-1 rounded-ai-md border border-ai-line bg-ai-surface px-2 text-sm text-ai-fg"
              {...actionProps('clusters:switch-search')}
            />
            <button
              type="button"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-ai-md border border-ai-line text-ai-fg-secondary hover:bg-ai-surface-2 disabled:opacity-50"
              aria-label={t('cluster.list.refresh')}
              aria-busy={query.isFetching}
              title={t('cluster.list.refresh')}
              {...actionProps('clusters:switch-refresh')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className={`size-4${query.isFetching ? ' animate-spin motion-reduce:animate-none' : ''}`}>
                <path d="M20 11a8 8 0 1 0-2.3 5.7" />
                <path d="M20 4v7h-7" />
              </svg>
            </button>
          </div>

          {query.isPending ? <p className="text-xs text-ai-fg-muted">{t('common.loading')}</p> : null}

          <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {filtered.map((cluster) => (
              <li key={cluster.name}>
                <button
                  type="button"
                  onClick={() => enter(cluster.name)}
                  className={`flex w-full items-center gap-3 rounded-ai-md border px-3 py-2 text-left ${
                    cluster.name === current
                      ? 'border-ai-accent bg-ai-surface-2'
                      : 'border-ai-line hover:bg-ai-surface-2'
                  }`}
                  aria-current={cluster.name === current ? 'true' : undefined}
                  {...actionProps(`clusters:switch-to:${cluster.name}`)}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm text-ai-fg">{cluster.alias || cluster.name}</span>
                      {/* Which one is the platform's own cluster: a member cluster can
                          be called anything, including `host`. */}
                      {cluster.isHost ? <Badge tone="info">{t('cluster.list.host')}</Badge> : null}
                    </span>
                    <span className="truncate text-[11px] text-ai-fg-muted">
                      {[cluster.name, cluster.kubernetesVersion, `${cluster.nodeCount}`].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <Badge tone={cluster.ready ? 'success' : 'warning'}>
                    {cluster.ready ? t('cluster.list.ready') : t('cluster.switch.notReady')}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>

          {!query.isPending && filtered.length === 0 ? (
            <div className="rounded-ai-md border border-ai-line p-4 text-center">
              <p className="text-sm text-ai-fg">{clusters.length === 0 ? t('cluster.switch.empty') : t('cluster.list.emptyTitle')}</p>
              <p className="mt-1 text-xs text-ai-fg-muted">{t('cluster.switch.emptyHint')}</p>
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  );
}