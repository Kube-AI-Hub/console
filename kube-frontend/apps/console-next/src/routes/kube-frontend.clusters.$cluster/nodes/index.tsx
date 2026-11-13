import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterListPage } from '@/pages/cluster/ClusterListPage';

/** `…/clusters/$cluster/nodes` — 集群作用域的 nodes 列表。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/nodes/')({
  component: nodesRoute,
});

function nodesRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <ClusterListPage kind="nodes" cluster={cluster} />;
}
