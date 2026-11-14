import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterPersistentVolumeClaimsPage } from '@/pages/cluster/ClusterPersistentVolumeClaimsPage';

/** `…/clusters/$cluster/persistentvolumeclaims` — 集群级存储卷声明。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/persistentvolumeclaims/')({
  component: clusterPersistentVolumeClaimsRoute,
});

function clusterPersistentVolumeClaimsRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <ClusterPersistentVolumeClaimsPage cluster={cluster} />;
}
