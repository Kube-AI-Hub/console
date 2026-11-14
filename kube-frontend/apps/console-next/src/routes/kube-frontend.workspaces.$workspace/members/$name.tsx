import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { WorkspaceMemberDetailPage } from '@/pages/workspace/WorkspaceMemberDetailPage';

/** `…/workspaces/$workspace/members/$name` — 租户(企业空间)成员详情。 */
export const Route = createFileRoute('/kube-frontend/workspaces/$workspace/members/$name')({
  component: workspaceMemberDetailRoute,
});

function workspaceMemberDetailRoute(): React.ReactElement {
  const { workspace, name } = Route.useParams();
  return <WorkspaceMemberDetailPage workspace={workspace} name={name} />;
}
