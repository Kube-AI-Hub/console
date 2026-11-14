import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterCustomMonitoringPage } from '@/pages/cluster/ClusterCustomMonitoringPage';

/** `…/clusters/$cluster/custom-monitoring` — 自定义监控。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/custom-monitoring/')({
  component: customMonitoringRoute,
});

function customMonitoringRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <ClusterCustomMonitoringPage cluster={cluster} />;
}
