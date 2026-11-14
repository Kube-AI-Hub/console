import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { WorkspaceMembersPage } from '@/pages/workspace/WorkspaceMembersPage';

/** `…/workspaces/$workspace/members` — 租户(企业空间) members。 */
export const Route = createFileRoute('/kube-frontend/workspaces/$workspace/members/')({
  component: workspaceMembersRoute,
});

function workspaceMembersRoute(): React.ReactElement {
  const { workspace } = Route.useParams();
  return <WorkspaceMembersPage workspace={workspace} />;
}
