import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { StorageDetailPage } from '@/pages/storage/StorageDetailPage';

/** `…/projects/:namespace/persistentvolumeclaims/:name` — the storage detail. */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/persistentvolumeclaims/$name')({
  component: persistentvolumeclaimsDetailRoute,
});

function persistentvolumeclaimsDetailRoute(): React.ReactElement {
  const { cluster, namespace, name } = Route.useParams();
  return <StorageDetailPage kind="persistentvolumeclaims" cluster={cluster} namespace={namespace} name={name} />;
}
