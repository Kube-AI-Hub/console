import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { WorkspaceProjectsPage } from '@/pages/workspace/WorkspaceProjectsPage';

/** `…/workspaces/$workspace/projects` — 企业空间 projects。 */
export const Route = createFileRoute('/kube-frontend/workspaces/$workspace/projects/')({
  component: workspaceProjectsRoute,
});

function workspaceProjectsRoute(): React.ReactElement {
  const { workspace } = Route.useParams();
  return <WorkspaceProjectsPage workspace={workspace} />;
}
