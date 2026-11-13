import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { SettingsListPage } from '@/pages/settings/SettingsListPage';

/** `…/projects/:namespace/members` — 项目设置里的 members 列表。 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/members/')({
  component: membersRoute,
});

function membersRoute(): React.ReactElement {
  const { cluster, namespace } = Route.useParams();
  return <SettingsListPage kind="members" cluster={cluster} namespace={namespace} />;
}
