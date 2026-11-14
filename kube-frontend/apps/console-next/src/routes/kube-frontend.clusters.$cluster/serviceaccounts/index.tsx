import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterServiceAccountsPage } from '@/pages/cluster/ClusterServiceAccountsPage';

/** `…/clusters/$cluster/serviceaccounts` — 集群级服务账号。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/serviceaccounts/')({
  component: clusterConfigRoute,
});

function clusterConfigRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <ClusterServiceAccountsPage cluster={cluster} />;
}
