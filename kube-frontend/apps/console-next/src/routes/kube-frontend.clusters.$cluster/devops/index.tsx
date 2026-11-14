import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { DevopsProjectsPage } from '@/pages/devops/DevopsProjectsPage';

/** `…/clusters/$cluster/devops` — DevOps 工程列表。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/devops/')({
  component: devopsProjectsRoute,
});

function devopsProjectsRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <DevopsProjectsPage cluster={cluster} />;
}
