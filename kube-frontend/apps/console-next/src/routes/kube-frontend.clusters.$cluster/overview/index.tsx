import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterOverviewPage } from '@/pages/cluster/ClusterOverviewPage';

/** `…/clusters/$cluster/overview` — 集群概览。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/overview/')({
  component: overviewRoute,
});

function overviewRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <ClusterOverviewPage cluster={cluster} />;
}
