import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { WorkloadDetailPage } from '@/pages/app-workloads/WorkloadDetailPage';
import { WORKLOAD_DESCRIPTORS, ensureWorkloadPageRegistered } from '@/pages/app-workloads/queries';

/**
 * `/kube-frontend/:workspace/clusters/:cluster/projects/:namespace/services/:name`
 *
 * The services detail. It is a sibling of the list inside the same folder: the folder's
 * `route.tsx` renders whichever of the two matches, so the detail is never hidden
 * behind the list.
 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/services/$name')({
  component: servicesDetailRoute,
});

function servicesDetailRoute(): React.ReactElement {
  const { cluster, namespace, name } = Route.useParams();
  const descriptor = WORKLOAD_DESCRIPTORS['services']!;
  ensureWorkloadPageRegistered(descriptor);
  return <WorkloadDetailPage descriptor={descriptor} cluster={cluster} namespace={namespace} name={name} />;
}
