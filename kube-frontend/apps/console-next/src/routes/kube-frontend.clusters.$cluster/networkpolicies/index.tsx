import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterNetworkPoliciesPage } from '@/pages/cluster/ClusterNetworkPoliciesPage';

/** `…/clusters/$cluster/networkpolicies` — 集群级网络策略。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/networkpolicies/')({
  component: networkPoliciesRoute,
});

function networkPoliciesRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <ClusterNetworkPoliciesPage cluster={cluster} />;
}
