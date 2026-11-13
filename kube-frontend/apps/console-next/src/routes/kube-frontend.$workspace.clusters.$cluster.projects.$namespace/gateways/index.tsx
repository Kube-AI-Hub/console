import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { GatewayPage } from '@/pages/settings/GatewayPage';

/** `…/projects/:namespace/gateways` — 项目网关设置。 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/gateways/')({
  component: GatewaysRoute,
});

function GatewaysRoute(): React.ReactElement {
  const { cluster, namespace } = Route.useParams();
  return <GatewayPage cluster={cluster} namespace={namespace} />;
}
