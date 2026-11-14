import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterWorkloadsPage } from '@/pages/cluster/ClusterWorkloadsPage';

/** `…/clusters/$cluster/statefulsets` — 集群级 statefulsets。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/statefulsets/')({
  component: clusterWorkloadsRoute,
});

function clusterWorkloadsRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <ClusterWorkloadsPage cluster={cluster} kind="statefulsets" />;
}
