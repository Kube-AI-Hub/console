import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterSecretsPage } from '@/pages/cluster/ClusterSecretsPage';

/** `…/clusters/$cluster/secrets` — 集群级保密字典。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/secrets/')({
  component: clusterConfigRoute,
});

function clusterConfigRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <ClusterSecretsPage cluster={cluster} />;
}
