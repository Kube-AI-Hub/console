import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { PersistentVolumeDetailPage } from '@/pages/cluster/PersistentVolumeDetailPage';

/** `…/clusters/$cluster/persistentvolumes/$name` — 持久卷详情。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/persistentvolumes/$name')({
  component: pvDetailRoute,
});

function pvDetailRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <PersistentVolumeDetailPage cluster={cluster} />;
}
