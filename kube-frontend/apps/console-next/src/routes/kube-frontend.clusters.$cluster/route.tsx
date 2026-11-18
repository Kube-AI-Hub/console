import * as React from 'react';
import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { clustersApi } from '@kube-ai-hub/api-client';
import { Panel } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';

/**
 * `/kube-frontend/clusters/$cluster`
 *
 * The cluster console's layout. It renders no navigation of its own: the cluster's
 * pages are listed in the **left sidebar** (the shell switches to the cluster menu for
 * this path prefix), which is how the old console presents "进入集群后管理它".
 *
 * It used to repeat the same list as a tab strip. Two identical menus stacked — one in
 * the sidebar, one under the header — is not a feature; the strip also carried the
 * breadcrumb, which the pages themselves provide.
 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster')({
  component: ClusterWorkspace,
});

function ClusterWorkspace(): React.ReactElement {
  const t = useT();
  const { cluster } = Route.useParams();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const page = /^\/kube-frontend\/clusters\/[^/]+\/([^/?#]+)/.exec(pathname)?.[1] ?? 'overview';

  /*
   * The sidebar disables these rows for a cluster that has not joined, but a bookmark,
   * a pasted URL or the browser's back button still gets here. Every page below reads
   * through the cluster's agent, so it can only answer "cluster <id> is not ready" — in
   * English, with no next step, which is the failure the sidebar change exists to avoid.
   *
   * 概览 stays reachable: it is the page that explains the state and carries the join
   * instructions. Anything else gets the same sentence, in the reader's language, and a
   * link to that page.
   *
   * Same query key as the shell, so this costs no extra request.
   */
  const clusters = useQuery({
    queryKey: ['clusters'],
    queryFn: ({ signal }) => clustersApi(apiClient).list({ signal }),
    staleTime: 30_000,
  });
  const ready = clusters.data?.items.find((item) => item.name === cluster)?.ready;

  if (ready === false && page !== 'overview') {
    return (
      <Panel title={t('cluster.overview.waitTitle')} icon="cluster" titleLevel={2} data-ai-id="cluster:not-ready">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ai-fg">{t('cluster.notReady.pageUnavailable')}</p>
          <a
            className="text-sm text-ai-link underline-offset-4 hover:underline"
            href={`/kube-frontend/clusters/${encodeURIComponent(cluster)}/overview`}
            data-ai-id="cluster:not-ready-overview"
          >
            {t('cluster.notReady.goOverview')}
          </a>
        </div>
      </Panel>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Outlet />
    </div>
  );
}
