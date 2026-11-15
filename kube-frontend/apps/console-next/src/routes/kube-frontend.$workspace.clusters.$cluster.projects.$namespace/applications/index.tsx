import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { InstalledAppsPage } from '@/pages/appstore/InstalledAppsPage';

/**
 * `/kube-frontend/:workspace/clusters/:cluster/projects/:namespace/applications`
 *
 * The project's 应用 list — the same component as the workspace 已安装应用 page, scoped to
 * this namespace (source of the table is the project collection, plus install/uninstall).
 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/applications/')({
  component: projectApplicationsRoute,
});

function projectApplicationsRoute(): React.ReactElement {
  const { workspace, cluster, namespace } = Route.useParams();
  return <InstalledAppsPage workspace={workspace} cluster={cluster} project={namespace} />;
}
