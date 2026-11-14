import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { NetworkPolicyDetailPage } from '@/pages/settings/NetworkPolicyDetailPage';

/** `…/projects/$namespace/networkpolicies/$name` — 网络策略详情与编辑 YAML。 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/networkpolicies/$name')({
  component: networkPolicyDetailRoute,
});

function networkPolicyDetailRoute(): React.ReactElement {
  const { workspace, cluster, namespace } = Route.useParams();
  return <NetworkPolicyDetailPage workspace={workspace} cluster={cluster} namespace={namespace} />;
}
