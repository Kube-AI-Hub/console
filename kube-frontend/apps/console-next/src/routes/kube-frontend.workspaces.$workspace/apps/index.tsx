import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { WorkspaceAppsPage } from '@/pages/appstore/WorkspaceAppsPage';

/** `…/workspaces/$workspace/apps` — 仓库应用。 */
export const Route = createFileRoute('/kube-frontend/workspaces/$workspace/apps/')({
  component: workspaceAppsRoute,
});

function workspaceAppsRoute(): React.ReactElement {
  const { workspace } = Route.useParams();
  return <WorkspaceAppsPage workspace={workspace} />;
}
