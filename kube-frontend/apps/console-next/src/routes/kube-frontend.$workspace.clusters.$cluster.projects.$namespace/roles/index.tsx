import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { SettingsListPage } from '@/pages/settings/SettingsListPage';

/** `…/projects/:namespace/roles` — 项目设置里的 roles 列表。 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/roles/')({
  component: rolesRoute,
});

function rolesRoute(): React.ReactElement {
  const { workspace, cluster, namespace } = Route.useParams();
  return <SettingsListPage kind="roles" workspace={workspace} cluster={cluster} namespace={namespace} />;
}
