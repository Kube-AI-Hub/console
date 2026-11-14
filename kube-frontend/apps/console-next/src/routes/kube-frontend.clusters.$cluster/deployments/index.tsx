import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterWorkloadsPage } from '@/pages/cluster/ClusterWorkloadsPage';

/** `…/clusters/$cluster/deployments` — 集群级 deployments。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/deployments/')({
  component: clusterWorkloadsRoute,
});

function clusterWorkloadsRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <ClusterWorkloadsPage cluster={cluster} kind="deployments" />;
}
