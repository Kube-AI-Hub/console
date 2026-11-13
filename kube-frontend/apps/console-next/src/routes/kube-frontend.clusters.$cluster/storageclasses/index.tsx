import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { StorageClassesPage } from '@/pages/cluster/StorageClassesPage';

/** `…/clusters/$cluster/storageclasses` — 集群级存储类型列表。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/storageclasses/')({
  component: StorageClassesRoute,
});

function StorageClassesRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <StorageClassesPage cluster={cluster} />;
}
