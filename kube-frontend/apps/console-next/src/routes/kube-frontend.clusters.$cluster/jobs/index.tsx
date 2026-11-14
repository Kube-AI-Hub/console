import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterWorkloadsPage } from '@/pages/cluster/ClusterWorkloadsPage';

/** `…/clusters/$cluster/jobs` — 集群级 jobs。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/jobs/')({
  component: clusterWorkloadsRoute,
});

function clusterWorkloadsRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <ClusterWorkloadsPage cluster={cluster} kind="jobs" />;
}
