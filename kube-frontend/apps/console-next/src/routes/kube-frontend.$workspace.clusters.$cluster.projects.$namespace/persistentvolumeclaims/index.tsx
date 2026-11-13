import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { StorageListPage } from '@/pages/storage/StorageListPage';

/** `…/projects/:namespace/persistentvolumeclaims` — the storage list. */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/persistentvolumeclaims/')({
  component: persistentvolumeclaimsRoute,
});

function persistentvolumeclaimsRoute(): React.ReactElement {
  const { workspace, cluster, namespace } = Route.useParams();
  return <StorageListPage kind="persistentvolumeclaims" workspace={workspace} cluster={cluster} namespace={namespace} />;
}
