import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { CanaryReleasesPage } from '@/pages/app-workloads/CanaryReleasesPage';

/**
 * `…/projects/:namespace/grayrelease` — 项目级灰度发布列表.
 *
 * Rows link to the release detail; creation is the wizard-sized step on this page.
 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/grayrelease/')({
  component: grayReleaseRoute,
});

function grayReleaseRoute(): React.ReactElement {
  const { workspace, cluster, namespace } = Route.useParams();
  return <CanaryReleasesPage workspace={workspace} cluster={cluster} namespace={namespace} />;
}
