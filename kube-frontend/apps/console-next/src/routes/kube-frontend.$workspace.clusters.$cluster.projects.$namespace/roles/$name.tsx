import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { RoleDetailPage } from '@/pages/settings/RoleDetailPage';

/** `…/projects/:namespace/roles/$name` — 项目角色详情。 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/roles/$name')({
  component: projectRoleDetailRoute,
});

function projectRoleDetailRoute(): React.ReactElement {
  const { workspace, cluster, namespace, name } = Route.useParams();
  return <RoleDetailPage workspace={workspace} cluster={cluster} namespace={namespace} name={name} />;
}
