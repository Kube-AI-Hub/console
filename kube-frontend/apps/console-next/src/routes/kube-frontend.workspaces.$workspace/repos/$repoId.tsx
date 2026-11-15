import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { WorkspaceRepoDetailPage } from '@/pages/appstore/WorkspaceRepoDetailPage';

/** `…/workspaces/$workspace/repos/$repoId` — 应用仓库详情（基本信息 + 事件）。 */
export const Route = createFileRoute('/kube-frontend/workspaces/$workspace/repos/$repoId')({
  component: workspaceRepoDetailRoute,
});

function workspaceRepoDetailRoute(): React.ReactElement {
  const { workspace, repoId } = Route.useParams();
  return <WorkspaceRepoDetailPage workspace={workspace} repoId={repoId} />;
}
