import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { MonitoringListPage } from '@/pages/monitoring/MonitoringListPage';

/** `…/projects/:namespace/alerts` — the alerts list. */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/alerts/')({
  component: alertsRoute,
});

function alertsRoute(): React.ReactElement {
  const { cluster, namespace } = Route.useParams();
  return <MonitoringListPage kind="alerts" cluster={cluster} namespace={namespace} />;
}
