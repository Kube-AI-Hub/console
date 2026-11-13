import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterLogCollectionsPage } from '@/pages/cluster/ClusterLogCollectionsPage';

/** `…/clusters/$cluster/log-collections` — 集群日志收集。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/log-collections/')({
  component: logCollectionsRoute,
});

function logCollectionsRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <ClusterLogCollectionsPage cluster={cluster} />;
}
