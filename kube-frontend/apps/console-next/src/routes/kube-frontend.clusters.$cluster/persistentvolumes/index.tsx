import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { PersistentVolumesPage } from '@/pages/cluster/PersistentVolumesPage';

/** `…/clusters/$cluster/persistentvolumes` — 集群级持久卷列表。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/persistentvolumes/')({
  component: PersistentVolumesRoute,
});

function PersistentVolumesRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <PersistentVolumesPage cluster={cluster} />;
}
