import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { IpPoolDetailPage } from '@/pages/cluster/IpPoolDetailPage';

/** `…/clusters/$cluster/ippools/$name` — IP 池详情。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/ippools/$name')({
  component: ipPoolDetailRoute,
});

function ipPoolDetailRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <IpPoolDetailPage cluster={cluster} />;
}
