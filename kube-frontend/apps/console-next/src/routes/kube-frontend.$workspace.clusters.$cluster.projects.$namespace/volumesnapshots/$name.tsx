import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { StorageDetailPage } from '@/pages/storage/StorageDetailPage';

/** `…/projects/:namespace/volumesnapshots/:name` — the storage detail. */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/volumesnapshots/$name')({
  component: volumesnapshotsDetailRoute,
});

function volumesnapshotsDetailRoute(): React.ReactElement {
  const { cluster, namespace, name } = Route.useParams();
  return <StorageDetailPage kind="volumesnapshots" cluster={cluster} namespace={namespace} name={name} />;
}
