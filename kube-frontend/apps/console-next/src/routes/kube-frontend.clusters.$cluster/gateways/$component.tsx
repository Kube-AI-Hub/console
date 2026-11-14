import * as React from 'react';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { ClusterGatewaysPage } from '@/pages/cluster/ClusterGatewaysPage';

export const Route = createFileRoute('/kube-frontend/clusters/$cluster/gateways/$component')({
  beforeLoad: ({ params }) => {
    if (params.component !== 'cluster' && params.component !== 'project') throw notFound();
  },
  component: GatewayView,
});
function GatewayView(): React.ReactElement {
  const { cluster, component } = Route.useParams();
  return <ClusterGatewaysPage cluster={cluster} component={component as 'cluster' | 'project'} />;
}
