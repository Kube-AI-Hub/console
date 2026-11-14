import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterWorkloadsPage } from '@/pages/cluster/ClusterWorkloadsPage';

/** `…/clusters/$cluster/cronjobs` — 集群级 cronjobs。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/cronjobs/')({
  component: clusterWorkloadsRoute,
});

function clusterWorkloadsRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <ClusterWorkloadsPage cluster={cluster} kind="cronjobs" />;
}
