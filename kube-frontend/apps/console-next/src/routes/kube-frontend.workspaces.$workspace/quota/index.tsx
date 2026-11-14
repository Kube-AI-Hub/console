import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { WorkspaceQuotaPage } from '@/pages/workspace/WorkspaceQuotaPage';

/** `…/workspaces/$workspace/quota` — 企业空间 quota。 */
export const Route = createFileRoute('/kube-frontend/workspaces/$workspace/quota/')({
  component: workspaceQuotaRoute,
});

function workspaceQuotaRoute(): React.ReactElement {
  const { workspace } = Route.useParams();
  return <WorkspaceQuotaPage workspace={workspace} />;
}
