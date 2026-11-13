import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { WorkloadDetailPage } from '@/pages/app-workloads/WorkloadDetailPage';
import { WORKLOAD_DESCRIPTORS, ensureWorkloadPageRegistered } from '@/pages/app-workloads/queries';

/**
 * `/kube-frontend/:workspace/clusters/:cluster/projects/:namespace/daemonsets/:name`
 *
 * The daemonsets detail. It is a sibling of the list inside the same folder: the folder's
 * `route.tsx` renders whichever of the two matches, so the detail is never hidden
 * behind the list.
 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/daemonsets/$name')({
  component: daemonsetsDetailRoute,
});

function daemonsetsDetailRoute(): React.ReactElement {
  const { workspace, cluster, namespace, name } = Route.useParams();
  const descriptor = WORKLOAD_DESCRIPTORS['daemonsets']!;
  ensureWorkloadPageRegistered(descriptor);
  return <WorkloadDetailPage descriptor={descriptor} workspace={workspace} cluster={cluster} namespace={namespace} name={name} />;
}
