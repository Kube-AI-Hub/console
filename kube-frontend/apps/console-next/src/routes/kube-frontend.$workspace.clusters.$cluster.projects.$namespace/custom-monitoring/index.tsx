import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ProjectCustomMonitoringPage } from '@/pages/monitoring/ProjectCustomMonitoringPage';

/** `…/projects/:namespace/custom-monitoring` — 项目级自定义监控。 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/custom-monitoring/')({
  component: projectCustomMonitoringRoute,
});

function projectCustomMonitoringRoute(): React.ReactElement {
  const { namespace } = Route.useParams();
  return <ProjectCustomMonitoringPage namespace={namespace} />;
}
