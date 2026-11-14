import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterVolumeSnapshotClassesPage } from '@/pages/cluster/ClusterVolumeSnapshotClassesPage';

/** `…/clusters/$cluster/volume-snapshot-classes` — 集群级快照类型列表。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/volume-snapshot-classes/')({
  component: clusterVolumeSnapshotClassesRoute,
});

function clusterVolumeSnapshotClassesRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <ClusterVolumeSnapshotClassesPage cluster={cluster} />;
}
