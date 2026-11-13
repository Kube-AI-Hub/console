import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { WorkloadListPage } from '@/pages/app-workloads/WorkloadListPage';
import { WORKLOAD_DESCRIPTORS, ensureWorkloadPageRegistered } from '@/pages/app-workloads/queries';

/**
 * `/kube-frontend/:workspace/clusters/:cluster/projects/:namespace/pods`
 *
 * The pods list. The page itself is shared by all eight application workloads; this
 * file supplies the descriptor that makes it pods.
 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/pods/')({
  component: podsRoute,
});

function podsRoute(): React.ReactElement {
  const { workspace, cluster, namespace } = Route.useParams();
  const descriptor = WORKLOAD_DESCRIPTORS['pods']!;
  ensureWorkloadPageRegistered(descriptor);
  return <WorkloadListPage descriptor={descriptor} workspace={workspace} cluster={cluster} namespace={namespace} />;
}
