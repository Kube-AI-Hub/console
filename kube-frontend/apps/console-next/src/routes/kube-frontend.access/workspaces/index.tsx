import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { PlatformListPage } from '@/pages/platform/PlatformListPage';

/** `/kube-frontend/access/workspaces` — 平台级企业空间列表。 */
export const Route = createFileRoute('/kube-frontend/access/workspaces/')({
  component: workspacesRoute,
});

function workspacesRoute(): React.ReactElement {
  return <PlatformListPage kind="workspaces" />;
}
