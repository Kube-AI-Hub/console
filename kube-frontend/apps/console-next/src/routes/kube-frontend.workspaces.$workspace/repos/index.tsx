import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { WorkspaceReposPage } from '@/pages/appstore/WorkspaceReposPage';

/** `…/workspaces/$workspace/repos` — 企业空间应用仓库。 */
export const Route = createFileRoute('/kube-frontend/workspaces/$workspace/repos/')({
  component: workspaceReposRoute,
});

function workspaceReposRoute(): React.ReactElement {
  const { workspace } = Route.useParams();
  return <WorkspaceReposPage workspace={workspace} />;
}
