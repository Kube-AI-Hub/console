import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { WorkspaceRolesPage } from '@/pages/workspace/WorkspaceRolesPage';

/** `…/workspaces/$workspace/roles` — 企业空间 roles。 */
export const Route = createFileRoute('/kube-frontend/workspaces/$workspace/roles/')({
  component: workspaceRolesRoute,
});

function workspaceRolesRoute(): React.ReactElement {
  const { workspace } = Route.useParams();
  return <WorkspaceRolesPage workspace={workspace} />;
}
