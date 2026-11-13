import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ProjectOverviewPage } from '@/pages/project/ProjectOverviewPage';

/** `…/projects/$namespace/overview` — 项目概览。 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/overview/')({
  component: overviewRoute,
});

function overviewRoute(): React.ReactElement {
  const { workspace, cluster, namespace } = Route.useParams();
  return <ProjectOverviewPage workspace={workspace} cluster={cluster} namespace={namespace} />;
}
