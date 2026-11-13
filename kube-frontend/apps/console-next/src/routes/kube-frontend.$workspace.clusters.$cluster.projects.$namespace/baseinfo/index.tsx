import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ProjectInfoPage } from '@/pages/settings/ProjectInfoPage';

/** `…/projects/:namespace/baseinfo` — 项目基本信息。 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/baseinfo/')({
  component: BaseInfoRoute,
});

function BaseInfoRoute(): React.ReactElement {
  const { cluster, namespace } = Route.useParams();
  return <ProjectInfoPage cluster={cluster} namespace={namespace} />;
}
