import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ClusterVolumeSnapshotsPage } from '@/pages/cluster/ClusterVolumeSnapshotsPage';

/** `…/clusters/$cluster/volume-snapshots` — 集群级存储卷快照列表。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/volume-snapshots/')({
  component: clusterVolumeSnapshotsRoute,
});

function clusterVolumeSnapshotsRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <ClusterVolumeSnapshotsPage cluster={cluster} />;
}
