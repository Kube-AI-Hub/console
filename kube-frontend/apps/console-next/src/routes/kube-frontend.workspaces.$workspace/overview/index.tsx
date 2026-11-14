import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { WorkspaceOverviewPage } from '@/pages/workspace/WorkspaceOverviewPage';

/** `…/workspaces/$workspace/overview` — 企业空间 overview。 */
export const Route = createFileRoute('/kube-frontend/workspaces/$workspace/overview/')({
  component: workspaceOverviewRoute,
});

function workspaceOverviewRoute(): React.ReactElement {
  const { workspace } = Route.useParams();
  return <WorkspaceOverviewPage workspace={workspace} />;
}
