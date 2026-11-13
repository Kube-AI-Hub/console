import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { WorkloadListPage } from '@/pages/app-workloads/WorkloadListPage';
import { WORKLOAD_DESCRIPTORS, ensureWorkloadPageRegistered } from '@/pages/app-workloads/queries';

/**
 * `/kube-frontend/:workspace/clusters/:cluster/projects/:namespace/daemonsets`
 *
 * The daemonsets list. The page itself is shared by all eight application workloads; this
 * file supplies the descriptor that makes it daemonsets.
 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/daemonsets/')({
  component: daemonsetsRoute,
});

function daemonsetsRoute(): React.ReactElement {
  const { workspace, cluster, namespace } = Route.useParams();
  const descriptor = WORKLOAD_DESCRIPTORS['daemonsets']!;
  ensureWorkloadPageRegistered(descriptor);
  return <WorkloadListPage descriptor={descriptor} workspace={workspace} cluster={cluster} namespace={namespace} />;
}
