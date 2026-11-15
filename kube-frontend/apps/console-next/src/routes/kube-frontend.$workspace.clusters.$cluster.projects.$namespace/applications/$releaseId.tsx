import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { InstalledAppDetailPage } from '@/pages/appstore/InstalledAppDetailPage';

/** `…/projects/$namespace/applications/$releaseId` — 项目内应用实例详情。 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/applications/$releaseId')({
  component: projectApplicationDetailRoute,
});

function projectApplicationDetailRoute(): React.ReactElement {
  const { workspace, releaseId } = Route.useParams();
  return <InstalledAppDetailPage workspace={workspace} releaseId={releaseId} />;
}
