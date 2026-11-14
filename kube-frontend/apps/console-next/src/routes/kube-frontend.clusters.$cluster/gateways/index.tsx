import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterGatewaysPage } from '@/pages/cluster/ClusterGatewaysPage';

export const Route = createFileRoute('/kube-frontend/clusters/$cluster/gateways/')({
  component: GatewayIndex,
});
function GatewayIndex(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <ClusterGatewaysPage cluster={cluster} />;
}
