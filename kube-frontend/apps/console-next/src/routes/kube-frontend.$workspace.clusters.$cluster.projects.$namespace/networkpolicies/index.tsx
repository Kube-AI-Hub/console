import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { NetworkIsolationPage } from '@/pages/settings/NetworkIsolationPage';

/** `…/projects/:namespace/networkpolicies` — 项目网络隔离。 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/networkpolicies/')({
  component: NetworkPoliciesRoute,
});

function NetworkPoliciesRoute(): React.ReactElement {
  const { workspace, cluster, namespace } = Route.useParams();
  return <NetworkIsolationPage workspace={workspace} cluster={cluster} namespace={namespace} />;
}
