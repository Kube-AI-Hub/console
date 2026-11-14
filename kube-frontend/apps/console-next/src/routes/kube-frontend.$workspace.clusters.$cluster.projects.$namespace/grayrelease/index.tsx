import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { CanaryReleasesPage } from '@/pages/app-workloads/CanaryReleasesPage';

/**
 * `…/projects/:namespace/grayrelease` — 项目级灰度发布列表.
 *
 * Read-only this round: servicemesh is enabled on the cluster and the Strategy list is
 * the page the old console offers; creating a release is a later, wizard-sized step.
 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/grayrelease/')({
  component: grayReleaseRoute,
});

function grayReleaseRoute(): React.ReactElement {
  const { cluster, namespace } = Route.useParams();
  return <CanaryReleasesPage cluster={cluster} namespace={namespace} />;
}
