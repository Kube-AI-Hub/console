import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { WorkspaceDevopsPage } from '@/pages/workspace/WorkspaceDevopsPage';

/** `…/workspaces/$workspace/devops` — 企业空间 DevOps 工程列表。 */
export const Route = createFileRoute('/kube-frontend/workspaces/$workspace/devops/')({
  component: workspaceDevopsRoute,
});

function workspaceDevopsRoute(): React.ReactElement {
  const { workspace } = Route.useParams();
  return <WorkspaceDevopsPage workspace={workspace} />;
}
