import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterMonitorPage } from '@/pages/cluster/ClusterMonitorPage';

/** `…/clusters/$cluster/monitor` — 集群监控。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/monitor/')({
  component: monitorRoute,
});

function monitorRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <ClusterMonitorPage cluster={cluster} />;
}
