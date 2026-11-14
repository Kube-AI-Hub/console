import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { DevopsProjectDetailPage } from '@/pages/devops/DevopsProjectDetailPage';

/** `…/clusters/$cluster/devops/$name` — DevOps 工程详情。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/devops/$name/')({
  component: devopsProjectDetailRoute,
});

function devopsProjectDetailRoute(): React.ReactElement {
  const { cluster, name } = Route.useParams();
  return <DevopsProjectDetailPage cluster={cluster} name={name} />;
}
