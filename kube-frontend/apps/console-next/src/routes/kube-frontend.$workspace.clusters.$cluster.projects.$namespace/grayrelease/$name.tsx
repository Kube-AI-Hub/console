import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { CanaryDetailPage } from '@/pages/app-workloads/canary/CanaryDetailPage';

/**
 * `…/projects/:namespace/grayrelease/:name` — one release.
 *
 * A sibling of the list inside the same folder: the folder's `route.tsx` renders
 * whichever child matches, so a detail URL never falls back to the list.
 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/grayrelease/$name')({
  component: grayReleaseDetailRoute,
});

function grayReleaseDetailRoute(): React.ReactElement {
  const { workspace, cluster, namespace, name } = Route.useParams();
  return <CanaryDetailPage workspace={workspace} cluster={cluster} namespace={namespace} name={name} />;
}
