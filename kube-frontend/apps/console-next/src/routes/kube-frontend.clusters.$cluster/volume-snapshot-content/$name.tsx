import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { VolumeSnapshotContentPage } from '@/pages/cluster/VolumeSnapshotContentPage';

/** `/volume-snapshot-content/$name` — 快照内容只读详情（老 console 的 SnapshotContent/Detail）。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/volume-snapshot-content/$name')({
  component: snapshotContentRoute,
});

function snapshotContentRoute(): React.ReactElement {
  const { name } = Route.useParams();
  return <VolumeSnapshotContentPage name={name} />;
}
