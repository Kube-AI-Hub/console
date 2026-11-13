import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { StorageListPage } from '@/pages/storage/StorageListPage';

/** `…/projects/:namespace/volumesnapshots` — the storage list. */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/volumesnapshots/')({
  component: volumesnapshotsRoute,
});

function volumesnapshotsRoute(): React.ReactElement {
  const { workspace, cluster, namespace } = Route.useParams();
  return <StorageListPage kind="volumesnapshots" workspace={workspace} cluster={cluster} namespace={namespace} />;
}
