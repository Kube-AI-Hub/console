import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { IpPoolsPage } from '@/pages/cluster/IpPoolsPage';

/** `…/clusters/$cluster/ippools` — Pod IP 池。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/ippools/')({
  component: ipPoolsRoute,
});

function ipPoolsRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <IpPoolsPage cluster={cluster} />;
}
