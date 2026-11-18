import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterMonitorPage } from '@/pages/cluster/ClusterMonitorPage';
import { DEFAULT_MONITOR_TAB, parseMonitorTab, type MonitorTabKey } from '@/pages/cluster/monitorTabs';

/**
 * `…/clusters/$cluster/monitor` — 集群监控.
 *
 * The five sub-pages of the old console's 集群状态 are tabs here, not routes: one
 * navigation entry, and the tab rides in `?tab=` so a reader can link to
 * "the scheduler charts" directly. An unknown value is ignored rather than
 * rejected, so an old bookmark or a typo still lands on the overview instead of
 * an error page.
 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/monitor/')({
  validateSearch: (search: Record<string, unknown>): { tab?: MonitorTabKey } => {
    const tab = parseMonitorTab(search.tab);
    return tab ? { tab } : {};
  },
  component: monitorRoute,
});

function monitorRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <ClusterMonitorPage
      cluster={cluster}
      tab={parseMonitorTab(tab) ?? DEFAULT_MONITOR_TAB}
      onTabChange={(next) => {
        // Replace the history entry rather than push: five tabs read as a tab
        // strip, not as five pages the back button should walk through.
        void navigate({ search: { tab: next }, replace: true });
      }}
    />
  );
}
