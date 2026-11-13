import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterVisibilityPage } from '@/pages/cluster/ClusterVisibilityPage';

/** `…/clusters/$cluster/visibility` — 集群可见性。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/visibility/')({
  component: visibilityRoute,
});

function visibilityRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <ClusterVisibilityPage cluster={cluster} />;
}
