import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { WorkspaceAppDetailPage } from '@/pages/appstore/WorkspaceAppDetailPage';

/** `…/workspaces/$workspace/apps/$appId` — 企业空间应用模板详情（版本 / 实例 / 基本信息）。 */
export const Route = createFileRoute('/kube-frontend/workspaces/$workspace/apps/$appId')({
  component: workspaceAppDetailRoute,
});

function workspaceAppDetailRoute(): React.ReactElement {
  const { workspace, appId } = Route.useParams();
  return <WorkspaceAppDetailPage workspace={workspace} appId={appId} />;
}
