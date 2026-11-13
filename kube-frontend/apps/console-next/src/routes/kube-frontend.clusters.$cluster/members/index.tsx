import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterMembersPage } from '@/pages/cluster/ClusterMembersPage';

/** `…/clusters/$cluster/members` — 集群成员。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/members/')({
  component: membersRoute,
});

function membersRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <ClusterMembersPage cluster={cluster} />;
}
