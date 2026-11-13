import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterListPage } from '@/pages/cluster/ClusterListPage';

/** `…/clusters/$cluster/namespaces` — 集群作用域的 namespaces 列表。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/namespaces/')({
  component: namespacesRoute,
});

function namespacesRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <ClusterListPage kind="namespaces" cluster={cluster} />;
}
