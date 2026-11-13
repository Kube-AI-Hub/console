import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { StorageClassDetailPage } from '@/pages/cluster/StorageClassDetailPage';

/** `…/clusters/$cluster/storageclasses/$name` — 存储类型详情。 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/storageclasses/$name')({
  component: storageClassDetailRoute,
});

function storageClassDetailRoute(): React.ReactElement {
  const { cluster } = Route.useParams();
  return <StorageClassDetailPage key={cluster} />;
}
