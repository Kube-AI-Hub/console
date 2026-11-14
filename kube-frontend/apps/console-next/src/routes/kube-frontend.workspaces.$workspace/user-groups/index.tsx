import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { WorkspaceUserGroupsPage } from '@/pages/workspace/WorkspaceUserGroupsPage';

/** `…/workspaces/$workspace/user-groups` — 企业空间 user groups。 */
export const Route = createFileRoute('/kube-frontend/workspaces/$workspace/user-groups/')({
  component: workspaceUserGroupsRoute,
});

function workspaceUserGroupsRoute(): React.ReactElement {
  const { workspace } = Route.useParams();
  return <WorkspaceUserGroupsPage workspace={workspace} />;
}
