import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ResourceMonitorPage } from '@/pages/cluster/ResourceMonitorPage';

/** `…/clusters/$cluster/monitor-resource` — 应用资源监控。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/monitor-resource/')({
  component: resourceMonitorRoute,
});

function resourceMonitorRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <ResourceMonitorPage cluster={cluster} />;
}
