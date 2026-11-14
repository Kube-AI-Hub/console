import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterWorkloadsPage } from '@/pages/cluster/ClusterWorkloadsPage';

/** `…/clusters/$cluster/ingresses` — 集群级 ingresses。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/ingresses/')({
  component: clusterWorkloadsRoute,
});

function clusterWorkloadsRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <ClusterWorkloadsPage cluster={cluster} kind="ingresses" />;
}
