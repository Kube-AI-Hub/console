import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { InstalledAppsPage } from '@/pages/appstore/InstalledAppsPage';

/** `…/workspaces/$workspace/apps/instances` — 已安装应用（跨项目汇总）。 */
export const Route = createFileRoute('/kube-frontend/workspaces/$workspace/apps/instances/')({
  component: installedAppsRoute,
});

function installedAppsRoute(): React.ReactElement {
  const { workspace } = Route.useParams();
  return <InstalledAppsPage workspace={workspace} />;
}
