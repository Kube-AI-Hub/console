import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { InstalledAppDetailPage } from '@/pages/appstore/InstalledAppDetailPage';

/** `…/workspaces/$workspace/apps/instances/$releaseId` — 已安装应用详情。 */
export const Route = createFileRoute('/kube-frontend/workspaces/$workspace/apps/instances/$releaseId')({
  component: installedAppDetailRoute,
});

function installedAppDetailRoute(): React.ReactElement {
  const { workspace, releaseId } = Route.useParams();
  return <InstalledAppDetailPage workspace={workspace} releaseId={releaseId} />;
}
