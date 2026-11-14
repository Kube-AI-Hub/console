import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { WorkspaceRoleDetailPage } from '@/pages/workspace/WorkspaceRoleDetailPage';

/** `…/workspaces/$workspace/roles/$name` — 企业空间角色详情。 */
export const Route = createFileRoute('/kube-frontend/workspaces/$workspace/roles/$name')({
  component: workspaceRoleDetailRoute,
});

function workspaceRoleDetailRoute(): React.ReactElement {
  const { workspace, name } = Route.useParams();
  return <WorkspaceRoleDetailPage workspace={workspace} name={name} />;
}
