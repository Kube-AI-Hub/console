import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterGatewaysPage } from '@/pages/cluster/ClusterGatewaysPage';
import { GatewayDetailPage } from '@/pages/cluster/GatewayDetailPage';

/**
 * `…/clusters/$cluster/gateways/$name`
 *
 * The segment is two things in one: the old console has a cluster/project view
 * switch at this level, and a gateway detail below it. The two view names are
 * reserved, so any other value is a gateway detail — that keeps the existing
 * `/gateways/cluster` URLs working without a second dynamic segment.
 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/gateways/$name')({
  component: GatewayRoute,
});

function GatewayRoute(): React.ReactElement {
  const { cluster, name } = Route.useParams();
  if (name === 'cluster' || name === 'project') {
    return <ClusterGatewaysPage cluster={cluster} component={name} />;
  }
  return <GatewayDetailPage cluster={cluster} name={name} />;
}
