import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterConfigMapsPage } from '@/pages/cluster/ClusterConfigMapsPage';

/** `…/clusters/$cluster/configmaps` — 集群级配置字典。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/configmaps/')({
  component: clusterConfigRoute,
});

function clusterConfigRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <ClusterConfigMapsPage cluster={cluster} />;
}
