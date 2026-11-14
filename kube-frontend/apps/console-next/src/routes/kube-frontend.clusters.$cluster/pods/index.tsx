import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterPodsPage } from '@/pages/cluster/ClusterPodsPage';

/** `…/clusters/$cluster/workloads/pods` — 集群级容器组。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/pods/')({
  component: clusterPodsRoute,
});

function clusterPodsRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <ClusterPodsPage cluster={cluster} />;
}
