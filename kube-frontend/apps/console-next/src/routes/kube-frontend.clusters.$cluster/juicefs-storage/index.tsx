import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { JuiceFSStoragePage } from '@/pages/cluster/JuiceFSStoragePage';

/** `…/clusters/$cluster/juicefs-storage` — JuiceFS 共享存储。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/juicefs-storage/')({
  component: juiceFSStorageRoute,
});

function juiceFSStorageRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <JuiceFSStoragePage cluster={cluster} />;
}
