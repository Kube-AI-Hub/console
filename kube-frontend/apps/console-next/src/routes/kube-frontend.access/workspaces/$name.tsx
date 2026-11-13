import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { WorkspaceDetailPage } from '@/pages/platform/WorkspaceDetailPage';

/** `/kube-frontend/access/workspaces/$name` — 企业空间详情。 */
export const Route = createFileRoute('/kube-frontend/access/workspaces/$name')({
  component: workspaceDetailRoute,
});

function workspaceDetailRoute(): React.ReactElement {
  return <WorkspaceDetailPage />;
}
