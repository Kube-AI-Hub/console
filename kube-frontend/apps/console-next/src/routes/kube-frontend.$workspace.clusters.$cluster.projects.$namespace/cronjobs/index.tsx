import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { WorkloadListPage } from '@/pages/app-workloads/WorkloadListPage';
import { WORKLOAD_DESCRIPTORS, ensureWorkloadPageRegistered } from '@/pages/app-workloads/queries';

/**
 * `/kube-frontend/:workspace/clusters/:cluster/projects/:namespace/cronjobs`
 *
 * The cronjobs list. The page itself is shared by all eight application workloads; this
 * file supplies the descriptor that makes it cronjobs.
 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/cronjobs/')({
  component: cronjobsRoute,
});

function cronjobsRoute(): React.ReactElement {
  const { workspace, cluster, namespace } = Route.useParams();
  const descriptor = WORKLOAD_DESCRIPTORS['cronjobs']!;
  ensureWorkloadPageRegistered(descriptor);
  return <WorkloadListPage descriptor={descriptor} workspace={workspace} cluster={cluster} namespace={namespace} />;
}
